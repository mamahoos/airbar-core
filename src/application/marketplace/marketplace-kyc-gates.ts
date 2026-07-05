import { KycLevel } from '../../domain/auth/kyc-level.js';

import type { KycRequirementOptions } from '../../domain/kyc/kyc-requirement.js';

export type MarketplaceKycAction =
  'CREATE_TRIP' | 'CREATE_SHIPMENT' | 'ASSIGN_SHIPMENT' | 'ACCEPT_SHIPMENT_SENDER';

const ACTION_REQUIREMENTS: Record<MarketplaceKycAction, KycRequirementOptions> = {
  CREATE_TRIP: {
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireIranianNationalId: true,
    code: 'CREATE_TRIP',
  },
  CREATE_SHIPMENT: {
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireIranianNationalId: true,
    code: 'CREATE_SHIPMENT',
  },
  ASSIGN_SHIPMENT: {
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireIranianNationalId: true,
    code: 'ASSIGN_SHIPMENT',
  },
  ACCEPT_SHIPMENT_SENDER: {
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireIranianNationalId: true,
    code: 'ACCEPT_SHIPMENT_SENDER',
  },
};

export function marketplaceKycRequirement(action: MarketplaceKycAction): KycRequirementOptions {
  return ACTION_REQUIREMENTS[action];
}
