import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { CargoType } from '@prisma/client';
import { nanoid } from 'nanoid';

import { CacheModule } from '../../src/adapters/cache/cache.module.js';
import { RedisService } from '../../src/adapters/cache/redis.service.js';
import { PersistenceModule } from '../../src/adapters/persistence/persistence.module.js';
import { MarketStatsService } from '../../src/application/stats/market-stats.service.js';
import { ConfigModule } from '../../src/bootstrap/config/index.js';

import { prisma } from './setup.js';

describe('Market stats integration smoke', () => {
  let moduleRef: TestingModule;
  let marketStats: MarketStatsService;
  let redis: RedisService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, CacheModule, PersistenceModule],
      providers: [MarketStatsService],
    }).compile();
    marketStats = moduleRef.get(MarketStatsService);
    redis = moduleRef.get(RedisService);
    await marketStats.rebuild();
  });

  afterAll(async () => {
    await redis.del(
      'mkt:routes',
      'mkt:origins',
      'mkt:destinations',
      'mkt:cargo',
      'mkt:supply:routes',
      'mkt:total_kg',
      'mkt:total_shipments',
      'mkt:total_trips',
      'mkt:initialized',
    );
    await moduleRef.close();
  });

  it('records shipment demand and returns leaderboards', async () => {
    await marketStats.recordShipmentDemand({
      originCity: 'تهران',
      destinationCity: 'استانبول',
      cargoType: CargoType.DOCUMENTS,
      weight: 2.5,
    });

    const stats = await marketStats.getMarketStats(3);
    expect(stats.totalShipments).toBeGreaterThanOrEqual(1);
    expect(stats.topOrigins.some((o) => o.name === 'تهران')).toBe(true);
    expect(stats.topDestinations.some((d) => d.name === 'استانبول')).toBe(true);
    expect(stats.topCargoTypes.some((c) => c.type === CargoType.DOCUMENTS)).toBe(true);
  });

  it('records trip supply on publish', async () => {
    const before = await marketStats.getMarketStats();
    await marketStats.recordTripSupply({
      originCity: 'مشهد',
      destinationCity: 'دبی',
    });
    const after = await marketStats.getMarketStats();
    expect(after.totalTrips).toBe(before.totalTrips + 1);
  });
});

describe('Marketplace flow integration smoke', () => {
  it('creates trip, shipment, and assigns match', async () => {
    const sender = await prisma.user.create({ data: { phone: `0912${nanoid(7)}` } });
    const carrier = await prisma.user.create({ data: { phone: `0913${nanoid(7)}` } });

    const trip = await prisma.trip.create({
      data: {
        userId: carrier.id,
        originCity: 'تهران',
        originCountry: 'ایران',
        destinationCity: 'استانبول',
        destinationCountry: 'ترکیه',
        departureDate: new Date(Date.now() + 7 * 86_400_000),
        availableWeight: 10,
        maxWeight: 10,
        acceptedCargoTypes: [CargoType.DOCUMENTS],
        basePricePerKg: 50_000,
        currency: 'IRR',
        status: 'ACTIVE',
      },
    });

    const shipment = await prisma.shipment.create({
      data: {
        trackingCode: `AB${nanoid(8).toUpperCase()}`,
        senderId: sender.id,
        originCity: 'تهران',
        originCountry: 'ایران',
        destinationCity: 'استانبول',
        destinationCountry: 'ترکیه',
        cargoType: CargoType.DOCUMENTS,
        description: 'marketplace smoke',
        weight: 1,
        photos: [],
        receiverContact: { name: 'test', phone: '09120000000' },
        systemPrice: 100_000,
        status: 'PENDING',
        trackingHistory: [],
      },
    });

    const assigned = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        tripId: trip.id,
        carrierId: carrier.id,
        status: 'MATCHED',
        agreedPrice: 100_000,
      },
    });

    expect(assigned.tripId).toBe(trip.id);
    expect(assigned.carrierId).toBe(carrier.id);
    expect(assigned.status).toBe('MATCHED');

    await prisma.shipment.delete({ where: { id: shipment.id } });
    await prisma.trip.delete({ where: { id: trip.id } });
    await prisma.user.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: carrier.id } });
  });
});
