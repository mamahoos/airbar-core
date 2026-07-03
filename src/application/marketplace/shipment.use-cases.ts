import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ShipmentStatus,
  assertStatusTransition,
  canTransitionStatus,
} from '../../domain/marketplace/shipment-state-machine.js';
import {
  SHIPMENT_REPOSITORY,
  type CreateShipmentInput,
  type ShipmentRepositoryPort,
  type UpdateShipmentInput,
} from '../../domain/marketplace/shipment.repository.port.js';
import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from '../../domain/marketplace/trip.repository.port.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';
import {
  CreateChatForShipmentUseCase,
  DeactivateChatForShipmentUseCase,
} from '../chat/chat.use-cases.js';
import {
  FINANCE_ORCHESTRATOR,
  type FinanceOrchestratorPort,
} from '../finance/finance-orchestrator.port.js';
import { KycAccessService } from '../kyc/kyc-access.service.js';
import { NotificationService } from '../notifications/notification.use-cases.js';
import { MarketStatsService } from '../stats/market-stats.service.js';

import { marketplaceKycRequirement } from './marketplace-kyc-gates.js';
import { MatchingEventsService } from './matching-events.service.js';
import { PricingQuoteService } from './pricing-quote.service.js';

import type { ShipmentStatus as PrismaShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';

function trackingCode(): string {
  return `AB${randomBytes(6).toString('hex').toUpperCase()}`;
}

@Injectable()
export class CreateShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    private readonly pricing: PricingQuoteService,
    private readonly kyc: KycAccessService,
    private readonly marketStats: MarketStatsService,
    private readonly matchingEvents: MatchingEventsService,
  ) {}

  async execute(senderId: string, input: Omit<CreateShipmentInput, 'systemPrice'>) {
    await this.kyc.assertRequirement(senderId, marketplaceKycRequirement('CREATE_SHIPMENT'));

    const systemPrice = await this.pricing.calculatePrice({
      originCountry: input.originCountry,
      destinationCountry: input.destinationCountry,
      cargoType: input.cargoType,
      weight: input.weight,
    });

    const shipment = await this.shipments.create(senderId, trackingCode(), {
      ...input,
      systemPrice,
    });
    await this.shipments.incrementUserShipmentCount(senderId, 1);
    await this.marketStats.recordShipmentDemand({
      originCity: input.originCity,
      destinationCity: input.destinationCity,
      cargoType: input.cargoType,
      weight: input.weight,
    });
    await this.matchingEvents.shipmentCreated(shipment.id);
    return shipment;
  }
}

@Injectable()
export class GetShipmentUseCase {
  constructor(@Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort) {}

  async execute(shipmentId: string, viewerId: string) {
    const shipment = await this.shipments.findById(shipmentId, viewerId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    return shipment;
  }
}

@Injectable()
export class TrackShipmentUseCase {
  constructor(@Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort) {}

  async execute(trackingCodeValue: string) {
    const shipment = await this.shipments.findByTrackingCode(trackingCodeValue);
    if (!shipment) throw new NotFoundError('Shipment', trackingCodeValue);
    return shipment;
  }
}

@Injectable()
export class UpdateShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    private readonly pricing: PricingQuoteService,
  ) {}

  async execute(senderId: string, shipmentId: string, input: UpdateShipmentInput) {
    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    if (shipment.senderId !== senderId) {
      throw new ForbiddenError('You can only update your own shipments');
    }
    if (shipment.status !== ShipmentStatus.PENDING && shipment.status !== ShipmentStatus.MATCHED) {
      throw new ValidationError('Cannot update shipment in current status');
    }

    let systemPrice = shipment.systemPrice;
    if (input.weight !== undefined || input.cargoType !== undefined) {
      systemPrice = await this.pricing.calculatePrice({
        originCountry: input.originCountry ?? shipment.originCountry,
        destinationCountry: input.destinationCountry ?? shipment.destinationCountry,
        cargoType: input.cargoType ?? shipment.cargoType,
        weight: input.weight ?? shipment.weight,
      });
    }

    return this.shipments.update(shipmentId, { ...input, systemPrice });
  }
}

