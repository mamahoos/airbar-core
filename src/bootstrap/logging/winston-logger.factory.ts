import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import type { AppConfig } from '../config/index.js';

const NEST_TO_WINSTON: Record<AppConfig['logLevel'], string> = {
  error: 'error',
  warn: 'warn',
  log: 'info',
  debug: 'debug',
  verbose: 'silly',
};

export function createWinstonLogger(config: AppConfig): winston.Logger {
  const level = NEST_TO_WINSTON[config.logLevel] ?? 'info';
  const logDir = join(process.cwd(), 'logs');

  if (config.nodeEnv !== 'test') {
    mkdirSync(logDir, { recursive: true });
  }

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level: lvl, message, context }) => {
          const ctx = typeof context === 'string' ? `[${context}] ` : '';
          return `${String(timestamp)} ${String(lvl)} ${ctx}${String(message)}`;
        }),
      ),
    }),
  ];

  if (config.nodeEnv !== 'test') {
    transports.push(
      new DailyRotateFile({
        dirname: logDir,
        filename: 'airbar-core-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        level,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    );
  }

  return winston.createLogger({
    level,
    transports,
  });
}
