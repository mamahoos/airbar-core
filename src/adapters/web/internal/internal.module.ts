import { Module } from '@nestjs/common';

import { InternalService } from '../../../application/internal/internal.service.js';

import { InternalKeyGuard } from './internal-key.guard.js';
import { InternalController } from './internal.controller.js';

@Module({
  controllers: [InternalController],
  providers: [InternalService, InternalKeyGuard],
})
export class InternalModule {}
