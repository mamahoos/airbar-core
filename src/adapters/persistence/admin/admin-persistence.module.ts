import { Module } from '@nestjs/common';

import { ADMIN_REPOSITORY } from '../../../domain/admin/admin.repository.port.js';

import { PrismaAdminRepository } from './prisma-admin.repository.js';

@Module({
  providers: [{ provide: ADMIN_REPOSITORY, useClass: PrismaAdminRepository }],
  exports: [ADMIN_REPOSITORY],
})
export class AdminPersistenceModule {}
