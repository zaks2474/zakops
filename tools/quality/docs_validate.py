#!/usr/bin/env python3
"""Validate documentation against checklist.

Checks that all required documentation exists and contains
required sections as defined in docs_checklist.yaml.
"""

import json
import os
import re
import sys
from pathlib import Path

import yaml

# Paths
ROOT = Path(__file__).parent.parent.parent
CHECKLIST_PATH = ROOT / "docs" / "docs_checklist.yaml"
OUTPUT_FILE = ROOT / "artifacts" / "docs" / "docs_validation.json"


def load_checklist() -> dict:
    """Load documentation checklist."""
    if not CHECKLIST_PATH.exists():
        return None
    with open(CHECKLIST_PATH) as f:
        return yaml.safe_load(f)


def extract_sections(content: str) -> list[str]:
    """Extract markdown section headers from content."""
    # Match ## and ### headers
    pattern = r'^#{2,3}\s+(.+)$'
    sections = []
    for line in content.split('\n'):
        match = re.match(pattern, line)
        if match:
            sections.append(match.group(1).strip())
    return sections


def check_document(doc_spec: dict) -> dict:
    """Check a single document against its specification."""
    doc_path = ROOT / doc_spec["path"]
    result = {
        "path": doc_spec["path"],
        "exists": False,
        "sections_found": [],
        "sections_missing": [],
        "line_count": 0,
        "passed": False,
    }

    if not doc_path.exists():
        result["error"] = "File not found"
        return result

    result["exists"] = True

    try:
        content = doc_path.read_text()
        result["line_count"] = len(content.split('\n'))

        # Check for required sections
        found_sections = extract_sections(content)
        result["sections_found"] = found_sections

        required_sections = doc_spec.get("required_sections", [])
        for section in required_sections:
            # Check if section exists (case-insensitive partial match)
            section_lower = section.lower()
            if not any(section_lower in s.lower() for s in found_sections):
                result["sections_missing"].append(section)

        result["passed"] = len(result["sections_missing"]) == 0

    except Exception as e:
        result["error"] = str(e)

    return result


def main():
    """Validate documentation."""
    print("=== Documentation Validator ===")

    results = {
        "passed": False,
        "summary": {
            "total": 0,
            "passed": 0,
            "failed": 0,
        },
        "documents": [],
        "errors": [],
    }

    # Load checklist
    checklist = load_checklist()
    if not checklist:
        results["errors"].append("docs_checklist.yaml not found")
        write_results(results)
        print("✗ Checklist not found")
        return 1

    documents = checklist.get("documents", [])
    results["summary"]["total"] = len(documents)

    print(f"Checking {len(documents)} documents...")

    for doc_spec in documents:
        if not doc_spec.get("required", True):
            continue

        doc_result = check_document(doc_spec)
        results["documents"].append(doc_result)

        if doc_result["passed"]:
            results["summary"]["passed"] += 1
            print(f"✓ {doc_spec['path']}")
        else:
            results["summary"]["failed"] += 1
            if doc_result.get("error"):
                print(f"✗ {doc_spec['path']}: {doc_result['error']}")
            elif doc_result["sections_missing"]:
                print(f"✗ {doc_spec['path']}: missing sections {doc_result['sections_missing']}")
            else:
                print(f"✗ {doc_spec['path']}")

    # Determine overall pass/fail
    results["passed"] = results["summary"]["failed"] == 0

    write_results(results)

    print(f"\nResults: {results['summary']['passed']}/{results['summary']['total']} passed")

    if results["passed"]:
        print("✓ Documentation validation PASSED")
        return 0
    else:
        print("✗ Documentation validation FAILED")
        return 1


def write_results(results: dict) -> None:
    """Write results to artifacts."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results written to {OUTPUT_FILE}")


if __name__ == "__main__":
    sys.exit(main())
