# Server Discovery — airbar-core staging

> Shared VPS facts: see [airbar-finance/docs/server-discovery.md](https://github.com/mamahoos/airbar-finance/blob/main/docs/server-discovery.md).

## Core staging target

| Item         | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Repo         | `airbar-core`                                               |
| Server path  | `/srv/airbar.app/airbar-core/`                              |
| Container    | `airbar-core-app-staging`                                   |
| Database     | `airbar_api_staging` on `airbar-postgres`                   |
| Network      | `airbar-net` (external)                                     |
| Public URL   | **`https://staging.api.airbar.app`** (DNS + nginx by CTO)   |
| Finance gRPC | `airbar-finance-app-staging:50051` (internal, same network) |

## One-time server bootstrap

```bash
# Create staging DB (once)
docker exec -it airbar-postgres psql -U postgres -c \
  "CREATE DATABASE airbar_api_staging OWNER airbar;"

# Deploy directory
sudo mkdir -p /srv/airbar.app/airbar-core
sudo chown -R debian:debian /srv/airbar.app/airbar-core

# Env on server (edit secrets)
cp .env.staging.example .env.staging
```

## CI/CD flow (same strategy as airbar-finance)

| Workflow                | Trigger                         | Action                                                               |
| ----------------------- | ------------------------------- | -------------------------------------------------------------------- |
| **CI**                  | PR + push to `main`             | lint, typecheck, test, build, integration, audit                     |
| **Staging**             | Auto after CI success on `main` | Build & push GHCR `:staging` + `:sha-…` (no SSH)                     |
| **Deploy — Staging**    | Manual only                     | SSH → pull image → `docker compose up` (Prisma migrate in container) |
| **Deploy — Production** | Manual only                     | Same, production secrets + compose                                   |
| **Release**             | Tag `v*.*.*`                    | GHCR semver tag + GitHub Release                                     |
| **Rollback**            | Manual                          | Redeploy previous image tag                                          |

Concurrency: only the latest commit builds staging (`cancel-in-progress` + HEAD guard).

## Deploy manually (when infra is ready)

1. Actions → **Deploy — Staging** → Run workflow (default tag: `staging`)
2. Health: `GET /api/v1/health` inside container on port 4000
3. Public (after nginx): `https://staging.api.airbar.app/api/v1/health`

See [staging-nginx-snippet.conf](./staging-nginx-snippet.conf) for CTO nginx/DNS request.
