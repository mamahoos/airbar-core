import { Inject, Injectable } from '@nestjs/common';

import {
  REVIEW_REPOSITORY,
  type CreateReviewInput,
  type ReviewRepositoryPort,
} from '../../domain/marketplace/review.repository.port.js';
import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepositoryPort,
} from '../../domain/marketplace/shipment.repository.port.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';
import { NotificationService } from '../notifications/notification.use-cases.js';

export interface SubmitReviewInput {
  readonly rating: number;
  readonly comment?: string | undefined;
  readonly communication?: number | undefined;
  readonly punctuality?: number | undefined;
  readonly packaging?: number | undefined;
  readonly overall?: number | undefined;
}

@Injectable()
export class SubmitReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    private readonly notifications: NotificationService,
  ) {}

  async execute(userId: string, shipmentId: string, input: SubmitReviewInput) {
    const shipment = await this.shipments.findById(shipmentId, userId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);

    if (shipment.status !== ShipmentStatus.CONFIRMED) {
      throw new ValidationError('ثبت نظر فقط پس از تکمیل و تأیید مرسوله ممکن است');
    }

    const isSender = shipment.senderId === userId;
    const isCarrier = shipment.carrierId === userId;
    if (!isSender && !isCarrier) {
      throw new ForbiddenError('فقط طرفین مرسوله می‌توانند نظر ثبت کنند');
    }

    const targetId = isSender ? shipment.carrierId : shipment.senderId;
    if (!targetId) {
      throw new ValidationError('طرف مقابل برای ثبت نظر مشخص نیست');
    }

    const existing = await this.reviews.findByShipmentAndAuthor(shipmentId, userId);
    if (existing) {
      throw new ConflictError('برای این مرسوله قبلاً نظر ثبت کرده‌اید');
    }

    const payload: CreateReviewInput = {
      shipmentId,
      authorId: userId,
      targetId,
      rating: input.rating,
      comment: input.comment ?? null,
      communication: input.communication ?? null,
      punctuality: input.punctuality ?? null,
      packaging: input.packaging ?? null,
      overall: input.overall ?? null,
    };

    const { review, aggregate } = await this.reviews.createAndRecomputeRating(payload);
    await this.notifications.notifyReviewReceived(targetId, shipmentId, input.rating);
    return {
      review,
      targetRating: aggregate,
    };
  }
}

@Injectable()
export class ListUserReviewsUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort) {}

  async execute(targetId: string, page?: number, limit?: number) {
    const { page: p, limit: l } = normalizePagination({ page, limit });
    const { data, total, aggregate } = await this.reviews.listByTarget(targetId, p, l);
    return {
      data,
      aggregate,
      pagination: buildPaginationMeta(total, p, l),
    };
  }
}

@Injectable()
export class ListShipmentReviewsUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
  ) {}

  async execute(userId: string, shipmentId: string) {
    const shipment = await this.shipments.findById(shipmentId, userId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);

    const isParticipant = shipment.senderId === userId || shipment.carrierId === userId;
    if (!isParticipant) {
      throw new ForbiddenError('فقط طرفین مرسوله می‌توانند نظرات را ببینند');
    }

    return this.reviews.listByShipment(shipmentId);
  }
}
