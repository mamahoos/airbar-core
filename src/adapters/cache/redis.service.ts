import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface RedisOptions {
  readonly host: string;
  readonly port: number;
}

/**
 * Redis adapter built on `ioredis`. Domain/application code uses the
 * `CachePort` (declared in N1) — this is the concrete implementation.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(options: RedisOptions) {
    this.client = new Redis({
      host: options.host,
      port: options.port,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  }

  async ping(): Promise<void> {
    const reply = await this.client.ping();
    if (reply !== 'PONG') {
      throw new Error(`Redis ping returned: ${String(reply)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Exposed for BullMQ connection sharing. */
  get connection(): Redis {
    return this.client;
  }
}
