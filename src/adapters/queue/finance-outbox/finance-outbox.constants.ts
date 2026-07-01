export const FINANCE_OUTBOX_QUEUE = 'finance-outbox';
export const FINANCE_OUTBOX_JOB = 'process-outbox-row';

export interface FinanceOutboxJobData {
  readonly outboxId: string;
}
