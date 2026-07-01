import { Module } from '@nestjs/common';

import { ACTIVITY_LOG_REPOSITORY } from '../../../domain/auth/ports/activity-log.repository.port.js';
import { OTP_REPOSITORY } from '../../../domain/auth/ports/otp.repository.port.js';
import { SESSION_REPOSITORY } from '../../../domain/auth/ports/session.repository.port.js';
import { USER_REPOSITORY } from '../../../domain/auth/ports/user.repository.port.js';

import { PrismaActivityLogRepository } from './prisma-activity-log.repository.js';
import { PrismaOtpRepository } from './prisma-otp.repository.js';
import { PrismaSessionRepository } from './prisma-session.repository.js';
import { PrismaUserRepository } from './prisma-user.repository.js';

@Module({
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: OTP_REPOSITORY, useClass: PrismaOtpRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: ACTIVITY_LOG_REPOSITORY, useClass: PrismaActivityLogRepository },
  ],
  exports: [USER_REPOSITORY, OTP_REPOSITORY, SESSION_REPOSITORY, ACTIVITY_LOG_REPOSITORY],
})
export class AuthPersistenceModule {}
