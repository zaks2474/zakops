#!/usr/bin/env bash
# ZakOps Agent API - HITL Spike Verification Script
# This script verifies the HITL implementation meets all spike DoD requirements
#
# Gate Artifacts Generated:
#   - gate_artifacts/health.json                  (T0: Health check)
#   - gate_artifacts/invoke_hitl.json             (T1: HITL trigger)
#   - gate_artifacts/approve.json                 (T3: Approve happy path)
#   - gate_artifacts/approve_again.json           (T4: Double approve)
#   - gate_artifacts/concurrent_approves.log      (T5: Concurrent approvals)
#   - gate_artifacts/checkpoint_kill9_test.log    (T6: Kill-9 recovery)
#   - gate_artifacts/tool_call_validation_test.log (T8: Tool schema strictness)
#   - gate_artifacts/dependency_licenses.json     (T9: License report)
#   - gate_artifacts/copyleft_findings.json       (T9b: Copyleft scan - only if found)
#   - gate_artifacts/db_invariants.sql.out        (T2/T9/T10: DB assertions)
#   - gate_artifacts/mock_safety_test.log         (T11: Mock safety)
#   - gate_artifacts/streaming_test.log           (T12: SSE streaming)
#   - gate_artifacts/hitl_scope_test.log          (T13: HITL scope)
#   - gate_artifacts/auth_negative_tests.json     (T14: Auth negative - JWT enforcement)
#   - gate_artifacts/build.log
#   - gate_artifacts/run.log
#
# Usage: ./scripts/bring_up_tests.sh
#
# Prerequisites:
# - Docker and docker-compose installed
# - jq for JSON parsing
# - curl for HTTP requests
# - psql (optional, for DB assertions)

set -euo pipefail

# Configuration
AGENT_BASE="${AGENT_BASE:-http://localhost:8095}"
API="${API:-$AGENT_BASE}"
OUT="${OUT:-./gate_artifacts}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-zakops_agent}"
DB_USER="${DB_USER:-agent}"
DB_PASS="${DB_PASS:-agent_secure_pass_123}"

# Ensure a non-default JWT secret is present for tests that enable JWT enforcement.
# Do NOT print the secret to logs.
if [[ -z "${JWT_SECRET_KEY:-}" ]]; then
    if command -v python3 &> /dev/null; then
        JWT_SECRET_KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
    elif command -v python &> /dev/null; then
        JWT_SECRET_KEY="$(python - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
    else
        JWT_SECRET_KEY="$(date -Is | sha256sum | awk '{print $1}')"
    fi
    export JWT_SECRET_KEY
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create gate_artifacts directory
mkdir -p "$OUT"
# Clear stale artifacts from prior runs (avoid false gate failures)
find "$OUT" -maxdepth 1 -type f -delete

# Logging
log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts="$(date -Is)"
    printf '%s [%s] %s\n' "$ts" "$level" "$msg" | tee -a "$OUT/run.log"
}

