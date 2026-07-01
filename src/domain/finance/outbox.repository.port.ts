import type { OutboxCommand } from './outbox.command.js';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export type OutboxRowStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface OutboxRow {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly command: OutboxCommand;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
  readonly status: OutboxRowStatus;
  readonly attemptCount: number;
  readonly nextRetryAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

export interface InsertOutboxInput {
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly command: OutboxCommand;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
}

export interface OutboxRepositoryPort {
  insert(input: InsertOutboxInput): Promise<OutboxRow>;
  findById(id: string): Promise<OutboxRow | null>;
  markProcessing(id: string): Promise<void>;
  markDone(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  markPendingForRetry(
    id: string,
    attemptCount: number,
    nextRetryAt: Date,
    error: string,
  ): Promise<void>;
  resetForReplay(id: string): Promise<OutboxRow>;
  listFailed(page: number, limit: number): Promise<{ data: OutboxRow[]; total: number }>;
}
