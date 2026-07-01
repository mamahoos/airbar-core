import { describe, it, expect } from '@jest/globals';

import { prisma } from './setup.js';

describe('Postgres integration smoke', () => {
  it('connects and answers SELECT 1', async () => {
    const rows = await prisma.$queryRaw<unknown[]>`SELECT 1 AS one`;
    expect(rows).toHaveLength(1);
  });

  it('has the users table from the init migration', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    expect(rows.map((r) => r.table_name)).toContain('users');
  });

  it('can insert and read a User row', async () => {
    const created = await prisma.user.create({
      data: { phone: '09120000001' },
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.phone).toBe('09120000001');

    const found = await prisma.user.findUnique({ where: { id: created.id } });
    expect(found?.id).toBe(created.id);

    await prisma.user.delete({ where: { id: created.id } });
  });
});
