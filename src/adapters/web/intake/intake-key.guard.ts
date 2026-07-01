import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { APP_CONFIG } from '../../../bootstrap/config/index.js';

import type { AppConfig } from '../../../bootstrap/config/index.js';

@Injectable()
export class IntakeKeyGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.intakeApiKey;
    if (!expected) {
      throw new UnauthorizedException('Intake endpoint is not configured');
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = req.headers['x-intake-key'];
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid intake key');
    }
    return true;
  }
}
