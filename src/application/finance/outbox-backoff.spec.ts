import { outboxBackoffMs, outboxNextRetryAt } from './outbox-backoff.js';

describe('outboxBackoffMs', () => {
  it('returns escalating delays', () => {
    expect(outboxBackoffMs(1)).toBe(60_000);
    expect(outboxBackoffMs(2)).toBe(300_000);
    expect(outboxBackoffMs(3)).toBe(900_000);
    expect(outboxBackoffMs(4)).toBe(3_600_000);
    expect(outboxBackoffMs(99)).toBe(3_600_000);
  });
});

describe('outboxNextRetryAt', () => {
  it('adds backoff to reference time', () => {
    const now = new Date('2026-07-01T12:00:00.000Z');
    expect(outboxNextRetryAt(1, now).toISOString()).toBe('2026-07-01T12:01:00.000Z');
  });
});
