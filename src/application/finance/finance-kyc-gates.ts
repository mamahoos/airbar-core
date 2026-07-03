import { KycLevel } from '../../domain/auth/kyc-level.js';

import type { KycRequirementOptions } from '../../domain/kyc/kyc-requirement.js';

export type FinanceKycAction = 'CREATE_PAYMENT' | 'REQUEST_PAYOUT';

const ACTION_REQUIREMENTS: Record<FinanceKycAction, KycRequirementOptions> = {
  CREATE_PAYMENT: {
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireIranianNationalId: true,
    requireFinancial: true,
    code: 'CREATE_PAYMENT',
  },
  REQUEST_PAYOUT: {
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireIranianNationalId: true,
    requireFinancial: true,
    code: 'REQUEST_PAYOUT',
  },
};

export function financeKycRequirement(action: FinanceKycAction): KycRequirementOptions {
  return ACTION_REQUIREMENTS[action];
}
