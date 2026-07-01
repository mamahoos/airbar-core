import { Inject, Injectable } from '@nestjs/common';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { DomainError, ErrorCode } from '../../shared/errors/index.js';
import {
  escrowCreateKey,
  freezeEscrowKey,
  markDeliveredKey,
  partialRefundEscrowKey,
  payFromWalletKey,
  paymentOrderKey,
  processWithdrawalKey,
  refundEscrowKey,
  rejectWithdrawalKey,
  releaseEscrowKey,
  withdrawalKey,
} from '../../shared/idempotency/keys.js';

import {
  FINANCE_ORCHESTRATOR,
  type CreateEscrowInput,
  type CreatePaymentOrderInput,
  type CreateWithdrawalInput,
  type FinanceOrchestratorPort,
  type FinanceReadyStatus,
  type FinanceSyncResult,
  type PartialRefundInput,
  type PayFromWalletInput,
  type ProcessWithdrawalInput,
  type RejectWithdrawalInput,
  type ShipmentFinanceCommandInput,
} from './finance-orchestrator.port.js';
import { IntegrationOutboxService } from './integration-outbox.service.js';
import { ShipmentFinanceBridgeService } from './shipment-finance-bridge.service.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { OutboxCommand } from '../../domain/finance/outbox.command.js';

const AGGREGATE_SHIPMENT = 'shipment';
const AGGREGATE_WITHDRAWAL = 'withdrawal';
const AGGREGATE_USER = 'user';

