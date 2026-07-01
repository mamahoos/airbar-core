# airbar-core — Phase Plan

**Goal:** Rewrite the original NestJS backend (`airbar-api`, GitLab) as
`airbar-core` (GitHub) — a Clean-Architecture Node/NestJS marketplace
orchestrator that delegates all money movement to the Go service
`airbar-finance` over gRPC + a transactional outbox.

**Behavior source of truth:** `airbar-api/` (logic preserved; structure transformed).
**Finance contract:** `airbar-finance/proto/airbar_finance_v1.proto` (already shipped F0..F6).

## Assumptions (surface early)

These are defaults I'm proceeding with. Override any of them and I'll adjust.

1. **Stack:** Node 22 LTS, npm, NestJS 10 + Express (preserves original platform), Prisma 5, Jest, BullMQ, Redis, MinIO.
2. **Type safety:** strict TS, branded IDs, zod at boundaries, `ts-proto` for gRPC codegen.
3. **Package layout:** Clean Architecture — `src/{domain,application,adapters,shared,bootstrap}` (see `architecture.md`).
4. **Fresh schema:** `airbar-core` is a **rewrite**, not an in-place refactor. The Prisma schema omits the legacy `Payment`, `Payout`, `WalletTransaction` tables and `User.walletBalance` from day one — those concerns now live in `airbar-finance`. The original `airbar-api` DB is **not** migrated; cutover is out of scope here.
5. **PSP:** Only Zibal (parity with finance). ZarinPal/Stripe providers from the monolith are **not** ported.
6. **HTTP surface:** public API on Node only; finance exposes only health + Zibal callback (already done in Go).
7. **Deploy / staging:** intentionally untouched. CI gates + Docker build + image push are fine; deploy workflows are left for the maintainer.
8. **Repo on GitHub** (`mamahoos/airbar-core`), not GitLab. PR-first workflow per `.cursor/rules/git-workflow-pr.mdc`.
9. **Issues** track each phase; closed by the PR that implements them.

## Phases

| Phase | Title                                | Scope                                                                                                                                                                            | PR                                | Report                          |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------- |
| N0    | Bootstrap                            | Repo skeleton, tooling, CI gates, health, Docker, Prisma baseline                                                                                                                | feat/n0-bootstrap                 | `N0-bootstrap-report.md`        |
| N1    | Foundation & shared kernel           | Clean Architecture base, errors, pagination, branded IDs, response envelope, proto codegen, gRPC client skeleton, idempotency keys                                               | feat/n1-foundation                | `N1-foundation-report.md`       |
| N2    | Auth                                 | OTP (SMS), JWT access/refresh, register, login, logout, sessions, roles, guards                                                                                                  | feat/n2-auth                      | `N2-auth-report.md`             |
| N3    | Users + KYC                          | profile, avatar, sessions, activity log, KYC (Shahkar, identity, bank card, documents, api.ir)                                                                                   | feat/n3-users-kyc                 | `N3-users-kyc-report.md`        |
| N4    | Marketplace                          | trips, shipments, matching, pricing, search, lifecycle, quote/track                                                                                                              | feat/n4-marketplace               | `N4-marketplace-report.md`      |
| N5    | Chat + Notifications + Admin + Stats | non-financial surfaces (admin payments list defers to N6)                                                                                                                        | feat/n5-chat-notif-admin          | `N5-chat-notif-admin-report.md` |
| N6    | Finance orchestration                | gRPC client + FinanceOrchestrator + integration_outbox + BullMQ worker + bridge fields + payments/wallet/withdrawal refactor + cron auto-release + admin payout/dispute via gRPC | feat/n6-finance-orchestration     | `N6-finance-report.md`          |
| N7    | Intake + Internal + hardening        | intake drafts, internal API, cron jobs, prometheus metrics, graceful shutdown                                                                                                    | feat/n7-intake-internal-hardening | `N7-hardening-report.md`        |

### Phase detail

#### N0 — Bootstrap

- `package.json` (Node 22, npm scripts: `build`, `dev`, `start`, `lint`, `format`, `typecheck`, `test`, `test:integration`, `test:cov`, `prisma:*`)
- `tsconfig.json` strict, `tsconfig.build.json`
- ESLint flat config + Prettier
- Jest config (unit + integration projects)
- NestJS app skeleton (`bootstrap/main.ts`, `bootstrap/app.module.ts`) with health `/api/v1/health`
- Prisma baseline schema + first migration (`User` minimal) — proves migration path
- Redis + BullMQ module wiring
- `Dockerfile` (multi-stage), `docker-compose.yml` (postgres + redis + app), `docker-compose.resources.yml`
- `Makefile` mirroring finance (`verify`, `test-integration`, `migrate-up`, `lint`, `format`, `proto`)
- `.env.example` with all keys N0 needs
- CI: extend `.github/workflows/ci.yml` with parallel gates (lint, typecheck, unit, build, integration with Postgres 16, audit) + `quality-gate`; add `npm` + `docker` to Dependabot
- TDD: health controller tests, config validation tests

