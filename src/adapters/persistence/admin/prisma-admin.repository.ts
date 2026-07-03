import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type {
  AdminDashboardStats,
  AdminListLogsFilter,
  AdminListShipmentsFilter,
  AdminListTrustEventsFilter,
  AdminListUsersFilter,
  AdminRepositoryPort,
  PricingRuleInput,
} from '../../../domain/admin/admin.repository.port.js';
import type { CargoType, Prisma, UserRole } from '@prisma/client';

@Injectable()
export class PrismaAdminRepository implements AdminRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      todayNewUsers,
      totalTrips,
      activeTrips,
      totalShipments,
      pendingShipments,
      disputedShipments,
      todayShipments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true, isBanned: false } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.trip.count(),
      this.prisma.trip.count({ where: { status: 'ACTIVE' } }),
      this.prisma.shipment.count(),
      this.prisma.shipment.count({ where: { status: 'PENDING' } }),
      this.prisma.shipment.count({ where: { status: 'DISPUTED' } }),
      this.prisma.shipment.count({ where: { createdAt: { gte: startOfDay } } }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, todayNew: todayNewUsers },
      trips: { total: totalTrips, active: activeTrips },
      shipments: {
        total: totalShipments,
        pending: pendingShipments,
        disputed: disputedShipments,
        today: todayShipments,
      },
    };
  }

  async listUsers(filter: AdminListUsersFilter) {
    const where: Prisma.UserWhereInput = {};
    if (filter.search) {
      where.OR = [
        { phone: { contains: filter.search } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.role) where.role = filter.role;
    if (filter.isBanned !== undefined) where.isBanned = filter.isBanned;

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          kycLevel: true,
          isActive: true,
          isBanned: true,
          rating: true,
          totalTrips: true,
          totalShipments: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  async getUserDetail(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: true,
        sessions: {
          select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        _count: { select: { trips: true, sentShipments: true, carriedShipments: true } },
      },
    });
  }

  async updateUserRole(userId: string, role: UserRole) {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async banUser(userId: string, reason: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, banReason: reason },
    });
  }

  async unbanUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, banReason: null },
    });
  }

  async listShipments(filter: AdminListShipmentsFilter) {
    const where: Prisma.ShipmentWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { trackingCode: { contains: filter.search, mode: 'insensitive' } },
        { originCity: { contains: filter.search, mode: 'insensitive' } },
        { destinationCity: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, phone: true } },
          carrier: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return { data, total };
  }

  async listDisputes() {
    return this.prisma.shipment.findMany({
      where: { status: 'DISPUTED' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, phone: true } },
        carrier: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { disputedAt: 'desc' },
    });
  }

  async listPendingKyc(page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.prisma.kycDocument.findMany({
        where: { status: 'PENDING' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: [{ assignedAt: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: safeLimit,
      }),
      this.prisma.kycDocument.count({ where: { status: 'PENDING' } }),
    ]);

    return { data, total };
  }

  async listActivityLogs(filter: AdminListLogsFilter) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data, total };
  }

  async listTrustEvents(filter: AdminListTrustEventsFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 50));
    const skip = (page - 1) * limit;
    const where: Prisma.TrustEventWhereInput = {
      ...(filter.reviewStatus ? { reviewStatus: filter.reviewStatus } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.severity ? { severity: filter.severity } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.shipmentId ? { shipmentId: filter.shipmentId } : {}),
      ...(filter.chatId ? { chatId: filter.chatId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.trustEvent.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trustEvent.count({ where }),
    ]);

    return { data, total };
  }

  async getTrustEvent(id: string) {
    return this.prisma.trustEvent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
  }

  async reviewTrustEvent(id: string, adminId: string, status: string, note?: string) {
    return this.prisma.trustEvent.update({
      where: { id },
      data: {
        reviewStatus: status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });
  }

  async getSystemConfig(key: string) {
    return this.prisma.systemConfig.findUnique({ where: { key } });
  }

  async upsertSystemConfig(key: string, value: unknown, adminId: string) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: adminId },
      update: { value: value as Prisma.InputJsonValue, updatedBy: adminId },
    });
  }

  async listPricingRules() {
    return this.prisma.pricingRule.findMany({ orderBy: { priority: 'desc' } });
  }

  async createPricingRule(input: PricingRuleInput) {
    return this.prisma.pricingRule.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        originCountry: input.originCountry ?? null,
        destinationCountry: input.destinationCountry ?? null,
        cargoType: (input.cargoType ?? null) as CargoType | null,
        basePrice: input.basePrice,
        pricePerKg: input.pricePerKg,
        pricePerKm: input.pricePerKm ?? null,
        riskMultiplier: input.riskMultiplier ?? 1,
        platformFeePercent: input.platformFeePercent ?? 10,
        minPlatformFee: input.minPlatformFee ?? 0,
        isActive: input.isActive ?? true,
        priority: input.priority ?? 0,
      },
    });
  }

  async updatePricingRule(id: string, input: Partial<PricingRuleInput>) {
    const data: Prisma.PricingRuleUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.originCountry !== undefined) data.originCountry = input.originCountry;
    if (input.destinationCountry !== undefined) data.destinationCountry = input.destinationCountry;
    if (input.cargoType !== undefined) {
      data.cargoType = (input.cargoType ?? null) as CargoType | null;
    }
    if (input.basePrice !== undefined) data.basePrice = input.basePrice;
    if (input.pricePerKg !== undefined) data.pricePerKg = input.pricePerKg;
    if (input.pricePerKm !== undefined) data.pricePerKm = input.pricePerKm;
    if (input.riskMultiplier !== undefined) data.riskMultiplier = input.riskMultiplier;
    if (input.platformFeePercent !== undefined) data.platformFeePercent = input.platformFeePercent;
    if (input.minPlatformFee !== undefined) data.minPlatformFee = input.minPlatformFee;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.priority !== undefined) data.priority = input.priority;

    return this.prisma.pricingRule.update({ where: { id }, data });
  }
}
