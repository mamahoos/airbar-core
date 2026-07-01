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
  readonly code: number;
  readonly details?: string;
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

  switch (error.code) {
    case GrpcStatus.NOT_FOUND:
      return new NotFoundError('Finance resource', detail);
    case GrpcStatus.ALREADY_EXISTS:
      return new ConflictError(detail);
    case GrpcStatus.INVALID_ARGUMENT:
    case GrpcStatus.FAILED_PRECONDITION:
      return new ValidationError(detail);
    case GrpcStatus.UNAVAILABLE:
      return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Finance service unavailable', detail);
    case GrpcStatus.DEADLINE_EXCEEDED:
      return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Finance service timeout', detail);
    default:
      return new DomainError(ErrorCode.INTERNAL, 'Finance service error', {
        code: error.code,
        detail,
      });
  }
}

export function mapGrpcErrorToHttpException(error: unknown) {
  if (!isGrpcServiceError(error)) {
    return new ServiceUnavailableException({
      error: { code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Finance service error' },
    });
  }
  return domainErrorToHttpException(grpcStatusToDomainError(error));
}
