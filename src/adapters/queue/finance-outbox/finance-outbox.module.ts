import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { FinanceOrchestrator } from '../../../application/finance/finance-orchestrator.js';
import { financeOrchestratorProvider } from '../../../application/finance/finance-orchestrator.js';
import { IntegrationOutboxService } from '../../../application/finance/integration-outbox.service.js';
import { OutboxCommandHandler } from '../../../application/finance/outbox-command.handler.js';
import { ShipmentFinanceBridgeService } from '../../../application/finance/shipment-finance-bridge.service.js';
import { FinancePersistenceModule } from '../../persistence/finance/finance-persistence.module.js';

import { FINANCE_OUTBOX_QUEUE } from './finance-outbox.constants.js';
import { FinanceOutboxProcessor } from './finance-outbox.processor.js';

@Module({
  imports: [FinancePersistenceModule, BullModule.registerQueue({ name: FINANCE_OUTBOX_QUEUE })],
  providers: [
    OutboxCommandHandler,
    ShipmentFinanceBridgeService,
    IntegrationOutboxService,
    financeOrchestratorProvider,
    FinanceOrchestrator,
    FinanceOutboxProcessor,
  ],
  exports: [financeOrchestratorProvider, IntegrationOutboxService, ShipmentFinanceBridgeService],
})
export class FinanceOutboxModule {}
