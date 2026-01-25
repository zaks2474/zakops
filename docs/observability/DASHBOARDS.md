# ZakOps Dashboards

This document describes the Grafana dashboards available for ZakOps observability.

## Overview Dashboard

**Location:** `ops/observability/grafana/dashboards/zakops_overview.json`

The main overview dashboard provides at-a-glance visibility into the health and performance of ZakOps services.

### Panels

#### API Availability (Stat)
- **Metric:** Success rate of HTTP requests
- **Thresholds:**
  - Green: >= 99.5%
  - Yellow: >= 99%
  - Red: < 99%
- **Query:** `(sum(rate(http_requests_total{status_code=~"[23].."}[5m])) / sum(rate(http_requests_total[5m]))) * 100`

#### API Latency P95 (Stat)
- **Metric:** 95th percentile request latency
- **Thresholds:**
  - Green: < 300ms
  - Yellow: < 500ms
  - Red: >= 500ms
- **Query:** `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000`

#### Token Usage (Time Series)
- **Metric:** LLM token usage by type (prompt/completion)
- **Displays:** Tokens per second over time
- **Query:** `sum(rate(llm_tokens_total[5m])) by (type)`

#### Estimated Cost (Stat)
- **Metric:** Estimated LLM API cost in USD
- **Thresholds:**
  - Green: < $10/day
  - Yellow: < $50/day
  - Red: >= $50/day
- **Query:** `sum(increase(llm_cost_usd_total[24h]))`

#### Agent Invocations (Time Series)
- **Metric:** Agent invocation rate by status
- **Displays:** Invocations per second over time
- **Query:** `sum(rate(agent_invocations_total[5m])) by (status)`

## Dashboard Deployment

### Import to Grafana

1. Open Grafana UI
2. Navigate to Dashboards > Import
3. Upload the JSON file or paste contents
4. Select Prometheus data source
5. Click Import

### Automated Provisioning

Place dashboards in the Grafana provisioning directory:

```bash
cp ops/observability/grafana/dashboards/*.json /etc/grafana/provisioning/dashboards/
```

Configure provisioner in `/etc/grafana/provisioning/dashboards/default.yaml`:

```yaml
apiVersion: 1
providers:
  - name: 'zakops'
    folder: 'ZakOps'
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards
```

## Adding New Dashboards

1. Create dashboard in Grafana UI
2. Export as JSON (Share > Export > Save to file)
3. Save to `ops/observability/grafana/dashboards/`
4. Update this documentation
