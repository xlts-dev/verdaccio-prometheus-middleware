import chanceJs from 'chance';
import { register } from 'prom-client';
import { Application } from 'express';
import { IBasicAuth, IStorageManager, PluginOptions } from '@verdaccio/types';

import MetricsPlugin, { REQUEST_COUNTER_OPTIONS } from '../src';
import { MetricsConfig } from '../src/types';
import { AuthType, UNKNOWN } from '../src/utils';

// @ts-ignore
import { getExpressMocks, getRequestOptions, getLogger } from './testUtils';

const chance = chanceJs();

const getMetricsJson = (values) => [
  {
    aggregator: 'sum',
    help: REQUEST_COUNTER_OPTIONS.help,
    name: REQUEST_COUNTER_OPTIONS.name,
    type: 'counter',
    values,
  },
];

describe('Metrics Plugin', () => {
  describe('should register middleware (metrics enabled)', () => {
    const logger = getLogger();
    const app = { get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { metricsEnabled: true } as MetricsConfig,
        { logger } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should invoke the correct express API calls', () => {
      expect(app.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('should register middleware (metrics disabled)', () => {
    const logger = getLogger();
    const app = { get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { metricsEnabled: false } as MetricsConfig,
        { logger } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should not invoke any express API', () => {
      expect(app.get).toHaveBeenCalledTimes(0);
    });

    test('should log warn that metrics are disabled', () => {
      expect(logger.warn).toHaveBeenCalledWith('metrics: [register_middlewares] metrics are disabled');
    });
  });

  describe('should use express APIs to provide a valid metrics response', () => {
    const { req, res, next } = getExpressMocks();

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { metricsEnabled: true } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.collectMetrics(req, res, next);
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
          '# HELP registry_requests HTTP requests made to the registry',
          '# TYPE registry_requests counter',
          'registry_requests{username="UNKNOWN",userAgentName="UNKNOWN",statusCode="200"} 1\n',
        ].join('\n'),
      );
    });
  });

  describe('should collect metrics when `packageGroups` are NOT defined', () => {
    let metricsPlugin;
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
        { metricsEnabled: true } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      expressMocks.forEach(({ req, res, next }) => metricsPlugin.collectMetrics(req, res, next));
    });

    test('should invoke the correct express API calls', () => {
      expressMocks.forEach(({ next }) => {
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    test('should not collect any metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(
        getMetricsJson([
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
    const [username1, username2] = chance.n(chance.word, 2);
    const [userAgentArtifactory, userAgentNpm] = [
      { userAgentName: 'Artifactory', userAgentVersion: '7.1.1' },
      { userAgentName: 'npm', userAgentVersion: '8.2.3' },
    ];
    const packageGroups = {
      '@scoped[/]test-package[^/]*9[.]1[.]x': 'test-package-9.1.x',
      '@scoped[/]test-package': 'test-package',
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
        { metricsEnabled: true, packageGroups } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      expressMocks.forEach(({ req, res, next }) => metricsPlugin.collectMetrics(req, res, next));
    });

    test('should invoke the correct express API calls', () => {
      expressMocks.forEach(({ next }) => {
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    test('should not collect any metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics).toEqual(
        getMetricsJson([
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

  describe('should collect default prometheus metrics when `collectDefaultMetrics` is set to `true`', () => {
    const { req, res, next } = getExpressMocks();
    const app = { get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { metricsEnabled: true, collectDefaultMetrics: true } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      metricsPlugin.collectMetrics(req, res, next);
      metricsPlugin.getMetrics(req, res);
    });

    test('should collect default prometheus metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics.map(({ name }) => name).sort()).toEqual([
        'nodejs_active_handles',
        'nodejs_active_handles_total',
        'nodejs_active_requests',
        'nodejs_active_requests_total',
        'nodejs_eventloop_lag_max_seconds',
        'nodejs_eventloop_lag_mean_seconds',
        'nodejs_eventloop_lag_min_seconds',
        'nodejs_eventloop_lag_p50_seconds',
        'nodejs_eventloop_lag_p90_seconds',
        'nodejs_eventloop_lag_p99_seconds',
        'nodejs_eventloop_lag_seconds',
        'nodejs_eventloop_lag_stddev_seconds',
        'nodejs_external_memory_bytes',
        'nodejs_gc_duration_seconds',
        'nodejs_heap_size_total_bytes',
        'nodejs_heap_size_used_bytes',
        'nodejs_heap_space_size_available_bytes',
        'nodejs_heap_space_size_total_bytes',
        'nodejs_heap_space_size_used_bytes',
        'nodejs_version_info',
        'process_cpu_seconds_total',
        'process_cpu_system_seconds_total',
        'process_cpu_user_seconds_total',
        'process_heap_bytes',
        'process_max_fds',
        'process_open_fds',
        'process_resident_memory_bytes',
        'process_start_time_seconds',
        'process_virtual_memory_bytes',
        'registry_requests',
      ]);
    });
  });
});
