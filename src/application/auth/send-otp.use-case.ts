import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';

import { OtpCodeService } from './otp-code.service.js';
import { OtpRateLimiter } from './otp-rate-limiter.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

@Injectable()
export class SendOtpUseCase {
  constructor(
    private readonly otpCode: OtpCodeService,
    private readonly rateLimiter: OtpRateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async execute(phone: string): Promise<{ message: string; expiresIn: number }> {
    const limits = {
      maxPerHour: this.config.otpMaxPerHour,
      cooldownSeconds: this.config.otpCooldownSeconds,
    };
    await this.rateLimiter.assertSendAllowed(phone, limits);
    const { expiresIn } = await this.otpCode.generateAndSend(phone);
    await this.rateLimiter.recordSuccessfulSend(phone, limits);
    return { message: 'OTP sent successfully', expiresIn };
  }
}
