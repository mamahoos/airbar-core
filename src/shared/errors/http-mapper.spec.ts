import { describe, it, expect } from '@jest/globals';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { NotFoundError, ValidationError } from './domain-errors.js';
import { domainErrorToHttpException } from './http-mapper.js';

describe('domainErrorToHttpException', () => {
  it('maps NotFoundError to 404 with structured body', () => {
    const ex = domainErrorToHttpException(new NotFoundError('Shipment', 'abc'));
    expect(ex).toBeInstanceOf(NotFoundException);
    expect(ex.getResponse()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Shipment not found: abc' },
    });
  });

  it('maps ValidationError to 422 with details', () => {
    const ex = domainErrorToHttpException(new ValidationError('bad input', { field: 'x' }));
    expect(ex).toBeInstanceOf(UnprocessableEntityException);
    expect(ex.getResponse()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'bad input', details: { field: 'x' } },
    });
  });
});
