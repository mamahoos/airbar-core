import type { ShipmentStatus, UserRole } from '@prisma/client';

export const ADMIN_REPOSITORY = Symbol('ADMIN_REPOSITORY');

export interface AdminDashboardStats {
  readonly users: { readonly total: number; readonly active: number; readonly todayNew: number };
  readonly trips: { readonly total: number; readonly active: number };
  readonly shipments: {
    readonly total: number;
    readonly pending: number;
    readonly disputed: number;
    readonly today: number;
  };
}

export interface AdminUserListItem {
  readonly id: string;
  readonly phone: string;
  readonly email: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly role: UserRole;
  readonly kycLevel: string;
  readonly isActive: boolean;
  readonly isBanned: boolean;
  readonly rating: number;
  readonly totalTrips: number;
  readonly totalShipments: number;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

export interface AdminListUsersFilter {
  readonly search?: string | undefined;
  readonly role?: UserRole | undefined;
  readonly isBanned?: boolean | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface AdminListShipmentsFilter {
  readonly status?: ShipmentStatus | undefined;
  readonly search?: string | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface AdminListLogsFilter {
  readonly userId?: string | undefined;
  readonly action?: string | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface AdminListTrustEventsFilter {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  readonly reviewStatus?: string | undefined;
  readonly type?: string | undefined;
  readonly severity?: string | undefined;
  readonly userId?: string | undefined;
  readonly shipmentId?: string | undefined;
  readonly chatId?: string | undefined;
}

export interface PricingRuleInput {
  readonly name: string;
  readonly description?: string | undefined;
  readonly originCountry?: string | null | undefined;
  readonly destinationCountry?: string | null | undefined;
  readonly cargoType?: string | null | undefined;
  readonly basePrice: number;
  readonly pricePerKg: number;
  readonly pricePerKm?: number | null | undefined;
  readonly riskMultiplier?: number | undefined;
  readonly platformFeePercent?: number | undefined;
  readonly minPlatformFee?: number | undefined;
  readonly isActive?: boolean | undefined;
  readonly priority?: number | undefined;
}

export interface AdminRepositoryPort {
  getDashboardStats(): Promise<AdminDashboardStats>;
  listUsers(
    filter: AdminListUsersFilter,
  ): Promise<{ data: readonly AdminUserListItem[]; total: number }>;
  getUserDetail(userId: string): Promise<unknown>;
  updateUserRole(userId: string, role: UserRole): Promise<unknown>;
  banUser(userId: string, reason: string): Promise<unknown>;
  unbanUser(userId: string): Promise<unknown>;
  listShipments(
    filter: AdminListShipmentsFilter,
  ): Promise<{ data: readonly unknown[]; total: number }>;
  listDisputes(): Promise<readonly unknown[]>;
  listPendingKyc(page: number, limit: number): Promise<{ data: readonly unknown[]; total: number }>;
  listActivityLogs(
    filter: AdminListLogsFilter,
  ): Promise<{ data: readonly unknown[]; total: number }>;
  listTrustEvents(
    filter: AdminListTrustEventsFilter,
  ): Promise<{ data: readonly unknown[]; total: number }>;
  getTrustEvent(id: string): Promise<unknown>;
  reviewTrustEvent(id: string, adminId: string, status: string, note?: string): Promise<unknown>;
  getSystemConfig(key: string): Promise<unknown>;
  upsertSystemConfig(key: string, value: unknown, adminId: string): Promise<unknown>;
  listPricingRules(): Promise<readonly unknown[]>;
  createPricingRule(input: PricingRuleInput): Promise<unknown>;
  updatePricingRule(id: string, input: Partial<PricingRuleInput>): Promise<unknown>;
}
