import type { AuthUser } from '../auth-user.js';
import type { KycLevel } from '../kyc-level.js';

export interface CreateUserInput {
  readonly phone: string;
  readonly email?: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly passwordHash?: string | undefined;
  readonly kycLevel?: KycLevel | undefined;
}

export interface UserRepositoryPort {
  findById(id: string): Promise<AuthUser | null>;
  findByPhone(phone: string): Promise<AuthUser | null>;
  create(input: CreateUserInput): Promise<AuthUser>;
  updateLastLogin(id: string, ipAddress: string | undefined): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