@Injectable()
export class CancelShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    private readonly deactivateChat: DeactivateChatForShipmentUseCase,
  ) {}

  async execute(senderId: string, shipmentId: string) {
    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    if (shipment.senderId !== senderId) {
      throw new ForbiddenError('You can only cancel your own shipments');
    }
    if (
      shipment.status !== ShipmentStatus.PENDING &&
      shipment.status !== ShipmentStatus.MATCHED &&
      shipment.status !== ShipmentStatus.ACCEPTED
    ) {
      throw new ValidationError('Cannot cancel shipment in current status');
    }

    if (
      (shipment.status === ShipmentStatus.MATCHED || shipment.status === ShipmentStatus.ACCEPTED) &&
      shipment.tripId
    ) {
      await this.trips.adjustAvailableWeight(shipment.tripId, shipment.weight);
    }

    await this.deactivateChat.execute(shipmentId);
    return this.shipments.cancel(shipmentId);
  }
}

@Injectable()
export class AcceptShipmentOfferUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    private readonly kyc: KycAccessService,
    private readonly notifications: NotificationService,
    private readonly pricing: PricingQuoteService,
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
  ) {}

  async execute(senderId: string, shipmentId: string, agreedPrice?: number) {
    await this.kyc.assertRequirement(senderId, marketplaceKycRequirement('ACCEPT_SHIPMENT_SENDER'));

    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    if (shipment.senderId !== senderId) {
      throw new ForbiddenError('You can only accept offers for your own shipments');
    }
    if (shipment.status !== ShipmentStatus.MATCHED) {
      throw new ValidationError('Shipment is not in MATCHED status');
    }

    const acceptedPrice = agreedPrice ?? shipment.systemPrice;
    if (agreedPrice !== undefined) {
      const priceFloor = Math.max(
        shipment.systemPrice,
        await this.pricing.calculateFloor({
          originCountry: shipment.originCountry,
          destinationCountry: shipment.destinationCountry,
          cargoType: shipment.cargoType,
          weight: shipment.weight,
        }),
      );
      if (acceptedPrice < priceFloor) {
        throw new ValidationError('Agreed price is below the system price floor');
      }
    }

    const updated = await this.shipments.acceptOffer(shipmentId, acceptedPrice);
    if (updated.carrierId) {
      await this.notifications.notifyShipmentAccepted(updated.carrierId, shipmentId);
      await this.finance.tryCreateEscrow({
        shipmentId,
        carrierUserId: updated.carrierId,
        payerUserId: senderId,
        amountRials: updated.agreedPrice ?? updated.systemPrice,
      });
    }
    return updated;
  }
}

@Injectable()
export class RejectShipmentOfferUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    private readonly deactivateChat: DeactivateChatForShipmentUseCase,
  ) {}

  async execute(senderId: string, shipmentId: string) {
    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    if (shipment.senderId !== senderId) {
      throw new ForbiddenError('You can only reject offers for your own shipments');
    }
    if (shipment.status !== ShipmentStatus.MATCHED) {
      throw new ValidationError('Shipment is not in MATCHED status');
    }

    if (shipment.tripId) {
      await this.trips.adjustAvailableWeight(shipment.tripId, shipment.weight);
    }

    await this.deactivateChat.execute(shipmentId);
    return this.shipments.rejectOffer(shipmentId);
  }
}

const CARRIER_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  [ShipmentStatus.PICKED_UP]: ShipmentStatus.PAID,
  [ShipmentStatus.IN_TRANSIT]: ShipmentStatus.PICKED_UP,
  [ShipmentStatus.DELIVERED]: ShipmentStatus.IN_TRANSIT,
};

