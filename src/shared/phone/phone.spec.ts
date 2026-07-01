import { describe, it, expect } from '@jest/globals';

import { isIranianPhone, isValidPhone, normalizePhone } from './phone.js';

describe('phone utilities', () => {
  it('normalizes Iranian numbers to 09xxxxxxxxx', () => {
    expect(normalizePhone('09123456789')).toBe('09123456789');
    expect(normalizePhone('+989123456789')).toBe('09123456789');
    expect(normalizePhone('989123456789')).toBe('09123456789');
    expect(normalizePhone('9123456789')).toBe('09123456789');
  });

  it('normalizes international numbers to E.164', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
  });

  it('validates Iranian and E.164 phones', () => {
    expect(isValidPhone('09123456789')).toBe(true);
    expect(isValidPhone('+14155552671')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
    expect(isIranianPhone('09123456789')).toBe(true);
    expect(isIranianPhone('+14155552671')).toBe(false);
  });
});
