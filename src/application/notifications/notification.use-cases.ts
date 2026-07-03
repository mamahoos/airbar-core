import { Inject, Injectable } from '@nestjs/common';

import {
  NOTIFICATION_REPOSITORY,
  type CreateNotificationInput,
  type NotificationRepositoryPort,
} from '../../domain/notifications/notification.repository.port.js';
import { PUSH_NOTIFICATION_SENDER } from '../../domain/notifications/push-notification.sender.port.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';

import type { PushNotificationSenderPort } from '../../domain/notifications/push-notification.sender.port.js';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
    @Inject(PUSH_NOTIFICATION_SENDER) private readonly push: PushNotificationSenderPort,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.notifications.create(input);
    if (input.type === 'PUSH') {
      await this.push
        .send(input.userId, input.title, input.body, input.data)
        .catch(() => undefined);
    }
    return notification;
  }

  async notifyNewMatch(senderId: string, shipmentId: string, tripId: string) {
    return this.create({
      userId: senderId,
      type: 'PUSH',
      title: 'مسافر جدید پیدا شد',
      body: 'یک مسافر برای مرسوله شما پیدا شد',
      data: { shipmentId, tripId, type: 'NEW_MATCH' },
    });
  }

  async notifyShipmentAccepted(carrierId: string, shipmentId: string) {
    return this.create({
      userId: carrierId,
      type: 'PUSH',
      title: 'پیشنهاد پذیرفته شد',
      body: 'فرستنده پیشنهاد شما را پذیرفت',
      data: { shipmentId, type: 'SHIPMENT_ACCEPTED' },
    });
  }

  async notifyDisputeOpened(counterpartId: string, shipmentId: string) {
    return this.create({
      userId: counterpartId,
      type: 'PUSH',
      title: 'اختلاف جدید',
      body: 'طرف مقابل برای این مرسوله اختلاف ثبت کرد',
      data: { shipmentId, type: 'DISPUTE_OPENED' },
    });
  }

  async notifyDisputeResolved(
    userId: string,
    shipmentId: string,
    resolution: string,
    status: string,
  ) {
    return this.create({
      userId,
      type: 'PUSH',
      title: 'اختلاف حل شد',
      body: `نتیجه اختلاف: ${resolution}`,
      data: { shipmentId, type: 'DISPUTE_RESOLVED', status, resolution },
    });
  }

  async notifyDisputeResolvedToParties(
    parties: { readonly senderId: string; readonly carrierId: string | null },
    shipmentId: string,
    resolution: string,
    status: string,
  ): Promise<void> {
    await this.notifyDisputeResolved(parties.senderId, shipmentId, resolution, status);
    if (parties.carrierId) {
      await this.notifyDisputeResolved(parties.carrierId, shipmentId, resolution, status);
    }
  }

  async notifyPaymentSecured(
    parties: { readonly senderId: string; readonly carrierId: string | null },
    shipmentId: string,
  ): Promise<void> {
    await this.create({
      userId: parties.senderId,
      type: 'PUSH',
      title: 'پرداخت تأیید شد',
      body: 'پرداخت مرسوله با موفقیت انجام شد',
      data: { shipmentId, type: 'PAYMENT_SECURED' },
    });
    if (parties.carrierId) {
      await this.create({
        userId: parties.carrierId,
        type: 'PUSH',
        title: 'پرداخت تأیید شد',
        body: 'فرستنده مرسوله را پرداخت کرد',
        data: { shipmentId, type: 'PAYMENT_SECURED' },
      });
    }
  }

  async notifyKycUpgraded(userId: string, kycLevel: string) {
    return this.create({
      userId,
      type: 'PUSH',
      title: 'ارتقای سطح احراز هویت',
      body: `سطح احراز هویت شما به ${kycLevel} ارتقا یافت`,
      data: { type: 'KYC_UPGRADED', kycLevel },
    });
  }

  async notifyWithdrawalStatus(userId: string, withdrawalId: string, status: string) {
    const titles: Record<string, string> = {
      APPROVED: 'برداشت تأیید شد',
      SENT: 'برداشت ارسال شد',
      SETTLED: 'برداشت تکمیل شد',
      FAILED: 'برداشت ناموفق',
      REJECTED: 'برداشت رد شد',
      PROCESSED: 'برداشت در حال پردازش',
    };
    const bodies: Record<string, string> = {
      APPROVED: 'درخواست برداشت شما توسط پشتیبانی تأیید شد',
      SENT: 'مبلغ برداشت به بانک ارسال شد',
      SETTLED: 'برداشت با موفقیت به حساب شما واریز شد',
      FAILED: 'برداشت انجام نشد؛ موجودی به کیف پول بازگشت',
      REJECTED: 'درخواست برداشت شما رد شد',
      PROCESSED: 'برداشت شما در حال پردازش است',
    };
    return this.create({
      userId,
      type: 'PUSH',
      title: titles[status] ?? 'وضعیت برداشت',
      body: bodies[status] ?? status,
      data: { withdrawalId, type: 'WITHDRAWAL_STATUS', status },
    });
  }

  async notifyEscrowReleased(
    parties: { readonly senderId: string; readonly carrierId: string | null },
    shipmentId: string,
  ): Promise<void> {
    if (parties.carrierId) {
      await this.create({
        userId: parties.carrierId,
        type: 'PUSH',
        title: 'وجه آزاد شد',
        body: 'درآمد مرسوله به کیف پول شما واریز شد',
        data: { shipmentId, type: 'ESCROW_RELEASED' },
      });
    }
    await this.create({
      userId: parties.senderId,
      type: 'PUSH',
      title: 'مرسوله تکمیل شد',
      body: 'وجه امانی مرسوله آزاد شد',
      data: { shipmentId, type: 'ESCROW_RELEASED' },
    });
  }

  async notifyEscrowRefunded(userId: string, shipmentId: string) {
    return this.create({
      userId,
      type: 'PUSH',
      title: 'بازپرداخت انجام شد',
      body: 'مبلغ مرسوله به کیف پول شما بازگشت',
      data: { shipmentId, type: 'ESCROW_REFUNDED' },
    });
  }

  async notifyReviewReceived(userId: string, shipmentId: string, rating: number) {
    return this.create({
      userId,
      type: 'PUSH',
      title: 'نظر جدید',
      body: `یک نظر ${rating} ستاره برای شما ثبت شد`,
      data: { shipmentId, type: 'REVIEW_RECEIVED', rating: String(rating) },
    });
  }
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
  ) {}

  async execute(userId: string, page?: number, limit?: number) {
    const { page: p, limit: l } = normalizePagination({ page, limit });
    const { data, total, unreadCount } = await this.notifications.listByUser(userId, p, l);
    return {
      data,
      pagination: buildPaginationMeta(total, p, l),
      unreadCount,
    };
  }
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
  ) {}

  async execute(userId: string, notificationId: string) {
    try {
      return await this.notifications.markRead(userId, notificationId);
    } catch {
      throw new NotFoundError('Notification', notificationId);
    }
  }
}

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
  ) {}

  async execute(userId: string) {
    await this.notifications.markAllRead(userId);
    return { success: true };
  }
}

@Injectable()
export class DeleteNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
  ) {}

  async execute(userId: string, notificationId: string) {
    try {
      await this.notifications.delete(userId, notificationId);
    } catch {
      throw new NotFoundError('Notification', notificationId);
    }
    return { success: true };
  }
}
