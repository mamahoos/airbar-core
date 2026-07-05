import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

import { APP_LOGGER } from '../../../bootstrap/logging/logging.module.js';

import type { NestWinstonLogger } from '../../../bootstrap/logging/nest-winston.logger.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(APP_LOGGER) private readonly logger: NestWinstonLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(`${req.method} ${req.url} ${ms}ms`, 'HTTP');
        },
        error: (err: unknown) => {
          const ms = Date.now() - started;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`${req.method} ${req.url} ${ms}ms — ${msg}`, 'HTTP');
        },
      }),
    );
  }
}
