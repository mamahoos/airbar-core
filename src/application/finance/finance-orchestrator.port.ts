import type { OutboxCommand } from '../../domain/finance/outbox.command.js';

export interface FinanceReadyStatus {
  readonly ready: boolean;
}

export interface CreateEscrowInput {
  readonly shipmentId: string;
  readonly carrierUserId: string;
  readonly payerUserId: string;
  readonly amountRials: number;
}

export interface CreatePaymentOrderInput {
  readonly shipmentId: string;
  readonly payerUserId: string;
  readonly amountRials: number;
  readonly agreedPriceRials: number;
  readonly trackingCode: string;
  readonly paymentNonce: string;
}

export interface PayFromWalletInput {
  readonly shipmentId: string;
  readonly payerUserId: string;
  readonly amountRials: number;
}

export interface ShipmentFinanceCommandInput {
  readonly shipmentId: string;
  readonly disputeResolution?: string | undefined;
  readonly disputeTargetStatus?: string | undefined;
}

export interface PartialRefundInput extends ShipmentFinanceCommandInput {
  readonly refundAmountRials: number;
}

export interface CreateWithdrawalInput {
  readonly userId: string;
  readonly amountRials: number;
  readonly destinationIban: string;
  readonly userActive: boolean;
  readonly financialKycApproved: boolean;
  readonly nonce: string;
}

export interface ProcessWithdrawalInput {
  readonly withdrawalId: string;
  readonly providerRef: string;
  readonly payoutChannel: string;
  readonly receiptUrl: string;
}

export interface WithdrawalCommandInput {
  readonly withdrawalId: string;
}

export interface MarkWithdrawalSentInput extends WithdrawalCommandInput {
  readonly providerRef: string;
  readonly payoutChannel: string;
  readonly receiptUrl: string;
}

export interface RejectWithdrawalInput {
  readonly withdrawalId: string;
  readonly reason: string;
}

export interface FailWithdrawalInput extends WithdrawalCommandInput {
  readonly reason: string;
}

export type FinanceSyncResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

export interface FinanceOrchestratorPort {
  checkFinanceReady(): Promise<FinanceReadyStatus>;

  tryCreateEscrow(input: CreateEscrowInput): Promise<FinanceSyncResult<{ escrowId: string }>>;
  tryCreatePaymentOrder(
    input: CreatePaymentOrderInput,
  ): Promise<FinanceSyncResult<{ orderId: string; redirectUrl: string }>>;
  tryPayFromWallet(input: PayFromWalletInput): Promise<FinanceSyncResult<{ escrowId: string }>>;
  tryMarkDelivered(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>>;
  tryFreezeEscrow(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>>;
  tryReleaseEscrow(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>>;
  tryRefundEscrow(input: ShipmentFinanceCommandInput): Promise<FinanceSyncResult<void>>;
  tryPartialRefundEscrow(input: PartialRefundInput): Promise<FinanceSyncResult<void>>;
  tryCreateWithdrawal(
    input: CreateWithdrawalInput,
  ): Promise<FinanceSyncResult<{ withdrawalId: string }>>;
  tryApproveWithdrawal(input: WithdrawalCommandInput): Promise<FinanceSyncResult<void>>;
  tryMarkWithdrawalSent(input: MarkWithdrawalSentInput): Promise<FinanceSyncResult<void>>;
  trySettleWithdrawal(input: WithdrawalCommandInput): Promise<FinanceSyncResult<void>>;
  tryFailWithdrawal(input: FailWithdrawalInput): Promise<FinanceSyncResult<void>>;
  tryProcessWithdrawal(input: ProcessWithdrawalInput): Promise<FinanceSyncResult<void>>;
  tryRejectWithdrawal(input: RejectWithdrawalInput): Promise<FinanceSyncResult<void>>;

  enqueueOutbox(
    command: OutboxCommand,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<void>;
}

export const FINANCE_ORCHESTRATOR = Symbol('FINANCE_ORCHESTRATOR');
