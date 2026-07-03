import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
import {
  ACTIVITY_LOG_REPOSITORY,
  type ActivityLogRepositoryPort,
} from '../../domain/auth/ports/activity-log.repository.port.js';
import { isOutboxCommand, type OutboxCommand } from '../../domain/finance/outbox.command.js';
import { ShipmentStatus } from '../../domain/marketplace/shipment-state-machine.js';
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepositoryPort,
} from '../../domain/marketplace/shipment.repository.port.js';
import { decryptPii, parsePiiKeyHex } from '../../shared/crypto/pii-crypto.js';
import {
  DomainError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';
import { KycAccessService } from '../kyc/kyc-access.service.js';

import { financeKycRequirement } from './finance-kyc-gates.js';
import { FINANCE_ORCHESTRATOR, type FinanceOrchestratorPort } from './finance-orchestrator.port.js';
import { IntegrationOutboxService } from './integration-outbox.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { OutboxRowStatus } from '../../domain/finance/outbox.repository.port.js';

export type PaymentMethod = 'ZIBAL' | 'WALLET';
const OUTBOX_STATUSES = new Set<OutboxRowStatus>(['PENDING', 'PROCESSING', 'DONE', 'FAILED']);
const PROVIDER_EVENT_TYPES = new Set(['REQUEST', 'VERIFY', 'CALLBACK']);

@Injectable()
export class CreateShipmentPaymentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly kyc: KycAccessService,
  ) {}

  async execute(
    senderId: string,
    shipmentId: string,
    method: PaymentMethod,
  ): Promise<{ redirectUrl?: string; queued?: boolean }> {
    await this.kyc.assertRequirement(senderId, financeKycRequirement('CREATE_PAYMENT'));

    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment', shipmentId);
    if (shipment.senderId !== senderId) throw new ForbiddenError('Not authorized');
    if (shipment.status !== ShipmentStatus.ACCEPTED) {
      throw new ValidationError('Shipment is not ready for payment');
    }

    const amount = shipment.agreedPrice ?? shipment.systemPrice;
    if (!shipment.carrierId) throw new ValidationError('Shipment has no carrier');

    if (method === 'WALLET') {
      const result = await this.finance.tryPayFromWallet({
        shipmentId,
        payerUserId: senderId,
        amountRials: amount,
      });
      if (!result.ok) return { queued: true };
      return {};
    }

    const result = await this.finance.tryCreatePaymentOrder({
      shipmentId,
      payerUserId: senderId,
      amountRials: amount,
      agreedPriceRials: amount,
      trackingCode: shipment.trackingCode,
      paymentNonce: randomUUID(),
    });
    if (!result.ok) return { queued: true };
    return { redirectUrl: result.value.redirectUrl };
  }
}

@Injectable()
export class GetWalletUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(userId: string) {
    const wallet = await this.finance.getWallet(userId);
    return {
      userId: wallet.userId,
      currency: wallet.currency,
      balance: wallet.balance,
      accountCode: wallet.accountCode,
    };
  }
}

@Injectable()
export class ListWalletTransactionsUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(userId: string) {
    const response = await this.finance.listWalletTransactions(userId);
    return { items: response.items };
  }
}

@Injectable()
export class RequestWithdrawalUseCase {
  private readonly piiKey: Buffer;

  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly kyc: KycAccessService,
  ) {
    this.piiKey = parsePiiKeyHex(config.piiEncryptionKey);
  }

  async execute(userId: string, amountRials: number) {
    await this.kyc.assertRequirement(userId, financeKycRequirement('REQUEST_PAYOUT'));

    const [user, profile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } }),
      this.prisma.userPayoutProfile.findUnique({ where: { userId } }),
    ]);
    if (!user) throw new NotFoundError('User', userId);
    if (!profile) throw new ValidationError('Payout profile not configured');

    const iban = decryptPii(profile.ibanCiphertext, this.piiKey);

    const result = await this.finance.tryCreateWithdrawal({
      userId,
      amountRials,
      destinationIban: iban,
      userActive: user.isActive,
      financialKycApproved: true,
      nonce: randomUUID(),
    });
    if (!result.ok) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal queued for retry');
    }
    return { withdrawalId: result.value.withdrawalId };
  }
}

