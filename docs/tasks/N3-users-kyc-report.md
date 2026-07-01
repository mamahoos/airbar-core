# N3 Users + KYC — Task Report

**Date:** 2026-07-01  
**Phase:** N3 — Users + KYC  
**Branch:** `feat/n3-users-kyc` (based on `feat/n2-auth`)  
**Issue:** #5

---

## Objective

Port user profile management and KYC flows from the legacy monolith with encrypted
PII at rest, api.ir integrations (Shahkar, PersonInfo, CardMatch, CardToIban,
postal code), document upload, admin review, and `@RequireKyc` / `KycLevelGuard`.

---

## What was implemented

### Users slice (committed earlier on branch)

| Area | Path | Notes |
| ---- | ---- | ----- |
| PII crypto | `src/shared/crypto/pii-crypto.ts` | AES-256-GCM + SHA-256 hash |
| Prisma | `20260701140000_n3_users_kyc` | identity profiles, bank accounts, addresses, kyc_documents |
| Application | `src/application/users/` | profile, avatar, password, sessions, activity, public profile |
| Web | `src/adapters/web/users/` | `/api/v1/users/*` |

### KYC slice (this continuation)

| Area | Path | Notes |
| ---- | ---- | ----- |
| Domain ports | `src/domain/kyc/` | `ApiIrPort`, `KycRepositoryPort`, `KycRequirementOptions` |
| KYC gate | `src/application/kyc/kyc-gate.ts` | Level + nationalId + financial checks |
| Use cases | `src/application/kyc/` | verify-identity, verify-bank-card, postal-code, documents, admin review |
| api.ir client | `src/adapters/integrations/api-ir/` | HTTP client + `API_IR_DEV_MOCK` fallback |
| Persistence | `src/adapters/persistence/kyc/` | Prisma repo with encrypted national ID / card / IBAN |
| Web | `src/adapters/web/kyc/` | Controller, DTOs, `KycLevelGuard`, `@RequireKyc` |
| Prisma | `20260701160000_n3_financial_verified` | `users.financial_verified_at` |

### HTTP routes (`/api/v1/kyc/`)

| Method | Path | Auth | KYC guard |
| ------ | ---- | ---- | --------- |
| GET | `status` | Bearer | — |
| POST | `verify-identity` | Bearer | `MOBILE_VERIFIED` |
| POST | `verify-bank-card` | Bearer | `IDENTITY_VERIFIED` + nationalId |
| DELETE | `bank-accounts/:id` | Bearer | `IDENTITY_VERIFIED` + nationalId |
| POST | `postal-code` | Bearer | — |
| POST | `documents/:type` | Bearer | `IDENTITY_VERIFIED` + nationalId |
| POST | `admin/review/:documentId` | Bearer + Admin | — |

### Config (`.env.example`)

`API_IR_BEARER_TOKEN`, `API_IR_DEV_MOCK`, `API_IR_BASE_URL`, `API_IR_TIMEOUT_MS`,
`PII_ENCRYPTION_KEY` (64 hex chars).

### Security notes

- National ID, card number, and IBAN stored as **ciphertext + hash** (no plaintext columns).
- KYC status API does **not** return raw national ID or full card/IBAN.
- Signed URLs for private KYC document uploads (7-day expiry).

---

## Tests

| Suite | Count |
| ----- | ----- |
| `kyc-gate.spec.ts` | 3 |
| `verify-identity.use-case.spec.ts` | 2 |
| **Total unit (repo)** | **56** |

`make verify` — lint, typecheck, unit, build green.

---

## Deferred / out of scope

- `POST auth/otp/call` (api.ir voice OTP) — N2 deferral, unchanged.
- Finance wallet (`GET users/me/wallet`) — stub for N6.
- Integration tests against real api.ir — use `API_IR_DEV_MOCK=true` locally.

---

## Merge order

1. Merge N1 PR (#19) → rebase N2 (#20) → merge N2  
2. Open N3 PR stacked on `feat/n2-auth`, closes #5
