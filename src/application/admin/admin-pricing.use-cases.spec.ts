import { describe, expect, it, jest } from '@jest/globals';
import { CargoType } from '@prisma/client';

import { ValidationError } from '../../shared/errors/index.js';

import {
  CreateAdminPricingRuleUseCase,
  ListAdminTrustEventsUseCase,
  ReviewAdminTrustEventUseCase,
  UpdateAdminPricingRuleUseCase,
} from './admin.use-cases.js';

import type { AdminRepositoryPort } from '../../domain/admin/admin.repository.port.js';

describe('admin pricing rule use cases', () => {
  it('rejects unsafe zero-price create requests', async () => {
    const { admin, createPricingRule } = adminRepository();
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
    expect(createPricingRule).not.toHaveBeenCalled();
  });

  it('rejects unsafe pricing rule updates before persistence', async () => {
    const { admin, updatePricingRule } = adminRepository();
    const useCase = new UpdateAdminPricingRuleUseCase(admin);

    expect(() => useCase.execute('rule-1', { pricePerKg: 0 })).toThrow(ValidationError);
    expect(updatePricingRule).not.toHaveBeenCalled();
  });
});

describe('admin trust event use cases', () => {
  it('normalizes review status filters before listing trust events', async () => {
    const { admin, listTrustEvents } = adminRepository();
    listTrustEvents.mockResolvedValue({ data: [{ id: 'event-1' }], total: 1 });
    const useCase = new ListAdminTrustEventsUseCase(admin);

    await expect(
      useCase.execute({ reviewStatus: 'pending', page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      data: [{ id: 'event-1' }],
      pagination: { totalItems: 1, page: 1, limit: 10 },
    });
    expect(listTrustEvents).toHaveBeenCalledWith({
      reviewStatus: 'PENDING',
      page: 1,
      limit: 10,
    });
  });

  it('rejects invalid trust event review filters and decisions', async () => {
    const { admin, listTrustEvents, reviewTrustEvent } = adminRepository();
    const listUseCase = new ListAdminTrustEventsUseCase(admin);
    const reviewUseCase = new ReviewAdminTrustEventUseCase(admin);

    await expect(listUseCase.execute({ reviewStatus: 'OPEN' })).rejects.toThrow(
      'Invalid trust event review status',
    );
    await expect(reviewUseCase.execute('event-1', 'admin-1', 'PENDING')).rejects.toThrow(
      'Invalid trust event review decision',
    );
    expect(listTrustEvents).not.toHaveBeenCalled();
    expect(reviewTrustEvent).not.toHaveBeenCalled();
  });

  it('reviews trust events with normalized decision and trimmed note', async () => {
    const { admin, reviewTrustEvent } = adminRepository();
    reviewTrustEvent.mockResolvedValue({ id: 'event-1', reviewStatus: 'RESOLVED' });
    const useCase = new ReviewAdminTrustEventUseCase(admin);

    await expect(useCase.execute('event-1', 'admin-1', ' resolved ', ' handled ')).resolves.toEqual(
      {
        id: 'event-1',
        reviewStatus: 'RESOLVED',
      },
    );
    expect(reviewTrustEvent).toHaveBeenCalledWith('event-1', 'admin-1', 'RESOLVED', 'handled');
  });
});

function adminRepository() {
  const createPricingRule = jest.fn();
  const updatePricingRule = jest.fn();
  const listTrustEvents = jest.fn();
  const reviewTrustEvent = jest.fn();
  const admin = {
    createPricingRule,
    updatePricingRule,
    listTrustEvents,
    reviewTrustEvent,
  } as unknown as AdminRepositoryPort;

  return { admin, createPricingRule, updatePricingRule, listTrustEvents, reviewTrustEvent };
}
