import type { UserSession } from '../session.js';

export interface CreateSessionInput {
  readonly userId: string;
  readonly token: string;
  readonly deviceInfo?: unknown;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly expiresAt: Date;
}

export interface SessionRepositoryPort {
  create(input: CreateSessionInput): Promise<UserSession>;
  findByUserAndToken(userId: string, token: string): Promise<UserSession | null>;
  updateToken(sessionId: string, token: string, expiresAt: Date): Promise<void>;
  deleteByUserAndToken(userId: string, token: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
  listActiveForUser(userId: string): Promise<readonly UserSession[]>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
