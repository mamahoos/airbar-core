import { describe, expect, it, jest } from '@jest/globals';

import { ShipmentFinanceBridgeService } from './shipment-finance-bridge.service.js';

describe('ShipmentFinanceBridgeService', () => {
  function makeBridge(prisma: { shipment: Record<string, unknown> }) {
    return new ShipmentFinanceBridgeService(
      prisma as never,
      {
        notifyDisputeResolvedToParties: jest.fn(async () => undefined),
      } as never,
    );
  }

  it('maps PayFromWallet funding source to shipment paymentMethod', async () => {
    const update = jest.fn(async () => ({}));
    const bridge = makeBridge({ shipment: { update } });

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
    const bridge = makeBridge({ shipment: { update } });

    await bridge.apply('PayFromWallet', { shipmentId: 'ship-2' }, { escrowId: 'esc-2' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ship-2' },
      data: { paymentMethod: 'WALLET' },
    });
  });

  it('maps PROMO_CREDIT funding source', async () => {
    const update = jest.fn(async () => ({}));
    const bridge = makeBridge({ shipment: { update } });

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

  it('applies dispute resolution metadata after a replayed refund succeeds', async () => {
    const findUnique = jest.fn(async () => ({
      senderId: 'sender-1',
      carrierId: 'carrier-1',
    }));
    const update = jest.fn(async () => ({}));
    const notifications = {
      notifyDisputeResolvedToParties: jest.fn(async () => undefined),
    };
    const bridge = new ShipmentFinanceBridgeService(
      { shipment: { findUnique, update } } as never,
      notifications as never,
    );

    await bridge.apply(
      'RefundEscrow',
      {
        shipmentId: 'ship-4',
        disputeResolution: 'package damaged',
        disputeTargetStatus: 'REFUNDED',
      },
      {},
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ship-4' },
        data: expect.objectContaining({
          status: 'REFUNDED',
          disputeResolution: 'package damaged',
          trackingHistory: expect.objectContaining({
            push: expect.objectContaining({ status: 'REFUNDED' }),
          }),
        }),
      }),
    );
    expect(notifications.notifyDisputeResolvedToParties).toHaveBeenCalledWith(
      { senderId: 'sender-1', carrierId: 'carrier-1' },
      'ship-4',
      'package damaged',
      'REFUNDED',
    );
  });

  it('ignores release/refund commands that are not dispute resolutions', async () => {
    const findUnique = jest.fn(async () => ({
      senderId: 'sender-1',
      carrierId: 'carrier-1',
    }));
    const update = jest.fn(async () => ({}));
    const notifications = {
      notifyDisputeResolvedToParties: jest.fn(async () => undefined),
    };
    const bridge = new ShipmentFinanceBridgeService(
      { shipment: { findUnique, update } } as never,
      notifications as never,
    );

    await bridge.apply('ReleaseEscrow', { shipmentId: 'ship-5' }, {});

    expect(update).not.toHaveBeenCalled();
    expect(notifications.notifyDisputeResolvedToParties).not.toHaveBeenCalled();
  });

  it('markShipmentPaid notifies parties when payment is confirmed', async () => {
    const findUnique = jest.fn(async () => ({
      status: 'ACCEPTED',
      senderId: 'sender-1',
      carrierId: 'carrier-1',
    }));
    const update = jest.fn(async () => ({}));
    const notifications = {
      notifyDisputeResolvedToParties: jest.fn(async () => undefined),
      notifyPaymentSecured: jest.fn(async () => undefined),
    };
    const bridge = new ShipmentFinanceBridgeService(
      { shipment: { findUnique, update } } as never,
      notifications as never,
    );

    await expect(bridge.markShipmentPaid('ship-paid')).resolves.toBe(true);
    expect(notifications.notifyPaymentSecured).toHaveBeenCalledWith(
      { senderId: 'sender-1', carrierId: 'carrier-1' },
      'ship-paid',
    );
  });
});
