import { Module } from '@nestjs/common';

import { outboxRepositoryProvider } from './prisma-outbox.repository.js';

@Module({
  providers: [outboxRepositoryProvider],
  exports: [outboxRepositoryProvider],
})
export class FinancePersistenceModule {}
