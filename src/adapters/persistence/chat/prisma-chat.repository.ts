import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type {
  ChatMessageRecord,
  ChatRecord,
  ChatRepositoryPort,
} from '../../../domain/chat/chat.repository.port.js';

const senderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class PrismaChatRepository implements ChatRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createForShipment(shipmentId: string): Promise<ChatRecord> {
    const chat = await this.prisma.chat.create({ data: { shipmentId } });
    return chat;
  }

  async deactivateByShipment(shipmentId: string): Promise<void> {
    await this.prisma.chat.updateMany({
      where: { shipmentId },
      data: { isActive: false },
    });
  }

  async findById(chatId: string): Promise<ChatRecord | null> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        shipment: {
          select: {
            id: true,
            trackingCode: true,
            status: true,
            senderId: true,
            carrierId: true,
          },
        },
      },
    });
    return chat;
  }

  async findByShipmentId(shipmentId: string): Promise<ChatRecord | null> {
    const chat = await this.prisma.chat.findUnique({
      where: { shipmentId },
      include: {
        shipment: {
          select: {
            id: true,
            trackingCode: true,
            status: true,
            senderId: true,
            carrierId: true,
          },
        },
      },
    });
    return chat;
  }

  async listForUser(userId: string): Promise<readonly ChatRecord[]> {
    return this.prisma.chat.findMany({
      where: {
        shipment: {
          OR: [{ senderId: userId }, { carrierId: userId }],
        },
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingCode: true,
            status: true,
            senderId: true,
            carrierId: true,
            sender: { select: senderSelect },
            carrier: { select: senderSelect },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async countUnread(chatId: string, userId: string): Promise<number> {
    return this.prisma.chatMessage.count({
      where: { chatId, senderId: { not: userId }, isRead: false },
    });
  }

  async listMessages(chatId: string, page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { chatId },
        include: { sender: { select: senderSelect } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.chatMessage.count({ where: { chatId } }),
    ]);

    return { data: rows.reverse(), total };
  }

  async markMessagesRead(chatId: string, readerId: string): Promise<void> {
    await this.prisma.chatMessage.updateMany({
      where: { chatId, senderId: { not: readerId }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    attachments: readonly string[] = [],
  ): Promise<ChatMessageRecord> {
    return this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId,
        content,
        attachments: [...attachments],
      },
      include: { sender: { select: senderSelect } },
    });
  }

  async touchChat(chatId: string): Promise<void> {
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });
  }
}
