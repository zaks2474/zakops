# ZakOps Error Budget Policy

## Purpose

This document defines how ZakOps manages error budgets to balance reliability with feature development velocity.

## Error Budget States

### Green (> 50% remaining)

**Status**: Healthy

**Conditions**:
- More than 50% of monthly error budget remaining
- All SLOs within target

**Actions**:
- Normal development velocity
- Feature work prioritized
- Standard deployment cadence
- Regular monitoring review

### Yellow (25-50% remaining)

**Status**: Caution

**Conditions**:
- 25-50% of monthly error budget remaining
- SLOs approaching threshold

**Actions**:
- Increased monitoring frequency
- Review recent deployments for impact
- Prepare rollback plans for active changes
- Engineering lead notified
- Weekly budget review meetings

### Orange (10-25% remaining)

**Status**: Warning

**Conditions**:
- 10-25% of monthly error budget remaining
- One or more SLOs at risk

**Actions**:
- Pause non-critical deployments
- Focus engineering on reliability improvements
- Daily error budget reviews
- All deployments require reliability review
- Product/Engineering alignment on priorities

### Red (< 10% remaining)

**Status**: Critical

**Conditions**:
- Less than 10% of monthly error budget remaining
- SLO breach imminent or occurred

**Actions**:
- **Freeze all feature deployments**
- All hands on reliability work
- Incident response mode activated
- Hourly budget monitoring
- Executive notification
- Only critical security/reliability fixes deployed

## Budget Calculation

### API Error Budget

```
Monthly Minutes = 30 * 24 * 60 = 43,200 minutes
Error Budget (0.5%) = 216 minutes = 3.6 hours

Budget Consumed = (1 - Actual Availability) * Total Minutes
Budget Remaining = Error Budget - Budget Consumed
```

### Agent Error Budget

```
Monthly Minutes = 30 * 24 * 60 = 43,200 minutes
Error Budget (1.0%) = 432 minutes = 7.2 hours

Budget Consumed = (1 - Actual Availability) * Total Minutes
Budget Remaining = Error Budget - Budget Consumed
```

## Escalation Path

| Budget State | First Escalation | Second Escalation |
|--------------|-----------------|-------------------|
| Yellow | Engineering Lead | Engineering Manager |
| Orange | Engineering Manager | VP Engineering |
| Red | VP Engineering | CTO |

## Budget Reset

- Error budgets reset on the **1st of each month**
- No carryover of unused budget
- Historical data retained for trend analysis

## Exceptions

The following are excluded from error budget consumption:
1. **Planned Maintenance**: Announced 24+ hours in advance
2. **External Dependencies**: Upstream provider outages (documented)
3. **Force Majeure**: Natural disasters, infrastructure provider incidents

## Review and Updates

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Budget Status Check | Daily | SRE Team |
| Budget Review Meeting | Weekly | Engineering Lead |
| Policy Review | Quarterly | VP Engineering |
| SLO Target Adjustment | As needed | Engineering + Product |

## Related Documents

- [SLO Definitions](./SLO_DEFINITIONS.md)
- [SLO Configuration](./slo_config.yaml)
- [Incident Response Runbook](/ops/runbooks/)
