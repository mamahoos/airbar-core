import { Module, Global } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { RedisHealthIndicator } from '../health/redis.health.js';

import { RedisService } from './redis.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

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
  ],
  exports: [RedisService, RedisHealthIndicator],
})
export class CacheModule {}
