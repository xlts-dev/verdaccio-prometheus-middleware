import { Config } from '@verdaccio/types';

export interface MetricsConfig extends Config {
  metricsPath?: string;
  requestMetrics?: RequestMetrics;
  packageMetrics?: PackageMetrics;
  defaultMetrics?: {
    enabled?: boolean | 'true' | 'false';
  };
}

export interface MetricType {
  enabled?: boolean | 'true' | 'false';
  metricName?: string;
}

export interface RequestMetrics extends MetricType {
  pathExclusions?: string[];
}

export interface PackageMetrics extends MetricType {
  packageGroups?: Record<string, string>;
}

export interface RequestMetricsLabels extends Record<string, string | number> {
  username: string;
  userAgentName: string;
  httpMethod: string;
  statusCode: string | number;
}

export interface PackageMetricsLabels extends Record<string, string | number | undefined> {
  username: string;
  userAgentName: string;
  statusCode: string | number;
  packageGroup?: string;
}
