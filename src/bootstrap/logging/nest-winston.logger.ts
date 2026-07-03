import { Injectable, type LoggerService } from '@nestjs/common';

import { createWinstonLogger } from './winston-logger.factory.js';

import type { AppConfig } from '../config/index.js';
import type winston from 'winston';

@Injectable()
export class NestWinstonLogger implements LoggerService {
  private readonly logger: winston.Logger;

  constructor(config: AppConfig) {
    this.logger = createWinstonLogger(config);
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { context, trace });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug?(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose?(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }
}

export function createBootstrapLogger(config: AppConfig): NestWinstonLogger {
  return new NestWinstonLogger(config);
}
