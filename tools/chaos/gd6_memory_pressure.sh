#!/bin/bash
# Game Day 6: Memory Pressure
# Simulates memory exhaustion and OOM handling

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

SCENARIO_ID="gd6_memory_pressure"

log_info "=========================================="
log_info "Game Day 6: Memory Pressure"
log_info "=========================================="

# Target container for memory limit
TARGET_CONTAINER="${TARGET_CONTAINER:-zakops-api}"

# Capture baseline
log_step "1. Capturing baseline metrics..."
BASELINE_FILE=$(capture_baseline)

START_TIME=$(date +%s)

# Inject fault: Limit container memory
log_step "2. Injecting fault: Applying memory pressure..."

# Method 1: Update container memory limit (requires docker update)
MEMORY_LIMIT="128m"

if docker update --memory "$MEMORY_LIMIT" "$TARGET_CONTAINER" 2>/dev/null; then
    log_info "Applied ${MEMORY_LIMIT} memory limit to ${TARGET_CONTAINER}"
    MEMORY_LIMITED=true
else
    log_warn "Could not limit container memory - simulating stress"
    MEMORY_LIMITED=false

    # Method 2: Run stress test inside container (if available)
    docker exec "$TARGET_CONTAINER" stress --vm 1 --vm-bytes 100M --timeout 30s 2>/dev/null &
    STRESS_PID=$!
fi

FAULT_TIME=$(date +%s)

# Monitor for OOM and recovery
log_step "3. Monitoring for OOM handling..."
DETECTION_START=$(date +%s)

OOM_HANDLED=true
for i in {1..15}; do
    sleep 2

    # Check if container is still running
    if ! docker ps --format '{{.Names}}' | grep -q "^${TARGET_CONTAINER}$"; then
        log_warn "Container ${TARGET_CONTAINER} stopped (possible OOM)"

        # Check if it restarts
        sleep 5
        if docker ps --format '{{.Names}}' | grep -q "^${TARGET_CONTAINER}$"; then
            log_info "Container restarted - OOM handled"
        else
            log_error "Container did not restart"
            OOM_HANDLED=false
        fi
        break
    fi

    # Check health
    RESPONSE=$(curl -sf -w "\n%{http_code}" --max-time 5 "http://localhost:8091/health" 2>/dev/null || echo -e "\n000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    case "$HTTP_CODE" in
        200)
            log_info "Check $i: Service healthy under memory pressure"
            ;;
        503|502)
            log_info "Check $i: Service degraded (HTTP ${HTTP_CODE})"
            ;;
        000)
            log_warn "Check $i: Service unreachable"
            ;;
        *)
            log_info "Check $i: HTTP ${HTTP_CODE}"
            ;;
    esac
done

DETECTION_TIME=$(($(date +%s) - DETECTION_START))

# Rollback: Remove memory limit
log_step "4. Rolling back: Removing memory pressure..."

if [[ "${MEMORY_LIMITED:-false}" == "true" ]]; then
    # Remove memory limit (set to 0 = unlimited)
    docker update --memory 0 "$TARGET_CONTAINER" 2>/dev/null || true
fi

# Kill stress process if running
kill $STRESS_PID 2>/dev/null || true

ROLLBACK_TIME=$(date +%s)

# Verify recovery
log_step "5. Verifying recovery..."
RECOVERY_START=$(date +%s)

if wait_recovery "http://localhost:8091/health" 60; then
    RECOVERY_TIME=$(($(date +%s) - RECOVERY_START))
    STATUS="passed"
else
    RECOVERY_TIME=$(($(date +%s) - RECOVERY_START))
    STATUS="partial"
fi

if [[ "$OOM_HANDLED" == "false" ]]; then
    STATUS="failed"
fi

# Generate report
log_step "6. Generating report..."
NOTES="Memory pressure simulation. Memory limited: ${MEMORY_LIMITED:-false}. OOM handled: ${OOM_HANDLED}"
REPORT_FILE=$(generate_report "$SCENARIO_ID" "$STATUS" "$DETECTION_TIME" "$RECOVERY_TIME" "$NOTES")

log_info "=========================================="
log_info "Game Day 6 Complete"
log_info "Status: ${STATUS}"
log_info "Report: ${REPORT_FILE}"
log_info "=========================================="

[[ "$STATUS" == "passed" ]] && exit 0 || exit 1
