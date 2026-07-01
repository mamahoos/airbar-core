import { KycLevel } from '../../domain/auth/kyc-level.js';
import { ForbiddenError } from '../../shared/errors/index.js';

import type { KycRequirementOptions } from '../../domain/kyc/kyc-requirement.js';

const LEVEL_ORDER: readonly KycLevel[] = [
  KycLevel.NONE,
  KycLevel.MOBILE_VERIFIED,
  KycLevel.IDENTITY_VERIFIED,
  KycLevel.DOCUMENT_VERIFIED,
  KycLevel.FACE_VERIFIED,
  KycLevel.FULLY_VERIFIED,
];

function levelIndex(level: KycLevel): number {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx === -1 ? 0 : idx;
}

export function assertKycMinLevel(
  current: KycLevel,
  required: KycLevel,
  options?: KycRequirementOptions & {
    readonly nationalIdPresent?: boolean;
    readonly financialVerified?: boolean;
  },
): void {
  if (levelIndex(current) < levelIndex(required)) {
    throw new ForbiddenError(options?.message ?? 'احراز هویت الزامی است', {
      code: options?.code ?? 'KYC_REQUIRED',
      requiredLevel: required,
      redirect: options?.redirect ?? '/dashboard/kyc',
    });
  }

  if (options?.requireNationalId && !options.nationalIdPresent) {
    throw new ForbiddenError('ابتدا تأیید هویت را تکمیل کنید', {
      code: 'IDENTITY_VERIFICATION_REQUIRED',
      requiredLevel: KycLevel.IDENTITY_VERIFIED,
      redirect: options.redirect ?? '/dashboard/kyc?step=identity',
    });
  }

  if (options?.requireFinancial && !options.financialVerified) {
    throw new ForbiddenError('ابتدا کارت بانکی را تأیید کنید', {
      code: 'FINANCIAL_VERIFICATION_REQUIRED',
      redirect: '/dashboard/kyc?step=bank',
    });
  }
}
