import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { KycLevel } from '../../domain/auth/kyc-level.js';
import {
  ACTIVITY_LOG_REPOSITORY,
  type ActivityLogRepositoryPort,
} from '../../domain/auth/ports/activity-log.repository.port.js';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../domain/auth/ports/user.repository.port.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors/index.js';

import { OtpCodeService } from './otp-code.service.js';
import { SessionManager, type DeviceContext } from './session-manager.js';

export interface RegisterInput extends DeviceContext {
  readonly phone: string;
  readonly otpCode: string;
  readonly email?: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly password?: string | undefined;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly otpCode: OtpCodeService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACTIVITY_LOG_REPOSITORY) private readonly activity: ActivityLogRepositoryPort,
    private readonly sessions: SessionManager,
  ) {}

  async execute(input: RegisterInput) {
    const isOtpValid = await this.otpCode.verify(input.phone, input.otpCode);
    if (!isOtpValid) {
      throw new UnauthorizedError('Invalid or expired OTP');
    }

    const existing = await this.users.findByPhone(input.phone);
    if (existing) {
      throw new ConflictError('User already exists');
    }

    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 12);
    }

    const user = await this.users.create({
      phone: input.phone,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      kycLevel: KycLevel.MOBILE_VERIFIED,
    });

    const tokens = this.sessions.issueTokens(user);
    await this.sessions.createSession(user.id, tokens.refreshToken, input);

    await this.activity.log({
      userId: user.id,
      action: 'REGISTER',
      resource: 'user',
      resourceId: user.id,
      details: { method: 'otp' },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return tokens;
  }
}
