import { z } from 'zod';

const NodeEnv = z.enum(['development', 'test', 'production']);

/** Convert `SCREAMING_SNAKE_CASE` env keys to `camelCase`. */
function camelizeEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    const camel = key
      .toLowerCase()
      .replace(/_([a-z0-9])/g, (_s: string, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

/**
 * Application configuration. Every runtime setting MUST come from the
 * environment — no hardcoded production defaults. Optional keys are declared
 * here so callers know they exist; their absence is a valid value.
 *
 * Field names are camelCase; the env keys are `SCREAMING_SNAKE_CASE` and are
 * converted by `camelizeEnv` before parsing.
 */
export const AppConfigSchema = z.object({
  nodeEnv: NodeEnv.default('development'),
  port: z.coerce.number().int().positive().default(4000),
  /** CORS origins, comma-separated. Empty means "no origin restriction". */
  corsOrigins: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .default('http://localhost:3000,https://airbar.app,https://www.airbar.app'),
  throttleTtl: z.coerce.number().int().positive().default(60),
  throttleLimit: z.coerce.number().int().positive().default(100),

  databaseUrl: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

  redisHost: z.string().default('localhost'),
  redisPort: z.coerce.number().int().positive().default(6379),

  /** airbar-finance gRPC endpoint — wired in N1, used from N6. */
  financeGrpcUrl: z.string().default('localhost:50051'),
  financeGrpcTls: z.coerce.boolean().default(false),

  jwtSecret: z.string().min(16).default('dev-only-jwt-secret-change-in-production'),
  jwtRefreshSecret: z.string().min(16).default('dev-only-jwt-refresh-secret-change-in-production'),
  jwtExpiresIn: z.string().default('7d'),
  jwtRefreshExpiresIn: z.string().default('30d'),

  otpLength: z.coerce.number().int().min(4).max(8).default(6),
  otpExpiresIn: z.coerce.number().int().positive().default(300),
  otpMaxPerHour: z.coerce.number().int().positive().default(10),
  otpCooldownSeconds: z.coerce.number().int().positive().default(60),

  smsProvider: z.enum(['limosms', 'api_ir', 'dev']).default('dev'),
  limosmsApiKey: z.string().optional(),
  limosmsSenderNumber: z.string().optional(),
  limosmsOtpPattern: z.string().optional(),
  limosmsFooter: z.string().optional(),
  apiIrBearerToken: z.string().optional(),
  apiIrDevMock: z.coerce.boolean().default(false),
  apiIrBaseUrl: z.string().url().default('https://s.api.ir/api/sw1'),
  apiIrTimeoutMs: z.coerce.number().int().positive().default(15_000),

  piiEncryptionKey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'PII_ENCRYPTION_KEY must be 64 hex characters')
    .default('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),

  minioEndpoint: z.string().default('localhost'),
  minioPort: z.coerce.number().int().positive().default(9000),
  minioAccessKey: z.string().default('minioadmin'),
  minioSecretKey: z.string().default('minioadmin'),
  minioBucket: z.string().default('airbar'),
  minioUseSsl: z.coerce.boolean().default(false),

  logLevel: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export class ConfigError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super('Invalid application configuration');
    this.name = 'ConfigError';
  }
}

/**
 * Load and validate configuration from `process.env`. Throws `ConfigError`
 * with all validation issues at once so misconfigurations fail fast at boot.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = AppConfigSchema.safeParse(camelizeEnv(env));
  if (!result.success) {
    throw new ConfigError(result.error.issues);
  }
  return result.data;
}
