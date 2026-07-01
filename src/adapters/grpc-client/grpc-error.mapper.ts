import { status as GrpcStatus } from '@grpc/grpc-js';
import { ServiceUnavailableException } from '@nestjs/common';

import {
  ConflictError,
  DomainError,
  ErrorCode,
  NotFoundError,
  ValidationError,
  domainErrorToHttpException,
} from '../../shared/errors/index.js';

export interface GrpcServiceError extends Error {
  readonly code: GrpcStatus;
  readonly details: string;
}

export function isGrpcServiceError(error: unknown): error is GrpcServiceError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as GrpcServiceError).code === 'number'
  );
}

/** Map gRPC status codes to domain errors for consistent HTTP responses. */
export function grpcStatusToDomainError(error: GrpcServiceError): DomainError {
  const detail = error.details ?? error.message;
  const code = error.code;

  if (code === GrpcStatus.NOT_FOUND) {
    return new NotFoundError('Finance resource', detail);
  }
  if (code === GrpcStatus.ALREADY_EXISTS) {
    return new ConflictError(detail);
  }
  if (code === GrpcStatus.INVALID_ARGUMENT || code === GrpcStatus.FAILED_PRECONDITION) {
    return new ValidationError(detail);
  }
  if (code === GrpcStatus.UNAVAILABLE) {
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Finance service unavailable', detail);
  }
  if (code === GrpcStatus.DEADLINE_EXCEEDED) {
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Finance service timeout', detail);
  }

  return new DomainError(ErrorCode.INTERNAL, 'Finance service error', {
    code: error.code,
    detail,
  });
}

export function mapGrpcErrorToHttpException(error: unknown) {
  if (!isGrpcServiceError(error)) {
    return new ServiceUnavailableException({
      error: { code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Finance service error' },
    });
  }
  return domainErrorToHttpException(grpcStatusToDomainError(error));
}
