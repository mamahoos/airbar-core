# N4 — Marketplace report

**Branch:** `feat/n4-marketplace`  
**Issue:** #6  
**Status:** Implementation complete locally; PR pending after N3 merge

## Delivered

### Data model (Prisma)

- `Trip`, `Shipment`, `PricingRule`, `City`, `Airport`
- Finance bridge fields on `Shipment`: `finance_escrow_id`, `payment_order_id`, `payment_method`
- Migration: `20260701210000_n4_marketplace`

### Domain

- `shipment-state-machine.ts` — carrier/sender transitions + dispute
- `pricing-calculator.ts` — quote math (aligned with `@prisma/client` `CargoType`)
- `matching-filters.ts` — cargo-type acceptance + match scoring (unit tested)

### Application

- **Trips:** create, get, update, delete, publish, cancel, search, my, requests
- **Shipments:** quote, create, track, get, update, cancel, accept/reject offer, status updates, dispute, my/carrying
- **Matching:** find trips/shipments, assign to trip, admin auto-match (Redis suggestions)
- **Locations:** list cities / airports
- **Pricing:** `PricingQuoteService` with `PricingRule` DB lookup + domain calculator
- KYC gates: `CREATE_SHIPMENT`, `ASSIGN_SHIPMENT`, `ACCEPT_SHIPMENT_SENDER` → `IDENTITY_VERIFIED`

### Adapters

- Prisma repositories + `MarketplacePersistenceModule`
- HTTP: `trips`, `shipments`, `matching`, `locations` controllers under `/api/v1/*`
- `MarketplaceModule` wired in `AppModule`

### Seed

- `prisma/seed.ts` — cities, airports, default pricing rules (idempotent)

### Tests

- 69 unit tests (`make verify` green)
- New: `matching-filters.spec.ts`
- Existing: state machine, pricing calculator

### CI fix (also applies to N3)

- OTP integration test boots `ConfigModule` + `CacheModule` only (avoids MinIO hang on full `AppModule`)

## Deferred to later phases

| Item                              | Phase |
| --------------------------------- | ----- |
| Chat on assign                    | N5    |
| Notifications on match/status     | N5    |
| Escrow release on `CONFIRMED`     | N6    |
| Market stats (Redis leaderboards) | N5/N6 |
| Payment / `PAID` transition       | N6    |

## API surface (parity with monolith)

| Method | Path                                   | Auth      |
| ------ | -------------------------------------- | --------- |
| GET    | `/trips/search`                        | Public    |
| GET    | `/trips/my`                            | JWT       |
| GET    | `/trips/:id`                           | Public    |
| GET    | `/trips/:id/requests`                  | JWT       |
| POST   | `/trips`                               | JWT       |
| PUT    | `/trips/:id`                           | JWT       |
| DELETE | `/trips/:id`                           | JWT       |
| POST   | `/trips/:id/publish`                   | JWT       |
| POST   | `/trips/:id/cancel`                    | JWT       |
| POST   | `/shipments/quote`                     | Public    |
| GET    | `/shipments/track/:code`               | Public    |
| GET    | `/shipments/my`                        | JWT       |
| GET    | `/shipments/carrying`                  | JWT       |
| GET    | `/shipments/:id`                       | JWT       |
| POST   | `/shipments`                           | JWT + KYC |
| PUT    | `/shipments/:id`                       | JWT       |
| POST   | `/shipments/:id/cancel`                | JWT       |
| POST   | `/shipments/:id/accept`                | JWT + KYC |
| POST   | `/shipments/:id/reject`                | JWT       |
| POST   | `/shipments/:id/status`                | JWT       |
| POST   | `/shipments/:id/dispute`               | JWT       |
| GET    | `/matching/trips/:shipmentId`          | JWT       |
| GET    | `/matching/shipments/:tripId`          | JWT       |
| POST   | `/matching/assign/:shipmentId/:tripId` | JWT + KYC |
| POST   | `/matching/auto`                       | Admin     |
| GET    | `/locations/cities`                    | Public    |
| GET    | `/locations/airports`                  | Public    |

## Test plan

- [ ] `make verify`
- [ ] `npx prisma migrate deploy && npx ts-node prisma/seed.ts`
- [ ] Create trip → publish → create shipment → matching → assign → accept
- [ ] Carrier status flow: `PAID` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED` → sender `CONFIRMED`
- [ ] Public quote + track endpoints without auth

## Merge order

1. Merge PR #23 (N3) — includes UsersModule fix; cherry-pick integration test fix if still hanging
2. Merge PR #24 (rulesets) — re-run CI after rebase
3. Rebase `feat/n4-marketplace` on `main`, open PR #25 → closes #6
