export interface IdentityProfileRecord {
  readonly userId: string;
  readonly nationalIdHash: string;
  readonly nationalIdCiphertext: string;
  readonly firstNameOfficial: string | null;
  readonly lastNameOfficial: string | null;
  readonly fatherName: string | null;
  readonly birthDateJalali: string | null;
  readonly gender: string | null;
  readonly shahkarVerifiedAt: Date | null;
  readonly personInfoVerifiedAt: Date | null;
  readonly identityPendingPersonInfo: boolean;
  readonly personInfoRaw: unknown;
}

export interface KycSnapshot {
  readonly kycLevel: string;
  readonly hasNationalId: boolean;
  readonly financialVerified: boolean;
}

export interface UpsertIdentityInput {
  readonly userId: string;
  readonly nationalIdHash: string;
  readonly nationalIdCiphertext: string;
  readonly firstNameOfficial: string | null;
  readonly lastNameOfficial: string | null;
  readonly fatherName: string | null;
  readonly birthDateJalali: string | null;
  readonly gender: string | null;
  readonly isAlive: boolean | null;
  readonly personInfoRaw: unknown;
  readonly identityPendingPersonInfo: boolean;
  readonly shahkarVerifiedAt: Date;
  readonly personInfoVerifiedAt: Date | null;
  readonly userFirstName?: string | undefined;
  readonly userLastName?: string | undefined;
}

export interface KycRepositoryPort {
  getUserPhone(userId: string): Promise<string | null>;
  getKycSnapshot(userId: string): Promise<KycSnapshot | null>;
  findIdentityByUserId(userId: string): Promise<IdentityProfileRecord | null>;
  findIdentityByNationalIdHash(hash: string, excludeUserId?: string): Promise<string | null>;
  upsertIdentity(input: UpsertIdentityInput): Promise<void>;
  getKycStatus(userId: string): Promise<unknown>;
  upsertBankAccount(input: {
    readonly userId: string;
    readonly cardNumberHash: string;
    readonly cardNumberMasked: string;
    readonly cardNumberCiphertext: string;
    readonly ibanHash: string;
    readonly ibanCiphertext: string;
    readonly bankName: string | null;
    readonly accountHolderName: string | null;
  }): Promise<void>;
  setFinancialVerified(userId: string, verified: boolean): Promise<void>;
  deactivateBankAccount(userId: string, accountId: string): Promise<boolean>;
  saveAddress(userId: string, postalCode: string, data: Record<string, unknown>): Promise<unknown>;
  upsertKycDocument(userId: string, type: string, fileUrl: string): Promise<unknown>;
  reviewDocument(
    adminId: string,
    documentId: string,
    status: string,
    rejectionReason?: string,
  ): Promise<{ userId: string } | null>;
  decryptNationalId(ciphertext: string): string;
  encryptNationalId(nationalId: string): { hash: string; ciphertext: string };
  encryptCard(cardNumber: string): { hash: string; ciphertext: string };
  encryptIban(iban: string): { hash: string; ciphertext: string };
  upgradeKycLevelIfNeeded(userId: string): Promise<void>;
}

export const KYC_REPOSITORY = Symbol('KYC_REPOSITORY');
