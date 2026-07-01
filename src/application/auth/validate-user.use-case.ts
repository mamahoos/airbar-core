import { Inject, Injectable } from '@nestjs/common';

import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../domain/auth/ports/user.repository.port.js';

import type { AuthUser } from '../../domain/auth/auth-user.js';
import type { JwtPayload } from '../../domain/auth/ports/token.service.port.js';

@Injectable()
export class ValidateUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(payload: JwtPayload): Promise<AuthUser | null> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.isBanned) {
      return null;
    }
    return user;
  }
}
