import { describe, expect, it, jest } from '@jest/globals';
import { CargoType } from '@prisma/client';

import { ValidationError } from '../../shared/errors/index.js';

import {
  CreateAdminPricingRuleUseCase,
  UpdateAdminPricingRuleUseCase,
} from './admin.use-cases.js';

import type { AdminRepositoryPort } from '../../domain/admin/admin.repository.port.js';

describe('admin pricing rule use cases', () => {
  it('rejects unsafe zero-price create requests', async () => {
    const admin = adminRepository();
    const useCase = new CreateAdminPricingRuleUseCase(admin);

    expect(() =>
      useCase.execute({
        name: 'unsafe',
        cargoType: CargoType.DOCUMENTS,
        basePrice: 0,
        pricePerKg: 0,
        minPlatformFee: 0,
      }),
    ).toThrow(ValidationError);
    expect(admin.createPricingRule.mock.calls).toHaveLength(0);
  });

  it('rejects unsafe pricing rule updates before persistence', async () => {
    const admin = adminRepository();
    const useCase = new UpdateAdminPricingRuleUseCase(admin);

    expect(() => useCase.execute('rule-1', { pricePerKg: 0 })).toThrow(ValidationError);
    expect(admin.updatePricingRule.mock.calls).toHaveLength(0);
  });
});

function adminRepository(): jest.Mocked<AdminRepositoryPort> {
  return {
    createPricingRule: jest.fn(),
    updatePricingRule: jest.fn(),
  } as unknown as jest.Mocked<AdminRepositoryPort>;
}
