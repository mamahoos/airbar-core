import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/index.js';

import { NestWinstonLogger } from './nest-winston.logger.js';

import type { AppConfig } from '../config/index.js';

export const APP_LOGGER = Symbol('APP_LOGGER');

@Global()
@Module({
  providers: [
    {
      provide: APP_LOGGER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new NestWinstonLogger(config),
    },
    {
      provide: NestWinstonLogger,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new NestWinstonLogger(config),
    },
  ],
  exports: [APP_LOGGER, NestWinstonLogger],
})
export class LoggingModule {}
