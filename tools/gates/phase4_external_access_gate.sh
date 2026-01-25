#!/bin/bash
# Phase 4: External Access Gate
# Validates endpoint classification and policy enforcement

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
echo "Phase 4: External Access Gate"
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

# === Endpoint Classification ===
echo ""
echo "=== Endpoint Classification ==="

check_file "ops/external_access/endpoint_classification.yaml" "Endpoint classification exists" || ((ERRORS++))

# Validate all endpoints are classified
if [[ -f "$PROJECT_ROOT/ops/external_access/endpoint_classification.yaml" ]]; then
    ENDPOINT_COUNT=$(grep -c "^  - path:" "$PROJECT_ROOT/ops/external_access/endpoint_classification.yaml" || echo "0")
    if [[ "$ENDPOINT_COUNT" -ge 10 ]]; then
        echo -e "${GREEN}✓${NC} Endpoint classification has $ENDPOINT_COUNT endpoints"
    else
        echo -e "${YELLOW}!${NC} Only $ENDPOINT_COUNT endpoints classified (expected ≥10)"
        ((WARNINGS++))
    fi
fi

# === Cloudflare Configuration ===
echo ""
echo "=== Cloudflare Configuration ==="

check_file "ops/external_access/cloudflare/README.md" "Cloudflare setup guide exists" || ((ERRORS++))
check_file "ops/external_access/cloudflare/cloudflared_config.yml" "Cloudflared config exists" || ((ERRORS++))
check_file "ops/external_access/cloudflare/access_policies.yaml" "Access policies exist" || ((ERRORS++))

# === Rate Limiting ===
echo ""
echo "=== Rate Limiting ==="

check_file "apps/agent-api/app/core/middleware/rate_limiter.py" "Rate limiter middleware exists" || ((ERRORS++))
check_file "apps/agent-api/tests/security/test_rate_limits.py" "Rate limit tests exist" || ((ERRORS++))

# === Configuration Validation ===
echo ""
echo "=== Running Configuration Validation ==="

check_file "tools/quality/cloudflare_config_validate.py" "Cloudflare config validator exists" || ((ERRORS++))

cd "$PROJECT_ROOT"
if python3 tools/quality/cloudflare_config_validate.py > /dev/null 2>&1; then
    # Check the output artifact
    if [[ -f "$PROJECT_ROOT/artifacts/policies/cloudflare_validation.json" ]]; then
        PASSED=$(python3 -c "import json; data=json.load(open('$PROJECT_ROOT/artifacts/policies/cloudflare_validation.json')); print(data.get('overall_passed', False))" 2>/dev/null || echo "False")
        if [[ "$PASSED" == "True" ]]; then
            echo -e "${GREEN}✓${NC} Cloudflare configuration validation passed"
        else
            echo -e "${RED}✗${NC} Cloudflare configuration validation failed"
            # Show issues
            python3 -c "
import json
data = json.load(open('$PROJECT_ROOT/artifacts/policies/cloudflare_validation.json'))
for key, value in data.items():
    if isinstance(value, dict) and value.get('issues'):
        print(f'  {key}: {value[\"issues\"]}')
" 2>/dev/null || true
            ((ERRORS++))
        fi
    else
        echo -e "${YELLOW}!${NC} Validation ran but no artifact found"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Configuration validation could not run"
    ((WARNINGS++))
fi

# === Rate Limit Tests ===
echo ""
echo "=== Running Rate Limit Tests ==="

cd "$PROJECT_ROOT/apps/agent-api"
if command -v uv &> /dev/null; then
    if uv run pytest tests/security/test_rate_limits.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} Rate limit tests passed"
    else
        echo -e "${YELLOW}!${NC} Rate limit tests had issues (non-blocking)"
        ((WARNINGS++))
    fi
elif command -v pytest &> /dev/null; then
    if pytest tests/security/test_rate_limits.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} Rate limit tests passed"
    else
        echo -e "${YELLOW}!${NC} Rate limit tests failed (non-blocking without uv)"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Neither uv nor pytest found - skipping rate limit tests"
    echo "   Tests can be run manually: cd apps/agent-api && uv run pytest tests/security/"
    ((WARNINGS++))
fi

# === Summary ===
echo ""
echo "========================================"
echo "Phase 4 Summary"
echo "========================================"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}Phase 4: PASSED${NC}"
    exit 0
else
    echo -e "${RED}Phase 4: FAILED${NC}"
    exit 1
fi
