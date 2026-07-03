import { Module } from '@nestjs/common';

import { HEALTH_INDICATORS, HealthService } from '../../../application/health/index.js';
import { CacheModule } from '../../cache/cache.module.js';
import { PrismaHealthIndicator } from '../../health/prisma.health.js';
import { RedisHealthIndicator } from '../../health/redis.health.js';
import { PersistenceModule } from '../../persistence/persistence.module.js';

import { HealthController } from './health.controller.js';

@Module({
  imports: [PersistenceModule, CacheModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_INDICATORS,
      inject: [PrismaHealthIndicator, RedisHealthIndicator],
      useFactory: (
        prisma: PrismaHealthIndicator,
        redis: RedisHealthIndicator,
      ) => [prisma, redis],
    },
    HealthService,
  ],
  exports: [HealthService],
})
export class HealthModule {}
