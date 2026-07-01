import type { KycLevel } from './kyc-level.js';
import type { UserRole } from './user-role.js';

/** Auth-facing user aggregate slice — extended profile fields land in N3. */
export interface AuthUser {
  readonly id: string;
  readonly phone: string;
  readonly email: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly passwordHash: string | null;
  readonly role: UserRole;
  readonly kycLevel: KycLevel;
  readonly isBanned: boolean;
  readonly lastLoginAt: Date | null;
  readonly lastLoginIp: string | null;
  readonly createdAt: Date;
}
