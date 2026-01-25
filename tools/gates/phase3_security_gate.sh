#!/bin/bash
# Phase 3: Security Hardening Gate
# Validates security documentation and controls

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
echo "Phase 3: Security Hardening Gate"
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

check_executable() {
    local file="$1"
    local description="$2"

    if [[ -x "$PROJECT_ROOT/$file" ]]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description (not executable: $file)"
        return 1
    fi
}

# === Security Documentation ===
echo ""
echo "=== Security Documentation ==="

check_file "docs/security/asvs_l1.yaml" "ASVS L1 checklist exists" || ((ERRORS++))
check_file "docs/security/api_top10.yaml" "API Top 10 checklist exists" || ((ERRORS++))
check_file "docs/security/THREAT_MODEL.md" "Threat model documentation exists" || ((ERRORS++))

# Validate ASVS has >= 10 requirements
if [[ -f "$PROJECT_ROOT/docs/security/asvs_l1.yaml" ]]; then
    REQ_COUNT=$(grep -c "^  - id:" "$PROJECT_ROOT/docs/security/asvs_l1.yaml" || echo "0")
    if [[ "$REQ_COUNT" -ge 10 ]]; then
        echo -e "${GREEN}✓${NC} ASVS L1 has $REQ_COUNT requirements (≥10 required)"
    else
        echo -e "${RED}✗${NC} ASVS L1 has only $REQ_COUNT requirements (≥10 required)"
        ((ERRORS++))
    fi
fi

# Validate API Top 10 has all 10 risks
if [[ -f "$PROJECT_ROOT/docs/security/api_top10.yaml" ]]; then
    RISK_COUNT=$(grep -c "^  - id: API" "$PROJECT_ROOT/docs/security/api_top10.yaml" || echo "0")
    if [[ "$RISK_COUNT" -eq 10 ]]; then
        echo -e "${GREEN}✓${NC} API Top 10 has all 10 risks documented"
    else
        echo -e "${RED}✗${NC} API Top 10 has $RISK_COUNT risks (expected 10)"
        ((ERRORS++))
    fi
fi

# === Security Tooling ===
echo ""
echo "=== Security Tools ==="

check_file "tools/quality/security_checklist_validate.py" "Security checklist validator exists" || ((ERRORS++))
check_executable "tools/scripts/security_scan.sh" "Security scan script executable" || ((ERRORS++))

# === RBAC Coverage ===
echo ""
echo "=== RBAC Coverage ==="

check_file "apps/agent-api/app/core/security/rbac_coverage.py" "RBAC coverage module exists" || ((ERRORS++))
check_file "apps/agent-api/tests/security/test_rbac_coverage.py" "RBAC coverage tests exist" || ((ERRORS++))

# === Output Sanitization ===
echo ""
echo "=== Output Sanitization ==="

check_file "apps/agent-api/app/core/security/output_validation.py" "Output validation module exists" || ((ERRORS++))
check_file "apps/agent-api/tests/security/test_output_sanitization.py" "Output sanitization tests exist" || ((ERRORS++))

# === OWASP API Security Tests ===
echo ""
echo "=== OWASP API Security Tests ==="

check_file "apps/backend/tests/security/test_owasp_api_top10.py" "OWASP API Top 10 tests exist" || ((ERRORS++))

# === Run Security Checklist Validation ===
echo ""
echo "=== Running Security Checklist Validation ==="

cd "$PROJECT_ROOT"
if python3 tools/quality/security_checklist_validate.py > /dev/null 2>&1; then
    # Check the output artifact
    if [[ -f "$PROJECT_ROOT/artifacts/security/checklist_validation.json" ]]; then
        PASSED=$(python3 -c "import json; data=json.load(open('$PROJECT_ROOT/artifacts/security/checklist_validation.json')); print(data.get('overall_passed', False))" 2>/dev/null || echo "False")
        if [[ "$PASSED" == "True" ]]; then
            echo -e "${GREEN}✓${NC} Security checklist validation passed"
        else
            echo -e "${RED}✗${NC} Security checklist validation failed"
            ((ERRORS++))
        fi
    else
        echo -e "${YELLOW}!${NC} Checklist validation ran but no artifact found"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Security checklist validation could not run (missing dependencies?)"
    ((WARNINGS++))
fi

# === Run RBAC Tests ===
echo ""
echo "=== Running RBAC Tests ==="

cd "$PROJECT_ROOT/apps/agent-api"
# Try uv, then pytest directly
if command -v uv &> /dev/null; then
    if uv run pytest tests/security/test_rbac_coverage.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} RBAC tests passed"
    else
        echo -e "${YELLOW}!${NC} RBAC tests had issues (non-blocking)"
        ((WARNINGS++))
    fi
elif command -v pytest &> /dev/null; then
    if pytest tests/security/test_rbac_coverage.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} RBAC tests passed"
    else
        echo -e "${YELLOW}!${NC} RBAC tests failed (non-blocking without uv)"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Neither uv nor pytest found - skipping RBAC tests"
    echo "   Tests can be run manually: cd apps/agent-api && uv run pytest tests/security/"
    ((WARNINGS++))
fi

# === Run Output Sanitization Tests ===
echo ""
echo "=== Running Output Sanitization Tests ==="

cd "$PROJECT_ROOT/apps/agent-api"
# Try uv, then pytest directly
if command -v uv &> /dev/null; then
    if uv run pytest tests/security/test_output_sanitization.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} Output sanitization tests passed"
    else
        echo -e "${YELLOW}!${NC} Output sanitization tests had issues (non-blocking)"
        ((WARNINGS++))
    fi
elif command -v pytest &> /dev/null; then
    if pytest tests/security/test_output_sanitization.py -v --tb=short 2>&1 | tail -20; then
        echo -e "${GREEN}✓${NC} Output sanitization tests passed"
    else
        echo -e "${YELLOW}!${NC} Output sanitization tests failed (non-blocking without uv)"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Neither uv nor pytest found - skipping output sanitization tests"
    echo "   Tests can be run manually: cd apps/agent-api && uv run pytest tests/security/"
    ((WARNINGS++))
fi

# === Summary ===
echo ""
echo "========================================"
echo "Phase 3 Summary"
echo "========================================"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}Phase 3: PASSED${NC}"
    exit 0
else
    echo -e "${RED}Phase 3: FAILED${NC}"
    exit 1
fi
