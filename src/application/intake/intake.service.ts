import { randomBytes } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { CargoType, DraftType, Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';

import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { PricingQuoteService } from '../marketplace/pricing-quote.service.js';
import { MarketStatsService } from '../stats/market-stats.service.js';

import type { CreateDraftDto } from '../../adapters/web/intake/dto/intake.dto.js';
import type { AppConfig } from '../../bootstrap/config/index.js';

const DEFAULT_EXPIRY_DAYS = 14;

const CITY_COUNTRY: Record<string, string> = {
  تهران: 'ایران',
  مشهد: 'ایران',
  استانبول: 'ترکیه',
  دبی: 'امارات',
};

const CARGO_MAP: Record<string, CargoType> = {
  documents: CargoType.DOCUMENTS,
  electronics: CargoType.ELECTRONICS,
  clothing: CargoType.CLOTHING,
  food: CargoType.FOOD,
  medicine: CargoType.MEDICINE,
};

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingQuoteService,
    private readonly marketStats: MarketStatsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async createDraft(dto: CreateDraftDto) {
    const input = this.applyTestOverrides(dto);
    const type = this.resolveType(input.requestType);
    const payload = this.buildPayload(type, input);
    const previewToken = nanoid(16);
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const draft = await this.prisma.draftRequest.create({
      data: {
        previewToken,
        type,
        status: 'NEW',
        source: 'TELEGRAM',
        payload: payload,
        rawPayload: input.rawPayload ? (input.rawPayload as Prisma.InputJsonValue) : Prisma.DbNull,
        confidence: input.confidence ?? null,
        telegramChatId: input.telegram?.chatId ?? null,
        telegramUserId: input.telegram?.userId ?? null,
        telegramUsername: input.telegram?.username ?? null,
        telegramMessageId: input.telegram?.messageId ?? null,
        sourceChannel: input.telegram?.channel ?? null,
        expiresAt,
      },
    });

    const previewUrl = `${this.publicBaseUrl()}/claim/${previewToken}`;
    this.logger.log(`Draft ${draft.id} created — claim at ${previewUrl}`);

    return { id: draft.id, previewToken, previewUrl, type, notified: false };
  }

  async getByToken(token: string) {
    const draft = await this.prisma.draftRequest.findUnique({ where: { previewToken: token } });
    if (!draft) throw new NotFoundError('Draft', token);

    return {
      previewToken: draft.previewToken,
      type: draft.type,
      status: draft.status,
      source: draft.source,
      payload: draft.payload,
      confidence: draft.confidence,
      sourceChannel: draft.sourceChannel,
      claimed: draft.status === 'CLAIMED',
      claimedTripId: draft.claimedTripId,
      claimedShipmentId: draft.claimedShipmentId,
      expiresAt: draft.expiresAt,
      createdAt: draft.createdAt,
    };
  }

  async claim(token: string, userId: string) {
    const draft = await this.prisma.draftRequest.findUnique({ where: { previewToken: token } });
    if (!draft) throw new NotFoundError('Draft', token);

    if (draft.status === 'CLAIMED') {
      return {
        alreadyClaimed: true,
        type: draft.type,
        tripId: draft.claimedTripId,
        shipmentId: draft.claimedShipmentId,
      };
    }
    if (draft.status === 'EXPIRED' || (draft.expiresAt && draft.expiresAt < new Date())) {
      throw new ValidationError('This draft has expired');
    }

    const payload = draft.payload as Record<string, unknown>;
    const str = (value: unknown, fallback = ''): string =>
      typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

    if (draft.type === DraftType.TRIP) {
      const trip = await this.prisma.trip.create({
        data: {
          userId,
          originCity: str(payload.originCity),
          originCountry: str(payload.originCountry),
          destinationCity: str(payload.destinationCity),
          destinationCountry: str(payload.destinationCountry),
          departureDate: str(payload.departureDate)
            ? new Date(str(payload.departureDate))
            : new Date(Date.now() + 7 * 86_400_000),
          flightNumber: str(payload.flightNumber) || null,
          availableWeight: Number(payload.availableWeight ?? 5),
          maxWeight: Number(payload.maxWeight ?? 5),
          acceptedCargoTypes: (payload.acceptedCargoTypes as CargoType[]) ?? [],
          basePricePerKg: Number(payload.basePricePerKg ?? 50_000),
          notes: str(payload.notes) || null,
          currency: 'IRR',
          status: 'DRAFT',
        },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { totalTrips: { increment: 1 } },
      });

      await this.prisma.draftRequest.update({
        where: { id: draft.id },
        data: {
          status: 'CLAIMED',
          claimedById: userId,
          claimedTripId: trip.id,
          claimedAt: new Date(),
        },
      });

      return { type: 'TRIP', tripId: trip.id };
    }

    const cargoType = (payload.cargoType as CargoType) ?? CargoType.OTHER;
    const weight = Number(payload.weight ?? 1);
    const systemPrice = await this.pricing.calculatePrice({
      originCountry: String(payload.originCountry),
      destinationCountry: String(payload.destinationCountry),
      cargoType,
      weight,
    });
    const trackingCode = `AB${randomBytes(6).toString('hex').toUpperCase()}`;

    const shipment = await this.prisma.shipment.create({
      data: {
        trackingCode,
        senderId: userId,
        originCity: str(payload.originCity),
        originCountry: str(payload.originCountry),
        destinationCity: str(payload.destinationCity),
        destinationCountry: str(payload.destinationCountry),
        cargoType,
        description: str(payload.description, 'درخواست ارسال از تلگرام'),
        weight,
        photos: [],
        receiverContact: { name: '', phone: '' },
        systemPrice,
        currency: 'IRR',
        status: 'PENDING',
        trackingHistory: [
          {
            status: 'PENDING',
            timestamp: new Date().toISOString(),
            description: 'درخواست ارسال از تلگرام ثبت شد',
          },
        ],
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { totalShipments: { increment: 1 } },
    });

    await this.marketStats.recordShipmentDemand({
      originCity: shipment.originCity,
      destinationCity: shipment.destinationCity,
      cargoType: shipment.cargoType,
      weight: shipment.weight,
    });

    await this.prisma.draftRequest.update({
      where: { id: draft.id },
      data: {
        status: 'CLAIMED',
        claimedById: userId,
        claimedShipmentId: shipment.id,
        claimedAt: new Date(),
      },
    });

    return { type: 'SHIPMENT', shipmentId: shipment.id };
  }

  async getStats() {
    const [total, byStatus, byType, claimed] = await Promise.all([
      this.prisma.draftRequest.count(),
      this.prisma.draftRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.draftRequest.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.draftRequest.count({ where: { status: 'CLAIMED' } }),
    ]);
    return {
      total,
      claimed,
      conversionRate: total > 0 ? Number(((claimed / total) * 100).toFixed(1)) : 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
    };
  }

  private publicBaseUrl(): string {
    return this.config.publicWebUrl ?? this.config.frontendUrl;
  }

  private applyTestOverrides(dto: CreateDraftDto): CreateDraftDto {
    if (!this.config.intakeTestMode) return dto;
    const testChatId = this.config.intakeTestTelegramChatId ?? '135163496';
    return {
      ...dto,
      telegram: { ...(dto.telegram ?? {}), chatId: testChatId, userId: testChatId },
    };
  }

  private resolveType(requestType: string): DraftType {
    const t = requestType.toLowerCase();
    if (t.includes('cargo_owner') || t === 'cargo' || t.includes('sender')) {
      return DraftType.SHIPMENT;
    }
    return DraftType.TRIP;
  }

  private guessCountry(city: string, fallback?: string): string {
    return fallback ?? CITY_COUNTRY[city.trim()] ?? 'نامشخص';
  }

  private resolveCargo(raw?: string): CargoType {
    if (!raw) return CargoType.OTHER;
    return CARGO_MAP[raw.trim().toLowerCase()] ?? CargoType.OTHER;
  }

  private buildPayload(type: DraftType, dto: CreateDraftDto) {
    const originCountry = this.guessCountry(dto.originCity, dto.originCountry);
    const destinationCountry = this.guessCountry(dto.destinationCity, dto.destinationCountry);

    if (type === DraftType.SHIPMENT) {
      return {
        originCity: dto.originCity,
        originCountry,
        destinationCity: dto.destinationCity,
        destinationCountry,
        cargoType: this.resolveCargo(dto.cargoType),
        description: dto.description ?? 'درخواست ارسال از تلگرام',
        weight: dto.weight && dto.weight > 0 ? dto.weight : 1,
        currency: 'IRR',
      };
    }

    return {
      originCity: dto.originCity,
      originCountry,
      destinationCity: dto.destinationCity,
      destinationCountry,
      departureDate: dto.flightDate ?? null,
      flightNumber: dto.flightNumber ?? null,
      availableWeight: dto.weight && dto.weight > 0 ? dto.weight : 5,
      maxWeight: dto.weight && dto.weight > 0 ? dto.weight : 5,
      acceptedCargoTypes: dto.cargoType ? [this.resolveCargo(dto.cargoType)] : [],
      basePricePerKg: dto.pricePerKg && dto.pricePerKg > 0 ? dto.pricePerKg : 50_000,
      notes: dto.description ?? 'سفر ثبت‌شده از تلگرام',
      currency: 'IRR',
    };
  }
}
