import { Module } from '@nestjs/common';

import { API_IR } from '../../../domain/kyc/api-ir.port.js';

import { ApiIrClient } from './api-ir.client.js';

@Module({
  providers: [{ provide: API_IR, useClass: ApiIrClient }],
  exports: [API_IR],
})
export class ApiIrModule {}
