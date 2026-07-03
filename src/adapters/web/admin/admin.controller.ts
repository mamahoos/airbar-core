import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CargoType, ShipmentStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import {
  BanAdminUserUseCase,
  CreateAdminPricingRuleUseCase,
  GetAdminDashboardUseCase,
  GetAdminSystemConfigUseCase,
  GetAdminTrustEventUseCase,
  GetAdminUserDetailUseCase,
  ListAdminActivityLogsUseCase,
  ListAdminDisputesUseCase,
  ListAdminPendingKycUseCase,
  ListAdminPricingRulesUseCase,
  ListAdminShipmentsUseCase,
  ListAdminTrustEventsUseCase,
  ListAdminUsersUseCase,
  ReviewAdminTrustEventUseCase,
  UnbanAdminUserUseCase,
  UpdateAdminPricingRuleUseCase,
  UpdateAdminSystemConfigUseCase,
  UpdateAdminUserRoleUseCase,
} from '../../../application/admin/admin.use-cases.js';
import {
  ApproveAdminWithdrawalUseCase,
  FailAdminWithdrawalUseCase,
  GetAdminReconciliationRunUseCase,
  GetAdminTreasurySummaryUseCase,
  GetAdminOutboxUseCase,
  ListAdminReconciliationRunsUseCase,
  ListAdminOutboxUseCase,
  ListAdminProviderEventsUseCase,
  MarkAdminWithdrawalSentUseCase,
  ProcessAdminWithdrawalUseCase,
  RejectAdminWithdrawalUseCase,
  ReplayOutboxUseCase,
  ResolveDisputeUseCase,
  RunAdminReconciliationUseCase,
  SettleAdminWithdrawalUseCase,
} from '../../../application/finance/payment.use-cases.js';
import { UserRole as DomainUserRole } from '../../../domain/auth/user-role.js';
import {
  MIN_BASE_PRICE,
  MIN_PLATFORM_FEE,
  MIN_PRICE_PER_KG,
} from '../../../domain/marketplace/pricing-calculator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBanned?: boolean;
}

class AdminShipmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

class AdminLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

class AdminTrustEventsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  reviewStatus?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  shipmentId?: string;

  @IsOptional()
  @IsString()
  chatId?: string;
}

class ReviewTrustEventDto {
  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class BanUserDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

class UpdateConfigDto {
  @Allow()
  value!: unknown;
}

class PricingRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  originCountry?: string;

  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsNumber()
  @Min(MIN_BASE_PRICE)
  basePrice!: number;

  @IsNumber()
  @Min(MIN_PRICE_PER_KG)
  pricePerKg!: number;

  @IsOptional()
  @IsNumber()
  pricePerKm?: number;

  @IsOptional()
  @IsNumber()
  riskMultiplier?: number;

  @IsOptional()
  @IsNumber()
  platformFeePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(MIN_PLATFORM_FEE)
  minPlatformFee?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;
}

class ResolveDisputeDto {
  @IsEnum(['RELEASE', 'REFUND'] as const)
  resolution!: 'RELEASE' | 'REFUND';

  @IsOptional()
  @IsString()
  note?: string;
}

class RejectWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

class ProcessWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  providerRef!: string;

  @IsString()
  @IsNotEmpty()
  payoutChannel!: string;

  @IsString()
  @IsNotEmpty()
  receiptUrl!: string;
}

class MarkWithdrawalSentDto extends ProcessWithdrawalDto {}

class FailWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

class AdminOutboxQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsOptional()
  @IsString()
  aggregateType?: string;

  @IsOptional()
  @IsString()
  aggregateId?: string;
}

class ReplayOutboxDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

class ProviderEventsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  paymentOrderId?: string;
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(DomainUserRole.ADMIN, DomainUserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly dashboard: GetAdminDashboardUseCase,
    private readonly listUsers: ListAdminUsersUseCase,
    private readonly getUserDetail: GetAdminUserDetailUseCase,
    private readonly updateUserRole: UpdateAdminUserRoleUseCase,
    private readonly banUser: BanAdminUserUseCase,
    private readonly unbanUser: UnbanAdminUserUseCase,
    private readonly listShipments: ListAdminShipmentsUseCase,
    private readonly listDisputes: ListAdminDisputesUseCase,
    private readonly listPendingKyc: ListAdminPendingKycUseCase,
    private readonly listLogs: ListAdminActivityLogsUseCase,
    private readonly listTrustEvents: ListAdminTrustEventsUseCase,
    private readonly getTrustEvent: GetAdminTrustEventUseCase,
    private readonly reviewTrustEvent: ReviewAdminTrustEventUseCase,
    private readonly getConfig: GetAdminSystemConfigUseCase,
    private readonly updateConfig: UpdateAdminSystemConfigUseCase,
    private readonly listPricingRules: ListAdminPricingRulesUseCase,
    private readonly createPricingRule: CreateAdminPricingRuleUseCase,
    private readonly updatePricingRule: UpdateAdminPricingRuleUseCase,
    private readonly resolveDispute: ResolveDisputeUseCase,
    private readonly replayOutbox: ReplayOutboxUseCase,
    private readonly approveWithdrawal: ApproveAdminWithdrawalUseCase,
    private readonly markWithdrawalSent: MarkAdminWithdrawalSentUseCase,
    private readonly settleWithdrawal: SettleAdminWithdrawalUseCase,
    private readonly failWithdrawal: FailAdminWithdrawalUseCase,
    private readonly processWithdrawal: ProcessAdminWithdrawalUseCase,
    private readonly rejectWithdrawal: RejectAdminWithdrawalUseCase,
    private readonly getTreasurySummary: GetAdminTreasurySummaryUseCase,
    private readonly runReconciliation: RunAdminReconciliationUseCase,
    private readonly listReconciliationRuns: ListAdminReconciliationRunsUseCase,
    private readonly getReconciliationRun: GetAdminReconciliationRunUseCase,
    private readonly listOutbox: ListAdminOutboxUseCase,
    private readonly getOutbox: GetAdminOutboxUseCase,
    private readonly listProviderEvents: ListAdminProviderEventsUseCase,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats (non-financial)' })
  dashboardStats() {
    return this.dashboard.execute();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users' })
  users(@Query() query: AdminUsersQueryDto) {
    return this.listUsers.execute(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User detail' })
  userDetail(@Param('id') id: string) {
    return this.getUserDetail.execute(id);
  }

  @Put('users/:id/role')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user role (super admin)' })
  role(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.updateUserRole.execute(id, dto.role);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban user' })
  ban(@Param('id') id: string, @Body() dto: BanUserDto) {
    return this.banUser.execute(id, dto.reason);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban user' })
  unban(@Param('id') id: string) {
    return this.unbanUser.execute(id);
  }

  @Get('shipments')
  @ApiOperation({ summary: 'List shipments' })
  shipments(@Query() query: AdminShipmentsQueryDto) {
    return this.listShipments.execute(query);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List disputed shipments' })
  disputes() {
    return this.listDisputes.execute();
  }

  @Get('kyc/pending')
  @ApiOperation({ summary: 'Pending KYC documents' })
  pendingKyc(@Query() query: PaginationQueryDto) {
    return this.listPendingKyc.execute(query.page, query.limit);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Activity logs' })
  logs(@Query() query: AdminLogsQueryDto) {
    return this.listLogs.execute(query);
  }

  @Get('trust-events')
  @ApiOperation({ summary: 'List trust events for admin review' })
  trustEvents(@Query() query: AdminTrustEventsQueryDto) {
    return this.listTrustEvents.execute(query);
  }

  @Get('trust-events/:id')
  @ApiOperation({ summary: 'Get trust event detail' })
  trustEventDetail(@Param('id') id: string) {
    return this.getTrustEvent.execute(id);
  }

  @Post('trust-events/:id/review')
  @ApiOperation({ summary: 'Review trust event' })
  trustEventReview(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewTrustEventDto,
  ) {
    return this.reviewTrustEvent.execute(id, admin.id, dto.status, dto.note);
  }

  @Get('config/:key')
  @ApiOperation({ summary: 'Get system config' })
  config(@Param('key') key: string) {
    return this.getConfig.execute(key);
  }

  @Put('config/:key')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update system config (super admin)' })
  updateConfigRoute(
    @CurrentUser() admin: AuthUser,
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
  ) {
    return this.updateConfig.execute(admin.id, key, dto.value);
  }

  @Get('pricing-rules')
  @ApiOperation({ summary: 'List pricing rules' })
  pricingRules() {
    return this.listPricingRules.execute();
  }

  @Post('pricing-rules')
  @ApiOperation({ summary: 'Create pricing rule' })
  createRule(@Body() dto: PricingRuleDto) {
    return this.createPricingRule.execute(dto);
  }

  @Put('pricing-rules/:id')
  @ApiOperation({ summary: 'Update pricing rule' })
  updateRule(@Param('id') id: string, @Body() dto: PricingRuleDto) {
    return this.updatePricingRule.execute(id, dto);
  }

  @Post('disputes/:shipmentId/resolve')
  @ApiOperation({ summary: 'Resolve disputed shipment via finance gRPC' })
  resolveDisputeRoute(@Param('shipmentId') shipmentId: string, @Body() dto: ResolveDisputeDto) {
    return this.resolveDispute.execute(shipmentId, dto.resolution, dto.note);
  }

  @Get('integration-outbox')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List finance integration outbox rows (super admin)' })
  integrationOutbox(@Query() query: AdminOutboxQueryDto) {
    return this.listOutbox.execute(query);
  }

  @Get('integration-outbox/:id')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get finance integration outbox row detail (super admin)' })
  integrationOutboxDetail(@Param('id') id: string) {
    return this.getOutbox.execute(id);
  }

  @Post('integration-outbox/:id/replay')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Replay failed outbox row (super admin)' })
  replayOutboxRoute(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplayOutboxDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.replayOutbox.execute(admin.id, id, {
      reason: dto.reason,
      ipAddress,
      ...(userAgent ? { userAgent } : {}),
    });
  }

  @Get('finance/treasury')
  @ApiOperation({ summary: 'Finance treasury exposure summary' })
  treasurySummary(@Query('currency') currency?: string) {
    return this.getTreasurySummary.execute(currency ?? 'IRT');
  }

  @Get('finance/provider-events')
  @ApiOperation({ summary: 'List finance provider events for PSP operations' })
  providerEvents(@Query() query: ProviderEventsQueryDto) {
    return this.listProviderEvents.execute(query);
  }

  @Get('finance/reconciliation-runs')
  @ApiOperation({ summary: 'List finance reconciliation runs' })
  reconciliationRuns() {
    return this.listReconciliationRuns.execute();
  }

  @Get('finance/reconciliation-runs/:id')
  @ApiOperation({ summary: 'Get finance reconciliation run detail' })
  reconciliationRun(@Param('id') id: string) {
    return this.getReconciliationRun.execute(id);
  }

  @Post('finance/reconciliation-runs')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Run finance reconciliation manually (super admin)' })
  runReconciliationRoute() {
    return this.runReconciliation.execute();
  }

  @Post('withdrawals/:id/process')
  @ApiOperation({ summary: 'Process withdrawal via finance gRPC' })
  processWithdrawalRoute(@Param('id') id: string, @Body() dto: ProcessWithdrawalDto) {
    return this.processWithdrawal.execute(id, dto);
  }

  @Post('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Approve withdrawal before bank payout' })
  approveWithdrawalRoute(@Param('id') id: string) {
    return this.approveWithdrawal.execute(id);
  }

  @Post('withdrawals/:id/mark-sent')
  @ApiOperation({ summary: 'Mark withdrawal as sent to bank with provider receipt' })
  markWithdrawalSentRoute(@Param('id') id: string, @Body() dto: MarkWithdrawalSentDto) {
    return this.markWithdrawalSent.execute(id, dto);
  }

  @Post('withdrawals/:id/settle')
  @ApiOperation({ summary: 'Settle sent withdrawal after bank confirmation' })
  settleWithdrawalRoute(@Param('id') id: string) {
    return this.settleWithdrawal.execute(id);
  }

  @Post('withdrawals/:id/fail')
  @ApiOperation({ summary: 'Fail sent/approved withdrawal and reverse reserved balance' })
  failWithdrawalRoute(@Param('id') id: string, @Body() dto: FailWithdrawalDto) {
    return this.failWithdrawal.execute(id, dto.reason);
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject withdrawal via finance gRPC' })
  rejectWithdrawalRoute(@Param('id') id: string, @Body() dto: RejectWithdrawalDto) {
    return this.rejectWithdrawal.execute(id, dto.reason);
  }
}
