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
import { NotificationService } from '../notifications/notification.use-cases.js';

import { financeKycRequirement } from './finance-kyc-gates.js';
import { FinanceLimitsService } from './finance-limits.service.js';
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
    private readonly limits: FinanceLimitsService,
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
    await this.limits.assertAllowed(senderId, 'CREATE_PAYMENT', amount);

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
    private readonly limits: FinanceLimitsService,
  ) {
    this.piiKey = parsePiiKeyHex(config.piiEncryptionKey);
  }

  async execute(userId: string, amountRials: number) {
    await this.kyc.assertRequirement(userId, financeKycRequirement('REQUEST_PAYOUT'));
    await this.limits.assertAllowed(userId, 'REQUEST_PAYOUT', amountRials);

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
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    shipmentId: string,
    resolution: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND' | 'SPLIT',
    note?: string,
    refundAmountRials?: number,
  ) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      throw new ValidationError('Shipment not found');
    }

    if (resolution === 'RELEASE') {
      if (shipment.status !== 'DISPUTED' && shipment.status !== 'PARTIALLY_REFUNDED') {
        throw new ValidationError('Release requires a disputed or partially refunded shipment');
      }
    } else if (shipment.status !== 'DISPUTED') {
      throw new ValidationError('Only disputed shipments can be resolved');
    }

    if (
      (resolution === 'PARTIAL_REFUND' || resolution === 'SPLIT') &&
      (!refundAmountRials || refundAmountRials <= 0)
    ) {
      throw new ValidationError('refundAmount is required for partial settlement');
    }

    const disputeResolution = this.formatDisputeResolution(resolution, note, refundAmountRials);

    if (resolution === 'RELEASE') {
      return this.runRelease(shipment, disputeResolution, note);
    }
    if (resolution === 'REFUND') {
      return this.runRefund(shipment, disputeResolution, note);
    }
    if (resolution === 'PARTIAL_REFUND') {
      return this.runPartialRefund(shipment, disputeResolution, refundAmountRials!, note);
    }
    return this.runSplit(shipment, disputeResolution, refundAmountRials!, note);
  }

  private async runRelease(
    shipment: { readonly id: string; readonly senderId: string; readonly carrierId: string | null },
    disputeResolution: string,
    note?: string,
  ) {
    const result = await this.finance.tryReleaseEscrow({
      shipmentId: shipment.id,
      disputeResolution,
      disputeTargetStatus: 'CONFIRMED',
    });
    if (!result.ok) {
      return {
        shipmentId: shipment.id,
        resolution: 'RELEASE' as const,
        note: note ?? null,
        queued: true,
      };
    }
    await this.resolveShipmentDispute(shipment, 'CONFIRMED', disputeResolution);
    return {
      shipmentId: shipment.id,
      resolution: 'RELEASE' as const,
      note: note ?? null,
      queued: false,
    };
  }

  private async runRefund(
    shipment: { readonly id: string; readonly senderId: string; readonly carrierId: string | null },
    disputeResolution: string,
    note?: string,
  ) {
    const result = await this.finance.tryRefundEscrow({
      shipmentId: shipment.id,
      disputeResolution,
      disputeTargetStatus: 'REFUNDED',
    });
    if (!result.ok) {
      return {
        shipmentId: shipment.id,
        resolution: 'REFUND' as const,
        note: note ?? null,
        queued: true,
      };
    }
    await this.resolveShipmentDispute(shipment, 'REFUNDED', disputeResolution);
    return {
      shipmentId: shipment.id,
      resolution: 'REFUND' as const,
      note: note ?? null,
      queued: false,
    };
  }

  private async runPartialRefund(
    shipment: { readonly id: string; readonly senderId: string; readonly carrierId: string | null },
    disputeResolution: string,
    refundAmountRials: number,
    note?: string,
  ) {
    const result = await this.finance.tryPartialRefundEscrow({
      shipmentId: shipment.id,
      refundAmountRials,
      disputeResolution,
      disputeTargetStatus: 'PARTIALLY_REFUNDED',
    });
    if (!result.ok) {
      return {
        shipmentId: shipment.id,
        resolution: 'PARTIAL_REFUND' as const,
        note: note ?? null,
        queued: true,
      };
    }
    await this.resolveShipmentDispute(shipment, 'PARTIALLY_REFUNDED', disputeResolution);
    return {
      shipmentId: shipment.id,
      resolution: 'PARTIAL_REFUND' as const,
      note: note ?? null,
      queued: false,
    };
  }

  private async runSplit(
    shipment: { readonly id: string; readonly senderId: string; readonly carrierId: string | null },
    disputeResolution: string,
    refundAmountRials: number,
    note?: string,
  ) {
    const partialResult = await this.finance.tryPartialRefundEscrow({
      shipmentId: shipment.id,
      refundAmountRials,
      disputeResolution,
      disputeTargetStatus: 'CONFIRMED',
    });
    if (!partialResult.ok) {
      return {
        shipmentId: shipment.id,
        resolution: 'SPLIT' as const,
        note: note ?? null,
        queued: true,
      };
    }

    const releaseResult = await this.finance.tryReleaseEscrow({
      shipmentId: shipment.id,
      disputeResolution,
      disputeTargetStatus: 'CONFIRMED',
    });
    if (!releaseResult.ok) {
      return {
        shipmentId: shipment.id,
        resolution: 'SPLIT' as const,
        note: note ?? null,
        queued: true,
      };
    }

    await this.resolveShipmentDispute(shipment, 'CONFIRMED', disputeResolution);
    return {
      shipmentId: shipment.id,
      resolution: 'SPLIT' as const,
      note: note ?? null,
      queued: false,
    };
  }

  private async resolveShipmentDispute(
    shipment: { readonly id: string; readonly senderId: string; readonly carrierId: string | null },
    status: 'CONFIRMED' | 'REFUNDED' | 'PARTIALLY_REFUNDED',
    resolution: string,
  ) {
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        disputeResolvedAt: new Date(),
        disputeResolution: resolution,
        trackingHistory: {
          push: {
            status,
            timestamp: new Date().toISOString(),
            description: `Dispute resolved: ${resolution}`,
          },
        },
      },
    });
    await this.notifications.notifyDisputeResolvedToParties(
      { senderId: shipment.senderId, carrierId: shipment.carrierId },
      shipment.id,
      resolution,
      status,
    );
    if (status === 'REFUNDED') {
      await this.notifications.notifyEscrowRefunded(shipment.senderId, shipment.id);
    }
  }

  private formatDisputeResolution(
    resolution: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND' | 'SPLIT',
    note?: string,
    refundAmountRials?: number,
  ): string {
    const trimmedNote = note?.trim();
    const amountSuffix =
      refundAmountRials && (resolution === 'PARTIAL_REFUND' || resolution === 'SPLIT')
        ? ` (${refundAmountRials} rials)`
        : '';
    const base = `${resolution}${amountSuffix}`;
    return trimmedNote ? `${base}: ${trimmedNote}` : base;
  }
}

