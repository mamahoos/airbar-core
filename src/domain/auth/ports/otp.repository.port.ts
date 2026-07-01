export interface OtpRecord {
  readonly id: string;
  readonly phone: string;
  readonly code: string;
  readonly attempts: number;
  readonly verified: boolean;
  readonly expiresAt: Date;
}

export interface OtpRepositoryPort {
  invalidateActive(phone: string): Promise<void>;
  create(phone: string, code: string, expiresAt: Date): Promise<void>;
  findActive(phone: string, code: string): Promise<OtpRecord | null>;
  incrementAttempts(phone: string): Promise<void>;
  markVerified(id: string): Promise<void>;
  invalidateByCode(phone: string, code: string): Promise<void>;
  getLatestActiveCode(phone: string): Promise<string | null>;
}

export const OTP_REPOSITORY = Symbol('OTP_REPOSITORY');
