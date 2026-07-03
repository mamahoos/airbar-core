import { Module } from '@nestjs/common';

import { ChatFirewallService } from '../../../application/chat/chat-firewall.service.js';
import {
  ChatAccessService,
  CreateChatForShipmentUseCase,
  DeactivateChatForShipmentUseCase,
  GetChatByShipmentUseCase,
  GetChatUseCase,
  ListChatMessagesUseCase,
  ListMyChatsUseCase,
  SendChatMessageUseCase,
} from '../../../application/chat/chat.use-cases.js';
import { ChatPersistenceModule } from '../../persistence/chat/chat-persistence.module.js';

import { ChatController } from './chat.controller.js';

@Module({
  imports: [ChatPersistenceModule],
  controllers: [ChatController],
  providers: [
    ChatAccessService,
    ChatFirewallService,
    ListMyChatsUseCase,
    GetChatUseCase,
    GetChatByShipmentUseCase,
    ListChatMessagesUseCase,
    SendChatMessageUseCase,
    CreateChatForShipmentUseCase,
    DeactivateChatForShipmentUseCase,
  ],
  exports: [CreateChatForShipmentUseCase, DeactivateChatForShipmentUseCase],
})
export class ChatModule {}
