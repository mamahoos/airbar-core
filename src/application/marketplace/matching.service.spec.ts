import { describe, expect, it, jest } from '@jest/globals';
import { CargoType, Currency } from '@prisma/client';

import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';

import { MatchingService } from './matching.service.js';

import type { RedisService } from '../../adapters/cache/redis.service.js';
import type {
  MatchSuggestionInput,
  MatchSuggestionRecord,
  MatchSuggestionRepositoryPort,
} from '../../domain/marketplace/match-suggestion.repository.port.js';
import type {
  ShipmentRecord,
  ShipmentRepositoryPort,
} from '../../domain/marketplace/shipment.repository.port.js';
import type {
  TripRecord,
  TripRepositoryPort,
} from '../../domain/marketplace/trip.repository.port.js';

describe('MatchingService event processing', () => {
  it('stores scored suggestions when a shipment-created event is processed', async () => {
    const shipment = shipmentRecord();
    const trip = tripRecord();
    const redis = redisMock();
    const suggestions = matchSuggestionRepository();
    const service = new MatchingService(
      tripRepository({ trip, activeMatches: [trip] }),
      shipmentRepository({ shipment }),
      suggestions,
      redis as unknown as RedisService,
    );

    const result = await service.processShipmentCreated(shipment.id);

    expect(result).toEqual({ suggested: 1 });
    expect(suggestions.upsert.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        shipmentId: 'shipment-1',
        tripId: 'trip-1',
        source: 'shipment_created',
        score: expect.any(Number),
        factors: expect.objectContaining({ cargoTypeMatch: 100 }),
      }),
    );
    expect(redis.set.mock.calls[0]?.[0]).toBe('match:shipment-1:trip-1');
    expect(JSON.parse(String(redis.set.mock.calls[0]?.[1]))).toEqual(
      expect.objectContaining({
        shipmentId: 'shipment-1',
        tripId: 'trip-1',
        source: 'shipment_created',
        score: expect.any(Number),
      }),
    );
    expect(redis.set.mock.calls[0]?.[2]).toBe(86_400);
  });

  it('stores suggestions for pending shipments when a trip-published event is processed', async () => {
    const shipment = shipmentRecord();
    const trip = tripRecord();
    const redis = redisMock();
    const suggestions = matchSuggestionRepository();
    const service = new MatchingService(
      tripRepository({ trip }),
      shipmentRepository({ shipment, pendingMatches: [shipment] }),
      suggestions,
      redis as unknown as RedisService,
    );

    const result = await service.processTripPublished(trip.id);

    expect(result).toEqual({ suggested: 1 });
    expect(suggestions.upsert.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        shipmentId: 'shipment-1',
        tripId: 'trip-1',
        source: 'trip_published',
        score: expect.any(Number),
        factors: expect.objectContaining({ cargoTypeMatch: 100 }),
      }),
    );
    expect(redis.set.mock.calls[0]?.[0]).toBe('match:shipment-1:trip-1');
    expect(JSON.parse(String(redis.set.mock.calls[0]?.[1]))).toEqual(
      expect.objectContaining({
        shipmentId: 'shipment-1',
        tripId: 'trip-1',
        source: 'trip_published',
      }),
    );
  });
});

