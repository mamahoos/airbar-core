import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { CargoType, DraftType, KycLevel } from '@prisma/client';
import { nanoid } from 'nanoid';

import { CacheModule } from '../../src/adapters/cache/cache.module.js';
import { RedisService } from '../../src/adapters/cache/redis.service.js';
import { FinanceGrpcModule } from '../../src/adapters/grpc-client/finance-grpc.module.js';
import { PersistenceModule } from '../../src/adapters/persistence/persistence.module.js';
import { QueueModule } from '../../src/adapters/queue/queue.module.js';
import { IntakeModule } from '../../src/adapters/web/intake/intake.module.js';
import { MarketplaceModule } from '../../src/adapters/web/marketplace/marketplace.module.js';
import { IntakeService } from '../../src/application/intake/intake.service.js';
import { ConfigModule } from '../../src/bootstrap/config/index.js';
import { ForbiddenError } from '../../src/shared/errors/index.js';

import { prisma } from './setup.js';

describe('Intake claim integration smoke', () => {
  let moduleRef: TestingModule;
  let intake: IntakeService;
  let redis: RedisService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        CacheModule,
        PersistenceModule,
        QueueModule,
        FinanceGrpcModule,
        MarketplaceModule,
        IntakeModule,
      ],
    }).compile();
    intake = moduleRef.get(IntakeService);
    redis = moduleRef.get(RedisService);
  });

  afterAll(async () => {
    if (redis) {
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
    }
    if (moduleRef) await moduleRef.close();
  });

  it('claims a shipment draft through marketplace KYC, pricing, counters, and stats path', async () => {
    const user = await createIdentityVerifiedIranianUser();
    const previewToken = nanoid(16);
    const draft = await createShipmentDraft(previewToken);

    try {
      const claimed = await intake.claim(previewToken, user.id);

      expect(claimed).toMatchObject({ type: 'SHIPMENT' });
      expect(claimed.shipmentId).toEqual(expect.any(String));

      const [updatedDraft, shipment, updatedUser] = await Promise.all([
        prisma.draftRequest.findUniqueOrThrow({ where: { id: draft.id } }),
        prisma.shipment.findUniqueOrThrow({ where: { id: claimed.shipmentId } }),
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ]);

      expect(updatedDraft.status).toBe('CLAIMED');
      expect(updatedDraft.claimedById).toBe(user.id);
      expect(updatedDraft.claimedShipmentId).toBe(shipment.id);
      expect(shipment.senderId).toBe(user.id);
      expect(shipment.systemPrice).toBeGreaterThan(0);
      expect(shipment.receiverContact).toMatchObject({ name: 'Receiver', phone: '09120000000' });
      expect(updatedUser.totalShipments).toBe(1);

      await prisma.shipment.delete({ where: { id: shipment.id } });
    } finally {
      await prisma.draftRequest.deleteMany({ where: { id: draft.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it('does not claim a shipment draft when marketplace KYC gate fails', async () => {
    const user = await prisma.user.create({
      data: { phone: iranPhone(), kycLevel: KycLevel.MOBILE_VERIFIED },
    });
    const previewToken = nanoid(16);
    const draft = await createShipmentDraft(previewToken);

    try {
      await expect(intake.claim(previewToken, user.id)).rejects.toBeInstanceOf(ForbiddenError);

      const [updatedDraft, shipmentCount] = await Promise.all([
        prisma.draftRequest.findUniqueOrThrow({ where: { id: draft.id } }),
        prisma.shipment.count({ where: { senderId: user.id } }),
      ]);

      expect(updatedDraft.status).toBe('NEW');
      expect(updatedDraft.claimedById).toBeNull();
      expect(updatedDraft.claimedShipmentId).toBeNull();
      expect(shipmentCount).toBe(0);
    } finally {
      await prisma.draftRequest.deleteMany({ where: { id: draft.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});

async function createIdentityVerifiedIranianUser() {
  const user = await prisma.user.create({
    data: { phone: iranPhone(), kycLevel: KycLevel.IDENTITY_VERIFIED },
  });
  await prisma.userIdentityProfile.create({
    data: {
      userId: user.id,
      nationalIdHash: `test-${nanoid(16)}`,
      nationalIdCiphertext: `test-ciphertext-${nanoid(16)}`,
      firstNameOfficial: 'Test',
      lastNameOfficial: 'User',
      birthDateJalali: '1370-01-01',
      shahkarVerifiedAt: new Date(),
      personInfoVerifiedAt: new Date(),
      identityPendingPersonInfo: false,
    },
  });
  return user;
}

async function createShipmentDraft(previewToken: string) {
  return prisma.draftRequest.create({
    data: {
      previewToken,
      type: DraftType.SHIPMENT,
      status: 'NEW',
      source: 'TELEGRAM',
      payload: {
        originCity: 'تهران',
        originCountry: 'ایران',
        destinationCity: 'استانبول',
        destinationCountry: 'ترکیه',
        cargoType: CargoType.DOCUMENTS,
        description: 'smoke test',
        weight: 1,
        receiverContact: { name: 'Receiver', phone: '09120000000' },
      },
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
}

function iranPhone(): string {
  return `0912${Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, '0')}`;
}
