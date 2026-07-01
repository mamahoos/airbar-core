import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type { CargoType } from '../../../domain/marketplace/pricing-calculator.js';
import type { ShipmentStatus } from '../../../domain/marketplace/shipment-state-machine.js';
import type {
  CreateShipmentInput,
  PublicTrackingRecord,
  ShipmentRecord,
  ShipmentRepositoryPort,
  UpdateShipmentInput,
  UpdateShipmentStatusInput,
} from '../../../domain/marketplace/shipment.repository.port.js';
import type { Prisma, Shipment } from '@prisma/client';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  rating: true,
  kycLevel: true,
} as const;

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    senderId: string,
    trackingCode: string,
    input: CreateShipmentInput,
  ): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.create({
      data: {
        trackingCode,
        senderId,
        originCity: input.originCity,
        originCountry: input.originCountry,
        originAddress: input.originAddress ?? null,
        originLocation: input.originLocation as Prisma.InputJsonValue,
        destinationCity: input.destinationCity,
        destinationCountry: input.destinationCountry,
        destinationAddress: input.destinationAddress ?? null,
        destinationLocation: input.destinationLocation as Prisma.InputJsonValue,
        cargoType: input.cargoType,
        description: input.description,
        weight: input.weight,
        dimensions: input.dimensions as Prisma.InputJsonValue,
        declaredValue: input.declaredValue ?? null,
        photos: input.photos ? [...input.photos] : [],
        senderContact: input.senderContact as Prisma.InputJsonValue,
        receiverContact: input.receiverContact as Prisma.InputJsonValue,
        systemPrice: input.systemPrice,
        currency: input.currency ?? 'IRR',
        status: 'PENDING',
        trackingHistory: [
          {
            status: 'PENDING',
            timestamp: new Date().toISOString(),
            description: 'درخواست ارسال ثبت شد',
          },
        ],
      },
      include: { sender: { select: userSelect } },
    });
    return this.toRecord(shipment);
  }

  async findById(id: string, viewerId?: string): Promise<ShipmentRecord | null> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            ...userSelect,
            phone: viewerId ? true : false,
          },
        },
        carrier: {
          select: {
            ...userSelect,
            phone: viewerId ? true : false,
          },
        },
        trip: {
          select: {
            id: true,
            departureDate: true,
            arrivalDate: true,
            flightNumber: true,
          },
        },
      },
    });
    return shipment ? this.toRecord(shipment) : null;
  }

  async findByTrackingCode(trackingCode: string): Promise<PublicTrackingRecord | null> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingCode },
      select: {
        id: true,
        trackingCode: true,
        status: true,
        cargoType: true,
        originCity: true,
        originCountry: true,
        destinationCity: true,
        destinationCountry: true,
        currentLocation: true,
        trackingHistory: true,
        pickedUpAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    });
    if (!shipment) return null;
    return {
      ...shipment,
      status: shipment.status as ShipmentStatus,
      trackingHistory:
        shipment.trackingHistory as unknown as PublicTrackingRecord['trackingHistory'],
    };
  }

  async update(shipmentId: string, input: UpdateShipmentInput): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        ...(input.originCity !== undefined ? { originCity: input.originCity } : {}),
        ...(input.originCountry !== undefined ? { originCountry: input.originCountry } : {}),
        ...(input.originAddress !== undefined ? { originAddress: input.originAddress } : {}),
        ...(input.originLocation !== undefined
          ? { originLocation: input.originLocation as Prisma.InputJsonValue }
          : {}),
        ...(input.destinationCity !== undefined ? { destinationCity: input.destinationCity } : {}),
        ...(input.destinationCountry !== undefined
          ? { destinationCountry: input.destinationCountry }
          : {}),
        ...(input.destinationAddress !== undefined
          ? { destinationAddress: input.destinationAddress }
          : {}),
        ...(input.destinationLocation !== undefined
          ? { destinationLocation: input.destinationLocation as Prisma.InputJsonValue }
          : {}),
        ...(input.cargoType !== undefined ? { cargoType: input.cargoType } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
        ...(input.dimensions !== undefined
          ? { dimensions: input.dimensions as Prisma.InputJsonValue }
          : {}),
        ...(input.declaredValue !== undefined ? { declaredValue: input.declaredValue } : {}),
        ...(input.photos !== undefined ? { photos: [...input.photos] } : {}),
        ...(input.senderContact !== undefined
          ? { senderContact: input.senderContact as Prisma.InputJsonValue }
          : {}),
        ...(input.receiverContact !== undefined
          ? { receiverContact: input.receiverContact as Prisma.InputJsonValue }
          : {}),
        ...(input.systemPrice !== undefined ? { systemPrice: input.systemPrice } : {}),
      },
      include: { sender: { select: userSelect } },
    });
    return this.toRecord(shipment);
  }

  async updateStatus(
    shipmentId: string,
    input: UpdateShipmentStatusInput,
  ): Promise<ShipmentRecord> {
    const existing = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!existing) throw new Error('Shipment not found');

    const history = [
      ...(existing.trackingHistory as object[]),
      {
        status: input.status,
        timestamp: new Date().toISOString(),
        description: input.note ?? statusDescription(input.status),
        ...(input.location ? { location: input.location } : {}),
      },
    ];

    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: input.status,
        trackingHistory: history,
        ...(input.location ? { currentLocation: input.location } : {}),
        ...(input.pickedUpAt ? { pickedUpAt: input.pickedUpAt } : {}),
        ...(input.deliveredAt ? { deliveredAt: input.deliveredAt } : {}),
        ...(input.confirmedAt ? { confirmedAt: input.confirmedAt } : {}),
      },
      include: {
        sender: { select: userSelect },
        carrier: { select: userSelect },
        trip: {
          select: {
            id: true,
            departureDate: true,
            arrivalDate: true,
            flightNumber: true,
          },
        },
      },
    });
    return this.toRecord(shipment);
  }

  async assignToTrip(
    shipmentId: string,
    tripId: string,
    carrierId: string,
  ): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        tripId,
        carrierId,
        status: 'MATCHED',
        trackingHistory: {
          push: {
            status: 'MATCHED',
            timestamp: new Date().toISOString(),
            description: 'با یک مسافر مچ شد',
          },
        },
      },
      include: { sender: { select: userSelect }, carrier: { select: userSelect } },
    });
    return this.toRecord(shipment);
  }

  async acceptOffer(shipmentId: string, agreedPrice: number): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'ACCEPTED',
        agreedPrice,
        trackingHistory: {
          push: {
            status: 'ACCEPTED',
            timestamp: new Date().toISOString(),
            description: 'پیشنهاد پذیرفته شد',
          },
        },
      },
      include: { sender: { select: userSelect }, carrier: { select: userSelect } },
    });
    return this.toRecord(shipment);
  }

  async rejectOffer(shipmentId: string): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'PENDING',
        tripId: null,
        carrierId: null,
        trackingHistory: {
          push: {
            status: 'PENDING',
            timestamp: new Date().toISOString(),
            description: 'پیشنهاد رد شد، در انتظار مسافر جدید',
          },
        },
      },
      include: { sender: { select: userSelect } },
    });
    return this.toRecord(shipment);
  }

  async cancel(shipmentId: string): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'CANCELLED',
        tripId: null,
        carrierId: null,
        trackingHistory: {
          push: {
            status: 'CANCELLED',
            timestamp: new Date().toISOString(),
            description: 'درخواست توسط فرستنده لغو شد',
          },
        },
      },
      include: { sender: { select: userSelect } },
    });
    return this.toRecord(shipment);
  }

  async openDispute(shipmentId: string, userId: string, reason: string): Promise<ShipmentRecord> {
    const shipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'DISPUTED',
        disputeReason: reason,
        disputedAt: new Date(),
        disputedById: userId,
        trackingHistory: {
          push: {
            status: 'DISPUTED',
            timestamp: new Date().toISOString(),
            description: `اختلاف ثبت شد: ${reason}`,
          },
        },
      },
      include: {
        sender: { select: userSelect },
        carrier: { select: userSelect },
      },
    });
    return this.toRecord(shipment);
  }

  async listByRole(
    userId: string,
    role: 'sender' | 'carrier',
    status?: ShipmentStatus,
    page = 1,
    limit = 20,
  ): Promise<{ data: readonly ShipmentRecord[]; total: number }> {
    const where: Prisma.ShipmentWhereInput =
      role === 'sender' ? { senderId: userId } : { carrierId: userId };
    if (status) where.status = status;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        include: {
          sender: { select: userSelect },
          carrier: { select: userSelect },
          trip: {
            select: {
              id: true,
              departureDate: true,
              arrivalDate: true,
              flightNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return { data: rows.map((r) => this.toRecord(r)), total };
  }

  async incrementUserShipmentCount(userId: string, delta: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalShipments: { increment: delta } },
    });
  }

  async findPendingMatches(input: {
    excludeUserId: string;
    originCity: string;
    originCountry: string;
    destinationCity: string;
    destinationCountry: string;
    maxWeight: number;
    cargoTypes: readonly CargoType[] | null;
  }): Promise<readonly ShipmentRecord[]> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        status: 'PENDING',
        senderId: { not: input.excludeUserId },
        originCity: { contains: input.originCity, mode: 'insensitive' },
        originCountry: input.originCountry,
        destinationCity: { contains: input.destinationCity, mode: 'insensitive' },
        destinationCountry: input.destinationCountry,
        weight: { lte: input.maxWeight },
        ...(input.cargoTypes?.length ? { cargoType: { in: [...input.cargoTypes] } } : {}),
      },
      include: { sender: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async listPending(limit: number): Promise<readonly ShipmentRecord[]> {
    const rows = await this.prisma.shipment.findMany({
      where: { status: 'PENDING' },
      take: limit,
    });
    return rows.map((r) => this.toRecord(r));
  }

  private toRecord(
    shipment: Shipment & {
      sender?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
        rating: number;
        kycLevel: string;
        phone?: string | null;
      };
      carrier?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
        rating: number;
        kycLevel: string;
        phone?: string | null;
      } | null;
      trip?: {
        id: string;
        departureDate: Date;
        arrivalDate: Date | null;
        flightNumber: string | null;
      } | null;
    },
  ): ShipmentRecord {
    return {
      id: shipment.id,
      trackingCode: shipment.trackingCode,
      senderId: shipment.senderId,
      carrierId: shipment.carrierId,
      tripId: shipment.tripId,
      originCity: shipment.originCity,
      originCountry: shipment.originCountry,
      originAddress: shipment.originAddress,
      originLocation: shipment.originLocation,
      destinationCity: shipment.destinationCity,
      destinationCountry: shipment.destinationCountry,
      destinationAddress: shipment.destinationAddress,
      destinationLocation: shipment.destinationLocation,
      cargoType: shipment.cargoType,
      description: shipment.description,
      weight: shipment.weight,
      dimensions: shipment.dimensions,
      declaredValue: shipment.declaredValue,
      photos: shipment.photos,
      senderContact: shipment.senderContact,
      receiverContact: shipment.receiverContact,
      systemPrice: shipment.systemPrice,
      agreedPrice: shipment.agreedPrice,
      currency: shipment.currency,
      status: shipment.status as ShipmentStatus,
      currentLocation: shipment.currentLocation,
      trackingHistory: shipment.trackingHistory as unknown as ShipmentRecord['trackingHistory'],
      pickedUpAt: shipment.pickedUpAt,
      deliveredAt: shipment.deliveredAt,
      confirmedAt: shipment.confirmedAt,
      disputeReason: shipment.disputeReason,
      disputedAt: shipment.disputedAt,
      disputedById: shipment.disputedById,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      ...(shipment.sender ? { sender: shipment.sender } : {}),
      ...(shipment.carrier !== undefined ? { carrier: shipment.carrier } : {}),
      ...(shipment.trip !== undefined ? { trip: shipment.trip } : {}),
    };
  }
}

function statusDescription(status: ShipmentStatus): string {
  const map: Partial<Record<ShipmentStatus, string>> = {
    PICKED_UP: 'مرسوله تحویل مسافر شد',
    IN_TRANSIT: 'مرسوله در مسیر است',
    DELIVERED: 'مرسوله تحویل گیرنده شد',
    CONFIRMED: 'تحویل توسط فرستنده تأیید شد',
  };
  return map[status] ?? status;
}