@Injectable()
export class ListWithdrawalsUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(userId: string, status = '') {
    return this.finance.listWithdrawals(userId, status);
  }
}

@Injectable()
export class GetAdminTreasurySummaryUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(currency = 'IRT') {
    const summary = await this.finance.getTreasurySummary(currency);
    return {
      currency: summary.currency,
      accounts: summary.accounts ?? {},
    };
  }
}

@Injectable()
export class RunAdminReconciliationUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute() {
    return this.finance.runReconciliation();
  }
}

@Injectable()
export class ListAdminReconciliationRunsUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute() {
    const response = await this.finance.listReconciliationRuns();
    return { items: response.items };
  }
}

@Injectable()
export class GetAdminReconciliationRunUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(runId: string) {
    return this.finance.getReconciliationRun(runId);
  }
}

@Injectable()
export class ListAdminProviderEventsUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(filter: {
    page?: number;
    limit?: number;
    provider?: string;
    eventType?: string;
    paymentOrderId?: string;
  }) {
    const { page, limit } = normalizePagination({ page: filter.page, limit: filter.limit ?? 50 });
    const provider = filter.provider?.trim() || 'ZIBAL';
    const eventType = this.parseEventType(filter.eventType);
    const paymentOrderId = filter.paymentOrderId?.trim() || undefined;
    const response = await this.finance.listProviderEvents({
      provider,
      page,
      limit,
      ...(eventType ? { eventType } : {}),
      ...(paymentOrderId ? { paymentOrderId } : {}),
    });
    return {
      data: response.items,
      pagination: buildPaginationMeta(Number(response.total), page, limit),
    };
  }

  private parseEventType(eventType?: string): string | undefined {
    const normalized = eventType?.trim().toUpperCase();
    if (!normalized) return undefined;
    if (!PROVIDER_EVENT_TYPES.has(normalized)) {
      throw new ValidationError('Invalid provider event type');
    }
    return normalized;
  }
}

@Injectable()
export class ReplayOutboxUseCase {
  constructor(
    private readonly outbox: IntegrationOutboxService,
    @Inject(ACTIVITY_LOG_REPOSITORY) private readonly activity: ActivityLogRepositoryPort,
  ) {}

  async execute(
    adminId: string,
    outboxId: string,
    input: { reason: string; ipAddress?: string; userAgent?: string },
  ) {
    const reason = input.reason.trim();
    if (!reason) throw new ValidationError('Replay reason is required');
    const before = await this.outbox.getForAdmin(outboxId);
    await this.outbox.replay(outboxId);
    await this.activity.log({
      userId: adminId,
      action: 'ADMIN_OUTBOX_REPLAY',
      resource: 'integration_outbox',
      resourceId: outboxId,
      details: {
        reason,
        command: before.command,
        aggregateType: before.aggregateType,
        aggregateId: before.aggregateId,
        previousStatus: before.status,
        previousAttemptCount: before.attemptCount,
        previousLastError: before.lastError,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { replayed: true };
  }
}

@Injectable()
export class ListAdminOutboxUseCase {
  constructor(private readonly outbox: IntegrationOutboxService) {}

  async execute(filter: {
    page?: number;
    limit?: number;
    status?: string;
    command?: string;
    aggregateType?: string;
    aggregateId?: string;
  }) {
    const { page, limit } = normalizePagination({ page: filter.page, limit: filter.limit ?? 50 });
    const status = this.parseStatus(filter.status);
    const command = this.parseCommand(filter.command);
    const { data, total } = await this.outbox.listForAdmin({
      page,
      limit,
      status,
      command,
      aggregateType: filter.aggregateType,
      aggregateId: filter.aggregateId,
    });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }

  private parseStatus(status?: string): OutboxRowStatus | undefined {
    if (!status) return undefined;
    if (!OUTBOX_STATUSES.has(status as OutboxRowStatus)) {
      throw new ValidationError('Invalid outbox status');
    }
    return status as OutboxRowStatus;
  }

  private parseCommand(command?: string): OutboxCommand | undefined {
    if (!command) return undefined;
    if (!isOutboxCommand(command)) throw new ValidationError('Invalid outbox command');
    return command;
  }
}

@Injectable()
export class GetAdminOutboxUseCase {
  constructor(private readonly outbox: IntegrationOutboxService) {}

  async execute(outboxId: string) {
    return this.outbox.getForAdmin(outboxId);
  }
}

@Injectable()
export class ResolveDisputeUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(shipmentId: string, resolution: 'RELEASE' | 'REFUND', note?: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment || shipment.status !== 'DISPUTED') {
      throw new ValidationError('Only disputed shipments can be resolved');
    }

    if (resolution === 'RELEASE') {
      await this.finance.tryReleaseEscrow({ shipmentId });
    } else {
      await this.finance.tryRefundEscrow({ shipmentId });
    }

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: resolution === 'RELEASE' ? 'CONFIRMED' : 'REFUNDED',
        disputeResolvedAt: new Date(),
        disputeResolution: note ?? resolution,
      },
    });

    return { shipmentId, resolution, note: note ?? null };
  }
}

