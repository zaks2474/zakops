#!/bin/bash
# Phase 6: Observability Gate
# Validates all observability requirements are met

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Phase 6: Observability Gate ==="
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

check_json() {
    local path="$1"
    local desc="$2"
    if [ -f "$ROOT_DIR/$path" ]; then
        if python3 -m json.tool "$ROOT_DIR/$path" > /dev/null 2>&1; then
            echo "✓ $desc (valid JSON)"
        else
            echo "✗ $desc - INVALID JSON"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "✗ $desc - NOT FOUND: $path"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "--- OTEL Conventions ---"
check_file "packages/observability/otel_conventions.py" "OTEL conventions module"
check_file "docs/observability/OTEL_CONVENTIONS.md" "OTEL conventions documentation"

# Verify OTEL module has required classes
if [ -f "$ROOT_DIR/packages/observability/otel_conventions.py" ]; then
    for cls in SpanNames HttpAttributes DbAttributes LlmAttributes AgentAttributes; do
        if grep -q "class $cls" "$ROOT_DIR/packages/observability/otel_conventions.py"; then
            echo "  ✓ $cls class found"
        else
            echo "  ✗ $cls class missing"
            ERRORS=$((ERRORS + 1))
        fi
    done
    for fn in build_http_attributes build_llm_attributes build_agent_attributes; do
        if grep -q "def $fn" "$ROOT_DIR/packages/observability/otel_conventions.py"; then
            echo "  ✓ $fn function found"
        else
            echo "  ✗ $fn function missing"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

echo ""
echo "--- SLO Alerts ---"
check_file "tools/quality/generate_slo_alerts.py" "SLO alert generator"
check_file "tools/quality/alert_rules_validate.py" "Alert rules validator"

# Generate alerts
echo "Generating SLO alerts..."
if python3 "$ROOT_DIR/tools/quality/generate_slo_alerts.py"; then
    echo "✓ Alert generation successful"
else
    echo "✗ Alert generation failed"
    ERRORS=$((ERRORS + 1))
fi

check_file "ops/observability/prometheus/alerts/slo_alerts.yml" "Generated Prometheus alerts"

# Validate alerts
echo "Validating alert rules..."
if python3 "$ROOT_DIR/tools/quality/alert_rules_validate.py"; then
    echo "✓ Alert validation successful"
else
    echo "✗ Alert validation failed"
    ERRORS=$((ERRORS + 1))
fi

# Check artifacts
if [ -f "$ROOT_DIR/artifacts/observability/alert_rules_validation.json" ]; then
    if python3 -c "import json; d=json.load(open('$ROOT_DIR/artifacts/observability/alert_rules_validation.json')); exit(0 if d.get('passed') else 1)"; then
        echo "✓ Alert validation artifact shows passed=true"
    else
        echo "✗ Alert validation artifact shows passed=false"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""
echo "--- Canary & Dashboards ---"
check_file "tools/synthetic/canary.py" "Canary monitor"
check_json "ops/observability/grafana/dashboards/zakops_overview.json" "Grafana dashboard"
check_file "docs/observability/DASHBOARDS.md" "Dashboard documentation"

# Run canary (graceful, won't fail gate)
echo "Running canary check (graceful)..."
python3 "$ROOT_DIR/tools/synthetic/canary.py" || true

echo ""
echo "=== Phase 6 Gate Summary ==="
if [ $ERRORS -eq 0 ]; then
    echo "✓ All checks passed"
    exit 0
else
    echo "✗ $ERRORS check(s) failed"
    exit 1
fi
