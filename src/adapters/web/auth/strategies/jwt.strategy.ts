import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ValidateUserUseCase } from '../../../../application/auth/validate-user.use-case.js';
import { APP_CONFIG } from '../../../../bootstrap/config/index.js';

import type { AppConfig } from '../../../../bootstrap/config/index.js';
import type { JwtPayload } from '../../../../domain/auth/ports/token.service.port.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly validateUser: ValidateUserUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.validateUser.execute(payload);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
