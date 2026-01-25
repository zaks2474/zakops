# ZakOps Runbook Index

Central index of all operational runbooks.

## Game Day Runbooks

| Runbook | Scenario | Severity |
|---------|----------|----------|
| [GAME_DAY_OVERVIEW](game-days/GAME_DAY_OVERVIEW.md) | Overview of game day procedures | - |
| [GD1_DB_FAILURE](game-days/GD1_DB_FAILURE.md) | Database failure and recovery | Critical |
| [GD2_LLM_UNAVAILABLE](game-days/GD2_LLM_UNAVAILABLE.md) | LLM service unavailable | High |
| [GD3_REDIS_FAILURE](game-days/GD3_REDIS_FAILURE.md) | Redis cache failure | Medium |
| [GD4_NETWORK_PARTITION](game-days/GD4_NETWORK_PARTITION.md) | External network unavailable | High |
| [GD5_HIGH_LATENCY](game-days/GD5_HIGH_LATENCY.md) | High network latency | High |
| [GD6_MEMORY_PRESSURE](game-days/GD6_MEMORY_PRESSURE.md) | Memory exhaustion | High |

## Restore Drills

| Runbook | Purpose |
|---------|---------|
| [RESTORE_DRILL_OVERVIEW](restore-drills/RESTORE_DRILL_OVERVIEW.md) | Database backup and restore procedures |

## Runbook Standards

All runbooks must include the following sections:

1. **Symptoms** - How to identify the issue
2. **Impact** - What is affected and severity
3. **Diagnosis** - Steps to confirm the issue
4. **Immediate Actions** - First response steps
5. **Rollback** - How to revert changes
6. **Verification** - Confirm resolution
7. **Escalation** - When and who to escalate to
8. **Postmortem** - Template for post-incident review

## Contributing

When adding a new runbook:
1. Copy the template from `RUNBOOK_TEMPLATE.md`
2. Fill in all required sections
3. Add entry to this index
4. Run `make runbooks-lint` to validate
5. Submit PR for review

## Validation

Runbooks are validated by `tools/quality/runbook_lint.py` which checks:
- All required sections present
- Links are valid
- Consistent formatting

Run validation:
```bash
make runbooks-lint
# or
python3 tools/quality/runbook_lint.py
```
