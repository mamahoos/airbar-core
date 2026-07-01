import { credentials, type ServiceError } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { DomainError, ErrorCode } from '../../shared/errors/index.js';

import {
  FinanceHealthServiceClient,
  type HealthCheckRequest,
  type HealthCheckResponse,
  HealthCheckRequest as HealthCheckRequestCodec,
} from './generated/airbar_finance_v1.js';
import { grpcStatusToDomainError, isGrpcServiceError } from './grpc-error.mapper.js';
import { buildGrpcMetadata, type GrpcCallMetadata } from './metadata.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

export const FINANCE_GRPC_DEADLINE_MS = 5_000;

@Injectable()
export class FinanceGrpcClient implements OnModuleDestroy {
  private readonly healthClient: FinanceHealthServiceClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const creds = config.financeGrpcTls ? credentials.createSsl() : credentials.createInsecure();
    this.healthClient = new FinanceHealthServiceClient(config.financeGrpcUrl, creds);
  }

  /** UC-24 — verify finance gRPC connectivity (read-only, no idempotency key). */
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
  }
}
