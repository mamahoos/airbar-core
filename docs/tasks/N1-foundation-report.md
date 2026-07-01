# N1 Foundation — Task Report

**Date:** 2026-07-01  
**Phase:** N1 — Foundation & shared kernel  
**Branch:** `feat/n1-foundation`  
**Issue:** #3

---

## Objective

Establish the shared kernel, global HTTP cross-cutting concerns, and the
airbar-finance gRPC client skeleton so later phases (auth, marketplace,
finance orchestration) share one error envelope, pagination model, money
semantics, and idempotency key vocabulary.

---

## What was implemented

### Shared kernel (`src/shared/`)

| Module      | Path                  | Description                                                                 |
| ----------- | --------------------- | --------------------------------------------------------------------------- |
| Branded IDs | `shared/ids/`         | `UserId`, `TripId`, `ShipmentId`, … — nominal types with factory validation |
| Result      | `shared/result/`      | `ok` / `err` discriminated union for non-throwing boundaries                |
| Money       | `shared/money/`       | Integer rials (`bigint`), fee split aligned with finance ledger             |
| Pagination  | `shared/pagination/`  | Offset pagination (default 1/20, max 100), skip/take for Prisma             |
| Errors      | `shared/errors/`      | `DomainError` hierarchy + `ErrorCode` → Nest `HttpException` mapper         |
| Idempotency | `shared/idempotency/` | Key builders (`escrow:`, `release:`, `wd:`, …) matching scenario-b outbox   |

### Global HTTP adapters (`src/adapters/web/common/`)

| Component              | Role                                                           |
| ---------------------- | -------------------------------------------------------------- |
| `api-response.ts`      | `{ success: true, data }` envelope helper                      |
| `HttpExceptionFilter`  | Catches all errors → structured `{ error: { code, message } }` |
| `TransformInterceptor` | Wraps successful handler results in success envelope           |
| `LoggingInterceptor`   | Request duration logging                                       |

Wired in `src/bootstrap/main.ts`.

### gRPC client skeleton (`src/adapters/grpc-client/`)

| Artifact                        | Description                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| `proto/airbar_finance_v1.proto` | Copied from airbar-finance canonical contract                     |
| `generated/`                    | ts-proto stubs (committed; regenerate via `make proto`)           |
| `metadata.ts`                   | `idempotency-key`, `x-request-id`, `x-caller-service=airbar-core` |
| `grpc-error.mapper.ts`          | gRPC status → `DomainError` / HTTP exception                      |
| `FinanceGrpcClient`             | Skeleton with `checkReady()` — 5s deadline, TLS optional          |
| `FinanceGrpcModule`             | Global Nest module exporting client                               |

### Application port (N6 deferred)

- `src/application/finance/finance-orchestrator.port.ts` — `FinanceOrchestratorPort` interface only (`checkFinanceReady()`); implementation in N6.

---

## Tests added

| Suite                                               | Tests |
| --------------------------------------------------- | ----- |
| `shared/ids/ids.spec.ts`                            | 3     |
| `shared/result/result.spec.ts`                      | 4     |
| `shared/money/money.spec.ts`                        | 4     |
| `shared/pagination/pagination.spec.ts`              | 4     |
| `shared/errors/http-mapper.spec.ts`                 | 2     |
| `shared/idempotency/keys.spec.ts`                   | 5     |
| `adapters/web/common/http-exception.filter.spec.ts` | 2     |
| `adapters/grpc-client/metadata.spec.ts`             | 3     |
| `adapters/grpc-client/grpc-error.mapper.spec.ts`    | 5     |

**Unit total after N1:** 41 tests (was 9 in N0).

---

## Tooling changes

- `npm run proto:generate` + `scripts/generate-proto.mjs` (grpc-tools + ts-proto)
- `make proto` target wired
- `@grpc/grpc-js`, `@grpc/proto-loader` runtime deps
- `tsconfig.build.json` — generated stubs included in production build
- `.gitignore` — generated gRPC stubs tracked (like airbar-finance)

---

## Verification

```bash
make verify          # lint + typecheck + 41 unit tests + build — PASS
make test-integration  # unchanged N0 Postgres smoke — PASS (when DB up)
```

---

## Commits

~30 atomic commits on `feat/n1-foundation` (shared kernel slices, web cross-cutting, proto/codegen, gRPC skeleton, docs). Pushed in one batch to limit CI notify noise.

---

## Next: N2 Auth (#4)

OTP (SMS), JWT, register/login/refresh/logout, sessions, roles — TDD against monolith behavior.
