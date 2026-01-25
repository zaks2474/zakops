#!/bin/bash
# Game Day 4: Network Partition
# Simulates external network unavailability

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

SCENARIO_ID="gd4_network_partition"

log_info "=========================================="
log_info "Game Day 4: Network Partition"
log_info "=========================================="

# Capture baseline
log_step "1. Capturing baseline metrics..."
BASELINE_FILE=$(capture_baseline)

START_TIME=$(date +%s)

# Inject fault: Block external network
log_step "2. Injecting fault: Blocking external network..."

# Use iptables to block external traffic (requires root)
# This is a simulation - in CI we may not have iptables access
if command -v iptables &> /dev/null && [[ $EUID -eq 0 ]]; then
    # Block outbound traffic except to local networks
    iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT
    iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT
    iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT
    iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
    iptables -A OUTPUT -j DROP
    IPTABLES_USED=true
else
    log_warn "iptables not available or not root - simulating partition"
    IPTABLES_USED=false
fi

FAULT_TIME=$(date +%s)

# Test internal operations continue
log_step "3. Verifying internal operations continue..."
DETECTION_START=$(date +%s)

INTERNAL_OK=true
for i in {1..10}; do
    sleep 1

    # Health check should work (internal)
    RESPONSE=$(curl -sf -w "\n%{http_code}" --max-time 5 "http://localhost:8090/health" 2>/dev/null || echo -e "\n000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    if [[ "$HTTP_CODE" == "200" ]]; then
        log_info "Request $i: Internal operations OK (HTTP 200)"
    elif [[ "$HTTP_CODE" == "000" ]]; then
        log_warn "Request $i: Connection issue"
        INTERNAL_OK=false
    else
        log_info "Request $i: HTTP ${HTTP_CODE}"
    fi
done

DETECTION_TIME=$(($(date +%s) - DETECTION_START))

# Rollback: Restore network
log_step "4. Rolling back: Restoring network..."
if [[ "${IPTABLES_USED:-false}" == "true" ]]; then
    iptables -F OUTPUT
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

if [[ "$INTERNAL_OK" == "false" ]]; then
    STATUS="failed"
fi

# Generate report
log_step "6. Generating report..."
NOTES="Network partition simulation. Internal ops maintained: ${INTERNAL_OK}. iptables used: ${IPTABLES_USED:-false}"
REPORT_FILE=$(generate_report "$SCENARIO_ID" "$STATUS" "$DETECTION_TIME" "$RECOVERY_TIME" "$NOTES")

log_info "=========================================="
log_info "Game Day 4 Complete"
log_info "Status: ${STATUS}"
log_info "Report: ${REPORT_FILE}"
log_info "=========================================="

[[ "$STATUS" == "passed" ]] && exit 0 || exit 1
