import { Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ListSessionsUseCase } from '../../../application/auth/list-sessions.use-case.js';
import { LoginUseCase } from '../../../application/auth/login.use-case.js';
import { LogoutUseCase } from '../../../application/auth/logout.use-case.js';
import { OtpCodeService } from '../../../application/auth/otp-code.service.js';
import { OtpRateLimiter } from '../../../application/auth/otp-rate-limiter.js';
import { RefreshTokenUseCase } from '../../../application/auth/refresh-token.use-case.js';
import { RegisterUseCase } from '../../../application/auth/register.use-case.js';
import { SendOtpUseCase } from '../../../application/auth/send-otp.use-case.js';
import { SessionManager } from '../../../application/auth/session-manager.js';
import { ValidateUserUseCase } from '../../../application/auth/validate-user.use-case.js';
import { VerifyOtpUseCase } from '../../../application/auth/verify-otp.use-case.js';
import { APP_CONFIG } from '../../../bootstrap/config/index.js';
import { SMS_SENDER } from '../../../domain/auth/ports/sms.sender.port.js';
import { TOKEN_SERVICE } from '../../../domain/auth/ports/token.service.port.js';
import { JwtTokenService } from '../../auth/jwt-token.service.js';
import { AuthPersistenceModule } from '../../persistence/auth/auth-persistence.module.js';
import { DevSmsSender } from '../../sms/dev-sms.sender.js';
import { LimosmsSmsSender } from '../../sms/limosms-sms.sender.js';

import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

import type { AppConfig } from '../../../bootstrap/config/index.js';

const jwtAuthGuardProvider: Provider = {
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
};

const smsSenderProvider: Provider = {
  provide: SMS_SENDER,
  useFactory: (config: AppConfig, dev: DevSmsSender, limosms: LimosmsSmsSender) => {
    if (config.smsProvider === 'limosms') return limosms;
    return dev;
  },
  inject: [APP_CONFIG, DevSmsSender, LimosmsSmsSender],
};

@Module({
  imports: [
    AuthPersistenceModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: config.jwtExpiresIn as `${number}d` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    DevSmsSender,
    LimosmsSmsSender,
    smsSenderProvider,
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    OtpRateLimiter,
    OtpCodeService,
    SessionManager,
    SendOtpUseCase,
    VerifyOtpUseCase,
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    ListSessionsUseCase,
    ValidateUserUseCase,
    JwtStrategy,
    RolesGuard,
    jwtAuthGuardProvider,
  ],
  exports: [RolesGuard, TOKEN_SERVICE],
})
export class AuthModule {}
