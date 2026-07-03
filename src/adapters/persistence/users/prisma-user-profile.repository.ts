import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../../bootstrap/config/index.js';
import { decryptPii, parsePiiKeyHex } from '../../../shared/crypto/index.js';
import { ConflictError } from '../../../shared/errors/index.js';
import { PrismaService } from '../prisma.service.js';

import type { AppConfig } from '../../../bootstrap/config/index.js';
import type {
  PublicUserProfile,
  UpdateProfileInput,
  UserProfile,
  UserProfileRepositoryPort,
} from '../../../domain/users/user-profile.repository.port.js';
import type { User } from '@prisma/client';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepositoryPort {
  private readonly piiKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.piiKey = parsePiiKeyHex(config.piiEncryptionKey);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identityProfile: true },
    });
    if (!user) return null;
    return this.toProfile(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    if (input.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (existing && existing.id !== userId) {
        throw new ConflictError('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      },
      include: { identityProfile: true },
    });
    return this.toProfile(user);
  }

  async updateAvatarUrl(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
    return { id: user.id, avatarUrl: user.avatarUrl! };
  }

  async getPublicProfile(userId: string): Promise<PublicUserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        identityProfile: {
          select: {
            shahkarVerifiedAt: true,
            identityPendingPersonInfo: true,
            firstNameOfficial: true,
            lastNameOfficial: true,
          },
        },
        avatarUrl: true,
        rating: true,
        totalTrips: true,
        totalShipments: true,
        kycLevel: true,
        createdAt: true,
      },
    });
    if (!user) return null;
    const identityLocked =
      !!user.identityProfile?.shahkarVerifiedAt && !user.identityProfile.identityPendingPersonInfo;
    return {
      id: user.id,
      firstName: identityLocked ? (user.identityProfile?.firstNameOfficial ?? null) : user.firstName,
      lastName: identityLocked ? (user.identityProfile?.lastNameOfficial ?? null) : user.lastName,
      avatarUrl: user.avatarUrl,
      rating: user.rating,
      totalTrips: user.totalTrips,
      totalShipments: user.totalShipments,
      kycLevel: user.kycLevel,
      createdAt: user.createdAt,
    };
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async findAuthUserPhone(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, passwordHash: true },
    });
    return user;
  }

  private toProfile(
    user: User & {
      identityProfile: {
        nationalIdCiphertext: string;
        shahkarVerifiedAt: Date | null;
        identityPendingPersonInfo: boolean;
        firstNameOfficial: string | null;
        lastNameOfficial: string | null;
      } | null;
    },
  ): UserProfile {
    const identityLocked =
      !!user.identityProfile?.shahkarVerifiedAt && !user.identityProfile.identityPendingPersonInfo;

    let nationalIdMasked: string | null = null;
    if (identityLocked && user.identityProfile) {
      try {
        const nid = decryptPii(user.identityProfile.nationalIdCiphertext, this.piiKey);
        nationalIdMasked = `${nid.slice(0, 3)}****${nid.slice(-2)}`;
      } catch {
        nationalIdMasked = null;
      }
    }

    const firstName = identityLocked
      ? (user.identityProfile?.firstNameOfficial ?? null)
      : (user.firstName ?? user.identityProfile?.firstNameOfficial ?? null);
    const lastName = identityLocked
      ? (user.identityProfile?.lastNameOfficial ?? null)
      : (user.lastName ?? user.identityProfile?.lastNameOfficial ?? null);

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName,
      lastName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      kycLevel: user.kycLevel,
      rating: user.rating,
      totalTrips: user.totalTrips,
      totalShipments: user.totalShipments,
      isActive: user.isActive,
      createdAt: user.createdAt,
      nationalIdLocked: identityLocked,
      nationalIdMasked,
    };
  }
}
