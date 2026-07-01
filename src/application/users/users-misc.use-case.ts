import { Inject, Injectable } from '@nestjs/common';

import {
  ACTIVITY_LOG_REPOSITORY,
  type ActivityLogRepositoryPort,
} from '../../domain/auth/ports/activity-log.repository.port.js';
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../domain/auth/ports/session.repository.port.js';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../../domain/users/user-profile.repository.port.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { buildPaginationMeta, toSkipTake } from '../../shared/pagination/index.js';

@Injectable()
export class GetPublicProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepositoryPort,
  ) {}

  async execute(userId: string) {
    const profile = await this.profiles.getPublicProfile(userId);
    if (!profile) throw new NotFoundError('User', userId);
    return profile;
  }
}

@Injectable()
export class ListActivityLogsUseCase {
  constructor(
    @Inject(ACTIVITY_LOG_REPOSITORY) private readonly activity: ActivityLogRepositoryPort,
  ) {}

  async execute(userId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = toSkipTake({ page, limit });
    const { items, total } = await this.activity.listForUser(userId, skip, take);
    return {
      data: items,
      pagination: buildPaginationMeta(total, p, l),
    };
  }
}

@Injectable()
export class RevokeSessionUseCase {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort) {}

  async execute(userId: string, sessionId: string) {
    const revoked = await this.sessions.deleteByIdForUser(userId, sessionId);
    if (!revoked) throw new NotFoundError('Session', sessionId);
    return { message: 'Session revoked' };
  }
}
