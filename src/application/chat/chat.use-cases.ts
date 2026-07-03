import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../adapters/cache/redis.service.js';
import {
  CHAT_REPOSITORY,
  type ChatRecord,
  type ChatRepositoryPort,
} from '../../domain/chat/chat.repository.port.js';
import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';

import { ChatFirewallService } from './chat-firewall.service.js';

const CONTACT_REVEAL_STATUSES = new Set<string>([
  ShipmentStatus.PAID,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CONFIRMED,
]);

@Injectable()
export class ChatAccessService {
  constructor(@Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort) {}

  async assertParticipant(userId: string, chatId: string): Promise<ChatRecord> {
    const chat = await this.chats.findById(chatId);
    if (!chat?.shipment) throw new NotFoundError('Chat', chatId);

    const { senderId, carrierId } = chat.shipment;
    if (senderId !== userId && carrierId !== userId) {
      throw new ForbiddenError('Not authorized to access this chat');
    }
    return chat;
  }
}

@Injectable()
export class ListMyChatsUseCase {
  constructor(@Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort) {}

  async execute(userId: string) {
    const rows = await this.chats.listForUser(userId);
    return Promise.all(
      rows.map(async (chat) => {
        const unreadCount = await this.chats.countUnread(chat.id, userId);
        const shipment = chat.shipment;
        const otherParticipant =
          shipment?.senderId === userId ? shipment.carrier : shipment?.sender;
        return { ...chat, unreadCount, otherParticipant };
      }),
    );
  }
}

@Injectable()
export class GetChatUseCase {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort,
    private readonly access: ChatAccessService,
  ) {}

  async execute(userId: string, chatId: string) {
    return this.access.assertParticipant(userId, chatId);
  }
}

@Injectable()
export class RevealChatContactUseCase {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort,
    private readonly access: ChatAccessService,
  ) {}

  async execute(userId: string, chatId: string) {
    const chat = await this.access.assertParticipant(userId, chatId);
    if (!chat.isActive) throw new ForbiddenError('Chat is no longer active');

    const shipment = chat.shipment;
    if (!shipment) throw new NotFoundError('Chat', chatId);
    if (!CONTACT_REVEAL_STATUSES.has(shipment.status)) {
      throw new ForbiddenError('Contact reveal is available after payment is secured');
    }

    const role = shipment.senderId === userId ? 'sender' : 'carrier';
    const counterpartRole = role === 'sender' ? 'carrier' : 'sender';
    const counterpartId = role === 'sender' ? shipment.carrierId : shipment.senderId;
    if (!counterpartId) {
      throw new ForbiddenError('Counterpart contact is not available yet');
    }

    const contact = await this.chats.findParticipantContact(counterpartId);
    if (!contact) throw new NotFoundError('User', counterpartId);

    return {
      role: counterpartRole,
      userId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      shipmentId: shipment.id,
      shipmentStatus: shipment.status,
      revealedAt: new Date().toISOString(),
    };
  }
}

@Injectable()
export class GetChatByShipmentUseCase {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort,
    private readonly access: ChatAccessService,
  ) {}

  async execute(userId: string, shipmentId: string) {
    const chat = await this.chats.findByShipmentId(shipmentId);
    if (!chat) throw new NotFoundError('Chat', shipmentId);
    return this.access.assertParticipant(userId, chat.id);
  }
}

@Injectable()
export class ListChatMessagesUseCase {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort,
    private readonly access: ChatAccessService,
  ) {}

  async execute(userId: string, chatId: string, page?: number, limit?: number) {
    await this.access.assertParticipant(userId, chatId);
    const { page: p, limit: l } = normalizePagination({ page, limit });
    const { data, total } = await this.chats.listMessages(chatId, p, l);
    await this.chats.markMessagesRead(chatId, userId);
    return { data, pagination: buildPaginationMeta(total, p, l) };
  }
}

@Injectable()
export class SendChatMessageUseCase {
  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort,
    private readonly access: ChatAccessService,
    private readonly redis: RedisService,
    private readonly firewall: ChatFirewallService,
  ) {}

  async execute(userId: string, chatId: string, content: string, attachments?: readonly string[]) {
    const chat = await this.access.assertParticipant(userId, chatId);
    if (!chat.isActive) throw new ForbiddenError('Chat is no longer active');

    const decision = this.firewall.evaluate({
      content,
      shipmentStatus: chat.shipment?.status,
    });
    if (decision.action !== 'ALLOW') {
      await this.chats.recordTrustEvent({
        userId,
        shipmentId: chat.shipmentId,
        chatId,
        type: 'CHAT_CONTACT_VIOLATION',
        severity: decision.action === 'BLOCK' ? 'HIGH' : 'MEDIUM',
        action: decision.action,
        metadata: { reasons: decision.reasons },
      });
    }
    if (decision.action === 'BLOCK') {
      throw new ForbiddenError('پیام شامل اطلاعات تماس یا دعوت به پرداخت خارج از پلتفرم است');
    }

    const message = await this.chats.sendMessage(chatId, userId, decision.content, attachments);
    await this.chats.touchChat(chatId);
    await this.redis.publish(`chat:${chatId}`, JSON.stringify(message));
    return message;
  }
}

@Injectable()
export class CreateChatForShipmentUseCase {
  constructor(@Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort) {}

  async execute(shipmentId: string) {
    return this.chats.createForShipment(shipmentId);
  }
}

@Injectable()
export class DeactivateChatForShipmentUseCase {
  constructor(@Inject(CHAT_REPOSITORY) private readonly chats: ChatRepositoryPort) {}

  async execute(shipmentId: string) {
    await this.chats.deactivateByShipment(shipmentId);
  }
}
