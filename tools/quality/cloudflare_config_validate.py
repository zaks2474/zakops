#!/usr/bin/env python3
"""Validate Cloudflare configuration files.

Validates configuration structure without requiring credentials.
This allows offline validation in CI environments.
"""

import json
import sys
from pathlib import Path
from typing import List

import yaml


def validate_endpoint_classification(path: Path) -> dict:
    """Validate endpoint classification file.

    Args:
        path: Path to endpoint_classification.yaml

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
    required_keys = ["version", "endpoints", "rate_limit_profiles"]
    for key in required_keys:
        if key not in data:
            issues.append(f"Missing required key: {key}")

    # Validate rate limit profiles
    profiles = data.get("rate_limit_profiles", {})
    for profile_name, profile in profiles.items():
        if "requests_per_minute" not in profile:
            issues.append(f"Profile '{profile_name}' missing requests_per_minute")

    # Validate endpoints
    endpoints = data.get("endpoints", [])
    valid_classifications = {"public", "authenticated", "admin", "internal"}
    valid_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"}

    seen_endpoints = set()

    for i, endpoint in enumerate(endpoints):
        ep_id = endpoint.get("path", f"endpoint[{i}]")

        required_fields = ["path", "method", "classification"]
        for field in required_fields:
            if field not in endpoint:
                issues.append(f"{ep_id}: Missing field '{field}'")

        # Check classification
        classification = endpoint.get("classification")
        if classification and classification not in valid_classifications:
            issues.append(f"{ep_id}: Invalid classification '{classification}'")

        # Check method
        method = endpoint.get("method")
        if method and method not in valid_methods:
            issues.append(f"{ep_id}: Invalid method '{method}'")

        # Check rate limit profile references valid profile
        rate_profile = endpoint.get("rate_limit_profile")
        if rate_profile and rate_profile not in profiles:
            issues.append(f"{ep_id}: Unknown rate_limit_profile '{rate_profile}'")

        # Check for duplicates
        ep_key = f"{method} {ep_id}"
        if ep_key in seen_endpoints:
            issues.append(f"Duplicate endpoint: {ep_key}")
        seen_endpoints.add(ep_key)

        # Auth consistency check
        auth_required = endpoint.get("auth_required", False)
        if classification == "public" and auth_required:
            issues.append(f"{ep_id}: Public endpoint should not require auth")
        if classification in ("authenticated", "admin") and not auth_required:
            issues.append(f"{ep_id}: {classification} endpoint should require auth")

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "endpoints_count": len(endpoints),
        "file": str(path),
    }


def validate_cloudflared_config(path: Path) -> dict:
    """Validate cloudflared config structure.

    Args:
        path: Path to cloudflared_config.yml

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

    # Check required keys (not values - those may be placeholders)
    required_keys = ["tunnel", "ingress"]
    for key in required_keys:
        if key not in data:
            issues.append(f"Missing required key: {key}")

    # Validate ingress rules
    ingress = data.get("ingress", [])
    if not ingress:
        issues.append("No ingress rules defined")
    else:
        # Last rule must be catch-all
        last_rule = ingress[-1]
        if "hostname" in last_rule:
            issues.append("Last ingress rule should be catch-all (no hostname)")

        # Check each rule has service
        for i, rule in enumerate(ingress):
            if "service" not in rule:
                issues.append(f"Ingress rule {i} missing 'service'")

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "ingress_rules": len(ingress),
        "file": str(path),
    }


def validate_access_policies(path: Path) -> dict:
    """Validate access policies structure.

    Args:
        path: Path to access_policies.yaml

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

    # Check applications
    applications = data.get("applications", [])
    if not applications:
        issues.append("No applications defined")

    valid_decisions = {"allow", "deny", "bypass", "service_auth"}

    for app in applications:
        app_name = app.get("name", "unknown")

        if "domain" not in app:
            issues.append(f"Application '{app_name}' missing domain")

        policies = app.get("policies", [])
        if not policies:
            issues.append(f"Application '{app_name}' has no policies")

        for policy in policies:
            policy_name = policy.get("name", "unknown")
            decision = policy.get("decision")

            if decision and decision not in valid_decisions:
                issues.append(
                    f"Policy '{policy_name}' has invalid decision '{decision}'"
                )

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "applications_count": len(applications),
        "file": str(path),
    }


def main():
    """Run Cloudflare configuration validation."""
    # Default paths
    project_root = Path(__file__).parent.parent.parent
    external_access = project_root / "ops" / "external_access"

    results = {
        "endpoint_classification": validate_endpoint_classification(
            external_access / "endpoint_classification.yaml"
        ),
        "cloudflared_config": validate_cloudflared_config(
            external_access / "cloudflare" / "cloudflared_config.yml"
        ),
        "access_policies": validate_access_policies(
            external_access / "cloudflare" / "access_policies.yaml"
        ),
    }

    # Overall pass/fail
    all_passed = all(r["passed"] for r in results.values())
    results["overall_passed"] = all_passed

    # Print results
    print(json.dumps(results, indent=2))

    # Write artifact
    artifacts_dir = project_root / "artifacts" / "policies"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    with open(artifacts_dir / "cloudflare_validation.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nArtifact written to: {artifacts_dir / 'cloudflare_validation.json'}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
