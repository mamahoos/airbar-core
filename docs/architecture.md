# airbar-core — Architecture

Clean-architecture rewrite of the original NestJS backend (`airbar-api`) as the
**marketplace orchestrator** in Scenario B. Financial core (`airbar-finance`,
Go) is a separate service reached over **gRPC** + a transactional outbox.

## References

| Topic                            | Source                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| Architecture choice (Scenario B) | `scenario-b-development/01-معماری-انتخابی.md`                      |
| Node refactor plan               | `scenario-b-development/03-هسته-مرکزی-node.md`                     |
| Outbox pattern                   | `scenario-b-development/05-الگوی-outbox.md`                        |
| Boundary contract                | `test/BOUNDARY-CONTRACT.md`                                        |
| gRPC contract                    | `airbar-finance/proto/airbar_finance_v1.proto`                     |
| Original behavior                | `airbar-api/` (NestJS monolith — **reference, not deploy target**) |
| Finance service                  | `airbar-finance/` (Go — already shipped F0..F6)                    |

## Two services, two databases

```
clients → HTTPS → airbar-core (Node/NestJS) → PostgreSQL airbar_api
                        │
                        ├── gRPC (sync) ──→ airbar-finance (Go) → PostgreSQL airbar_finance
                        └── integration_outbox + BullMQ (retry on gRPC failure)
                                                               ↑
                              Zibal PSP ── HTTPS callback ─────┘ (finance edge only)
```

| Concern                                                                                 | Owner                  |
| --------------------------------------------------------------------------------------- | ---------------------- |
| users, auth, OTP, sessions, KYC, identity, payout profile                               | `airbar-core`          |
| trips, shipments, chat, reviews, disputes, pricing, cities                              | `airbar-core`          |
| notifications, activity log, system config, drafts                                      | `airbar-core`          |
| `shipments.finance_escrow_id`, `shipments.payment_order_id`, `shipments.payment_method` | `airbar-core` (bridge) |
| `integration_outbox` + BullMQ worker                                                    | `airbar-core`          |
| escrows, payment_orders, ledger (SSOT balance), withdrawals, Zibal, reconciliation      | `airbar-finance`       |

## Layering (Clean Architecture)

```
src/
  domain/              # entities, value objects, repository ports — no framework imports
    <context>/
      entity.ts
      repository.port.ts        # interface only
      errors.ts

  application/         # use cases (interactors) — depends on domain ports only
    <context>/
      <use-case>.ts
      <use-case>.spec.ts

  adapters/            # primary (inbound) + secondary (outbound) adapters
    web/               # NestJS controllers, DTOs, validators, exception filter
      <context>/
    grpc-client/       # finance gRPC client (ts-proto generated)
    persistence/       # Prisma repositories implementing domain ports
      prisma.service.ts
      <context>.repository.ts
    storage/           # MinIO
    cache/             # Redis
    queue/             # BullMQ producers + outbox worker
    integrations/      # api.ir, SMS providers

  shared/              # cross-cutting primitives
    errors/
    pagination/
    ids/               # branded id types
    result/            # Result<T,E> helpers
    money/
    idempotency/

  bootstrap/           # composition root
    app.module.ts
    main.ts
    config/            # env loading + validation (zod)
```

### Dependency rule

```
adapters → application → domain ← adapters
```

- `domain` imports nothing from other internal layers.
- `application` depends only on `domain` ports (interfaces).
- `adapters/web` maps HTTP ↔ DTOs and calls use cases.
- `adapters/persistence`, `grpc-client`, etc. implement domain/application ports.
- `bootstrap` wires everything; the only place that knows about concrete adapters.

## Type safety

- **Strict TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Branded IDs** (`UserId`, `TripId`, `ShipmentId`, …) prevent cross-wiring.
- **ts-proto** generates typed gRPC stubs from `airbar_finance_v1.proto`.
- **zod** validates env config and HTTP request bodies at boundaries.
- Money: integer rials as `bigint` / string in proto; decimal display only at the web edge.

## Reliability patterns

| Pattern                        | Where                                         |
| ------------------------------ | --------------------------------------------- |
| Transactional outbox           | `adapters/queue` + `integration_outbox` table |
| Idempotency keys               | `shared/idempotency` → gRPC metadata          |
| Try-sync-first, outbox-on-fail | `application/finance/*-orchestrator`          |
| Cron auto-release + poller     | `application/shipments` cron jobs             |
| Backoff + max attempts         | outbox worker                                 |

## Testing strategy

| Layer                  | Tool                           | What                                             |
| ---------------------- | ------------------------------ | ------------------------------------------------ |
| Unit (small)           | Jest                           | domain rules, use cases with fake repositories   |
| Integration (medium)   | Jest + testcontainers Postgres | Prisma repositories, outbox worker               |
| gRPC contract (medium) | Jest + finance stub            | client against in-process finance or mock server |
| E2E (large)            | Jest + supertest               | HTTP flows with mocked finance                   |

## CI/CD (inspired from `airbar-finance`)

- Parallel gates: `lint`, `typecheck`, `unit`, `build`, `integration` (Postgres 16 service), `audit`.
- `quality-gate` job requires all gates green.
- Dependabot: `npm`, `github-actions`, `docker` (grouped weekly).
- Telegram notifications on repo events + workflow results (already wired).
- **Staging / production deploy:** intentionally left for the maintainer to wire later.