@Injectable()
export class ProcessAdminWithdrawalUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(
    withdrawalId: string,
    input: { providerRef: string; payoutChannel: string; receiptUrl: string },
  ) {
    const providerRef = input.providerRef.trim();
    const payoutChannel = input.payoutChannel.trim();
    const receiptUrl = input.receiptUrl.trim();
    if (!providerRef || !payoutChannel || !receiptUrl) {
      throw new ValidationError('providerRef, payoutChannel and receiptUrl are required');
    }

    const result = await this.finance.tryProcessWithdrawal({
      withdrawalId,
      providerRef,
      payoutChannel,
      receiptUrl,
    });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal queued');
    return { withdrawalId, providerRef, payoutChannel, receiptUrl, processed: true };
  }
}

@Injectable()
export class ApproveAdminWithdrawalUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(withdrawalId: string) {
    const result = await this.finance.tryApproveWithdrawal({ withdrawalId });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal approve queued');
    return { withdrawalId, approved: true };
  }
}

@Injectable()
export class MarkAdminWithdrawalSentUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(
    withdrawalId: string,
    input: { providerRef: string; payoutChannel: string; receiptUrl: string },
  ) {
    const providerRef = input.providerRef.trim();
    const payoutChannel = input.payoutChannel.trim();
    const receiptUrl = input.receiptUrl.trim();
    if (!providerRef || !payoutChannel || !receiptUrl) {
      throw new ValidationError('providerRef, payoutChannel and receiptUrl are required');
    }

    const result = await this.finance.tryMarkWithdrawalSent({
      withdrawalId,
      providerRef,
      payoutChannel,
      receiptUrl,
    });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal sent queued');
    return { withdrawalId, providerRef, payoutChannel, receiptUrl, sent: true };
  }
}

@Injectable()
export class SettleAdminWithdrawalUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(withdrawalId: string) {
    const result = await this.finance.trySettleWithdrawal({ withdrawalId });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal settle queued');
    return { withdrawalId, settled: true };
  }
}

@Injectable()
export class FailAdminWithdrawalUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(withdrawalId: string, reason: string) {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new ValidationError('Fail reason is required');

    const result = await this.finance.tryFailWithdrawal({ withdrawalId, reason: cleanReason });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal fail queued');
    return { withdrawalId, failed: true };
  }
}

@Injectable()
export class RejectAdminWithdrawalUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(withdrawalId: string, reason: string) {
    const result = await this.finance.tryRejectWithdrawal({ withdrawalId, reason });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Reject queued');
    return { withdrawalId, rejected: true };
  }
}
