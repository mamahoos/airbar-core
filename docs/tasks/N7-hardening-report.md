# N7 — Intake, Internal API, and Hardening report

**Branch:** `feat/n7-intake-internal-hardening` (stacked on N6)  
**Issue:** #9  
**Status:** Ready for PR — completes rewrite phases N0–N7

## Delivered

### Intake (`draft_requests`)

- Prisma `DraftRequest` + enums (`DraftType`, `DraftStatus`, `DraftSource`)
- `POST /intake/drafts` — `x-intake-key` guarded ingestion
- `GET /intake/drafts/:token` — public preview
- `POST /intake/drafts/:token/claim` — JWT user claims → Trip or Shipment
- `GET /intake/stats` — funnel stats

### Internal API

- `GET /internal/users/:id` — legacy-compatible shape for notification service
- `POST /internal/users/bulk`
- `POST /internal/notifications` — create in-app notification
- Guarded by `x-internal-key` (`INTERNAL_API_KEY` or `INTAKE_API_KEY`)

### Hardening

- Prometheus metrics at `GET /api/v1/metrics` (`prom-client`)
- HTTP request counter + duration histogram via global interceptor
- Graceful shutdown on `SIGTERM` / `SIGINT`
- Helmet, compression, CORS, Swagger (already in N0; metrics path added)

### Config

- `INTAKE_API_KEY`, `INTERNAL_API_KEY`, `PUBLIC_WEB_URL`
- `INTAKE_TEST_MODE`, `INTAKE_TEST_TELEGRAM_CHAT_ID`

### Tests

- Integration smoke: intake draft create + claim path (`test/integration/intake.smoke.integration-spec.ts`)

## Test plan

- [x] `make verify`
- [ ] `POST /intake/drafts` with `x-intake-key`
- [ ] Claim draft with JWT → shipment/trip created
- [ ] `GET /api/v1/metrics` returns Prometheus text
- [ ] Internal user lookup with `x-internal-key`

## Merge order (full stack)

1. #25 N4 → `main`
2. Rebase #26 N5 → merge
3. Rebase #27 N6 → merge
4. Rebase this PR → merge → closes #9

## Rewrite complete

All phases N0–N7 implemented. Money movement delegated to `airbar-finance` via gRPC + outbox.
