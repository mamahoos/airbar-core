import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CreateShipmentPaymentUseCase,
  ListWithdrawalsUseCase,
  RequestWithdrawalUseCase,
} from '../../../application/finance/payment.use-cases.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import { CreatePaymentDto, RequestWithdrawalDto } from './dto/payments.dto.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly createPayment: CreateShipmentPaymentUseCase,
    private readonly requestWithdrawal: RequestWithdrawalUseCase,
    private readonly listWithdrawals: ListWithdrawalsUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create payment for accepted shipment (Zibal redirect or wallet)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.createPayment.execute(user.id, dto.shipmentId, dto.method);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List user withdrawals from finance service' })
  withdrawals(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.listWithdrawals.execute(user.id, status ?? '');
  }

  @Post('withdrawals')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request payout to registered IBAN' })
  withdrawal(@CurrentUser() user: AuthUser, @Body() dto: RequestWithdrawalDto) {
    return this.requestWithdrawal.execute(user.id, dto.amount);
  }
}
