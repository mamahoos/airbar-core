import { VersioningType, ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

import { HttpExceptionFilter } from '../adapters/web/common/http-exception.filter.js';
import { LoggingInterceptor } from '../adapters/web/common/logging.interceptor.js';
import { TransformInterceptor } from '../adapters/web/common/transform.interceptor.js';

import { AppModule } from './app.module.js';
import { loadConfig } from './config/index.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      config.nodeEnv === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.use(helmet());
  app.use(compression());

  const allowedOrigins = config.corsOrigins;
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86_400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'api/v' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AirBar API')
    .setDescription('AirBar marketplace orchestrator (airbar-core).')
    .setVersion('0.1.0')
    .addTag('health', 'Liveness and readiness')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  await app.listen(config.port);

  const shutdown = (signal: string) => {
    logger.warn(`Received ${signal}, shutting down…`);
    void app.close().finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log(`🚀 airbar-core on port ${config.port}`);
  logger.log(`📚 Swagger docs at http://localhost:${config.port}/docs`);
  logger.log(`🏥 Health at http://localhost:${config.port}/api/v1/health`);
  logger.log(`📈 Metrics at http://localhost:${config.port}/api/v1/metrics`);
  logger.log(`🌍 Environment: ${config.nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
