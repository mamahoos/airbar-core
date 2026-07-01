import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import {
  METRICS_REGISTRY,
  createMetricsRegistry,
  registerAppMetrics,
} from './metrics.constants.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsInterceptor } from './metrics.interceptor.js';

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: METRICS_REGISTRY,
      useFactory: () => {
        const registry = createMetricsRegistry();
        registerAppMetrics(registry);
        return registry;
      },
    },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class MetricsModule {}
