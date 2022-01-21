import * as chanceJs from 'chance';
import { register } from 'prom-client';
import { Application } from 'express';
import { IBasicAuth, IStorageManager, PluginOptions } from '@verdaccio/types';

import MetricsPlugin, { DEFAULT_METRICS_PATH } from '../src';
import { MetricsConfig } from '../src/types';
import { AuthType, UNKNOWN } from '../src/utils';

import { getExpressMocks, getRequestOptions, getLogger, getRequestMetricsJson } from './testUtils';
const chance = chanceJs();

describe('HTTP Request Metrics', () => {
  describe('should register middleware (http request metrics enabled)', () => {
    const logger = getLogger();
    const metricName = chance.word();
    const app = { all: jest.fn(), get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { requestMetrics: { enabled: true, metricName } } as MetricsConfig,
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
      const mockAll = (app.all as jest.MockedFn<jest.MockableFunction>).mock;
      const mockGet = (app.get as jest.MockedFn<jest.MockableFunction>).mock;
      expect(app.all).toHaveBeenCalledTimes(1);
      expect(app.get).toHaveBeenCalledTimes(1);
      expect(mockAll.calls[0][0]).toEqual(/.*/);
      expect(mockGet.calls[0][0]).toEqual(DEFAULT_METRICS_PATH);
    });
  });

  describe('should register middleware (http request metrics disabled)', () => {
    const logger = getLogger();
    const app = { all: jest.fn(), get: jest.fn() } as unknown as Application;
    const metricsConfig = { requestMetrics: { enabled: false } } as MetricsConfig;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(metricsConfig, { logger } as PluginOptions<MetricsConfig>);
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should not invoke any express API', () => {
      expect(app.all).toHaveBeenCalledTimes(0);
    });

    test('should log warn that metrics are disabled', () => {
      expect(logger.warn).toHaveBeenCalledWith(metricsConfig, 'metrics: [register_middlewares] metrics are disabled');
    });
  });

  describe('should provide a valid Prometheus text format response', () => {
    const app = { all: jest.fn(), get: jest.fn() } as unknown as Application;
    const { req, res, next } = getExpressMocks();

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { requestMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      metricsPlugin.collectRequestMetrics(req, res, next);
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
          '# HELP registry_http_requests Count of HTTP requests made to the registry',
          '# TYPE registry_http_requests counter',
          'registry_http_requests{httpMethod="GET",username="UNKNOWN",userAgentName="UNKNOWN",statusCode="200"} 1\n',
        ].join('\n'),
      );
    });
  });

  describe('should collect http metrics on every request', () => {
    let metricsPlugin;
    const app = { all: jest.fn(), get: jest.fn() } as unknown as Application;
    const [username1, username2] = chance.n(chance.word, 2);
    const [userAgentArtifactory, userAgentNpm] = [
      { userAgentName: 'Artifactory', userAgentVersion: '7.1.1' },
      { userAgentName: 'npm', userAgentVersion: '8.2.3' },
    ];
    const expressMocks = [
      getExpressMocks(),
      getExpressMocks(getRequestOptions({ httpMethod: 'POST' })),
      getExpressMocks(getRequestOptions({ authType: AuthType.jwt, username: username1 })),
      getExpressMocks(getRequestOptions({ authType: AuthType.password, username: username1, httpMethod: 'PUT' })),
      getExpressMocks(getRequestOptions({ authType: AuthType.jwt, username: username2, ...userAgentArtifactory })),
      getExpressMocks(getRequestOptions({ authType: AuthType.password, username: username2, ...userAgentNpm })),
    ];

    beforeAll(() => {
      register.clear();
      metricsPlugin = new MetricsPlugin(
        { requestMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      expressMocks.forEach(({ req, res, next }) => metricsPlugin.collectRequestMetrics(req, res, next));
    });

    test('should invoke the correct express API calls', () => {
      expressMocks.forEach(({ next }) => {
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    test('should collect metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(
        getRequestMetricsJson([
          { value: 1, labels: { httpMethod: 'GET', userAgentName: UNKNOWN, username: UNKNOWN, statusCode: 200 } },
          { value: 1, labels: { httpMethod: 'POST', userAgentName: UNKNOWN, username: UNKNOWN, statusCode: 200 } },
          { value: 1, labels: { httpMethod: 'GET', userAgentName: UNKNOWN, username: username1, statusCode: 200 } },
          { value: 1, labels: { httpMethod: 'PUT', userAgentName: UNKNOWN, username: username1, statusCode: 200 } },
          {
            value: 1,
            labels: { httpMethod: 'GET', userAgentName: 'Artifactory', username: username2, statusCode: 200 },
          },
          { value: 1, labels: { httpMethod: 'GET', userAgentName: 'npm', username: username2, statusCode: 200 } },
        ]),
      );
    });
  });

  describe('should not collect http metrics on excluded paths', () => {
    let metricsPlugin;
    const app = { all: jest.fn(), get: jest.fn() } as unknown as Application;
    const expressMocks = [
      // These 3 requests should count towards metrics
      getExpressMocks(getRequestOptions({ path: '/@scoped/test-package' })),
      getExpressMocks(getRequestOptions({ path: '/@scoped%2Ftest-package' })),
      getExpressMocks(getRequestOptions({ path: `/non-scoped-${chance.word()}` })),
      // These 6 requests should NOT count towards metrics
      getExpressMocks(getRequestOptions({ path: '/' })),
      getExpressMocks(getRequestOptions({ path: '/-/ping' })),
      getExpressMocks(getRequestOptions({ path: `/-/static/${chance.word()}` })),
      getExpressMocks(getRequestOptions({ path: `/-/verdaccio/${chance.word()}` })),
      getExpressMocks(getRequestOptions({ path: `/-/web/${chance.word()}` })),
      getExpressMocks(getRequestOptions({ path: '/-/favicon.ico' })),
    ];

    beforeAll(() => {
      register.clear();
      metricsPlugin = new MetricsPlugin(
        { requestMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      expressMocks.forEach(({ req, res, next }) => metricsPlugin.collectRequestMetrics(req, res, next));
    });

    test('should invoke the correct express API calls', () => {
      expressMocks.forEach(({ next }) => {
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    test('should collect metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(
        getRequestMetricsJson([
          { value: 3, labels: { httpMethod: 'GET', userAgentName: UNKNOWN, username: UNKNOWN, statusCode: 200 } },
        ]),
      );
    });
  });
});
