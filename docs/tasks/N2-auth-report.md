# N2 Auth — Task Report

**Date:** 2026-07-01  
**Phase:** N2 — Auth  
**Branch:** `feat/n2-auth` (based on `feat/n1-foundation`)  
**Issue:** #4

---

## Objective

Port monolith authentication to Clean Architecture: OTP (SMS), JWT access/refresh,
register, login, logout, sessions, roles, and guards — with TDD on use cases and
OTP rate limiting.

---

## What was implemented

### Domain (`src/domain/auth/`)

| Artifact                  | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `UserRole`, `KycLevel`    | Enums aligned with legacy monolith                                   |
| `AuthUser`, `UserSession` | Auth-facing aggregate slices                                         |
| Repository ports          | `User`, `Otp`, `Session`, `ActivityLog`, `SmsSender`, `TokenService` |

### Application (`src/application/auth/`)

| Use case              | Behavior                                          |
| --------------------- | ------------------------------------------------- |
| `SendOtpUseCase`      | Rate limit → generate OTP → SMS                   |
| `VerifyOtpUseCase`    | Verify → create user if new → issue JWT + session |
| `RegisterUseCase`     | OTP + profile + optional password                 |
| `LoginUseCase`        | bcrypt password login                             |
| `RefreshTokenUseCase` | Rotate refresh token in DB                        |
| `LogoutUseCase`       | Revoke session(s)                                 |
| `ListSessionsUseCase` | Active sessions for current user                  |
| `ValidateUserUseCase` | JWT strategy user lookup                          |
| `OtpRateLimiter`      | Redis cooldown + hourly caps                      |
| `OtpCodeService`      | OTP CRUD + SMS dispatch                           |
| `SessionManager`      | Token pair + session persistence                  |

### Adapters

| Layer       | Path                                 | Notes                                        |
| ----------- | ------------------------------------ | -------------------------------------------- |
| Persistence | `adapters/persistence/auth/`         | Prisma repos for all auth ports              |
| JWT         | `adapters/auth/jwt-token.service.ts` | Access + refresh signing                     |
| SMS         | `adapters/sms/`                      | `DevSmsSender` (default), `LimosmsSmsSender` |
| Web         | `adapters/web/auth/`                 | Controller, DTOs, guards, decorators, module |

### HTTP routes (`/api/v1/auth/`)

| Method | Path         | Auth   |
| ------ | ------------ | ------ |
| POST   | `otp/send`   | Public |
| POST   | `otp/verify` | Public |
| POST   | `register`   | Public |
| POST   | `login`      | Public |
| POST   | `refresh`    | Public |
| POST   | `logout`     | Bearer |
| GET    | `sessions`   | Bearer |
| GET    | `me`         | Bearer |

Global `JwtAuthGuard` + `@Public()` on health and auth public routes.
`RolesGuard` + `@Roles()` ready for admin routes in N5.

### Prisma (migration `20260701120000_n2_auth`)

Extended `users` with phone, role, kyc_level, password_hash, ban flags, etc.
Added `sessions`, `otps`, `activity_logs`. No `walletBalance` — finance SSOT.

### Config (`.env.example`)

`JWT_SECRET`, `JWT_REFRESH_SECRET`, `OTP_*`, `SMS_PROVIDER=dev`, Limosms keys.

---

## Tests

| Suite                                     | Tests                  |
| ----------------------------------------- | ---------------------- |
| `otp-rate-limiter.spec.ts`                | 3                      |
| `login.use-case.spec.ts`                  | 2                      |
| `auth-otp-rate-limit.integration-spec.ts` | 1 (Redis)              |
| Updated `db.smoke.integration-spec.ts`    | phone required on User |

**Unit total:** 49 tests — `make verify` green.

---

## Deferred to later phases

- `POST auth/otp/call` (api.ir voice OTP) → N3 integrations
- Full user profile (`users/me` extended) → N3
- `api_ir` SMS provider → N3 (Limosms + dev cover N2)

---

## Verification

```bash
make verify
make up && make migrate-up && make test-integration
```

---

## Next: N3 Users + KYC (#5)

Profile CRUD, avatar (MinIO), KYC (Shahkar, api.ir), encrypted PII.
