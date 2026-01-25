#!/usr/bin/env python3
"""Generate Prometheus alert rules from SLO configuration.

Reads docs/slos/slo_config.yaml and generates Prometheus alerting rules
based on defined SLOs and thresholds.
"""

import json
import os
import sys
from pathlib import Path

import yaml

# Paths
ROOT = Path(__file__).parent.parent.parent
SLO_CONFIG = ROOT / "docs" / "slos" / "slo_config.yaml"
ALERTS_OUTPUT = ROOT / "ops" / "observability" / "prometheus" / "alerts" / "slo_alerts.yml"
ARTIFACTS_OUTPUT = ROOT / "artifacts" / "observability" / "generated_slo_alerts.yml"


def load_slo_config() -> dict:
    """Load SLO configuration from YAML."""
    if not SLO_CONFIG.exists():
        print(f"ERROR: SLO config not found at {SLO_CONFIG}")
        sys.exit(1)

    with open(SLO_CONFIG) as f:
        return yaml.safe_load(f)


def generate_availability_alert(slo: dict) -> dict:
    """Generate alert rule for availability SLO."""
    slo_id = slo["id"]
    target = slo["target"]
    service = slo["service"]

    return {
        "alert": f"{slo_id}_breach",
        "expr": f'(sum(rate(http_requests_total{{service="{service}",status_code=~"[23].."}}[5m])) / sum(rate(http_requests_total{{service="{service}"}}[5m]))) * 100 < {target}',
        "for": "5m",
        "labels": {
            "severity": "critical",
            "slo_id": slo_id,
            "service": service,
        },
        "annotations": {
            "summary": f"{slo['name']} below target",
            "description": f"Availability is below {target}% target for {service}",
        },
    }


def generate_latency_alert(slo: dict) -> dict:
    """Generate alert rule for latency SLO."""
    slo_id = slo["id"]
    target = slo["target"]
    service = slo["service"]
    percentile = slo.get("percentile", 95) / 100

    return {
        "alert": f"{slo_id}_breach",
        "expr": f'histogram_quantile({percentile}, sum(rate(http_request_duration_seconds_bucket{{service="{service}"}}[5m])) by (le)) * 1000 > {target}',
        "for": "5m",
        "labels": {
            "severity": "warning",
            "slo_id": slo_id,
            "service": service,
        },
        "annotations": {
            "summary": f"{slo['name']} exceeded",
            "description": f"Latency P{int(percentile*100)} exceeds {target}ms for {service}",
        },
    }


def generate_error_rate_alert(slo: dict) -> dict:
    """Generate alert rule for error rate SLO."""
    slo_id = slo["id"]
    target = slo["target"]
    service = slo["service"]

    return {
        "alert": f"{slo_id}_breach",
        "expr": f'(sum(rate(http_requests_total{{service="{service}",status_code=~"5.."}}[5m])) / sum(rate(http_requests_total{{service="{service}"}}[5m]))) * 100 > {target}',
        "for": "5m",
        "labels": {
            "severity": "critical",
            "slo_id": slo_id,
            "service": service,
        },
        "annotations": {
            "summary": f"{slo['name']} exceeded",
            "description": f"Error rate exceeds {target}% for {service}",
        },
    }


def generate_accuracy_alert(slo: dict) -> dict:
    """Generate alert rule for accuracy SLO."""
    slo_id = slo["id"]
    target = slo["target"]
    service = slo["service"]

    return {
        "alert": f"{slo_id}_breach",
        "expr": f'golden_trace_pass_rate{{service="{service}"}} * 100 < {target}',
        "for": "1h",
        "labels": {
            "severity": "critical",
            "slo_id": slo_id,
            "service": service,
        },
        "annotations": {
            "summary": f"{slo['name']} below target",
            "description": f"Accuracy is below {target}% for {service}",
        },
    }


def generate_alerts(config: dict) -> list[dict]:
    """Generate all alert rules from SLO config."""
    alerts = []

    for slo in config.get("slos", []):
        slo_type = slo.get("type")

        if slo_type == "availability":
            alerts.append(generate_availability_alert(slo))
        elif slo_type == "latency":
            alerts.append(generate_latency_alert(slo))
        elif slo_type == "error_rate":
            alerts.append(generate_error_rate_alert(slo))
        elif slo_type == "accuracy":
            alerts.append(generate_accuracy_alert(slo))
        else:
            print(f"WARNING: Unknown SLO type: {slo_type}")

    return alerts


def write_prometheus_rules(alerts: list[dict], output_path: Path) -> None:
    """Write alerts in Prometheus format."""
    rules = {
        "groups": [
            {
                "name": "slo_alerts",
                "interval": "30s",
                "rules": alerts,
            }
        ]
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        yaml.dump(rules, f, default_flow_style=False, sort_keys=False)

    print(f"Generated {len(alerts)} alert rules to {output_path}")


def main():
    """Generate SLO alerts."""
    print("=== SLO Alert Generator ===")

    config = load_slo_config()
    alerts = generate_alerts(config)

    # Write to ops location
    write_prometheus_rules(alerts, ALERTS_OUTPUT)

    # Write to artifacts location
    write_prometheus_rules(alerts, ARTIFACTS_OUTPUT)

    print(f"Generated {len(alerts)} alerts from {len(config.get('slos', []))} SLOs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
