# ZakOps Monorepo Makefile
.PHONY: help install test lint gates clean dev check-uv doctor
.PHONY: phase0 phase1 phase2 phase3 phase4 phase5 security perf
.PHONY: slo-validate risk-validate golden-traces owasp-tests trust-ux-check
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
# Prerequisites Check
# =============================================================================

check-uv: ## Check if uv is available
	@command -v uv >/dev/null 2>&1 || { \
		echo ""; \
		echo "$(YELLOW)❌ ERROR: 'uv' is not installed$(RESET)"; \
		echo ""; \
		echo "Install it with:"; \
		echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"; \
		echo "  source ~/.bashrc  # or restart terminal"; \
		echo ""; \
		exit 1; \
	}

doctor: ## Health check for all development tools
	@echo "$(CYAN)🔍 Checking development environment...$(RESET)"
	@echo ""
	@printf "uv:     " && (command -v uv >/dev/null 2>&1 && uv --version || echo "$(YELLOW)❌ NOT FOUND$(RESET) - run: curl -LsSf https://astral.sh/uv/install.sh | sh")
	@printf "docker: " && (command -v docker >/dev/null 2>&1 && docker --version | head -1 || echo "$(YELLOW)❌ NOT FOUND$(RESET)")
	@printf "node:   " && (command -v node >/dev/null 2>&1 && echo "v$$(node --version | tr -d 'v')" || echo "$(YELLOW)❌ NOT FOUND$(RESET)")
	@printf "npm:    " && (command -v npm >/dev/null 2>&1 && npm --version || echo "$(YELLOW)❌ NOT FOUND$(RESET)")
	@printf "python: " && (command -v python3 >/dev/null 2>&1 && python3 --version || echo "$(YELLOW)❌ NOT FOUND$(RESET)")
	@echo ""

# =============================================================================
# Installation
# =============================================================================

install: install-agent-api install-backend install-dashboard ## Install all dependencies

install-agent-api: check-uv ## Install agent-api dependencies (uv)
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

test-agent-api: check-uv ## Run agent-api tests
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

lint-agent-api: check-uv ## Lint agent-api
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
# Production Readiness Phases
# =============================================================================

phase0: slo-validate risk-validate ## Phase 0: SLOs + Risk Model
	@echo "$(GREEN)Phase 0 complete$(RESET)"

phase1: golden-traces owasp-tests ## Phase 1: Agent Intelligence Validation
	@echo "$(GREEN)Phase 1 complete$(RESET)"

phase2: trust-ux-check ## Phase 2: Trust UX + Audit
	@echo "$(GREEN)Phase 2 complete$(RESET)"

slo-validate: ## Validate SLO configuration
	@python3 tools/quality/slo_validate.py

risk-validate: ## Validate risk register
	@python3 tools/quality/risk_validate.py

golden-traces: ## Run golden trace evaluation
	@CI=true python3 apps/agent-api/evals/golden_trace_runner.py

owasp-tests: ## Run OWASP LLM security tests
	@bash tools/gates/owasp_llm_gate.sh

trust-ux-check: ## Check Trust UX components
	@bash tools/gates/phase2_trust_ux_gate.sh

phase3: ## Phase 3: Security Hardening
	@echo "$(CYAN)=== Phase 3: Security Hardening ===$(RESET)"
	@bash tools/gates/phase3_security_gate.sh

phase4: ## Phase 4: External Access + Policy Enforcement
	@echo "$(CYAN)=== Phase 4: External Access ===$(RESET)"
	@bash tools/gates/phase4_external_access_gate.sh

phase5: ## Phase 5: Performance (SLO-bound)
	@echo "$(CYAN)=== Phase 5: Performance ===$(RESET)"
	@bash tools/gates/phase5_performance_gate.sh

security: phase3 ## Alias for Phase 3 security gate
	@echo "$(GREEN)Security checks complete$(RESET)"

perf: phase5 ## Alias for Phase 5 performance gate
	@echo "$(GREEN)Performance checks complete$(RESET)"

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
