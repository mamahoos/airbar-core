import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  MARKETPLACE_MATCHING_QUEUE,
  SHIPMENT_CREATED_MATCHING_JOB,
  TRIP_PUBLISHED_MATCHING_JOB,
  type MarketplaceMatchingJobData,
} from '../../adapters/queue/marketplace-matching/marketplace-matching.constants.js';

@Injectable()
export class MatchingEventsService {
  private readonly logger = new Logger(MatchingEventsService.name);

  constructor(
    @InjectQueue(MARKETPLACE_MATCHING_QUEUE)
    private readonly queue: Queue<MarketplaceMatchingJobData>,
  ) {}

  async shipmentCreated(shipmentId: string): Promise<void> {
    await this.enqueue(SHIPMENT_CREATED_MATCHING_JOB, {
      eventType: SHIPMENT_CREATED_MATCHING_JOB,
      shipmentId,
    });
  }

  async tripPublished(tripId: string): Promise<void> {
    await this.enqueue(TRIP_PUBLISHED_MATCHING_JOB, {
      eventType: TRIP_PUBLISHED_MATCHING_JOB,
      tripId,
    });
  }

  private async enqueue(
    name: typeof SHIPMENT_CREATED_MATCHING_JOB | typeof TRIP_PUBLISHED_MATCHING_JOB,
    data: MarketplaceMatchingJobData,
  ): Promise<void> {
    try {
      await this.queue.add(name, data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        jobId:
          data.eventType === SHIPMENT_CREATED_MATCHING_JOB
            ? `${name}-${data.shipmentId}`
            : `${name}-${data.tripId}`,
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue ${name} matching event: ${String(error)}`);
    }
  }
}
