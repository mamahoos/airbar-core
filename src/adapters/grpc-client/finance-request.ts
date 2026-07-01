import { randomUUID } from 'node:crypto';

import { RequestContext } from './generated/airbar_finance_v1.js';
import { CALLER_SERVICE_NAME } from './metadata.js';

export function buildProtoContext(idempotencyKey: string, requestId?: string) {
  return RequestContext.create({
    idempotencyKey,
    requestId: requestId ?? randomUUID(),
    callerService: CALLER_SERVICE_NAME,
  });
}
