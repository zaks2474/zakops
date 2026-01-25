#!/usr/bin/env python3
"""Manual Signoff Validator.

Validates beta user signoff artifacts for human-in-the-loop verification.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "business"

# Signoff file location
SIGNOFF_FILE = ARTIFACTS_DIR / "BETA_USER_ONBOARDED.yaml"

# Required fields in signoff
REQUIRED_FIELDS = ["org", "date", "owner"]


def validate_signoff_exists() -> dict[str, Any]:
    """Check if signoff file exists."""
    # In dev/CI, signoff may not exist - that's OK unless REQUIRE_BETA_SIGNOFF=1
    import os
    require_signoff = os.environ.get("REQUIRE_BETA_SIGNOFF", "0") == "1"

    if SIGNOFF_FILE.exists():
        return {
            "check": "signoff_exists",
            "passed": True,
            "message": f"Signoff file exists: {SIGNOFF_FILE.name}",
        }
    elif require_signoff:
        return {
            "check": "signoff_exists",
            "passed": False,
            "message": "Signoff file required but missing (REQUIRE_BETA_SIGNOFF=1)",
        }
    else:
        return {
            "check": "signoff_exists",
            "passed": True,
            "message": "Signoff file not found (OK for dev/CI)",
            "skipped": True,
        }


def validate_signoff_schema() -> dict[str, Any]:
    """Validate signoff file schema if it exists."""
    if not SIGNOFF_FILE.exists():
        return {
            "check": "signoff_schema",
            "passed": True,
            "message": "No signoff file to validate",
            "skipped": True,
        }

    if not YAML_AVAILABLE:
        return {
            "check": "signoff_schema",
            "passed": True,
            "message": "PyYAML not available, schema validation skipped",
            "skipped": True,
        }

    try:
        with open(SIGNOFF_FILE) as f:
            data = yaml.safe_load(f)
    except Exception as e:
        return {
            "check": "signoff_schema",
            "passed": False,
            "message": f"Invalid YAML: {e}",
        }

    # Check for beta_user key
    if "beta_user" not in data:
        return {
            "check": "signoff_schema",
            "passed": False,
            "message": "Missing 'beta_user' key in signoff",
        }

    beta_user = data["beta_user"]

    # Check required fields
    missing = [f for f in REQUIRED_FIELDS if f not in beta_user]
    if missing:
        return {
            "check": "signoff_schema",
            "passed": False,
            "message": f"Missing required fields: {', '.join(missing)}",
        }

    return {
        "check": "signoff_schema",
        "passed": True,
        "message": f"Signoff valid for org: {beta_user.get('org', 'unknown')}",
    }


def validate_manual_signoff() -> dict[str, Any]:
    """Run all signoff validation checks."""
    checks = []

    # Check signoff exists
    checks.append(validate_signoff_exists())

    # Check schema if exists
    checks.append(validate_signoff_schema())

    # Calculate results (only count non-skipped checks for failures)
    non_skipped = [c for c in checks if not c.get("skipped", False)]
    passed = sum(1 for c in non_skipped if c["passed"])
    failed = len(non_skipped) - passed

    return {
        "validation": "manual_signoff",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "passed": failed == 0,
        "summary": {
            "total_checks": len(checks),
            "passed": passed,
            "failed": failed,
            "skipped": len(checks) - len(non_skipped),
        },
        "checks": checks,
    }


def main() -> int:
    print("Manual Signoff Validator")
    print("=" * 60)

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    result = validate_manual_signoff()

    # Print results
    for check in result["checks"]:
        if check.get("skipped"):
            status = "○"
        elif check["passed"]:
            status = "✓"
        else:
            status = "✗"
        print(f"  {status} {check['check']}: {check['message']}")

    # Summary
    print("\n" + "=" * 60)
    print(f"Passed: {result['summary']['passed']}/{result['summary']['total_checks']}")
    if result["summary"]["skipped"] > 0:
        print(f"Skipped: {result['summary']['skipped']}")

    # Write artifact
    artifact_path = ARTIFACTS_DIR / "beta_user_signoff_validation.json"
    with open(artifact_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Artifact: {artifact_path}")

    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
