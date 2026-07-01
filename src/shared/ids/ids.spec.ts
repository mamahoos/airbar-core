import { describe, it, expect } from '@jest/globals';

import { brandValue } from './brand.js';
import { shipmentId, userId } from './ids.js';

describe('branded IDs', () => {
  it('creates nominal UserId from a non-empty string', () => {
    const id = userId('550e8400-e29b-41d4-a716-446655440000');
    expect(id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects empty UserId', () => {
    expect(() => userId('')).toThrow('UserId must be a non-empty string');
    expect(() => userId('   ')).toThrow('UserId must be a non-empty string');
  });

  it('prevents accidental assignment between different brands at compile time', () => {
    const _uid = userId('user-1');
    const sid = shipmentId('ship-1');
    // @ts-expect-error ShipmentId is not assignable to UserId
    const _wrong: typeof _uid = sid;
    expect(_wrong).toBeDefined();
    expect(brandValue<string, 'UserId'>('x')).toBe('x');
  });
});
