import { describe, it, expect } from '@jest/globals';

import { KycLevel } from '../../domain/auth/kyc-level.js';
import { ForbiddenError } from '../../shared/errors/index.js';

import { assertKycMinLevel } from './kyc-gate.js';

describe('assertKycMinLevel', () => {
  it('allows when level is sufficient', () => {
    expect(() =>
      assertKycMinLevel(KycLevel.IDENTITY_VERIFIED, KycLevel.MOBILE_VERIFIED),
    ).not.toThrow();
  });

  it('rejects when level is too low', () => {
    expect(() => assertKycMinLevel(KycLevel.MOBILE_VERIFIED, KycLevel.IDENTITY_VERIFIED)).toThrow(
      ForbiddenError,
    );
  });

  it('requires national id when configured', () => {
    expect(() =>
      assertKycMinLevel(KycLevel.IDENTITY_VERIFIED, KycLevel.IDENTITY_VERIFIED, {
        requireNationalId: true,
        nationalIdPresent: false,
      }),
    ).toThrow(ForbiddenError);
  });
});
