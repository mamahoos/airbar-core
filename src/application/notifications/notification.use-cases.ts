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
