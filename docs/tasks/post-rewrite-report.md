# Post-rewrite completion report

**Date:** 2026-07-01  
**Status:** N0–N7 merged to `main`; follow-up PR closes remaining gaps.

## Delivered in follow-up (`feat/complete-remaining`)

### `/stats/market` — Redis leaderboards

- `MarketStatsService` with backfill from Postgres on first boot
- `GET /api/v1/stats/market` — top origins, destinations, cargo types, routes
- Live hooks: shipment create, trip publish, intake claim (shipment)

### NestJS 11 upgrade (closes #11)

- `@nestjs/*` core packages → v11
- `@nestjs/bullmq` → v11, `@nestjs/schedule` → v6, `@nestjs/config` → v4
- CORS callback typed for stricter ESLint under Nest 11 types
- High-severity transitive vulns (lodash, multer) cleared

### Integration smoke tests

- `test/integration/marketplace.smoke.integration-spec.ts` — market stats + trip/shipment assign flow

## Still out of scope (maintainer)

- Staging/production deploy workflows
- Real Zibal sandbox E2E (covered in `airbar-finance`)
- Telegram bot secret wiring
- External notification microservice push URL
