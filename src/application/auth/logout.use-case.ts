import { Inject, Injectable } from '@nestjs/common';

import {
  ACTIVITY_LOG_REPOSITORY,
  type ActivityLogRepositoryPort,
} from '../../domain/auth/ports/activity-log.repository.port.js';
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../domain/auth/ports/session.repository.port.js';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(ACTIVITY_LOG_REPOSITORY) private readonly activity: ActivityLogRepositoryPort,
  ) {}

  async execute(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.sessions.deleteByUserAndToken(userId, refreshToken);
    } else {
      await this.sessions.deleteAllForUser(userId);
    }

    await this.activity.log({
      userId,
      action: 'LOGOUT',
      resource: 'user',
      resourceId: userId,
    });
  }
}
