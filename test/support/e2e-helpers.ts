import { randomInt } from 'node:crypto';

import request from 'supertest';

import { SendOtpUseCase } from '../../src/application/auth/send-otp.use-case.js';
import { EscrowJobsService } from '../../src/application/finance/escrow-jobs.service.js';
import { ShipmentFinanceBridgeService } from '../../src/application/finance/shipment-finance-bridge.service.js';
import { encryptPii, hashPii, parsePiiKeyHex } from '../../src/shared/crypto/index.js';

import type { FinanceGrpcStubClient } from './finance-grpc.stub.js';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

const TEST_PII_KEY = parsePiiKeyHex(
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
);

function testIbanForUser(userId: string): string {
  const digits = userId.replace(/\D/g, '').padEnd(24, '0').slice(0, 24);
  return `IR${digits}`;
}

export function uniquePhone(prefix = '0912'): string {
  return `${prefix}${String(randomInt(1_000_000, 9_999_999))}`;
}

export function uniqueNationalId(): string {
  return String(randomInt(100_000_000, 999_999_999)).padStart(10, '0');
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Bypass HTTP throttling on /auth/otp/send while still exercising OTP persistence. */
export async function sendOtp(app: INestApplication, phone: string): Promise<void> {
  await app.get(SendOtpUseCase).execute(phone);
}

export async function registerUser(app: INestApplication, prisma: PrismaClient, phone: string) {
  await sendOtp(app, phone);

  const otpRow = await prisma.otp.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!otpRow) throw new Error(`OTP not found for ${phone}`);

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      phone,
      otpCode: otpRow.code,
      password: 'Test1234!',
      firstName: 'Test',
      lastName: 'User',
    })
    .expect(201);

  const accessToken = res.body.data.accessToken as string;
  const me = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set(authHeader(accessToken))
    .expect(200);

  return { accessToken, userId: me.body.data.id as string, phone };
}

export async function verifyIdentity(app: INestApplication, accessToken: string) {
  await request(app.getHttpServer())
    .post('/api/v1/kyc/verify-identity')
    .set(authHeader(accessToken))
    .send({ nationalId: uniqueNationalId(), birthDate: '1370/01/01' })
    .expect(201);
}

export async function promoteAdmin(prisma: PrismaClient, userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'SUPER_ADMIN' },
  });
}

export async function loginUser(
  app: INestApplication,
  phone: string,
  password = 'Test1234!',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ phone, password })
    .expect(200);
  return res.body.data.accessToken as string;
}

export async function createAdminUser(
  app: INestApplication,
  prisma: PrismaClient,
  phone: string,
): Promise<{ accessToken: string; userId: string }> {
  const user = await registerUser(app, prisma, phone);
  await promoteAdmin(prisma, user.userId);
  const accessToken = await loginUser(app, phone);
  return { accessToken, userId: user.userId };
}

export async function enableFinanceKyc(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { financialVerifiedAt: new Date() },
  });
}

export async function seedPayoutProfile(prisma: PrismaClient, userId: string): Promise<void> {
  const iban = testIbanForUser(userId);
  await prisma.userPayoutProfile.create({
    data: {
      userId,
      ibanCiphertext: encryptPii(iban, TEST_PII_KEY),
      ibanHash: hashPii(iban),
    },
  });
}

export async function createTrip(app: INestApplication, accessToken: string) {
  const departure = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await request(app.getHttpServer())
    .post('/api/v1/trips')
    .set(authHeader(accessToken))
    .send({
      originCity: 'تهران',
      originCountry: 'ایران',
      destinationCity: 'استانبول',
      destinationCountry: 'ترکیه',
      departureDate: departure,
      availableWeight: 20,
      maxWeight: 20,
      acceptedCargoTypes: ['DOCUMENTS'],
      basePricePerKg: 500_000,
      currency: 'IRR',
    })
    .expect(201);
  return res.body.data.id as string;
}

export async function createShipment(app: INestApplication, accessToken: string) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/shipments')
    .set(authHeader(accessToken))
    .send({
      originCity: 'تهران',
      originCountry: 'ایران',
      destinationCity: 'استانبول',
      destinationCountry: 'ترکیه',
      cargoType: 'DOCUMENTS',
      description: 'integration flow docs',
      weight: 2,
      receiverContact: { name: 'Receiver', phone: '09120001122' },
    })
    .expect(201);
  return res.body.data.id as string;
}

export async function matchAndAccept(
  app: INestApplication,
  prisma: PrismaClient,
  financeStub: FinanceGrpcStubClient,
  sender: { accessToken: string; userId: string },
  carrier: { accessToken: string; userId: string },
) {
  const shipmentId = await createShipment(app, sender.accessToken);
  const tripId = await createTrip(app, carrier.accessToken);

  await request(app.getHttpServer())
    .post(`/api/v1/matching/assign/${shipmentId}/${tripId}`)
    .set(authHeader(carrier.accessToken))
    .expect(201);

  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  const agreedPrice = shipment.systemPrice;

  await request(app.getHttpServer())
    .post(`/api/v1/shipments/${shipmentId}/accept`)
    .set(authHeader(sender.accessToken))
    .send({ agreedPrice })
    .expect(201);

  await enableFinanceKyc(prisma, sender.userId);
  financeStub.seedWallet(sender.userId, BigInt(agreedPrice) * 2n);
  return { shipmentId, agreedPrice };
}

export async function payWalletAndMarkPaid(
  app: INestApplication,
  senderToken: string,
  shipmentId: string,
) {
  await request(app.getHttpServer())
    .post('/api/v1/payments')
    .set(authHeader(senderToken))
    .send({ shipmentId, method: 'WALLET' })
    .expect(201);

  const bridge = app.get(ShipmentFinanceBridgeService);
  const marked = await bridge.markShipmentPaid(shipmentId);
  if (!marked) {
    const jobs = app.get(EscrowJobsService);
    await jobs.pollFundedEscrows();
  }
}

export async function advanceCarrierDelivery(
  app: INestApplication,
  carrierToken: string,
  shipmentId: string,
) {
  for (const status of ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] as const) {
    await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(carrierToken))
      .send({ status })
      .expect(201);
  }
}

export async function countNotifications(prisma: PrismaClient, userId: string, type: string) {
  return prisma.notification.count({
    where: {
      userId,
      data: { path: ['type'], equals: type },
    },
  });
}
