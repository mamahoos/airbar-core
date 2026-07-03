import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { MatchingService } from '../../../application/marketplace/matching.service.js';

import {
  MARKETPLACE_MATCHING_QUEUE,
  SHIPMENT_CREATED_MATCHING_JOB,
  TRIP_PUBLISHED_MATCHING_JOB,
  type MarketplaceMatchingJobData,
} from './marketplace-matching.constants.js';

@Processor(MARKETPLACE_MATCHING_QUEUE)
export class MarketplaceMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketplaceMatchingProcessor.name);

  constructor(private readonly matching: MatchingService) {
    super();
  }

  async process(job: Job<MarketplaceMatchingJobData>): Promise<void> {
    if (job.name === SHIPMENT_CREATED_MATCHING_JOB && job.data.eventType === job.name) {
      this.logger.debug(`Processing matching for shipment ${job.data.shipmentId}`);
      await this.matching.processShipmentCreated(job.data.shipmentId);
      return;
    }

    if (job.name === TRIP_PUBLISHED_MATCHING_JOB && job.data.eventType === job.name) {
      this.logger.debug(`Processing matching for trip ${job.data.tripId}`);
      await this.matching.processTripPublished(job.data.tripId);
    }
  }
}
