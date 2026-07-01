export interface HealthIndicatorResult {
  readonly [key: string]: {
    readonly status: 'up' | 'down';
    readonly message?: string;
  };
}

/**
 * Health port — implemented by adapters in `adapters/health`. The bootstrap
 * only knows the port; concrete pings (Prisma, Redis) are wired in
 * `HealthModule`.
 */
export interface HealthIndicatorPort {
  readonly name: string;
  ping(): Promise<HealthIndicatorResult>;
}
