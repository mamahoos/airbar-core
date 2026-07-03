import { Inject, Injectable } from '@nestjs/common';

import {
  ADMIN_REPOSITORY,
  type AdminListLogsFilter,
  type AdminListShipmentsFilter,
  type AdminListTrustEventsFilter,
  type AdminListUsersFilter,
  type AdminRepositoryPort,
  type PricingRuleInput,
} from '../../domain/admin/admin.repository.port.js';
import { assertPricingRuleFloor } from '../../domain/marketplace/pricing-calculator.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';

import type { UserRole } from '@prisma/client';

@Injectable()
export class GetAdminDashboardUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute() {
    return this.admin.getDashboardStats();
  }
}

@Injectable()
export class ListAdminUsersUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(filter: AdminListUsersFilter) {
    const { page, limit } = normalizePagination(filter);
    const { data, total } = await this.admin.listUsers({ ...filter, page, limit });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }
}

@Injectable()
export class GetAdminUserDetailUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(userId: string) {
    const user = await this.admin.getUserDetail(userId);
    if (!user) throw new NotFoundError('User', userId);
    return user;
  }
}

@Injectable()
export class UpdateAdminUserRoleUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute(userId: string, role: UserRole) {
    return this.admin.updateUserRole(userId, role);
  }
}

@Injectable()
export class BanAdminUserUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute(userId: string, reason: string) {
    return this.admin.banUser(userId, reason);
  }
}

@Injectable()
export class UnbanAdminUserUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute(userId: string) {
    return this.admin.unbanUser(userId);
  }
}

@Injectable()
export class ListAdminShipmentsUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(filter: AdminListShipmentsFilter) {
    const { page, limit } = normalizePagination(filter);
    const { data, total } = await this.admin.listShipments({ ...filter, page, limit });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }
}

@Injectable()
export class ListAdminDisputesUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute() {
    return this.admin.listDisputes();
  }
}

@Injectable()
export class ListAdminPendingKycUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(page?: number, limit?: number) {
    const { page: p, limit: l } = normalizePagination({ page, limit });
    const { data, total } = await this.admin.listPendingKyc(p, l);
    return { data, pagination: buildPaginationMeta(total, p, l) };
  }
}

@Injectable()
export class ListAdminActivityLogsUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(filter: AdminListLogsFilter) {
    const { page, limit } = normalizePagination({ page: filter.page, limit: filter.limit ?? 50 });
    const { data, total } = await this.admin.listActivityLogs({ ...filter, page, limit });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }
}

const TRUST_EVENT_REVIEW_STATUSES = new Set(['PENDING', 'RESOLVED', 'DISMISSED']);

@Injectable()
export class ListAdminTrustEventsUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(filter: AdminListTrustEventsFilter) {
    const { page, limit } = normalizePagination({ page: filter.page, limit: filter.limit ?? 50 });
    const reviewStatus = this.parseStatus(filter.reviewStatus);
    const { data, total } = await this.admin.listTrustEvents({
      ...filter,
      page,
      limit,
      ...(reviewStatus ? { reviewStatus } : {}),
    });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }

  private parseStatus(status?: string): string | undefined {
    const normalized = status?.trim().toUpperCase();
    if (!normalized) return undefined;
    if (!TRUST_EVENT_REVIEW_STATUSES.has(normalized)) {
      throw new ValidationError('Invalid trust event review status');
    }
    return normalized;
  }
}

@Injectable()
export class GetAdminTrustEventUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(id: string) {
    const event = await this.admin.getTrustEvent(id);
    if (!event) throw new NotFoundError('TrustEvent', id);
    return event;
  }
}

@Injectable()
export class ReviewAdminTrustEventUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(id: string, adminId: string, status: string, note?: string) {
    const normalized = status.trim().toUpperCase();
    if (!TRUST_EVENT_REVIEW_STATUSES.has(normalized) || normalized === 'PENDING') {
      throw new ValidationError('Invalid trust event review decision');
    }
    return this.admin.reviewTrustEvent(id, adminId, normalized, note?.trim() || undefined);
  }
}

@Injectable()
export class GetAdminSystemConfigUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  async execute(key: string) {
    const config = await this.admin.getSystemConfig(key);
    if (!config) throw new NotFoundError('SystemConfig', key);
    return config;
  }
}

@Injectable()
export class UpdateAdminSystemConfigUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute(adminId: string, key: string, value: unknown) {
    return this.admin.upsertSystemConfig(key, value, adminId);
  }
}

@Injectable()
export class ListAdminPricingRulesUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute() {
    return this.admin.listPricingRules();
  }
}

@Injectable()
export class CreateAdminPricingRuleUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute(input: PricingRuleInput) {
    assertPricingRuleInput(input);
    return this.admin.createPricingRule(input);
  }
}

@Injectable()
export class UpdateAdminPricingRuleUseCase {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepositoryPort) {}

  execute(id: string, input: Partial<PricingRuleInput>) {
    assertPricingRuleInput(input);
    return this.admin.updatePricingRule(id, input);
  }
}

function assertPricingRuleInput(input: Partial<PricingRuleInput>): void {
  try {
    assertPricingRuleFloor(input);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : 'Invalid pricing rule');
  }
}
