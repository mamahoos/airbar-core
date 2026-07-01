import { Module } from '@nestjs/common';

import { ChangePasswordUseCase } from '../../../application/users/change-password.use-case.js';
import { GetProfileUseCase } from '../../../application/users/get-profile.use-case.js';
import { UpdateAvatarUseCase } from '../../../application/users/update-avatar.use-case.js';
import { UpdateProfileUseCase } from '../../../application/users/update-profile.use-case.js';
import {
  GetPublicProfileUseCase,
  ListActivityLogsUseCase,
  RevokeSessionUseCase,
} from '../../../application/users/users-misc.use-case.js';
import { AuthPersistenceModule } from '../../persistence/auth/auth-persistence.module.js';
import { UsersPersistenceModule } from '../../persistence/users/users-persistence.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

import { UsersController } from './users.controller.js';

@Module({
  imports: [
    AuthPersistenceModule,
    UsersPersistenceModule,
    StorageModule,
    AuthModule,
    PaymentsModule,
  ],
  controllers: [UsersController],
  providers: [
    GetProfileUseCase,
    UpdateProfileUseCase,
    UpdateAvatarUseCase,
    ChangePasswordUseCase,
    GetPublicProfileUseCase,
    ListActivityLogsUseCase,
    RevokeSessionUseCase,
  ],
})
export class UsersModule {}
