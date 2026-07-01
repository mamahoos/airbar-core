import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { type Observable, map } from 'rxjs';

import { apiSuccess } from './api-response.js';

/** Wraps successful handler results in { success: true, data } unless already wrapped. */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data !== null && typeof data === 'object' && 'success' in data) {
          return data;
        }
        return apiSuccess(data);
      }),
    );
  }
}
