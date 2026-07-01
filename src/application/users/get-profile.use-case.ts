import { Inject, Injectable } from '@nestjs/common';

import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../../domain/users/user-profile.repository.port.js';
import { NotFoundError } from '../../shared/errors/index.js';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepositoryPort,
  ) {}

  async execute(userId: string) {
    const profile = await this.profiles.getProfile(userId);
    if (!profile) throw new NotFoundError('User', userId);
    return profile;
  }
}
