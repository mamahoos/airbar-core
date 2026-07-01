import { Inject, Injectable } from '@nestjs/common';
import { KycLevel, KycStatus } from '@prisma/client';

import { APP_CONFIG } from '../../../bootstrap/config/index.js';
import { decryptPii, encryptPii, hashPii, parsePiiKeyHex } from '../../../shared/crypto/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { PrismaService } from '../prisma.service.js';

import type { AppConfig } from '../../../bootstrap/config/index.js';
import type {
  IdentityProfileRecord,
  KycRepositoryPort,
  KycSnapshot,
  UpsertIdentityInput,
} from '../../../domain/kyc/kyc.repository.port.js';

@Injectable()
export class PrismaKycRepository implements KycRepositoryPort {
  private readonly piiKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.piiKey = parsePiiKeyHex(config.piiEncryptionKey);
  }

  decryptNationalId(ciphertext: string): string {
    return decryptPii(ciphertext, this.piiKey);
  }

  async getUserPhone(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }

  async getKycSnapshot(userId: string): Promise<KycSnapshot | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycLevel: true,
        financialVerifiedAt: true,
        identityProfile: { select: { nationalIdHash: true } },
      },
    });
    if (!user) return null;
    return {
      kycLevel: user.kycLevel,
      hasNationalId: !!user.identityProfile?.nationalIdHash,
      financialVerified: !!user.financialVerifiedAt,
    };
  }

  async findIdentityByUserId(userId: string): Promise<IdentityProfileRecord | null> {
    const profile = await this.prisma.userIdentityProfile.findUnique({ where: { userId } });
    if (!profile) return null;
    return {
      userId: profile.userId,
      nationalIdHash: profile.nationalIdHash,
      nationalIdCiphertext: profile.nationalIdCiphertext,
      firstNameOfficial: profile.firstNameOfficial,
      lastNameOfficial: profile.lastNameOfficial,
      fatherName: profile.fatherName,
      birthDateJalali: profile.birthDateJalali,
      gender: profile.gender,
      shahkarVerifiedAt: profile.shahkarVerifiedAt,
      personInfoVerifiedAt: profile.personInfoVerifiedAt,
      identityPendingPersonInfo: profile.identityPendingPersonInfo,
      personInfoRaw: profile.personInfoRaw,
    };
  }

  async findIdentityByNationalIdHash(hash: string, excludeUserId?: string): Promise<string | null> {
    const profile = await this.prisma.userIdentityProfile.findFirst({
      where: {
        nationalIdHash: hash,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: { userId: true },
    });
    return profile?.userId ?? null;
  }

  async upsertIdentity(input: UpsertIdentityInput): Promise<void> {
    const birthDate = parseBirthDate(input.birthDateJalali);
    await this.prisma.$transaction([
      this.prisma.userIdentityProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          nationalIdHash: input.nationalIdHash,
          nationalIdCiphertext: input.nationalIdCiphertext,
          firstNameOfficial: input.firstNameOfficial,
          lastNameOfficial: input.lastNameOfficial,
          fatherName: input.fatherName,
          birthDate,
          birthDateJalali: input.birthDateJalali,
          gender: input.gender,
          isAlive: input.isAlive,
          personInfoRaw: input.personInfoRaw as object,
          shahkarVerifiedAt: input.shahkarVerifiedAt,
          personInfoVerifiedAt: input.personInfoVerifiedAt,
          identityPendingPersonInfo: input.identityPendingPersonInfo,
        },
        update: {
          nationalIdHash: input.nationalIdHash,
          nationalIdCiphertext: input.nationalIdCiphertext,
          firstNameOfficial: input.firstNameOfficial,
          lastNameOfficial: input.lastNameOfficial,
          fatherName: input.fatherName,
          birthDate,
          birthDateJalali: input.birthDateJalali,
          gender: input.gender,
          isAlive: input.isAlive,
          personInfoRaw: input.personInfoRaw as object,
          shahkarVerifiedAt: input.shahkarVerifiedAt,
          personInfoVerifiedAt: input.personInfoVerifiedAt,
          identityPendingPersonInfo: input.identityPendingPersonInfo,
        },
      }),
      this.prisma.user.update({
        where: { id: input.userId },
        data: {
          kycLevel: KycLevel.IDENTITY_VERIFIED,
          identityPendingPersonInfo: input.identityPendingPersonInfo,
          ...(input.userFirstName ? { firstName: input.userFirstName } : {}),
          ...(input.userLastName ? { lastName: input.userLastName } : {}),
        },
      }),
    ]);
  }

  async getKycStatus(userId: string): Promise<unknown> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycLevel: true,
        financialVerifiedAt: true,
        identityPendingPersonInfo: true,
        identityProfile: {
          select: {
            firstNameOfficial: true,
            lastNameOfficial: true,
            fatherName: true,
            birthDateJalali: true,
            gender: true,
            shahkarVerifiedAt: true,
            personInfoVerifiedAt: true,
            identityPendingPersonInfo: true,
          },
        },
        bankAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            cardNumberMasked: true,
            bankName: true,
            accountHolderName: true,
            isDefault: true,
            cardMatchVerifiedAt: true,
          },
          orderBy: [{ isDefault: 'desc' }, { cardMatchVerifiedAt: 'desc' }],
        },
        kycDocuments: {
          select: {
            id: true,
            type: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) return null;

    const requirements: Record<string, string[]> = {
      NONE: ['mobile_verification'],
      MOBILE_VERIFIED: ['identity_verification'],
      IDENTITY_VERIFIED: ['document_upload'],
      DOCUMENT_VERIFIED: ['selfie_verification'],
      FACE_VERIFIED: ['address_verification'],
      FULLY_VERIFIED: [],
    };

    const profile = user.identityProfile;
    const identityLocked = !!profile?.shahkarVerifiedAt && !profile.identityPendingPersonInfo;

    return {
      currentLevel: user.kycLevel,
      nationalIdVerified:
        !!profile?.shahkarVerifiedAt &&
        !!profile.personInfoVerifiedAt &&
        !profile.identityPendingPersonInfo,
      identityPendingPersonInfo: profile?.identityPendingPersonInfo ?? false,
      financialVerified: !!user.financialVerifiedAt,
      identity:
        profile?.shahkarVerifiedAt && profile.personInfoVerifiedAt
          ? {
              birthDateJalali: profile.birthDateJalali,
              firstName: profile.firstNameOfficial,
              lastName: profile.lastNameOfficial,
              fatherName: profile.fatherName,
              gender: profile.gender,
              verifiedAt: profile.shahkarVerifiedAt,
              locked: identityLocked,
            }
          : null,
      bankAccounts: user.bankAccounts.map((account) => ({
        id: account.id,
        cardNumberMasked: account.cardNumberMasked,
        bankName: account.bankName,
        accountHolderName: account.accountHolderName,
        isDefault: account.isDefault,
        verifiedAt: account.cardMatchVerifiedAt,
      })),
      documents: user.kycDocuments,
      nextSteps: requirements[user.kycLevel] ?? [],
    };
  }

  async upsertBankAccount(input: {
    userId: string;
    cardNumberHash: string;
    cardNumberMasked: string;
    cardNumberCiphertext: string;
    ibanHash: string;
    ibanCiphertext: string;
    bankName: string | null;
    accountHolderName: string | null;
  }): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.userBankAccount.upsert({
        where: {
          userId_cardNumberHash: {
            userId: input.userId,
            cardNumberHash: input.cardNumberHash,
          },
        },
        create: {
          userId: input.userId,
          cardNumberHash: input.cardNumberHash,
          cardNumberMasked: input.cardNumberMasked,
          cardNumberCiphertext: input.cardNumberCiphertext,
          ibanHash: input.ibanHash,
          ibanCiphertext: input.ibanCiphertext,
          bankName: input.bankName,
          accountHolderName: input.accountHolderName,
          cardMatchVerifiedAt: now,
          isDefault: true,
        },
        update: {
          cardNumberMasked: input.cardNumberMasked,
          cardNumberCiphertext: input.cardNumberCiphertext,
          ibanHash: input.ibanHash,
          ibanCiphertext: input.ibanCiphertext,
          bankName: input.bankName,
          accountHolderName: input.accountHolderName,
          cardMatchVerifiedAt: now,
          isActive: true,
        },
      }),
      this.prisma.user.update({
        where: { id: input.userId },
        data: { financialVerifiedAt: now },
      }),
    ]);
  }

  async setFinancialVerified(userId: string, verified: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { financialVerifiedAt: verified ? new Date() : null },
    });
  }

  async deactivateBankAccount(userId: string, accountId: string): Promise<boolean> {
    const account = await this.prisma.userBankAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
    });
    if (!account) return false;

    await this.prisma.userBankAccount.update({
      where: { id: accountId },
      data: { isActive: false, isDefault: false },
    });

    const remaining = await this.prisma.userBankAccount.findMany({
      where: { userId, isActive: true },
      orderBy: { cardMatchVerifiedAt: 'desc' },
    });

    if (remaining.length === 0) {
      await this.setFinancialVerified(userId, false);
    } else if (account.isDefault) {
      await this.prisma.userBankAccount.update({
        where: { id: remaining[0]!.id },
        data: { isDefault: true },
      });
    }
    return true;
  }

  async saveAddress(
    userId: string,
    postalCode: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = await this.prisma.userAddress.findFirst({
      where: { userId, postalCode },
    });
    const payload = {
      ...(data.fullAddress !== undefined ? { fullAddress: data.fullAddress as string } : {}),
      ...(data.province !== undefined ? { province: data.province as string } : {}),
      ...(data.city !== undefined ? { city: data.city as string } : {}),
      ...(data.district !== undefined ? { district: data.district as string } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude as number } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude as number } : {}),
      ...(data.label !== undefined ? { label: data.label as string } : {}),
    };
    if (existing) {
      return this.prisma.userAddress.update({
        where: { id: existing.id },
        data: payload,
      });
    }
    return this.prisma.userAddress.create({
      data: { userId, postalCode, ...payload },
    });
  }

  async upsertKycDocument(userId: string, type: string, fileUrl: string): Promise<unknown> {
    const existing = await this.prisma.kycDocument.findFirst({
      where: {
        userId,
        type,
        status: { in: [KycStatus.PENDING, KycStatus.APPROVED] },
      },
    });
    if (existing?.status === KycStatus.APPROVED) {
      throw new ValidationError('Document already verified');
    }
    if (existing) {
      return this.prisma.kycDocument.update({
        where: { id: existing.id },
        data: { fileUrl, status: KycStatus.PENDING, rejectionReason: null },
      });
    }
    return this.prisma.kycDocument.create({
      data: { userId, type, fileUrl, status: KycStatus.PENDING },
    });
  }

  async reviewDocument(
    adminId: string,
    documentId: string,
    status: string,
    rejectionReason?: string,
  ): Promise<{ userId: string } | null> {
    const document = await this.prisma.kycDocument.findUnique({ where: { id: documentId } });
    if (!document) return null;

    await this.prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: status as KycStatus,
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: status === 'REJECTED' ? (rejectionReason ?? null) : null,
      },
    });
    return { userId: document.userId };
  }

  async upgradeKycLevelIfNeeded(userId: string): Promise<void> {
    const documents = await this.prisma.kycDocument.findMany({
      where: { userId, status: KycStatus.APPROVED },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kycLevel: true, identityProfile: { select: { nationalIdHash: true } } },
    });
    if (!user) return;

    const hasNationalId = documents.some((d) => d.type === 'national_id');
    const hasPassport = documents.some((d) => d.type === 'passport');
    const hasSelfie = documents.some((d) => d.type === 'selfie');
    const hasAddressProof = documents.some((d) => d.type === 'address_proof');

    let newLevel: KycLevel = KycLevel.MOBILE_VERIFIED;
    if (user.identityProfile?.nationalIdHash) {
      newLevel = KycLevel.IDENTITY_VERIFIED;
    }
    if ((hasNationalId || hasPassport) && newLevel === KycLevel.IDENTITY_VERIFIED) {
      newLevel = KycLevel.DOCUMENT_VERIFIED;
    }
    if (hasSelfie && newLevel === KycLevel.DOCUMENT_VERIFIED) {
      newLevel = KycLevel.FACE_VERIFIED;
    }
    if (hasAddressProof && newLevel === KycLevel.FACE_VERIFIED) {
      newLevel = KycLevel.FULLY_VERIFIED;
    }

    const levels: KycLevel[] = [
      KycLevel.NONE,
      KycLevel.MOBILE_VERIFIED,
      KycLevel.IDENTITY_VERIFIED,
      KycLevel.DOCUMENT_VERIFIED,
      KycLevel.FACE_VERIFIED,
      KycLevel.FULLY_VERIFIED,
    ];
    const currentIndex = levels.indexOf(user.kycLevel);
    const newIndex = levels.indexOf(newLevel);
    if (newIndex > currentIndex) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { kycLevel: newLevel },
      });
    }
  }

  encryptNationalId(nationalId: string): { hash: string; ciphertext: string } {
    const normalized = nationalId.trim();
    return {
      hash: hashPii(normalized),
      ciphertext: encryptPii(normalized, this.piiKey),
    };
  }

  encryptCard(cardNumber: string): { hash: string; ciphertext: string } {
    const digits = cardNumber.replace(/\D/g, '');
    return {
      hash: hashPii(digits),
      ciphertext: encryptPii(digits, this.piiKey),
    };
  }

  encryptIban(iban: string): { hash: string; ciphertext: string } {
    const normalized = iban.replace(/\s/g, '').toUpperCase();
    return {
      hash: hashPii(normalized),
      ciphertext: encryptPii(normalized, this.piiKey),
    };
  }
}

function parseBirthDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const year = Number(trimmed.split('-')[0]);
    if (year >= 1300 && year <= 1500) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
