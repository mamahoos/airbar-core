import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../adapters/persistence/prisma.service.js';

const DELIVERED_STATUSES = ['DELIVERED', 'CONFIRMED'] as const;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicStats() {
    const now = new Date();
    const [
      totalUsers,
      verifiedUsers,
      totalTrips,
      activeTrips,
      totalShipments,
      deliveredShipments,
      reviewAgg,
      tripCountries,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isBanned: false } }),
      this.prisma.user.count({
        where: {
          isBanned: false,
          kycLevel: {
            in: ['IDENTITY_VERIFIED', 'DOCUMENT_VERIFIED', 'FACE_VERIFIED', 'FULLY_VERIFIED'],
          },
        },
      }),
      this.prisma.trip.count(),
      this.prisma.trip.count({ where: { status: 'ACTIVE', departureDate: { gt: now } } }),
      this.prisma.shipment.count(),
      this.prisma.shipment.count({ where: { status: { in: [...DELIVERED_STATUSES] } } }),
      this.prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
      this.prisma.trip.findMany({
        select: { destinationCountry: true },
        distinct: ['destinationCountry'],
      }),
    ]);

    return {
      users: totalUsers,
      verifiedUsers,
      trips: totalTrips,
      activeTrips,
      shipments: totalShipments,
      deliveredShipments,
      countries: tripCountries.length,
      averageRating: Number((reviewAgg._avg.rating ?? 0).toFixed(1)),
      reviews: reviewAgg._count,
    };
  }

  async getPopularRoutes(limit = 6) {
    const now = new Date();
    const grouped = await this.prisma.trip.groupBy({
      by: ['originCity', 'destinationCity', 'originCountry', 'destinationCountry'],
      where: { status: 'ACTIVE', departureDate: { gt: now } },
      _count: { _all: true },
      _min: { basePricePerKg: true },
      orderBy: { _count: { originCity: 'desc' } },
      take: limit,
    });

    return grouped.map((row) => ({
      originCity: row.originCity,
      originCountry: row.originCountry,
      destinationCity: row.destinationCity,
      destinationCountry: row.destinationCountry,
      tripCount: row._count._all,
      minPricePerKg: row._min.basePricePerKg,
    }));
  }

  async getTestimonials(limit = 6) {
    return this.prisma.review.findMany({
      where: { isVisible: true, rating: { gte: 4 } },
      include: {
        author: { select: { firstName: true, lastName: true, avatarUrl: true } },
        shipment: { select: { originCity: true, destinationCity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
