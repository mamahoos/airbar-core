import { Module } from '@nestjs/common';

import { CHAT_REPOSITORY } from '../../../domain/chat/chat.repository.port.js';

import { PrismaChatRepository } from './prisma-chat.repository.js';

@Module({
  providers: [{ provide: CHAT_REPOSITORY, useClass: PrismaChatRepository }],
  exports: [CHAT_REPOSITORY],
})
export class ChatPersistenceModule {}
