import { Inject, Injectable } from '@nestjs/common';

import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../../domain/storage/object-storage.port.js';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../../domain/users/user-profile.repository.port.js';
import { NotFoundError } from '../../shared/errors/index.js';

@Injectable()
export class UpdateAvatarUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async execute(userId: string, file: Buffer, originalName: string) {
    const existing = await this.profiles.getProfile(userId);
    if (!existing) throw new NotFoundError('User', userId);

    const objectName = await this.storage.upload(file, originalName, 'avatars', true);
    const avatarUrl = this.storage.getPublicUrl(objectName);
    return this.profiles.updateAvatarUrl(userId, avatarUrl);
  }
}
