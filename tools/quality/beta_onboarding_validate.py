#!/usr/bin/env python3
"""Beta Onboarding Validator.

Validates beta onboarding documentation and infrastructure.
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DOCS_DIR = REPO_ROOT / "docs" / "business"
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "business"

# Required documentation files
REQUIRED_DOCS = [
    "BETA_ONBOARDING.md",
    "BETA_SUPPORT_PLAYBOOK.md",
    "BETA_CHANGELOG.md",
]

# Required sections in onboarding doc
ONBOARDING_REQUIRED_SECTIONS = [
    "Prerequisites",
    "Quick Start",
    "Feature",
    "Training",
    "Success Criteria",
    "Getting Help",
    "Contact",
]

# Required sections in support playbook
SUPPORT_REQUIRED_SECTIONS = [
    "Triage",
    "Severity",
    "Escalation",
    "Communication",
]


def check_file_exists(path: Path) -> dict[str, Any]:
    """Check if a required file exists."""
    exists = path.exists()
    return {
        "check": f"file_{path.name}",
        "passed": exists,
        "message": f"{'Exists' if exists else 'Missing'}: {path.name}",
    }


def check_sections(path: Path, required_sections: list[str]) -> list[dict[str, Any]]:
    """Check if a markdown file has required sections."""
    checks = []

    if not path.exists():
        return checks

    content = path.read_text().lower()

    for section in required_sections:
        found = section.lower() in content
        checks.append({
            "check": f"section_{section.lower().replace(' ', '_')}",
            "passed": found,
            "message": f"Section '{section}' {'found' if found else 'missing'} in {path.name}",
        })

    return checks


def check_feedback_migration() -> dict[str, Any]:
    """Check if feedback migration exists."""
    # Look for feedback migration file
    migration_files = list(MIGRATIONS_DIR.glob("*feedback*.sql"))

    if not migration_files:
        return {
            "check": "feedback_migration",
            "passed": False,
            "message": "No feedback migration found",
        }

    # Check migration content
    migration_file = migration_files[0]
    content = migration_file.read_text()

    # Required elements in migration
    required_elements = [
        "CREATE TABLE",
        "feedback",
        "type VARCHAR",
        "severity VARCHAR",
        "message TEXT",
        "metadata JSONB",
    ]

    missing = []
    for element in required_elements:
        if element.lower() not in content.lower():
            missing.append(element)

    if missing:
        return {
            "check": "feedback_migration",
            "passed": False,
            "message": f"Migration missing elements: {', '.join(missing)}",
        }

    return {
        "check": "feedback_migration",
        "passed": True,
        "message": f"Feedback migration found: {migration_file.name}",
    }


def validate_beta_onboarding() -> dict[str, Any]:
    """Run all beta onboarding validation checks."""
    checks = []

    # Check required docs exist
    for doc in REQUIRED_DOCS:
        doc_path = DOCS_DIR / doc
        checks.append(check_file_exists(doc_path))

    # Check onboarding doc sections
    onboarding_path = DOCS_DIR / "BETA_ONBOARDING.md"
    checks.extend(check_sections(onboarding_path, ONBOARDING_REQUIRED_SECTIONS))

    # Check support playbook sections
    support_path = DOCS_DIR / "BETA_SUPPORT_PLAYBOOK.md"
    checks.extend(check_sections(support_path, SUPPORT_REQUIRED_SECTIONS))

    # Check changelog exists and has content
    changelog_path = DOCS_DIR / "BETA_CHANGELOG.md"
    if changelog_path.exists():
        content = changelog_path.read_text()
        has_entries = "[" in content and "]" in content  # Has version entries
        checks.append({
            "check": "changelog_entries",
            "passed": has_entries,
            "message": "Changelog has entries" if has_entries else "Changelog empty",
        })

    # Check feedback migration
    checks.append(check_feedback_migration())

    # Calculate results
    passed = sum(1 for c in checks if c["passed"])
    failed = len(checks) - passed

    return {
        "validation": "beta_onboarding",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "passed": failed == 0,
        "summary": {
            "total_checks": len(checks),
            "passed": passed,
            "failed": failed,
        },
        "checks": checks,
    }


def main() -> int:
    print("Beta Onboarding Validator")
    print("=" * 60)

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    result = validate_beta_onboarding()

    # Print results
    for check in result["checks"]:
        status = "✓" if check["passed"] else "✗"
        print(f"  {status} {check['message']}")

    # Summary
    print("\n" + "=" * 60)
    print(f"Passed: {result['summary']['passed']}/{result['summary']['total_checks']}")

    # Write artifact
    artifact_path = ARTIFACTS_DIR / "beta_readiness.json"
    with open(artifact_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Artifact: {artifact_path}")

    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