function redisMock() {
  return {
    set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

function matchSuggestionRepository(): jest.Mocked<MatchSuggestionRepositoryPort> {
  return {
    upsert: jest
      .fn<(input: MatchSuggestionInput) => Promise<MatchSuggestionRecord>>()
      .mockImplementation(async (input) => ({
        id: 'suggestion-1',
        shipmentId: input.shipmentId,
        tripId: input.tripId,
        score: input.score,
        factors: input.factors,
        source: input.source,
        status: 'SUGGESTED',
        suggestedAt: new Date('2026-07-03T00:00:00Z'),
        updatedAt: new Date('2026-07-03T00:00:00Z'),
      })),
    listForShipment: jest.fn(),
    listForTrip: jest.fn(),
  } as unknown as jest.Mocked<MatchSuggestionRepositoryPort>;
}

function tripRepository(input: {
  readonly trip: TripRecord;
  readonly activeMatches?: readonly TripRecord[] | undefined;
}): jest.Mocked<TripRepositoryPort> {
  return {
    create: jest.fn(),
    findById: jest.fn<() => Promise<TripRecord | null>>().mockResolvedValue(input.trip),
    update: jest.fn(),
    delete: jest.fn(),
    publish: jest.fn(),
    cancel: jest.fn(),
    search: jest.fn(),
    listByUser: jest.fn(),
    listRequests: jest.fn(),
    incrementUserTripCount: jest.fn(),
    adjustAvailableWeight: jest.fn(),
    hasActiveShipments: jest.fn(),
    findActiveMatches: jest
      .fn<() => Promise<readonly TripRecord[]>>()
      .mockResolvedValue(input.activeMatches ?? []),
  };
}

function shipmentRepository(input: {
  readonly shipment: ShipmentRecord;
  readonly pendingMatches?: readonly ShipmentRecord[] | undefined;
}): jest.Mocked<ShipmentRepositoryPort> {
  return {
    create: jest.fn(),
    findById: jest.fn<() => Promise<ShipmentRecord | null>>().mockResolvedValue(input.shipment),
    findByTrackingCode: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    assignToTrip: jest.fn(),
    acceptOffer: jest.fn(),
    rejectOffer: jest.fn(),
    cancel: jest.fn(),
    openDispute: jest.fn(),
    listByRole: jest.fn(),
    incrementUserShipmentCount: jest.fn(),
    findPendingMatches: jest
      .fn<() => Promise<readonly ShipmentRecord[]>>()
      .mockResolvedValue(input.pendingMatches ?? []),
    listPending: jest.fn(),
  };
}

function shipmentRecord(): ShipmentRecord {
  return {
    id: 'shipment-1',
    trackingCode: 'AB123',
    senderId: 'sender-1',
    carrierId: null,
    tripId: null,
    originCity: 'Tehran',
    originCountry: 'IR',
    originAddress: null,
    originLocation: null,
    destinationCity: 'Istanbul',
    destinationCountry: 'TR',
    destinationAddress: null,
    destinationLocation: null,
    cargoType: CargoType.DOCUMENTS,
    description: 'documents',
    weight: 2,
    dimensions: null,
    declaredValue: null,
    photos: [],
    senderContact: null,
    receiverContact: { name: 'Receiver' },
    systemPrice: 100_000,
    agreedPrice: null,
    currency: Currency.IRR,
    status: ShipmentStatus.PENDING,
    currentLocation: null,
    trackingHistory: [],
    pickedUpAt: null,
    deliveredAt: null,
    confirmedAt: null,
    disputeReason: null,
    disputedAt: null,
    disputedById: null,
    createdAt: new Date('2026-07-03T00:00:00Z'),
    updatedAt: new Date('2026-07-03T00:00:00Z'),
  };
}

function tripRecord(): TripRecord {
  return {
    id: 'trip-1',
    userId: 'carrier-1',
    originCity: 'Tehran',
    originCountry: 'IR',
    originAirport: null,
    destinationCity: 'Istanbul',
    destinationCountry: 'TR',
    destinationAirport: null,
    departureDate: new Date('2026-07-10T00:00:00Z'),
    arrivalDate: null,
    flightNumber: null,
    availableWeight: 10,
    maxWeight: 20,
    availableVolume: null,
    acceptedCargoTypes: [CargoType.DOCUMENTS],
    restrictions: [],
    notes: null,
    basePricePerKg: 50_000,
    currency: Currency.IRR,
    status: 'ACTIVE',
    isVerified: true,
    createdAt: new Date('2026-07-03T00:00:00Z'),
    updatedAt: new Date('2026-07-03T00:00:00Z'),
    user: {
      id: 'carrier-1',
      firstName: 'Carrier',
      lastName: 'User',
      avatarUrl: null,
      rating: 4.8,
      kycLevel: 'DOCUMENT',
    },
  };
}
