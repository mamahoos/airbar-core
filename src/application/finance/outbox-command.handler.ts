import { Injectable } from '@nestjs/common';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
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

import type { OutboxCommand } from '../../domain/finance/outbox.command.js';

export interface OutboxCommandResult {
  readonly escrowId?: string;
  readonly orderId?: string;
  readonly redirectUrl?: string;
  readonly withdrawalId?: string;
}

@Injectable()
export class OutboxCommandHandler {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(
    command: OutboxCommand,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<OutboxCommandResult> {
    switch (command) {
      case 'CreateEscrow': {
        const response = await this.finance.createEscrow(
          {
            shipmentId: String(payload.shipmentId),
            carrierUserId: String(payload.carrierUserId),
            payerUserId: String(payload.payerUserId),
            amount: String(payload.amount),
            idempotencyKey,
          },
          { idempotencyKey },
        );
        return { escrowId: response.id };
      }
      case 'CreatePaymentOrder': {
        const response = await this.finance.createPaymentOrder(
          {
            shipmentId: String(payload.shipmentId),
            payerUserId: String(payload.payerUserId),
            amount: String(payload.amount),
            agreedPrice: String(payload.agreedPrice),
            callbackUrl: String(payload.callbackUrl),
            successUrl: String(payload.successUrl),
            failureUrl: String(payload.failureUrl),
            description: String(payload.description),
            idempotencyKey,
          },
          { idempotencyKey },
        );
        return { orderId: response.id, redirectUrl: response.redirectUrl };
      }
      case 'PayFromWallet': {
        const response = await this.finance.payFromWallet(
          {
            shipmentId: String(payload.shipmentId),
            payerUserId: String(payload.payerUserId),
            amount: String(payload.amount),
            idempotencyKey,
          },
          { idempotencyKey },
        );
        return { escrowId: response.id };
      }
      case 'MarkDelivered':
        await this.finance.markDelivered(
          { shipmentId: String(payload.shipmentId), idempotencyKey },
          { idempotencyKey },
        );
        return {};
      case 'FreezeEscrow':
        await this.finance.freezeEscrow(
          { shipmentId: String(payload.shipmentId), idempotencyKey },
          { idempotencyKey },
        );
        return {};
      case 'ReleaseEscrow':
        await this.finance.releaseEscrow(
          { shipmentId: String(payload.shipmentId), idempotencyKey },
          { idempotencyKey },
        );
        return {};
      case 'RefundEscrow':
        await this.finance.refundEscrow(
          { shipmentId: String(payload.shipmentId), idempotencyKey },
          { idempotencyKey },
        );
        return {};
      case 'PartialRefundEscrow':
        await this.finance.partialRefundEscrow(
          {
            shipmentId: String(payload.shipmentId),
            refundAmount: String(payload.refundAmount),
            idempotencyKey,
          },
          { idempotencyKey },
        );
        return {};
      case 'CreateWithdrawal': {
        const response = await this.finance.createWithdrawal(
          {
            userId: String(payload.userId),
            amount: String(payload.amount),
            destinationIban: String(payload.destinationIban),
            userActive: Boolean(payload.userActive),
            financialKycApproved: Boolean(payload.financialKycApproved),
            idempotencyKey,
          },
          { idempotencyKey },
        );
        return { withdrawalId: response.id };
      }
      case 'ProcessWithdrawal':
        await this.finance.processWithdrawal(
          { withdrawalId: String(payload.withdrawalId), idempotencyKey },
          { idempotencyKey },
        );
        return {};
      case 'RejectWithdrawal':
        await this.finance.rejectWithdrawal(
          {
            withdrawalId: String(payload.withdrawalId),
            reason: typeof payload.reason === 'string' ? payload.reason : '',
            idempotencyKey,
          },
          { idempotencyKey },
        );
        return {};
      default:
        throw new Error(`Unsupported outbox command: ${String(command)}`);
    }
  }

  static idempotencyKeyFor(command: OutboxCommand, payload: Record<string, unknown>): string {
    switch (command) {
      case 'CreateEscrow':
        return escrowCreateKey(String(payload.shipmentId));
      case 'CreatePaymentOrder':
        return paymentOrderKey(String(payload.shipmentId), String(payload.paymentNonce));
      case 'PayFromWallet':
        return payFromWalletKey(String(payload.shipmentId));
      case 'MarkDelivered':
        return markDeliveredKey(String(payload.shipmentId));
      case 'FreezeEscrow':
        return freezeEscrowKey(String(payload.shipmentId));
      case 'ReleaseEscrow':
        return releaseEscrowKey(String(payload.shipmentId));
      case 'RefundEscrow':
        return refundEscrowKey(String(payload.shipmentId));
      case 'PartialRefundEscrow':
        return partialRefundEscrowKey(String(payload.shipmentId), String(payload.refundAmount));
      case 'CreateWithdrawal':
        return withdrawalKey(String(payload.userId), String(payload.nonce));
      case 'ProcessWithdrawal':
        return processWithdrawalKey(String(payload.withdrawalId));
      case 'RejectWithdrawal':
        return rejectWithdrawalKey(String(payload.withdrawalId));
      default:
        throw new Error(`Unsupported outbox command: ${String(command)}`);
    }
  }
}
