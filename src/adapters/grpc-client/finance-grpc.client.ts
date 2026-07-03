import { credentials, type ServiceError } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { DomainError, ErrorCode } from '../../shared/errors/index.js';

import { buildProtoContext } from './finance-request.js';
import {
  CreateEscrowRequest,
  CreatePaymentOrderRequest,
  CreateWalletTopupRequest,
  CreateWithdrawalRequest,
  EscrowServiceClient,
  FinanceHealthServiceClient,
  FreezeEscrowRequest,
  FundEscrowRequest,
  GetEscrowRequest,
  GetReconciliationRunRequest,
  GetTreasuryRequest,
  GetPaymentOrderRequest,
  GetWalletRequest,
  ListWalletTransactionsRequest,
  ListReconciliationRunsRequest,
  ListWithdrawalsRequest,
  MarkDeliveredRequest,
  PartialRefundEscrowRequest,
  PayFromWalletRequest,
  PaymentOrderServiceClient,
  ProcessWithdrawalRequest,
  ReconciliationServiceClient,
  RefundEscrowRequest,
  RejectWithdrawalRequest,
  ReleaseEscrowRequest,
  RunReconciliationRequest,
  TreasuryServiceClient,
  VerifyPaymentOrderRequest,
  WalletServiceClient,
  WithdrawalServiceClient,
  type EscrowResponse,
  type HealthCheckRequest,
  type HealthCheckResponse,
  type PaymentOrderResponse,
  type ReconciliationRunResponse,
  type ReconciliationRunsResponse,
  type TreasurySummaryResponse,
  type WalletResponse,
  type WalletTransactionsResponse,
  type WithdrawalResponse,
  type WithdrawalsResponse,
  HealthCheckRequest as HealthCheckRequestCodec,
} from './generated/airbar_finance_v1.js';
import { grpcStatusToDomainError, isGrpcServiceError } from './grpc-error.mapper.js';
import { buildGrpcMetadata, type GrpcCallMetadata } from './metadata.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

export const FINANCE_GRPC_DEADLINE_MS = 5_000;

