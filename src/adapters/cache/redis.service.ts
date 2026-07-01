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

  async incrbyfloat(key: string, increment: number): Promise<string> {
    return this.client.incrbyfloat(key, increment);
  }

  async zincrby(key: string, increment: number, member: string): Promise<void> {
    await this.client.zincrby(key, increment, member);
  }

  async zrevrangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<Array<{ member: string; score: number }>> {
    const rows = await this.client.zrevrange(key, start, stop, 'WITHSCORES');
    const result: Array<{ member: string; score: number }> = [];
    for (let i = 0; i < rows.length; i += 2) {
      const member = rows[i];
      const scoreRaw = rows[i + 1];
      if (member !== undefined && scoreRaw !== undefined) {
        result.push({ member, score: Number(scoreRaw) });
      }
    }
    return result;
  }

  /** For Redis pipelines (e.g. market-stats backfill). */
  getClient(): Redis {
    return this.client;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Exposed for BullMQ connection sharing. */
  get connection(): Redis {
    return this.client;
  }
}
