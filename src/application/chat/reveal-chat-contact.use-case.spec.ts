import { describe, expect, it, jest } from '@jest/globals';

import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';
import { ForbiddenError } from '../../shared/errors/index.js';

import { RevealChatContactUseCase } from './chat.use-cases.js';

import type { ChatAccessService } from './chat.use-cases.js';
import type { ChatRecord, ChatRepositoryPort } from '../../domain/chat/chat.repository.port.js';

describe('RevealChatContactUseCase', () => {
  it('rejects contact reveal before payment is secured', async () => {
    const chat = chatRecord({ status: ShipmentStatus.MATCHED });
    const chats = chatRepository();
    const useCase = buildUseCase(chats, chat);

    await expect(useCase.execute('sender-1', chat.id)).rejects.toThrow(ForbiddenError);

    expect(chats.findParticipantContact.mock.calls).toHaveLength(0);
  });

  it('reveals carrier contact to sender after payment is secured', async () => {
    const chat = chatRecord({ status: ShipmentStatus.PAID });
    const chats = chatRepository();
    chats.findParticipantContact.mockResolvedValue({
      id: 'carrier-1',
      firstName: 'Carrier',
      lastName: 'User',
      phone: '+989121234567',
    });
    const useCase = buildUseCase(chats, chat);

    const result = await useCase.execute('sender-1', chat.id);

    expect(chats.findParticipantContact.mock.calls[0]?.[0]).toBe('carrier-1');
    expect(result).toMatchObject({
      role: 'carrier',
      userId: 'carrier-1',
      phone: '+989121234567',
      shipmentId: 'shipment-1',
      shipmentStatus: ShipmentStatus.PAID,
    });
    expect(result.revealedAt).toEqual(expect.any(String));
  });

  it('reveals sender contact to carrier in transit', async () => {
    const chat = chatRecord({ status: ShipmentStatus.IN_TRANSIT });
    const chats = chatRepository();
    chats.findParticipantContact.mockResolvedValue({
      id: 'sender-1',
      firstName: 'Sender',
      lastName: 'User',
      phone: '09120000000',
    });
    const useCase = buildUseCase(chats, chat);

    const result = await useCase.execute('carrier-1', chat.id);

    expect(chats.findParticipantContact.mock.calls[0]?.[0]).toBe('sender-1');
    expect(result).toMatchObject({
      role: 'sender',
      userId: 'sender-1',
      phone: '09120000000',
      shipmentStatus: ShipmentStatus.IN_TRANSIT,
    });
  });

  it('rejects reveal when the carrier has not been assigned yet', async () => {
    const chat = chatRecord({ carrierId: null, status: ShipmentStatus.PAID });
    const chats = chatRepository();
    const useCase = buildUseCase(chats, chat);

    await expect(useCase.execute('sender-1', chat.id)).rejects.toThrow(ForbiddenError);

    expect(chats.findParticipantContact.mock.calls).toHaveLength(0);
  });
});

function buildUseCase(chats: jest.Mocked<ChatRepositoryPort>, chat: ChatRecord) {
  return new RevealChatContactUseCase(
    chats,
    { assertParticipant: jest.fn<() => Promise<ChatRecord>>().mockResolvedValue(chat) } as unknown as ChatAccessService,
  );
}

function chatRepository(): jest.Mocked<ChatRepositoryPort> {
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
    sendMessage: jest.fn(),
    recordTrustEvent: jest.fn(),
    touchChat: jest.fn(),
  };
}

function chatRecord(input: {
  readonly status: ShipmentStatus;
  readonly carrierId?: string | null | undefined;
}): ChatRecord {
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
      carrierId: input.carrierId === undefined ? 'carrier-1' : input.carrierId,
    },
  };
}
