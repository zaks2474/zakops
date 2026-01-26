#!/usr/bin/env bash
# ZakOps E2E System Validation - Master Gate
# Executes all 9 validation phases and generates final report
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts/validation"

# Ensure artifacts directory exists
mkdir -p "$ARTIFACTS_DIR"

# Start time
START_TIME=$(date +%s)
START_TIMESTAMP=$(date -Iseconds)

echo "========================================================"
echo "  ZakOps E2E System Validation - Master Gate"
echo "========================================================"
echo ""
echo "Root Directory: $ROOT_DIR"
echo "Artifacts: $ARTIFACTS_DIR"
echo "Start Time: $START_TIMESTAMP"
echo ""

# Track phase results
declare -A PHASE_RESULTS
declare -A PHASE_TIMES
TOTAL_PASSED=0
TOTAL_FAILED=0

run_phase() {
    local phase_num="$1"
    local phase_name="$2"
    local script_name="$3"

    echo "========================================================"
    echo "  Phase $phase_num: $phase_name"
    echo "========================================================"
    echo ""

    local phase_start=$(date +%s)

    if [[ ! -f "$SCRIPT_DIR/$script_name" ]]; then
        echo "ERROR: Script not found: $script_name"
        PHASE_RESULTS[$phase_num]="FAIL"
        PHASE_TIMES[$phase_num]="0"
        ((TOTAL_FAILED++))
        return 1
    fi

    chmod +x "$SCRIPT_DIR/$script_name"

    if bash "$SCRIPT_DIR/$script_name"; then
        PHASE_RESULTS[$phase_num]="PASS"
        ((TOTAL_PASSED++))
    else
        PHASE_RESULTS[$phase_num]="FAIL"
        ((TOTAL_FAILED++))
    fi

    local phase_end=$(date +%s)
    PHASE_TIMES[$phase_num]=$((phase_end - phase_start))

    echo ""
}

# Run all phases
run_phase 0 "Baseline Service Health" "phase0_service_health.sh"
run_phase 1 "Integration Contract Verification" "phase1_integration.sh"
run_phase 2 "Tool Execution Validation" "phase2_tools.sh"
run_phase 3 "Human-in-the-Loop (HITL) Verification" "phase3_hitl.sh"
run_phase 4 "Dashboard-Agent Synchronization" "phase4_dashboard_sync.sh"
run_phase 5 "Agent Intelligence Validation" "phase5_intelligence.sh"
run_phase 6 "Graph Execution Validation" "phase6_graphs.sh"
run_phase 7 "Adversarial Testing" "phase7_adversarial.sh"
run_phase 8 "Double Verification (Skeptic Pass)" "phase8_double_verify.sh"

# Calculate total time
END_TIME=$(date +%s)
END_TIMESTAMP=$(date -Iseconds)
TOTAL_TIME=$((END_TIME - START_TIME))

# Determine overall verdict
if [[ $TOTAL_FAILED -eq 0 ]]; then
    VERDICT="SYSTEM VALIDATED"
    EXIT_CODE=0
else
    VERDICT="SYSTEM VALIDATION FAILED"
    EXIT_CODE=1
fi

echo ""
echo "========================================================"
echo "  VALIDATION SUMMARY"
echo "========================================================"
echo ""
echo "Overall Verdict: $VERDICT"
echo ""
echo "Phase Results:"
for phase in 0 1 2 3 4 5 6 7 8; do
    result="${PHASE_RESULTS[$phase]:-UNKNOWN}"
    time="${PHASE_TIMES[$phase]:-0}"
    printf "  Phase %d: %-6s (%ds)\n" "$phase" "$result" "$time"
done
echo ""
echo "Phases Passed: $TOTAL_PASSED / 9"
echo "Phases Failed: $TOTAL_FAILED / 9"
echo "Total Duration: ${TOTAL_TIME}s"
echo ""

# Build phase results JSON
PHASE_RESULTS_JSON=""
for phase in 0 1 2 3 4 5 6 7 8; do
    result="${PHASE_RESULTS[$phase]:-UNKNOWN}"
    time="${PHASE_TIMES[$phase]:-0}"
    artifact_file="$ARTIFACTS_DIR/phase${phase}_*.json"
    artifact=$(ls $artifact_file 2>/dev/null | head -1 || echo "")
    artifact_name=$(basename "$artifact" 2>/dev/null || echo "not_found")

    PHASE_RESULTS_JSON="$PHASE_RESULTS_JSON
    {
      \"phase\": $phase,
      \"result\": \"$result\",
      \"duration_seconds\": $time,
      \"artifact\": \"$artifact_name\"
    },"
done
# Remove trailing comma
PHASE_RESULTS_JSON="${PHASE_RESULTS_JSON%,}"

# Generate final report
cat > "$ARTIFACTS_DIR/VALIDATION_FINAL_REPORT.json" << EOF
{
  "validation_run": {
    "start_time": "$START_TIMESTAMP",
    "end_time": "$END_TIMESTAMP",
    "duration_seconds": $TOTAL_TIME
  },
  "verdict": "$VERDICT",
  "summary": {
    "total_phases": 9,
    "phases_passed": $TOTAL_PASSED,
    "phases_failed": $TOTAL_FAILED,
    "pass_rate": "$(python3 -c "print(f'{$TOTAL_PASSED/9*100:.1f}%')" 2>/dev/null || echo 'N/A')"
  },
  "phases": [$PHASE_RESULTS_JSON
  ],
  "artifacts": {
    "phase0": "phase0_service_health.json",
    "phase1": "phase1_integration.json",
    "phase2": "phase2_tools.json",
    "phase3": "phase3_hitl.json",
    "phase4": "phase4_dashboard_sync.json",
    "phase5": "phase5_intelligence.json",
    "phase6": "phase6_graphs.json",
    "phase7": "phase7_adversarial.json",
    "phase8": "phase8_double_verify.json",
    "final_report": "VALIDATION_FINAL_REPORT.json"
  },
  "environment": {
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "working_directory": "$ROOT_DIR"
  }
}
EOF

echo "Final Report: $ARTIFACTS_DIR/VALIDATION_FINAL_REPORT.json"
echo ""

# List all artifacts
echo "Evidence Artifacts:"
ls -la "$ARTIFACTS_DIR"/*.json 2>/dev/null | while read line; do
    echo "  $line"
done

echo ""
echo "========================================================"
if [[ $EXIT_CODE -eq 0 ]]; then
    echo "  ✓ SYSTEM VALIDATED - All 9 phases passed"
else
    echo "  ✗ VALIDATION FAILED - $TOTAL_FAILED phase(s) failed"
fi
echo "========================================================"

exit $EXIT_CODE
