import chanceJs from 'chance';
import { register } from 'prom-client';
import { Application } from 'express';
import { IBasicAuth, IStorageManager } from '@verdaccio/types';

import MetricsPlugin, { API_PATH_PREFIX, REQUEST_COUNTER_OPTIONS } from '../src';
import { MetricsConfig } from '../types';

import { getExpressMocks, getRequestOptions, getLogger } from './testUtils';

const chance = chanceJs();

const EMPTY_METRICS_JSON = [
  {
    aggregator: 'sum',
    help: REQUEST_COUNTER_OPTIONS.help,
    name: REQUEST_COUNTER_OPTIONS.name,
    type: 'counter',
    values: [],
  },
];

describe('Metrics Plugin', () => {
  describe('should register middleware (metrics disabled)', () => {
    const logger = getLogger();
    const app = { use: jest.fn(), get: jest.fn() } as unknown as Application;

    beforeAll(() => {
      register.clear();
      const metricsPlugin = new MetricsPlugin({ enabled: false } as MetricsConfig, { logger });
      metricsPlugin.register_middlewares(app, {} as IBasicAuth<MetricsConfig>, {} as IStorageManager<MetricsConfig>);
    });

    test('should not invoke any express API', () => {
      expect(app.use).toHaveBeenCalledTimes(0);
      expect(app.get).toHaveBeenCalledTimes(0);
    });

    test('should log warn that metrics are disabled', () => {
      expect(logger.warn).toHaveBeenCalledWith('metrics: [register_middlewares] metrics are disabled');
    });
  });

  describe('should not collect metrics when disabled', () => {
    const logger = getLogger();
    const { req, res, next } = getExpressMocks();

    beforeAll(() => {
      register.clear();
      new MetricsPlugin({ enabled: false } as MetricsConfig, { logger }).collectMetrics(req, res, next);
    });

    test('should pass the request on to the next middleware function', () => {
      expect(logger.debug).toHaveBeenCalledTimes(0);
      expect(res.once).toHaveBeenCalledTimes(0);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should not collect any metrics', async () => {
      expect(await register.getMetricsAsJSON()).toEqual(EMPTY_METRICS_JSON);
    });
  });

  describe('should not collect metrics for http methods other then GET', () => {
    const logger = getLogger();
    const httpMethod = 'POST';
    const requestOptions = getRequestOptions({ httpMethod });
    const { req, res, next } = getExpressMocks(requestOptions);

    beforeAll(() => {
      register.clear();
      new MetricsPlugin({ enabled: true } as MetricsConfig, { logger }).collectMetrics(req, res, next);
    });

    test('should pass the request on to the next middleware function', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        { path: requestOptions.path, method: httpMethod },
        `metrics: [collectMetrics] request is not a 'GET' request: ${httpMethod} '${requestOptions.path}'`
      );
      expect(res.once).toHaveBeenCalledTimes(0);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should not collect any metrics', async () => {
      expect(await register.getMetricsAsJSON()).toEqual(EMPTY_METRICS_JSON);
    });
  });

  describe('should not collect metrics for the metrics path', () => {
    const logger = getLogger();
    const metricsPath = `/${chance.word()}`;
    const { req, res, next } = getExpressMocks(getRequestOptions({ path: metricsPath }));

    beforeAll(() => {
      register.clear();
      new MetricsPlugin({ enabled: true, metricsPath } as MetricsConfig, { logger }).collectMetrics(req, res, next);
    });

    test('should pass the request on to the next middleware function', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        { path: metricsPath },
        `metrics: [collectMetrics] request is for an excluded API path: '${metricsPath}'`
      );
      expect(res.once).toHaveBeenCalledTimes(0);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should not collect any metrics', async () => {
      expect(await register.getMetricsAsJSON()).toEqual(EMPTY_METRICS_JSON);
    });
  });

  describe(`should not collect metrics for restricted '${API_PATH_PREFIX}' API paths`, () => {
    const logger = getLogger();
    const metricsPath = `${API_PATH_PREFIX}${chance.word()}`;
    const { req, res, next } = getExpressMocks(getRequestOptions({ path: metricsPath }));

    beforeAll(() => {
      register.clear();
      new MetricsPlugin({ enabled: true, metricsPath } as MetricsConfig, { logger }).collectMetrics(req, res, next);
    });

    test('should pass the request on to the next middleware function', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        { path: metricsPath },
        `metrics: [collectMetrics] request is for an excluded API path: '${metricsPath}'`
      );
      expect(res.once).toHaveBeenCalledTimes(0);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should not collect any metrics', async () => {
      expect(await register.getMetricsAsJSON()).toEqual(EMPTY_METRICS_JSON);
    });
  });
});
