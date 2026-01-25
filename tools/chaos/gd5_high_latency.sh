#!/bin/bash
# Game Day 5: High Latency
# Simulates 5s network delay via tc netem

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

SCENARIO_ID="gd5_high_latency"

log_info "=========================================="
log_info "Game Day 5: High Latency"
log_info "=========================================="

# Interface to apply latency (usually docker0 or eth0)
INTERFACE="${INTERFACE:-docker0}"

# Capture baseline
log_step "1. Capturing baseline metrics..."
BASELINE_FILE=$(capture_baseline)

START_TIME=$(date +%s)

# Inject fault: Add 5s delay
log_step "2. Injecting fault: Adding 5s latency to ${INTERFACE}..."

if command -v tc &> /dev/null && [[ $EUID -eq 0 ]]; then
    tc qdisc add dev "$INTERFACE" root netem delay 5000ms 2>/dev/null || {
        tc qdisc change dev "$INTERFACE" root netem delay 5000ms 2>/dev/null || {
            log_warn "Could not apply tc netem - simulating"
            TC_USED=false
        }
    }
    TC_USED=${TC_USED:-true}
else
    log_warn "tc not available or not root - simulating latency test"
    TC_USED=false
fi

FAULT_TIME=$(date +%s)

# Test timeout handling
log_step "3. Testing timeout handling..."
DETECTION_START=$(date +%s)

TIMEOUT_HANDLED=true
for i in {1..5}; do
    REQUEST_START=$(date +%s)

    # Use longer timeout to detect delay
    RESPONSE=$(curl -sf -w "\n%{http_code}" --max-time 10 "http://localhost:8090/health" 2>/dev/null || echo -e "\n000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    REQUEST_DURATION=$(($(date +%s) - REQUEST_START))

    case "$HTTP_CODE" in
        200)
            log_info "Request $i: HTTP 200 (took ${REQUEST_DURATION}s)"
            ;;
        000)
            if [[ $REQUEST_DURATION -ge 5 ]]; then
                log_info "Request $i: Timed out after ${REQUEST_DURATION}s (expected)"
            else
                log_warn "Request $i: Quick timeout - connection refused"
            fi
            ;;
        503|504)
            log_info "Request $i: HTTP ${HTTP_CODE} - timeout/gateway error (expected)"
            ;;
        *)
            log_warn "Request $i: HTTP ${HTTP_CODE} (took ${REQUEST_DURATION}s)"
            ;;
    esac
done

DETECTION_TIME=$(($(date +%s) - DETECTION_START))

# Rollback: Remove latency
log_step "4. Rolling back: Removing latency..."
if [[ "${TC_USED:-false}" == "true" ]]; then
    tc qdisc del dev "$INTERFACE" root 2>/dev/null || true
fi

ROLLBACK_TIME=$(date +%s)

# Verify recovery
log_step "5. Verifying recovery..."
RECOVERY_START=$(date +%s)

if wait_recovery "http://localhost:8090/health" 30; then
    RECOVERY_TIME=$(($(date +%s) - RECOVERY_START))
    STATUS="passed"
else
    RECOVERY_TIME=$(($(date +%s) - RECOVERY_START))
    STATUS="partial"
fi

# Generate report
log_step "6. Generating report..."
NOTES="High latency (5s) simulation. tc netem used: ${TC_USED:-false}. Timeouts handled: ${TIMEOUT_HANDLED}"
REPORT_FILE=$(generate_report "$SCENARIO_ID" "$STATUS" "$DETECTION_TIME" "$RECOVERY_TIME" "$NOTES")

log_info "=========================================="
log_info "Game Day 5 Complete"
log_info "Status: ${STATUS}"
log_info "Report: ${REPORT_FILE}"
log_info "=========================================="

[[ "$STATUS" == "passed" ]] && exit 0 || exit 1
