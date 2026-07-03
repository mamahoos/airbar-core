import { Module } from '@nestjs/common';

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
import { AdminPersistenceModule } from '../../persistence/admin/admin-persistence.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

import { AdminController } from './admin.controller.js';

@Module({
  imports: [AdminPersistenceModule, AuthModule, PaymentsModule],
  controllers: [AdminController],
  providers: [
    GetAdminDashboardUseCase,
    ListAdminUsersUseCase,
    GetAdminUserDetailUseCase,
    UpdateAdminUserRoleUseCase,
    BanAdminUserUseCase,
    UnbanAdminUserUseCase,
    ListAdminShipmentsUseCase,
    ListAdminDisputesUseCase,
    ListAdminPendingKycUseCase,
    ListAdminActivityLogsUseCase,
    ListAdminTrustEventsUseCase,
    GetAdminTrustEventUseCase,
    ReviewAdminTrustEventUseCase,
    GetAdminSystemConfigUseCase,
    UpdateAdminSystemConfigUseCase,
    ListAdminPricingRulesUseCase,
    CreateAdminPricingRuleUseCase,
    UpdateAdminPricingRuleUseCase,
  ],
})
export class AdminModule {}