@Injectable()
export class FinanceGrpcClient implements OnModuleDestroy {
  private readonly healthClient: FinanceHealthServiceClient;
  private readonly escrowClient: EscrowServiceClient;
  private readonly paymentClient: PaymentOrderServiceClient;
  private readonly walletClient: WalletServiceClient;
  private readonly withdrawalClient: WithdrawalServiceClient;
  private readonly treasuryClient: TreasuryServiceClient;
  private readonly reconciliationClient: ReconciliationServiceClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const creds = config.financeGrpcTls ? credentials.createSsl() : credentials.createInsecure();
    const url = config.financeGrpcUrl;
    this.healthClient = new FinanceHealthServiceClient(url, creds);
    this.escrowClient = new EscrowServiceClient(url, creds);
    this.paymentClient = new PaymentOrderServiceClient(url, creds);
    this.walletClient = new WalletServiceClient(url, creds);
    this.withdrawalClient = new WithdrawalServiceClient(url, creds);
    this.treasuryClient = new TreasuryServiceClient(url, creds);
    this.reconciliationClient = new ReconciliationServiceClient(url, creds);
  }

  checkReady(metadata?: GrpcCallMetadata): Promise<HealthCheckResponse> {
    const request: HealthCheckRequest = HealthCheckRequestCodec.create();
    return this.unary((cb) =>
      this.healthClient.checkReady(
        request,
        buildGrpcMetadata(metadata),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  createEscrow(
    input: {
      shipmentId: string;
      carrierUserId: string;
      payerUserId: string;
      amount: string;
      idempotencyKey: string;
    },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = CreateEscrowRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
      carrierUserId: input.carrierUserId,
      payerUserId: input.payerUserId,
      amount: input.amount,
    });
    return this.unary((cb) =>
      this.escrowClient.createEscrow(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  getEscrow(shipmentId: string): Promise<EscrowResponse> {
    const request = GetEscrowRequest.create({ shipmentId });
    return this.unary((cb) =>
      this.escrowClient.getEscrow(request, buildGrpcMetadata(), { deadline: this.deadline() }, cb),
    );
  }

  fundEscrow(
    input: { shipmentId: string; paymentOrderId: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = FundEscrowRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
      paymentOrderId: input.paymentOrderId,
    });
    return this.unary((cb) =>
      this.escrowClient.fundEscrow(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  payFromWallet(
    input: {
      shipmentId: string;
      payerUserId: string;
      amount: string;
      idempotencyKey: string;
    },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = PayFromWalletRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
      payerUserId: input.payerUserId,
      amount: input.amount,
    });
    return this.unary((cb) =>
      this.escrowClient.payFromWallet(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  markDelivered(
    input: { shipmentId: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = MarkDeliveredRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
    });
    return this.unary((cb) =>
      this.escrowClient.markDelivered(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  freezeEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = FreezeEscrowRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
    });
    return this.unary((cb) =>
      this.escrowClient.freezeEscrow(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  releaseEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = ReleaseEscrowRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
    });
    return this.unary((cb) =>
      this.escrowClient.releaseEscrow(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  refundEscrow(
    input: { shipmentId: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = RefundEscrowRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
    });
    return this.unary((cb) =>
      this.escrowClient.refundEscrow(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  partialRefundEscrow(
    input: { shipmentId: string; refundAmount: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<EscrowResponse> {
    const request = PartialRefundEscrowRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
      refundAmount: input.refundAmount,
    });
    return this.unary((cb) =>
      this.escrowClient.partialRefundEscrow(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
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
    metadata?: GrpcCallMetadata,
  ): Promise<PaymentOrderResponse> {
    const request = CreatePaymentOrderRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      shipmentId: input.shipmentId,
      payerUserId: input.payerUserId,
      amount: input.amount,
      agreedPrice: input.agreedPrice,
      callbackUrl: input.callbackUrl,
      successUrl: input.successUrl,
      failureUrl: input.failureUrl,
      description: input.description,
    });
    return this.unary((cb) =>
      this.paymentClient.createPaymentOrder(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  getPaymentOrder(orderId: string): Promise<PaymentOrderResponse> {
    const request = GetPaymentOrderRequest.create({ orderId });
    return this.unary((cb) =>
      this.paymentClient.getPaymentOrder(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  verifyPaymentOrder(
    input: { orderId: string; authority: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<PaymentOrderResponse> {
    const request = VerifyPaymentOrderRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      orderId: input.orderId,
      authority: input.authority,
    });
    return this.unary((cb) =>
      this.paymentClient.verifyPaymentOrder(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  createWalletTopupOrder(
    input: {
      userId: string;
      amount: string;
      callbackUrl: string;
      successUrl: string;
      failureUrl: string;
      description: string;
      idempotencyKey: string;
    },
    metadata?: GrpcCallMetadata,
  ): Promise<PaymentOrderResponse> {
    const request = CreateWalletTopupRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      userId: input.userId,
      amount: input.amount,
      callbackUrl: input.callbackUrl,
      successUrl: input.successUrl,
      failureUrl: input.failureUrl,
      description: input.description,
    });
    return this.unary((cb) =>
      this.paymentClient.createWalletTopupOrder(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  getWallet(userId: string, currency = 'IRR'): Promise<WalletResponse> {
    const request = GetWalletRequest.create({ userId, currency });
    return this.unary((cb) =>
      this.walletClient.getWallet(request, buildGrpcMetadata(), { deadline: this.deadline() }, cb),
    );
  }

  listWalletTransactions(userId: string, currency = 'IRR'): Promise<WalletTransactionsResponse> {
    const request = ListWalletTransactionsRequest.create({ userId, currency });
    return this.unary((cb) =>
      this.walletClient.listWalletTransactions(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
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
    metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const request = CreateWithdrawalRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      userId: input.userId,
      amount: input.amount,
      destinationIban: input.destinationIban,
      userActive: input.userActive,
      financialKycApproved: input.financialKycApproved,
    });
    return this.unary((cb) =>
      this.withdrawalClient.createWithdrawal(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  listWithdrawals(userId: string, status = ''): Promise<WithdrawalsResponse> {
    const request = ListWithdrawalsRequest.create({ userId, status });
    return this.unary((cb) =>
      this.withdrawalClient.listWithdrawals(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  processWithdrawal(
    input: {
      withdrawalId: string;
      providerRef: string;
      payoutChannel: string;
      receiptUrl: string;
      idempotencyKey: string;
    },
    metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const request = ProcessWithdrawalRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      withdrawalId: input.withdrawalId,
      providerRef: input.providerRef,
      payoutChannel: input.payoutChannel,
      receiptUrl: input.receiptUrl,
    });
    return this.unary((cb) =>
      this.withdrawalClient.processWithdrawal(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  rejectWithdrawal(
    input: { withdrawalId: string; reason: string; idempotencyKey: string },
    metadata?: GrpcCallMetadata,
  ): Promise<WithdrawalResponse> {
    const request = RejectWithdrawalRequest.create({
      context: buildProtoContext(input.idempotencyKey),
      withdrawalId: input.withdrawalId,
      reason: input.reason,
    });
    return this.unary((cb) =>
      this.withdrawalClient.rejectWithdrawal(
        request,
        buildGrpcMetadata({ ...metadata, idempotencyKey: input.idempotencyKey }),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  getTreasurySummary(currency = 'IRT'): Promise<TreasurySummaryResponse> {
    const request = GetTreasuryRequest.create({ currency });
    return this.unary((cb) =>
      this.treasuryClient.getTreasurySummary(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  runReconciliation(): Promise<ReconciliationRunResponse> {
    const request = RunReconciliationRequest.create();
    return this.unary((cb) =>
      this.reconciliationClient.runReconciliation(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  listReconciliationRuns(): Promise<ReconciliationRunsResponse> {
    const request = ListReconciliationRunsRequest.create();
    return this.unary((cb) =>
      this.reconciliationClient.listReconciliationRuns(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  getReconciliationRun(runId: string): Promise<ReconciliationRunResponse> {
    const request = GetReconciliationRunRequest.create({ runId });
    return this.unary((cb) =>
      this.reconciliationClient.getReconciliationRun(
        request,
        buildGrpcMetadata(),
        { deadline: this.deadline() },
        cb,
      ),
    );
  }

  private deadline(): Date {
    return new Date(Date.now() + FINANCE_GRPC_DEADLINE_MS);
  }

  private unary<T>(
    invoke: (callback: (error: ServiceError | null, response: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      invoke((error, response) => {
        if (error) {
          reject(this.toDomainError(error));
          return;
        }
        resolve(response);
      });
    });
  }

  private toDomainError(error: unknown): DomainError {
    if (isGrpcServiceError(error)) {
      return grpcStatusToDomainError(error);
    }
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Finance service unreachable');
  }

  onModuleDestroy(): void {
    this.healthClient.close();
    this.escrowClient.close();
    this.paymentClient.close();
    this.walletClient.close();
    this.withdrawalClient.close();
    this.treasuryClient.close();
    this.reconciliationClient.close();
  }
}
