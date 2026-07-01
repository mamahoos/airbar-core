import { Inject, Injectable } from '@nestjs/common';

import { KycLevel } from '../../domain/auth/kyc-level.js';
import {
  ACTIVITY_LOG_REPOSITORY,
  type ActivityLogRepositoryPort,
} from '../../domain/auth/ports/activity-log.repository.port.js';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../domain/auth/ports/user.repository.port.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

import { OtpCodeService } from './otp-code.service.js';
import { OtpRateLimiter } from './otp-rate-limiter.js';
import { SessionManager, type DeviceContext } from './session-manager.js';

export interface VerifyOtpInput extends DeviceContext {
  readonly phone: string;
  readonly code: string;
}

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    private readonly otpCode: OtpCodeService,
    private readonly rateLimiter: OtpRateLimiter,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACTIVITY_LOG_REPOSITORY) private readonly activity: ActivityLogRepositoryPort,
    private readonly sessions: SessionManager,
  ) {}

  async execute(input: VerifyOtpInput) {
    const isValid = await this.otpCode.verify(input.phone, input.code);
    if (!isValid) {
      throw new UnauthorizedError('Invalid or expired OTP');
    }

    await this.rateLimiter.resetAfterVerification(input.phone);

    let user = await this.users.findByPhone(input.phone);
    const isNewUser = !user;

    if (!user) {
      user = await this.users.create({
        phone: input.phone,
        kycLevel: KycLevel.MOBILE_VERIFIED,
      });
    }

    if (user.isBanned) {
      throw new UnauthorizedError('Your account has been suspended');
    }

    const tokens = this.sessions.issueTokens(user);
    await this.sessions.createSession(user.id, tokens.refreshToken, input);
    await this.users.updateLastLogin(user.id, input.ipAddress);

    await this.activity.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'user',
      resourceId: user.id,
      details: { method: 'otp', ip: input.ipAddress },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return { ...tokens, isNewUser };
  }
}
