import { Module } from '@nestjs/common';

import { IntakeService } from '../../../application/intake/intake.service.js';
import { MarketplaceModule } from '../marketplace/marketplace.module.js';

import { IntakeKeyGuard } from './intake-key.guard.js';
import { IntakeController } from './intake.controller.js';

@Module({
  imports: [MarketplaceModule],
  controllers: [IntakeController],
  providers: [IntakeService, IntakeKeyGuard],
})
export class IntakeModule {}
