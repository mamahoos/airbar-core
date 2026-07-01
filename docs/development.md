# Development guide

## Prerequisites

- Node 22 LTS
- Docker + Docker Compose
- PostgreSQL 16 (provided by `docker-compose.resources.yml` for local dev)

## First-time setup

```bash
cp .env.example .env
make up              # postgres + redis
make migrate-up      # prisma migrate deploy
make verify          # lint + typecheck + unit + build
```

## Docker workflows

### Dependencies only (DB + Redis)

```bash
make up
make migrate-up
npm run dev          # uses .env (localhost URLs)
```

### Full stack (app in container)

```bash
cp .env.example .env
docker build -t airbar-core:local .
docker compose up -d
```

### Health checks

```bash
curl -sf http://localhost:4000/api/v1/health
```

## Environment files

| File | Commit? | Purpose |
|------|---------|---------|
| `.env.example` | Yes | Template for all required variables |
| `.env` | **No** | Local overrides (gitignored) |

Production deployments must inject env via the orchestrator — not via `.env` on disk.

## Migrations

```bash
make migrate-up
make migrate-status
make migrate-down      # rollback one step
```

## Tests

| Scope | Command |
|-------|---------|
| Unit (CI) | `npm test` |
| Integration (Prisma + Postgres) | `make test-integration` |
| Coverage | `npm run test:cov` |
| Full verify | `make verify` |

## CI

GitHub Actions (`.github/workflows/ci.yml`):

- `lint` — ESLint
- `typecheck` — `tsc --noEmit`
- `unit` — Jest unit project
- `build` — `nest build`
- `integration` — Postgres 16 service + Prisma migrate + integration project
- `audit` — `npm audit --audit-level=high`
- `quality-gate` — requires all gates green

## Proto codegen (finance gRPC client)

Generated stubs are committed under `src/adapters/grpc-client/generated/`.
Regenerate when `proto/airbar_finance_v1.proto` changes:

```bash
make proto   # requires buf + ts-proto
```
