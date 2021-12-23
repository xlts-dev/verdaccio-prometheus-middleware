import { Config } from '@verdaccio/types';

export interface MetricsConfig extends Config {
  metricsEnabled: boolean;
  metricsPath: string;
  packageGroups: Record<string, string>;
}

export interface MetricsLabels {
  username: string;
  userAgentName: string;
  statusCode: string | number;
  packageGroup?: string;
}
