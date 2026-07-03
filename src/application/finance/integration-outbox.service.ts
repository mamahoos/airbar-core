import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  FINANCE_OUTBOX_JOB,
  FINANCE_OUTBOX_QUEUE,
  type FinanceOutboxJobData,
} from '../../adapters/queue/finance-outbox/finance-outbox.constants.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
import {
  OUTBOX_REPOSITORY,
  type ListOutboxFilter,
  type OutboxRepositoryPort,
  type OutboxRow,
  type OutboxRowStatus,
} from '../../domain/finance/outbox.repository.port.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

import { outboxNextRetryAt } from './outbox-backoff.js';
import { OutboxCommandHandler } from './outbox-command.handler.js';
import { ShipmentFinanceBridgeService } from './shipment-finance-bridge.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { OutboxCommand } from '../../domain/finance/outbox.command.js';

const MASKED = '[masked]';
const SENSITIVE_PAYLOAD_KEYS = new Set([
  'destinationIban',
  'iban',
  'cardNumber',
  'nationalId',
  'birthDate',
  'phone',
  'mobile',
]);

function maskOutboxPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskOutboxPayload);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_PAYLOAD_KEYS.has(key) ? MASKED : maskOutboxPayload(nested),
    ]),
  );
}

export interface AdminOutboxRow {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly command: OutboxCommand;
  readonly payload: unknown;
  readonly idempotencyKey: string;
  readonly status: OutboxRowStatus;
  readonly attemptCount: number;
  readonly nextRetryAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

function toAdminRow(row: OutboxRow): AdminOutboxRow {
  return {
    ...row,
    payload: maskOutboxPayload(row.payload),
  };
}

@Injectable()
export class IntegrationOutboxService {
  private readonly logger = new Logger(IntegrationOutboxService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepositoryPort,
    @InjectQueue(FINANCE_OUTBOX_QUEUE) private readonly queue: Queue<FinanceOutboxJobData>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly handler: OutboxCommandHandler,
    private readonly bridge: ShipmentFinanceBridgeService,
  ) {}

  async enqueue(
    command: OutboxCommand,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<void> {
    const row = await this.outbox.insert({
      aggregateType,
      aggregateId,
      command,
      payload,
      idempotencyKey,
    });
    await this.queue.add(FINANCE_OUTBOX_JOB, { outboxId: row.id });
  }

  async processRow(outboxId: string): Promise<void> {
    const row = await this.outbox.findById(outboxId);
    if (!row || row.status === 'DONE') return;

    await this.outbox.markProcessing(outboxId);

    try {
      const result = await this.handler.execute(row.command, row.payload, row.idempotencyKey);
      await this.bridge.apply(row.command, row.payload, result);
      await this.outbox.markDone(outboxId);
    } catch (error) {
      await this.handleFailure(outboxId, row.attemptCount, error);
    }
  }

  async replay(outboxId: string): Promise<void> {
    const row = await this.outbox.resetForReplay(outboxId);
    if (row.status !== 'PENDING') {
      throw new ValidationError('Outbox row cannot be replayed');
    }
    await this.queue.add(FINANCE_OUTBOX_JOB, { outboxId: row.id });
  }

  async listForAdmin(filter: ListOutboxFilter): Promise<{ data: AdminOutboxRow[]; total: number }> {
    const result = await this.outbox.list(filter);
    return { data: result.data.map(toAdminRow), total: result.total };
  }

  async getForAdmin(outboxId: string): Promise<AdminOutboxRow> {
    const row = await this.outbox.findById(outboxId);
    if (!row) throw new NotFoundError('IntegrationOutbox', outboxId);
    return toAdminRow(row);
  }

  private async handleFailure(outboxId: string, previousAttempts: number, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = previousAttempts + 1;

    if (attempts >= this.config.outboxMaxAttempts) {
      await this.outbox.markFailed(outboxId, message);
      this.logger.error(`Outbox ${outboxId} failed permanently: ${message}`);
      return;
    }

    const nextRetryAt = outboxNextRetryAt(attempts);
    await this.outbox.markPendingForRetry(outboxId, attempts, nextRetryAt, message);
    const delayMs = nextRetryAt.getTime() - Date.now();
    await this.queue.add(FINANCE_OUTBOX_JOB, { outboxId }, { delay: Math.max(delayMs, 0) });
    this.logger.warn(`Outbox ${outboxId} scheduled retry #${attempts}: ${message}`);
  }
}
