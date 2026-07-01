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

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Exposed for BullMQ connection sharing. */
  get connection(): Redis {
    return this.client;
  }
}
