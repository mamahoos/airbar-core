import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { InternalService } from '../../../application/internal/internal.service.js';
import { Public } from '../common/decorators/public.decorator.js';

import { InternalKeyGuard } from './internal-key.guard.js';

class BulkUsersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}

class InAppNotifyDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

@ApiTags('internal')
@Controller('internal')
@Public()
@UseGuards(InternalKeyGuard)
@ApiSecurity('internal-key')
export class InternalController {
  constructor(private readonly internal: InternalService) {}

  @Get('users/:id')
  @ApiOperation({ summary: 'Lookup user by id (notification service)' })
  getUser(@Param('id') id: string) {
    return this.internal.getUserById(id);
  }

  @Post('users/bulk')
  @ApiOperation({ summary: 'Bulk user lookup' })
  bulkUsers(@Body() dto: BulkUsersDto) {
    return this.internal.getBulkUsers(dto.ids ?? []);
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Create in-app notification from notification service' })
  createNotification(@Body() dto: InAppNotifyDto) {
    return this.internal.createInAppNotification(dto);
  }
}
