import { randomUUID } from 'node:crypto';

import { Metadata } from '@grpc/grpc-js';

/** gRPC metadata keys — must match airbar-finance server expectations. */
export const GRPC_METADATA = {
  IDEMPOTENCY_KEY: 'idempotency-key',
  REQUEST_ID: 'x-request-id',
  CALLER_SERVICE: 'x-caller-service',
} as const;

export const CALLER_SERVICE_NAME = 'airbar-core';

export interface GrpcCallMetadata {
  readonly idempotencyKey?: string | undefined;
  readonly requestId?: string | undefined;
}

export function buildGrpcMetadata(options: GrpcCallMetadata = {}): Metadata {
  const metadata = new Metadata();
  metadata.set(GRPC_METADATA.CALLER_SERVICE, CALLER_SERVICE_NAME);
  metadata.set(GRPC_METADATA.REQUEST_ID, options.requestId ?? randomUUID());

  if (options.idempotencyKey !== undefined) {
    metadata.set(GRPC_METADATA.IDEMPOTENCY_KEY, options.idempotencyKey);
  }

  return metadata;
}
