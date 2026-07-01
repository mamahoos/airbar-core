# N0 Bootstrap — Task Report

**Date:** 2026-07-01
**Phase:** N0 — Bootstrap
**Branch:** `feat/n0-bootstrap`
**Issue:** #2

---

## Objective

Stand up a deployable `airbar-core` Node/NestJS process with environment-based
configuration, Prisma + Redis + BullMQ wiring, a health endpoint, Docker, a
Makefile, and CI quality gates — no business logic yet.

---

## What was implemented

### Application bootstrap (Clean Architecture)

| Layer                 | Path                                 | Description                                                                                                 |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Config                | `src/bootstrap/config/`              | zod schema + `loadConfig` (camelizes `SCREAMING_SNAKE` env keys); `ConfigModule` exposes frozen `AppConfig` |
| Domain                | `src/domain/health/`                 | `HealthIndicatorPort` + result types — no framework imports                                                 |
| Application           | `src/application/health/`            | `HealthService` aggregator (pure orchestration, unit-testable with fakes)                                   |
| Adapter — web         | `src/adapters/web/health/`           | `HealthController` → `GET /api/v1/health`                                                                   |
| Adapter — persistence | `src/adapters/persistence/`          | `PrismaService` (lifecycle-managed) + `PrismaHealthIndicator`                                               |
| Adapter — cache       | `src/adapters/cache/`                | `RedisService` (ioredis) + `RedisHealthIndicator`                                                           |
| Adapter — queue       | `src/adapters/queue/`                | `QueueModule` (BullMQ shares Redis)                                                                         |
| Adapter — health      | `src/adapters/health/`               | Prisma + Redis health indicators                                                                            |
| Bootstrap             | `src/bootstrap/{app.module,main}.ts` | composition root: Helmet, compression, CORS, ValidationPipe, URI versioning `api/v`, Swagger `/docs`        |

### Dependency rule

```
adapters → application → domain ← adapters
```

`domain` has no framework imports. `application` depends only on domain ports.
Adapters implement ports and are wired in `AppModule`.

### Tooling

| File                                   | Purpose                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                         | Node 22, npm scripts for build/dev/lint/format/typecheck/test/test:integration/prisma                                        |
| `tsconfig.json`                        | strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `module: node16` (`.js`-suffix imports) |
| `tsconfig.build.json`                  | excludes specs + generated grpc client                                                                                       |
| `tsconfig.eslint.json`                 | includes specs + test for type-checked lint                                                                                  |
| `eslint.config.mjs`                    | flat config, `typescript-eslint` type-checked, `import/order`, Prettier last                                                 |
| `.prettierrc.json` + `.prettierignore` | format config                                                                                                                |
| `jest.config.json`                     | multi-project: `unit` + `integration`                                                                                        |
| `nest-cli.json`                        | Nest CLI build config                                                                                                        |

### Prisma

- `prisma/schema.prisma` — minimal `User` (proves migration path; extended in N2/N3)
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20260107000000_init/migration.sql`

### Infra

| File                           | Change                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                   | multi-stage build (`node:22-bookworm-slim`), Prisma generate, runtime `--omit=dev`                      |
| `docker-compose.yml`           | postgres:16 + redis:7 + app; host ports 5435 / 6382 (avoid finance clashes)                             |
| `docker-compose.resources.yml` | postgres + redis only for local dev                                                                     |
| `.dockerignore`                |                                                                                                         |
| `.env.example`                 | all N0 keys + reserved keys for N2..N7                                                                  |
| `Makefile`                     | `verify`, `test-integration`, `migrate-up/status/down`, `lint`, `format`, `typecheck`, `proto`, `build` |

### CI (`.github/workflows/ci.yml`)

Parallel gates (inspired from `airbar-finance`):

1. `changes` — `dorny/paths-filter` skips irrelevant jobs
2. `lint` — ESLint + Prettier check
3. `typecheck` — `tsc --noEmit` (with `prisma generate`)
4. `unit-test` — Jest unit project + coverage artifact
5. `build` — `nest build`
6. `integration` — Postgres 16 service + `prisma migrate deploy` + integration project
7. `audit` — `npm audit --omit=dev --audit-level=critical`
8. `quality-gate` — requires all gates green (or skipped)

### Dependabot (`.github/dependabot.yml`)

Added `npm` and `docker` ecosystems (grouped weekly, Asia/Tehran) alongside the
existing `github-actions` ecosystem.

### Tests

| Suite                                           | Tests                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/bootstrap/config/config.spec.ts`           | 6 — parses valid env, defaults, CORS split, ConfigError listing, unknown NODE_ENV, missing DATABASE_URL |
| `src/application/health/health.service.spec.ts` | 3 — all up, any down, no indicators                                                                     |
| `test/integration/db.smoke.integration-spec.ts` | 3 — SELECT 1, users table exists, insert/read/delete                                                    |

