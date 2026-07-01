import type { NotificationType } from '@prisma/client';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly data: unknown;
  readonly isRead: boolean;
  readonly readAt: Date | null;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateNotificationInput {
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly data?: unknown;
}

export interface NotificationRepositoryPort {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  listByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: readonly NotificationRecord[]; total: number; unreadCount: number }>;
  markRead(userId: string, notificationId: string): Promise<NotificationRecord>;
  markAllRead(userId: string): Promise<void>;
  delete(userId: string, notificationId: string): Promise<void>;
}
