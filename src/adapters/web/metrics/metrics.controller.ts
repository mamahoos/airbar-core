import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator.js';

import { METRICS_REGISTRY } from './metrics.constants.js';

import type { Response } from 'express';
import type { Registry } from 'prom-client';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS_REGISTRY) private readonly registry: Registry) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Res() res: Response): Promise<void> {
    res.end(await this.registry.metrics());
  }
}
