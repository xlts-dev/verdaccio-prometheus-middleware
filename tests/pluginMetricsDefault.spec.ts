import { register } from 'prom-client';
import { Application } from 'express';
import { IBasicAuth, IStorageManager, PluginOptions } from '@verdaccio/types';

import MetricsPlugin, { DEFAULT_METRICS_PATH } from '../src';
import { MetricsConfig } from '../src/types';

import { getExpressMocks, getLogger } from './testUtils';

describe('Default Metrics', () => {
  describe('should register middleware (default metrics enabled)', () => {
    const logger = getLogger();
    const app = { get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { defaultMetrics: { enabled: true } } as MetricsConfig,
        { logger } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should invoke the correct express API calls', () => {
      const mock = (app.get as jest.MockedFn<jest.MockableFunction>).mock;
      expect(app.get).toHaveBeenCalledTimes(1);
      expect(mock.calls[0][0]).toEqual(DEFAULT_METRICS_PATH);
    });
  });

  describe('should register middleware (default metrics disabled)', () => {
    const logger = getLogger();
    const app = { get: jest.fn() } as unknown as Application;
    const metricsConfig = { defaultMetrics: { enabled: false } } as MetricsConfig;

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

  describe('should collect default prometheus metrics when `defaultMetrics.enabled` is set to `true`', () => {
    const { req, res, next } = getExpressMocks();
    const app = { get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin(
        { defaultMetrics: { enabled: true } } as MetricsConfig,
        { logger: getLogger() } as PluginOptions<MetricsConfig>,
      );
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
      metricsPlugin.collectPackageMetrics(req, res, next);
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
      ]);
    });
  });
});
