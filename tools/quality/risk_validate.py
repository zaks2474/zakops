#!/usr/bin/env python3
"""
Risk Register Validator

Validates the risk register for:
- Minimum 12 documented risks
- Required fields per risk
- NIST AI RMF category alignment
- Valid severity levels
"""

import json
import re
import sys
from pathlib import Path


def parse_risk_register(content: str) -> list[dict]:
    """Parse risk register markdown into structured data."""
    risks = []

    # Find all RISK-XXX sections
    risk_pattern = r"### (RISK-\d+):[^\n]+"

    for match in re.finditer(risk_pattern, content):
        risk_id = match.group(1)
        start = match.end()

        # Find the next risk or end of section (stop at next ### or ## or ---)
        next_match = re.search(r"(?:^### RISK-\d+:|^## |^---$)", content[start:], re.MULTILINE)
        if next_match:
            section = content[start:start + next_match.start()]
        else:
            section = content[start:]

        # Parse table rows
        risk_data = {"id": risk_id}

        # Look for table rows - format: | **Field** | Value |
        # The field can have multiple words like "Risk Level" or "Review Date"
        row_pattern = r"\| \*\*([^*]+)\*\* \| ([^|\n]+)"
        for row_match in re.finditer(row_pattern, section):
            field = row_match.group(1).strip().lower().replace(" ", "_")
            value = row_match.group(2).strip()
            risk_data[field] = value

        if len(risk_data) > 1:  # Has more than just ID
            risks.append(risk_data)

    return risks


def validate_risk_register(register_path: Path) -> dict:
    """Validate risk register and return validation result."""
    errors = []
    warnings = []

    # Check file exists
    if not register_path.exists():
        return {
            "passed": False,
            "errors": [f"Risk register not found: {register_path}"],
            "warnings": [],
            "risk_count": 0,
            "nist_aligned": False
        }

    # Read file
    content = register_path.read_text()

    # Parse risks
    risks = parse_risk_register(content)

    # Validate minimum count
    if len(risks) < 12:
        errors.append(f"Minimum 12 risks required, found {len(risks)}")

    # NIST AI RMF categories
    valid_categories = {
        "VAL": "Validity and Reliability",
        "SAF": "Safety",
        "SEC": "Security and Resilience",
        "PRI": "Privacy",
        "TRA": "Transparency and Accountability",
        "FAI": "Fairness and Non-discrimination"
    }

    # Required fields
    required_fields = ["category", "description", "likelihood", "impact", "mitigation", "owner", "status"]
    valid_likelihood = ["high", "medium", "low"]
    valid_impact = ["high", "medium", "low"]
    valid_status = ["mitigated", "accepted", "monitoring", "open", "in progress"]

    categories_found = set()

    for risk in risks:
        risk_id = risk.get("id", "unknown")

        # Check required fields
        for field in required_fields:
            if field not in risk:
                errors.append(f"Risk '{risk_id}' missing field: {field}")

        # Validate category
        category = risk.get("category", "")
        if category:
            # Extract category code (e.g., "VAL" from "VAL (Validity)")
            cat_match = re.match(r"(\w+)", category)
            if cat_match:
                cat_code = cat_match.group(1)
                if cat_code in valid_categories:
                    categories_found.add(cat_code)
                else:
                    warnings.append(f"Risk '{risk_id}' has non-standard category: {cat_code}")

        # Validate likelihood
        likelihood = risk.get("likelihood", "").lower()
        if likelihood and likelihood not in valid_likelihood:
            errors.append(f"Risk '{risk_id}' has invalid likelihood: {likelihood}")

        # Validate impact
        impact = risk.get("impact", "").lower()
        if impact and impact not in valid_impact:
            errors.append(f"Risk '{risk_id}' has invalid impact: {impact}")

        # Validate status
        status = risk.get("status", "").lower()
        if status and status not in valid_status:
            warnings.append(f"Risk '{risk_id}' has non-standard status: {status}")

    # Check NIST alignment
    nist_aligned = len(categories_found) >= 3
    if not nist_aligned:
        warnings.append(f"Consider covering more NIST AI RMF categories (found {len(categories_found)})")

    # Build result
    passed = len(errors) == 0

    return {
        "passed": passed,
        "errors": errors,
        "warnings": warnings,
        "risk_count": len(risks),
        "nist_aligned": nist_aligned,
        "categories_found": list(categories_found),
        "validated_risks": [r.get("id") for r in risks]
    }


def main():
    """Main entry point."""
    # Determine paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent

    register_path = repo_root / "docs" / "risk" / "RISK_REGISTER.md"
    output_dir = repo_root / "artifacts" / "quality"
    output_path = output_dir / "risk_validation.json"

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Validate
    result = validate_risk_register(register_path)

    # Write result
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    # Print summary
    if result["passed"]:
        print(f"✅ Risk register validation PASSED")
        print(f"   Risks documented: {result['risk_count']}")
        print(f"   NIST aligned: {result['nist_aligned']}")
        print(f"   Categories: {', '.join(result['categories_found'])}")
    else:
        print(f"❌ Risk register validation FAILED")
        for error in result["errors"]:
            print(f"   ERROR: {error}")

    for warning in result["warnings"]:
        print(f"   WARNING: {warning}")

    print(f"\nOutput written to: {output_path}")

    # Exit with appropriate code
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
