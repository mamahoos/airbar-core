import { describe, expect, it, jest } from '@jest/globals';
import { CargoType, Currency } from '@prisma/client';

import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';

import { AcceptShipmentOfferUseCase } from './shipment.use-cases.js';

import type { PricingQuoteService } from './pricing-quote.service.js';
import type {
  ShipmentRecord,
  ShipmentRepositoryPort,
} from '../../domain/marketplace/shipment.repository.port.js';
import type { FinanceOrchestratorPort } from '../finance/finance-orchestrator.port.js';
import type { KycAccessService } from '../kyc/kyc-access.service.js';
import type { NotificationService } from '../notifications/notification.use-cases.js';

describe('AcceptShipmentOfferUseCase', () => {
  it('rejects agreed prices below the effective price floor', async () => {
    const shipment = matchedShipment({ systemPrice: 120_000 });
    const shipments = shipmentRepository(shipment);
    const useCase = buildUseCase({
      shipments,
      priceFloor: 150_000,
    });

    await expect(useCase.execute(shipment.senderId, shipment.id, 140_000)).rejects.toThrow(
      'Agreed price is below the system price floor',
    );

    expect(shipments.acceptOffer.mock.calls).toHaveLength(0);
  });

  it('accepts the stored system price when no agreed price is supplied', async () => {
    const shipment = matchedShipment({ systemPrice: 160_000 });
    const shipments = shipmentRepository(shipment);
    const finance = financeOrchestrator();
    const useCase = buildUseCase({
      shipments,
      finance,
      priceFloor: 120_000,
    });

    const accepted = await useCase.execute(shipment.senderId, shipment.id);

    expect(shipments.acceptOffer.mock.calls).toEqual([[shipment.id, shipment.systemPrice]]);
    expect(finance.tryCreateEscrow.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ amountRials: shipment.systemPrice }),
    );
    expect(accepted.status).toBe(ShipmentStatus.ACCEPTED);
  });
});

function buildUseCase(options: {
  readonly shipments: jest.Mocked<ShipmentRepositoryPort>;
  readonly finance?: jest.Mocked<FinanceOrchestratorPort>;
  readonly priceFloor: number;
}) {
  return new AcceptShipmentOfferUseCase(
    options.shipments,
    {
      assertRequirement: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as KycAccessService,
    {
      notifyShipmentAccepted: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } as unknown as NotificationService,
    {
      calculateFloor: jest
        .fn<(input: unknown) => Promise<number>>()
        .mockResolvedValue(options.priceFloor),
    } as unknown as PricingQuoteService,
    options.finance ?? financeOrchestrator(),
  );
}

function shipmentRepository(shipment: ShipmentRecord): jest.Mocked<ShipmentRepositoryPort> {
  return {
    create: jest.fn(),
    findById: jest.fn<() => Promise<ShipmentRecord | null>>().mockResolvedValue(shipment),
    findByTrackingCode: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    assignToTrip: jest.fn(),
    acceptOffer: jest
      .fn<(shipmentId: string, agreedPrice: number) => Promise<ShipmentRecord>>()
      .mockImplementation(async (_shipmentId, agreedPrice) => ({
        ...shipment,
        status: ShipmentStatus.ACCEPTED,
        agreedPrice,
      })),
    rejectOffer: jest.fn(),
    cancel: jest.fn(),
    openDispute: jest.fn(),
    listByRole: jest.fn(),
    incrementUserShipmentCount: jest.fn(),
    findPendingMatches: jest.fn(),
    listPending: jest.fn(),
  };
}

function financeOrchestrator(): jest.Mocked<FinanceOrchestratorPort> {
  return {
    tryCreateEscrow: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    createEscrow: jest.fn(),
  } as unknown as jest.Mocked<FinanceOrchestratorPort>;
}

function matchedShipment(overrides?: Partial<ShipmentRecord>): ShipmentRecord {
  return {
    id: 'shipment-1',
    trackingCode: 'AB123',
    senderId: 'sender-1',
    carrierId: 'carrier-1',
    tripId: 'trip-1',
    originCity: 'تهران',
    originCountry: 'ایران',
    originAddress: null,
    originLocation: null,
    destinationCity: 'استانبول',
    destinationCountry: 'ترکیه',
    destinationAddress: null,
    destinationLocation: null,
    cargoType: CargoType.DOCUMENTS,
    description: 'documents',
    weight: 1,
    dimensions: null,
    declaredValue: null,
    photos: [],
    senderContact: null,
    receiverContact: { name: 'Receiver', phone: '09120000000' },
    systemPrice: 120_000,
    agreedPrice: null,
    currency: Currency.IRR,
    status: ShipmentStatus.MATCHED,
    currentLocation: null,
    trackingHistory: [],
    pickedUpAt: null,
    deliveredAt: null,
    confirmedAt: null,
    disputeReason: null,
    disputedAt: null,
    disputedById: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}
