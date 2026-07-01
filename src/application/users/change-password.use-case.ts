import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../../domain/users/user-profile.repository.port.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { OtpCodeService } from '../auth/otp-code.service.js';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepositoryPort,
    private readonly otpCode: OtpCodeService,
  ) {}

  async execute(userId: string, newPassword: string, currentPassword?: string, otpCode?: string) {
    const auth = await this.profiles.findAuthUserPhone(userId);
    if (!auth) throw new NotFoundError('User', userId);

    if (auth.passwordHash) {
      if (!currentPassword) {
        throw new ValidationError('Current password is required');
      }
      const valid = await bcrypt.compare(currentPassword, auth.passwordHash);
      if (!valid) throw new ValidationError('Current password is incorrect');
    } else {
      if (!otpCode) {
        throw new ValidationError(
          'OTP verification is required to set your first password. Call POST /auth/otp/send first.',
        );
      }
      const ok = await this.otpCode.verify(auth.phone, otpCode);
      if (!ok) throw new ValidationError('Invalid or expired OTP');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.profiles.updatePasswordHash(userId, passwordHash);
    return { message: 'Password updated successfully' };
  }
}
