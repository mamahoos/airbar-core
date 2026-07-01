import { Inject, Injectable } from '@nestjs/common';

import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../domain/auth/ports/session.repository.port.js';

@Injectable()
export class ListSessionsUseCase {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort) {}

  async execute(userId: string) {
    const sessions = await this.sessions.listActiveForUser(userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }
}
