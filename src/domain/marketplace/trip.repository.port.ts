import type { CargoType } from './pricing-calculator.js';
import type { Currency } from '@prisma/client';

export const TRIP_REPOSITORY = Symbol('TRIP_REPOSITORY');

export type TripStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TripCarrierSummary {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarUrl: string | null;
  readonly rating: number;
  readonly kycLevel: string;
  readonly totalTrips?: number;
}

export interface TripShipmentSummary {
  readonly id: string;
  readonly trackingCode: string;
  readonly cargoType: string;
  readonly weight: number;
  readonly status: string;
}

export interface TripRecord {
  readonly id: string;
  readonly userId: string;
  readonly originCity: string;
  readonly originCountry: string;
  readonly originAirport: string | null;
  readonly destinationCity: string;
  readonly destinationCountry: string;
  readonly destinationAirport: string | null;
  readonly departureDate: Date;
  readonly arrivalDate: Date | null;
  readonly flightNumber: string | null;
  readonly availableWeight: number;
  readonly maxWeight: number;
  readonly availableVolume: number | null;
  readonly acceptedCargoTypes: readonly CargoType[];
  readonly restrictions: readonly string[];
  readonly notes: string | null;
  readonly basePricePerKg: number;
  readonly currency: Currency;
  readonly status: TripStatus;
  readonly isVerified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly user?: TripCarrierSummary;
  readonly shipments?: readonly TripShipmentSummary[];
}

export interface CreateTripInput {
  readonly originCity: string;
  readonly originCountry: string;
  readonly originAirport?: string | undefined;
  readonly destinationCity: string;
  readonly destinationCountry: string;
  readonly destinationAirport?: string | undefined;
  readonly departureDate: Date;
  readonly arrivalDate?: Date | undefined;
  readonly flightNumber?: string | undefined;
  readonly availableWeight: number;
  readonly maxWeight: number;
  readonly availableVolume?: number | undefined;
  readonly acceptedCargoTypes?: readonly CargoType[] | undefined;
  readonly restrictions?: readonly string[] | undefined;
  readonly notes?: string | undefined;
  readonly basePricePerKg: number;
  readonly currency?: Currency | undefined;
}

export interface UpdateTripInput {
  readonly originCity?: string | undefined;
  readonly originCountry?: string | undefined;
  readonly originAirport?: string | undefined;
  readonly destinationCity?: string | undefined;
  readonly destinationCountry?: string | undefined;
  readonly destinationAirport?: string | undefined;
  readonly departureDate?: Date | undefined;
  readonly arrivalDate?: Date | undefined;
  readonly flightNumber?: string | undefined;
  readonly availableWeight?: number | undefined;
  readonly maxWeight?: number | undefined;
  readonly availableVolume?: number | undefined;
  readonly acceptedCargoTypes?: readonly CargoType[] | undefined;
  readonly restrictions?: readonly string[] | undefined;
  readonly notes?: string | undefined;
  readonly basePricePerKg?: number | undefined;
  readonly currency?: Currency | undefined;
}

export interface SearchTripsFilter {
  readonly originCity?: string | undefined;
  readonly originCountry?: string | undefined;
  readonly destinationCity?: string | undefined;
  readonly destinationCountry?: string | undefined;
  readonly departureDateFrom?: Date | undefined;
  readonly departureDateTo?: Date | undefined;
  readonly minWeight?: number | undefined;
  readonly maxPrice?: number | undefined;
  readonly cargoType?: CargoType | undefined;
  readonly cargoTypes?: readonly CargoType[] | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface TripRequestRecord {
  readonly id: string;
  readonly trackingCode: string;
  readonly status: string;
  readonly weight: number;
  readonly cargoType: string;
  readonly createdAt: Date;
  readonly sender: TripCarrierSummary;
}

export interface TripRepositoryPort {
  create(userId: string, input: CreateTripInput): Promise<TripRecord>;
  findById(id: string): Promise<TripRecord | null>;
  update(tripId: string, input: UpdateTripInput): Promise<TripRecord>;
  delete(tripId: string): Promise<void>;
  publish(tripId: string): Promise<TripRecord>;
  cancel(tripId: string): Promise<TripRecord>;
  search(filter: SearchTripsFilter): Promise<{ data: readonly TripRecord[]; total: number }>;
  listByUser(
    userId: string,
    status?: TripStatus,
    page?: number,
    limit?: number,
  ): Promise<{ data: readonly TripRecord[]; total: number }>;
  listRequests(tripId: string): Promise<readonly TripRequestRecord[]>;
  incrementUserTripCount(userId: string, delta: number): Promise<void>;
  adjustAvailableWeight(tripId: string, delta: number): Promise<void>;
  hasActiveShipments(tripId: string): Promise<boolean>;
  findActiveMatches(input: {
    readonly excludeUserId: string;
    readonly originCity: string;
    readonly originCountry: string;
    readonly destinationCity: string;
    readonly destinationCountry: string;
    readonly minWeight: number;
    readonly cargoType: CargoType;
  }): Promise<readonly TripRecord[]>;
}
