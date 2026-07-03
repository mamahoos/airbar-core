import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
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
import { KycAccessService } from '../kyc/kyc-access.service.js';

import { financeKycRequirement } from './finance-kyc-gates.js';
import { FINANCE_ORCHESTRATOR, type FinanceOrchestratorPort } from './finance-orchestrator.port.js';
import { IntegrationOutboxService } from './integration-outbox.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

export type PaymentMethod = 'ZIBAL' | 'WALLET';

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
export class ReplayOutboxUseCase {
  constructor(private readonly outbox: IntegrationOutboxService) {}

  async execute(outboxId: string) {
    await this.outbox.replay(outboxId);
    return { replayed: true };
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
export class RejectAdminWithdrawalUseCase {
  constructor(@Inject(FINANCE_ORCHESTRATOR) private readonly finance: FinanceOrchestratorPort) {}

  async execute(withdrawalId: string, reason: string) {
    const result = await this.finance.tryRejectWithdrawal({ withdrawalId, reason });
    if (!result.ok) throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Reject queued');
    return { withdrawalId, rejected: true };
  }
}
