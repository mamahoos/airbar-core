export const CHAT_REPOSITORY = Symbol('CHAT_REPOSITORY');

export interface ChatParticipantSummary {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarUrl: string | null;
}

export interface ChatShipmentSummary {
  readonly id: string;
  readonly trackingCode: string;
  readonly status: string;
  readonly senderId: string;
  readonly carrierId: string | null;
  readonly sender?: ChatParticipantSummary;
  readonly carrier?: ChatParticipantSummary | null;
}

export interface ChatRecord {
  readonly id: string;
  readonly shipmentId: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly shipment?: ChatShipmentSummary;
}

export interface ChatMessageRecord {
  readonly id: string;
  readonly chatId: string;
  readonly senderId: string;
  readonly content: string;
  readonly attachments: readonly string[];
  readonly isRead: boolean;
  readonly readAt: Date | null;
  readonly createdAt: Date;
  readonly sender?: ChatParticipantSummary;
}

export interface ChatTrustEventInput {
  readonly userId: string;
  readonly shipmentId?: string | null | undefined;
  readonly chatId?: string | null | undefined;
  readonly type: string;
  readonly severity: string;
  readonly action: string;
  readonly metadata?: unknown;
}

export interface ChatRepositoryPort {
  createForShipment(shipmentId: string): Promise<ChatRecord>;
  deactivateByShipment(shipmentId: string): Promise<void>;
  findById(chatId: string): Promise<ChatRecord | null>;
  findByShipmentId(shipmentId: string): Promise<ChatRecord | null>;
  listForUser(userId: string): Promise<readonly ChatRecord[]>;
  countUnread(chatId: string, userId: string): Promise<number>;
  listMessages(
    chatId: string,
    page: number,
    limit: number,
  ): Promise<{ data: readonly ChatMessageRecord[]; total: number }>;
  markMessagesRead(chatId: string, readerId: string): Promise<void>;
  sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    attachments?: readonly string[],
  ): Promise<ChatMessageRecord>;
  recordTrustEvent(input: ChatTrustEventInput): Promise<void>;
  touchChat(chatId: string): Promise<void>;
}
