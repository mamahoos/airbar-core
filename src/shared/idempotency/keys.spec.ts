import { describe, it, expect } from '@jest/globals';

import { shipmentId, userId } from '../ids/index.js';

import {
  escrowCreateKey,
  fundEscrowKey,
  partialRefundEscrowKey,
  paymentOrderKey,
  releaseEscrowKey,
  withdrawalKey,
} from './keys.js';

describe('idempotency key builders', () => {
  const sid = shipmentId('ship-uuid');
  const uid = userId('user-uuid');

  it('builds escrow create key', () => {
    expect(escrowCreateKey(sid)).toBe('escrow:ship-uuid');
  });

  it('builds fund key with order id', () => {
    expect(fundEscrowKey(sid, 'order-1')).toBe('fund:ship-uuid:order-1');
  });

  it('builds payment order key with nonce', () => {
    expect(paymentOrderKey(sid, 'nonce-abc')).toBe('pay:ship-uuid:nonce-abc');
  });

  it('builds release and partial refund keys', () => {
    expect(releaseEscrowKey(sid)).toBe('release:ship-uuid');
    expect(partialRefundEscrowKey(sid, '500000')).toBe('partial:ship-uuid:500000');
  });

  it('builds withdrawal key', () => {
    expect(withdrawalKey(uid, 'req-1')).toBe('wd:user-uuid:req-1');
  });
});
