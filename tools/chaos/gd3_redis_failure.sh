#!/bin/bash
# Game Day 3: Redis Failure
# Simulates Redis failure and tests graceful degradation

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

SCENARIO_ID="gd3_redis_failure"

log_info "=========================================="
log_info "Game Day 3: Redis Failure"
log_info "=========================================="

# Capture baseline
log_step "1. Capturing baseline metrics..."
BASELINE_FILE=$(capture_baseline)

START_TIME=$(date +%s)

# Inject fault: Stop Redis
log_step "2. Injecting fault: Stopping Redis..."
docker stop zakops-redis 2>/dev/null || {
    log_warn "Could not stop zakops-redis (may not be running)"
}

FAULT_TIME=$(date +%s)

# Test graceful degradation
log_step "3. Testing graceful degradation..."
DETECTION_START=$(date +%s)

GRACEFUL=true
for i in {1..10}; do
    sleep 1

    RESPONSE=$(curl -sf -w "\n%{http_code}" --max-time 5 "http://localhost:8091/health" 2>/dev/null || echo -e "\n000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    # Redis failure should result in degraded mode, not complete failure
    case "$HTTP_CODE" in
        200)
            log_info "Request $i: HTTP 200 (service operational without cache)"
            ;;
        503|502)
            log_info "Request $i: HTTP ${HTTP_CODE} (graceful degradation)"
            ;;
        500)
            log_error "Request $i: HTTP 500 (raw error - NOT graceful)"
            GRACEFUL=false
            ;;
        000)
            log_warn "Request $i: Connection refused"
            ;;
        *)
            log_warn "Request $i: HTTP ${HTTP_CODE}"
            ;;
    esac
done

DETECTION_TIME=$(($(date +%s) - DETECTION_START))

# Rollback: Restart Redis
log_step "4. Rolling back: Restarting Redis..."
docker start zakops-redis 2>/dev/null || true

ROLLBACK_TIME=$(date +%s)

# Wait for recovery
log_step "5. Waiting for recovery..."
RECOVERY_START=$(date +%s)

if wait_recovery "http://localhost:8091/health" 60; then
    RECOVERY_TIME=$(($(date +%s) - RECOVERY_START))
    STATUS="passed"
else
    RECOVERY_TIME=-1
    STATUS="partial"
fi

if [[ "$GRACEFUL" == "false" ]]; then
    STATUS="failed"
fi

# Generate report
log_step "6. Generating report..."
NOTES="Redis failure simulation. Graceful degradation: ${GRACEFUL}"
REPORT_FILE=$(generate_report "$SCENARIO_ID" "$STATUS" "$DETECTION_TIME" "$RECOVERY_TIME" "$NOTES")

log_info "=========================================="
log_info "Game Day 3 Complete"
log_info "Status: ${STATUS}"
log_info "Report: ${REPORT_FILE}"
log_info "=========================================="

[[ "$STATUS" == "passed" ]] && exit 0 || exit 1
