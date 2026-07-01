import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as bcrypt from 'bcrypt';

import { KycLevel } from '../../domain/auth/kyc-level.js';
import { UserRole } from '../../domain/auth/user-role.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

import { LoginUseCase } from './login.use-case.js';

const user = {
  id: 'u1',
  phone: '09123456789',
  email: null,
  firstName: null,
  lastName: null,
  passwordHash: '',
  role: UserRole.USER,
  kycLevel: KycLevel.NONE,
  isBanned: false,
  lastLoginAt: null,
  lastLoginIp: null,
  createdAt: new Date(),
};

describe('LoginUseCase', () => {
  let users: { findByPhone: jest.Mock; updateLastLogin: jest.Mock };
  let activity: { log: jest.Mock };
  let sessions: {
    issueTokens: jest.Mock;
    createSession: jest.Mock;
  };
  let useCase: LoginUseCase;

  beforeEach(async () => {
    user.passwordHash = await bcrypt.hash('secret123', 4);
    users = {
      findByPhone: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    activity = { log: jest.fn() };
    sessions = {
      issueTokens: jest.fn().mockReturnValue({
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 3600,
      }),
      createSession: jest.fn(),
    };
    useCase = new LoginUseCase(users as never, activity as never, sessions as never);
  });

  it('returns tokens for valid credentials', async () => {
    users.findByPhone.mockResolvedValue(user);
    const result = await useCase.execute({
      phone: user.phone,
      password: 'secret123',
      ipAddress: '127.0.0.1',
    });
    expect(result.accessToken).toBe('a');
    expect(sessions.createSession).toHaveBeenCalled();
  });

  it('rejects invalid password', async () => {
    users.findByPhone.mockResolvedValue(user);
    await expect(
      useCase.execute({ phone: user.phone, password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
