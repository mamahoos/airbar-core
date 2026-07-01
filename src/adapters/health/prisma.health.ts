import { Injectable } from '@nestjs/common';

import { PrismaService } from '../persistence/prisma.service.js';

import type { HealthIndicatorPort, HealthIndicatorResult } from '../../domain/health/index.js';

@Injectable()
export class PrismaHealthIndicator implements HealthIndicatorPort {
  readonly name = 'database';

  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.ping();
      return { database: { status: 'up' } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { database: { status: 'down', message } };
    }
  }
}
