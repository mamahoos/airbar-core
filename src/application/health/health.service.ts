import { Injectable, Inject } from '@nestjs/common';

import type { HealthIndicatorPort, HealthIndicatorResult } from '../../domain/health/index.js';

export const HEALTH_INDICATORS = Symbol('HEALTH_INDICATORS');

/**
 * Application-layer health aggregator. Aggregates all registered
 * `HealthIndicatorPort` implementations and reports the overall status.
 *
 * Pure orchestration — no I/O of its own. Unit-testable with fake indicators.
 */
@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_INDICATORS) private readonly indicators: readonly HealthIndicatorPort[] = [],
  ) {}

  async check(): Promise<{ status: 'ok' | 'down'; checks: Record<string, unknown> }> {
    const checks: Record<string, unknown> = {};
    let down = false;

    for (const indicator of this.indicators) {
      const result: HealthIndicatorResult = await indicator.ping();
      for (const [key, value] of Object.entries(result)) {
        checks[key] = value;
        if (value.status === 'down') down = true;
      }
    }

    return { status: down ? 'down' : 'ok', checks };
  }

  /** Static helper used by unit tests that don't need the DI container. */
  static fromResults(results: HealthIndicatorResult[]): HealthService {
    const fakes: HealthIndicatorPort[] = results.map((r, i) => ({
      name: `fake-${i}`,
      ping: () => Promise.resolve(r),
    }));
    return new HealthService(fakes);
  }
}
