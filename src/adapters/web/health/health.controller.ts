import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { HealthService } from '../../../application/health/index.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async root() {
    const result = await this.health.check();
    return result;
  }
}
