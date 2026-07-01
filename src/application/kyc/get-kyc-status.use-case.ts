import { Inject, Injectable } from '@nestjs/common';

import { KYC_REPOSITORY, type KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';
import { NotFoundError } from '../../shared/errors/index.js';

@Injectable()
export class GetKycStatusUseCase {
  constructor(@Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort) {}

  async execute(userId: string) {
    const status = await this.kyc.getKycStatus(userId);
    if (!status) throw new NotFoundError('User', userId);
    return status;
  }
}
