import { Module } from '@nestjs/common';

import { MarketStatsService } from '../../../application/stats/market-stats.service.js';
import { StatsService } from '../../../application/stats/stats.service.js';

import { StatsController } from './stats.controller.js';

@Module({
  controllers: [StatsController],
  providers: [StatsService, MarketStatsService],
  exports: [MarketStatsService],
})
export class StatsModule {}
