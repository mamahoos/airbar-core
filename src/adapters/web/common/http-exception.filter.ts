import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ErrorCode, toHttpException } from '../../../shared/errors/index.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpException = toHttpException(exception);
    const status = httpException.getStatus();
    const body = httpException.getResponse();

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload =
      typeof body === 'object' && body !== null && 'error' in body
        ? body
        : {
            error: {
              code: status >= 500 ? ErrorCode.INTERNAL : ErrorCode.VALIDATION,
              message: typeof body === 'string' ? body : httpException.message,
            },
          };

    response.status(status).json(payload);
  }
}