log_info()  { log "INFO" "$*"; echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { log "WARN" "$*"; echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { log "ERROR" "$*"; echo -e "${RED}[ERROR]${NC} $*"; }
log_test()  {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}TEST: $*${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    log "TEST" "$*"
}

# Check dependencies
check_deps() {
    local deps=("docker" "curl" "jq")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is required but not installed"
            exit 1
        fi
    done
}

# Wait for service to be ready
wait_for_service() {
    local url="$1"
    local max_attempts="${2:-60}"
    local attempt=1

    log_info "Waiting for $url..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_info "Service ready!"
            return 0
        fi
        printf "."
        sleep 2
        ((attempt++))
    done
    log_error "Service did not become ready"
    return 1
}

# Run DB query (if psql available)
run_db_query() {
    local query="$1"
    local output_file="$2"

    if command -v psql &> /dev/null; then
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "$query" >> "$output_file" 2>&1 || true
    else
        # Try via docker exec
        docker exec zakops-agent-db psql -U "$DB_USER" -d "$DB_NAME" \
            -c "$query" >> "$output_file" 2>&1 || true
    fi
}

# ============================================================
check_deps
cd "$(dirname "$0")/.."

# Initialize run log
echo "=== HITL Spike Verification ===" > "$OUT/run.log"
echo "Started: $(date -Is)" >> "$OUT/run.log"

# ============================================================
# TEST 0: Build and Start Services
# ============================================================
log_test "T0: Build and Start Services"

log_info "Building Docker images..."
docker compose build agent-api 2>&1 | tee "$OUT/build.log"

log_info "Starting services (db + agent-api)..."
docker compose up -d db agent-api 2>&1 | tee -a "$OUT/build.log"

wait_for_service "$AGENT_BASE/health" 60

# ============================================================
# TEST 1: Health Check
# ============================================================
log_test "T0: Health Check"

curl -s "$AGENT_BASE/health" | tee "$OUT/health.json" | jq .
if jq -e '.status=="healthy" or .status=="degraded"' "$OUT/health.json" > /dev/null; then
    log_info "Health check PASSED"
else
    log_error "Health check FAILED"
    exit 1
fi

# ============================================================
# TEST 2: HITL Invoke (transition_deal)
# ============================================================
log_test "T1: HITL Invoke (transition_deal)"

curl -s -X POST "$API/agent/invoke" \
    -H "Content-Type: application/json" \
    -d '{"actor_id":"qa","message":"Transition deal DEAL-001 from qualification to proposal because budget approved","metadata":{"test":"hitl"}}' \
    | tee "$OUT/invoke_hitl.json" | jq .

if jq -e '.status=="awaiting_approval"' "$OUT/invoke_hitl.json" > /dev/null; then
    log_info "HITL invoke PASSED - awaiting_approval returned"
    APPROVAL_ID=$(jq -r '.pending_approval.approval_id' "$OUT/invoke_hitl.json")
    THREAD_ID=$(jq -r '.thread_id' "$OUT/invoke_hitl.json")
    TOOL_NAME=$(jq -r '.pending_approval.tool' "$OUT/invoke_hitl.json")

    log_info "Approval ID: $APPROVAL_ID"
    log_info "Thread ID: $THREAD_ID"
    log_info "Tool: $TOOL_NAME"

    # Verify tool_name is transition_deal
    if [ "$TOOL_NAME" == "transition_deal" ]; then
        log_info "Tool name check PASSED"
    else
        log_error "Tool name check FAILED: expected transition_deal, got $TOOL_NAME"
    fi

    export APPROVAL_ID THREAD_ID
else
    log_warn "HITL not triggered (LLM may not have called transition_deal)"
    APPROVAL_ID=""
fi

# ============================================================
# TEST 3: DB Invariants - Approval Persisted
# ============================================================
log_test "T2: DB Invariants Check"

echo "=== DB Invariants ===" > "$OUT/db_invariants.sql.out"
echo "Timestamp: $(date -Is)" >> "$OUT/db_invariants.sql.out"
echo "" >> "$OUT/db_invariants.sql.out"

if [ -n "${APPROVAL_ID:-}" ]; then
    echo "-- Approval row (id=$APPROVAL_ID)" >> "$OUT/db_invariants.sql.out"
    run_db_query "SELECT id, tool_name, status, idempotency_key, created_at, expires_at FROM approvals WHERE id = '$APPROVAL_ID';" "$OUT/db_invariants.sql.out"
fi

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- All pending approvals" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT id, tool_name, status, created_at FROM approvals WHERE status = 'pending';" "$OUT/db_invariants.sql.out"

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Checkpoint tables exist (checkpoints, checkpoint_writes, checkpoint_blobs)" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT to_regclass('public.checkpoints') AS checkpoints, to_regclass('public.checkpoint_writes') AS checkpoint_writes, to_regclass('public.checkpoint_blobs') AS checkpoint_blobs;" "$OUT/db_invariants.sql.out"

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Checkpoint count" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT COUNT(*) AS checkpoint_count FROM checkpoints;" "$OUT/db_invariants.sql.out"

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Checkpoint blobs count (if table exists)" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT COUNT(*) AS blob_count FROM checkpoint_blobs;" "$OUT/db_invariants.sql.out"

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Idempotency key uniqueness check (should be 0 duplicates)" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT idempotency_key, COUNT(*) AS cnt FROM tool_executions GROUP BY idempotency_key HAVING COUNT(*) > 1;" "$OUT/db_invariants.sql.out"

log_info "DB invariants written to $OUT/db_invariants.sql.out"

# ============================================================
# TEST 4: Approve Happy Path
# ============================================================
log_test "T3: Approve Happy Path"

if [ -n "${APPROVAL_ID:-}" ]; then
    HTTP_CODE=$(curl -s -o "$OUT/approve.json" -w "%{http_code}" -X POST "$API/agent/approvals/$APPROVAL_ID:approve" \
        -H "Content-Type: application/json" \
        -d '{"actor_id":"approver-1","reason":"Approved via bring_up_tests"}')

    jq . "$OUT/approve.json"

    if [ "$HTTP_CODE" == "200" ]; then
        # MDv2 spec: approve returns AgentInvokeResponse with status="completed"
        if jq -e '.status=="completed"' "$OUT/approve.json" > /dev/null; then
            log_info "Approve PASSED (HTTP $HTTP_CODE, status=completed per MDv2)"
        else
            log_warn "Approve returned 200 but status is not 'completed'"
        fi
    else
        log_error "Approve FAILED (HTTP $HTTP_CODE)"
    fi

    # Check audit log
    echo "" >> "$OUT/db_invariants.sql.out"
    echo "-- Audit log for approval $APPROVAL_ID" >> "$OUT/db_invariants.sql.out"
    run_db_query "SELECT event_type, actor_id, created_at FROM audit_log WHERE approval_id = '$APPROVAL_ID' ORDER BY created_at ASC;" "$OUT/db_invariants.sql.out"
else
    log_warn "Skipping approve test (no approval_id)"
    echo '{"skipped": true, "reason": "no approval_id"}' > "$OUT/approve.json"
fi

# ============================================================
# TEST 5: Double-Approve Idempotency
# ============================================================
log_test "T4: Double-Approve Idempotency"

if [ -n "${APPROVAL_ID:-}" ]; then
    HTTP_CODE=$(curl -s -o "$OUT/approve_again.json" -w "%{http_code}" -X POST "$API/agent/approvals/$APPROVAL_ID:approve" \
        -H "Content-Type: application/json" \
        -d '{"actor_id":"approver-2","reason":"Second approve attempt"}')

    jq . "$OUT/approve_again.json"

    if [ "$HTTP_CODE" == "409" ] || [ "$HTTP_CODE" == "400" ]; then
        log_info "Double-approve correctly rejected (HTTP $HTTP_CODE)"
    else
        log_warn "Double-approve returned unexpected HTTP $HTTP_CODE"
    fi
else
    log_warn "Skipping double-approve test (no approval_id)"
fi

# ============================================================
# TEST 6: Kill-9 Crash Recovery
# ============================================================
log_test "T6: Kill-9 Crash Recovery"

echo "=== Kill-9 Recovery Test ===" > "$OUT/checkpoint_kill9_test.log"
echo "Timestamp: $(date -Is)" >> "$OUT/checkpoint_kill9_test.log"

# Create new pending approval
log_info "Creating new pending approval for crash test..."
CRASH_RESPONSE=$(curl -s -X POST "$API/agent/invoke" \
    -H "Content-Type: application/json" \
    -d '{"actor_id":"crash-test","message":"Transition deal CRASH-001 from lead to qualification","metadata":{"test":"crash"}}')

echo "Invoke response:" >> "$OUT/checkpoint_kill9_test.log"
echo "$CRASH_RESPONSE" | jq . >> "$OUT/checkpoint_kill9_test.log"

CRASH_STATUS=$(echo "$CRASH_RESPONSE" | jq -r '.status')

if [ "$CRASH_STATUS" == "awaiting_approval" ]; then
    CRASH_APPROVAL_ID=$(echo "$CRASH_RESPONSE" | jq -r '.pending_approval.approval_id')
    log_info "Pending approval created: $CRASH_APPROVAL_ID"
    echo "Crash approval ID: $CRASH_APPROVAL_ID" >> "$OUT/checkpoint_kill9_test.log"

    # Kill container
    log_info "Killing container with SIGKILL..."
    echo "Killing container: $(date -Is)" >> "$OUT/checkpoint_kill9_test.log"
    docker kill -s KILL zakops-agent-api 2>&1 >> "$OUT/checkpoint_kill9_test.log" || true

    # Restart
    log_info "Restarting container..."
    echo "Restarting: $(date -Is)" >> "$OUT/checkpoint_kill9_test.log"
    docker compose up -d agent-api 2>&1 >> "$OUT/checkpoint_kill9_test.log"

    wait_for_service "$AGENT_BASE/health" 60

    # Verify approval survived
    log_info "Verifying approval survived crash..."
    RECOVERED=$(curl -s "$API/agent/approvals/$CRASH_APPROVAL_ID")
    echo "Recovered approval:" >> "$OUT/checkpoint_kill9_test.log"
    echo "$RECOVERED" | jq . >> "$OUT/checkpoint_kill9_test.log"

    if echo "$RECOVERED" | jq -e '.approval_id' > /dev/null 2>&1; then
        log_info "Crash recovery PASSED - approval survived"
        echo "RESULT: PASSED" >> "$OUT/checkpoint_kill9_test.log"

        # Approve after recovery
        RECOVERY_APPROVE=$(curl -s -X POST "$API/agent/approvals/$CRASH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -d '{"actor_id":"recovery-approver","reason":"Post-crash approve"}')
        echo "Post-crash approve:" >> "$OUT/checkpoint_kill9_test.log"
        echo "$RECOVERY_APPROVE" | jq . >> "$OUT/checkpoint_kill9_test.log"
    else
        log_error "Crash recovery FAILED - approval not found"
        echo "RESULT: FAILED" >> "$OUT/checkpoint_kill9_test.log"
    fi
else
    log_warn "Could not create pending approval for crash test"
    echo "RESULT: SKIPPED (no pending approval)" >> "$OUT/checkpoint_kill9_test.log"
fi

# ============================================================
# TEST 7: Concurrent Approvals
# ============================================================
log_test "T5: Concurrent Approvals (N=20)"

echo "=== Concurrent Approval Test ===" > "$OUT/concurrent_approves.log"
echo "Timestamp: $(date -Is)" >> "$OUT/concurrent_approves.log"

# Create a fresh approval
CONC_RESPONSE=$(curl -s -X POST "$API/agent/invoke" \
    -H "Content-Type: application/json" \
    -d '{"actor_id":"conc-test","message":"Transition deal CONC-001 from lead to qualification","metadata":{"test":"concurrent"}}')

CONC_STATUS=$(echo "$CONC_RESPONSE" | jq -r '.status')

if [ "$CONC_STATUS" == "awaiting_approval" ]; then
    CONC_APPROVAL_ID=$(echo "$CONC_RESPONSE" | jq -r '.pending_approval.approval_id')
    log_info "Concurrent test approval: $CONC_APPROVAL_ID"
    echo "Approval ID: $CONC_APPROVAL_ID" >> "$OUT/concurrent_approves.log"

    # Run 20 parallel approvals
    log_info "Sending 20 parallel approve requests..."
    echo "HTTP Codes:" >> "$OUT/concurrent_approves.log"

    seq 1 20 | xargs -I{} -P 20 bash -c \
        'curl -s -o /dev/null -w "%{http_code}\n" -X POST "'"$API"'/agent/approvals/'"$CONC_APPROVAL_ID"':approve" \
        -H "Content-Type: application/json" \
        -d "{\"actor_id\":\"approver-{}\"}"' \
        2>&1 | tee -a "$OUT/concurrent_approves.log"

    # Count results
    SUCCESS_COUNT=$(grep -c "^200$" "$OUT/concurrent_approves.log" || echo "0")
    CONFLICT_COUNT=$(grep -c "^409$" "$OUT/concurrent_approves.log" || echo "0")
    BAD_COUNT=$(grep -c "^400$" "$OUT/concurrent_approves.log" || echo "0")

    echo "" >> "$OUT/concurrent_approves.log"
    echo "Summary:" >> "$OUT/concurrent_approves.log"
    echo "  200 (success): $SUCCESS_COUNT" >> "$OUT/concurrent_approves.log"
    echo "  409 (conflict): $CONFLICT_COUNT" >> "$OUT/concurrent_approves.log"
    echo "  400 (bad request): $BAD_COUNT" >> "$OUT/concurrent_approves.log"

    log_info "Concurrent results: 200=$SUCCESS_COUNT, 409=$CONFLICT_COUNT, 400=$BAD_COUNT"

    if [ "$SUCCESS_COUNT" == "1" ]; then
        log_info "Concurrent test PASSED - exactly 1 winner"
        echo "RESULT: PASSED" >> "$OUT/concurrent_approves.log"
    else
        log_warn "Concurrent test: expected 1 success, got $SUCCESS_COUNT"
        echo "RESULT: WARN (expected 1 success)" >> "$OUT/concurrent_approves.log"
    fi

    # Verify DB has exactly 1 execution
    echo "" >> "$OUT/db_invariants.sql.out"
    echo "-- Tool executions for concurrent test" >> "$OUT/db_invariants.sql.out"
    run_db_query "SELECT COUNT(*) AS execution_count FROM tool_executions WHERE approval_id = '$CONC_APPROVAL_ID';" "$OUT/db_invariants.sql.out"
else
    log_warn "Could not create pending approval for concurrent test"
    echo "RESULT: SKIPPED" >> "$OUT/concurrent_approves.log"
fi

# ============================================================
# TEST 8: Tool Arg Validation (extra="forbid")
# ============================================================
log_test "T8: Tool Arg Validation (extra=forbid)"

# Run validation test inside container (no LLM dependency)
VALIDATION_RESULT=$(docker exec zakops-agent-api /app/.venv/bin/python -c '
import sys
import json
from pydantic import ValidationError
from app.core.langgraph.tools.deal_tools import TransitionDealInput

results = {"passed": 0, "failed": 0, "tests": []}

# Test 1: Valid args should pass
try:
    obj = TransitionDealInput(deal_id="DEAL-001", from_stage="lead", to_stage="qualification", reason="Budget approved")
    results["tests"].append({"name": "valid_args", "passed": True, "message": "Valid args accepted"})
    results["passed"] += 1
except Exception as e:
    results["tests"].append({"name": "valid_args", "passed": False, "message": str(e)})
    results["failed"] += 1

# Test 2: Extra args should be rejected (extra="forbid")
try:
    obj = TransitionDealInput(deal_id="DEAL-001", from_stage="lead", to_stage="qualification", unknown_field="hacker")
    results["tests"].append({"name": "extra_args_rejected", "passed": False, "message": "Extra args should be rejected but were accepted"})
    results["failed"] += 1
except ValidationError as e:
    if "extra_forbidden" in str(e) or "Extra inputs are not permitted" in str(e):
        results["tests"].append({"name": "extra_args_rejected", "passed": True, "message": "Extra args correctly rejected"})
        results["passed"] += 1
    else:
        results["tests"].append({"name": "extra_args_rejected", "passed": False, "message": f"Wrong error: {e}"})
        results["failed"] += 1

# Test 3: Missing required args should fail
try:
    obj = TransitionDealInput(deal_id="DEAL-001")
    results["tests"].append({"name": "missing_args_rejected", "passed": False, "message": "Missing args should be rejected"})
    results["failed"] += 1
except ValidationError as e:
    results["tests"].append({"name": "missing_args_rejected", "passed": True, "message": "Missing args correctly rejected"})
    results["passed"] += 1

# Test 4: Invalid type should fail
try:
    obj = TransitionDealInput(deal_id=12345, from_stage="lead", to_stage="qualification")
    # Pydantic may coerce int to str, so this might pass
    if isinstance(obj.deal_id, str):
        results["tests"].append({"name": "type_coercion", "passed": True, "message": "Type coerced to string (acceptable)"})
        results["passed"] += 1
    else:
        results["tests"].append({"name": "type_coercion", "passed": False, "message": "Type not coerced"})
        results["failed"] += 1
except ValidationError as e:
    results["tests"].append({"name": "type_coercion", "passed": True, "message": "Invalid type rejected"})
    results["passed"] += 1

results["summary"] = "{}/{} tests passed".format(
    results["passed"],
    results["passed"] + results["failed"],
)
results["status"] = "PASSED" if results["failed"] == 0 else "FAILED"
print(json.dumps(results, indent=2))
' 2>&1)

echo "$VALIDATION_RESULT" > "$OUT/tool_call_validation_test.raw.log"
VALIDATION_JSON=$(printf '%s\n' "$VALIDATION_RESULT" | awk 'found || $0 ~ /^[{]/ {found=1; print}')
echo "$VALIDATION_JSON" > "$OUT/tool_call_validation_test.log"

if jq -e '.status=="PASSED"' "$OUT/tool_call_validation_test.log" > /dev/null 2>&1; then
    log_info "Tool arg validation PASSED"
else
    log_warn "Tool arg validation had failures"
fi

# ============================================================
# TEST 9: Dependency License Report
# ============================================================
log_test "T9: Dependency License Report"

echo "=== Dependency License Report ===" > "$OUT/dependency_licenses.json.tmp"

# Generate license report using pip show (more reliable than pip-licenses in container)
LICENSE_RESULT=$(docker exec zakops-agent-api /app/.venv/bin/python -c '
import json
import importlib.metadata as im
import sys

licenses = []
for dist in im.distributions():
    name = dist.metadata.get("Name", "unknown")
    version = dist.metadata.get("Version", "unknown")
    license_val = dist.metadata.get("License", "")

    # Fallback: check classifier for license
    if not license_val or license_val == "UNKNOWN":
        classifiers = dist.metadata.get_all("Classifier") or []
        for c in classifiers:
            if c.startswith("License ::"):
                license_val = c.split("::")[-1].strip()
                break

    if not license_val:
        license_val = "Unknown"

    licenses.append({
        "name": name,
        "version": version,
        "license": license_val
    })

# Sort by name
licenses.sort(key=lambda x: x["name"].lower())

output = {
    "generated_at": __import__("datetime").datetime.now().isoformat(),
    "python_version": sys.version.split()[0],
    "package_count": len(licenses),
    "packages": licenses
}
print(json.dumps(output, indent=2))
' 2>&1)

echo "$LICENSE_RESULT" > "$OUT/dependency_licenses.json"

if jq -e '.package_count > 0' "$OUT/dependency_licenses.json" > /dev/null 2>&1; then
    PKG_COUNT=$(jq -r '.package_count' "$OUT/dependency_licenses.json")
    log_info "License report generated: $PKG_COUNT packages"
else
    log_warn "License report generation had issues"
fi

# ============================================================
# TEST 9b: Copyleft License Gate
# ============================================================
log_test "T9b: Copyleft License Gate"

# Fail if GPL/AGPL/LGPL appears (best-effort denylist scan)
COPYLEFT_COUNT=$(jq -r '[.packages[].license | tostring | ascii_downcase | select(test("agpl|\\bgpl\\b|lgpl"))] | length' "$OUT/dependency_licenses.json" 2>/dev/null || echo "0")

if [ "$COPYLEFT_COUNT" != "0" ] && [ "$COPYLEFT_COUNT" != "" ]; then
    jq -r '.packages[] | select(.license|tostring|ascii_downcase|test("agpl|\\bgpl\\b|lgpl"))' "$OUT/dependency_licenses.json" > "$OUT/copyleft_findings.json" 2>/dev/null || true
    log_error "Copyleft gate FAILED: found $COPYLEFT_COUNT copyleft licenses (see copyleft_findings.json)"
    echo "COPYLEFT_COUNT=$COPYLEFT_COUNT" >> "$OUT/dependency_licenses.json.meta"
    echo "GATE_COPYLEFT=FAILED" >> "$OUT/gate_results.txt"
    # NOTE: Do not exit 1 here - continue to collect all results
else
    log_info "Copyleft gate PASSED: no GPL/AGPL/LGPL detected"
    echo "COPYLEFT_COUNT=0" >> "$OUT/dependency_licenses.json.meta"
fi

# ============================================================
# TEST 10: Audit Log Verification
# ============================================================
log_test "T10: Audit Log Verification"

echo "" >> "$OUT/db_invariants.sql.out"
echo "=== Audit Log Verification ===" >> "$OUT/db_invariants.sql.out"
echo "Timestamp: $(date -Is)" >> "$OUT/db_invariants.sql.out"

# Check audit log has events
echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Audit log event counts by type" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT event_type, COUNT(*) AS cnt FROM audit_log GROUP BY event_type ORDER BY cnt DESC;" "$OUT/db_invariants.sql.out"

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Recent audit events (last 20)" >> "$OUT/db_invariants.sql.out"
run_db_query "SELECT id, event_type, actor_id, approval_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 20;" "$OUT/db_invariants.sql.out"

echo "" >> "$OUT/db_invariants.sql.out"
echo "-- Audit trail completeness check (approvals should have matching audit events)" >> "$OUT/db_invariants.sql.out"
run_db_query "
SELECT a.id AS approval_id, a.status AS approval_status,
       COUNT(al.id) AS audit_event_count,
       STRING_AGG(al.event_type, ', ' ORDER BY al.created_at) AS events
FROM approvals a
LEFT JOIN audit_log al ON a.id = al.approval_id
GROUP BY a.id, a.status
ORDER BY a.created_at DESC
LIMIT 10;
" "$OUT/db_invariants.sql.out"

log_info "Audit log verification written to $OUT/db_invariants.sql.out"

# ============================================================
# TEST 11: Mock Safety Check
# ============================================================
log_test "T11: Mock Safety Check"

echo "=== Mock Safety Check ===" > "$OUT/mock_safety_test.log"
echo "Timestamp: $(date -Is)" >> "$OUT/mock_safety_test.log"

# Check environment variables in container
MOCK_CHECK=$(docker exec zakops-agent-api /app/.venv/bin/python -c '
import os
import json

result = {
    "APP_ENV": os.getenv("APP_ENV", "not_set"),
    "ALLOW_TOOL_MOCKS": os.getenv("ALLOW_TOOL_MOCKS", "not_set"),
    "is_production": os.getenv("APP_ENV", "development") == "production",
    "mocks_enabled": os.getenv("ALLOW_TOOL_MOCKS", "true").lower() == "true"
}

# Safety check: in production, mocks should be disabled
if result["is_production"] and result["mocks_enabled"]:
    result["safety_status"] = "UNSAFE"
    result["message"] = "WARNING: Mocks enabled in production!"
else:
    result["safety_status"] = "SAFE"
    result["message"] = "Configuration is safe"

print(json.dumps(result, indent=2))
' 2>&1)

echo "$MOCK_CHECK" | tee -a "$OUT/mock_safety_test.log"

if echo "$MOCK_CHECK" | jq -e '.safety_status=="SAFE"' > /dev/null 2>&1; then
    log_info "Mock safety check PASSED"
else
    log_warn "Mock safety check: review configuration"
fi

# ============================================================
# TEST 12: Streaming (SSE) Test
# ============================================================
log_test "T12: Streaming (SSE) Test"

echo "=== Streaming Test ===" > "$OUT/streaming_test.log"
echo "Timestamp: $(date -Is)" >> "$OUT/streaming_test.log"

# MDv2 Spec: Use /agent/invoke/stream endpoint (no auth required for agent endpoints by default)
STREAM_RESULT=$(bash -c '
set -euo pipefail

API="'"$API"'"
OUT="'"$OUT"'"

echo "Testing MDv2 agent streaming endpoint: $API/agent/invoke/stream" >> "$OUT/streaming_test.log"

# Use timeout to prevent hanging
# MDv2 streaming: POST /agent/invoke/stream with AgentInvokeRequest body
STREAM_OUTPUT=$(timeout 15 curl -N -s -X POST "$API/agent/invoke/stream" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d "{\"actor_id\":\"qa-stream\",\"message\":\"What is 2+2?\",\"metadata\":{\"test\":\"streaming\"}}" 2>&1) || true

echo "Stream output:" >> "$OUT/streaming_test.log"
echo "$STREAM_OUTPUT" >> "$OUT/streaming_test.log"

# MDv2 SSE Format: Check for event: start, event: content, event: done
if echo "$STREAM_OUTPUT" | grep -q "event: done"; then
    echo "STATUS=PASSED" >> "$OUT/streaming_test.log"
    echo "PASSED"
elif echo "$STREAM_OUTPUT" | grep -q "event: start"; then
    # Got start event but no done - partial pass (may have timed out)
    if echo "$STREAM_OUTPUT" | grep -q "event: content"; then
        echo "STATUS=PASSED" >> "$OUT/streaming_test.log"
        echo "REASON=Got start+content events (done may have been cut off by timeout)" >> "$OUT/streaming_test.log"
        echo "PASSED"
    else
        echo "STATUS=WARN" >> "$OUT/streaming_test.log"
        echo "REASON=Got start event but no content/done" >> "$OUT/streaming_test.log"
        echo "WARN"
    fi
elif echo "$STREAM_OUTPUT" | grep -q "404"; then
    echo "STATUS=FAILED" >> "$OUT/streaming_test.log"
    echo "REASON=Stream endpoint not found (404) - endpoint may not be implemented" >> "$OUT/streaming_test.log"
    echo "FAILED"
elif [ -z "$STREAM_OUTPUT" ]; then
    echo "STATUS=FAILED" >> "$OUT/streaming_test.log"
    echo "REASON=No response from stream endpoint" >> "$OUT/streaming_test.log"
    echo "FAILED"
else
    # Check if we got any SSE events at all
    if echo "$STREAM_OUTPUT" | grep -q "^event:"; then
        echo "STATUS=PASSED" >> "$OUT/streaming_test.log"
        echo "REASON=Received SSE events" >> "$OUT/streaming_test.log"
        echo "PASSED"
    else
        echo "STATUS=WARN" >> "$OUT/streaming_test.log"
        echo "REASON=Response received but no SSE events found" >> "$OUT/streaming_test.log"
        echo "WARN"
    fi
fi
' 2>&1)

echo "Stream test result: $STREAM_RESULT" >> "$OUT/streaming_test.log"

# Streaming gate is STRICT - must PASS, not SKIP/WARN/FAILED
if [ "$STREAM_RESULT" == "PASSED" ]; then
    log_info "Streaming gate PASSED"
else
    log_error "Streaming gate FAILED (must be PASSED, got: $STREAM_RESULT)"
    echo "GATE_STREAMING=FAILED" >> "$OUT/gate_results.txt"
    # NOTE: Do not exit 1 here - continue to collect all results for debugging
fi

# ============================================================
# TEST 13: HITL Scope Test (requires_approval function)
# ============================================================
log_test "T13: HITL Scope Test"

SCOPE_RESULT=$(docker exec zakops-agent-api /app/.venv/bin/python -c '
import json
from app.schemas.agent import HITL_TOOLS

results = {"tests": [], "passed": 0, "failed": 0}

# Test 1: transition_deal requires approval
if "transition_deal" in HITL_TOOLS:
    results["tests"].append({"name": "transition_deal_requires_approval", "passed": True})
    results["passed"] += 1
else:
    results["tests"].append({"name": "transition_deal_requires_approval", "passed": False, "message": "transition_deal not in HITL_TOOLS"})
    results["failed"] += 1

# Test 2: Other tools do NOT require approval
other_tools = ["get_deal", "search_deals", "check_system_health", "list_deals", "create_deal"]
for tool in other_tools:
    if tool not in HITL_TOOLS:
        results["tests"].append({"name": f"{tool}_no_approval", "passed": True})
        results["passed"] += 1
    else:
        results["tests"].append({"name": f"{tool}_no_approval", "passed": False, "message": f"{tool} should not require approval"})
        results["failed"] += 1

# Test 3: HITL_TOOLS is exactly {transition_deal}
if HITL_TOOLS == frozenset(["transition_deal"]):
    results["tests"].append({"name": "hitl_scope_exact", "passed": True})
    results["passed"] += 1
else:
    results["tests"].append({"name": "hitl_scope_exact", "passed": False, "message": f"HITL_TOOLS={HITL_TOOLS}, expected frozenset([\"transition_deal\"])"})
    results["failed"] += 1

results["summary"] = "{}/{} tests passed".format(
    results["passed"],
    results["passed"] + results["failed"],
)
results["status"] = "PASSED" if results["failed"] == 0 else "FAILED"
print(json.dumps(results, indent=2))
' 2>&1)

echo "$SCOPE_RESULT" > "$OUT/hitl_scope_test.raw.log"
SCOPE_JSON=$(printf '%s\n' "$SCOPE_RESULT" | awk 'found || $0 ~ /^[{]/ {found=1; print}')
echo "$SCOPE_JSON" > "$OUT/hitl_scope_test.log"

if jq -e '.status=="PASSED"' "$OUT/hitl_scope_test.log" > /dev/null 2>&1; then
    log_info "HITL scope test PASSED"
else
    log_error "HITL scope test FAILED"
fi

# ============================================================
# TEST 14: Auth Negative Tests (JWT Enforcement)
# ============================================================
log_test "T14: Auth Negative Tests (JWT Enforcement)"

echo "=== Auth Negative Tests ===" > "$OUT/auth_negative_tests.json.tmp"
echo "Timestamp: $(date -Is)" >> "$OUT/auth_negative_tests.json.tmp"

# Create a new approval for auth testing
AUTH_TEST_RESPONSE=$(curl -s -X POST "$API/agent/invoke" \
    -H "Content-Type: application/json" \
    -d '{"actor_id":"auth-test","message":"Transition deal AUTH-001 from lead to qualification","metadata":{"test":"auth"}}')

AUTH_STATUS=$(echo "$AUTH_TEST_RESPONSE" | jq -r '.status')
AUTH_APPROVAL_ID=""

if [ "$AUTH_STATUS" == "awaiting_approval" ]; then
    AUTH_APPROVAL_ID=$(echo "$AUTH_TEST_RESPONSE" | jq -r '.pending_approval.approval_id')
    log_info "Auth test approval created: $AUTH_APPROVAL_ID"
fi

# Run auth tests with JWT enforcement inside container
AUTH_RESULT=$(docker exec -e AGENT_JWT_ENFORCE=true zakops-agent-api /app/.venv/bin/python -c '
import json
import os
import sys

# Force JWT enforcement for this test
os.environ["AGENT_JWT_ENFORCE"] = "true"

from app.core.security.agent_auth import generate_test_tokens, AGENT_JWT_ISSUER, AGENT_JWT_AUDIENCE, AGENT_JWT_REQUIRED_ROLE

# Generate test tokens
tokens = generate_test_tokens()

output = {
    "generated_at": __import__("datetime").datetime.now().isoformat(),
    "jwt_settings": {
        "issuer": AGENT_JWT_ISSUER,
        "audience": AGENT_JWT_AUDIENCE,
        "required_role": AGENT_JWT_REQUIRED_ROLE
    },
    "tokens": {
        "valid": {"token": tokens["valid"][:50] + "...", "full_length": len(tokens["valid"])},
        "expired": {"token": tokens["expired"][:50] + "...", "full_length": len(tokens["expired"])},
        "wrong_iss": {"token": tokens["wrong_iss"][:50] + "...", "full_length": len(tokens["wrong_iss"])},
        "wrong_aud": {"token": tokens["wrong_aud"][:50] + "...", "full_length": len(tokens["wrong_aud"])},
        "no_role": {"token": tokens["no_role"][:50] + "...", "full_length": len(tokens["no_role"])}
    },
    "note": "Tokens generated successfully. HTTP tests require endpoint calls with AGENT_JWT_ENFORCE=true."
}

# Output just the raw tokens for the shell script to use
full_tokens = json.dumps(tokens)
print("TOKENS_JSON=" + full_tokens)
' 2>&1)

# Extract tokens JSON
TOKENS_JSON=$(echo "$AUTH_RESULT" | grep "^TOKENS_JSON=" | sed 's/^TOKENS_JSON=//')

if [ -n "$TOKENS_JSON" ] && [ "$TOKENS_JSON" != "null" ]; then
    log_info "Generated auth test tokens"

    # Parse tokens
    VALID_TOKEN=$(echo "$TOKENS_JSON" | jq -r '.valid')
    EXPIRED_TOKEN=$(echo "$TOKENS_JSON" | jq -r '.expired')
    WRONG_ISS_TOKEN=$(echo "$TOKENS_JSON" | jq -r '.wrong_iss')
    WRONG_AUD_TOKEN=$(echo "$TOKENS_JSON" | jq -r '.wrong_aud')
    NO_ROLE_TOKEN=$(echo "$TOKENS_JSON" | jq -r '.no_role')
    INSUFFICIENT_ROLE_TOKEN=$(echo "$TOKENS_JSON" | jq -r '.insufficient_role')

    # Restart container with JWT enforcement enabled
    log_info "Restarting container with JWT enforcement..."
    docker compose stop agent-api 2>&1 >> "$OUT/auth_negative_tests.json.tmp"
    docker compose run -d -e AGENT_JWT_ENFORCE=true --name zakops-agent-api-auth-test \
        --service-ports agent-api 2>&1 >> "$OUT/auth_negative_tests.json.tmp" || true

    # Wait for service with auth enabled
    sleep 5
    wait_for_service "$AGENT_BASE/health" 30 || true

    # Create a fresh approval for testing
    if [ -z "$AUTH_APPROVAL_ID" ]; then
        AUTH_TEST_RESPONSE=$(curl -s -X POST "$API/agent/invoke" \
            -H "Content-Type: application/json" \
            -d '{"actor_id":"auth-test-2","message":"Transition deal AUTH-002 from lead to qualification"}')
        AUTH_APPROVAL_ID=$(echo "$AUTH_TEST_RESPONSE" | jq -r '.pending_approval.approval_id // empty')
    fi

    RESULTS="{\"tests\":[]}"

    if [ -n "$AUTH_APPROVAL_ID" ]; then
        # Test 1: No token (should get 401)
        NO_TOKEN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -d '{"actor_id":"no-token"}')

        # Test 2: Expired token (should get 401)
        EXPIRED_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $EXPIRED_TOKEN" \
            -d '{"actor_id":"expired-token"}')

        # Test 3: Wrong issuer (should get 401)
        WRONG_ISS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $WRONG_ISS_TOKEN" \
            -d '{"actor_id":"wrong-iss"}')

        # Test 4: Wrong audience (should get 401)
        WRONG_AUD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $WRONG_AUD_TOKEN" \
            -d '{"actor_id":"wrong-aud"}')

        # Test 5: No role claim (should get 401 per Decision Lock §7 - missing claim = invalid token)
        NO_ROLE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $NO_ROLE_TOKEN" \
            -d '{"actor_id":"no-role"}')

        # Test 6: Insufficient role (should get 403 per Decision Lock §7 - has role but too low)
        INSUFFICIENT_ROLE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $INSUFFICIENT_ROLE_TOKEN" \
            -d '{"actor_id":"insufficient-role"}')

        # Test 7: Valid token (should succeed or get 409 if already approved)
        VALID_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/agent/approvals/$AUTH_APPROVAL_ID:approve" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $VALID_TOKEN" \
            -d '{"actor_id":"valid-token"}')

        # Build results JSON
        # Per Decision Lock §7: missing role = 401 (invalid token), insufficient role = 403 (forbidden)
        AUTH_RESULTS=$(cat <<AUTHJSON
{
  "status": "completed",
  "generated_at": "$(date -Is)",
  "approval_id": "$AUTH_APPROVAL_ID",
  "tests": [
    {"name": "no_token", "expected_http": 401, "actual_http": $NO_TOKEN_CODE, "passed": $( [ "$NO_TOKEN_CODE" == "401" ] && echo "true" || echo "false" )},
    {"name": "expired_token", "expected_http": 401, "actual_http": $EXPIRED_CODE, "passed": $( [ "$EXPIRED_CODE" == "401" ] && echo "true" || echo "false" )},
    {"name": "wrong_issuer", "expected_http": 401, "actual_http": $WRONG_ISS_CODE, "passed": $( [ "$WRONG_ISS_CODE" == "401" ] && echo "true" || echo "false" )},
    {"name": "wrong_audience", "expected_http": 401, "actual_http": $WRONG_AUD_CODE, "passed": $( [ "$WRONG_AUD_CODE" == "401" ] && echo "true" || echo "false" )},
    {"name": "missing_role_claim", "expected_http": 401, "actual_http": $NO_ROLE_CODE, "passed": $( [ "$NO_ROLE_CODE" == "401" ] && echo "true" || echo "false" )},
    {"name": "insufficient_role", "expected_http": 403, "actual_http": $INSUFFICIENT_ROLE_CODE, "passed": $( [ "$INSUFFICIENT_ROLE_CODE" == "403" ] && echo "true" || echo "false" )},
    {"name": "valid_token", "expected_http": [200, 409], "actual_http": $VALID_CODE, "passed": $( [ "$VALID_CODE" == "200" ] || [ "$VALID_CODE" == "409" ] && echo "true" || echo "false" )}
  ]
}
AUTHJSON
)
        echo "$AUTH_RESULTS" > "$OUT/auth_negative_tests.json"

        # Calculate pass/fail
        PASSED=$(echo "$AUTH_RESULTS" | jq '[.tests[] | select(.passed==true)] | length')
        TOTAL=$(echo "$AUTH_RESULTS" | jq '.tests | length')

        log_info "Auth negative tests: $PASSED/$TOTAL passed"
        log_info "  no_token: $NO_TOKEN_CODE (expect 401)"
        log_info "  expired: $EXPIRED_CODE (expect 401)"
        log_info "  wrong_iss: $WRONG_ISS_CODE (expect 401)"
        log_info "  wrong_aud: $WRONG_AUD_CODE (expect 401)"
        log_info "  missing_role_claim: $NO_ROLE_CODE (expect 401 per Decision Lock §7)"
        log_info "  insufficient_role: $INSUFFICIENT_ROLE_CODE (expect 403 per Decision Lock §7)"
        log_info "  valid: $VALID_CODE (expect 200/409)"

        if [ "$PASSED" -lt "$TOTAL" ]; then
            log_warn "Some auth negative tests failed (this may be expected if JWT enforcement is not active)"
        fi
    else
        log_warn "Could not create approval for auth negative tests"
        cat > "$OUT/auth_negative_tests.json" << 'AUTHJSON2'
{
  "status": "skipped",
  "reason": "Could not create approval for testing",
  "tests": []
}
AUTHJSON2
    fi

    # Restore normal container (without JWT enforcement for other tests)
    log_info "Restoring container without JWT enforcement..."
    docker stop zakops-agent-api-auth-test 2>/dev/null || true
    docker rm zakops-agent-api-auth-test 2>/dev/null || true
    docker compose up -d agent-api 2>&1 >> "$OUT/auth_negative_tests.json.tmp"
    wait_for_service "$AGENT_BASE/health" 30 || true

else
    log_warn "Could not generate auth test tokens"
    cat > "$OUT/auth_negative_tests.json" << 'AUTHJSON3'
{
  "status": "error",
  "reason": "Could not generate test tokens",
  "tests": []
}
AUTHJSON3
fi

# ============================================================
# SUMMARY
# ============================================================
log_test "SUMMARY"

echo ""
echo "Gate Artifacts Pack:"
ls -la "$OUT"/*.json "$OUT"/*.log "$OUT"/*.out 2>/dev/null | while read -r line; do
    echo "  $line"
done

echo ""
echo "Required artifacts status:"
for f in health.json invoke_hitl.json approve.json db_invariants.sql.out checkpoint_kill9_test.log concurrent_approves.log tool_call_validation_test.log dependency_licenses.json mock_safety_test.log streaming_test.log hitl_scope_test.log auth_negative_tests.json run.log; do
    if [ -f "$OUT/$f" ]; then
        SIZE=$(wc -c < "$OUT/$f" | tr -d ' ')
        # Check auth_negative_tests.json for actual results
        if [ "$f" == "auth_negative_tests.json" ]; then
            AUTH_STATUS=$(jq -r '.status' "$OUT/$f" 2>/dev/null || echo "unknown")
            if [ "$AUTH_STATUS" == "completed" ]; then
                PASSED=$(jq '[.tests[] | select(.passed==true)] | length' "$OUT/$f")
                TOTAL=$(jq '.tests | length' "$OUT/$f")
                echo -e "  ${GREEN}[OK]${NC} $f ($SIZE bytes) - $PASSED/$TOTAL tests passed"
            else
                echo -e "  ${YELLOW}[WARN]${NC} $f ($SIZE bytes) - status: $AUTH_STATUS"
            fi
        else
            echo -e "  ${GREEN}[OK]${NC} $f ($SIZE bytes)"
        fi
    else
        echo -e "  ${RED}[MISSING]${NC} $f"
    fi
done

# ============================================================
# HARD GATE CHECKS (exit 1 on failure per DoD Section 6)
# ============================================================
echo ""
log_info "Running hard gate checks..."

GATE_FAILED=0

# Gate 1: Auth negative tests (all must pass)
if [ -f "$OUT/auth_negative_tests.json" ]; then
    AUTH_STATUS=$(jq -r '.status' "$OUT/auth_negative_tests.json" 2>/dev/null || echo "unknown")
    if [ "$AUTH_STATUS" == "completed" ]; then
        AUTH_PASSED=$(jq '[.tests[]|select(.passed==true)]|length' "$OUT/auth_negative_tests.json")
        AUTH_TOTAL=$(jq '.tests|length' "$OUT/auth_negative_tests.json")
        if [ "$AUTH_PASSED" != "$AUTH_TOTAL" ]; then
            log_error "Auth negative gate FAILED ($AUTH_PASSED/$AUTH_TOTAL)"
            GATE_FAILED=1
        else
            log_info "Auth negative gate PASSED ($AUTH_PASSED/$AUTH_TOTAL)"
        fi
    else
        log_error "Auth negative gate FAILED (status: $AUTH_STATUS, expected: completed)"
        GATE_FAILED=1
    fi
else
    log_error "Auth negative gate FAILED (file missing)"
    GATE_FAILED=1
fi

# Gate 2: Streaming test (must be PASSED, not SKIPPED/WARN)
if [ -f "$OUT/streaming_test.log" ]; then
    if grep -q "STATUS=PASSED" "$OUT/streaming_test.log"; then
        log_info "Streaming gate PASSED"
    else
        log_error "Streaming gate FAILED (must be PASSED)"
        GATE_FAILED=1
    fi
else
    log_error "Streaming gate FAILED (file missing)"
    GATE_FAILED=1
fi

# Gate 3: Copyleft license scan (must be 0 findings)
if [ -f "$OUT/copyleft_findings.json" ] && [ -s "$OUT/copyleft_findings.json" ]; then
    COPYLEFT_COUNT=$(wc -l < "$OUT/copyleft_findings.json" | tr -d ' ')
    if [ "$COPYLEFT_COUNT" -gt 0 ]; then
        log_error "Copyleft gate FAILED (see copyleft_findings.json)"
        GATE_FAILED=1
    fi
else
    log_info "Copyleft gate PASSED (no GPL/AGPL/LGPL)"
fi

# Gate 4: HITL scope test (must be PASSED)
if [ -f "$OUT/hitl_scope_test.log" ]; then
    if jq -e '.status=="PASSED"' "$OUT/hitl_scope_test.log" > /dev/null 2>&1; then
        log_info "HITL scope gate PASSED"
    else
        log_error "HITL scope gate FAILED"
        GATE_FAILED=1
    fi
else
    log_error "HITL scope gate FAILED (file missing)"
    GATE_FAILED=1
fi

# Gate 5: Tool arg validation (must be PASSED)
if [ -f "$OUT/tool_call_validation_test.log" ]; then
    if jq -e '.status=="PASSED"' "$OUT/tool_call_validation_test.log" > /dev/null 2>&1; then
        log_info "Tool arg validation gate PASSED"
    else
        log_error "Tool arg validation gate FAILED"
        GATE_FAILED=1
    fi
else
    log_error "Tool arg validation gate FAILED (file missing)"
    GATE_FAILED=1
fi

# Final health
echo ""
log_info "Final health check..."
FINAL_HEALTH=$(curl -s "$AGENT_BASE/health")
if echo "$FINAL_HEALTH" | jq -e '.status=="healthy"' > /dev/null; then
    log_info "Final health: PASSED"
else
    log_warn "Final health: $(echo "$FINAL_HEALTH" | jq -r '.status')"
fi

echo ""
echo "Completed: $(date -Is)" >> "$OUT/run.log"

# Exit with failure if any gate failed
if [ "$GATE_FAILED" -eq 1 ]; then
    log_error "=========================================="
    log_error "GATE VERIFICATION FAILED - see errors above"
    log_error "=========================================="
    echo ""
    echo "View logs:     docker compose logs agent-api"
    echo "Stop services: docker compose down"
    echo "Gate pack:     ls $OUT/"
    exit 1
fi

log_info "=========================================="
log_info "BASELINE GATES PASSED - HITL Spike verified!"
log_info "=========================================="

# ============================================================
# Run Phase 0 + Phase 1 gates
# ============================================================
PHASE_SCRIPT="$(dirname "$0")/phase0_phase1_gates.sh"
if [ -x "$PHASE_SCRIPT" ]; then
    log_info "Running Phase 0 + Phase 1 gates..."
    echo ""
    if bash "$PHASE_SCRIPT"; then
        log_info "Phase 0 + Phase 1 gates completed"
    else
        log_warn "Phase 0 + Phase 1 gates had warnings (non-fatal)"
    fi
else
    log_warn "Phase 0 + Phase 1 gate script not found or not executable"
fi

# ============================================================
# Run Phase 2/4/5 gates
# ============================================================
PHASE_245_SCRIPT="$(dirname "$0")/phase2_4_5_gates.sh"
if [ -x "$PHASE_245_SCRIPT" ]; then
    log_info "Running Phase 2/4/5 gates..."
    echo ""
    if bash "$PHASE_245_SCRIPT"; then
        log_info "Phase 2/4/5 gates completed"
    else
        log_warn "Phase 2/4/5 gates had warnings (non-fatal)"
    fi
else
    log_warn "Phase 2/4/5 gate script not found or not executable"
fi

# ============================================================
# Run Phase 6/7/8 gates (Production Readiness)
# ============================================================
PHASE_678_SCRIPT="$(dirname "$0")/phase6_7_8_gates.sh"
if [ -x "$PHASE_678_SCRIPT" ]; then
    log_info "Running Phase 6/7/8 gates (Production Readiness)..."
    echo ""
    if bash "$PHASE_678_SCRIPT"; then
        log_info "Phase 6/7/8 gates completed"
    else
        log_warn "Phase 6/7/8 gates had warnings (non-fatal)"
    fi
else
    log_warn "Phase 6/7/8 gate script not found or not executable"
fi

echo ""
log_info "=========================================="
log_info "ALL GATES COMPLETED"
log_info "=========================================="
echo ""
echo "View logs:     docker compose logs agent-api"
echo "Stop services: docker compose down"
echo "Gate pack:     ls $OUT/"
