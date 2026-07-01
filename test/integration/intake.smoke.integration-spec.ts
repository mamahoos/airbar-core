import { describe, expect, it } from '@jest/globals';
import { CargoType, DraftType } from '@prisma/client';
import { nanoid } from 'nanoid';

import { prisma } from './setup.js';

describe('Intake draft integration smoke', () => {
  it('creates and claims a shipment draft', async () => {
    const user = await prisma.user.create({ data: { phone: `0912${nanoid(7)}` } });
    const previewToken = nanoid(16);

    const draft = await prisma.draftRequest.create({
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
        },
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    expect(draft.previewToken).toBe(previewToken);

    const shipment = await prisma.shipment.create({
      data: {
        trackingCode: `AB${nanoid(8).toUpperCase()}`,
        senderId: user.id,
        originCity: 'تهران',
        originCountry: 'ایران',
        destinationCity: 'استانبول',
        destinationCountry: 'ترکیه',
        cargoType: CargoType.DOCUMENTS,
        description: 'claimed from draft',
        weight: 1,
        photos: [],
        receiverContact: { name: 'test', phone: '09120000000' },
        systemPrice: 100_000,
        status: 'PENDING',
        trackingHistory: [],
      },
    });

    await prisma.draftRequest.update({
      where: { id: draft.id },
      data: {
        status: 'CLAIMED',
        claimedById: user.id,
        claimedShipmentId: shipment.id,
        claimedAt: new Date(),
      },
    });

    const claimed = await prisma.draftRequest.findUnique({ where: { id: draft.id } });
    expect(claimed?.status).toBe('CLAIMED');
    expect(claimed?.claimedShipmentId).toBe(shipment.id);

    await prisma.draftRequest.delete({ where: { id: draft.id } });
    await prisma.shipment.delete({ where: { id: shipment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
