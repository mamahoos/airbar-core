import { describe, expect, it, jest } from '@jest/globals';

import { KycLevel } from '../../domain/auth/kyc-level.js';

import { FinanceLimitsService } from './finance-limits.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { KycRepositoryPort, KycSnapshot } from '../../domain/kyc/kyc.repository.port.js';

const config = {
  financePaymentIdentityLimitRials: 50_000_000,
  financePaymentDocumentLimitRials: 250_000_000,
  financePaymentFullLimitRials: 1_000_000_000,
  financePayoutIdentityLimitRials: 20_000_000,
  financePayoutDocumentLimitRials: 150_000_000,
  financePayoutFullLimitRials: 500_000_000,
} as AppConfig;

function snapshot(input: Partial<KycSnapshot> = {}): KycSnapshot {
  return {
    phone: '+989121234567',
    kycLevel: KycLevel.IDENTITY_VERIFIED,
    hasNationalId: true,
    hasApprovedNationalIdDocument: false,
    identityPersonInfoVerified: true,
    financialVerified: true,
    ...input,
  };
}

function service(userSnapshot: KycSnapshot | null) {
  const kyc = {
    getKycSnapshot: jest.fn<() => Promise<KycSnapshot | null>>().mockResolvedValue(userSnapshot),
  } as unknown as KycRepositoryPort;
  return new FinanceLimitsService(kyc, config);
}

describe('FinanceLimitsService', () => {
  it('allows identity-level payments up to the configured identity limit', async () => {
    await expect(
      service(snapshot()).assertAllowed('user-1', 'CREATE_PAYMENT', 50_000_000),
    ).resolves.toBeUndefined();
  });

  it('requires approved national id document for high-value Iranian payments', async () => {
    await expect(
      service(snapshot()).assertAllowed('user-1', 'CREATE_PAYMENT', 50_000_001),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'HIGH_VALUE_DOCUMENT_REQUIRED' }),
    });
  });

  it('applies document-level payment limits after manual document approval', async () => {
    const checked = service(
      snapshot({
        kycLevel: KycLevel.DOCUMENT_VERIFIED,
        hasApprovedNationalIdDocument: true,
      }),
    );

    await expect(
      checked.assertAllowed('user-1', 'CREATE_PAYMENT', 250_000_000),
    ).resolves.toBeUndefined();
    await expect(
      checked.assertAllowed('user-1', 'CREATE_PAYMENT', 250_000_001),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'FINANCE_LIMIT_EXCEEDED' }),
    });
  });

  it('uses stricter payout limits than payment limits', async () => {
    await expect(
      service(snapshot()).assertAllowed('user-1', 'REQUEST_PAYOUT', 20_000_001),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'HIGH_VALUE_DOCUMENT_REQUIRED' }),
    });
  });
});
