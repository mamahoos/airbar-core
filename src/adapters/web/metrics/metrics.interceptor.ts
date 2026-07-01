import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { httpRequestDuration, httpRequestsTotal } from './metrics.constants.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string; route?: { path?: string }; url: string }>();
    const res = http.getResponse<{ statusCode: number }>();
    const route = req.route?.path ?? req.url;
    const end = httpRequestDuration.startTimer({ method: req.method, route });

    return next.handle().pipe(
      tap({
        next: () => {
          end();
          httpRequestsTotal.inc({
            method: req.method,
            route,
            status_code: String(res.statusCode),
          });
        },
        error: () => {
          end();
          httpRequestsTotal.inc({
            method: req.method,
            route,
            status_code: String(res.statusCode || 500),
          });
        },
      }),
    );
  }
}
