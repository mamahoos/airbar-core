import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { IntakeService } from '../../../application/intake/intake.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Public } from '../common/decorators/public.decorator.js';

import { CreateDraftDto } from './dto/intake.dto.js';
import { IntakeKeyGuard } from './intake-key.guard.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('intake')
@Controller('intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Post('drafts')
  @Public()
  @UseGuards(IntakeKeyGuard)
  @ApiSecurity('intake-key')
  @ApiOperation({ summary: 'Ingest structured request from Telegram AI pipeline' })
  createDraft(@Body() dto: CreateDraftDto) {
    return this.intake.createDraft(dto);
  }

  @Get('drafts/:token')
  @Public()
  @ApiOperation({ summary: 'Public preview of draft by token' })
  getDraft(@Param('token') token: string) {
    return this.intake.getByToken(token);
  }

  @Post('drafts/:token/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim draft and create Trip/Shipment' })
  claim(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.intake.claim(token, user.id);
  }

  @Get('stats')
  @Public()
  @UseGuards(IntakeKeyGuard)
  @ApiSecurity('intake-key')
  @ApiOperation({ summary: 'Intake funnel stats' })
  stats() {
    return this.intake.getStats();
  }
}
