import { describe, expect, it, jest } from '@jest/globals';

import { ForbiddenError } from '../../shared/errors/index.js';

import { ChatFirewallService } from './chat-firewall.service.js';
import { SendChatMessageUseCase } from './chat.use-cases.js';

import type { ChatAccessService } from './chat.use-cases.js';
import type { RedisService } from '../../adapters/cache/redis.service.js';
import type {
  ChatMessageRecord,
  ChatRecord,
  ChatRepositoryPort,
} from '../../domain/chat/chat.repository.port.js';

describe('SendChatMessageUseCase', () => {
  it('records and blocks contact sharing before payment', async () => {
    const chat = chatRecord({ status: 'MATCHED' });
    const chats = chatRepository(chat);
    const useCase = buildUseCase(chats, chat);

    await expect(useCase.execute('sender-1', chat.id, 'شماره من 09123456789 است')).rejects.toThrow(
      ForbiddenError,
    );

    expect(chats.recordTrustEvent.mock.calls).toHaveLength(1);
    expect(chats.recordTrustEvent.mock.calls[0]?.[0]).toMatchObject({
      userId: 'sender-1',
      chatId: chat.id,
      shipmentId: chat.shipmentId,
      action: 'BLOCK',
      severity: 'HIGH',
    });
    expect(chats.sendMessage.mock.calls).toHaveLength(0);
  });

  it('masks contact sharing after payment-sensitive status and stores the masked message', async () => {
    const chat = chatRecord({ status: 'ACCEPTED' });
    const chats = chatRepository(chat);
    const useCase = buildUseCase(chats, chat);

    const message = await useCase.execute('sender-1', chat.id, 'هماهنگی با 09123456789');

    expect(chats.recordTrustEvent.mock.calls[0]?.[0]).toMatchObject({
      action: 'MASK',
      severity: 'MEDIUM',
    });
    expect(chats.sendMessage.mock.calls[0]?.[2]).toContain('[شماره تماس حذف شد]');
    expect(message.content).toContain('[شماره تماس حذف شد]');
  });

  it('allows normal messages unchanged', async () => {
    const chat = chatRecord({ status: 'MATCHED' });
    const chats = chatRepository(chat);
    const useCase = buildUseCase(chats, chat);

    await useCase.execute('sender-1', chat.id, 'سلام، وزن بسته یک کیلو است.');

    expect(chats.recordTrustEvent.mock.calls).toHaveLength(0);
    expect(chats.sendMessage.mock.calls[0]?.[2]).toBe('سلام، وزن بسته یک کیلو است.');
  });
});

function buildUseCase(chats: jest.Mocked<ChatRepositoryPort>, chat: ChatRecord) {
  return new SendChatMessageUseCase(
    chats,
    {
      assertParticipant: jest.fn<() => Promise<ChatRecord>>().mockResolvedValue(chat),
    } as unknown as ChatAccessService,
    { publish: jest.fn<() => Promise<number>>().mockResolvedValue(1) } as unknown as RedisService,
    new ChatFirewallService(),
  );
}

function chatRepository(_chat: ChatRecord): jest.Mocked<ChatRepositoryPort> {
  return {
    createForShipment: jest.fn(),
    deactivateByShipment: jest.fn(),
    findById: jest.fn(),
    findByShipmentId: jest.fn(),
    listForUser: jest.fn(),
    countUnread: jest.fn(),
    listMessages: jest.fn(),
    markMessagesRead: jest.fn(),
    findParticipantContact: jest.fn(),
    sendMessage: jest
      .fn<(chatId: string, senderId: string, content: string) => Promise<ChatMessageRecord>>()
      .mockImplementation(async (chatId, senderId, content) => ({
        id: 'message-1',
        chatId,
        senderId,
        content,
        attachments: [],
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-07-03T00:00:00Z'),
      })),
    recordTrustEvent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    touchChat: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

function chatRecord(input: { readonly status: string }): ChatRecord {
  return {
    id: 'chat-1',
    shipmentId: 'shipment-1',
    isActive: true,
    createdAt: new Date('2026-07-03T00:00:00Z'),
    updatedAt: new Date('2026-07-03T00:00:00Z'),
    shipment: {
      id: 'shipment-1',
      trackingCode: 'AB123',
      status: input.status,
      senderId: 'sender-1',
      carrierId: 'carrier-1',
    },
  };
}
