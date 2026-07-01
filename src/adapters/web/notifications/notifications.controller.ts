import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

import {
  DeleteNotificationUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../../application/notifications/notification.use-cases.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

class NotificationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markRead: MarkNotificationReadUseCase,
    private readonly markAllRead: MarkAllNotificationsReadUseCase,
    private readonly deleteNotification: DeleteNotificationUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  async list(@CurrentUser() user: AuthUser, @Query() query: NotificationListQueryDto) {
    return this.listNotifications.execute(user.id, query.page, query.limit);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async readAll(@CurrentUser() user: AuthUser) {
    return this.markAllRead.execute(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.markRead.execute(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deleteNotification.execute(user.id, id);
  }
}
