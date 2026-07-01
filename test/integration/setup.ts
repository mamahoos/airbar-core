// Integration test bootstrap. Runs once before the integration project.
// The CI workflow applies `prisma migrate deploy` against the ephemeral
// Postgres service before invoking `npm run test:integration`.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});
