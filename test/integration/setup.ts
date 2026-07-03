// Integration test bootstrap. Runs once before the integration project.
// The CI workflow applies `prisma migrate deploy` against the ephemeral
// Postgres service before invoking `npm run test:integration`.
import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ??=
  'postgresql://airbar:airbar_secret@localhost:5435/airbar_api?schema=public';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6382';

export const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});
