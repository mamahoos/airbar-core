import { describe, it, expect } from '@jest/globals';

import { loadConfig, ConfigError } from './config.js';

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  PORT: '4000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
  REDIS_HOST: 'redis',
  REDIS_PORT: '6379',
  FINANCE_GRPC_URL: 'finance-grpc.internal:50051',
  FINANCE_GRPC_TLS: 'true',
  LOG_LEVEL: 'debug',
};

describe('loadConfig', () => {
  it('parses a complete valid environment', () => {
    const cfg = loadConfig(VALID_ENV);

    expect(cfg.nodeEnv).toBe('production');
    expect(cfg.port).toBe(4000);
    expect(cfg.databaseUrl).toBe(VALID_ENV.DATABASE_URL);
    expect(cfg.redisHost).toBe('redis');
    expect(cfg.redisPort).toBe(6379);
    expect(cfg.financeGrpcUrl).toBe('finance-grpc.internal:50051');
    expect(cfg.financeGrpcTls).toBe(true);
    expect(cfg.logLevel).toBe('debug');
  });

  it('applies defaults for optional keys', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api' });

    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.port).toBe(4000);
    expect(cfg.redisHost).toBe('localhost');
    expect(cfg.redisPort).toBe(6379);
    expect(cfg.financeGrpcTls).toBe(false);
    expect(cfg.logLevel).toBe('log');
    expect(cfg.corsOrigins).toContain('https://airbar.app');
  });

  it('parses boolean-like env strings explicitly', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
      FINANCE_GRPC_TLS: 'false',
      API_IR_DEV_MOCK: 'false',
      MINIO_USE_SSL: 'false',
      INTAKE_TEST_MODE: '0',
    });

    expect(cfg.financeGrpcTls).toBe(false);
    expect(cfg.apiIrDevMock).toBe(false);
    expect(cfg.minioUseSsl).toBe(false);
    expect(cfg.intakeTestMode).toBe(false);
  });

  it('splits CORS_ORIGINS into a trimmed array', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
      CORS_ORIGINS: ' https://a.app ,https://b.app ,, ',
    });

    expect(cfg.corsOrigins).toEqual(['https://a.app', 'https://b.app']);
  });

  it('throws ConfigError listing every invalid key at once', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'staging',
        PORT: 'not-a-port',
        DATABASE_URL: 'not-a-url',
        REDIS_PORT: '-1',
        LOG_LEVEL: 'loud',
      }),
    ).toThrow(ConfigError);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ ...VALID_ENV, NODE_ENV: 'staging' })).toThrow(ConfigError);
  });

  it('requires DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = VALID_ENV;
    void _omitted;
    expect(() => loadConfig(rest)).toThrow(ConfigError);
  });
});
