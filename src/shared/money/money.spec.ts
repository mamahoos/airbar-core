import { describe, it, expect } from '@jest/globals';

import {
  addRials,
  carrierNetRials,
  formatRials,
  MoneyError,
  parseRialsString,
  platformFeeRials,
  subtractRials,
} from './money.js';

describe('money (integer rials)', () => {
  it('parses and formats rials strings', () => {
    expect(parseRialsString('1500000')).toBe(1_500_000n);
    expect(formatRials(1_500_000n)).toBe('1500000');
  });

  it('rejects invalid rials strings', () => {
    expect(() => parseRialsString('-1')).toThrow(MoneyError);
    expect(() => parseRialsString('1.5')).toThrow(MoneyError);
    expect(() => parseRialsString('')).toThrow(MoneyError);
  });

  it('adds and subtracts without going negative', () => {
    expect(addRials(100n, 50n)).toBe(150n);
    expect(subtractRials(100n, 40n)).toBe(60n);
    expect(() => subtractRials(10n, 20n)).toThrow(MoneyError);
  });

  it('computes platform fee and carrier net (10% default)', () => {
    const amount = 1_000_000n;
    expect(platformFeeRials(amount, 10)).toBe(100_000n);
    expect(carrierNetRials(amount, 10)).toBe(900_000n);
  });
});
