# ZakOps Monorepo Makefile
.PHONY: help install test lint gates clean dev
.DEFAULT_GOAL := help

# Colors
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

help: ## Show this help
	@echo "$(CYAN)ZakOps Monorepo$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'

# =============================================================================
# Installation
# =============================================================================

install: install-agent-api install-backend install-dashboard ## Install all dependencies

install-agent-api: ## Install agent-api dependencies (uv)
	@echo "$(CYAN)[agent-api]$(RESET) Installing..."
	cd apps/agent-api && uv sync

install-backend: ## Install backend dependencies (pip)
	@echo "$(CYAN)[backend]$(RESET) Installing..."
	cd apps/backend && pip install -r requirements.txt

install-dashboard: ## Install dashboard dependencies (npm)
	@echo "$(CYAN)[dashboard]$(RESET) Installing..."
	cd apps/dashboard && npm install

# =============================================================================
# Testing
# =============================================================================

test: test-agent-api test-backend test-dashboard ## Run all tests

test-agent-api: ## Run agent-api tests
	@echo "$(CYAN)[agent-api]$(RESET) Testing..."
	cd apps/agent-api && uv run pytest evals/ -v

test-backend: ## Run backend tests
	@echo "$(CYAN)[backend]$(RESET) Testing..."
	cd apps/backend && pytest tests/ -v

test-dashboard: ## Run dashboard tests
	@echo "$(CYAN)[dashboard]$(RESET) Testing..."
	cd apps/dashboard && npm test

# =============================================================================
# Linting
# =============================================================================

lint: lint-agent-api lint-backend lint-dashboard ## Lint all code

lint-agent-api: ## Lint agent-api
	@echo "$(CYAN)[agent-api]$(RESET) Linting..."
	cd apps/agent-api && uv run ruff check app/

lint-backend: ## Lint backend
	@echo "$(CYAN)[backend]$(RESET) Linting..."
	cd apps/backend && ruff check src/

lint-dashboard: ## Lint dashboard
	@echo "$(CYAN)[dashboard]$(RESET) Linting..."
	cd apps/dashboard && npm run lint

# =============================================================================
# Gates (CI)
# =============================================================================

gates: ## Run all gate checks
	./tools/gates/run_all_gates.sh

gates-agent-api: ## Run agent-api gates only
	cd apps/agent-api && ../../tools/gates/bring_up_tests.sh

# =============================================================================
# Development
# =============================================================================

dev: ## Start all services for development
	@echo "$(YELLOW)Starting services...$(RESET)"
	@echo "Agent API: http://localhost:8095"
	@echo "Backend (Deal Lifecycle): http://localhost:8090"
	@echo "Dashboard: http://localhost:3003"

dev-agent-api: ## Start agent-api dev server
	cd apps/agent-api && uv run uvicorn app.main:app --reload --port 8095

dev-backend: ## Start backend dev server
	cd apps/backend && python -m uvicorn src.api.deal_lifecycle.main:app --reload --port 8090

dev-dashboard: ## Start dashboard dev server
	cd apps/dashboard && npm run dev

# =============================================================================
# Docker
# =============================================================================

docker-build: ## Build all Docker images
	docker compose -f deployments/docker/docker-compose.yml build

docker-up: ## Start all services via Docker
	docker compose -f deployments/docker/docker-compose.yml up -d

docker-down: ## Stop all Docker services
	docker compose -f deployments/docker/docker-compose.yml down

docker-logs: ## Tail Docker logs
	docker compose -f deployments/docker/docker-compose.yml logs -f

# =============================================================================
# Utilities
# =============================================================================

clean: ## Clean build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	rm -rf artifacts/gate_artifacts/* artifacts/logs/* 2>/dev/null || true

db-migrate: ## Run database migrations
	cd apps/agent-api && uv run alembic upgrade head

db-reset: ## Reset database
	cd apps/agent-api && uv run alembic downgrade base && uv run alembic upgrade head
