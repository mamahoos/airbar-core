import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type { OtpRepositoryPort } from '../../../domain/auth/ports/otp.repository.port.js';

@Injectable()
export class PrismaOtpRepository implements OtpRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async invalidateActive(phone: string): Promise<void> {
    await this.prisma.otp.updateMany({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
  }

  async create(phone: string, code: string, expiresAt: Date): Promise<void> {
    await this.prisma.otp.create({
      data: { id: randomUUID(), phone, code, expiresAt },
    });
  }

  async findActive(phone: string, code: string) {
    const row = await this.prisma.otp.findFirst({
      where: { phone, code, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return row
      ? {
          id: row.id,
          phone: row.phone,
          code: row.code,
          attempts: row.attempts,
          verified: row.verified,
          expiresAt: row.expiresAt,
        }
      : null;
  }

  async incrementAttempts(phone: string): Promise<void> {
    await this.prisma.otp.updateMany({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
  }

  async markVerified(id: string): Promise<void> {
    await this.prisma.otp.update({ where: { id }, data: { verified: true } });
  }

  async invalidateByCode(phone: string, code: string): Promise<void> {
    await this.prisma.otp.updateMany({
      where: { phone, code, verified: false },
      data: { expiresAt: new Date() },
    });
  }

  async getLatestActiveCode(phone: string): Promise<string | null> {
    const row = await this.prisma.otp.findFirst({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return row?.code ?? null;
  }
}
