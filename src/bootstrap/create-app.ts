import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { FinanceGrpcClient } from '../adapters/grpc-client/finance-grpc.client.js';
import { HttpExceptionFilter } from '../adapters/web/common/http-exception.filter.js';
import { LoggingInterceptor } from '../adapters/web/common/logging.interceptor.js';
import { TransformInterceptor } from '../adapters/web/common/transform.interceptor.js';

import { AppModule } from './app.module.js';
import { loadConfig, type AppConfig } from './config/index.js';
import { APP_LOGGER, LoggingModule } from './logging/index.js';
import { createBootstrapLogger, type NestWinstonLogger } from './logging/nest-winston.logger.js';

import type { CanActivate, ExecutionContext, INestApplication, Type } from '@nestjs/common';

class NoopThrottlerGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

export interface CreateAppOptions {
  readonly env?: Record<string, string | undefined>;
  readonly financeStub?: FinanceGrpcClient;
  readonly overrides?: ReadonlyArray<{ provide: Type<unknown> | symbol | string; useValue: unknown }>;
}

function testEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const databaseUrl =
    overrides.DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://airbar:airbar_secret@localhost:5435/airbar_api?schema=public';

  return {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
    REDIS_PORT: process.env.REDIS_PORT ?? '6382',
    API_IR_DEV_MOCK: 'true',
    SMS_PROVIDER: 'dev',
    FINANCE_GRPC_URL: 'localhost:50051',
    THROTTLE_LIMIT: '10000',
    THROTTLE_TTL: '60',
    OTP_COOLDOWN_SECONDS: '1',
    OTP_MAX_PER_HOUR: '10000',
    ...overrides,
  };
}

/**
 * Boot the full Nest application for integration/E2E tests with optional provider overrides.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<INestApplication> {
  const env = testEnv(options.env);
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  const config: AppConfig = loadConfig(env);
  const logger = createBootstrapLogger(config);

  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useClass(NoopThrottlerGuard);

  if (options.financeStub) {
    builder = builder.overrideProvider(FinanceGrpcClient).useValue(options.financeStub);
  }

  for (const override of options.overrides ?? []) {
    builder = builder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleRef: TestingModule = await builder.compile();
  const app = moduleRef.createNestApplication({ logger, bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const appLogger = moduleRef.get<NestWinstonLogger>(APP_LOGGER);
  app.useGlobalInterceptors(new LoggingInterceptor(appLogger), new TransformInterceptor());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'api/v' });

  await app.init();
  return app;
}

export { LoggingModule };
