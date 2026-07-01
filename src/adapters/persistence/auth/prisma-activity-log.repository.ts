import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type { ActivityLogRepositoryPort } from '../../../domain/auth/ports/activity-log.repository.port.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaActivityLogRepository implements ActivityLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string | undefined;
    details?: unknown;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        ...(input.details !== undefined ? { details: input.details as Prisma.InputJsonValue } : {}),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}
