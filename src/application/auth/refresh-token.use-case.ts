import { Inject, Injectable } from '@nestjs/common';

import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../domain/auth/ports/session.repository.port.js';
import {
  TOKEN_SERVICE,
  type TokenServicePort,
} from '../../domain/auth/ports/token.service.port.js';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../domain/auth/ports/user.repository.port.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

import { SessionManager } from './session-manager.js';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly sessionManager: SessionManager,
  ) {}

  async execute(refreshToken: string) {
    try {
      const payload = this.tokens.verifyRefreshToken(refreshToken);
      const session = await this.sessions.findByUserAndToken(payload.sub, refreshToken);
      if (!session || session.expiresAt <= new Date()) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const user = await this.users.findById(payload.sub);
      if (!user || user.isBanned) {
        throw new UnauthorizedError('Your account has been suspended');
      }

      return this.sessionManager.rotateSession(session.id, user);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }
}
