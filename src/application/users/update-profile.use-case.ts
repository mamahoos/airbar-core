import { Inject, Injectable } from '@nestjs/common';

import {
  USER_PROFILE_REPOSITORY,
  type UpdateProfileInput,
  type UserProfileRepositoryPort,
} from '../../domain/users/user-profile.repository.port.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepositoryPort,
  ) {}

  async execute(userId: string, input: UpdateProfileInput) {
    const existing = await this.profiles.getProfile(userId);
    if (!existing) throw new NotFoundError('User', userId);
    if (
      existing.nationalIdLocked &&
      (input.firstName !== undefined || input.lastName !== undefined)
    ) {
      throw new ValidationError('نام رسمی پس از تأیید هویت قابل تغییر نیست');
    }
    return this.profiles.updateProfile(userId, input);
  }
}
