import { Module } from '@nestjs/common';

import { USER_PROFILE_REPOSITORY } from '../../../domain/users/user-profile.repository.port.js';

import { PrismaUserProfileRepository } from './prisma-user-profile.repository.js';

@Module({
  providers: [{ provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository }],
  exports: [USER_PROFILE_REPOSITORY],
})
export class UsersPersistenceModule {}
