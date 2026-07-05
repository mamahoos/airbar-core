import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { ValidationError } from '../../shared/errors/index.js';

import { VerifyIdentityUseCase } from './verify-identity.use-case.js';

import type { ApiIrPort } from '../../domain/kyc/api-ir.port.js';
import type { KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';

describe('VerifyIdentityUseCase', () => {
  let kyc: jest.Mocked<KycRepositoryPort>;
  let apiIr: jest.Mocked<ApiIrPort>;
  let useCase: VerifyIdentityUseCase;

  beforeEach(() => {
    kyc = {
      getUserPhone: jest.fn(),
      getKycSnapshot: jest.fn(),
      findIdentityByUserId: jest.fn(),
      findIdentityByNationalIdHash: jest.fn(),
      upsertIdentity: jest.fn(),
      getKycStatus: jest.fn(),
      upsertBankAccount: jest.fn(),
      setFinancialVerified: jest.fn(),
      deactivateBankAccount: jest.fn(),
      saveAddress: jest.fn(),
      upsertKycDocument: jest.fn(),
      reviewDocument: jest.fn(),
      decryptNationalId: jest.fn(),
      encryptNationalId: jest.fn(),
      encryptCard: jest.fn(),
      encryptIban: jest.fn(),
      upgradeKycLevelIfNeeded: jest.fn(),
    };
    apiIr = {
      shahkar: jest.fn(),
      personInfo: jest.fn(),
      cardMatch: jest.fn(),
      cardToIban: jest.fn(),
      postalCodeInfo: jest.fn(),
      postalCodeLocation: jest.fn(),
    };
    useCase = new VerifyIdentityUseCase(kyc, apiIr);
  });

  it('rejects invalid national id', async () => {
    await expect(useCase.execute('u1', '09120000000', '123', '1370/01/01')).rejects.toThrow(
      ValidationError,
    );
  });

  it('verifies identity when shahkar and person info succeed', async () => {
    kyc.findIdentityByNationalIdHash.mockResolvedValue(null);
    kyc.findIdentityByUserId.mockResolvedValue(null);
    kyc.encryptNationalId.mockReturnValue({ hash: 'h1', ciphertext: 'c1' });
    apiIr.shahkar.mockResolvedValue({ isMatch: true });
    apiIr.personInfo.mockResolvedValue({
      firstName: 'علی',
      lastName: 'احمدی',
      birthDate: '1370/01/01',
    });
    kyc.upsertIdentity.mockResolvedValue();

    const result = await useCase.execute('u1', '09120000000', '1234567890', '1370/01/01');

    expect(result.verified).toBe(true);
    expect(kyc.upsertIdentity.mock.calls).toHaveLength(1);
  });

  it('rejects Shahkar verification for non-Iranian phones', async () => {
    await expect(
      useCase.execute('u1', '+4915112345678', '1234567890', '1370/01/01'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects when official first or last name is missing', async () => {
    kyc.findIdentityByNationalIdHash.mockResolvedValue(null);
    kyc.findIdentityByUserId.mockResolvedValue(null);
    kyc.encryptNationalId.mockReturnValue({ hash: 'h1', ciphertext: 'c1' });
    apiIr.shahkar.mockResolvedValue({ isMatch: true });
    apiIr.personInfo.mockResolvedValue({
      firstName: 'علی',
      birthDate: '1370/01/01',
    });

    await expect(useCase.execute('u1', '09120000000', '1234567890', '1370/01/01')).rejects.toThrow(
      ValidationError,
    );
  });
});
