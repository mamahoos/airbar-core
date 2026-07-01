import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';

import { CacheModule } from '../../src/adapters/cache/cache.module.js';
import { RedisService } from '../../src/adapters/cache/redis.service.js';
import { OtpRateLimiter } from '../../src/application/auth/otp-rate-limiter.js';
import { ConfigModule } from '../../src/bootstrap/config/index.js';
import { ValidationError } from '../../src/shared/errors/index.js';

describe('OTP rate limiting integration', () => {
  let moduleRef: TestingModule;
  let rateLimiter: OtpRateLimiter;
  let redis: RedisService;
  const phone = '09129998877';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, CacheModule],
      providers: [OtpRateLimiter],
    }).compile();
    rateLimiter = moduleRef.get(OtpRateLimiter);
    redis = moduleRef.get(RedisService);
  });

  afterAll(async () => {
    await redis.del(`otp:cooldown:${phone}`, `otp:ratelimit:${phone}`);
    await moduleRef.close();
  });

  it('enforces cooldown after a successful send record', async () => {
    const limits = { maxPerHour: 10, cooldownSeconds: 30 };
    await rateLimiter.recordSuccessfulSend(phone, limits);
    await expect(rateLimiter.assertSendAllowed(phone, limits)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
