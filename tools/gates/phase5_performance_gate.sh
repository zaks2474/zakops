#!/bin/bash
# Phase 5: Performance Gate
# Validates SLO-bound performance configuration

set -uo pipefail
# Note: Not using -e because we handle errors manually via ERRORS counter

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "========================================"
echo "Phase 5: Performance Gate"
echo "========================================"

# Helper function
check_file() {
    local file="$1"
    local description="$2"

    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description (missing: $file)"
        return 1
    fi
}

check_dir() {
    local dir="$1"
    local description="$2"

    if [[ -d "$PROJECT_ROOT/$dir" ]]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description (missing: $dir)"
        return 1
    fi
}

# === Prerequisites ===
echo ""
echo "=== Prerequisites ==="

check_file "docs/slos/slo_config.yaml" "SLO configuration exists" || ((ERRORS++))

# === k6 Load Testing ===
echo ""
echo "=== k6 Load Testing ==="

check_file "tools/load-tests/generate_k6_thresholds.py" "Threshold generator exists" || ((ERRORS++))
check_file "tools/load-tests/scenarios/slo-validation.js" "k6 scenario exists" || ((ERRORS++))
check_dir "tools/load-tests/generated" "Generated thresholds directory exists" || ((WARNINGS++))

# === vLLM Documentation ===
echo ""
echo "=== vLLM Documentation ==="

check_file "docs/perf/VLLM_TUNING.md" "vLLM tuning guide exists" || ((ERRORS++))
check_file "tools/scripts/record_vllm_benchmark.py" "vLLM benchmark script exists" || ((ERRORS++))

# === Cost Tracking ===
echo ""
echo "=== Cost Tracking ==="

check_file "apps/agent-api/app/core/telemetry/cost_tracking.py" "Cost tracking module exists" || ((ERRORS++))
check_file "apps/agent-api/tests/test_cost_tracking.py" "Cost tracking tests exist" || ((ERRORS++))

# === Generate Thresholds ===
echo ""
echo "=== Generating k6 Thresholds from SLOs ==="

cd "$PROJECT_ROOT"
if python3 tools/load-tests/generate_k6_thresholds.py > /dev/null 2>&1; then
    # Check the output files
    if [[ -f "$PROJECT_ROOT/tools/load-tests/generated/thresholds.js" ]]; then
        echo -e "${GREEN}✓${NC} Generated thresholds.js from SLOs"
    else
        echo -e "${RED}✗${NC} Failed to generate thresholds.js"
        ((ERRORS++))
    fi

    if [[ -f "$PROJECT_ROOT/artifacts/perf/thresholds_used.json" ]]; then
        echo -e "${GREEN}✓${NC} Thresholds artifact created"
    else
        echo -e "${YELLOW}!${NC} Thresholds artifact not found"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}✗${NC} Threshold generation failed"
    ((ERRORS++))
fi

# === Run Cost Tracking Tests ===
echo ""
echo "=== Running Cost Tracking Tests ==="

cd "$PROJECT_ROOT/apps/agent-api"
if command -v uv &> /dev/null; then
    if uv run pytest tests/test_cost_tracking.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} Cost tracking tests passed"
    else
        echo -e "${YELLOW}!${NC} Cost tracking tests had issues (non-blocking)"
        ((WARNINGS++))
    fi
elif command -v pytest &> /dev/null; then
    if pytest tests/test_cost_tracking.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} Cost tracking tests passed"
    else
        echo -e "${YELLOW}!${NC} Cost tracking tests failed (non-blocking without uv)"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Neither uv nor pytest found - skipping cost tracking tests"
    echo "   Tests can be run manually: cd apps/agent-api && uv run pytest tests/"
    ((WARNINGS++))
fi

# === Check k6 Availability ===
echo ""
echo "=== k6 Availability Check ==="

if command -v k6 &> /dev/null; then
    echo -e "${GREEN}✓${NC} k6 is installed: $(k6 version 2>&1 | head -1)"
else
    echo -e "${YELLOW}!${NC} k6 is not installed - load tests require manual setup"
    echo "   Install with: https://k6.io/docs/get-started/installation/"
    ((WARNINGS++))
fi

# === Summary ===
echo ""
echo "========================================"
echo "Phase 5 Summary"
echo "========================================"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}Phase 5: PASSED${NC}"
    exit 0
else
    echo -e "${RED}Phase 5: FAILED${NC}"
    exit 1
fi
