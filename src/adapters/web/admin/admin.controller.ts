import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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
  GetAdminUserDetailUseCase,
  ListAdminActivityLogsUseCase,
  ListAdminDisputesUseCase,
  ListAdminPendingKycUseCase,
  ListAdminPricingRulesUseCase,
  ListAdminShipmentsUseCase,
  ListAdminUsersUseCase,
  UnbanAdminUserUseCase,
  UpdateAdminPricingRuleUseCase,
  UpdateAdminSystemConfigUseCase,
  UpdateAdminUserRoleUseCase,
} from '../../../application/admin/admin.use-cases.js';
import {
  ProcessAdminWithdrawalUseCase,
  RejectAdminWithdrawalUseCase,
  ReplayOutboxUseCase,
  ResolveDisputeUseCase,
} from '../../../application/finance/payment.use-cases.js';
import { UserRole as DomainUserRole } from '../../../domain/auth/user-role.js';
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
  @Min(0)
  basePrice!: number;

  @IsNumber()
  @Min(0)
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
    private readonly getConfig: GetAdminSystemConfigUseCase,
    private readonly updateConfig: UpdateAdminSystemConfigUseCase,
    private readonly listPricingRules: ListAdminPricingRulesUseCase,
    private readonly createPricingRule: CreateAdminPricingRuleUseCase,
    private readonly updatePricingRule: UpdateAdminPricingRuleUseCase,
    private readonly resolveDispute: ResolveDisputeUseCase,
    private readonly replayOutbox: ReplayOutboxUseCase,
    private readonly processWithdrawal: ProcessAdminWithdrawalUseCase,
    private readonly rejectWithdrawal: RejectAdminWithdrawalUseCase,
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

  @Post('integration-outbox/:id/replay')
  @Roles(DomainUserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Replay failed outbox row (super admin)' })
  replayOutboxRoute(@Param('id') id: string) {
    return this.replayOutbox.execute(id);
  }

  @Post('withdrawals/:id/process')
  @ApiOperation({ summary: 'Process withdrawal via finance gRPC' })
  processWithdrawalRoute(@Param('id') id: string) {
    return this.processWithdrawal.execute(id);
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject withdrawal via finance gRPC' })
  rejectWithdrawalRoute(@Param('id') id: string, @Body() dto: RejectWithdrawalDto) {
    return this.rejectWithdrawal.execute(id, dto.reason);
  }
}
