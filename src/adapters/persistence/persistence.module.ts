import { Module, Global, type Provider } from '@nestjs/common';

import { HEALTH_INDICATORS } from '../../application/health/index.js';
import { PrismaHealthIndicator } from '../health/prisma.health.js';

import { PrismaService } from './prisma.service.js';

const prismaHealthMultiProvider = {
  provide: HEALTH_INDICATORS,
  useExisting: PrismaHealthIndicator,
  multi: true,
} as Provider;

@Global()
@Module({
  providers: [PrismaService, PrismaHealthIndicator, prismaHealthMultiProvider],
  exports: [PrismaService],
})
export class PersistenceModule {}