@Injectable()
export class ProcessAdminWithdrawalUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly notifications: NotificationService,
  ) {}

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
    if (result.value.userId) {
      await this.notifications.notifyWithdrawalStatus(
        result.value.userId,
        withdrawalId,
        'PROCESSED',
      );
    }
    return { withdrawalId, providerRef, payoutChannel, receiptUrl, processed: true };
  }
}

@Injectable()
export class ApproveAdminWithdrawalUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly notifications: NotificationService,
  ) {}

  async execute(withdrawalId: string) {
    const result = await this.finance.tryApproveWithdrawal({ withdrawalId });
    if (!result.ok)
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal approve queued');
    if (result.value.userId) {
      await this.notifications.notifyWithdrawalStatus(
        result.value.userId,
        withdrawalId,
        'APPROVED',
      );
    }
    return { withdrawalId, approved: true };
  }
}

@Injectable()
export class MarkAdminWithdrawalSentUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly notifications: NotificationService,
  ) {}

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
    if (result.value.userId) {
      await this.notifications.notifyWithdrawalStatus(result.value.userId, withdrawalId, 'SENT');
    }
    return { withdrawalId, providerRef, payoutChannel, receiptUrl, sent: true };
  }
}

@Injectable()
export class SettleAdminWithdrawalUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly notifications: NotificationService,
  ) {}

  async execute(withdrawalId: string) {
    const result = await this.finance.trySettleWithdrawal({ withdrawalId });
    if (!result.ok)
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal settle queued');
    if (result.value.userId) {
      await this.notifications.notifyWithdrawalStatus(result.value.userId, withdrawalId, 'SETTLED');
    }
    return { withdrawalId, settled: true };
  }
}

@Injectable()
export class FailAdminWithdrawalUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly notifications: NotificationService,
  ) {}

  async execute(withdrawalId: string, reason: string) {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new ValidationError('Fail reason is required');

    const result = await this.finance.tryFailWithdrawal({ withdrawalId, reason: cleanReason });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Withdrawal fail queued');
    if (result.value.userId) {
      await this.notifications.notifyWithdrawalStatus(result.value.userId, withdrawalId, 'FAILED');
    }
    return { withdrawalId, failed: true };
  }
}

@Injectable()
export class RejectAdminWithdrawalUseCase {
  constructor(
    @Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort,
    private readonly notifications: NotificationService,
  ) {}

  async execute(withdrawalId: string, reason: string) {
    const result = await this.finance.tryRejectWithdrawal({ withdrawalId, reason });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Reject queued');
    if (result.value.userId) {
      await this.notifications.notifyWithdrawalStatus(
        result.value.userId,
        withdrawalId,
        'REJECTED',
      );
    }
    return { withdrawalId, rejected: true };
  }
}
