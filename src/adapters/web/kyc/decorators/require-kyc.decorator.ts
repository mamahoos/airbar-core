import { SetMetadata } from '@nestjs/common';

import {
  KYC_REQUIREMENT_KEY,
  type KycRequirementOptions,
} from '../../../../domain/kyc/kyc-requirement.js';

export { KYC_REQUIREMENT_KEY };

export const RequireKyc = (options: KycRequirementOptions) =>
  SetMetadata(KYC_REQUIREMENT_KEY, options);
