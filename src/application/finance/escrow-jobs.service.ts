import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
import { PrismaService } from '../../adapters/persistence/prisma.service.js';

import { FINANCE_ORCHESTRATOR, type FinanceOrchestratorPort } from './finance-orchestrator.port.js';
import { ShipmentFinanceBridgeService } from './shipment-finance-bridge.service.js';

const ESCROW_CONFIG_KEY = 'escrow_release_hours';
const DEFAULT_RELEASE_HOURS = 24;

@Injectable()
export class EscrowJobsService {
  private readonly logger = new Logger(EscrowJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeGrpc: FinanceGrpcClient,
    private readonly bridge: ShipmentFinanceBridgeService,
    @Inject(FINANCE_ORCHESTRATOR) private readonly orchestrator: FinanceOrchestratorPort,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pollFundedEscrows(): Promise<void> {
    const candidates = await this.prisma.shipment.findMany({
      where: {
        status: 'ACCEPTED',
        paymentOrderId: { not: null },
      },
      select: { id: true },
      take: 50,
    });

    for (const shipment of candidates) {
      try {
        const escrow = await this.financeGrpc.getEscrow(shipment.id);
        if (escrow.status === 'FUNDED' || escrow.status === 'HELD') {
          await this.bridge.markShipmentPaid(shipment.id);
        }
      } catch (error) {
        this.logger.debug(
          `Escrow poll skipped for ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoReleaseEscrow(): Promise<void> {
    const hours = await this.getReleaseHours();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const due = await this.prisma.shipment.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: { lt: cutoff },
        disputeReason: null,
      },
      select: { id: true },
      take: 100,
    });

    let released = 0;
    for (const shipment of due) {
      try {
        await this.prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            trackingHistory: {
              push: {
                status: 'CONFIRMED',
                timestamp: new Date().toISOString(),
                description: `تایید خودکار پس از ${hours} ساعت`,
              },
            },
          },
        });
        await this.orchestrator.tryReleaseEscrow({ shipmentId: shipment.id });
        released++;
      } catch (error) {
        this.logger.warn(
          `Auto-release failed for ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (released > 0) {
      this.logger.log(`Auto-release processed for ${released} shipment(s)`);
    }
  }

  private async getReleaseHours(): Promise<number> {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: ESCROW_CONFIG_KEY } });
    const hours = Number((cfg?.value as { hours?: number } | null)?.hours);
    return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RELEASE_HOURS;
  }
}
