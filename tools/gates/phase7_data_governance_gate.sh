#!/bin/bash
# Phase 7: Data Governance Gate
# Validates all data governance requirements are met

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Phase 7: Data Governance Gate ==="
echo "Root: $ROOT_DIR"
echo ""

ERRORS=0

check_file() {
    local path="$1"
    local desc="$2"
    if [ -f "$ROOT_DIR/$path" ]; then
        echo "✓ $desc"
    else
        echo "✗ $desc - NOT FOUND: $path"
        ERRORS=$((ERRORS + 1))
    fi
}

check_yaml() {
    local path="$1"
    local desc="$2"
    if [ -f "$ROOT_DIR/$path" ]; then
        if python3 -c "import yaml; yaml.safe_load(open('$ROOT_DIR/$path'))" 2>/dev/null; then
            echo "✓ $desc (valid YAML)"
        else
            echo "✗ $desc - INVALID YAML"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "✗ $desc - NOT FOUND: $path"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "--- Data Governance Documentation ---"
check_file "docs/data/DATA_GOVERNANCE_OVERVIEW.md" "Data governance overview"
check_file "docs/data/DATA_CLASSIFICATION.md" "Data classification guide"
check_yaml "docs/data/RETENTION_POLICY.yaml" "Retention policy"
check_file "docs/data/DELETION_POLICY.md" "Deletion policy"
check_file "docs/data/BACKUP_RESTORE_POLICY.md" "Backup/restore policy"
check_file "docs/data/TENANT_ISOLATION.md" "Tenant isolation docs"

echo ""
echo "--- Data Policy Validation ---"
check_file "tools/quality/data_policy_validate.py" "Data policy validator"

# Run policy validation
echo "Running data policy validation..."
if python3 "$ROOT_DIR/tools/quality/data_policy_validate.py"; then
    echo "✓ Data policy validation successful"
else
    echo "✗ Data policy validation failed"
    ERRORS=$((ERRORS + 1))
fi

# Check validation artifact
if [ -f "$ROOT_DIR/artifacts/data/data_policy_validation.json" ]; then
    if python3 -c "import json; d=json.load(open('$ROOT_DIR/artifacts/data/data_policy_validation.json')); exit(0 if d.get('passed') else 1)"; then
        echo "✓ Data policy validation artifact shows passed=true"
    else
        echo "✗ Data policy validation artifact shows passed=false"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""
echo "--- PII Redaction ---"
check_file "packages/security/pii_redaction.py" "PII redaction module"

# Verify PII module has required functions
if [ -f "$ROOT_DIR/packages/security/pii_redaction.py" ]; then
    for fn in redact_text redact_dict detect_pii has_pii redact_sensitive_fields; do
        if grep -q "def $fn" "$ROOT_DIR/packages/security/pii_redaction.py"; then
            echo "  ✓ $fn function found"
        else
            echo "  ✗ $fn function missing"
            ERRORS=$((ERRORS + 1))
        fi
    done
    if grep -q "PII_PATTERNS" "$ROOT_DIR/packages/security/pii_redaction.py"; then
        echo "  ✓ PII_PATTERNS dict found"
    else
        echo "  ✗ PII_PATTERNS dict missing"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""
echo "--- Security Tests ---"
check_file "apps/agent-api/tests/security/test_pii_redaction.py" "PII redaction tests"
check_file "apps/backend/tests/security/test_tenant_isolation.py" "Tenant isolation tests"

# Run PII tests if pytest available
echo "Running PII redaction tests..."
if command -v pytest &> /dev/null; then
    if pytest "$ROOT_DIR/apps/agent-api/tests/security/test_pii_redaction.py" -v --tb=short 2>/dev/null; then
        echo "✓ PII redaction tests passed"
    else
        echo "✗ PII redaction tests failed"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠ pytest not available, skipping test execution"
fi

# Run tenant isolation tests
echo "Running tenant isolation tests..."
if command -v pytest &> /dev/null; then
    if pytest "$ROOT_DIR/apps/backend/tests/security/test_tenant_isolation.py" -v --tb=short 2>/dev/null; then
        echo "✓ Tenant isolation tests passed"
    else
        echo "✗ Tenant isolation tests failed"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠ pytest not available, skipping test execution"
fi

echo ""
echo "=== Phase 7 Gate Summary ==="
if [ $ERRORS -eq 0 ]; then
    echo "✓ All checks passed"
    exit 0
else
    echo "✗ $ERRORS check(s) failed"
    exit 1
fi
