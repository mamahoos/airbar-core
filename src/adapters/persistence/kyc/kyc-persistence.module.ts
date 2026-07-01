import { Module } from '@nestjs/common';

import { KYC_REPOSITORY } from '../../../domain/kyc/kyc.repository.port.js';

import { PrismaKycRepository } from './prisma-kyc.repository.js';

@Module({
  providers: [{ provide: KYC_REPOSITORY, useClass: PrismaKycRepository }],
  exports: [KYC_REPOSITORY],
})
export class KycPersistenceModule {}
