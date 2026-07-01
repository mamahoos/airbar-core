import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/bootstrap/app.module.js';
import { OtpRateLimiter } from '../../src/application/auth/otp-rate-limiter.js';
import { RedisService } from '../../src/adapters/cache/redis.service.js';
import { ValidationError } from '../../src/shared/errors/index.js';

describe('OTP rate limiting integration', () => {
  let rateLimiter: OtpRateLimiter;
  let redis: RedisService;
  const phone = '09129998877';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .compile();
    rateLimiter = moduleRef.get(OtpRateLimiter);
    redis = moduleRef.get(RedisService);
  });

  afterAll(async () => {
    await redis.del(`otp:cooldown:${phone}`, `otp:ratelimit:${phone}`);
  });

  it('enforces cooldown after a successful send record', async () => {
    const limits = { maxPerHour: 10, cooldownSeconds: 30 };
    await rateLimiter.recordSuccessfulSend(phone, limits);
    await expect(rateLimiter.assertSendAllowed(phone, limits)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
