import { Config } from '@verdaccio/types';

export interface MetricsConfig extends Config {
  metricsEnabled: boolean;
  collectDefaultMetrics: boolean;
  metricsPath: string;
  packageGroups: Record<string, string>;
}

export interface MetricsLabels {
  username: string;
  userAgentName: string;
  statusCode: string | number;
  packageGroup?: string;
}
