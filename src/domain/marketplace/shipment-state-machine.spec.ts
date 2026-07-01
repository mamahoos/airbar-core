import { describe, it, expect } from '@jest/globals';

import {
  ShipmentStatus,
  assertStatusTransition,
  canTransitionStatus,
} from './shipment-state-machine.js';

describe('shipment status transitions', () => {
  it('allows carrier pickup after paid', () => {
    expect(
      canTransitionStatus(ShipmentStatus.PAID, ShipmentStatus.PICKED_UP, 'carrier'),
    ).toBe(true);
  });

  it('rejects sender confirming before delivered', () => {
    expect(
      canTransitionStatus(ShipmentStatus.IN_TRANSIT, ShipmentStatus.CONFIRMED, 'sender'),
    ).toBe(false);
  });

  it('allows dispute from delivered', () => {
    expect(canTransitionStatus(ShipmentStatus.DELIVERED, ShipmentStatus.DISPUTED, 'sender')).toBe(
      true,
    );
  });

  it('throws on invalid transition', () => {
    expect(() =>
      assertStatusTransition(ShipmentStatus.PENDING, ShipmentStatus.PAID, 'carrier'),
    ).toThrow(/Invalid shipment status transition/);
  });
});
