import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { KycAccessService } from '../../../../application/kyc/kyc-access.service.js';
import {
  KYC_REQUIREMENT_KEY,
  type KycRequirementOptions,
} from '../../../../domain/kyc/kyc-requirement.js';

import type { AuthUser } from '../../../../domain/auth/auth-user.js';

@Injectable()
export class KycLevelGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly kycAccess: KycAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<KycRequirementOptions>(
      KYC_REQUIREMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    await this.kycAccess.assertRequirement(userId, requirement);
    return true;
  }
}
