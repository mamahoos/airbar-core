import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { isOutboxCommand } from '../../../domain/finance/outbox.command.js';
import {
  OUTBOX_REPOSITORY,
  type InsertOutboxInput,
  type OutboxRepositoryPort,
  type OutboxRow,
  type OutboxRowStatus,
} from '../../../domain/finance/outbox.repository.port.js';
import { PrismaService } from '../prisma.service.js';

function toRow(record: {
  id: string;
  aggregateType: string;
  aggregateId: string;
  command: string;
  payload: Prisma.JsonValue;
  idempotencyKey: string;
  status: string;
  attemptCount: number;
  nextRetryAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
}): OutboxRow {
  if (!isOutboxCommand(record.command)) {
    throw new Error(`Unknown outbox command: ${record.command}`);
  }
  return {
    id: record.id,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    command: record.command,
    payload: record.payload as Record<string, unknown>,
    idempotencyKey: record.idempotencyKey,
    status: record.status as OutboxRowStatus,
    attemptCount: record.attemptCount,
    nextRetryAt: record.nextRetryAt,
    lastError: record.lastError,
    createdAt: record.createdAt,
    processedAt: record.processedAt,
  };
}

@Injectable()
export class PrismaOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: InsertOutboxInput): Promise<OutboxRow> {
    const row = await this.prisma.integrationOutbox.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        command: input.command,
        payload: input.payload as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return toRow(row);
  }

  async findById(id: string): Promise<OutboxRow | null> {
    const row = await this.prisma.integrationOutbox.findUnique({ where: { id } });
    return row ? toRow(row) : null;
  }

  async markProcessing(id: string): Promise<void> {
    await this.prisma.integrationOutbox.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });
  }

  async markDone(id: string): Promise<void> {
    await this.prisma.integrationOutbox.update({
      where: { id },
      data: { status: 'DONE', processedAt: new Date(), lastError: null },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.integrationOutbox.update({
      where: { id },
      data: { status: 'FAILED', lastError: error, processedAt: new Date() },
    });
  }

  async markPendingForRetry(
    id: string,
    attemptCount: number,
    nextRetryAt: Date,
    error: string,
  ): Promise<void> {
    await this.prisma.integrationOutbox.update({
      where: { id },
      data: {
        status: 'PENDING',
        attemptCount,
        nextRetryAt,
        lastError: error,
      },
    });
  }

  async resetForReplay(id: string): Promise<OutboxRow> {
    const row = await this.prisma.integrationOutbox.update({
      where: { id },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        nextRetryAt: null,
        lastError: null,
        processedAt: null,
      },
    });
    return toRow(row);
  }

  async listFailed(page: number, limit: number): Promise<{ data: OutboxRow[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.integrationOutbox.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.integrationOutbox.count({ where: { status: 'FAILED' } }),
    ]);
    return { data: data.map(toRow), total };
  }
}

export const outboxRepositoryProvider = {
  provide: OUTBOX_REPOSITORY,
  useClass: PrismaOutboxRepository,
};