@Injectable()
export class FinanceOrchestrator implements FinanceOrchestratorPort {
  constructor(
    private readonly finance: FinanceGrpcClient,
    private readonly outbox: IntegrationOutboxService,
    private readonly bridge: ShipmentFinanceBridgeService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async checkFinanceReady(): Promise<FinanceReadyStatus> {
    const response = await this.finance.checkReady();
    return { ready: response.ready };
  }

  async tryCreateEscrow(
    input: CreateEscrowInput,
  ): Promise<FinanceSyncResult<{ escrowId: string }>> {
    const idempotencyKey = escrowCreateKey(input.shipmentId);
    const payload = {
      shipmentId: input.shipmentId,
      carrierUserId: input.carrierUserId,
      payerUserId: input.payerUserId,
      amount: String(input.amountRials),
    };
    return this.trySync(
      () => this.finance.createEscrow({ ...payload, idempotencyKey }, { idempotencyKey }),
      async (response) => {
        const escrowId = response.id ?? '';
        await this.bridge.apply('CreateEscrow', payload, { escrowId });
        return { escrowId };
      },
      'CreateEscrow',
      AGGREGATE_SHIPMENT,
      input.shipmentId,
      payload,
      idempotencyKey,
    );
  }

  async tryCreatePaymentOrder(
    input: CreatePaymentOrderInput,
  ): Promise<FinanceSyncResult<{ orderId: string; redirectUrl: string }>> {
    const idempotencyKey = paymentOrderKey(input.shipmentId, input.paymentNonce);
    const urls = this.paymentUrls();
    const payload = {
      shipmentId: input.shipmentId,
      payerUserId: input.payerUserId,
      amount: String(input.amountRials),
      agreedPrice: String(input.agreedPriceRials),
      paymentNonce: input.paymentNonce,
      callbackUrl: urls.callbackUrl,
      successUrl: urls.successUrl,
      failureUrl: urls.failureUrl,
      description: `پرداخت بابت حمل بار ${input.trackingCode}`,
    };
    return this.trySync(
      () =>
        this.finance.createPaymentOrder(
          {
            shipmentId: payload.shipmentId,
            payerUserId: payload.payerUserId,
            amount: payload.amount,
            agreedPrice: payload.agreedPrice,
            callbackUrl: payload.callbackUrl,
            successUrl: payload.successUrl,
            failureUrl: payload.failureUrl,
            description: payload.description,
            idempotencyKey,
          },
          { idempotencyKey },
        ),
      async (response) => {
        const orderId = response.id ?? '';
        const redirectUrl = response.redirectUrl ?? '';
        await this.bridge.apply('CreatePaymentOrder', payload, { orderId, redirectUrl });
        return { orderId, redirectUrl };
      },
      'CreatePaymentOrder',
      AGGREGATE_SHIPMENT,
      input.shipmentId,
      payload,
      idempotencyKey,
    );
  }

  async tryPayFromWallet(
    input: PayFromWalletInput,
  ): Promise<FinanceSyncResult<{ escrowId: string }>> {
    const idempotencyKey = payFromWalletKey(input.shipmentId);
    const payload = {
      shipmentId: input.shipmentId,
      payerUserId: input.payerUserId,
      amount: String(input.amountRials),
    };
    return this.trySync(
      () => this.finance.payFromWallet({ ...payload, idempotencyKey }, { idempotencyKey }),
      async (response) => {
        const escrowId = response.id ?? '';
        await this.bridge.apply('PayFromWallet', payload, { escrowId });
        return { escrowId };
      },
      'PayFromWallet',
      AGGREGATE_SHIPMENT,
      input.shipmentId,
      payload,
      idempotencyKey,
    );
  }

  async tryMarkDelivered(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>> {
    return this.shipmentCommand(
      'MarkDelivered',
      input.shipmentId,
      markDeliveredKey(input.shipmentId),
    );
  }

  async tryFreezeEscrow(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>> {
    return this.shipmentCommand(
      'FreezeEscrow',
      input.shipmentId,
      freezeEscrowKey(input.shipmentId),
    );
  }

  async tryReleaseEscrow(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>> {
    return this.shipmentCommand(
      'ReleaseEscrow',
      input.shipmentId,
      releaseEscrowKey(input.shipmentId),
    );
  }

  async tryRefundEscrow(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>> {
    return this.shipmentCommand(
      'RefundEscrow',
      input.shipmentId,
      refundEscrowKey(input.shipmentId),
    );
  }

  async tryPartialRefundEscrow(input: PartialRefundInput): Promise<FinanceSyncResult<void>> {
    const idempotencyKey = partialRefundEscrowKey(
      input.shipmentId,
      String(input.refundAmountRials),
    );
    const payload = {
      shipmentId: input.shipmentId,
      refundAmount: String(input.refundAmountRials),
    };
    return this.trySync(
      () =>
        this.finance.partialRefundEscrow(
          {
            shipmentId: input.shipmentId,
            refundAmount: payload.refundAmount,
            idempotencyKey,
          },
          { idempotencyKey },
        ),
      () => Promise.resolve(undefined),
      'PartialRefundEscrow',
      AGGREGATE_SHIPMENT,
      input.shipmentId,
      payload,
      idempotencyKey,
    );
  }

  async tryCreateWithdrawal(
    input: CreateWithdrawalInput,
  ): Promise<FinanceSyncResult<{ withdrawalId: string }>> {
    const idempotencyKey = withdrawalKey(input.userId, input.nonce);
    const payload = {
      userId: input.userId,
      amount: String(input.amountRials),
      destinationIban: input.destinationIban,
      userActive: input.userActive,
      financialKycApproved: input.financialKycApproved,
      nonce: input.nonce,
    };
    return this.trySync(
      () =>
        this.finance.createWithdrawal(
          {
            userId: input.userId,
            amount: payload.amount,
            destinationIban: input.destinationIban,
            userActive: input.userActive,
            financialKycApproved: input.financialKycApproved,
            idempotencyKey,
          },
          { idempotencyKey },
        ),
      (response) => Promise.resolve({ withdrawalId: response.id ?? '' }),
      'CreateWithdrawal',
      AGGREGATE_USER,
      input.userId,
      payload,
      idempotencyKey,
    );
  }

  async tryProcessWithdrawal(input: ProcessWithdrawalInput): Promise<FinanceSyncResult<void>> {
    const idempotencyKey = processWithdrawalKey(input.withdrawalId);
    const payload = { withdrawalId: input.withdrawalId };
    return this.trySync(
      () =>
        this.finance.processWithdrawal(
          { withdrawalId: input.withdrawalId, idempotencyKey },
          {
            idempotencyKey,
          },
        ),
      () => Promise.resolve(undefined),
      'ProcessWithdrawal',
      AGGREGATE_WITHDRAWAL,
      input.withdrawalId,
      payload,
      idempotencyKey,
    );
  }

  async tryRejectWithdrawal(input: RejectWithdrawalInput): Promise<FinanceSyncResult<void>> {
    const idempotencyKey = rejectWithdrawalKey(input.withdrawalId);
    const payload = { withdrawalId: input.withdrawalId, reason: input.reason };
    return this.trySync(
      () =>
        this.finance.rejectWithdrawal(
          { withdrawalId: input.withdrawalId, reason: input.reason, idempotencyKey },
          { idempotencyKey },
        ),
      () => Promise.resolve(undefined),
      'RejectWithdrawal',
      AGGREGATE_WITHDRAWAL,
      input.withdrawalId,
      payload,
      idempotencyKey,
    );
  }

  enqueueOutbox(
    command: OutboxCommand,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<void> {
    return this.outbox.enqueue(command, aggregateType, aggregateId, payload, idempotencyKey);
  }

  private async shipmentCommand(
    command: Extract<
      OutboxCommand,
      'MarkDelivered' | 'FreezeEscrow' | 'ReleaseEscrow' | 'RefundEscrow'
    >,
    shipmentId: string,
    idempotencyKey: string,
  ): Promise<FinanceSyncResult<void>> {
    const payload = { shipmentId };
    const call = () => {
      switch (command) {
        case 'MarkDelivered':
          return this.finance.markDelivered({ shipmentId, idempotencyKey }, { idempotencyKey });
        case 'FreezeEscrow':
          return this.finance.freezeEscrow({ shipmentId, idempotencyKey }, { idempotencyKey });
        case 'ReleaseEscrow':
          return this.finance.releaseEscrow({ shipmentId, idempotencyKey }, { idempotencyKey });
        case 'RefundEscrow':
          return this.finance.refundEscrow({ shipmentId, idempotencyKey }, { idempotencyKey });
      }
    };
    return this.trySync(
      call,
      () => Promise.resolve(undefined),
      command,
      AGGREGATE_SHIPMENT,
      shipmentId,
      payload,
      idempotencyKey,
    );
  }

  private paymentUrls() {
    const base = this.config.frontendUrl.replace(/\/$/, '');
    return {
      callbackUrl: `${base}/payments/callback`,
      successUrl: `${base}/payments/success`,
      failureUrl: `${base}/payments/failure`,
    };
  }

  private async trySync<T>(
    call: () => Promise<{ id?: string; redirectUrl?: string } | void>,
    onSuccess: (response: { id?: string; redirectUrl?: string }) => Promise<T>,
    command: OutboxCommand,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<FinanceSyncResult<T>> {
    try {
      const response = await call();
      const value = await onSuccess(response ?? {});
      return { ok: true, value };
    } catch (error) {
      if (isRetryableFinanceError(error)) {
        await this.outbox.enqueue(command, aggregateType, aggregateId, payload, idempotencyKey);
        return { ok: false };
      }
      throw error;
    }
  }
}

function isRetryableFinanceError(error: unknown): boolean {
  if (!(error instanceof DomainError)) return false;
  return error.code === ErrorCode.SERVICE_UNAVAILABLE || error.code === ErrorCode.INTERNAL;
}

export const financeOrchestratorProvider = {
  provide: FINANCE_ORCHESTRATOR,
  useClass: FinanceOrchestrator,
};
