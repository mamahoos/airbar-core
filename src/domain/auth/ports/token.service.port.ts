import type { AuthUser } from '../auth-user.js';

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface JwtPayload {
  readonly sub: string;
  readonly phone: string;
  readonly role: string;
}

export interface TokenServicePort {
  signAccessToken(user: Pick<AuthUser, 'id' | 'phone' | 'role'>): string;
  signRefreshToken(user: Pick<AuthUser, 'id' | 'phone' | 'role'>): string;
  verifyRefreshToken(token: string): JwtPayload;
  getAccessTokenExpiresInSeconds(): number;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
