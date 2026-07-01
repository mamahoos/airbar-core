import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import {
  ACTIVITY_LOG_REPOSITORY,
  type ActivityLogRepositoryPort,
} from '../../domain/auth/ports/activity-log.repository.port.js';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../domain/auth/ports/user.repository.port.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

import { SessionManager, type DeviceContext } from './session-manager.js';

export interface LoginInput extends DeviceContext {
  readonly phone: string;
  readonly password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACTIVITY_LOG_REPOSITORY) private readonly activity: ActivityLogRepositoryPort,
    private readonly sessions: SessionManager,
  ) {}

  async execute(input: LoginInput) {
    const user = await this.users.findByPhone(input.phone);
    if (!user?.passwordHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedError('Your account has been suspended');
    }

    const tokens = this.sessions.issueTokens(user);
    await this.sessions.createSession(user.id, tokens.refreshToken, input);
    await this.users.updateLastLogin(user.id, input.ipAddress);

    await this.activity.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'user',
      resourceId: user.id,
      details: { method: 'password', ip: input.ipAddress },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return tokens;
  }
}
