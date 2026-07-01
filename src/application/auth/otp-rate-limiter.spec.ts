import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { ValidationError } from '../../shared/errors/index.js';

import { OtpRateLimiter } from './otp-rate-limiter.js';

function createRedisMock() {
  return {
    exists: jest.fn<() => Promise<boolean>>(),
    ttl: jest.fn<() => Promise<number>>(),
    get: jest.fn<() => Promise<string | null>>(),
    incr: jest.fn<() => Promise<number>>(),
    expire: jest.fn<() => Promise<void>>(),
    set: jest.fn<() => Promise<void>>(),
    del: jest.fn<() => Promise<void>>(),
  };
}

describe('OtpRateLimiter', () => {
  const limits = { maxPerHour: 3, cooldownSeconds: 60 };
  let redis: ReturnType<typeof createRedisMock>;
  let limiter: OtpRateLimiter;

  beforeEach(() => {
    redis = createRedisMock();
    limiter = new OtpRateLimiter(redis as never);
  });

  it('rejects when cooldown key exists', async () => {
    redis.exists.mockResolvedValue(true);
    redis.ttl.mockResolvedValue(42);
    await expect(limiter.assertSendAllowed('09123456789', limits)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects when hourly limit exceeded', async () => {
    redis.exists.mockResolvedValue(false);
    redis.get.mockResolvedValue('3');
    redis.ttl.mockResolvedValue(120);
    await expect(limiter.assertSendAllowed('09123456789', limits)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('records send with incr and cooldown', async () => {
    redis.incr.mockResolvedValue(1);
    await limiter.recordSuccessfulSend('09123456789', limits);
    expect(redis.incr).toHaveBeenCalledWith('otp:ratelimit:09123456789');
    expect(redis.expire).toHaveBeenCalledWith('otp:ratelimit:09123456789', 3600);
    expect(redis.set).toHaveBeenCalledWith('otp:cooldown:09123456789', '1', 60);
  });
});
