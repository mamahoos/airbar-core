import { describe, expect, it, jest } from '@jest/globals';

import {
  SHIPMENT_CREATED_MATCHING_JOB,
  TRIP_PUBLISHED_MATCHING_JOB,
} from '../../adapters/queue/marketplace-matching/marketplace-matching.constants.js';

import { MatchingEventsService } from './matching-events.service.js';

import type { Queue } from 'bullmq';

describe('MatchingEventsService', () => {
  it('enqueues shipment-created matching events with deterministic retryable jobs', async () => {
    const queue = queueMock();
    const service = new MatchingEventsService(queue as unknown as Queue);

    await service.shipmentCreated('shipment-1');

    expect(queue.add.mock.calls[0]).toEqual([
      SHIPMENT_CREATED_MATCHING_JOB,
      { eventType: SHIPMENT_CREATED_MATCHING_JOB, shipmentId: 'shipment-1' },
      expect.objectContaining({
        attempts: 5,
        jobId: 'shipment-created-shipment-1',
        backoff: { type: 'exponential', delay: 30_000 },
      }),
    ]);
  });

  it('enqueues trip-published matching events with deterministic retryable jobs', async () => {
    const queue = queueMock();
    const service = new MatchingEventsService(queue as unknown as Queue);

    await service.tripPublished('trip-1');

    expect(queue.add.mock.calls[0]).toEqual([
      TRIP_PUBLISHED_MATCHING_JOB,
      { eventType: TRIP_PUBLISHED_MATCHING_JOB, tripId: 'trip-1' },
      expect.objectContaining({
        attempts: 5,
        jobId: 'trip-published-trip-1',
        backoff: { type: 'exponential', delay: 30_000 },
      }),
    ]);
  });
});

function queueMock() {
  return {
    add: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}
