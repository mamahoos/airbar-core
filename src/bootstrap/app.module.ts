import { Module } from '@nestjs/common';

import { CacheModule } from '../adapters/cache/cache.module.js';
import { FinanceGrpcModule } from '../adapters/grpc-client/finance-grpc.module.js';
import { PersistenceModule } from '../adapters/persistence/persistence.module.js';
import { QueueModule } from '../adapters/queue/queue.module.js';
import { HealthModule } from '../adapters/web/health/health.module.js';

import { ConfigModule } from './config/index.js';

@Module({
  imports: [ConfigModule, PersistenceModule, CacheModule, QueueModule, FinanceGrpcModule, HealthModule],
})
export class AppModule {}
