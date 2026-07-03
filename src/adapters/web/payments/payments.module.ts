import { Module } from '@nestjs/common';

import {
  CreateCampaignUseCase,
  GetCampaignUseCase,
  GrantCampaignCreditUseCase,
  ListCampaignsUseCase,
  UpdateCampaignUseCase,
} from '../../../application/finance/campaign.use-cases.js';
import {
  GetAdminUserCreditUseCase,
  GrantAdminCreditUseCase,
  ReverseAdminCreditGrantUseCase,
} from '../../../application/finance/credit.use-cases.js';
import { EscrowJobsService } from '../../../application/finance/escrow-jobs.service.js';
import { FinanceLimitsService } from '../../../application/finance/finance-limits.service.js';
import {
  ApproveAdminWithdrawalUseCase,
  CreateShipmentPaymentUseCase,
  FailAdminWithdrawalUseCase,
  GetAdminReconciliationRunUseCase,
  GetAdminOutboxUseCase,
  GetAdminTreasurySummaryUseCase,
  GetWalletUseCase,
  ListAdminReconciliationRunsUseCase,
  ListAdminOutboxUseCase,
  ListAdminProviderEventsUseCase,
  ListWalletTransactionsUseCase,
  ListWithdrawalsUseCase,
  MarkAdminWithdrawalSentUseCase,
  ProcessAdminWithdrawalUseCase,
  RejectAdminWithdrawalUseCase,
  ReplayOutboxUseCase,
  RequestWithdrawalUseCase,
  ResolveDisputeUseCase,
  RunAdminReconciliationUseCase,
  SettleAdminWithdrawalUseCase,
} from '../../../application/finance/payment.use-cases.js';
import { AuthPersistenceModule } from '../../persistence/auth/auth-persistence.module.js';
import { KycPersistenceModule } from '../../persistence/kyc/kyc-persistence.module.js';
import { MarketplacePersistenceModule } from '../../persistence/marketplace/marketplace-persistence.module.js';
import { FinanceOutboxModule } from '../../queue/finance-outbox/finance-outbox.module.js';
import { KycModule } from '../kyc/kyc.module.js';

import { PaymentsController } from './payments.controller.js';

@Module({
  imports: [
    FinanceOutboxModule,
    AuthPersistenceModule,
    MarketplacePersistenceModule,
    KycPersistenceModule,
    KycModule,
  ],
  controllers: [PaymentsController],
  providers: [
    CreateShipmentPaymentUseCase,
    FinanceLimitsService,
    GetWalletUseCase,
    ListWalletTransactionsUseCase,
    RequestWithdrawalUseCase,
    ListWithdrawalsUseCase,
    GetAdminTreasurySummaryUseCase,
    RunAdminReconciliationUseCase,
    ListAdminReconciliationRunsUseCase,
    GetAdminReconciliationRunUseCase,
    ListAdminOutboxUseCase,
    GetAdminOutboxUseCase,
    ListAdminProviderEventsUseCase,
    ReplayOutboxUseCase,
    ResolveDisputeUseCase,
    ApproveAdminWithdrawalUseCase,
    MarkAdminWithdrawalSentUseCase,
    SettleAdminWithdrawalUseCase,
    FailAdminWithdrawalUseCase,
    ProcessAdminWithdrawalUseCase,
    RejectAdminWithdrawalUseCase,
    EscrowJobsService,
    GrantAdminCreditUseCase,
    ReverseAdminCreditGrantUseCase,
    GetAdminUserCreditUseCase,
    CreateCampaignUseCase,
    ListCampaignsUseCase,
    GetCampaignUseCase,
    UpdateCampaignUseCase,
    GrantCampaignCreditUseCase,
  ],
  exports: [
    FinanceOutboxModule,
    FinanceLimitsService,
    GetWalletUseCase,
    ListWalletTransactionsUseCase,
    GetAdminTreasurySummaryUseCase,
    RunAdminReconciliationUseCase,
    ListAdminReconciliationRunsUseCase,
    GetAdminReconciliationRunUseCase,
    ListAdminOutboxUseCase,
    GetAdminOutboxUseCase,
    ListAdminProviderEventsUseCase,
    ReplayOutboxUseCase,
    ResolveDisputeUseCase,
    ApproveAdminWithdrawalUseCase,
    MarkAdminWithdrawalSentUseCase,
    SettleAdminWithdrawalUseCase,
    FailAdminWithdrawalUseCase,
    ProcessAdminWithdrawalUseCase,
    RejectAdminWithdrawalUseCase,
    EscrowJobsService,
    GrantAdminCreditUseCase,
    ReverseAdminCreditGrantUseCase,
    GetAdminUserCreditUseCase,
    CreateCampaignUseCase,
    ListCampaignsUseCase,
    GetCampaignUseCase,
    UpdateCampaignUseCase,
    GrantCampaignCreditUseCase,
  ],
})
export class PaymentsModule {}
