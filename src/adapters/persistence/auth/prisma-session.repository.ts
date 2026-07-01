import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type {
  CreateSessionInput,
  SessionRepositoryPort,
} from '../../../domain/auth/ports/session.repository.port.js';
import type { UserSession } from '../../../domain/auth/session.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaSessionRepository implements SessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<UserSession> {
    const row = await this.prisma.session.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        token: input.token,
        ...(input.deviceInfo !== undefined
          ? { deviceInfo: input.deviceInfo as Prisma.InputJsonValue }
          : {}),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        expiresAt: input.expiresAt,
      },
    });
    return toSession(row);
  }

  async findByUserAndToken(userId: string, token: string): Promise<UserSession | null> {
    const row = await this.prisma.session.findFirst({
      where: { userId, token, expiresAt: { gt: new Date() } },
    });
    return row ? toSession(row) : null;
  }

  async updateToken(sessionId: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { token, expiresAt },
    });
  }

  async deleteByUserAndToken(userId: string, token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId, token } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  async listActiveForUser(userId: string): Promise<readonly UserSession[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSession);
  }
}

function toSession(row: {
  id: string;
  userId: string;
  token: string;
  deviceInfo: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
}): UserSession {
  return {
    id: row.id,
    userId: row.userId,
    token: row.token,
    deviceInfo: row.deviceInfo,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}
