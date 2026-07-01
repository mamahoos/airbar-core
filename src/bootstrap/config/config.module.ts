import { Global, Module } from '@nestjs/common';

import { AppConfig, loadConfig } from './config.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Loads and validates environment configuration once at bootstrap, then
 * exposes the frozen `AppConfig` object to every other module. Failures here
 * crash the process before any route is wired — fail fast on misconfig.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
