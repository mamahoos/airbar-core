import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

/**
 * BullMQ wiring. Shares the same Redis connection as the cache layer. The
 * outbox worker (N6) consumes from this queue. Producers are registered per
 * module via `BullModule.registerQueue({ name: '...' })`.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { host: config.redisHost, port: config.redisPort },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
