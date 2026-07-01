import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client adapter. Implements `OnModuleInit`/`OnModuleDestroy` so the
 * connection lifecycle is managed by Nest. Domain code never imports this —
 * it goes through repository ports implemented in `adapters/persistence`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight ping for health checks — opens no transaction. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
