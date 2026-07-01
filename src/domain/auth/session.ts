export interface UserSession {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly deviceInfo: unknown;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
