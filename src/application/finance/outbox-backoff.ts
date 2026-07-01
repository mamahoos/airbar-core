/** Retry delays in milliseconds — scenario-b outbox doc. */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;

export function outboxBackoffMs(attemptCount: number): number {
  if (attemptCount <= 0) return BACKOFF_MS[0];
  const index = Math.min(attemptCount - 1, BACKOFF_MS.length - 1);
  return BACKOFF_MS[index]!;
}

export function outboxNextRetryAt(attemptCount: number, now = new Date()): Date {
  return new Date(now.getTime() + outboxBackoffMs(attemptCount));
}
