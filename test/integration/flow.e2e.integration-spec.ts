import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { ChatFirewallService } from '../../src/application/chat/chat-firewall.service.js';
import { createApp } from '../../src/bootstrap/create-app.js';
import {
  advanceCarrierDelivery,
  authHeader,
  countNotifications,
  createAdminUser,
  enableFinanceKyc,
  matchAndAccept,
  payWalletAndMarkPaid,
  registerUser,
  seedPayoutProfile,
  uniquePhone,
  verifyIdentity,
} from '../support/e2e-helpers.js';
import { createFinanceGrpcStub, type FinanceGrpcStubClient } from '../support/finance-grpc.stub.js';

import { prisma } from './setup.js';

import type { FinanceGrpcClient } from '../../src/adapters/grpc-client/finance-grpc.client.js';
import type { INestApplication } from '@nestjs/common';

describe('Marketplace lifecycle E2E (flow.e2e)', () => {
  let app: INestApplication;
  let financeStub: FinanceGrpcStubClient;

  beforeAll(async () => {
    financeStub = createFinanceGrpcStub();
    app = await createApp({
      financeStub: financeStub as unknown as FinanceGrpcClient,
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('runs register → KYC → shipment → match → pay → deliver → release with notifications', async () => {
    const senderPhone = uniquePhone('0912');
    const carrierPhone = uniquePhone('0913');

    const sender = await registerUser(app, prisma, senderPhone);
    const carrier = await registerUser(app, prisma, carrierPhone);
    await verifyIdentity(app, sender.accessToken);
    await verifyIdentity(app, carrier.accessToken);

    const { shipmentId } = await matchAndAccept(app, prisma, financeStub, sender, carrier);
    await payWalletAndMarkPaid(app, sender.accessToken, shipmentId);

    const paidShipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(paidShipment.status).toBe('PAID');
    expect(await countNotifications(prisma, sender.userId, 'PAYMENT_SECURED')).toBeGreaterThan(0);
    expect(await countNotifications(prisma, carrier.userId, 'PAYMENT_SECURED')).toBeGreaterThan(0);

    await advanceCarrierDelivery(app, carrier.accessToken, shipmentId);

    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(sender.accessToken))
      .send({ status: 'CONFIRMED' })
      .expect(201);

    const confirmed = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(confirmed.status).toBe('CONFIRMED');
    expect(await countNotifications(prisma, carrier.userId, 'ESCROW_RELEASED')).toBeGreaterThan(0);
  });

  it('admin refund dispute path notifies payer', async () => {
    const sender = await registerUser(app, prisma, uniquePhone('0914'));
    const carrier = await registerUser(app, prisma, uniquePhone('0915'));
    await verifyIdentity(app, sender.accessToken);
    await verifyIdentity(app, carrier.accessToken);

    const admin = await createAdminUser(app, prisma, uniquePhone('0916'));
    const adminToken = admin.accessToken;

    const { shipmentId } = await matchAndAccept(app, prisma, financeStub, sender, carrier);
    await payWalletAndMarkPaid(app, sender.accessToken, shipmentId);
    await advanceCarrierDelivery(app, carrier.accessToken, shipmentId);

    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipmentId}/dispute`)
      .set(authHeader(sender.accessToken))
      .send({ reason: 'item damaged in transit' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${shipmentId}/resolve`)
      .set(authHeader(adminToken))
      .send({ resolution: 'REFUND', note: 'full refund approved' })
      .expect(201);

    const refunded = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(refunded.status).toBe('REFUNDED');
    expect(await countNotifications(prisma, sender.userId, 'DISPUTE_RESOLVED')).toBeGreaterThan(0);
    expect(await countNotifications(prisma, sender.userId, 'ESCROW_REFUNDED')).toBeGreaterThan(0);
  });

  it('supports partial refund and split settlement paths', async () => {
    const sender = await registerUser(app, prisma, uniquePhone('0917'));
    const carrier = await registerUser(app, prisma, uniquePhone('0918'));
    await verifyIdentity(app, sender.accessToken);
    await verifyIdentity(app, carrier.accessToken);

    const admin = await createAdminUser(app, prisma, uniquePhone('0919'));

    const partialFlow = await matchAndAccept(app, prisma, financeStub, sender, carrier);
    await payWalletAndMarkPaid(app, sender.accessToken, partialFlow.shipmentId);
    await advanceCarrierDelivery(app, carrier.accessToken, partialFlow.shipmentId);
    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${partialFlow.shipmentId}/dispute`)
      .set(authHeader(sender.accessToken))
      .send({ reason: 'partial damage' })
      .expect(201);

    const partialAmount = Math.floor(partialFlow.agreedPrice / 3);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${partialFlow.shipmentId}/resolve`)
      .set(authHeader(admin.accessToken))
      .send({ resolution: 'PARTIAL_REFUND', refundAmount: partialAmount })
      .expect(201);

    const partialShipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: partialFlow.shipmentId },
    });
    expect(partialShipment.status).toBe('PARTIALLY_REFUNDED');

    const sender2 = await registerUser(app, prisma, uniquePhone('0927'));
    const carrier2 = await registerUser(app, prisma, uniquePhone('0928'));
    await verifyIdentity(app, sender2.accessToken);
    await verifyIdentity(app, carrier2.accessToken);

    const splitFlow = await matchAndAccept(app, prisma, financeStub, sender2, carrier2);
    await payWalletAndMarkPaid(app, sender2.accessToken, splitFlow.shipmentId);
    await advanceCarrierDelivery(app, carrier2.accessToken, splitFlow.shipmentId);
    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${splitFlow.shipmentId}/dispute`)
      .set(authHeader(sender2.accessToken))
      .send({ reason: 'split settlement' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${splitFlow.shipmentId}/resolve`)
      .set(authHeader(admin.accessToken))
      .send({ resolution: 'SPLIT', refundAmount: Math.floor(splitFlow.agreedPrice / 4) })
      .expect(201);

    const splitShipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: splitFlow.shipmentId },
    });
    expect(splitShipment.status).toBe('CONFIRMED');
  });

  it('withdrawal lifecycle sends status notifications', async () => {
    const user = await registerUser(app, prisma, uniquePhone('0920'));
    await verifyIdentity(app, user.accessToken);
    await enableFinanceKyc(prisma, user.userId);
    await seedPayoutProfile(prisma, user.userId);

    financeStub.seedWallet(user.userId, 5_000_000n);

    const withdrawalRes = await request(app.getHttpServer())
      .post('/api/v1/payments/withdrawals')
      .set(authHeader(user.accessToken))
      .send({ amount: 1_000_000 })
      .expect(201);
    const withdrawalId = withdrawalRes.body.data.withdrawalId as string;

    const admin = await createAdminUser(app, prisma, uniquePhone('0921'));

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/approve`)
      .set(authHeader(admin.accessToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/mark-sent`)
      .set(authHeader(admin.accessToken))
      .send({
        providerRef: 'provider-1',
        payoutChannel: 'PAYA',
        receiptUrl: 'https://pay.example/r/1',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/settle`)
      .set(authHeader(admin.accessToken))
      .expect(201);

    expect(
      await countNotifications(prisma, user.userId, 'WITHDRAWAL_STATUS'),
    ).toBeGreaterThanOrEqual(3);
  });

  it('admin credit grant can fund wallet payment', async () => {
    const sender = await registerUser(app, prisma, uniquePhone('0922'));
    const carrier = await registerUser(app, prisma, uniquePhone('0923'));
    await verifyIdentity(app, sender.accessToken);
    await verifyIdentity(app, carrier.accessToken);
    const admin = await createAdminUser(app, prisma, uniquePhone('0924'));

    await request(app.getHttpServer())
      .post('/api/v1/admin/credit/grant')
      .set(authHeader(admin.accessToken))
      .send({ userId: sender.userId, amount: 500_000, reason: 'promo test credit' })
      .expect(201);

    const { shipmentId } = await matchAndAccept(app, prisma, financeStub, sender, carrier);
    financeStub.seedWallet(sender.userId, 0n);
    await payWalletAndMarkPaid(app, sender.accessToken, shipmentId);

    const paid = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(paid.status).toBe('PAID');
  });

  it('review submission notifies target and chat firewall blocks then masks', async () => {
    const sender = await registerUser(app, prisma, uniquePhone('0925'));
    const carrier = await registerUser(app, prisma, uniquePhone('0926'));
    await verifyIdentity(app, sender.accessToken);
    await verifyIdentity(app, carrier.accessToken);

    const { shipmentId } = await matchAndAccept(app, prisma, financeStub, sender, carrier);

    const chatRes = await request(app.getHttpServer())
      .get(`/api/v1/chat/shipment/${shipmentId}`)
      .set(authHeader(sender.accessToken))
      .expect(200);
    const chatId = chatRes.body.data.id as string;

    const firewall = app.get(ChatFirewallService);
    const blocked = firewall.evaluate({
      content: 'لطفاً به شماره 09121234567 زنگ بزن',
      shipmentStatus: 'MATCHED',
    });
    expect(blocked.action).toBe('BLOCK');

    await payWalletAndMarkPaid(app, sender.accessToken, shipmentId);
    await advanceCarrierDelivery(app, carrier.accessToken, shipmentId);
    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(sender.accessToken))
      .send({ status: 'CONFIRMED' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipmentId}/reviews`)
      .set(authHeader(sender.accessToken))
      .send({ rating: 5, comment: 'excellent carrier' })
      .expect(201);
    expect(await countNotifications(prisma, carrier.userId, 'REVIEW_RECEIVED')).toBeGreaterThan(0);

    const masked = firewall.evaluate({
      content: 'لطفاً به شماره 09121234567 زنگ بزن',
      shipmentStatus: 'PAID',
    });
    expect(masked.action).toBe('MASK');

    await request(app.getHttpServer())
      .post(`/api/v1/chat/${chatId}/messages`)
      .set(authHeader(sender.accessToken))
      .send({ content: 'لطفاً به شماره 09121234567 زنگ بزن' })
      .expect(201);
  });
});
