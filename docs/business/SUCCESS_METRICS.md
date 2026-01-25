# Success Metrics

Key metrics for measuring ZakOps platform success during beta and beyond.

## Core Metrics

### 1. Activation Rate

**Definition**: Percentage of users who complete initial setup within 7 days of invitation.

| Metric | Target | Current |
|--------|--------|---------|
| 7-day activation | >60% | TBD |
| 14-day activation | >80% | TBD |
| 30-day activation | >90% | TBD |

**Calculation**:
```
activation_rate = (users_completed_setup / users_invited) * 100
```

**Instrumentation**:
```python
emit_counter('users_invited_total')
emit_counter('users_activated_total')
emit_histogram('activation_time_hours', value=hours_to_activate)
```

### 2. Weekly/Monthly Active Users (WAU/MAU)

**Definition**: Unique users who performed at least one meaningful action.

| Metric | Target | Current |
|--------|--------|---------|
| WAU growth | >5%/week | TBD |
| MAU growth | >10%/month | TBD |
| WAU/MAU ratio | >40% | TBD |

**Meaningful actions**:
- Created/updated a deal
- Used agent suggestions
- Completed an approval
- Generated a report

**Instrumentation**:
```python
emit_counter('user_actions_total', labels={'action': action_type})
```

### 3. Approval Latency

**Definition**: Time from approval request to resolution.

| Priority | Target | Current |
|----------|--------|---------|
| P1 (Critical) | <4 hours | TBD |
| P2 (High) | <24 hours | TBD |
| P3 (Medium) | <72 hours | TBD |
| P4 (Low) | <1 week | TBD |

**Instrumentation**:
```python
emit_histogram('approval_latency_seconds', value=latency, labels={'priority': priority})
emit_counter('approvals_created_total', labels={'priority': priority})
emit_counter('approvals_resolved_total', labels={'priority': priority, 'outcome': outcome})
```

### 4. Agent Adoption

**Definition**: Percentage of deals that have agent interaction.

| Metric | Target | Current |
|--------|--------|---------|
| Beta adoption | >30% | TBD |
| GA target | >50% | TBD |
| Power user | >80% | TBD |

**Agent interactions**:
- Analysis requested
- Suggestion viewed
- Suggestion accepted
- Suggestion rejected (with feedback)

**Instrumentation**:
```python
emit_counter('agent_invocations_total', labels={'action': action, 'status': status})
emit_counter('agent_suggestions_total', labels={'type': suggestion_type})
emit_counter('agent_suggestions_accepted_total', labels={'type': suggestion_type})
```

### 5. System Reliability (SLO)

| Metric | Target | Current |
|--------|--------|---------|
| Availability | 99.5% | TBD |
| P50 latency | <200ms | TBD |
| P95 latency | <1s | TBD |
| P99 latency | <3s | TBD |
| Error rate | <1% | TBD |

**Instrumentation**:
```python
emit_histogram('request_duration_seconds', value=duration, labels={'endpoint': endpoint})
emit_counter('requests_total', labels={'endpoint': endpoint, 'status': status_code})
emit_counter('errors_total', labels={'endpoint': endpoint, 'error_type': error_type})
```

### 6. Feedback Metrics

**Definition**: User feedback collection and analysis.

| Metric | Target | Current |
|--------|--------|---------|
| Feedback submission rate | >10% users | TBD |
| Bug reports resolved <72h | >80% | TBD |
| Feature requests reviewed | 100% | TBD |
| NPS score | >30 | TBD |

**Instrumentation**:
```python
emit_counter('feedback_submissions_total', labels={'type': type, 'severity': severity})
emit_histogram('feedback_resolution_hours', value=hours, labels={'type': type})
```

## Business Metrics

### Revenue Indicators (Future)

| Metric | Target | Notes |
|--------|--------|-------|
| Beta → Paid conversion | >50% | Post-beta |
| Deal value influenced | Track | Agent-assisted deals |
| Time saved per deal | Track | Vs manual process |

### Customer Health

| Metric | Target | Notes |
|--------|--------|-------|
| Support tickets/user | <2/month | Lower is better |
| Training completion | >80% | Beta requirement |
| Feature utilization | >60% | Core features used |

## Dashboard Locations

- **Operations**: Grafana → ZakOps → Operations
- **Business**: Grafana → ZakOps → Business Metrics
- **SLOs**: Grafana → ZakOps → SLO Dashboard

## Alerting Thresholds

### Critical Alerts
- Availability <99%
- Error rate >5%
- P99 latency >10s

### Warning Alerts
- Activation rate <50%
- Agent adoption <20%
- Approval latency P1 >6h

## Reporting Cadence

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily metrics | Daily | Engineering |
| Weekly summary | Weekly | Leadership |
| Beta progress | Bi-weekly | Stakeholders |
| Monthly review | Monthly | All hands |

## Data Collection

All metrics are collected via:
- Prometheus counters and histograms
- Application logging (structured JSON)
- Database audit tables
- User analytics events

Privacy note: No PII in metrics. User IDs are hashed.
