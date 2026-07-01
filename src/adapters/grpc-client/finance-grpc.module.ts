import { Global, Module } from '@nestjs/common';

import { FinanceGrpcClient } from './finance-grpc.client.js';

@Global()
@Module({
  providers: [FinanceGrpcClient],
  exports: [FinanceGrpcClient],
})
export class FinanceGrpcModule {}
