import type { CargoType } from './pricing-calculator.js';
import type { ShipmentStatus } from './shipment-state-machine.js';
import type { Currency } from '@prisma/client';

export const SHIPMENT_REPOSITORY = Symbol('SHIPMENT_REPOSITORY');

export interface ShipmentUserSummary {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarUrl: string | null;
  readonly rating: number;
  readonly kycLevel?: string;
  readonly phone?: string | null;
}

export interface ShipmentTripSummary {
  readonly id: string;
  readonly departureDate: Date;
  readonly arrivalDate: Date | null;
  readonly flightNumber: string | null;
}

export interface TrackingEvent {
  readonly status: string;
  readonly timestamp: string;
  readonly description: string;
  readonly location?: unknown;
}

export interface ShipmentRecord {
  readonly id: string;
  readonly trackingCode: string;
  readonly senderId: string;
  readonly carrierId: string | null;
  readonly tripId: string | null;
  readonly originCity: string;
  readonly originCountry: string;
  readonly originAddress: string | null;
  readonly originLocation: unknown;
  readonly destinationCity: string;
  readonly destinationCountry: string;
  readonly destinationAddress: string | null;
  readonly destinationLocation: unknown;
  readonly cargoType: CargoType;
  readonly description: string;
  readonly weight: number;
  readonly dimensions: unknown;
  readonly declaredValue: number | null;
  readonly photos: readonly string[];
  readonly senderContact: unknown;
  readonly receiverContact: unknown;
  readonly systemPrice: number;
  readonly agreedPrice: number | null;
  readonly currency: Currency;
  readonly status: ShipmentStatus;
  readonly currentLocation: unknown;
  readonly trackingHistory: readonly TrackingEvent[];
  readonly pickedUpAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly confirmedAt: Date | null;
  readonly disputeReason: string | null;
  readonly disputedAt: Date | null;
  readonly disputedById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly sender?: ShipmentUserSummary;
  readonly carrier?: ShipmentUserSummary | null;
  readonly trip?: ShipmentTripSummary | null;
}

export interface PublicTrackingRecord {
  readonly id: string;
  readonly trackingCode: string;
  readonly status: ShipmentStatus;
  readonly cargoType: CargoType;
  readonly originCity: string;
  readonly originCountry: string;
  readonly destinationCity: string;
  readonly destinationCountry: string;
  readonly currentLocation: unknown;
  readonly trackingHistory: readonly TrackingEvent[];
  readonly pickedUpAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateShipmentInput {
  readonly originCity: string;
  readonly originCountry: string;
  readonly originAddress?: string | undefined;
  readonly originLocation?: unknown;
  readonly destinationCity: string;
  readonly destinationCountry: string;
  readonly destinationAddress?: string | undefined;
  readonly destinationLocation?: unknown;
  readonly cargoType: CargoType;
  readonly description: string;
  readonly weight: number;
  readonly dimensions?: unknown;
  readonly declaredValue?: number | undefined;
  readonly photos?: readonly string[] | undefined;
  readonly senderContact?: unknown;
  readonly receiverContact: unknown;
  readonly currency?: Currency | undefined;
  readonly systemPrice: number;
}

export interface UpdateShipmentInput {
  readonly originCity?: string | undefined;
  readonly originCountry?: string | undefined;
  readonly originAddress?: string | undefined;
  readonly originLocation?: unknown;
  readonly destinationCity?: string | undefined;
  readonly destinationCountry?: string | undefined;
  readonly destinationAddress?: string | undefined;
  readonly destinationLocation?: unknown;
  readonly cargoType?: CargoType | undefined;
  readonly description?: string | undefined;
  readonly weight?: number | undefined;
  readonly dimensions?: unknown;
  readonly declaredValue?: number | undefined;
  readonly photos?: readonly string[] | undefined;
  readonly senderContact?: unknown;
  readonly receiverContact?: unknown;
  readonly systemPrice?: number | undefined;
}

export interface UpdateShipmentStatusInput {
  readonly status: ShipmentStatus;
  readonly note?: string | undefined;
  readonly location?: unknown;
  readonly pickedUpAt?: Date | undefined;
  readonly deliveredAt?: Date | undefined;
  readonly confirmedAt?: Date | undefined;
}

export interface ShipmentRepositoryPort {
  create(senderId: string, trackingCode: string, input: CreateShipmentInput): Promise<ShipmentRecord>;
  findById(id: string, viewerId?: string): Promise<ShipmentRecord | null>;
  findByTrackingCode(trackingCode: string): Promise<PublicTrackingRecord | null>;
  update(shipmentId: string, input: UpdateShipmentInput): Promise<ShipmentRecord>;
  updateStatus(shipmentId: string, input: UpdateShipmentStatusInput): Promise<ShipmentRecord>;
  assignToTrip(
    shipmentId: string,
    tripId: string,
    carrierId: string,
  ): Promise<ShipmentRecord>;
  acceptOffer(shipmentId: string, agreedPrice: number): Promise<ShipmentRecord>;
  rejectOffer(shipmentId: string): Promise<ShipmentRecord>;
  cancel(shipmentId: string): Promise<ShipmentRecord>;
  openDispute(shipmentId: string, userId: string, reason: string): Promise<ShipmentRecord>;
  listByRole(
    userId: string,
    role: 'sender' | 'carrier',
    status?: ShipmentStatus,
    page?: number,
    limit?: number,
  ): Promise<{ data: readonly ShipmentRecord[]; total: number }>;
  incrementUserShipmentCount(userId: string, delta: number): Promise<void>;
  findPendingMatches(input: {
    readonly excludeUserId: string;
    readonly originCity: string;
    readonly originCountry: string;
    readonly destinationCity: string;
    readonly destinationCountry: string;
    readonly maxWeight: number;
    readonly cargoTypes: readonly CargoType[] | null;
  }): Promise<readonly ShipmentRecord[]>;
  listPending(limit: number): Promise<readonly ShipmentRecord[]>;
}
