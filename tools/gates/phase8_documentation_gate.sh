#!/bin/bash
# Phase 8: Documentation Gate
# Validates all documentation requirements are met

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Phase 8: Documentation Gate ==="
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

check_executable() {
    local path="$1"
    local desc="$2"
    if [ -x "$ROOT_DIR/$path" ] || [ -f "$ROOT_DIR/$path" ]; then
        echo "✓ $desc"
    else
        echo "✗ $desc - NOT FOUND: $path"
        ERRORS=$((ERRORS + 1))
    fi
}

check_section() {
    local path="$1"
    local section="$2"
    if [ -f "$ROOT_DIR/$path" ]; then
        if grep -qi "## $section\|### $section" "$ROOT_DIR/$path"; then
            echo "  ✓ Section '$section' found"
        else
            echo "  ✗ Section '$section' missing"
            ERRORS=$((ERRORS + 1))
        fi
    fi
}

echo "--- Documentation Checklist ---"
check_file "docs/docs_checklist.yaml" "Documentation checklist"

echo ""
echo "--- User Documentation ---"
check_file "docs/user/GETTING_STARTED.md" "Getting Started guide"
if [ -f "$ROOT_DIR/docs/user/GETTING_STARTED.md" ]; then
    check_section "docs/user/GETTING_STARTED.md" "Prerequisites"
    check_section "docs/user/GETTING_STARTED.md" "Installation"
    check_section "docs/user/GETTING_STARTED.md" "First Steps"
fi

check_file "docs/user/WORKFLOWS.md" "Workflows guide"
if [ -f "$ROOT_DIR/docs/user/WORKFLOWS.md" ]; then
    check_section "docs/user/WORKFLOWS.md" "Deal Lifecycle"
    check_section "docs/user/WORKFLOWS.md" "Approvals"
fi

check_file "docs/user/APPROVALS.md" "Approvals guide"
check_file "docs/user/AUDIT_LOGS.md" "Audit logs guide"

echo ""
echo "--- API Documentation ---"
check_file "docs/api/OVERVIEW.md" "API overview"
if [ -f "$ROOT_DIR/docs/api/OVERVIEW.md" ]; then
    check_section "docs/api/OVERVIEW.md" "Introduction"
    check_section "docs/api/OVERVIEW.md" "Authentication"
fi

check_file "docs/api/AUTH.md" "Authentication guide"
check_file "docs/api/ENDPOINTS.md" "Endpoints reference"

echo ""
echo "--- Troubleshooting ---"
check_file "docs/troubleshooting/TROUBLESHOOTING.md" "Troubleshooting guide"
if [ -f "$ROOT_DIR/docs/troubleshooting/TROUBLESHOOTING.md" ]; then
    check_section "docs/troubleshooting/TROUBLESHOOTING.md" "Common Issues"
    check_section "docs/troubleshooting/TROUBLESHOOTING.md" "Getting Help"
fi

check_file "docs/troubleshooting/RUNBOOKS.md" "Operational runbooks"
if [ -f "$ROOT_DIR/docs/troubleshooting/RUNBOOKS.md" ]; then
    check_section "docs/troubleshooting/RUNBOOKS.md" "Service Restart"
    check_section "docs/troubleshooting/RUNBOOKS.md" "Health Checks"
fi

echo ""
echo "--- Training ---"
check_file "docs/training/ROLE_GUIDES.md" "Role guides"
if [ -f "$ROOT_DIR/docs/training/ROLE_GUIDES.md" ]; then
    check_section "docs/training/ROLE_GUIDES.md" "Operator"
    check_section "docs/training/ROLE_GUIDES.md" "Admin"
fi

check_file "docs/training/FAQ.md" "FAQ"

echo ""
echo "--- Demos ---"
check_file "docs/demos/DEMO_SCRIPT.md" "Demo script documentation"
if [ -f "$ROOT_DIR/docs/demos/DEMO_SCRIPT.md" ]; then
    check_section "docs/demos/DEMO_SCRIPT.md" "Setup"
    check_section "docs/demos/DEMO_SCRIPT.md" "Script"
    check_section "docs/demos/DEMO_SCRIPT.md" "Cleanup"
fi

echo ""
echo "--- Validation Tools ---"
check_file "tools/quality/docs_validate.py" "Documentation validator"
check_executable "tools/demos/run_demo.sh" "Demo runner script"

# Run documentation validation
echo ""
echo "Running documentation validation..."
if python3 "$ROOT_DIR/tools/quality/docs_validate.py"; then
    echo "✓ Documentation validation successful"
else
    echo "✗ Documentation validation failed"
    ERRORS=$((ERRORS + 1))
fi

# Check validation artifact
if [ -f "$ROOT_DIR/artifacts/docs/docs_validation.json" ]; then
    if python3 -c "import json; d=json.load(open('$ROOT_DIR/artifacts/docs/docs_validation.json')); exit(0 if d.get('passed') else 1)"; then
        echo "✓ Docs validation artifact shows passed=true"
    else
        echo "✗ Docs validation artifact shows passed=false"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Run demo in mock mode
echo ""
echo "Running demo validation (mock mode)..."
if MOCK_MODE=true bash "$ROOT_DIR/tools/demos/run_demo.sh" run; then
    echo "✓ Demo validation successful"
else
    echo "✗ Demo validation failed"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=== Phase 8 Gate Summary ==="
if [ $ERRORS -eq 0 ]; then
    echo "✓ All checks passed"
    exit 0
else
    echo "✗ $ERRORS check(s) failed"
    exit 1
fi
