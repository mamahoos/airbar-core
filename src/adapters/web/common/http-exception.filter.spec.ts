import { describe, it, expect, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';


import { NotFoundError } from '../../../shared/errors/index.js';

import { HttpExceptionFilter } from './http-exception.filter.js';

import type { ArgumentsHost } from '@nestjs/common';

function mockHost(): { response: { status: jest.Mock; json: jest.Mock }; request: { method: string; url: string } } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    response: { status, json },
    request: { method: 'GET', url: '/test' },
  };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps DomainError to structured JSON', () => {
    const { response, request } = mockHost();
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new NotFoundError('Trip', 't1'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Trip not found: t1' },
    });
  });

  it('passes through Nest HttpException body', () => {
    const { response, request } = mockHost();
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    const nestEx = new NotFoundException({ error: { code: 'NOT_FOUND', message: 'gone' } });
    filter.catch(nestEx, host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'gone' } });
  });
});
