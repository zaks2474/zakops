#!/bin/bash
# Security Scan Script
# Runs supply chain security scans on the codebase
# Tools: pip-audit, trivy (optional), safety (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/security"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize results
SCAN_RESULTS="{}"
EXIT_CODE=0

mkdir -p "$ARTIFACTS_DIR"

echo "========================================"
echo "Security Scan - $(date -Iseconds)"
echo "========================================"

# Function to update JSON results
update_results() {
    local tool="$1"
    local status="$2"
    local message="$3"

    SCAN_RESULTS=$(echo "$SCAN_RESULTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
data['$tool'] = {'status': '$status', 'message': '''$message'''}
print(json.dumps(data))
")
}

# Check for pip-audit
echo ""
echo "=== pip-audit (Python dependencies) ==="
if command -v pip-audit &> /dev/null; then
    echo -e "${GREEN}pip-audit found${NC}"

    # Scan agent-api
    if [[ -f "$PROJECT_ROOT/apps/agent-api/pyproject.toml" ]]; then
        echo "Scanning apps/agent-api..."
        cd "$PROJECT_ROOT/apps/agent-api"

        # Run pip-audit with uv
        if uv run pip-audit --format=json > "$ARTIFACTS_DIR/pip_audit_agent_api.json" 2>/dev/null; then
            VULNS=$(cat "$ARTIFACTS_DIR/pip_audit_agent_api.json" | python3 -c "import json,sys; data=json.load(sys.stdin); print(len(data.get('vulnerabilities', data if isinstance(data, list) else [])))" 2>/dev/null || echo "0")
            if [[ "$VULNS" == "0" ]]; then
                echo -e "${GREEN}No vulnerabilities found in agent-api${NC}"
                update_results "pip_audit_agent_api" "pass" "No vulnerabilities found"
            else
                echo -e "${YELLOW}Found $VULNS vulnerabilities in agent-api${NC}"
                update_results "pip_audit_agent_api" "warn" "Found $VULNS vulnerabilities"
            fi
        else
            echo -e "${YELLOW}pip-audit completed with warnings${NC}"
            update_results "pip_audit_agent_api" "warn" "Completed with warnings"
        fi
    fi

    cd "$PROJECT_ROOT"
else
    echo -e "${YELLOW}pip-audit not installed - skipping Python dependency scan${NC}"
    echo "Install with: pip install pip-audit"
    update_results "pip_audit" "skipped" "pip-audit not installed"
fi

# Check for trivy
echo ""
echo "=== trivy (Container/Filesystem scan) ==="
if command -v trivy &> /dev/null; then
    echo -e "${GREEN}trivy found${NC}"

    echo "Scanning filesystem for vulnerabilities..."
    if trivy fs --format json --output "$ARTIFACTS_DIR/trivy_fs.json" "$PROJECT_ROOT" 2>/dev/null; then
        CRITICAL=$(cat "$ARTIFACTS_DIR/trivy_fs.json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('Results', [])
critical = sum(1 for r in results for v in r.get('Vulnerabilities', []) if v.get('Severity') == 'CRITICAL')
print(critical)
" 2>/dev/null || echo "0")

        if [[ "$CRITICAL" == "0" ]]; then
            echo -e "${GREEN}No critical vulnerabilities found${NC}"
            update_results "trivy_fs" "pass" "No critical vulnerabilities"
        else
            echo -e "${RED}Found $CRITICAL critical vulnerabilities${NC}"
            update_results "trivy_fs" "fail" "Found $CRITICAL critical vulnerabilities"
            EXIT_CODE=1
        fi
    else
        echo -e "${YELLOW}trivy scan completed with warnings${NC}"
        update_results "trivy_fs" "warn" "Completed with warnings"
    fi
else
    echo -e "${YELLOW}trivy not installed - skipping container/filesystem scan${NC}"
    echo "Install with: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
    update_results "trivy" "skipped" "trivy not installed"
fi

# Check for safety (alternative Python scanner)
echo ""
echo "=== safety (Python safety check) ==="
if command -v safety &> /dev/null; then
    echo -e "${GREEN}safety found${NC}"

    if [[ -f "$PROJECT_ROOT/apps/agent-api/requirements.txt" ]]; then
        echo "Scanning requirements.txt..."
        if safety check -r "$PROJECT_ROOT/apps/agent-api/requirements.txt" --output json > "$ARTIFACTS_DIR/safety.json" 2>/dev/null; then
            echo -e "${GREEN}No known vulnerabilities found${NC}"
            update_results "safety" "pass" "No known vulnerabilities"
        else
            echo -e "${YELLOW}safety check found issues or completed with warnings${NC}"
            update_results "safety" "warn" "Found issues or warnings"
        fi
    else
        echo "No requirements.txt found, skipping safety scan"
        update_results "safety" "skipped" "No requirements.txt"
    fi
else
    echo -e "${YELLOW}safety not installed - skipping Python safety check${NC}"
    echo "Install with: pip install safety"
    update_results "safety" "skipped" "safety not installed"
fi

# Check for secrets in codebase (basic check)
echo ""
echo "=== Secrets Detection (basic) ==="
echo "Checking for potential secrets..."

SECRETS_FOUND=0
SECRETS_PATTERNS=(
    "password\s*=\s*['\"][^'\"]+['\"]"
    "api_key\s*=\s*['\"][^'\"]+['\"]"
    "secret\s*=\s*['\"][^'\"]+['\"]"
    "AWS_SECRET"
    "PRIVATE_KEY"
)

for pattern in "${SECRETS_PATTERNS[@]}"; do
    # Search in Python files, excluding test files and virtual envs
    MATCHES=$(grep -rniE "$pattern" "$PROJECT_ROOT" \
        --include="*.py" \
        --exclude-dir=".git" \
        --exclude-dir="node_modules" \
        --exclude-dir=".venv" \
        --exclude-dir="venv" \
        --exclude-dir="__pycache__" \
        --exclude="*test*.py" \
        --exclude="*conftest*.py" \
        2>/dev/null | wc -l || echo "0")

    if [[ "$MATCHES" -gt 0 ]]; then
        echo -e "${YELLOW}Warning: Found $MATCHES potential matches for pattern: $pattern${NC}"
        SECRETS_FOUND=$((SECRETS_FOUND + MATCHES))
    fi
done

if [[ "$SECRETS_FOUND" -eq 0 ]]; then
    echo -e "${GREEN}No obvious secrets found in codebase${NC}"
    update_results "secrets_scan" "pass" "No obvious secrets found"
else
    echo -e "${YELLOW}Found $SECRETS_FOUND potential secret patterns - review manually${NC}"
    update_results "secrets_scan" "warn" "Found $SECRETS_FOUND potential patterns - manual review needed"
fi

# Write final results
echo ""
echo "========================================"
echo "Scan Complete"
echo "========================================"

# Add timestamp and overall status
SCAN_RESULTS=$(echo "$SCAN_RESULTS" | python3 -c "
import json, sys
from datetime import datetime
data = json.load(sys.stdin)
data['timestamp'] = datetime.now().isoformat()
data['overall_passed'] = $( [[ $EXIT_CODE -eq 0 ]] && echo 'True' || echo 'False' )
print(json.dumps(data, indent=2))
")

echo "$SCAN_RESULTS" > "$ARTIFACTS_DIR/security_scan_results.json"
echo ""
echo "Results written to: $ARTIFACTS_DIR/security_scan_results.json"

if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}Security scan passed${NC}"
else
    echo -e "${RED}Security scan failed - critical vulnerabilities found${NC}"
fi

exit $EXIT_CODE
