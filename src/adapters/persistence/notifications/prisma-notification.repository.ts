import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type {
  CreateNotificationInput,
  NotificationRecord,
  NotificationRepositoryPort,
} from '../../../domain/notifications/notification.repository.port.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as Prisma.InputJsonValue,
      },
    });
    return this.toRecord(row);
  }

  async listByUser(userId: string, page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data: data.map((r) => this.toRecord(r)), total, unreadCount };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationRecord> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) throw new Error('Notification not found');

    const row = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    return this.toRecord(row);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) throw new Error('Notification not found');
    await this.prisma.notification.delete({ where: { id: notificationId } });
  }

  private toRecord(row: {
    id: string;
    userId: string;
    type: NotificationRecord['type'];
    title: string;
    body: string;
    data: unknown;
    isRead: boolean;
    readAt: Date | null;
    sentAt: Date | null;
    createdAt: Date;
  }): NotificationRecord {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data,
      isRead: row.isRead,
      readAt: row.readAt,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    };
  }
}
