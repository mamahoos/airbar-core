import { describe, it, expect } from '@jest/globals';

import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports ok when all indicators are up', async () => {
    const service = HealthService.fromResults([
      { database: { status: 'up' } },
      { redis: { status: 'up' } },
    ]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ database: { status: 'up' }, redis: { status: 'up' } });
  });

  it('reports down when any indicator is down', async () => {
    const service = HealthService.fromResults([
      { database: { status: 'up' } },
      { redis: { status: 'down', message: 'ECONNREFUSED' } },
    ]);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.checks.redis).toEqual({ status: 'down', message: 'ECONNREFUSED' });
  });

  it('reports ok when no indicators are registered', async () => {
    const service = new HealthService();

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({});
  });
});
