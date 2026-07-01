import { Inject, Injectable } from '@nestjs/common';

import { API_IR, type ApiIrPort } from '../../domain/kyc/api-ir.port.js';
import { KYC_REPOSITORY, type KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../../domain/storage/object-storage.port.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

const VALID_DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'driver_license',
  'selfie',
  'address_proof',
] as const;

@Injectable()
export class VerifyBankCardUseCase {
  constructor(
    @Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort,
    @Inject(API_IR) private readonly apiIr: ApiIrPort,
  ) {}

  async execute(userId: string, cardNumber: string) {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length !== 16) {
      throw new ValidationError('شماره کارت باید ۱۶ رقم باشد');
    }

    const identity = await this.kyc.findIdentityByUserId(userId);
    if (!identity) {
      throw new ValidationError('کد ملی یافت نشد');
    }

    const nationalId = this.kyc.decryptNationalId(identity.nationalIdCiphertext);
    const birthDateJalali = identity.birthDateJalali;
    if (!birthDateJalali) {
      throw new ValidationError(
        'تاریخ تولد ثبت نشده است. لطفاً یک‌بار دیگر تأیید هویت را با تاریخ تولد شناسنامه انجام دهید.',
      );
    }

    const cardMatch = await this.apiIr.cardMatch(digits, nationalId, birthDateJalali);
    if (!cardMatch.isMatch) {
      const rawMessage =
        cardMatch.raw && typeof cardMatch.raw === 'object' && cardMatch.raw !== null
          ? (cardMatch.raw as Record<string, unknown>).message
          : undefined;
      const apiMessage = typeof rawMessage === 'string' ? rawMessage : '';
      throw new ValidationError(apiMessage || 'کارت بانکی با کد ملی و تاریخ تولد مطابقت ندارد');
    }

    const cardToIban = await this.apiIr.cardToIban(digits);
    if (!cardToIban.iban) {
      throw new ValidationError('دریافت شماره شبا از کارت بانکی ناموفق بود');
    }

    const cardEnc = this.kyc.encryptCard(digits);
    const ibanEnc = this.kyc.encryptIban(cardToIban.iban);

    await this.kyc.upsertBankAccount({
      userId,
      cardNumberHash: cardEnc.hash,
      cardNumberMasked: `****${digits.slice(-4)}`,
      cardNumberCiphertext: cardEnc.ciphertext,
      ibanHash: ibanEnc.hash,
      ibanCiphertext: ibanEnc.ciphertext,
      bankName: cardToIban.bankName ?? null,
      accountHolderName: cardToIban.accountHolderName ?? null,
    });

    return {
      verified: true,
      bankName: cardToIban.bankName,
      cardNumberMasked: `****${digits.slice(-4)}`,
      accountHolderName: cardToIban.accountHolderName,
    };
  }
}

@Injectable()
export class DeleteBankAccountUseCase {
  constructor(@Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort) {}

  async execute(userId: string, accountId: string) {
    const ok = await this.kyc.deactivateBankAccount(userId, accountId);
    if (!ok) throw new NotFoundError('Bank account', accountId);
    return { success: true };
  }
}

@Injectable()
export class LookupPostalCodeUseCase {
  constructor(
    @Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort,
    @Inject(API_IR) private readonly apiIr: ApiIrPort,
  ) {}

  async execute(userId: string, postalCode: string, label?: string) {
    const code = postalCode.replace(/\D/g, '');
    if (code.length !== 10) {
      throw new ValidationError('کد پستی باید ۱۰ رقم باشد');
    }

    const [info, location] = await Promise.all([
      this.apiIr.postalCodeInfo(code),
      this.apiIr.postalCodeLocation(code),
    ]);

    return this.kyc.saveAddress(userId, code, {
      fullAddress: info.fullAddress,
      province: info.province,
      city: info.city,
      district: info.district,
      latitude: location.latitude,
      longitude: location.longitude,
      label,
    });
  }
}

@Injectable()
export class UploadKycDocumentUseCase {
  constructor(
    @Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async execute(userId: string, type: string, file: Buffer, fileName: string) {
    if (!VALID_DOCUMENT_TYPES.includes(type as (typeof VALID_DOCUMENT_TYPES)[number])) {
      throw new ValidationError('Invalid document type');
    }

    const objectName = await this.storage.upload(file, fileName, `kyc/${userId}`, false);
    const fileUrl = await this.storage.getSignedUrl(objectName, 86400 * 7);
    return this.kyc.upsertKycDocument(userId, type, fileUrl);
  }
}

@Injectable()
export class ReviewKycDocumentUseCase {
  constructor(@Inject(KYC_REPOSITORY) private readonly kyc: KycRepositoryPort) {}

  async execute(adminId: string, documentId: string, status: string, rejectionReason?: string) {
    const result = await this.kyc.reviewDocument(adminId, documentId, status, rejectionReason);
    if (!result) throw new NotFoundError('KYC document', documentId);
    if (status === 'APPROVED') {
      await this.kyc.upgradeKycLevelIfNeeded(result.userId);
    }
    return { success: true };
  }
}
