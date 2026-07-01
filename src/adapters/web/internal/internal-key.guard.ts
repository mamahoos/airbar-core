import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { APP_CONFIG } from '../../../bootstrap/config/index.js';

import type { AppConfig } from '../../../bootstrap/config/index.js';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const key = req.headers['x-internal-key'];
    const expected = this.config.internalApiKey ?? this.config.intakeApiKey;
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid internal key');
    }
    return true;
  }
}