@Injectable()
export class UpdateShipmentStatusUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
  ) {}

  async execute(
    userId: string,
    shipmentId: string,
    status: ShipmentStatus,
    note?: string,
    location?: unknown,
  ) {
    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);

    const isCarrier = shipment.carrierId === userId;
    const isSender = shipment.senderId === userId;
    if (!isCarrier && !isSender) throw new ForbiddenError('Not authorized');

    const actor = status === ShipmentStatus.CONFIRMED ? 'sender' : 'carrier';
    if (actor === 'sender' && !isSender)
      throw new ForbiddenError('Not authorized for this status update');
    if (actor === 'carrier' && !isCarrier) {
      throw new ForbiddenError('Not authorized for this status update');
    }

    const expectedFrom = CARRIER_TRANSITIONS[status];
    if (status === ShipmentStatus.CONFIRMED) {
      if (shipment.status !== ShipmentStatus.DELIVERED) {
        throw new ValidationError(`Cannot transition from ${shipment.status} to ${status}`);
      }
    } else if (!expectedFrom || shipment.status !== expectedFrom) {
      throw new ValidationError(`Cannot transition from ${shipment.status} to ${status}`);
    }

    if (!canTransitionStatus(shipment.status, status, actor)) {
      assertStatusTransition(shipment.status, status, actor);
    }

    const updated = await this.shipments.updateStatus(shipmentId, {
      status,
      note,
      location,
      ...(status === ShipmentStatus.PICKED_UP ? { pickedUpAt: new Date() } : {}),
      ...(status === ShipmentStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      ...(status === ShipmentStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
    });

    if (status === ShipmentStatus.DELIVERED) {
      await this.finance.tryMarkDelivered({ shipmentId });
    }
    if (status === ShipmentStatus.CONFIRMED) {
      await this.finance.tryReleaseEscrow({ shipmentId });
    }

    return updated;
  }
}

const DISPUTABLE: readonly ShipmentStatus[] = [
  ShipmentStatus.PAID,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
];

@Injectable()
export class DisputeShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
  ) {}

  async execute(userId: string, shipmentId: string, reason: string) {
    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);

    const isCarrier = shipment.carrierId === userId;
    const isSender = shipment.senderId === userId;
    if (!isCarrier && !isSender) throw new ForbiddenError('Not authorized');

    if (!DISPUTABLE.includes(shipment.status)) {
      throw new ValidationError(`Cannot open a dispute while status is ${shipment.status}`);
    }

    const disputed = await this.shipments.openDispute(shipmentId, userId, reason);
    await this.finance.tryFreezeEscrow({ shipmentId });
    return disputed;
  }
}

@Injectable()
export class ListMyShipmentsUseCase {
  constructor(@Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort) {}

  async execute(
    userId: string,
    role: 'sender' | 'carrier',
    status?: PrismaShipmentStatus,
    page?: number,
    limit?: number,
  ) {
    const { page: p, limit: l } = normalizePagination({ page, limit });
    const { data, total } = await this.shipments.listByRole(userId, role, status, p, l);
    return { data, pagination: buildPaginationMeta(total, p, l) };
  }
}

@Injectable()
export class AssignShipmentToTripUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    private readonly kyc: KycAccessService,
    private readonly createChat: CreateChatForShipmentUseCase,
    private readonly notifications: NotificationService,
  ) {}

  async execute(shipmentId: string, tripId: string, carrierId: string) {
    await this.kyc.assertRequirement(carrierId, marketplaceKycRequirement('ASSIGN_SHIPMENT'));

    const [shipment, trip] = await Promise.all([
      this.shipments.findById(shipmentId),
      this.trips.findById(tripId),
    ]);

    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    if (trip.userId !== carrierId) {
      throw new ForbiddenError('You can only assign shipments to your own trips');
    }
    if (shipment.senderId === carrierId) {
      throw new ValidationError('You cannot carry your own shipment');
    }
    if (shipment.status !== ShipmentStatus.PENDING) {
      throw new ValidationError('Only pending shipments can be assigned to a trip');
    }
    if (shipment.weight > trip.availableWeight) {
      throw new ValidationError('Shipment weight exceeds available capacity');
    }

    const updated = await this.shipments.assignToTrip(shipmentId, tripId, carrierId);
    await this.trips.adjustAvailableWeight(tripId, -shipment.weight);
    await this.createChat.execute(shipmentId);
    await this.notifications.notifyNewMatch(shipment.senderId, shipmentId, tripId);
    return updated;
  }
}
