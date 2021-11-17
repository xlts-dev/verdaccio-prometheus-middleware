import { register, Counter } from 'prom-client';
import { Logger, IPluginMiddleware, IBasicAuth, IStorageManager, PluginOptions } from '@verdaccio/types';
import { Request, Response, NextFunction, Application } from 'express';

import { MetricsConfig, MetricsLabels } from '../types';

import { getUsername, getUserAgentData } from './utils';

export const API_PATH_PREFIX = '/-/';
export const REQUEST_COUNTER_OPTIONS = {
  name: 'registry_requests',
  help: 'HTTP requests made to the registry',
  // Remember that every unique combination of key-value label pairs represents a new time series, which can
  // dramatically increase the amount of data stored. Refer to: https://prometheus.io/docs/practices/naming/#labels
  labelNames: ['username', 'userAgentName', 'packageGroup', 'statusCode'],
};

/**
 * A Verdaccio middleware plugin implementation. If enabled the following functionality is added:
 *   1. A single new metrics endpoint is exposed at a configurable path.
 *   2. Metrics are collected related only to install/download of packages.
 * Refer to: https://verdaccio.org/docs/plugin-middleware/
 */
export default class VerdaccioMiddlewarePlugin implements IPluginMiddleware<MetricsConfig> {
  public logger: Logger;
  public metricsEnabled: boolean;
  public metricsPath: string;
  public packageGroups: Record<string, string>;
  private requestsCounter = new Counter(REQUEST_COUNTER_OPTIONS);

  public constructor(config: MetricsConfig, options: PluginOptions<MetricsConfig>) {
    this.metricsEnabled = [true, 'true'].includes(config.enabled);
    this.metricsPath = config.metricsPath || '/-/metrics';
    this.packageGroups = config.packageGroups || [];
    this.logger = options.logger;
  }

  /**
   * This is the function that Verdaccio invokes when the appropriate middleware configuration is to use this plugin.
   * @param {Application} app - The Express application object.
   * @param {IBasicAuth<MetricsConfig>} auth - The Verdaccio authentication service.
   * @param {IStorageManager<MetricsConfig>} storage -The Verdaccio storage manager service.
   */
  public register_middlewares(
    app: Application,
    auth: IBasicAuth<MetricsConfig>,
    storage: IStorageManager<MetricsConfig>
  ): void {
    if (this.metricsEnabled) {
      this.logger.info(`metrics: [register_middlewares] metrics are enabled and exposed at '${this.metricsPath}'`);
      app.use(this.collectMetrics.bind(this));
      app.get(this.metricsPath, this.getMetrics.bind(this));
    } else {
      this.logger.warn('metrics: [register_middlewares] metrics are disabled');
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
    res.setHeader('Content-Type', register.contentType);
    res.status(200);
    res.send(await register.metrics());
  }

  /**
   * Express middleware function responsible for collecting metrics on requests to install/download a package.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   * @param {NextFunction} next - A function that invokes the next Express middleware function succeeding this one.
   * @returns {Promise<void>} - A promise that resolves to undefined since the function is async.
   */
  public collectMetrics(req: Request, res: Response, next: NextFunction): void {
    const { method, path } = req;

    switch (true) {
      case !this.metricsEnabled:
        return next();
      case method !== 'GET':
        this.logger.debug(
          { path, method },
          `metrics: [collectMetrics] request is not a 'GET' request: ${method} '${path}'`
        );
        return next();
      case path === this.metricsPath:
      case path.startsWith(API_PATH_PREFIX):
        this.logger.debug({ path }, `metrics: [collectMetrics] request is for an excluded API path: '${path}'`);
        return next();
      default:
        this.logger.debug(`metrics: [collectMetrics] collecting metrics for request: ${method} '${path}'`);
    }

    const authorization = req.header('authorization');
    const userAgentString = req.header('user-agent');
    const decodedPath = decodeURIComponent(path);
    const { authType, username } = getUsername(this.logger, authorization);
    const { userAgentName, userAgentVersion } = getUserAgentData(this.logger, userAgentString);
    const [, packageGroup] =
      Object.entries(this.packageGroups).find(([regex]: [string, string]) => new RegExp(regex).test(decodedPath)) || [];

    this.logger.debug(
      { authType, username, userAgentName, userAgentVersion, packageGroup },
      'metrics: [collectMetrics] initial request metrics collected'
    );

    // We won't know the final status code until the response is sent to the client. Because of this we don't collect
    // the metrics for this request until the response 'finish' event is emitted.
    res.once('finish', () => {
      const { statusCode } = res;
      const metricLabels: MetricsLabels = { username, userAgentName, statusCode };
      if (packageGroup) {
        metricLabels.packageGroup = packageGroup;
      }
      this.logger.info(
        { authType, userAgentVersion, ...metricLabels },
        'metrics: [collectMetrics] final response metrics collected'
      );
      // @ts-ignore: The type definitions for `labels` are not great so ignore the TypeScript error.
      this.requestsCounter.labels(metricLabels).inc(1);
    });

    next();
  }
}
