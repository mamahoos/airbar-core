import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../domain/auth/ports/session.repository.port.js';
import {
  TOKEN_SERVICE,
  type TokenPair,
  type TokenServicePort,
} from '../../domain/auth/ports/token.service.port.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { AuthUser } from '../../domain/auth/auth-user.js';

export interface DeviceContext {
  readonly deviceInfo?: unknown;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

@Injectable()
export class SessionManager {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  issueTokens(user: AuthUser): TokenPair {
    return {
      accessToken: this.tokens.signAccessToken(user),
      refreshToken: this.tokens.signRefreshToken(user),
      expiresIn: this.tokens.getAccessTokenExpiresInSeconds(),
    };
  }

  async createSession(userId: string, refreshToken: string, device?: DeviceContext): Promise<void> {
    const expiresAt = this.refreshExpiresAt();
    await this.sessions.create({
      userId,
      token: refreshToken,
      deviceInfo: device?.deviceInfo,
      ipAddress: device?.ipAddress,
      userAgent: device?.userAgent,
      expiresAt,
    });
  }

  async rotateSession(
    sessionId: string,
    user: AuthUser,
  ): Promise<TokenPair> {
    const tokens = this.issueTokens(user);
    await this.sessions.updateToken(sessionId, tokens.refreshToken, this.refreshExpiresAt());
    return tokens;
  }

  private refreshExpiresAt(): Date {
    const days = parseRefreshDays(this.config.jwtRefreshExpiresIn);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

function parseRefreshDays(value: string): number {
  const match = /^(\d+)d$/.exec(value.trim());
  if (match) return Number.parseInt(match[1]!, 10);
  return 30;
}
