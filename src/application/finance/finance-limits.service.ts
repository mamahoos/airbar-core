import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { KycLevel } from '../../domain/auth/kyc-level.js';
import { KYC_REPOSITORY, type KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/index.js';
import { isIranianPhone } from '../../shared/phone/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

export type FinanceLimitAction = 'CREATE_PAYMENT' | 'REQUEST_PAYOUT';

const LEVEL_ORDER: readonly KycLevel[] = [
  KycLevel.NONE,
  KycLevel.MOBILE_VERIFIED,
  KycLevel.IDENTITY_VERIFIED,
  KycLevel.DOCUMENT_VERIFIED,
  KycLevel.FACE_VERIFIED,
  KycLevel.FULLY_VERIFIED,
];

function levelAtLeast(current: string, required: KycLevel): boolean {
  return LEVEL_ORDER.indexOf(current as KycLevel) >= LEVEL_ORDER.indexOf(required);
}

@Injectable()
export class FinanceLimitsService {
  constructor(
    @Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async assertAllowed(
    userId: string,
    action: FinanceLimitAction,
    amountRials: number,
  ): Promise<void> {
    const snapshot = await this.kyc.getKycSnapshot(userId);
    if (!snapshot) throw new NotFoundError('User', userId);

    const limits = this.limitsFor(action);
    const hasDocumentTrust =
      levelAtLeast(snapshot.kycLevel, KycLevel.DOCUMENT_VERIFIED) &&
      (!isIranianPhone(snapshot.phone) || snapshot.hasApprovedNationalIdDocument);

    if (!hasDocumentTrust && amountRials > limits.identity) {
      throw new ForbiddenError('برای مبلغ بالا تأیید دستی کارت ملی الزامی است', {
        code: 'HIGH_VALUE_DOCUMENT_REQUIRED',
        requiredLevel: KycLevel.DOCUMENT_VERIFIED,
        limitRials: limits.identity,
        redirect: '/dashboard/kyc?step=document',
      });
    }

    const limit = levelAtLeast(snapshot.kycLevel, KycLevel.FACE_VERIFIED)
      ? limits.full
      : hasDocumentTrust
        ? limits.document
        : limits.identity;

    if (amountRials > limit) {
      throw new ForbiddenError('مبلغ از سقف مجاز سطح احراز هویت شما بیشتر است', {
        code: 'FINANCE_LIMIT_EXCEEDED',
        limitRials: limit,
        action,
        redirect: '/dashboard/kyc',
      });
    }
  }

  private limitsFor(action: FinanceLimitAction): {
    identity: number;
    document: number;
    full: number;
  } {
    if (action === 'REQUEST_PAYOUT') {
      return {
        identity: this.config.financePayoutIdentityLimitRials,
        document: this.config.financePayoutDocumentLimitRials,
        full: this.config.financePayoutFullLimitRials,
      };
    }
    return {
      identity: this.config.financePaymentIdentityLimitRials,
      document: this.config.financePaymentDocumentLimitRials,
      full: this.config.financePaymentFullLimitRials,
    };
  }
}
