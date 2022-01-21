import { collectDefaultMetrics, register, Counter } from 'prom-client';
import { PackageMetricsLabels, RequestMetricsLabels } from './types';

interface MetricOptions {
  defaultMetricsEnabled: boolean;
  requestMetricsEnabled: boolean;
  requestMetricsName?: string;
  packageMetricsEnabled: boolean;
  packageMetricsName?: string;
}

export const DEFAULT_METRIC_NAME_REQUESTS = 'registry_http_requests';
export const DEFAULT_METRIC_NAME_PACKAGE_DOWNLOADS = 'registry_package_downloads';
export const CONTENT_TYPE_METRICS = register.contentType;

// Remember that every unique combination of key-value label pairs represents a new time series, which can
// dramatically increase the amount of data stored. Refer to: https://prometheus.io/docs/practices/naming/#labels
export class Metrics {
  private readonly requestCounter: Counter<string> | null = null;
  private readonly packageCounter: Counter<string> | null = null;

  constructor({
    defaultMetricsEnabled,
    requestMetricsEnabled,
    requestMetricsName,
    packageMetricsEnabled,
    packageMetricsName,
  }: MetricOptions) {
    defaultMetricsEnabled && collectDefaultMetrics();
    if (requestMetricsEnabled) {
      this.requestCounter = new Counter<string>({
        name: requestMetricsName || DEFAULT_METRIC_NAME_REQUESTS,
        help: 'Count of HTTP requests made to the registry',
        labelNames: ['username', 'userAgentName', 'statusCode', 'httpMethod'] as const,
      });
    }
    if (packageMetricsEnabled) {
      this.packageCounter = new Counter<string>({
        name: packageMetricsName || DEFAULT_METRIC_NAME_PACKAGE_DOWNLOADS,
        help: 'Count of package downloads from the registry',
        labelNames: ['username', 'userAgentName', 'statusCode', 'packageGroup'] as const,
      });
    }
  }

  incrementRequestCounter(labels: RequestMetricsLabels) {
    this.requestCounter && this.requestCounter.labels(labels).inc(1);
  }

  incrementPackageDownloadCounter(labels: PackageMetricsLabels) {
    this.packageCounter && this.packageCounter.labels(labels).inc(1);
  }

  /**
   * Get the metrics response body.
   * @return {Promise<string>} - The metrics response body.
   */
  getMetricsResponse() {
    return register.metrics();
  }
}