---

## Verification results (local)

```text
npm run lint            — OK
npm run format:check    — OK
npm run typecheck       — OK
npm test                — 9 passed (2 suites)
npm run test:integration — 3 passed (against dockerized Postgres 16)
npm run build           — OK (dist/bootstrap/main.js emitted)
npm audit --omit=dev --audit-level=critical — OK (0 critical)
```

Integration run against `docker compose -f docker-compose.resources.yml`:
postgres on host 5435, redis on 6382, `prisma migrate deploy` then jest integration project.

---

## Architecture notes

- **Config:** all settings from env; `zod` validates at boot; `ConfigError` lists
  every issue at once. Env keys are `SCREAMING_SNAKE_CASE`, schema fields are
  `camelCase` (converted by `camelizeEnv`).
- **Module resolution:** `module: node16` + `.js`-suffix imports — modern,
  type-safe, works with `tsc`, `nest build`, `ts-jest` (via `moduleNameMapper`
  stripping `.js`).
- **Multi-provider health:** adapters register `HealthIndicatorPort`
  implementations against the `HEALTH_INDICATORS` token with `multi: true`; the
  `HealthService` aggregates them. Adding a new dependency's health check is
  one line in its module.
- **Two-DB boundary:** `airbar-core` owns `airbar_api` only. No financial tables
  in the schema — those live in `airbar_finance` (Go).
- **Ports:** postgres host `5435`, redis host `6382` — avoid clashes with
  `airbar-finance` (5434 / 6381) and other local Airbar services.

---

## Out of scope (handled in later phases)

- ~~N1 Foundation~~ — proto codegen, gRPC client, shared kernel
- N2..N7 — auth, users/KYC, marketplace, chat/admin/stats, finance orchestration, intake/internal/hardening
- Staging / production deploy workflows — left for the maintainer

---

## Known follow-ups

- **High-severity transitive vulns** in `lodash` and `multer` require a NestJS
  10→11 upgrade. Tracked as a separate issue. CI audit gate uses
  `--audit-level=critical` until then.
- Branch protection requiring `quality-gate` on PRs to `main` — maintainer to
  configure in GitHub settings.
- Telegram secret setup (`TELEGRAM_TO`, `TELEGRAM_TOKEN`) for
  `notify-events.yml` — maintainer.

---

## Files added (summary)

**New:** `package.json`, `tsconfig*.json`, `jest.config.json`, `eslint.config.mjs`,
`.prettierrc.json`, `.prettierignore`, `nest-cli.json`, `Dockerfile`,
`.dockerignore`, `docker-compose.yml`, `docker-compose.resources.yml`,
`Makefile`, `.env.example`, `prisma/schema.prisma` + `migrations/`,
`src/bootstrap/{main,app.module}.ts`, `src/bootstrap/config/*`,
`src/domain/health/*`, `src/application/health/*`,
`src/adapters/{web/health,persistence,cache,queue,health}/*`,
`test/integration/{setup,db.smoke.integration-spec}.ts`, this report.

**Updated:** `.gitignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`.
