# airbar-core

Node.js / NestJS marketplace orchestrator for Airbar (Scenario B): users, auth,
KYC, trips, shipments, matching, chat, notifications, and finance orchestration
over gRPC to [`airbar-finance`](https://github.com/mamahoos/airbar-finance).

**Status:** N2 Auth — OTP, JWT, sessions, guards (on top of N1 foundation PR).

Full docs: [docs/README.md](docs/README.md) · [docs/architecture.md](docs/architecture.md) · [docs/development.md](docs/development.md)

## Layout (Clean Architecture)

```
src/
  domain/          # entities, value objects, repository ports — no framework imports
  application/     # use cases (interactors) — depends on domain ports only
  adapters/        # web (NestJS), grpc-client, persistence (Prisma), storage, cache, queue, integrations
  shared/          # errors, pagination, branded ids, money, idempotency
  bootstrap/       # composition root (app.module, main, config)
proto/             # airbar_finance_v1.proto (copied from airbar-finance)
prisma/            # schema + migrations
```

### Dependency rule

```
adapters → application → domain ← adapters
```

## Prerequisites

- Node 22 LTS
- Docker + Docker Compose

**Setup, env, Docker, migrations, tests:** [docs/development.md](docs/development.md)
**Phase plan & reports:** [docs/tasks/00-plan.md](docs/tasks/00-plan.md) · [docs/README.md](docs/README.md)

## CI

- `ci.yml` — parallel gates: lint, typecheck, unit, build, integration (Postgres 16), audit → `quality-gate`
- `notify-events.yml` — Telegram repo notifications
- Dependabot — `npm`, `github-actions`, `docker` (grouped weekly)

Staging / production deploy workflows are intentionally not included yet.
