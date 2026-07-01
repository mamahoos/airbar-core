import { Module } from '@nestjs/common';

import { IntakeService } from '../../../application/intake/intake.service.js';
import { PricingQuoteService } from '../../../application/marketplace/pricing-quote.service.js';
import { MarketplacePersistenceModule } from '../../persistence/marketplace/marketplace-persistence.module.js';
import { StatsModule } from '../stats/stats.module.js';

import { IntakeKeyGuard } from './intake-key.guard.js';
import { IntakeController } from './intake.controller.js';

@Module({
  imports: [MarketplacePersistenceModule, StatsModule],
  controllers: [IntakeController],
  providers: [IntakeService, IntakeKeyGuard, PricingQuoteService],
})
export class IntakeModule {}
