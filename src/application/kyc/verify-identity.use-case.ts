import { Inject, Injectable } from '@nestjs/common';

import { API_IR, type ApiIrPort } from '../../domain/kyc/api-ir.port.js';
import { KYC_REPOSITORY, type KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';
import { ConflictError, ValidationError } from '../../shared/errors/index.js';
import { isIranianPhone } from '../../shared/phone/index.js';

@Injectable()
export class VerifyIdentityUseCase {
  constructor(
    @Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort,
    @Inject(API_IR) private readonly apiIr: ApiIrPort,
  ) {}

  async execute(userId: string, phone: string | undefined, nationalId: string, birthDate: string) {
    const normalizedNationalId = nationalId.trim().replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalizedNationalId)) {
      throw new ValidationError('کد ملی نامعتبر است');
    }
    if (!birthDate?.trim()) {
      throw new ValidationError('تاریخ تولد الزامی است');
    }

    let resolvedPhone = phone;
    if (!resolvedPhone) {
      resolvedPhone = (await this.kyc.getUserPhone(userId)) ?? undefined;
    }
    if (!resolvedPhone) {
      throw new ValidationError('شماره موبایل کاربر یافت نشد');
    }
    if (!isIranianPhone(resolvedPhone)) {
      throw new ValidationError('تأیید هویت شاهکار فقط برای شماره موبایل ایران فعال است');
    }

    const nationalIdHash = this.kyc.encryptNationalId(normalizedNationalId).hash;
    const takenBy = await this.kyc.findIdentityByNationalIdHash(nationalIdHash, userId);
    if (takenBy) {
      throw new ValidationError('کد ملی قبلاً برای حساب دیگری ثبت شده است');
    }

    const existing = await this.kyc.findIdentityByUserId(userId);
    if (existing?.shahkarVerifiedAt) {
      const existingNationalId = this.kyc.decryptNationalId(existing.nationalIdCiphertext);
      if (!existing.identityPendingPersonInfo) {
        if (existingNationalId !== normalizedNationalId) {
          throw new ConflictError('کد ملی تأیید‌شده قابل تغییر نیست');
        }
        return {
          verified: true,
          message: 'قبلاً تأیید شده است',
          firstName: existing.firstNameOfficial ?? undefined,
          lastName: existing.lastNameOfficial ?? undefined,
        };
      }
      if (existingNationalId !== normalizedNationalId) {
        throw new ConflictError('کد ملی تأیید‌شده قابل تغییر نیست');
      }
    }

    const shahkar = await this.apiIr.shahkar(resolvedPhone, normalizedNationalId);
    if (!shahkar.isMatch) {
      throw new ValidationError(shahkar.errorMessage ?? 'کد ملی با شماره موبایل مطابقت ندارد');
    }

    const personInfo = await this.apiIr.personInfo(normalizedNationalId, birthDate);
    if (!personInfo.firstName || !personInfo.lastName) {
      throw new ValidationError('دریافت نام و نام خانوادگی رسمی از کد ملی ناموفق بود');
    }
    const identityPendingPersonInfo = false;
    const encrypted = this.kyc.encryptNationalId(normalizedNationalId);
    const now = new Date();

    await this.kyc.upsertIdentity({
      userId,
      nationalIdHash: encrypted.hash,
      nationalIdCiphertext: encrypted.ciphertext,
      firstNameOfficial: personInfo.firstName ?? null,
      lastNameOfficial: personInfo.lastName ?? null,
      fatherName: personInfo.fatherName ?? null,
      birthDateJalali: personInfo.birthDate ?? birthDate.trim(),
      gender: personInfo.gender ?? null,
      isAlive: personInfo.isAlive ?? null,
      personInfoRaw: personInfo.raw ?? {},
      identityPendingPersonInfo,
      shahkarVerifiedAt: now,
      personInfoVerifiedAt: identityPendingPersonInfo ? null : now,
      ...(personInfo.firstName ? { userFirstName: personInfo.firstName } : {}),
      ...(personInfo.lastName ? { userLastName: personInfo.lastName } : {}),
    });

    return {
      verified: true,
      message: identityPendingPersonInfo
        ? 'شاهکار تأیید شد. اطلاعات هویتی در حال تکمیل است.'
        : 'هویت با موفقیت تأیید شد',
      identityPendingPersonInfo,
      firstName: personInfo.firstName,
      lastName: personInfo.lastName,
    };
  }
}
