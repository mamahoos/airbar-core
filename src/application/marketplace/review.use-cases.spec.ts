import { describe, expect, it, jest } from '@jest/globals';

import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../shared/errors/index.js';

import {
  ListShipmentReviewsUseCase,
  ListUserReviewsUseCase,
  SubmitReviewUseCase,
} from './review.use-cases.js';

const confirmedShipment = {
  id: 'ship-1',
  senderId: 'sender-1',
  carrierId: 'carrier-1',
  status: ShipmentStatus.CONFIRMED,
};

function makeReviewRepo(overrides: Record<string, unknown> = {}) {
  return {
    findByShipmentAndAuthor: jest.fn(async () => null),
    createAndRecomputeRating: jest.fn(async () => ({
      review: {
        id: 'rev-1',
        shipmentId: 'ship-1',
        authorId: 'sender-1',
        targetId: 'carrier-1',
        rating: 5,
        comment: 'great',
        communication: null,
        punctuality: null,
        packaging: null,
        overall: null,
        isVisible: true,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      aggregate: { average: 4.5, count: 2 },
    })),
    listByTarget: jest.fn(async () => ({ data: [], total: 0, aggregate: { average: 0, count: 0 } })),
    listByShipment: jest.fn(async () => []),
    ...overrides,
  };
}

function makeShipmentRepo(shipment: unknown) {
  return { findById: jest.fn(async () => shipment) };
}

function notificationsMock() {
  return { notifyReviewReceived: jest.fn(async () => undefined) };
}

describe('SubmitReviewUseCase', () => {
  it('creates a review for the counterpart and returns aggregate rating', async () => {
    const reviews = makeReviewRepo();
    const shipments = makeShipmentRepo(confirmedShipment);
    const notifications = notificationsMock();
    const useCase = new SubmitReviewUseCase(reviews, shipments as never, notifications as never);

    const result = await useCase.execute('sender-1', 'ship-1', { rating: 5, comment: 'great' });

    expect(result.targetRating).toEqual({ average: 4.5, count: 2 });
    expect(reviews.createAndRecomputeRating).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-1',
        authorId: 'sender-1',
        targetId: 'carrier-1',
        rating: 5,
        comment: 'great',
      }),
    );
    expect(notifications.notifyReviewReceived).toHaveBeenCalledWith('carrier-1', 'ship-1', 5);
  });

  it('lets the carrier review the sender', async () => {
    const reviews = makeReviewRepo();
    const useCase = new SubmitReviewUseCase(
      reviews,
      makeShipmentRepo(confirmedShipment) as never,
      notificationsMock() as never,
    );

    await useCase.execute('carrier-1', 'ship-1', { rating: 4 });

    expect(reviews.createAndRecomputeRating).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'carrier-1', targetId: 'sender-1' }),
    );
  });

  it('rejects reviews before the shipment is confirmed', async () => {
    const useCase = new SubmitReviewUseCase(
      makeReviewRepo(),
      makeShipmentRepo({ ...confirmedShipment, status: ShipmentStatus.DELIVERED }) as never,
      notificationsMock() as never,
    );
    await expect(useCase.execute('sender-1', 'ship-1', { rating: 5 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects non-participants', async () => {
    const useCase = new SubmitReviewUseCase(
      makeReviewRepo(),
      makeShipmentRepo(confirmedShipment) as never,
      notificationsMock() as never,
    );
    await expect(useCase.execute('stranger', 'ship-1', { rating: 5 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects duplicate reviews for the same shipment/author', async () => {
    const reviews = makeReviewRepo({
      findByShipmentAndAuthor: jest.fn(async () => ({ id: 'existing' })),
    });
    const useCase = new SubmitReviewUseCase(
      reviews,
      makeShipmentRepo(confirmedShipment) as never,
      notificationsMock() as never,
    );
    await expect(useCase.execute('sender-1', 'ship-1', { rating: 5 })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(reviews.createAndRecomputeRating).not.toHaveBeenCalled();
  });

  it('rejects when the counterpart is not assigned', async () => {
    const useCase = new SubmitReviewUseCase(
      makeReviewRepo(),
      makeShipmentRepo({ ...confirmedShipment, carrierId: null }) as never,
      notificationsMock() as never,
    );
    await expect(useCase.execute('sender-1', 'ship-1', { rating: 5 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('ListUserReviewsUseCase', () => {
  it('returns paginated reviews with aggregate', async () => {
    const reviews = makeReviewRepo({
      listByTarget: jest.fn(async () => ({
        data: [],
        total: 3,
        aggregate: { average: 4.33, count: 3 },
      })),
    });
    const useCase = new ListUserReviewsUseCase(reviews);
    const result = await useCase.execute('carrier-1');
    expect(result.aggregate).toEqual({ average: 4.33, count: 3 });
    expect(result.pagination.totalItems).toBe(3);
  });
});

describe('ListShipmentReviewsUseCase', () => {
  it('returns reviews for a participant', async () => {
    const reviews = makeReviewRepo();
    const useCase = new ListShipmentReviewsUseCase(
      reviews,
      makeShipmentRepo(confirmedShipment) as never,
    );
    await useCase.execute('sender-1', 'ship-1');
    expect(reviews.listByShipment).toHaveBeenCalledWith('ship-1');
  });

  it('blocks non-participants', async () => {
    const useCase = new ListShipmentReviewsUseCase(
      makeReviewRepo(),
      makeShipmentRepo(confirmedShipment) as never,
    );
    await expect(useCase.execute('stranger', 'ship-1')).rejects.toBeInstanceOf(ForbiddenError);
  });
});
