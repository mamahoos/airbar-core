import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

import { StatsService } from '../../../application/stats/stats.service.js';
import { Public } from '../common/decorators/public.decorator.js';

class LimitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public platform stats' })
  async publicStats() {
    return this.stats.getPublicStats();
  }

  @Get('popular-routes')
  @Public()
  @ApiOperation({ summary: 'Popular active routes' })
  async popularRoutes(@Query() query: LimitQueryDto) {
    return this.stats.getPopularRoutes(query.limit ?? 6);
  }

  @Get('testimonials')
  @Public()
  @ApiOperation({ summary: 'Recent positive reviews' })
  async testimonials(@Query() query: LimitQueryDto) {
    return this.stats.getTestimonials(query.limit ?? 6);
  }
}
