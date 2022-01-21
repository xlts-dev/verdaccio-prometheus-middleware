import * as chanceJs from 'chance';
import { register } from 'prom-client';
import { Application } from 'express';
import { IBasicAuth, IStorageManager, PluginOptions } from '@verdaccio/types';

import MetricsPlugin, { DEFAULT_METRICS_PATH } from '../src';
import { MetricsConfig } from '../src/types';
import { AuthType, UNKNOWN } from '../src/utils';

import { getExpressMocks, getRequestOptions, getLogger, getPackageMetricsJson } from './testUtils';
const chance = chanceJs();

describe('Package Download Metrics', () => {
  describe('should register middleware (package download metrics enabled)', () => {
    const logger = getLogger();
    const metricName = chance.word();
    const app = { get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { packageMetrics: { enabled: true, metricName } } as MetricsConfig,
        { logger } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should use the provided custom metric name', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics.length).toEqual(1);
      expect(metrics[0].name).toEqual(metricName);
    });

    test('should invoke the correct express API calls', () => {
      const mock = (app.get as jest.MockedFn<jest.MockableFunction>).mock;
      expect(app.get).toHaveBeenCalledTimes(2);
      expect(mock.calls[0][0]).toEqual(/.*[.]tgz$/i);
      expect(mock.calls[1][0]).toEqual(DEFAULT_METRICS_PATH);
    });
  });

  describe('should register middleware (package download metrics disabled)', () => {
    const logger = getLogger();
    const app = { get: jest.fn() } as unknown as Application;
    const metricsConfig = { packageMetrics: { enabled: false } } as MetricsConfig;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(metricsConfig, { logger } as PluginOptions<MetricsConfig>);
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should not invoke any express API', () => {
      expect(app.get).toHaveBeenCalledTimes(0);
    });

    test('should log warn that metrics are disabled', () => {
      expect(logger.warn).toHaveBeenCalledWith(metricsConfig, 'metrics: [register_middlewares] metrics are disabled');
    });
  });

  describe('should not record metrics for HTTP HEAD requests', () => {
    const app = { get: jest.fn() } as unknown as Application;
    const { req, res, next } = getExpressMocks(getRequestOptions({ httpMethod: 'HEAD' }));

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { packageMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      metricsPlugin.collectPackageMetrics(req, res, next);
      metricsPlugin.getMetrics(req, res);
    });
    test('should invoke the correct express API calls', () => {
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should not have collected any metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(getPackageMetricsJson([]));
    });
  });

  describe('should provide a valid Prometheus text format response', () => {
    const app = { get: jest.fn() } as unknown as Application;
    const { req, res, next } = getExpressMocks();

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { packageMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      metricsPlugin.collectPackageMetrics(req, res, next);
      metricsPlugin.getMetrics(req, res);
    });

    test('should invoke the correct express API calls', () => {
      expect(res.setHeader).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', register.contentType);
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith(
        [
          '# HELP registry_package_downloads Count of package downloads from the registry',
          '# TYPE registry_package_downloads counter',
          'registry_package_downloads{username="UNKNOWN",userAgentName="UNKNOWN",statusCode="200"} 1\n',
        ].join('\n'),
      );
    });
  });

  describe('should collect metrics when `packageGroups` are NOT defined', () => {
    let metricsPlugin;
    const app = { get: jest.fn() } as unknown as Application;
    const [username1, username2] = chance.n(chance.word, 2);
    const [userAgentArtifactory, userAgentNpm] = [
      { userAgentName: 'Artifactory', userAgentVersion: '7.1.1' },
      { userAgentName: 'npm', userAgentVersion: '8.2.3' },
    ];
    const expressMocks = [
      getExpressMocks(),
      getExpressMocks(),
      getExpressMocks(getRequestOptions({ authType: AuthType.jwt, username: username1 })),
      getExpressMocks(getRequestOptions({ authType: AuthType.password, username: username1 })),
      getExpressMocks(getRequestOptions({ authType: AuthType.jwt, username: username2, ...userAgentArtifactory })),
      getExpressMocks(getRequestOptions({ authType: AuthType.password, username: username2, ...userAgentNpm })),
    ];

    beforeAll(() => {
      register.clear();
      metricsPlugin = new MetricsPlugin(
        { packageMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      expressMocks.forEach(({ req, res, next }) => metricsPlugin.collectPackageMetrics(req, res, next));
    });

    test('should invoke the correct express API calls', () => {
      expressMocks.forEach(({ next }) => {
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    test('should collect metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(
        getPackageMetricsJson([
          { value: 2, labels: { userAgentName: UNKNOWN, username: UNKNOWN, statusCode: 200 } },
          { value: 2, labels: { userAgentName: UNKNOWN, username: username1, statusCode: 200 } },
          { value: 1, labels: { userAgentName: 'Artifactory', username: username2, statusCode: 200 } },
          { value: 1, labels: { userAgentName: 'npm', username: username2, statusCode: 200 } },
        ]),
      );
    });
  });

  describe('should collect metrics when `packageGroups` are defined', () => {
    let metricsPlugin;
    const app = { get: jest.fn() } as unknown as Application;
    const [username1, username2] = chance.n(chance.word, 2);
    const [userAgentArtifactory, userAgentNpm] = [
      { userAgentName: 'Artifactory', userAgentVersion: '7.1.1' },
      { userAgentName: 'npm', userAgentVersion: '8.2.3' },
    ];
    const packageGroups = {
      '@scoped/test-package[^/]*9[.]1[.]x': 'test-package-9.1.x',
      '@scoped/test-package': 'test-package',
      'non-scoped': 'non-scoped',
      '.*': 'other',
    } as Record<string, string>;
    const expressMocks = [
      getExpressMocks(getRequestOptions({ path: '/@scoped/test-package' })),
      getExpressMocks(getRequestOptions({ path: '/@scoped%2Ftest-package' })),
      getExpressMocks(getRequestOptions({ username: username1, path: `/@scoped/test-package-${chance.word()}9.1.x` })),
      getExpressMocks(getRequestOptions({ username: username1, path: `/non-scoped-${chance.word()}` })),
      getExpressMocks(getRequestOptions({ username: username2, path: `/${chance.word()}`, ...userAgentNpm })),
      getExpressMocks(
        getRequestOptions({ username: username2, path: `/@scoped/${chance.word}`, ...userAgentArtifactory }),
      ),
    ];

    beforeAll(() => {
      register.clear();
      metricsPlugin = new MetricsPlugin(
        { packageMetrics: { enabled: true, packageGroups } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      expressMocks.forEach(({ req, res, next }) => metricsPlugin.collectPackageMetrics(req, res, next));
    });

    test('should invoke the correct express API calls', () => {
      expressMocks.forEach(({ next }) => {
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    test('should collect metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(
        getPackageMetricsJson([
          {
            value: 2,
            labels: { username: UNKNOWN, userAgentName: UNKNOWN, packageGroup: 'test-package', statusCode: 200 },
          },
          {
            value: 1,
            labels: {
              username: username1,
              userAgentName: UNKNOWN,
              packageGroup: 'test-package-9.1.x',
              statusCode: 200,
            },
          },
          {
            value: 1,
            labels: { username: username1, userAgentName: UNKNOWN, packageGroup: 'non-scoped', statusCode: 200 },
          },
          {
            value: 1,
            labels: { username: username2, userAgentName: 'npm', packageGroup: 'other', statusCode: 200 },
          },
          {
            value: 1,
            labels: { username: username2, userAgentName: 'Artifactory', packageGroup: 'other', statusCode: 200 },
          },
        ]),
      );
    });
  });
});
