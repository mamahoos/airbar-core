import { describe, it, expect } from '@jest/globals';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ErrorCode } from '../../shared/errors/index.js';

import { grpcStatusToDomainError, mapGrpcErrorToHttpException } from './grpc-error.mapper.js';

describe('grpc error mapper', () => {
  it('maps NOT_FOUND to NotFoundError', () => {
    const domain = grpcStatusToDomainError({
      name: 'Error',
      message: 'not found',
      code: GrpcStatus.NOT_FOUND,
      details: 'escrow missing',
    });
    expect(domain.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('maps INVALID_ARGUMENT to ValidationError', () => {
    const domain = grpcStatusToDomainError({
      name: 'Error',
      message: 'bad',
      code: GrpcStatus.INVALID_ARGUMENT,
    });
    expect(domain.code).toBe(ErrorCode.VALIDATION);
  });

  it('maps to Nest HttpException', () => {
    const ex = mapGrpcErrorToHttpException({
      name: 'Error',
      message: 'x',
      code: GrpcStatus.INVALID_ARGUMENT,
      details: 'bad amount',
    });
    expect(ex).toBeInstanceOf(UnprocessableEntityException);
  });

  it('maps unknown errors to ServiceUnavailableException', () => {
    const ex = mapGrpcErrorToHttpException(new Error('network'));
    expect(ex.getStatus()).toBe(503);
  });

  it('maps grpc NOT_FOUND to 404 HttpException', () => {
    const ex = mapGrpcErrorToHttpException({
      name: 'Error',
      message: 'x',
      code: GrpcStatus.NOT_FOUND,
    });
    expect(ex).toBeInstanceOf(NotFoundException);
  });
});
