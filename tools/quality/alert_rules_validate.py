#!/usr/bin/env python3
"""Validate Prometheus alert rules against SLO configuration.

Ensures every SLO has a corresponding alert rule and validates
rule syntax if promtool is available.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

# Paths
ROOT = Path(__file__).parent.parent.parent
SLO_CONFIG = ROOT / "docs" / "slos" / "slo_config.yaml"
ALERTS_FILE = ROOT / "ops" / "observability" / "prometheus" / "alerts" / "slo_alerts.yml"
OUTPUT_FILE = ROOT / "artifacts" / "observability" / "alert_rules_validation.json"


def load_yaml_file(path: Path) -> dict | None:
    """Load YAML file safely."""
    if not path.exists():
        return None
    with open(path) as f:
        return yaml.safe_load(f)


def extract_slo_ids(config: dict) -> set[str]:
    """Extract SLO IDs from config."""
    return {slo["id"] for slo in config.get("slos", [])}


def extract_alert_slo_ids(alerts: dict) -> set[str]:
    """Extract SLO IDs from alert rules."""
    slo_ids = set()
    for group in alerts.get("groups", []):
        for rule in group.get("rules", []):
            labels = rule.get("labels", {})
            if "slo_id" in labels:
                slo_ids.add(labels["slo_id"])
    return slo_ids


def validate_promtool(alerts_path: Path) -> dict:
    """Run promtool validation if available."""
    promtool = shutil.which("promtool")
    if not promtool:
        return {
            "available": False,
            "message": "promtool not found, skipping syntax validation",
        }

    try:
        result = subprocess.run(
            [promtool, "check", "rules", str(alerts_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "available": True,
            "passed": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {
            "available": True,
            "passed": False,
            "error": "promtool timed out",
        }
    except Exception as e:
        return {
            "available": True,
            "passed": False,
            "error": str(e),
        }


def main():
    """Validate alert rules."""
    print("=== Alert Rules Validator ===")

    results = {
        "passed": False,
        "slo_coverage": {},
        "promtool": {},
        "errors": [],
    }

    # Load SLO config
    slo_config = load_yaml_file(SLO_CONFIG)
    if not slo_config:
        results["errors"].append(f"SLO config not found: {SLO_CONFIG}")
        write_results(results)
        return 1

    # Load alerts file
    alerts = load_yaml_file(ALERTS_FILE)
    if not alerts:
        results["errors"].append(f"Alerts file not found: {ALERTS_FILE}")
        write_results(results)
        return 1

    # Check SLO coverage
    slo_ids = extract_slo_ids(slo_config)
    alert_slo_ids = extract_alert_slo_ids(alerts)

    missing_alerts = slo_ids - alert_slo_ids
    extra_alerts = alert_slo_ids - slo_ids

    results["slo_coverage"] = {
        "total_slos": len(slo_ids),
        "alerts_defined": len(alert_slo_ids),
        "missing_alerts": list(missing_alerts),
        "extra_alerts": list(extra_alerts),
        "coverage_complete": len(missing_alerts) == 0,
    }

    if missing_alerts:
        results["errors"].append(f"Missing alerts for SLOs: {missing_alerts}")

    # Run promtool validation
    results["promtool"] = validate_promtool(ALERTS_FILE)

    # Determine overall pass/fail
    promtool_ok = not results["promtool"].get("available") or results["promtool"].get("passed", True)
    results["passed"] = len(results["errors"]) == 0 and promtool_ok

    write_results(results)

    if results["passed"]:
        print("✓ Alert rules validation PASSED")
        return 0
    else:
        print("✗ Alert rules validation FAILED")
        for error in results["errors"]:
            print(f"  - {error}")
        return 1


def write_results(results: dict) -> None:
    """Write results to artifacts."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results written to {OUTPUT_FILE}")


if __name__ == "__main__":
    sys.exit(main())
