import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const METRICS_REGISTRY = Symbol('METRICS_REGISTRY');

export function createMetricsRegistry(): Registry {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'airbar_' });
  return registry;
}

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

export function registerAppMetrics(registry: Registry): void {
  registry.registerMetric(httpRequestsTotal);
  registry.registerMetric(httpRequestDuration);
}
