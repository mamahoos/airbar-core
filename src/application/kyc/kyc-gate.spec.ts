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

  it('requires complete Iranian identity when configured for Iranian users', () => {
    expect(() =>
      assertKycMinLevel(KycLevel.IDENTITY_VERIFIED, KycLevel.IDENTITY_VERIFIED, {
        phone: '09123456789',
        requireIranianNationalId: true,
        nationalIdPresent: true,
        identityPersonInfoVerified: false,
      }),
    ).toThrow(ForbiddenError);
  });

  it('does not apply Iranian national id policy to non-Iranian users', () => {
    expect(() =>
      assertKycMinLevel(KycLevel.IDENTITY_VERIFIED, KycLevel.IDENTITY_VERIFIED, {
        phone: '+4915112345678',
        requireIranianNationalId: true,
        nationalIdPresent: false,
        identityPersonInfoVerified: false,
      }),
    ).not.toThrow();
  });

  it('requires approved national id document when configured for Iranian users', () => {
    expect(() =>
      assertKycMinLevel(KycLevel.DOCUMENT_VERIFIED, KycLevel.IDENTITY_VERIFIED, {
        phone: '09123456789',
        requireIranianNationalIdDocument: true,
        approvedNationalIdDocumentPresent: false,
      }),
    ).toThrow(ForbiddenError);
  });
});
