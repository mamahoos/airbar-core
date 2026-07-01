import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RedisService } from '../../adapters/cache/redis.service.js';
import { PrismaService } from '../../adapters/persistence/prisma.service.js';

const CARGO_LABELS: Record<string, string> = {
  DOCUMENTS: 'مدارک',
  ELECTRONICS: 'لوازم الکترونیکی',
  CLOTHING: 'پوشاک',
  FOOD: 'مواد غذایی',
  MEDICINE: 'دارو',
  COSMETICS: 'لوازم آرایشی',
  JEWELRY: 'جواهرات',
  OTHER: 'سایر',
};

const KEYS = {
  routes: 'mkt:routes',
  origins: 'mkt:origins',
  destinations: 'mkt:destinations',
  cargo: 'mkt:cargo',
  supplyRoutes: 'mkt:supply:routes',
  totalKg: 'mkt:total_kg',
  totalShipments: 'mkt:total_shipments',
  totalTrips: 'mkt:total_trips',
  initialized: 'mkt:initialized',
} as const;

function routeKey(origin: string, destination: string): string {
  return `${origin}→${destination}`;
}

@Injectable()
export class MarketStatsService implements OnModuleInit {
  private readonly logger = new Logger(MarketStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const ready = await this.redis.exists(KEYS.initialized);
      if (!ready) {
        this.logger.log('Market stats not initialized, backfilling from Postgres...');
        await this.rebuild();
      }
    } catch (err) {
      this.logger.warn(`Market stats init skipped: ${(err as Error).message}`);
    }
  }

  async recordShipmentDemand(input: {
    originCity: string;
    destinationCity: string;
    cargoType: string;
    weight: number;
  }): Promise<void> {
    try {
      await Promise.all([
        this.redis.zincrby(KEYS.routes, 1, routeKey(input.originCity, input.destinationCity)),
        this.redis.zincrby(KEYS.origins, 1, input.originCity),
        this.redis.zincrby(KEYS.destinations, 1, input.destinationCity),
        this.redis.zincrby(KEYS.cargo, 1, input.cargoType),
        this.redis.incrbyfloat(KEYS.totalKg, input.weight || 0),
        this.redis.incr(KEYS.totalShipments),
      ]);
    } catch (err) {
      this.logger.warn(`recordShipmentDemand failed: ${(err as Error).message}`);
    }
  }

  async recordTripSupply(input: { originCity: string; destinationCity: string }): Promise<void> {
    try {
      await Promise.all([
        this.redis.zincrby(KEYS.supplyRoutes, 1, routeKey(input.originCity, input.destinationCity)),
        this.redis.incr(KEYS.totalTrips),
      ]);
    } catch (err) {
      this.logger.warn(`recordTripSupply failed: ${(err as Error).message}`);
    }
  }

  async getMarketStats(limit = 5) {
    const [origins, destinations, cargo, routes, totalKgRaw, totalShipmentsRaw, totalTripsRaw] =
      await Promise.all([
        this.redis.zrevrangeWithScores(KEYS.origins, 0, limit - 1),
        this.redis.zrevrangeWithScores(KEYS.destinations, 0, limit - 1),
        this.redis.zrevrangeWithScores(KEYS.cargo, 0, limit - 1),
        this.redis.zrevrangeWithScores(KEYS.routes, 0, limit - 1),
        this.redis.get(KEYS.totalKg),
        this.redis.get(KEYS.totalShipments),
        this.redis.get(KEYS.totalTrips),
      ]);

    return {
      topOrigins: origins.map((o) => ({ name: o.member, count: o.score })),
      topDestinations: destinations.map((d) => ({ name: d.member, count: d.score })),
      topCargoTypes: cargo.map((c) => ({
        type: c.member,
        label: CARGO_LABELS[c.member] ?? c.member,
        count: c.score,
      })),
      topRoutes: routes.map((r) => {
        const [origin, destination] = r.member.split('→');
        return { origin, destination, count: r.score };
      }),
      totalKg: Math.round(Number(totalKgRaw ?? 0)),
      totalShipments: Number(totalShipmentsRaw ?? 0),
      totalTrips: Number(totalTripsRaw ?? 0),
    };
  }

  async rebuild(): Promise<void> {
    const client = this.redis.getClient();

    await client.del(
      KEYS.routes,
      KEYS.origins,
      KEYS.destinations,
      KEYS.cargo,
      KEYS.supplyRoutes,
      KEYS.totalKg,
      KEYS.totalShipments,
      KEYS.totalTrips,
    );

    const [
      shipmentRoutes,
      origins,
      destinations,
      cargo,
      weightAgg,
      shipmentTotal,
      tripTotal,
      supplyRoutes,
    ] = await Promise.all([
      this.prisma.shipment.groupBy({
        by: ['originCity', 'destinationCity'],
        _count: { _all: true },
      }),
      this.prisma.shipment.groupBy({
        by: ['originCity'],
        _count: { _all: true },
      }),
      this.prisma.shipment.groupBy({
        by: ['destinationCity'],
        _count: { _all: true },
      }),
      this.prisma.shipment.groupBy({
        by: ['cargoType'],
        _count: { _all: true },
      }),
      this.prisma.shipment.aggregate({ _sum: { weight: true } }),
      this.prisma.shipment.count(),
      this.prisma.trip.count(),
      this.prisma.trip.groupBy({
        by: ['originCity', 'destinationCity'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);

    const pipeline = client.pipeline();
    for (const r of shipmentRoutes) {
      pipeline.zincrby(KEYS.routes, r._count._all, routeKey(r.originCity, r.destinationCity));
    }
    for (const o of origins) {
      pipeline.zincrby(KEYS.origins, o._count._all, o.originCity);
    }
    for (const d of destinations) {
      pipeline.zincrby(KEYS.destinations, d._count._all, d.destinationCity);
    }
    for (const c of cargo) {
      pipeline.zincrby(KEYS.cargo, c._count._all, String(c.cargoType));
    }
    for (const s of supplyRoutes) {
      pipeline.zincrby(KEYS.supplyRoutes, s._count._all, routeKey(s.originCity, s.destinationCity));
    }
    pipeline.set(KEYS.totalKg, String(weightAgg._sum.weight ?? 0));
    pipeline.set(KEYS.totalShipments, String(shipmentTotal));
    pipeline.set(KEYS.totalTrips, String(tripTotal));
    pipeline.set(KEYS.initialized, '1');
    await pipeline.exec();

    this.logger.log(
      `Market stats rebuilt: ${shipmentTotal} shipments, ${tripTotal} trips, ${Math.round(Number(weightAgg._sum.weight ?? 0))}kg`,
    );
  }
}
