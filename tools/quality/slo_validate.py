#!/usr/bin/env python3
"""
SLO Configuration Validator

Validates the SLO configuration file for:
- Required SLO definitions (minimum 6)
- Valid structure and fields
- Error budget threshold configuration
"""

import json
import sys
from pathlib import Path

import yaml


def validate_slo_config(config_path: Path) -> dict:
    """Validate SLO configuration and return validation result."""
    errors = []
    warnings = []

    # Check file exists
    if not config_path.exists():
        return {
            "passed": False,
            "errors": [f"SLO config file not found: {config_path}"],
            "warnings": [],
            "slo_count": 0,
            "error_budget_configured": False
        }

    # Load config
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return {
            "passed": False,
            "errors": [f"Invalid YAML: {e}"],
            "warnings": [],
            "slo_count": 0,
            "error_budget_configured": False
        }

    # Validate structure
    if not isinstance(config, dict):
        errors.append("Config must be a YAML dictionary")
        return {
            "passed": False,
            "errors": errors,
            "warnings": warnings,
            "slo_count": 0,
            "error_budget_configured": False
        }

    # Check for slos section
    slos = config.get("slos", [])
    if not slos:
        errors.append("No SLOs defined in config")
    elif len(slos) < 6:
        errors.append(f"Minimum 6 SLOs required, found {len(slos)}")

    # Validate each SLO
    required_fields = ["id", "name", "service", "type", "target"]
    valid_types = ["availability", "latency", "error_rate", "accuracy"]

    for i, slo in enumerate(slos):
        slo_id = slo.get("id", f"slo_{i}")

        # Check required fields
        for field in required_fields:
            if field not in slo:
                errors.append(f"SLO '{slo_id}' missing required field: {field}")

        # Validate type
        slo_type = slo.get("type")
        if slo_type and slo_type not in valid_types:
            errors.append(f"SLO '{slo_id}' has invalid type: {slo_type}")

        # Validate target is numeric
        target = slo.get("target")
        if target is not None and not isinstance(target, (int, float)):
            errors.append(f"SLO '{slo_id}' target must be numeric")

    # Check error budget configuration
    error_budget = config.get("error_budget", {})
    thresholds = error_budget.get("thresholds", {})

    error_budget_configured = bool(thresholds)
    required_thresholds = ["green", "yellow", "orange", "red"]

    if not error_budget_configured:
        errors.append("Error budget thresholds not configured")
    else:
        for threshold in required_thresholds:
            if threshold not in thresholds:
                errors.append(f"Missing error budget threshold: {threshold}")

    # Build result
    passed = len(errors) == 0

    return {
        "passed": passed,
        "errors": errors,
        "warnings": warnings,
        "slo_count": len(slos),
        "error_budget_configured": error_budget_configured,
        "validated_slos": [slo.get("id") for slo in slos]
    }


def main():
    """Main entry point."""
    # Determine paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent

    config_path = repo_root / "docs" / "slos" / "slo_config.yaml"
    output_dir = repo_root / "artifacts" / "quality"
    output_path = output_dir / "slo_validation.json"

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Validate
    result = validate_slo_config(config_path)

    # Write result
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    # Print summary
    if result["passed"]:
        print(f"✅ SLO validation PASSED")
        print(f"   SLOs defined: {result['slo_count']}")
        print(f"   Error budget configured: {result['error_budget_configured']}")
    else:
        print(f"❌ SLO validation FAILED")
        for error in result["errors"]:
            print(f"   ERROR: {error}")
        for warning in result["warnings"]:
            print(f"   WARNING: {warning}")

    print(f"\nOutput written to: {output_path}")

    # Exit with appropriate code
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
