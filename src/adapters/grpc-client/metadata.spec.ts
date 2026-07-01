import { describe, it, expect } from '@jest/globals';

import { buildGrpcMetadata, CALLER_SERVICE_NAME, GRPC_METADATA } from './metadata.js';

describe('buildGrpcMetadata', () => {
  it('sets caller service and request id', () => {
    const md = buildGrpcMetadata({ requestId: 'req-123' });
    expect(md.get(GRPC_METADATA.CALLER_SERVICE)).toEqual([CALLER_SERVICE_NAME]);
    expect(md.get(GRPC_METADATA.REQUEST_ID)).toEqual(['req-123']);
  });

  it('sets idempotency key when provided', () => {
    const md = buildGrpcMetadata({ idempotencyKey: 'escrow:ship-1', requestId: 'r1' });
    expect(md.get(GRPC_METADATA.IDEMPOTENCY_KEY)).toEqual(['escrow:ship-1']);
  });

  it('generates a request id when omitted', () => {
    const md = buildGrpcMetadata();
    const ids = md.get(GRPC_METADATA.REQUEST_ID);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
