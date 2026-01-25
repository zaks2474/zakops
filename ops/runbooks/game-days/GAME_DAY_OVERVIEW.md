# Game Day Overview

Game Days are scheduled chaos engineering exercises to validate system resilience and team response procedures.

## Purpose

1. **Validate resilience** - Confirm systems degrade gracefully under failure
2. **Test monitoring** - Verify alerts fire and are actionable
3. **Practice response** - Train team on incident procedures
4. **Identify gaps** - Find weaknesses before production incidents

## Scenarios

| ID | Name | Fault | Expected Behavior |
|----|------|-------|-------------------|
| GD1 | Database Failure | PostgreSQL stops | Queue writes, recover on restart |
| GD2 | LLM Unavailable | vLLM/Ollama stops | Structured 503, no raw 500 |
| GD3 | Redis Failure | Redis stops | Graceful degradation, continue without cache |
| GD4 | Network Partition | External blocked | Internal operations continue |
| GD5 | High Latency | 5s delay | Timeouts, circuit breakers activate |
| GD6 | Memory Pressure | Container limit | OOM handled, container restarts |

## Safe vs Full Scenarios

**Safe scenarios** (GD2, GD3) can be run in CI/development without risk of data loss. They test graceful degradation without affecting persistent state.

**Full scenarios** (GD1, GD4-GD6) require more careful coordination and should typically be run in isolated environments or during maintenance windows.

## Running Game Days

### Single Scenario
```bash
python3 tools/chaos/game_day_runner.py --scenario gd2
```

### Safe Scenarios (Default)
```bash
python3 tools/chaos/game_day_runner.py
# Runs gd2 and gd3
```

### Full Suite
```bash
python3 tools/chaos/game_day_runner.py --full
```

### Via Make
```bash
make game-day                    # Safe scenarios
make game-day SCENARIO=gd1      # Specific scenario
FULL=1 make game-day            # All scenarios
```

## Pre-Game Day Checklist

- [ ] Notify team of scheduled game day
- [ ] Ensure monitoring dashboards are accessible
- [ ] Verify backup was taken recently
- [ ] Confirm rollback procedures are documented
- [ ] Have communication channel ready (Slack, etc.)

## During Game Day

1. **Capture baseline** - Record current metrics before fault injection
2. **Inject fault** - Run the scenario script
3. **Observe** - Monitor dashboards, alerts, logs
4. **Measure**:
   - Time to detect (how long until we knew something was wrong?)
   - Time to recover (how long to restore service?)
   - Error rate during incident
5. **Rollback** - Restore normal operation
6. **Verify** - Confirm full recovery

## Post-Game Day

1. Review generated artifacts in `artifacts/chaos/`
2. Document findings in runbook updates
3. Create tickets for any gaps identified
4. Update monitoring/alerts as needed

## Artifacts

Each game day produces JSON artifacts:
- `artifacts/chaos/game_day_<scenario>_<timestamp>.json` - Individual results
- `artifacts/chaos/game_day_summary_<timestamp>.json` - Summary report

## Success Criteria

A game day scenario passes when:
1. No raw 500 errors (graceful degradation)
2. Recovery happens within expected timeframe
3. No data corruption or loss
4. Alerts fired appropriately
