import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { IntegrationOutboxService } from '../../../application/finance/integration-outbox.service.js';

import {
  FINANCE_OUTBOX_JOB,
  FINANCE_OUTBOX_QUEUE,
  type FinanceOutboxJobData,
} from './finance-outbox.constants.js';

@Processor(FINANCE_OUTBOX_QUEUE)
export class FinanceOutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(FinanceOutboxProcessor.name);

  constructor(private readonly outbox: IntegrationOutboxService) {
    super();
  }

  async process(job: Job<FinanceOutboxJobData>): Promise<void> {
    if (job.name !== FINANCE_OUTBOX_JOB) return;
    this.logger.debug(`Processing outbox row ${job.data.outboxId}`);
    await this.outbox.processRow(job.data.outboxId);
  }
}
