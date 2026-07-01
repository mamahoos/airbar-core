# airbar-core Makefile — mirrors airbar-finance ergonomics where possible.
.PHONY: help install up down migrate-up migrate-status migrate-down verify lint format typecheck test test-integration test-cov proto build clean

DB_URL ?= postgresql://airbar:airbar_secret@localhost:5435/airbar_api?schema=public

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-22s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

up: ## Start postgres + redis (resources only)
	docker compose -f docker-compose.resources.yml up -d

down: ## Stop postgres + redis
	docker compose -f docker-compose.resources.yml down

migrate-up: ## Apply migrations (DATABASE_URL must be set)
	npx prisma migrate deploy

migrate-status: ## Show migration status
	npx prisma migrate status

migrate-down: ## Rollback one migration (dev only)
	npx prisma migrate resolve --rolled-back

migrate-dev: ## Create a new migration from schema changes (dev only)
	npx prisma migrate dev --create-only

lint: ## Run ESLint
	npm run lint

format: ## Format with Prettier
	npm run format

typecheck: ## Type-check with tsc --noEmit
	npm run typecheck

test: ## Run unit tests
	npm test

test-integration: ## Run integration tests (requires Postgres + migrations)
	DATABASE_URL="$(DB_URL)" npm run test:integration

test-cov: ## Run tests with coverage
	npm run test:cov

proto: ## Regenerate finance gRPC client stubs (ts-proto). Requires buf + protoc-gen-ts.
	@echo "Proto codegen is wired in N1 — see docs/tasks/00-plan.md"

build: ## Build the app
	npm run build

verify: lint typecheck test build ## Run all local quality gates (does not include integration)

clean: ## Remove build artifacts
	rm -rf dist coverage
