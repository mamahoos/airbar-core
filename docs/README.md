# airbar-core — Documentation

Engineering docs for the Node/NestJS marketplace orchestrator (Scenario B).

## Roadmap & phases

| Phase                                   | Status  | Report                                                           |
| --------------------------------------- | ------- | ---------------------------------------------------------------- |
| N0 Bootstrap                            | Done    | [tasks/N0-bootstrap-report.md](./tasks/N0-bootstrap-report.md)   |
| N1 Foundation & shared kernel           | Done    | [tasks/N1-foundation-report.md](./tasks/N1-foundation-report.md) |
| N2 Auth                                 | Planned | —                                                                |
| N3 Users + KYC                          | Planned | —                                                                |
| N4 Marketplace                          | Planned | —                                                                |
| N5 Chat + Notifications + Admin + Stats | Planned | —                                                                |
| N6 Finance orchestration                | Planned | —                                                                |
| N7 Intake + Internal + hardening        | Planned | —                                                                |

Parent plan: [tasks/00-plan.md](./tasks/00-plan.md) · Architecture: [architecture.md](./architecture.md)

## Quick reference

| Topic                    | Location                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| Local setup, Docker, env | [development.md](./development.md)                                     |
| gRPC contract (finance)  | [`../proto/airbar_finance_v1.proto`](../proto/airbar_finance_v1.proto) |
| Prisma migrations        | `prisma/migrations/`                                                   |
| Architecture             | [architecture.md](./architecture.md)                                   |

## Configuration (production rule)

- **All runtime settings from environment** — no hardcoded defaults in config loader.
- **`.env.example`** — committed template; copy to `.env` for local dev only.
- **Production** — inject the same keys via orchestrator secrets; never commit `.env`.

## Testing

```bash
make verify                       # lint + typecheck + unit + build
make test-integration             # needs TEST_DATABASE_URL + Postgres
npm run test:cov                  # coverage
```

See [development.md](./development.md) for full commands.
