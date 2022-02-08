import { Logger, IPluginMiddleware, IBasicAuth, IStorageManager, PluginOptions } from '@verdaccio/types';
import { Request, Response, NextFunction, Application } from 'express';

import { MetricsConfig, PackageMetricsLabels, RequestMetricsLabels } from './types';
import { getUsername, getUserAgentData } from './utils';
import { CONTENT_TYPE_METRICS, Metrics } from './metrics';

export const DEFAULT_METRICS_PATH = '/-/metrics';
export const DEFAULT_EXCLUDED_PATHS = [
  '^/$', // root path to web ui
  '^/[-]/ping', // health endpoint
  '^/[-]/(static|verdaccio|web)', // web ui related paths
  '[.]ico$', // requests for icons (e.g. `favicon.ico`)
];

/**
 * A Verdaccio middleware plugin implementation. The following functionality is added if enabled in configuration:
 *   1. A single new metrics endpoint is exposed at a configurable path.
 *   2. Metrics are collected related to install/download of package tarballs.
 *   3. Metrics are collected related to every http request.
 *   4. Prometheus default metrics are collected.
 * Refer to: https://verdaccio.org/docs/plugin-middleware/
 */
export default class VerdaccioMiddlewarePlugin implements IPluginMiddleware<MetricsConfig> {
  private metrics: Metrics | null = null;
  private readonly logger: Logger;
  private readonly metricsConfig: MetricsConfig;
  public readonly metricsPath: string;
  public readonly defaultMetricsEnabled: boolean;
  public readonly requestMetricsEnabled: boolean;
  public readonly packageMetricsEnabled: boolean;
  public readonly packageGroups: Record<string, string>;
  public readonly pathExclusions: RegExp[];

  public constructor(config: MetricsConfig, options: PluginOptions<MetricsConfig>) {
    this.metricsConfig = config;
    this.metricsPath = config.metricsPath || DEFAULT_METRICS_PATH;
    this.defaultMetricsEnabled = [true, 'true'].includes(config.defaultMetrics?.enabled || false);
    this.requestMetricsEnabled = [true, 'true'].includes(config.requestMetrics?.enabled || false);
    this.packageMetricsEnabled = [true, 'true'].includes(config.packageMetrics?.enabled || false);
    this.packageGroups = config.packageMetrics?.packageGroups || {};
    this.pathExclusions = (config.requestMetrics?.pathExclusions || DEFAULT_EXCLUDED_PATHS).map(
      (path) => new RegExp(path, 'i'),
    );
    this.pathExclusions.push(new RegExp(`^${this.metricsPath}$`));
    this.logger = options.logger;
  }

  /**
   * This is the function that Verdaccio invokes when the appropriate configuration is present to use this plugin.
   * @param {Application} app - The Express application object.
   * @param {IBasicAuth<MetricsConfig>} auth - The Verdaccio authentication service.
   * @param {IStorageManager<MetricsConfig>} storage -The Verdaccio storage manager service.
   */
  public register_middlewares(
    app: Application,
    auth: IBasicAuth<MetricsConfig>,
    storage: IStorageManager<MetricsConfig>,
  ): void {
    const { defaultMetrics, requestMetrics, packageMetrics } = this.metricsConfig;
    if (this.defaultMetricsEnabled || this.requestMetricsEnabled || this.packageMetricsEnabled) {
      const { defaultMetricsEnabled, requestMetricsEnabled, packageMetricsEnabled } = this;
      this.metrics = new Metrics({
        defaultMetricsEnabled,
        requestMetricsEnabled,
        requestMetricsName: this.metricsConfig?.requestMetrics?.metricName,
        packageMetricsEnabled,
        packageMetricsName: this.metricsConfig?.packageMetrics?.metricName,
      });
      this.logger.info(
        { defaultMetrics, requestMetrics, packageMetrics },
        `metrics: [register_middlewares] metrics are enabled and exposed at '${this.metricsPath}'`,
      );
      requestMetricsEnabled && app.all(/.*/, this.collectRequestMetrics.bind(this));
      packageMetricsEnabled && app.get(/.*[.]tgz$/i, this.collectPackageMetrics.bind(this));
      app.get(this.metricsPath, this.getMetrics.bind(this));
    } else {
      this.logger.warn(
        { defaultMetrics, requestMetrics, packageMetrics },
        'metrics: [register_middlewares] metrics are disabled',
      );
    }
  }

