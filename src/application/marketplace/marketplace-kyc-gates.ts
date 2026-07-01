import { KycLevel } from '../../domain/auth/kyc-level.js';

import type { KycRequirementOptions } from '../../domain/kyc/kyc-requirement.js';

export type MarketplaceKycAction =
  | 'CREATE_SHIPMENT'
  | 'ASSIGN_SHIPMENT'
  | 'ACCEPT_SHIPMENT_SENDER';

const ACTION_REQUIREMENTS: Record<MarketplaceKycAction, KycRequirementOptions> = {
  CREATE_SHIPMENT: { minLevel: KycLevel.IDENTITY_VERIFIED },
  ASSIGN_SHIPMENT: { minLevel: KycLevel.IDENTITY_VERIFIED },
  ACCEPT_SHIPMENT_SENDER: { minLevel: KycLevel.IDENTITY_VERIFIED },
};

export function marketplaceKycRequirement(action: MarketplaceKycAction): KycRequirementOptions {
  return ACTION_REQUIREMENTS[action];
}
