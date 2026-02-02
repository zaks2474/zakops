#!/bin/bash
# Game Day 1: Database Failure
# Simulates PostgreSQL failure and tests recovery

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

SCENARIO_ID="gd1_db_failure"

log_info "=========================================="
log_info "Game Day 1: Database Failure"
log_info "=========================================="

# Capture baseline
log_step "1. Capturing baseline metrics..."
BASELINE_FILE=$(capture_baseline)
log_info "Baseline saved to: ${BASELINE_FILE}"

# Record start time
START_TIME=$(date +%s)

# Inject fault: Stop PostgreSQL
log_step "2. Injecting fault: Stopping PostgreSQL..."
docker stop zakops-postgres 2>/dev/null || {
    log_warn "Could not stop zakops-postgres (may not be running)"
}

FAULT_TIME=$(date +%s)

# Measure detection time
log_step "3. Measuring detection time..."
DETECTION_START=$(date +%s)

for i in {1..10}; do
    sleep 1
    if ! verify_graceful_degradation "http://localhost:8091/health"; then
        log_error "Non-graceful failure detected"
    fi
done

DETECTION_TIME=$(($(date +%s) - DETECTION_START))
log_info "Detection completed in ${DETECTION_TIME}s"

# Verify graceful degradation
log_step "4. Verifying graceful degradation..."
ERROR_RATE=$(check_error_rate "http://localhost:8091/health" 5)
log_info "Error rate during fault: ${ERROR_RATE}/5 requests"

# Rollback: Restart PostgreSQL
log_step "5. Rolling back: Restarting PostgreSQL..."
docker start zakops-postgres 2>/dev/null || {
    log_warn "Could not start zakops-postgres"
}

ROLLBACK_TIME=$(date +%s)

# Wait for recovery
log_step "6. Waiting for recovery..."
RECOVERY_START=$(date +%s)

if wait_recovery "http://localhost:8091/health" 120; then
    RECOVERY_TIME=$(($(date +%s) - RECOVERY_START))
    log_info "Recovery completed in ${RECOVERY_TIME}s"
    STATUS="passed"
else
    RECOVERY_TIME=-1
    log_error "Recovery failed"
    STATUS="failed"
fi

# Verify recovery
log_step "7. Verifying recovery..."
sleep 5
FINAL_ERROR_RATE=$(check_error_rate "http://localhost:8091/health" 5)

if [[ $FINAL_ERROR_RATE -eq 0 ]]; then
    log_info "Service fully recovered: 0 errors"
else
    log_warn "Partial recovery: ${FINAL_ERROR_RATE}/5 errors"
    STATUS="partial"
fi

# Generate report
log_step "8. Generating report..."
REPORT_FILE=$(generate_report "$SCENARIO_ID" "$STATUS" "$DETECTION_TIME" "$RECOVERY_TIME" "Database failure simulation")

log_info "=========================================="
log_info "Game Day 1 Complete"
log_info "Status: ${STATUS}"
log_info "Detection time: ${DETECTION_TIME}s"
log_info "Recovery time: ${RECOVERY_TIME}s"
log_info "Report: ${REPORT_FILE}"
log_info "=========================================="

# Exit based on status
[[ "$STATUS" == "passed" ]] && exit 0 || exit 1
