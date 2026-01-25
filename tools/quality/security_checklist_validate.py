#!/usr/bin/env python3
"""Validate security checklists (ASVS L1 and API Top 10).

This script validates that security checklists are properly formatted
and contain required information for automated gate checks.
"""

import json
import sys
from pathlib import Path

import yaml


def validate_asvs_checklist(path: Path) -> dict:
    """Validate ASVS L1 checklist structure.

    Args:
        path: Path to asvs_l1.yaml

    Returns:
        dict with validation results
    """
    issues = []

    if not path.exists():
        return {"passed": False, "issues": [f"File not found: {path}"]}

    try:
        with open(path) as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return {"passed": False, "issues": [f"YAML parse error: {e}"]}

    # Check required top-level keys
    required_keys = ["version", "level", "requirements"]
    for key in required_keys:
        if key not in data:
            issues.append(f"Missing required key: {key}")

    # Validate requirements
    requirements = data.get("requirements", [])
    if len(requirements) < 10:
        issues.append(f"Need at least 10 requirements, found {len(requirements)}")

    valid_statuses = {"complete", "not_applicable", "in_progress", "planned"}

    for i, req in enumerate(requirements):
        req_id = req.get("id", f"requirement[{i}]")

        required_fields = ["id", "title", "status", "enforcement_location"]
        for field in required_fields:
            if field not in req:
                issues.append(f"{req_id}: Missing field '{field}'")

        if req.get("status") and req["status"] not in valid_statuses:
            issues.append(f"{req_id}: Invalid status '{req['status']}'")

    # Check summary if present
    if "summary" in data:
        summary = data["summary"]
        complete = summary.get("complete", 0)
        not_applicable = summary.get("not_applicable", 0)
        total = summary.get("total_requirements", 0)

        if complete + not_applicable != total:
            # Count actual requirements
            actual_complete = sum(1 for r in requirements if r.get("status") == "complete")
            actual_na = sum(1 for r in requirements if r.get("status") == "not_applicable")
            if actual_complete != complete or actual_na != not_applicable:
                issues.append(
                    f"Summary mismatch: complete={actual_complete} (stated {complete}), "
                    f"not_applicable={actual_na} (stated {not_applicable})"
                )

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "requirements_count": len(requirements),
        "file": str(path),
    }


def validate_api_top10_checklist(path: Path) -> dict:
    """Validate OWASP API Top 10 checklist structure.

    Args:
        path: Path to api_top10.yaml

    Returns:
        dict with validation results
    """
    issues = []

    if not path.exists():
        return {"passed": False, "issues": [f"File not found: {path}"]}

    try:
        with open(path) as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return {"passed": False, "issues": [f"YAML parse error: {e}"]}

    # Check required top-level keys
    required_keys = ["version", "risks"]
    for key in required_keys:
        if key not in data:
            issues.append(f"Missing required key: {key}")

    # All 10 API risks should be documented
    risks = data.get("risks", [])
    if len(risks) != 10:
        issues.append(f"Expected 10 API risks, found {len(risks)}")

    valid_statuses = {"mitigated", "partially_mitigated", "not_mitigated", "not_applicable"}

    expected_ids = {f"API{i}" for i in range(1, 11)}
    found_ids = set()

    for i, risk in enumerate(risks):
        risk_id = risk.get("id", f"risk[{i}]")
        found_ids.add(risk_id)

        required_fields = ["id", "name", "status", "controls"]
        for field in required_fields:
            if field not in risk:
                issues.append(f"{risk_id}: Missing field '{field}'")

        if risk.get("status") and risk["status"] not in valid_statuses:
            issues.append(f"{risk_id}: Invalid status '{risk['status']}'")

        # Each risk should have at least one control
        controls = risk.get("controls", [])
        if not controls:
            issues.append(f"{risk_id}: No controls defined")

        for j, control in enumerate(controls):
            if "description" not in control:
                issues.append(f"{risk_id}.controls[{j}]: Missing description")
            if "location" not in control:
                issues.append(f"{risk_id}.controls[{j}]: Missing location")

    # Check all 10 are present
    missing_ids = expected_ids - found_ids
    if missing_ids:
        issues.append(f"Missing API risks: {sorted(missing_ids)}")

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "risks_count": len(risks),
        "file": str(path),
    }


def main():
    """Run security checklist validation."""
    # Default paths
    project_root = Path(__file__).parent.parent.parent
    asvs_path = project_root / "docs" / "security" / "asvs_l1.yaml"
    api_top10_path = project_root / "docs" / "security" / "api_top10.yaml"

    results = {
        "asvs_l1": validate_asvs_checklist(asvs_path),
        "api_top10": validate_api_top10_checklist(api_top10_path),
    }

    # Overall pass/fail
    all_passed = all(r["passed"] for r in results.values())
    results["overall_passed"] = all_passed

    # Print results
    print(json.dumps(results, indent=2))

    # Write artifact
    artifacts_dir = project_root / "artifacts" / "security"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    with open(artifacts_dir / "checklist_validation.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nArtifact written to: {artifacts_dir / 'checklist_validation.json'}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
