import { describe, it, expect } from '@jest/globals';

import { loadConfig, ConfigError, ProductionSecretError } from './config.js';

const PRODUCTION_SECRETS: Record<string, string> = {
  JWT_SECRET: 'prod-jwt-secret-with-enough-length',
  JWT_REFRESH_SECRET: 'prod-jwt-refresh-secret-with-enough-length',
  PII_ENCRYPTION_KEY: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  PORT: '4000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
  REDIS_HOST: 'redis',
  REDIS_PORT: '6379',
  FINANCE_GRPC_URL: 'finance-grpc.internal:50051',
  FINANCE_GRPC_TLS: 'true',
  LOG_LEVEL: 'debug',
  ...PRODUCTION_SECRETS,
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
    expect(cfg.financePaymentIdentityLimitRials).toBe(50_000_000);
    expect(cfg.financePayoutIdentityLimitRials).toBe(20_000_000);
    expect(cfg.logLevel).toBe('debug');
  });

  it('parses finance risk limits from env', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
      FINANCE_PAYMENT_IDENTITY_LIMIT_RIALS: '1000000',
      FINANCE_PAYMENT_DOCUMENT_LIMIT_RIALS: '2000000',
      FINANCE_PAYMENT_FULL_LIMIT_RIALS: '3000000',
      FINANCE_PAYOUT_IDENTITY_LIMIT_RIALS: '400000',
      FINANCE_PAYOUT_DOCUMENT_LIMIT_RIALS: '500000',
      FINANCE_PAYOUT_FULL_LIMIT_RIALS: '600000',
    });

    expect(cfg.financePaymentIdentityLimitRials).toBe(1_000_000);
    expect(cfg.financePaymentDocumentLimitRials).toBe(2_000_000);
    expect(cfg.financePaymentFullLimitRials).toBe(3_000_000);
    expect(cfg.financePayoutIdentityLimitRials).toBe(400_000);
    expect(cfg.financePayoutDocumentLimitRials).toBe(500_000);
    expect(cfg.financePayoutFullLimitRials).toBe(600_000);
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

  it('blocks production boot when default dev secrets are still configured', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
      }),
    ).toThrow(ProductionSecretError);
  });

  it('allows production boot when secrets are overridden', () => {
    const cfg = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/airbar_api',
      ...PRODUCTION_SECRETS,
    });

    expect(cfg.nodeEnv).toBe('production');
    expect(cfg.jwtSecret).toBe(PRODUCTION_SECRETS.JWT_SECRET);
  });
});
