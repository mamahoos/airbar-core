import { Injectable } from '@nestjs/common';

import { RedisService } from '../cache/redis.service.js';

import type { HealthIndicatorPort, HealthIndicatorResult } from '../../domain/health/index.js';

@Injectable()
export class RedisHealthIndicator implements HealthIndicatorPort {
  readonly name = 'redis';

  constructor(private readonly redis: RedisService) {}

  async ping(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return { redis: { status: 'up' } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { redis: { status: 'down', message } };
    }
  }
}
