import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { AuthUser } from '../../domain/auth/auth-user.js';
import type {
  JwtPayload,
  TokenServicePort,
} from '../../domain/auth/ports/token.service.port.js';

const ACCESS_TOKEN_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  signAccessToken(user: Pick<AuthUser, 'id' | 'phone' | 'role'>): string {
    return this.jwt.sign(this.payload(user));
  }

  signRefreshToken(user: Pick<AuthUser, 'id' | 'phone' | 'role'>): string {
    return this.jwt.sign(this.payload(user), {
      secret: this.config.jwtRefreshSecret,
      expiresIn: this.config.jwtRefreshExpiresIn as `${number}d`,
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwt.verify<JwtPayload>(token, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  getAccessTokenExpiresInSeconds(): number {
    return ACCESS_TOKEN_SECONDS;
  }

  private payload(user: Pick<AuthUser, 'id' | 'phone' | 'role'>): JwtPayload {
    return { sub: user.id, phone: user.phone, role: user.role };
  }
}
