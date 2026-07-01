import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type { CargoType } from '../../../domain/marketplace/pricing-calculator.js';
import type {
  CreateTripInput,
  SearchTripsFilter,
  TripRecord,
  TripRepositoryPort,
  TripRequestRecord,
  TripStatus,
  UpdateTripInput,
} from '../../../domain/marketplace/trip.repository.port.js';
import type { Prisma, Trip } from '@prisma/client';

const carrierSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  rating: true,
  kycLevel: true,
  totalTrips: true,
} as const;

@Injectable()
export class PrismaTripRepository implements TripRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateTripInput): Promise<TripRecord> {
    const trip = await this.prisma.trip.create({
      data: {
        userId,
        originCity: input.originCity,
        originCountry: input.originCountry,
        originAirport: input.originAirport ?? null,
        destinationCity: input.destinationCity,
        destinationCountry: input.destinationCountry,
        destinationAirport: input.destinationAirport ?? null,
        departureDate: input.departureDate,
        arrivalDate: input.arrivalDate ?? null,
        flightNumber: input.flightNumber ?? null,
        availableWeight: input.availableWeight,
        maxWeight: input.maxWeight,
        availableVolume: input.availableVolume ?? null,
        acceptedCargoTypes: [...(input.acceptedCargoTypes ?? [])],
        restrictions: [...(input.restrictions ?? [])],
        notes: input.notes ?? null,
        basePricePerKg: input.basePricePerKg,
        currency: input.currency ?? 'IRR',
        status: 'DRAFT',
      },
      include: { user: { select: carrierSelect } },
    });
    return this.toRecord(trip);
  }

  async findById(id: string): Promise<TripRecord | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        user: { select: carrierSelect },
        shipments: {
          select: {
            id: true,
            trackingCode: true,
            cargoType: true,
            weight: true,
            status: true,
          },
        },
      },
    });
    return trip ? this.toRecord(trip) : null;
  }

  async update(tripId: string, input: UpdateTripInput): Promise<TripRecord> {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        ...(input.originCity !== undefined ? { originCity: input.originCity } : {}),
        ...(input.originCountry !== undefined ? { originCountry: input.originCountry } : {}),
        ...(input.originAirport !== undefined ? { originAirport: input.originAirport } : {}),
        ...(input.destinationCity !== undefined ? { destinationCity: input.destinationCity } : {}),
        ...(input.destinationCountry !== undefined
          ? { destinationCountry: input.destinationCountry }
          : {}),
        ...(input.destinationAirport !== undefined
          ? { destinationAirport: input.destinationAirport }
          : {}),
        ...(input.departureDate !== undefined ? { departureDate: input.departureDate } : {}),
        ...(input.arrivalDate !== undefined ? { arrivalDate: input.arrivalDate } : {}),
        ...(input.flightNumber !== undefined ? { flightNumber: input.flightNumber } : {}),
        ...(input.availableWeight !== undefined ? { availableWeight: input.availableWeight } : {}),
        ...(input.maxWeight !== undefined ? { maxWeight: input.maxWeight } : {}),
        ...(input.availableVolume !== undefined ? { availableVolume: input.availableVolume } : {}),
        ...(input.acceptedCargoTypes !== undefined
          ? { acceptedCargoTypes: [...input.acceptedCargoTypes] }
          : {}),
        ...(input.restrictions !== undefined ? { restrictions: [...input.restrictions] } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.basePricePerKg !== undefined ? { basePricePerKg: input.basePricePerKg } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
      },
      include: { user: { select: carrierSelect } },
    });
    return this.toRecord(trip);
  }

  async delete(tripId: string): Promise<void> {
    await this.prisma.trip.delete({ where: { id: tripId } });
  }

  async publish(tripId: string): Promise<TripRecord> {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'ACTIVE' },
      include: { user: { select: carrierSelect } },
    });
    return this.toRecord(trip);
  }

  async cancel(tripId: string): Promise<TripRecord> {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'CANCELLED' },
      include: { user: { select: carrierSelect } },
    });
    return this.toRecord(trip);
  }

  async search(filter: SearchTripsFilter): Promise<{ data: readonly TripRecord[]; total: number }> {
    const where = this.buildSearchWhere(filter);
    const { skip, take } = this.paginate(filter.page, filter.limit);

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: { user: { select: carrierSelect } },
        orderBy: { departureDate: 'asc' },
        skip,
        take,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { data: trips.map((t) => this.toRecord(t)), total };
  }

  async listByUser(
    userId: string,
    status?: TripStatus,
    page = 1,
    limit = 20,
  ): Promise<{ data: readonly TripRecord[]; total: number }> {
    const where: Prisma.TripWhereInput = { userId };
    if (status) where.status = status;

    const { skip, take } = this.paginate(page, limit);

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: {
          shipments: {
            select: {
              id: true,
              trackingCode: true,
              status: true,
              weight: true,
              cargoType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { data: trips.map((t) => this.toRecord(t)), total };
  }

  async listRequests(tripId: string): Promise<readonly TripRequestRecord[]> {
    const rows = await this.prisma.shipment.findMany({
      where: { tripId, status: { in: ['PENDING', 'MATCHED'] } },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            rating: true,
            kycLevel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      trackingCode: row.trackingCode,
      status: row.status,
      weight: row.weight,
      cargoType: row.cargoType,
      createdAt: row.createdAt,
      sender: {
        id: row.sender.id,
        firstName: row.sender.firstName,
        lastName: row.sender.lastName,
        avatarUrl: row.sender.avatarUrl,
        rating: row.sender.rating,
        kycLevel: row.sender.kycLevel,
      },
    }));
  }

  async incrementUserTripCount(userId: string, delta: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalTrips: { increment: delta } },
    });
  }

  async adjustAvailableWeight(tripId: string, delta: number): Promise<void> {
    await this.prisma.trip.update({
      where: { id: tripId },
      data: { availableWeight: { increment: delta } },
    });
  }

  async hasActiveShipments(tripId: string): Promise<boolean> {
    const count = await this.prisma.shipment.count({
      where: {
        tripId,
        status: { notIn: ['PENDING', 'CANCELLED'] },
      },
    });
    return count > 0;
  }

  async findActiveMatches(input: {
    excludeUserId: string;
    originCity: string;
    originCountry: string;
    destinationCity: string;
    destinationCountry: string;
    minWeight: number;
    cargoType: CargoType;
  }): Promise<readonly TripRecord[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        status: 'ACTIVE',
        userId: { not: input.excludeUserId },
        originCity: { contains: input.originCity, mode: 'insensitive' },
        originCountry: input.originCountry,
        destinationCity: { contains: input.destinationCity, mode: 'insensitive' },
        destinationCountry: input.destinationCountry,
        availableWeight: { gte: input.minWeight },
        departureDate: { gt: new Date() },
        OR: [
          { acceptedCargoTypes: { isEmpty: true } },
          { acceptedCargoTypes: { has: input.cargoType } },
        ],
      },
      include: { user: { select: carrierSelect } },
      orderBy: { departureDate: 'asc' },
      take: 20,
    });
    return trips.map((t) => this.toRecord(t));
  }

  private buildSearchWhere(filter: SearchTripsFilter): Prisma.TripWhereInput {
    const where: Prisma.TripWhereInput = { status: 'ACTIVE' };

    if (filter.departureDateFrom || filter.departureDateTo) {
      where.departureDate = {
        ...(filter.departureDateFrom ? { gte: filter.departureDateFrom } : {}),
        ...(filter.departureDateTo ? { lte: filter.departureDateTo } : {}),
      };
    } else {
      where.departureDate = { gt: new Date() };
    }

    if (filter.originCity) {
      where.originCity = { contains: filter.originCity, mode: 'insensitive' };
    }
    if (filter.originCountry) where.originCountry = filter.originCountry;
    if (filter.destinationCity) {
      where.destinationCity = { contains: filter.destinationCity, mode: 'insensitive' };
    }
    if (filter.destinationCountry) where.destinationCountry = filter.destinationCountry;
    if (filter.minWeight) where.availableWeight = { gte: filter.minWeight };
    if (filter.maxPrice) where.basePricePerKg = { lte: filter.maxPrice };

    const cargoFilters = filter.cargoTypes?.length
      ? filter.cargoTypes
      : filter.cargoType
        ? [filter.cargoType]
        : [];
    if (cargoFilters.length === 1) {
      const cargo = cargoFilters[0];
      if (cargo) where.acceptedCargoTypes = { has: cargo };
    } else if (cargoFilters.length > 1) {
      where.acceptedCargoTypes = { hasSome: [...cargoFilters] };
    }

    return where;
  }

  private paginate(page?: number, limit?: number) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    return {
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      page: safePage,
      limit: safeLimit,
    };
  }

  private toRecord(
    trip: Trip & {
      user?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
        rating: number;
        kycLevel: string;
        totalTrips?: number;
      };
      shipments?: Array<{
        id: string;
        trackingCode: string;
        cargoType: string;
        weight: number;
        status: string;
      }>;
    },
  ): TripRecord {
    return {
      id: trip.id,
      userId: trip.userId,
      originCity: trip.originCity,
      originCountry: trip.originCountry,
      originAirport: trip.originAirport,
      destinationCity: trip.destinationCity,
      destinationCountry: trip.destinationCountry,
      destinationAirport: trip.destinationAirport,
      departureDate: trip.departureDate,
      arrivalDate: trip.arrivalDate,
      flightNumber: trip.flightNumber,
      availableWeight: trip.availableWeight,
      maxWeight: trip.maxWeight,
      availableVolume: trip.availableVolume,
      acceptedCargoTypes: trip.acceptedCargoTypes,
      restrictions: trip.restrictions,
      notes: trip.notes,
      basePricePerKg: trip.basePricePerKg,
      currency: trip.currency,
      status: trip.status,
      isVerified: trip.isVerified,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      ...(trip.user ? { user: trip.user } : {}),
      ...(trip.shipments ? { shipments: trip.shipments } : {}),
    };
  }
}
