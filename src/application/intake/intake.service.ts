import { Inject, Injectable, Logger } from '@nestjs/common';
import { CargoType, DraftType, Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';

import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { CreateShipmentUseCase } from '../marketplace/shipment.use-cases.js';
import { CreateTripUseCase } from '../marketplace/trip.use-cases.js';

import type { CreateDraftDto } from '../../adapters/web/intake/dto/intake.dto.js';
import type { AppConfig } from '../../bootstrap/config/index.js';
import type { CreateShipmentInput } from '../../domain/marketplace/shipment.repository.port.js';
import type { CreateTripInput } from '../../domain/marketplace/trip.repository.port.js';

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
    private readonly createTrip: CreateTripUseCase,
    private readonly createShipment: CreateShipmentUseCase,
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

    if (draft.status === 'CLAIMED') return this.claimedResponse(draft);
    if (draft.status === 'PROCESSING')
      throw new ValidationError('This draft is already being claimed');
    if (draft.status === 'EXPIRED' || (draft.expiresAt && draft.expiresAt < new Date())) {
      if (draft.status !== 'EXPIRED') {
        await this.prisma.draftRequest.update({
          where: { id: draft.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new ValidationError('This draft has expired');
    }

    const reserved = await this.prisma.draftRequest.updateMany({
      where: { id: draft.id, status: 'NEW' },
      data: {
        status: 'PROCESSING',
        claimedById: userId,
        claimedAt: new Date(),
      },
    });
    if (reserved.count !== 1) {
      const latest = await this.prisma.draftRequest.findUnique({ where: { id: draft.id } });
      if (latest?.status === 'CLAIMED') return this.claimedResponse(latest);
      throw new ValidationError('This draft is already being claimed');
    }

    try {
      if (draft.type === DraftType.TRIP) {
        const trip = await this.createTrip.execute(userId, this.toCreateTripInput(draft.payload));
        await this.prisma.draftRequest.update({
          where: { id: draft.id },
          data: {
            status: 'CLAIMED',
            claimedTripId: trip.id,
          },
        });
        return { type: 'TRIP', tripId: trip.id };
      }

      const shipment = await this.createShipment.execute(
        userId,
        this.toCreateShipmentInput(draft.payload),
      );
      await this.prisma.draftRequest.update({
        where: { id: draft.id },
        data: {
          status: 'CLAIMED',
          claimedShipmentId: shipment.id,
        },
      });

      return { type: 'SHIPMENT', shipmentId: shipment.id };
    } catch (error) {
      await this.prisma.draftRequest.updateMany({
        where: { id: draft.id, status: 'PROCESSING' },
        data: {
          status: 'NEW',
          claimedById: null,
          claimedAt: null,
        },
      });
      throw error;
    }
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

  private buildPayload(type: DraftType, dto: CreateDraftDto): Prisma.InputJsonObject {
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
        receiverContact: this.toInputJsonObject(dto.receiverContact),
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

  private claimedResponse(draft: {
    type: DraftType;
    claimedTripId: string | null;
    claimedShipmentId: string | null;
  }) {
    return {
      alreadyClaimed: true,
      type: draft.type,
      tripId: draft.claimedTripId,
      shipmentId: draft.claimedShipmentId,
    };
  }

  private toCreateTripInput(rawPayload: Prisma.JsonValue): CreateTripInput {
    const payload = this.asPayload(rawPayload);
    const departureDate =
      this.optionalDate(payload.departureDate) ?? new Date(Date.now() + 7 * 86_400_000);
    const arrivalDate = this.optionalDate(payload.arrivalDate);
    const flightNumber = this.optionalString(payload.flightNumber);
    const notes = this.optionalString(payload.notes);

    return {
      originCity: this.requiredString(payload.originCity, 'originCity'),
      originCountry: this.requiredString(payload.originCountry, 'originCountry'),
      destinationCity: this.requiredString(payload.destinationCity, 'destinationCity'),
      destinationCountry: this.requiredString(payload.destinationCountry, 'destinationCountry'),
      departureDate,
      ...(arrivalDate ? { arrivalDate } : {}),
      ...(flightNumber ? { flightNumber } : {}),
      availableWeight: this.positiveNumber(payload.availableWeight, 5),
      maxWeight: this.positiveNumber(payload.maxWeight, 5),
      acceptedCargoTypes: this.cargoArray(payload.acceptedCargoTypes),
      basePricePerKg: this.positiveNumber(payload.basePricePerKg, 50_000),
      ...(notes ? { notes } : {}),
      currency: 'IRR',
    };
  }

  private toCreateShipmentInput(
    rawPayload: Prisma.JsonValue,
  ): Omit<CreateShipmentInput, 'systemPrice'> {
    const payload = this.asPayload(rawPayload);

    return {
      originCity: this.requiredString(payload.originCity, 'originCity'),
      originCountry: this.requiredString(payload.originCountry, 'originCountry'),
      destinationCity: this.requiredString(payload.destinationCity, 'destinationCity'),
      destinationCountry: this.requiredString(payload.destinationCountry, 'destinationCountry'),
      cargoType: this.cargoValue(payload.cargoType),
      description: this.optionalString(payload.description) ?? 'درخواست ارسال از تلگرام',
      weight: this.positiveNumber(payload.weight, 1),
      photos: this.stringArray(payload.photos),
      receiverContact: this.receiverContact(payload.receiverContact),
      currency: 'IRR',
    };
  }

  private asPayload(rawPayload: Prisma.JsonValue): Record<string, unknown> {
    if (!rawPayload || Array.isArray(rawPayload) || typeof rawPayload !== 'object') {
      throw new ValidationError('Draft payload is invalid');
    }
    return rawPayload;
  }

  private requiredString(value: unknown, field: string): string {
    const normalized = this.optionalString(value);
    if (!normalized) throw new ValidationError(`Draft payload is missing ${field}`);
    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return undefined;
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
  }

  private optionalDate(value: unknown): Date | undefined {
    const raw = this.optionalString(value);
    if (!raw) return undefined;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) throw new ValidationError('Draft payload has invalid date');
    return date;
  }

  private cargoValue(value: unknown): CargoType {
    return typeof value === 'string' && value in CargoType ? (value as CargoType) : CargoType.OTHER;
  }

  private cargoArray(value: unknown): CargoType[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CargoType => typeof item === 'string' && item in CargoType);
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  }

  private receiverContact(value: unknown): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new ValidationError('Receiver contact is required to claim shipment draft');
    }
    const contact = value as Record<string, unknown>;
    const name = this.optionalString(contact.name);
    const phone = this.optionalString(contact.phone);
    if (!name || !phone) {
      throw new ValidationError('Receiver contact must include name and phone');
    }
    return { ...contact, name, phone };
  }

  private toInputJsonObject(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonObject | null {
    if (!value) return null;
    const json: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, raw] of Object.entries(value)) {
      const converted = this.toInputJsonValue(raw);
      if (converted !== undefined) json[key] = converted;
    }
    return json;
  }

  private toInputJsonValue(value: unknown): Prisma.InputJsonValue | null | undefined {
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toInputJsonValue(item))
        .filter((item): item is Prisma.InputJsonValue | null => item !== undefined);
    }
    if (typeof value === 'object') {
      return this.toInputJsonObject(value as Record<string, unknown>);
    }
    return undefined;
  }
}