#### N1 — Foundation & shared kernel

- `shared/errors` (mapped to Nest exceptions), `shared/pagination`, `shared/ids` (branded), `shared/result`, `shared/money`, `shared/idempotency` (key builders matching finance patterns)
- Global exception filter, transform interceptor, logging interceptor (ported from monolith but cleaned)
- Copy `proto/airbar_finance_v1.proto` into `proto/`; `ts-proto` codegen target `src/adapters/grpc-client/generated/`
- `FinanceGrpcClient` skeleton with metadata interceptor (`idempotency-key`, `x-request-id`, `x-caller-service=airbar-core`), timeout, error mapping
- `FinanceOrchestrator` interface (port) — implementation lands in N6
- Tests: idempotency key builders, error mapping, pagination math

#### N2 — Auth

Port `auth/*` from monolith with Clean Architecture split:

- domain: `User`, `Session`, `Otp`, roles enum
- application: `SendOtp`, `VerifyOtp`, `Register`, `Login`, `Refresh`, `Logout`, `ListSessions`
- adapters: web (controllers + DTOs + zod), persistence (Prisma repos), `sms` provider abstraction (LimoSMS/api.ir)
- JWT strategy + guards, roles guard, `@Public`, `@CurrentUser`, `@Roles`
- TDD: every use case has a unit spec; integration spec for OTP rate limiting

#### N3 — Users + KYC

- Users: profile CRUD, avatar (MinIO), password change, sessions, activity log, `me/wallet` proxies finance (N6)
- KYC: Shahkar verification, identity (api.ir PersonInfo), bank card (api.ir IBAN/card inquiry), postal code, documents upload, admin review, `KycLevel` guard + `@RequireKyc`
- PII boundary: IBAN/card/national_id encrypted at rest in `airbar_api`
- `user_payout_profiles` (IBAN ciphertext) for withdrawal flow in N6

#### N4 — Marketplace

- Trips: create/publish/search/cancel, my trips, requests
- Shipments: quote/track/create/cancel/accept/reject/status/dispute, my/ carrying
- Matching: compatible trip/shipment pairs + assign
- Pricing: `PricingRule` + `agreedPrice` calc
- Cities / Airports
- Bridge fields `finance_escrow_id`, `payment_order_id`, `payment_method` on `Shipment`
- TDD: state machine transitions, pricing math, matching filters (price + cargo types — last commit on monolith fixed this; preserve the fix)

#### N5 — Chat + Notifications + Admin + Stats

- Chat: thread per shipment, messages
- Notifications: in-app, read/unread, list
- Admin: dashboard, users, ban/unban, KYC pending, logs, config, pricing rules, **disputes list** (resolve actions defer to N6)
- Stats: public stats, popular routes, testimonials, market (live market stats call finance in N6)

#### N6 — Finance orchestration (the big one)

- `FinanceOrchestrator` implementation mapping domain events → gRPC calls with idempotency keys
- `integration_outbox` Prisma model + migration; `IntegrationOutboxService` (insert + enqueue) + BullMQ processor + per-command handlers + backoff + max attempts + admin replay endpoint
- `payments.service` rewrite: createEscrow + createPaymentOrder → redirect; remove ZarinPal/Stripe providers; remove PSP callback routes (finance owns callbacks)
- `wallet.service` → proxy `GetWallet` / `ListWalletTransactions`
- `requestPayout` → decrypt IBAN → `CreateWithdrawal` (wire KYC `REQUEST_PAYOUT`)
- admin: `ProcessWithdrawal`, `RejectWithdrawal`, dispute resolve `RefundEscrow`/`ReleaseEscrow`, manual refund, freeze on dispute open
- `escrow.service` cron auto-release → gRPC `ReleaseEscrow` with outbox-on-fail
- `FinanceEscrowPollerJob` → shipment `PAID` after Zibal callback + notification
- Tests: orchestrator idempotency key builders, outbox fail→retry→done, gRPC client contract

#### N7 — Intake + Internal + hardening

- Intake: drafts (telegram DM → notification service delegation), claim flow, stats; `intake-key` guard
- Internal: API-key-guarded `users/:id`, `users/bulk`, `notifications`
- Cron jobs consolidated
- Prometheus metrics (`/api/v1/metrics`), graceful shutdown, Swagger, helmet/compression/CORS (ported from monolith main.ts)
- E2E smoke test: register → create trip → create shipment → match → mock finance pay → PAID

## Definition of Done (per phase)

- [ ] Code + tests (unit; integration where it crosses a boundary)
- [ ] All CI gates green on the PR
- [ ] Phase report committed to `docs/tasks/`
- [ ] Linked issue closed by the merge
- [ ] No PII in logs; no secrets in repo
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` clean locally

## Out of scope (maintainer will handle later)

- Staging and production deploy workflows
- Branch protection rule configuration on GitHub
- Telegram secret setup (`TELEGRAM_TO`, `TELEGRAM_TOKEN`)
- Cutover from the legacy `airbar-api` database
- E2E against real Zibal sandbox (finance repo already covers this)
