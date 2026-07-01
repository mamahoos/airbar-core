import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../adapters/persistence/prisma.service.js';

import type { OutboxCommandResult } from './outbox-command.handler.js';
import type { OutboxCommand } from '../../domain/finance/outbox.command.js';

@Injectable()
export class ShipmentFinanceBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(command: OutboxCommand, payload: Record<string, unknown>, result: OutboxCommandResult) {
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
      case 'PayFromWallet':
        await this.prisma.shipment.update({
          where: { id: String(payload.shipmentId) },
          data: { paymentMethod: 'WALLET' },
        });
        return;
      default:
        return;
    }
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
