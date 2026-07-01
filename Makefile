# airbar-core Makefile — mirrors airbar-finance ergonomics where possible.
.PHONY: help install up up-dev up-staging up-prod down migrate-up migrate-status migrate-down verify lint format typecheck test test-integration test-cov proto build clean

DB_URL ?= postgresql://airbar:airbar_secret@localhost:5435/airbar_api?schema=public

COMPOSE := docker compose -f docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f docker-compose.dev.yml
COMPOSE_RESOURCES := $(COMPOSE) -f docker-compose.resources.yml
COMPOSE_STAGING := $(COMPOSE) -f docker-compose.staging.yml
COMPOSE_PROD := $(COMPOSE) -f docker-compose.prod.yml

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-22s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

up: ## Start postgres + redis (resources only)
	$(COMPOSE_RESOURCES) up -d

up-dev: ## Start full dev stack (build app image)
	$(COMPOSE_DEV) up -d --build

up-staging: ## Deploy staging stack (requires IMAGE_TAG)
	@test -n "$(IMAGE_TAG)" || (echo "IMAGE_TAG is required" && exit 1)
	docker network create airbar-staging 2>/dev/null || true
	COMPOSE_PROJECT_NAME=airbar-core-staging IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE_STAGING) up -d --remove-orphans

up-prod: ## Deploy production stack (requires IMAGE_TAG)
	@test -n "$(IMAGE_TAG)" || (echo "IMAGE_TAG is required" && exit 1)
	docker network create airbar-prod 2>/dev/null || true
	COMPOSE_PROJECT_NAME=airbar-core-prod IMAGE_TAG=$(IMAGE_TAG) $(COMPOSE_PROD) up -d --remove-orphans

down: ## Stop postgres + redis
	$(COMPOSE_RESOURCES) down

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

proto: ## Regenerate finance gRPC client stubs (ts-proto)
	npm run proto:generate

build: ## Build the app
	npm run build

verify: lint typecheck test build ## Run all local quality gates (does not include integration)

rulesets-apply: ## Apply GitHub branch rulesets from .github/rulesets/
	chmod +x scripts/apply-github-rulesets.sh
	./scripts/apply-github-rulesets.sh

clean: ## Remove build artifacts
	rm -rf dist coverage
