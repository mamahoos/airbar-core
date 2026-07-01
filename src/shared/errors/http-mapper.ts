import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { DomainError, ErrorCode } from './domain-errors.js';

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

export function domainErrorToHttpException(error: DomainError): HttpException {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };

  switch (error.code) {
    case ErrorCode.VALIDATION:
      return new UnprocessableEntityException(body);
    case ErrorCode.UNAUTHORIZED:
      return new UnauthorizedException(body);
    case ErrorCode.FORBIDDEN:
      return new ForbiddenException(body);
    case ErrorCode.NOT_FOUND:
      return new NotFoundException(body);
    case ErrorCode.CONFLICT:
      return new ConflictException(body);
    case ErrorCode.UNPROCESSABLE:
      return new UnprocessableEntityException(body);
    case ErrorCode.RATE_LIMITED:
      return new BadRequestException(body);
    case ErrorCode.SERVICE_UNAVAILABLE:
      return new ServiceUnavailableException(body);
    case ErrorCode.INTERNAL:
    default:
      return new InternalServerErrorException(body);
  }
}

export function toHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  if (error instanceof DomainError) return domainErrorToHttpException(error);
  if (error instanceof Error) {
    return new InternalServerErrorException({
      error: { code: ErrorCode.INTERNAL, message: 'Internal server error' },
    } satisfies ApiErrorBody);
  }
  return new InternalServerErrorException({
    error: { code: ErrorCode.INTERNAL, message: 'Internal server error' },
  } satisfies ApiErrorBody);
}
