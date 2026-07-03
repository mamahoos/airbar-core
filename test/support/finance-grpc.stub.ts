import { randomUUID } from 'node:crypto';

import type {
  CreditBalanceResponse,
  CreditGrantResponse,
  CreditGrantsResponse,
  EscrowResponse,
  HealthCheckResponse,
  PaymentOrderResponse,
  ProviderEventsResponse,
  ReconciliationRunResponse,
  ReconciliationRunsResponse,
  TreasurySummaryResponse,
  WalletResponse,
  WalletTransactionsResponse,
  WithdrawalResponse,
  WithdrawalsResponse,
} from '../../src/adapters/grpc-client/generated/airbar_finance_v1.js';
import type { GrpcCallMetadata } from '../../src/adapters/grpc-client/metadata.js';

type EscrowRecord = {
  id: string;
  shipmentId: string;
  status: string;
  amount: string;
  payerUserId: string;
  carrierUserId: string;
  remainingAmount: string;
};

type WithdrawalRecord = {
  id: string;
  userId: string;
  amount: string;
  status: string;
  providerRef: string;
  payoutChannel: string;
  receiptUrl: string;
};

/**
 * In-memory finance gRPC client for deterministic core integration/E2E tests.
 */
export class FinanceGrpcStubClient {
  private readonly escrows = new Map<string, EscrowRecord>();
  private readonly wallets = new Map<string, { balance: bigint; accountCode: string }>();
  private readonly withdrawals = new Map<string, WithdrawalRecord>();
  private readonly creditBalances = new Map<string, bigint>();
  private readonly creditGrants: Array<Record<string, string>> = [];

  onModuleDestroy(): void {
    // no-op for tests
  }

  checkReady(_metadata?: GrpcCallMetadata): Promise<HealthCheckResponse> {
    return Promise.resolve({ ready: true });
  }

  createEscrow(
    input: {
      shipmentId: string;
      carrierUserId: string;
      payerUserId: string;
      amount: string;
      idempotencyKey: string;
    },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const existing = this.escrows.get(input.shipmentId);
    if (existing) {
      return Promise.resolve(this.toEscrowResponse(existing));
    }
    const record: EscrowRecord = {
      id: `esc_${randomUUID()}`,
      shipmentId: input.shipmentId,
      status: 'CREATED',
      amount: input.amount,
      remainingAmount: input.amount,
      payerUserId: input.payerUserId,
      carrierUserId: input.carrierUserId,
    };
    this.escrows.set(input.shipmentId, record);
    return Promise.resolve(this.toEscrowResponse(record));
  }

  getEscrow(shipmentId: string): Promise<EscrowResponse> {
    const record = this.escrows.get(shipmentId);
    if (!record) {
      return Promise.resolve({
        id: '',
        shipmentId,
        status: 'NOT_FOUND',
        amount: '0',
        payerUserId: '',
        carrierUserId: '',
        paymentOrderId: '',
        fundingSource: '',
        promoCreditFunded: '0',
      });
    }
    return Promise.resolve(this.toEscrowResponse(record));
  }

  fundEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const record = this.requireEscrow(input.shipmentId);
    record.status = 'FUNDED';
    return Promise.resolve(this.toEscrowResponse(record));
  }

  payFromWallet(
    input: {
      shipmentId: string;
      payerUserId: string;
      amount: string;
      idempotencyKey: string;
    },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    let record = this.escrows.get(input.shipmentId);
    if (!record) {
      record = {
        id: `esc_${randomUUID()}`,
        shipmentId: input.shipmentId,
        status: 'FUNDED',
        amount: input.amount,
        remainingAmount: input.amount,
        payerUserId: input.payerUserId,
        carrierUserId: '',
      };
      this.escrows.set(input.shipmentId, record);
    } else {
      record.status = 'FUNDED';
    }
    this.debitWallet(input.payerUserId, BigInt(input.amount));
    return Promise.resolve({
      ...this.toEscrowResponse(record),
      fundingSource: 'WALLET',
    });
  }

  markDelivered(
    input: { shipmentId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const record = this.requireEscrow(input.shipmentId);
    record.status = 'DELIVERED';
    return Promise.resolve(this.toEscrowResponse(record));
  }

  freezeEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const record = this.requireEscrow(input.shipmentId);
    record.status = 'FROZEN';
    return Promise.resolve(this.toEscrowResponse(record));
  }

  releaseEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const record = this.requireEscrow(input.shipmentId);
    record.status = 'RELEASED';
    record.remainingAmount = '0';
    if (record.carrierUserId) {
      this.creditWallet(record.carrierUserId, BigInt(record.amount));
    }
    return Promise.resolve(this.toEscrowResponse(record));
  }

  refundEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const record = this.requireEscrow(input.shipmentId);
    record.status = 'REFUNDED';
    record.remainingAmount = '0';
    this.creditWallet(record.payerUserId, BigInt(record.amount));
    return Promise.resolve(this.toEscrowResponse(record));
  }

  partialRefundEscrow(
    input: { shipmentId: string; refundAmount: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const record = this.requireEscrow(input.shipmentId);
    const refund = BigInt(input.refundAmount);
    const remaining = BigInt(record.remainingAmount) - refund;
    record.remainingAmount = remaining > 0n ? remaining.toString() : '0';
    record.status = 'PARTIALLY_REFUNDED';
    this.creditWallet(record.payerUserId, refund);
    return Promise.resolve(this.toEscrowResponse(record));
  }

  createPaymentOrder(
    input: {
      shipmentId: string;
      payerUserId: string;
      amount: string;
      agreedPrice: string;
      callbackUrl: string;
      successUrl: string;
      failureUrl: string;
      description: string;
      idempotencyKey: string;
    },
    _metadata?: GrpcCallMetadata,
  ): Promise<PaymentOrderResponse> {
    return Promise.resolve({
      id: `ord_${randomUUID()}`,
      shipmentId: input.shipmentId,
      payerUserId: input.payerUserId,
      amount: input.amount,
      status: 'PENDING',
      redirectUrl: 'https://pay.test/redirect',
    });
  }

  getPaymentOrder(orderId: string): Promise<PaymentOrderResponse> {
    return Promise.resolve({
      id: orderId,
      shipmentId: '',
      payerUserId: '',
      amount: '0',
      status: 'PENDING',
      redirectUrl: '',
    });
  }

  verifyPaymentOrder(
    _input: { orderId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<PaymentOrderResponse> {
    return Promise.resolve({
      id: _input.orderId,
      shipmentId: '',
      payerUserId: '',
      amount: '0',
      status: 'PAID',
      redirectUrl: '',
    });
  }

  createWalletTopupOrder(
    _input: Record<string, string>,
    _metadata?: GrpcCallMetadata,
  ): Promise<PaymentOrderResponse> {
    return Promise.resolve({
      id: `topup_${randomUUID()}`,
      shipmentId: '',
      payerUserId: _input.userId ?? '',
      amount: _input.amount ?? '0',
      status: 'PENDING',
      redirectUrl: 'https://pay.test/topup',
    });
  }

  getWallet(userId: string, currency = 'IRR'): Promise<WalletResponse> {
    const wallet = this.ensureWallet(userId);
    return Promise.resolve({
      userId,
      currency,
      balance: wallet.balance.toString(),
      accountCode: wallet.accountCode,
    });
  }

  listWalletTransactions(userId: string, currency = 'IRR'): Promise<WalletTransactionsResponse> {
    return Promise.resolve({ items: [], userId, currency });
  }

  seedWallet(userId: string, amountRials: bigint): void {
    const wallet = this.ensureWallet(userId);
    wallet.balance = amountRials;
  }

  createWithdrawal(
    input: {
      userId: string;
      amount: string;
      destinationIban: string;
      userActive: boolean;
      financialKycApproved: boolean;
      idempotencyKey: string;
    },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const id = `wd_${randomUUID()}`;
    const record: WithdrawalRecord = {
      id,
      userId: input.userId,
      amount: input.amount,
      status: 'PENDING',
      providerRef: '',
      payoutChannel: '',
      receiptUrl: '',
    };
    this.withdrawals.set(id, record);
    this.debitWallet(input.userId, BigInt(input.amount));
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  listWithdrawals(userId: string, status = ''): Promise<WithdrawalsResponse> {
    const items = [...this.withdrawals.values()]
      .filter((w) => w.userId === userId && (!status || w.status === status))
      .map((w) => this.toWithdrawalResponse(w));
    return Promise.resolve({ items });
  }

  approveWithdrawal(
    input: { withdrawalId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const record = this.requireWithdrawal(input.withdrawalId);
    record.status = 'APPROVED';
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  markWithdrawalSent(
    input: {
      withdrawalId: string;
      providerRef: string;
      payoutChannel: string;
      receiptUrl: string;
      idempotencyKey: string;
    },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const record = this.requireWithdrawal(input.withdrawalId);
    record.status = 'SENT';
    record.providerRef = input.providerRef;
    record.payoutChannel = input.payoutChannel;
    record.receiptUrl = input.receiptUrl;
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  settleWithdrawal(
    input: { withdrawalId: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const record = this.requireWithdrawal(input.withdrawalId);
    record.status = 'SETTLED';
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  failWithdrawal(
    input: { withdrawalId: string; reason: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const record = this.requireWithdrawal(input.withdrawalId);
    record.status = 'FAILED';
    this.creditWallet(record.userId, BigInt(record.amount));
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  processWithdrawal(
    input: {
      withdrawalId: string;
      providerRef: string;
      payoutChannel: string;
      receiptUrl: string;
      idempotencyKey: string;
    },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const record = this.requireWithdrawal(input.withdrawalId);
    record.status = 'PROCESSED';
    record.providerRef = input.providerRef;
    record.payoutChannel = input.payoutChannel;
    record.receiptUrl = input.receiptUrl;
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  rejectWithdrawal(
    input: { withdrawalId: string; reason: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const record = this.requireWithdrawal(input.withdrawalId);
    record.status = 'REJECTED';
    this.creditWallet(record.userId, BigInt(record.amount));
    return Promise.resolve(this.toWithdrawalResponse(record));
  }

  getTreasurySummary(currency = 'IRT'): Promise<TreasurySummaryResponse> {
    return Promise.resolve({
      currency,
      accounts: {
        walletLiability: '0',
        escrowLiability: '0',
        platformRevenue: '0',
        promoCreditLiability: '0',
      },
    });
  }

  runReconciliation(): Promise<ReconciliationRunResponse> {
    return Promise.resolve({ id: `rec_${randomUUID()}`, status: 'COMPLETED' });
  }

  listReconciliationRuns(): Promise<ReconciliationRunsResponse> {
    return Promise.resolve({ items: [] });
  }

  getReconciliationRun(runId: string): Promise<ReconciliationRunResponse> {
    return Promise.resolve({ id: runId, status: 'COMPLETED' });
  }

  listProviderEvents(_input: {
    provider?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProviderEventsResponse> {
    return Promise.resolve({ items: [] });
  }

  grantCredit(input: {
    userId: string;
    amount: string;
    reason: string;
    idempotencyKey: string;
    campaignId?: string;
  }): Promise<CreditGrantResponse> {
    const amount = BigInt(input.amount);
    const current = this.creditBalances.get(input.userId) ?? 0n;
    this.creditBalances.set(input.userId, current + amount);
    const grant = {
      id: `grant_${randomUUID()}`,
      userId: input.userId,
      amount: input.amount,
      reason: input.reason,
      campaignId: input.campaignId ?? '',
      status: 'ACTIVE',
    };
    this.creditGrants.push(grant);
    return Promise.resolve(grant);
  }

  reverseCreditGrant(
    _input: { grantId: string; reason: string; idempotencyKey: string },
    _metadata?: GrpcCallMetadata,
  ): Promise<CreditGrantResponse> {
    return Promise.resolve({
      id: _input.grantId,
      userId: '',
      amount: '0',
      reason: _input.reason,
      status: 'REVERSED',
    });
  }

  getCreditBalance(userId: string): Promise<CreditBalanceResponse> {
    return Promise.resolve({
      userId,
      balance: (this.creditBalances.get(userId) ?? 0n).toString(),
    });
  }

  listCreditGrants(input: {
    userId: string;
    limit?: number;
    offset?: number;
  }): Promise<CreditGrantsResponse> {
    const items = this.creditGrants.filter((g) => g.userId === input.userId);
    return Promise.resolve({ items });
  }

  private ensureWallet(userId: string) {
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      wallet = { balance: 2_000_000_000n, accountCode: `WAL-${userId.slice(0, 8)}` };
      this.wallets.set(userId, wallet);
    }
    return wallet;
  }

  private creditWallet(userId: string, amount: bigint): void {
    const wallet = this.ensureWallet(userId);
    wallet.balance += amount;
  }

  private debitWallet(userId: string, amount: bigint): void {
    const wallet = this.ensureWallet(userId);
    wallet.balance -= amount;
  }

  private requireEscrow(shipmentId: string): EscrowRecord {
    const record = this.escrows.get(shipmentId);
    if (!record) {
      throw new Error(`Escrow not found for shipment ${shipmentId}`);
    }
    return record;
  }

  private requireWithdrawal(withdrawalId: string): WithdrawalRecord {
    const record = this.withdrawals.get(withdrawalId);
    if (!record) {
      throw new Error(`Withdrawal not found: ${withdrawalId}`);
    }
    return record;
  }

  private toEscrowResponse(record: EscrowRecord): EscrowResponse {
    return {
      id: record.id,
      shipmentId: record.shipmentId,
      status: record.status,
      amount: record.amount,
      payerUserId: record.payerUserId,
      carrierUserId: record.carrierUserId,
      paymentOrderId: '',
      fundingSource: 'WALLET',
      promoCreditFunded: '0',
    };
  }

  private toWithdrawalResponse(record: WithdrawalRecord): WithdrawalResponse {
    return {
      id: record.id,
      userId: record.userId,
      amount: record.amount,
      status: record.status,
      providerRef: record.providerRef,
      payoutChannel: record.payoutChannel,
      receiptUrl: record.receiptUrl,
    };
  }
}

export function createFinanceGrpcStub(): FinanceGrpcStubClient {
  return new FinanceGrpcStubClient();
}