  /**
   * Express callback function that responds to requests at the metrics path.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   * @returns {Promise<void>} - A promise that resolves to undefined since the function is async.
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    this.logger.debug(`metrics: [getMetrics] providing metrics response`);
    const metricsResponse = this.metrics ? await this.metrics.getMetricsResponse() : '';
    res.setHeader('Content-Type', CONTENT_TYPE_METRICS);
    res.status(200);
    res.send(metricsResponse);
  }

  /**
   * Express middleware function responsible for collecting metrics on every incoming request.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   * @param {NextFunction} next - A function that invokes the next Express middleware function succeeding this one.
   */
  public collectRequestMetrics(req: Request, res: Response, next: NextFunction): void {
    const { httpMethod, decodedPath, authType, username, userAgentString, userAgentName, userAgentVersion } =
      this._getRequestMetadata(req);

    const pathIsExcluded = this.pathExclusions.some((pathRegex) => pathRegex.test(decodedPath));
    if (pathIsExcluded) {
      this.logger.trace({ decodedPath }, `metrics: [collectRequestMetrics] path '${decodedPath}' is excluded`);
      next();
      return;
    }

    // We won't know the final status code until the response is sent to the client. Because of this we don't collect
    // the metrics for this request until the response 'close' event is emitted.
    res.once('close', () => {
      const { statusCode } = res;
      const metricLabels: RequestMetricsLabels = { httpMethod, username, userAgentName, statusCode };
      this.logger.info(
        { metricsType: 'request', decodedPath, authType, userAgentString, userAgentVersion, ...metricLabels },
        'metrics: [collectRequestMetrics] request metrics collected',
      );
      this.metrics?.incrementRequestCounter(metricLabels);
    });

    next();
  }

  /**
   * Express middleware function responsible for collecting metrics on requests to install/download a package.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   * @param {NextFunction} next - A function that invokes the next Express middleware function succeeding this one.
   */
  public collectPackageMetrics(req: Request, res: Response, next: NextFunction): void {
    // A `head` middleware handler needs to be defined first for the same path as the HTTP GET path or the `get`
    // middleware handler will be called automatically for the HTTP HEAD requests. This isn't obvious and is only
    // noted briefly in the Express API docs here: https://expressjs.com/en/api.html#routing-methods
    if (req.method !== 'GET') {
      return next();
    }

    const { decodedPath, authType, username, userAgentString, userAgentName, userAgentVersion } =
      this._getRequestMetadata(req);
    const [, packageGroup] =
      Object.entries(this.packageGroups).find(([regex]: [string, string]) => new RegExp(regex).test(decodedPath)) || [];

    // We won't know the final status code until the response is sent to the client. Because of this we don't collect
    // the metrics for this request until the response 'close' event is emitted.
    res.once('close', () => {
      const { statusCode } = res;
      const metricLabels: PackageMetricsLabels = { username, userAgentName, statusCode };
      if (packageGroup) {
        metricLabels.packageGroup = packageGroup;
      }
      this.logger.info(
        { metricsType: 'package', decodedPath, authType, userAgentString, userAgentVersion, ...metricLabels },
        'metrics: [collectPackageMetrics] package metrics collected',
      );
      this.metrics?.incrementPackageDownloadCounter(metricLabels);
    });

    next();
  }

  private _getRequestMetadata(req: Request) {
    const { path, method: httpMethod } = req;
    const authorization = req.header('authorization');
    const userAgentString = req.header('user-agent');
    const { authType, username } = getUsername(this.logger, authorization);
    const { userAgentName, userAgentVersion } = getUserAgentData(this.logger, userAgentString);

    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch (error) {} // eslint-disable-line no-empty

    return { httpMethod, decodedPath, authType, username, userAgentString, userAgentName, userAgentVersion };
  }
}
