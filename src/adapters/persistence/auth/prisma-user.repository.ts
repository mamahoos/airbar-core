import { Injectable } from '@nestjs/common';

import { KycLevel as DomainKycLevel } from '../../../domain/auth/kyc-level.js';
import { UserRole as DomainUserRole } from '../../../domain/auth/user-role.js';
import { PrismaService } from '../prisma.service.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';
import type {
  CreateUserInput,
  UserRepositoryPort,
} from '../../../domain/auth/ports/user.repository.port.js';
import type { User } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toAuthUser(row) : null;
  }

  async findByPhone(phone: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({ where: { phone } });
    return row ? toAuthUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<AuthUser> {
    const row = await this.prisma.user.create({
      data: {
        phone: input.phone,
        email: input.email ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        passwordHash: input.passwordHash ?? null,
        kycLevel: input.kycLevel ?? DomainKycLevel.NONE,
      },
    });
    return toAuthUser(row);
  }

  async updateLastLogin(id: string, ipAddress: string | undefined): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress ?? null,
      },
    });
  }
}

function toAuthUser(row: User): AuthUser {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    passwordHash: row.passwordHash,
    role: row.role as DomainUserRole,
    kycLevel: row.kycLevel as DomainKycLevel,
    isBanned: row.isBanned,
    lastLoginAt: row.lastLoginAt,
    lastLoginIp: row.lastLoginIp,
    createdAt: row.createdAt,
  };
}
