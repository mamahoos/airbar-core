import type { KycLevel } from '../auth/kyc-level.js';

export interface KycRequirementOptions {
  readonly minLevel: KycLevel;
  readonly requireNationalId?: boolean | undefined;
  readonly requireFinancial?: boolean | undefined;
  readonly code?: string | undefined;
  readonly redirect?: string | undefined;
  readonly message?: string | undefined;
}

export const KYC_REQUIREMENT_KEY = 'kyc_requirement';
