import { Injectable } from '@nestjs/common';

import { RedisService } from '../../adapters/cache/redis.service.js';
import { ValidationError } from '../../shared/errors/index.js';

export interface OtpRateLimitSettings {
  readonly maxPerHour: number;
  readonly cooldownSeconds: number;
}

@Injectable()
export class OtpRateLimiter {
  constructor(private readonly redis: RedisService) {}

  async assertSendAllowed(phone: string, limits: OtpRateLimitSettings): Promise<void> {
    const cooldownKey = `otp:cooldown:${phone}`;
    if (await this.redis.exists(cooldownKey)) {
      const retryAfter = await this.redis.ttl(cooldownKey);
      throw new ValidationError(
        retryAfter > 0
          ? `لطفاً ${retryAfter} ثانیه دیگر دوباره درخواست کد دهید`
          : 'لطفاً کمی بعد دوباره درخواست کد دهید',
      );
    }

    const rateLimitKey = `otp:ratelimit:${phone}`;
    const attemptsRaw = await this.redis.get(rateLimitKey);
    const attempts = attemptsRaw ? Number.parseInt(attemptsRaw, 10) : 0;

    if (attempts >= limits.maxPerHour) {
      const retryAfter = await this.redis.ttl(rateLimitKey);
      throw new ValidationError(
        retryAfter > 0
          ? `تعداد درخواست‌های کد بیش از حد مجاز است. ${retryAfter} ثانیه دیگر تلاش کنید`
          : 'تعداد درخواست‌های کد بیش از حد مجاز است. لطفاً بعداً تلاش کنید',
      );
    }
  }

  async recordSuccessfulSend(phone: string, limits: OtpRateLimitSettings): Promise<void> {
    const rateLimitKey = `otp:ratelimit:${phone}`;
    const attempts = await this.redis.incr(rateLimitKey);
    if (attempts === 1) {
      await this.redis.expire(rateLimitKey, 3600);
    }
    await this.redis.set(`otp:cooldown:${phone}`, '1', limits.cooldownSeconds);
  }

  async resetAfterVerification(phone: string): Promise<void> {
    await this.redis.del(`otp:ratelimit:${phone}`, `otp:cooldown:${phone}`);
  }
}
