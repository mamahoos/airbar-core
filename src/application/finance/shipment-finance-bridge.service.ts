import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';

import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { NotificationService } from '../notifications/notification.use-cases.js';

import type { OutboxCommandResult } from './outbox-command.handler.js';
import type { OutboxCommand } from '../../domain/finance/outbox.command.js';

@Injectable()
export class ShipmentFinanceBridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async apply(
    command: OutboxCommand,
    payload: Record<string, unknown>,
    result: OutboxCommandResult,
  ) {
    switch (command) {
      case 'CreateEscrow':
        if (result.escrowId) {
          await this.prisma.shipment.update({
            where: { id: String(payload.shipmentId) },
            data: { financeEscrowId: result.escrowId },
          });
        }
        return;
      case 'CreatePaymentOrder':
        if (result.orderId) {
          await this.prisma.shipment.update({
            where: { id: String(payload.shipmentId) },
            data: {
              paymentOrderId: result.orderId,
              paymentMethod: 'ZIBAL',
            },
          });
        }
        return;
      case 'PayFromWallet': {
        const fundingSource = result.fundingSource ?? 'WALLET';
        const paymentMethod =
          fundingSource === 'PROMO_CREDIT'
            ? 'PROMO_CREDIT'
            : fundingSource === 'MIXED'
              ? 'MIXED'
              : 'WALLET';
        await this.prisma.shipment.update({
          where: { id: String(payload.shipmentId) },
          data: { paymentMethod },
        });
        return;
      }
      case 'ReleaseEscrow':
      case 'RefundEscrow':
      case 'PartialRefundEscrow':
        await this.applyDisputeResolution(payload);
        return;
      default:
        return;
    }
  }

  private async applyDisputeResolution(payload: Record<string, unknown>): Promise<void> {
    const resolution = typeof payload.disputeResolution === 'string' ? payload.disputeResolution : null;
    const targetStatus = this.parseDisputeTargetStatus(payload.disputeTargetStatus);
    if (!resolution || !targetStatus) return;

    const shipmentId = String(payload.shipmentId);
    const parties = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { senderId: true, carrierId: true },
    });
    if (!parties) return;

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: targetStatus,
        disputeResolvedAt: new Date(),
        disputeResolution: resolution,
        trackingHistory: {
          push: {
            status: targetStatus,
            timestamp: new Date().toISOString(),
            description: `Dispute resolved: ${resolution}`,
          },
        },
      },
    });

    await this.notifications.notifyDisputeResolvedToParties(
      parties,
      shipmentId,
      resolution,
      targetStatus,
    );
  }

  private parseDisputeTargetStatus(value: unknown): ShipmentStatus | null {
    if (value === ShipmentStatus.CONFIRMED || value === ShipmentStatus.REFUNDED) {
      return value;
    }
    return null;
  }

  async markShipmentPaid(shipmentId: string): Promise<boolean> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true },
    });
    if (!shipment || shipment.status !== 'ACCEPTED') return false;

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'PAID',
        trackingHistory: {
          push: {
            status: 'PAID',
            timestamp: new Date().toISOString(),
            description: 'پرداخت تایید شد',
          },
        },
      },
    });
    return true;
  }
}
