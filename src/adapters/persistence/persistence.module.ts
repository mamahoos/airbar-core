import { Module, Global } from '@nestjs/common';

import { PrismaHealthIndicator } from '../health/prisma.health.js';

import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, PrismaHealthIndicator],
  exports: [PrismaService, PrismaHealthIndicator],
})
export class PersistenceModule {}
