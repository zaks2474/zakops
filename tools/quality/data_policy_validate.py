#!/usr/bin/env python3
"""Validate data governance policies.

Checks that all required data governance documents exist and
validates the structure of machine-readable policies.
"""

import json
import os
import sys
from pathlib import Path

import yaml

# Paths
ROOT = Path(__file__).parent.parent.parent
DOCS_DIR = ROOT / "docs" / "data"
OUTPUT_FILE = ROOT / "artifacts" / "data" / "data_policy_validation.json"

# Required documents
REQUIRED_DOCS = [
    "DATA_GOVERNANCE_OVERVIEW.md",
    "DATA_CLASSIFICATION.md",
    "RETENTION_POLICY.yaml",
    "DELETION_POLICY.md",
    "BACKUP_RESTORE_POLICY.md",
    "TENANT_ISOLATION.md",
]

# Required keys in retention policy
RETENTION_REQUIRED_KEYS = [
    "retention_rules",
    "backup_schedule",
    "compliance",
]

# Required rule IDs
REQUIRED_RETENTION_RULES = [
    "deals",
    "agent_runs",
    "approval_logs",
    "user_sessions",
    "rag_documents",
]


def check_required_docs() -> tuple[list[str], list[str]]:
    """Check that all required documents exist."""
    found = []
    missing = []

    for doc in REQUIRED_DOCS:
        path = DOCS_DIR / doc
        if path.exists():
            found.append(doc)
        else:
            missing.append(doc)

    return found, missing


def validate_retention_policy() -> dict:
    """Validate retention policy structure."""
    policy_path = DOCS_DIR / "RETENTION_POLICY.yaml"

    if not policy_path.exists():
        return {
            "valid": False,
            "error": "RETENTION_POLICY.yaml not found",
        }

    try:
        with open(policy_path) as f:
            policy = yaml.safe_load(f)
    except Exception as e:
        return {
            "valid": False,
            "error": f"Failed to parse YAML: {e}",
        }

    # Check required top-level keys
    missing_keys = [k for k in RETENTION_REQUIRED_KEYS if k not in policy]
    if missing_keys:
        return {
            "valid": False,
            "error": f"Missing required keys: {missing_keys}",
        }

    # Check retention rules
    rules = policy.get("retention_rules", [])
    rule_ids = {r.get("id") for r in rules if isinstance(r, dict)}
    missing_rules = [r for r in REQUIRED_RETENTION_RULES if r not in rule_ids]

    if missing_rules:
        return {
            "valid": False,
            "error": f"Missing retention rules: {missing_rules}",
        }

    # Validate each rule has required fields
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        required_fields = ["id", "retention_days", "classification"]
        missing_fields = [f for f in required_fields if f not in rule]
        if missing_fields:
            return {
                "valid": False,
                "error": f"Rule {rule.get('id', 'unknown')} missing fields: {missing_fields}",
            }

    return {
        "valid": True,
        "rules_count": len(rules),
        "rule_ids": list(rule_ids),
    }


def main():
    """Validate data governance policies."""
    print("=== Data Policy Validator ===")

    results = {
        "passed": False,
        "documents": {},
        "retention_policy": {},
        "errors": [],
    }

    # Check required documents
    found, missing = check_required_docs()
    results["documents"] = {
        "found": found,
        "missing": missing,
        "all_present": len(missing) == 0,
    }

    if missing:
        results["errors"].append(f"Missing documents: {missing}")
        print(f"✗ Missing documents: {missing}")
    else:
        print(f"✓ All {len(found)} required documents found")

    # Validate retention policy
    retention_result = validate_retention_policy()
    results["retention_policy"] = retention_result

    if retention_result.get("valid"):
        print(f"✓ Retention policy valid ({retention_result['rules_count']} rules)")
    else:
        results["errors"].append(retention_result.get("error", "Unknown error"))
        print(f"✗ Retention policy invalid: {retention_result.get('error')}")

    # Determine overall pass/fail
    results["passed"] = len(results["errors"]) == 0

    # Write results
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Results written to {OUTPUT_FILE}")

    if results["passed"]:
        print("\n✓ Data policy validation PASSED")
        return 0
    else:
        print("\n✗ Data policy validation FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
