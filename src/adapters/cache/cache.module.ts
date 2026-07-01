import { Module, Global, type Provider } from '@nestjs/common';

import { HEALTH_INDICATORS } from '../../application/health/index.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { RedisHealthIndicator } from '../health/redis.health.js';

import { RedisService } from './redis.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

const redisHealthMultiProvider = {
  provide: HEALTH_INDICATORS,
  useExisting: RedisHealthIndicator,
  multi: true,
} as Provider;

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): RedisService => {
        return new RedisService({ host: config.redisHost, port: config.redisPort });
      },
    },
    RedisHealthIndicator,
    redisHealthMultiProvider,
  ],
  exports: [RedisService],
})
export class CacheModule {}
