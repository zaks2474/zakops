# ZakOps Service Level Objectives (SLOs)

## Overview

This document defines the Service Level Objectives for ZakOps services. These SLOs are designed to balance reliability with feature velocity and provide clear targets for operational excellence.

## API Service SLOs

### API Availability

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| Availability | 99.5% | 30-day rolling |
| Error Budget | 0.5% (3.6 hours/month) | Monthly |

**Definition**: Percentage of successful HTTP responses (2xx, 3xx) divided by total requests, excluding planned maintenance windows.

**Exclusions**:
- Scheduled maintenance (announced 24h+ in advance)
- External dependency failures (upstream APIs)
- Client-side errors (4xx responses)

### API Latency

| Percentile | Target | Measurement |
|------------|--------|-------------|
| P50 | 100ms | Request duration |
| P95 | 500ms | Request duration |
| P99 | 2000ms | Request duration |

**Definition**: Time from request received to response sent, measured at the application layer.

**Scope**: All API endpoints except:
- File upload/download endpoints
- Long-running report generation

### API Error Rate

| Metric | Target |
|--------|--------|
| Server Error Rate (5xx) | < 0.1% |

## Agent Service SLOs

### Agent Availability

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| Availability | 99.0% | 30-day rolling |
| Error Budget | 1.0% (7.2 hours/month) | Monthly |

**Definition**: Agent service responding to health checks and processing requests.

### Agent Latency

| Percentile | Target | Measurement |
|------------|--------|-------------|
| P50 | 1000ms | End-to-end request |
| P95 | 5000ms | End-to-end request |
| P99 | 15000ms | End-to-end request |

**Definition**: Time from agent request to final response, including LLM inference time.

**Note**: Agent latency is higher than API latency due to LLM inference requirements.

### Tool Accuracy

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool Selection Accuracy | 95% | Correct tool for intent |
| Parameter Extraction Accuracy | 90% | Correct parameters |
| Overall Accuracy | 95% | End-to-end correctness |

**Definition**: Percentage of agent tool calls that correctly match the intended action based on golden trace evaluation.

**Measurement**:
- Golden trace suite (10+ traces)
- Weekly evaluation runs
- Quarterly trace expansion

## Error Budget Policy

See [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md) for detailed error budget management.

## SLO Review Cadence

| Activity | Frequency |
|----------|-----------|
| SLO Monitoring | Continuous (dashboards) |
| Error Budget Review | Weekly |
| SLO Target Review | Quarterly |
| SLO Definition Update | As needed |

## Alerting Thresholds

### API Alerts

| Condition | Severity | Action |
|-----------|----------|--------|
| Availability < 99.9% (1h) | Warning | Monitor |
| Availability < 99.5% (4h) | Critical | Page on-call |
| P95 Latency > 500ms (15m) | Warning | Monitor |
| P99 Latency > 2000ms (15m) | Critical | Investigate |

### Agent Alerts

| Condition | Severity | Action |
|-----------|----------|--------|
| Availability < 99.5% (1h) | Warning | Monitor |
| Availability < 99.0% (4h) | Critical | Page on-call |
| Tool Accuracy < 95% | Critical | Block deployment |

## Related Documents

- [SLO Configuration](./slo_config.yaml) - Machine-readable SLO definitions
- [Error Budget Policy](./ERROR_BUDGET_POLICY.md) - Budget management procedures
- [NIST AI RMF Mapping](../risk/NIST_AI_RMF_MAPPING.md) - Risk framework alignment
