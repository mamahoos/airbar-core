import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CacheModule } from '../adapters/cache/cache.module.js';
import { FinanceGrpcModule } from '../adapters/grpc-client/finance-grpc.module.js';
import { PersistenceModule } from '../adapters/persistence/persistence.module.js';
import { QueueModule } from '../adapters/queue/queue.module.js';
import { AuthModule } from '../adapters/web/auth/auth.module.js';
import { HealthModule } from '../adapters/web/health/health.module.js';

import { ConfigModule, APP_CONFIG } from './config/index.js';

import type { AppConfig } from './config/index.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        {
          ttl: config.throttleTtl * 1000,
          limit: config.throttleLimit,
        },
      ],
    }),
    PersistenceModule,
    CacheModule,
    QueueModule,
    FinanceGrpcModule,
    HealthModule,
    AuthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
