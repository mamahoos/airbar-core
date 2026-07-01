import { Module } from '@nestjs/common';

import { EscrowJobsService } from '../../../application/finance/escrow-jobs.service.js';
import {
  CreateShipmentPaymentUseCase,
  GetWalletUseCase,
  ListWalletTransactionsUseCase,
  ListWithdrawalsUseCase,
  ProcessAdminWithdrawalUseCase,
  RejectAdminWithdrawalUseCase,
  ReplayOutboxUseCase,
  RequestWithdrawalUseCase,
  ResolveDisputeUseCase,
} from '../../../application/finance/payment.use-cases.js';
import { MarketplacePersistenceModule } from '../../persistence/marketplace/marketplace-persistence.module.js';
import { FinanceOutboxModule } from '../../queue/finance-outbox/finance-outbox.module.js';
import { KycModule } from '../kyc/kyc.module.js';

import { PaymentsController } from './payments.controller.js';

@Module({
  imports: [FinanceOutboxModule, MarketplacePersistenceModule, KycModule],
  controllers: [PaymentsController],
  providers: [
    CreateShipmentPaymentUseCase,
    GetWalletUseCase,
    ListWalletTransactionsUseCase,
    RequestWithdrawalUseCase,
    ListWithdrawalsUseCase,
    ReplayOutboxUseCase,
    ResolveDisputeUseCase,
    ProcessAdminWithdrawalUseCase,
    RejectAdminWithdrawalUseCase,
    EscrowJobsService,
  ],
  exports: [
    FinanceOutboxModule,
    GetWalletUseCase,
    ListWalletTransactionsUseCase,
    ReplayOutboxUseCase,
    ResolveDisputeUseCase,
    ProcessAdminWithdrawalUseCase,
    RejectAdminWithdrawalUseCase,
    EscrowJobsService,
  ],
})
export class PaymentsModule {}
