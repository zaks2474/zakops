#!/usr/bin/env python3
"""Runbook Linter.

Validates runbooks have required sections and proper formatting.
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
RUNBOOKS_DIR = REPO_ROOT / "ops" / "runbooks"
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "ops"

# Required sections for incident runbooks
REQUIRED_SECTIONS = [
    "Symptoms",
    "Impact",
    "Diagnosis",
    "Immediate Actions",
    "Rollback",
    "Verification",
    "Escalation",
    "Postmortem",
]

# Overview/index files may have different requirements (not incident runbooks)
OVERVIEW_PATTERNS = [
    "OVERVIEW", "INDEX", "TEMPLATE", "KEY_ROTATION", "STARTUP", "SHUTDOWN",
    "BACKUP_RESTORE", "STUCK_APPROVAL", "DOUBLE_EXECUTION", "TRIAGE"
]


def is_overview_file(path: Path) -> bool:
    """Check if file is an overview/index file or other non-incident runbook."""
    name_upper = path.name.upper()
    return any(pattern in name_upper for pattern in OVERVIEW_PATTERNS)


def extract_sections(content: str) -> list[str]:
    """Extract markdown section headers from content."""
    # Match ## headers
    pattern = r'^##\s+(.+?)(?:\s*\{#.*\})?$'
    sections = re.findall(pattern, content, re.MULTILINE)
    return [s.strip() for s in sections]


def lint_runbook(path: Path) -> dict[str, Any]:
    """Lint a single runbook file."""
    result = {
        "file": str(path.relative_to(REPO_ROOT)),
        "passed": True,
        "errors": [],
        "warnings": [],
    }

    try:
        content = path.read_text()
    except Exception as e:
        result["passed"] = False
        result["errors"].append(f"Could not read file: {e}")
        return result

    # Skip empty files
    if not content.strip():
        result["passed"] = False
        result["errors"].append("File is empty")
        return result

    # Overview files have different requirements
    if is_overview_file(path):
        # Just check it has some content and headers
        sections = extract_sections(content)
        if not sections:
            result["warnings"].append("No sections found in overview file")
        return result

    # Extract sections
    sections = extract_sections(content)
    sections_lower = [s.lower() for s in sections]

    # Check required sections
    for req in REQUIRED_SECTIONS:
        # Allow some flexibility in naming
        found = False
        req_lower = req.lower()
        for section in sections_lower:
            if req_lower in section or section in req_lower:
                found = True
                break

        if not found:
            result["errors"].append(f"Missing required section: {req}")
            result["passed"] = False

    # Check for code blocks (runbooks should have actionable commands)
    if "```" not in content:
        result["warnings"].append("No code blocks found - consider adding commands")

    # Check for links
    link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    links = re.findall(link_pattern, content)
    for link_text, link_url in links:
        if link_url.startswith("http"):
            continue  # External links
        if link_url.startswith("#"):
            continue  # Anchor links
        # Check relative link exists
        link_path = path.parent / link_url
        if not link_path.exists():
            result["warnings"].append(f"Broken link: {link_url}")

    return result


def lint_all_runbooks() -> dict[str, Any]:
    """Lint all runbooks in the runbooks directory."""
    results = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "passed": True,
        "summary": {
            "total_files": 0,
            "passed": 0,
            "failed": 0,
            "warnings": 0,
        },
        "files": [],
    }

    # Check index exists
    index_file = RUNBOOKS_DIR / "RUNBOOK_INDEX.md"
    if not index_file.exists():
        results["files"].append({
            "file": "ops/runbooks/RUNBOOK_INDEX.md",
            "passed": False,
            "errors": ["Index file missing"],
            "warnings": [],
        })
        results["passed"] = False
        results["summary"]["failed"] += 1

    # Find all markdown files
    runbook_files = list(RUNBOOKS_DIR.rglob("*.md"))

    for path in runbook_files:
        results["summary"]["total_files"] += 1
        file_result = lint_runbook(path)
        results["files"].append(file_result)

        if file_result["passed"]:
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1
            results["passed"] = False

        if file_result["warnings"]:
            results["summary"]["warnings"] += len(file_result["warnings"])

    return results


def main() -> int:
    print("Runbook Linter")
    print("=" * 60)

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    results = lint_all_runbooks()

    # Print results
    for file_result in results["files"]:
        status = "✓" if file_result["passed"] else "✗"
        print(f"\n{status} {file_result['file']}")

        for error in file_result.get("errors", []):
            print(f"    ERROR: {error}")
        for warning in file_result.get("warnings", []):
            print(f"    WARN:  {warning}")

    # Summary
    print("\n" + "=" * 60)
    print(f"Total: {results['summary']['total_files']} files")
    print(f"Passed: {results['summary']['passed']}")
    print(f"Failed: {results['summary']['failed']}")
    print(f"Warnings: {results['summary']['warnings']}")

    # Write artifact
    artifact_path = ARTIFACTS_DIR / "runbook_lint.json"
    with open(artifact_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nArtifact: {artifact_path}")

    return 0 if results["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
