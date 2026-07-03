import { describe, expect, it, jest } from '@jest/globals';

import { ShipmentFinanceBridgeService } from './shipment-finance-bridge.service.js';

describe('ShipmentFinanceBridgeService', () => {
  it('maps PayFromWallet funding source to shipment paymentMethod', async () => {
    const update = jest.fn(async () => ({}));
    const bridge = new ShipmentFinanceBridgeService({ shipment: { update } } as never);

    await bridge.apply(
      'PayFromWallet',
      { shipmentId: 'ship-1' },
      { escrowId: 'esc-1', fundingSource: 'MIXED' },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: { paymentMethod: 'MIXED' },
    });
  });

  it('defaults PayFromWallet paymentMethod to WALLET when funding source missing', async () => {
    const update = jest.fn(async () => ({}));
    const bridge = new ShipmentFinanceBridgeService({ shipment: { update } } as never);

    await bridge.apply('PayFromWallet', { shipmentId: 'ship-2' }, { escrowId: 'esc-2' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ship-2' },
      data: { paymentMethod: 'WALLET' },
    });
  });

  it('maps PROMO_CREDIT funding source', async () => {
    const update = jest.fn(async () => ({}));
    const bridge = new ShipmentFinanceBridgeService({ shipment: { update } } as never);

    await bridge.apply(
      'PayFromWallet',
      { shipmentId: 'ship-3' },
      { escrowId: 'esc-3', fundingSource: 'PROMO_CREDIT' },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ship-3' },
      data: { paymentMethod: 'PROMO_CREDIT' },
    });
  });
});
