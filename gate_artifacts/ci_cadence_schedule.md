# CI Cadence Schedule

**Version:** 1.0.0
**Generated:** 2026-01-24T18:30:00-06:00
**Status:** P8-CADENCE-001 Implementation

## Overview

This document defines the continuous improvement cadence for the ZakOps Agent API.

## Weekly (Every Monday)

### Eval Refresh

**Purpose:** Keep evaluation metrics current and detect regressions early.

**Tasks:**
1. Run tool accuracy evaluation
   ```bash
   cd /home/zaks/zakops-agent-api
   python -m evals.tool_accuracy_eval
   ```

2. Run retrieval evaluation
   ```bash
   python -m evals.retrieval_eval
   ```

3. Update eval trend
   ```bash
   ./scripts/bring_up_tests.sh
   ```

4. Review trend for regressions
   - Check `gate_artifacts/eval_trend.csv`
   - Alert if accuracy drops >2% week-over-week

**Artifacts:**
- `tool_accuracy_eval.json`
- `retrieval_eval_results.json`
- `eval_trend.csv` (appended)

## Monthly (First Monday)

### Red-Team Rerun

**Purpose:** Verify security posture against evolving threats.

**Tasks:**
1. Update red-team test cases (if new attack vectors identified)

2. Run full red-team suite
   ```bash
   ./scripts/bring_up_tests.sh
   ```

3. Review `redteam_report.json`

4. Document any new attack vectors tested

5. Create tickets for any vulnerabilities found

**Artifacts:**
- `redteam_report.json`
- Security review notes (stored in security team docs)

### Dependency Audit

**Purpose:** Check for security vulnerabilities in dependencies.

**Tasks:**
1. Run license scan
   ```bash
   ./scripts/bring_up_tests.sh
   ```

2. Check for new CVEs
   ```bash
   pip-audit  # or safety check
   ```

3. Update dependencies if security fixes available

**Artifacts:**
- `dependency_licenses.json`
- CVE audit report

## Quarterly (First Monday of Quarter)

### Restore Drill

**Purpose:** Verify backup/restore procedures work correctly.

**Tasks:**
1. Schedule maintenance window

2. Run backup/restore drill
   ```bash
   ./scripts/bring_up_tests.sh
   ```

3. Verify `backup_restore_drill.log` shows PASSED

4. Document drill results and any issues

5. Update runbooks if procedures changed

**Artifacts:**
- `backup_restore_drill.log`
- Drill report (stored in ops docs)

### Performance Benchmark

**Purpose:** Track performance trends and identify optimization opportunities.

**Tasks:**
1. Run full benchmark suite
   ```bash
   ./scripts/bring_up_tests.sh
   ```

2. Compare against previous quarter's benchmarks

3. Check migration triggers
   - Review `migration_trigger_status.json`
   - Evaluate if migrations are needed

4. Document findings and recommendations

**Artifacts:**
- `benchmarks.json`
- `migration_trigger_status.json`
- Quarterly performance report

### Runbook Review

**Purpose:** Keep operational documentation current.

**Tasks:**
1. Review all runbooks for accuracy
2. Test runbook procedures (dry run)
3. Update contact information
4. Archive obsolete runbooks

**Artifacts:**
- Updated runbooks
- `runbook_lint.log`

## Annual

### Full Security Audit

**Purpose:** Comprehensive security review.

**Tasks:**
1. External penetration testing
2. Code security audit
3. Infrastructure security review
4. Compliance verification

### Disaster Recovery Test

**Purpose:** Full DR scenario test.

**Tasks:**
1. Complete system restore from backup
2. Failover testing
3. Recovery time verification

---

## Automation

### GitHub Actions (CI/CD)

```yaml
# Weekly eval refresh
name: Weekly Eval Refresh
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
jobs:
  eval:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/bring_up_tests.sh

# Monthly red-team
name: Monthly Red-Team
on:
  schedule:
    - cron: '0 10 1 * *'  # First day of month at 10 AM
jobs:
  redteam:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/bring_up_tests.sh
```

### Monitoring Alerts

Configure alerts for:
- Eval accuracy drops >2%
- Red-team failures (any attack not blocked)
- Backup drill failures
- Migration trigger thresholds reached

---

*Schedule last updated: see artifact timestamp*
