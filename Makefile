# ZakOps Dashboard Makefile
# Standard targets for development and testing
#
# QUICK START:
#   1. make preflight   - Start backend API + verify vLLM + run smoke tests
#   2. make dev         - Start frontend dev server (in separate terminal)
#   3. Visit http://localhost:3003
#
# ARCHITECTURE:
#   Frontend (Next.js):  localhost:3003 (this project)
#   Backend API:         localhost:8090 (/home/zaks/scripts/deal_lifecycle_api.py)
#   vLLM (Qwen):         localhost:8000 (docker: vllm-qwen)

.PHONY: install dev build start test smoke lint clean help preflight backend-start backend-stop llm-health perf provider-health budget-status

# Default target
help:
	@echo "ZakOps Dashboard - Available commands:"
	@echo ""
	@echo "  QUICK START:"
	@echo "    make preflight  - Start backend + verify LLM + run smoke tests"
	@echo "    make dev        - Start development server (port 3003)"
	@echo ""
	@echo "  DEVELOPMENT:"
	@echo "    make install    - Install dependencies"
	@echo "    make build      - Build for production"
	@echo "    make start      - Start production server"
	@echo "    make test       - Run smoke tests (requires dev server)"
	@echo "    make lint       - Run linter"
	@echo ""
	@echo "  BACKEND:"
	@echo "    make backend-start - Start backend API (port 8090)"
	@echo "    make backend-stop  - Stop backend API"
	@echo "    make llm-health    - Check LLM provider status"
	@echo ""
	@echo "  PERFORMANCE (v1):"
	@echo "    make perf           - Run performance benchmark"
	@echo "    make benchmark-quick- Quick sanity check (5 prompts)"
	@echo "    make provider-health- Detailed provider status"
	@echo "    make budget-status  - Gemini budget/rate limit status"
	@echo "    make cache-status   - Evidence cache stats"
	@echo ""
	@echo "    make clean      - Clean build artifacts"

# Install dependencies
install:
	npm install

# Start development server on port 3003 (3001 reserved for Docker)
dev:
	npx next dev --port 3003

# Build for production
build:
	npm run build

# Start production server
start:
	npm run start

# Run smoke tests (server must be running)
test: smoke

smoke:
	@echo "Running smoke tests..."
	@if curl -s -o /dev/null -w "%{http_code}" http://localhost:3003 | grep -q "200\|307"; then \
		./smoke-test.sh; \
	else \
		echo "ERROR: Dev server not running. Start with 'make dev' first."; \
		exit 1; \
	fi

# Run linter
lint:
	npm run lint

# Clean build artifacts
clean:
	rm -rf .next
	rm -rf node_modules/.cache

# Quick health check (non-blocking)
health:
	@curl -s -o /dev/null -w "Dashboard: HTTP %{http_code}\n" http://localhost:3003/dashboard || echo "Dashboard: Not running"
	@curl -s -o /dev/null -w "API proxy: HTTP %{http_code}\n" http://localhost:3003/api/deals || echo "API: Not running"

# Backend API management
backend-start:
	@echo "Starting backend API on port 8090..."
	@if curl -s http://localhost:8090/health > /dev/null 2>&1; then \
		echo "✓ Backend API already running"; \
	else \
		cd /home/zaks/scripts && nohup python3 deal_lifecycle_api.py > /tmp/deal_api.log 2>&1 & \
		sleep 3; \
		curl -s http://localhost:8090/health > /dev/null && echo "✓ Backend API started" || echo "✗ Backend failed to start (check /tmp/deal_api.log)"; \
	fi

backend-stop:
	@pkill -f "python3.*deal_lifecycle_api" 2>/dev/null && echo "Backend stopped" || echo "Backend not running"

llm-health:
	@echo "Checking LLM health..."
	@curl -s http://localhost:8090/api/chat/llm-health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d[\"status\"]}\nHealthy providers: {d.get(\"healthy_providers\", [])}')" || echo "Backend not running - start with: make backend-start"

# Performance benchmark
perf: benchmark
benchmark:
	@echo "Running performance benchmark..."
	@cd /home/zaks/scripts && python3 chat_benchmark.py run

benchmark-quick:
	@echo "Running quick benchmark..."
	@cd /home/zaks/scripts && python3 chat_benchmark.py quick

benchmark-report:
	@cd /home/zaks/scripts && python3 chat_benchmark.py report

# Provider health (detailed)
provider-health:
	@echo "Provider Health Status:"
	@curl -s http://localhost:8090/api/chat/llm-health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); \
		print(f\"Overall: {d['status']}\"); \
		print(''); \
		print('Providers:'); \
		[print(f\"  {k}: {v['status']} ({v.get('model','unknown')})\") for k,v in d.get('providers',{}).items()]; \
		print(''); \
		print(f\"Healthy: {d.get('healthy_providers', [])}\")" || echo "Backend not running"

# Budget status
budget-status:
	@echo "Gemini Budget Status:"
	@curl -s http://localhost:8090/api/chat/llm-health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); \
		b=d.get('budget',{}); \
		print(f\"Date: {b.get('date','unknown')}\"); \
		print(f\"Spent: \$${b.get('spent_usd',0):.4f}\"); \
		print(f\"Budget: \$${b.get('budget_usd',0):.2f}\"); \
		print(f\"Remaining: \$${b.get('remaining_usd',0):.4f}\"); \
		print(f\"Requests today: {b.get('request_count',0)}\"); \
		print(f\"RPM current: {b.get('rpm_current',0)}/{b.get('rpm_limit',60)}\")" || echo "Backend not running"

# Cache status
cache-status:
	@echo "Evidence Cache Status:"
	@curl -s http://localhost:8090/api/chat/llm-health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); \
		c=d.get('cache',{}); \
		print(f\"Enabled: {c.get('enabled',False)}\"); \
		print(f\"Entries: {c.get('entries_count',0)}\"); \
		print(f\"Hits: {c.get('hits',0)}\"); \
		print(f\"Misses: {c.get('misses',0)}\"); \
		print(f\"Hit rate: {c.get('hit_rate',0)*100:.1f}%\")" || echo "Backend not running"

# Preflight: Start backend, verify LLM, run smoke tests
preflight: backend-start
	@echo ""
	@echo "Verifying LLM connection..."
	@$(MAKE) llm-health
	@echo ""
	@echo "Running smoke tests (if frontend running)..."
	@curl -s http://localhost:3003/health > /dev/null 2>&1 && ./smoke-test.sh || echo "Frontend not running - start with: make dev"
	@echo ""
	@echo "=== Preflight Complete ==="
	@echo "Backend API: http://localhost:8090"
	@echo "Frontend:    http://localhost:3003 (start with 'make dev' in another terminal)"
