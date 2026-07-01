import { Module } from '@nestjs/common';

import { GetKycStatusUseCase } from '../../../application/kyc/get-kyc-status.use-case.js';
import { KycAccessService } from '../../../application/kyc/kyc-access.service.js';
import {
  DeleteBankAccountUseCase,
  LookupPostalCodeUseCase,
  ReviewKycDocumentUseCase,
  UploadKycDocumentUseCase,
  VerifyBankCardUseCase,
} from '../../../application/kyc/kyc-misc.use-case.js';
import { VerifyIdentityUseCase } from '../../../application/kyc/verify-identity.use-case.js';
import { ApiIrModule } from '../../integrations/api-ir/api-ir.module.js';
import { KycPersistenceModule } from '../../persistence/kyc/kyc-persistence.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { KycLevelGuard } from './guards/kyc-level.guard.js';
import { KycController } from './kyc.controller.js';

@Module({
  imports: [KycPersistenceModule, ApiIrModule, StorageModule, AuthModule],
  controllers: [KycController],
  providers: [
    KycAccessService,
    KycLevelGuard,
    GetKycStatusUseCase,
    VerifyIdentityUseCase,
    VerifyBankCardUseCase,
    DeleteBankAccountUseCase,
    LookupPostalCodeUseCase,
    UploadKycDocumentUseCase,
    ReviewKycDocumentUseCase,
  ],
  exports: [KycAccessService, KycLevelGuard],
})
export class KycModule {}
