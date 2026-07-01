import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import {
  GetChatByShipmentUseCase,
  GetChatUseCase,
  ListChatMessagesUseCase,
  ListMyChatsUseCase,
  SendChatMessageUseCase,
} from '../../../application/chat/chat.use-cases.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

class MessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

@ApiTags('chat')
@Controller('chat')
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly listMyChats: ListMyChatsUseCase,
    private readonly getChatByShipment: GetChatByShipmentUseCase,
    private readonly getChat: GetChatUseCase,
    private readonly listMessages: ListChatMessagesUseCase,
    private readonly sendMessage: SendChatMessageUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my chats' })
  async list(@CurrentUser() user: AuthUser) {
    return this.listMyChats.execute(user.id);
  }

  @Get('shipment/:shipmentId')
  @ApiOperation({ summary: 'Get chat by shipment' })
  async byShipment(@CurrentUser() user: AuthUser, @Param('shipmentId') shipmentId: string) {
    return this.getChatByShipment.execute(user.id, shipmentId);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'List chat messages' })
  async messages(
    @CurrentUser() user: AuthUser,
    @Param('chatId') chatId: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.listMessages.execute(user.id, chatId, query.page, query.limit);
  }

  @Get(':chatId')
  @ApiOperation({ summary: 'Get chat by ID' })
  async byId(@CurrentUser() user: AuthUser, @Param('chatId') chatId: string) {
    return this.getChat.execute(user.id, chatId);
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send chat message' })
  async send(
    @CurrentUser() user: AuthUser,
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.sendMessage.execute(user.id, chatId, dto.content, dto.attachments);
  }
}
