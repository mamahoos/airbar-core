import { Inject, Injectable } from '@nestjs/common';

import { KycLevel } from '../../domain/auth/kyc-level.js';
import { KYC_REPOSITORY, type KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';
import { NotFoundError } from '../../shared/errors/index.js';

import { assertKycMinLevel } from './kyc-gate.js';

import type { KycRequirementOptions } from '../../domain/kyc/kyc-requirement.js';

@Injectable()
export class KycAccessService {
  constructor(@Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort) {}

  async assertRequirement(userId: string, requirement: KycRequirementOptions): Promise<void> {
    const snapshot = await this.kyc.getKycSnapshot(userId);
    if (!snapshot) throw new NotFoundError('User', userId);

    assertKycMinLevel(snapshot.kycLevel as KycLevel, requirement.minLevel, {
      ...requirement,
      nationalIdPresent: snapshot.hasNationalId,
      financialVerified: snapshot.financialVerified,
    });
  }
}
