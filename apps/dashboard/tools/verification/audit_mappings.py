#!/usr/bin/env python3
"""
Mapping Audit Script - Phase 2
Verifies every documented endpoint in UI_BACKEND_MAPPING.json with live HTTP requests.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any

# Configuration
MAPPING_FILE = "/home/zaks/bookkeeping/docs/ui-backend-mapping/UI_BACKEND_MAPPING.json"
DASHBOARD_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTIFACTS_DIR = os.path.join(DASHBOARD_DIR, "gate_artifacts")
API_BASE_URL = "http://localhost:8091"

# Ensure artifacts directory exists
os.makedirs(ARTIFACTS_DIR, exist_ok=True)


def load_mappings() -> dict:
    """Load the UI-Backend mapping configuration."""
    with open(MAPPING_FILE, "r") as f:
        return json.load(f)


def make_request(method: str, endpoint: str, base_url: str = API_BASE_URL) -> dict:
    """Make an HTTP request and return result info."""
    # Build full URL
    url = f"{base_url}{endpoint}"

    # Replace path parameters with test values
    import re
    # Replace any {param_name} with test-id-123
    url = re.sub(r'\{[^}]+\}', 'test-id-123', url)

    result = {
        "method": method,
        "endpoint": endpoint,
        "url": url,
        "status": "unknown",
        "http_code": None,
        "error": None
    }

    try:
        req = urllib.request.Request(url, method=method)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")

        # For POST/PATCH/DELETE, we need to provide empty body for some methods
        if method in ["POST", "PATCH", "PUT"]:
            req.data = b"{}"

        with urllib.request.urlopen(req, timeout=10) as response:
            result["http_code"] = response.status
            # 2xx codes are success, some 4xx are expected (e.g., 404 for non-existent resources)
            if 200 <= response.status < 300:
                result["status"] = "pass"
            elif response.status in [400, 422]:
                # Bad request/validation error is expected for empty test requests
                result["status"] = "pass"
                result["note"] = "Validation error expected with empty/test data"
            elif response.status == 404:
                # 404 is expected for endpoints with path parameter placeholders
                if "{" in endpoint or "test-id" in url:
                    result["status"] = "pass"
                    result["note"] = "404 expected for non-existent resource ID"
                else:
                    result["status"] = "fail"
            else:
                result["status"] = "warn"

    except urllib.error.HTTPError as e:
        result["http_code"] = e.code
        # Handle expected error codes
        if e.code in [400, 422]:
            result["status"] = "pass"
            result["note"] = "Validation error expected with empty/test data"
        elif e.code == 404:
            # Check if endpoint has path parameters (will have been substituted)
            if "{" in endpoint or "test-id" in url:
                result["status"] = "pass"
                result["note"] = "404 expected for non-existent resource ID"
            else:
                result["status"] = "fail"
                result["error"] = f"Endpoint not found: {url}"
        elif e.code == 405:
            # Method not allowed - endpoint exists but doesn't support this method
            result["status"] = "fail"
            result["error"] = f"Method {method} not allowed"
        else:
            result["status"] = "fail"
            result["error"] = f"HTTP {e.code}: {e.reason}"

    except urllib.error.URLError as e:
        result["status"] = "fail"
        result["error"] = f"Connection error: {str(e.reason)}"

    except Exception as e:
        result["status"] = "fail"
        result["error"] = str(e)

    return result


def audit_feature(feature: dict) -> dict:
    """Audit all endpoints for a feature."""
    feature_name = feature.get("feature", "Unknown")
    route = feature.get("route", "Unknown")
    endpoints = feature.get("endpoints", [])

    results = {
        "feature": feature_name,
        "route": route,
        "endpoints": [],
        "pass_count": 0,
        "fail_count": 0,
        "warn_count": 0
    }

    for endpoint_def in endpoints:
        ui_element = endpoint_def.get("ui_element", "Unknown")
        method = endpoint_def.get("method", "GET")
        endpoint = endpoint_def.get("endpoint", "")

        # Skip streaming endpoints for now
        if endpoint_def.get("notes") and "SSE" in endpoint_def.get("notes", ""):
            result = {
                "ui_element": ui_element,
                "method": method,
                "endpoint": endpoint,
                "status": "skip",
                "note": "SSE streaming endpoint - not tested with simple HTTP"
            }
        else:
            result = make_request(method, endpoint)
            result["ui_element"] = ui_element

        results["endpoints"].append(result)

        if result["status"] == "pass":
            results["pass_count"] += 1
        elif result["status"] == "fail":
            results["fail_count"] += 1
        elif result["status"] == "warn":
            results["warn_count"] += 1

    return results


def main():
    print("=" * 50)
    print("Mapping Audit - Phase 2")
    print("=" * 50)
    print()

    try:
        mappings = load_mappings()
    except Exception as e:
        print(f"ERROR: Failed to load mappings: {e}")
        sys.exit(1)

    features = mappings.get("mappings", [])
    all_results = []
    total_pass = 0
    total_fail = 0
    total_warn = 0

    for feature in features:
        print(f"Auditing: {feature.get('feature', 'Unknown')} ({feature.get('route', '')})")
        result = audit_feature(feature)
        all_results.append(result)

        total_pass += result["pass_count"]
        total_fail += result["fail_count"]
        total_warn += result["warn_count"]

        for ep in result["endpoints"]:
            status_icon = "✓" if ep["status"] == "pass" else "✗" if ep["status"] == "fail" else "⚠" if ep["status"] == "warn" else "○"
            print(f"  {status_icon} {ep.get('method', 'GET')} {ep.get('endpoint', '')} - {ep.get('ui_element', '')}")
            if ep.get("error"):
                print(f"      Error: {ep['error']}")
        print()

    print("=" * 50)
    print(f"Summary: {total_pass} passed, {total_fail} failed, {total_warn} warnings")
    print("=" * 50)

    # Determine overall status
    overall_status = "pass" if total_fail == 0 else "fail"

    # Write results
    output = {
        "phase": "mapping_audit",
        "timestamp": datetime.now().isoformat(),
        "overall_status": overall_status,
        "api_base_url": API_BASE_URL,
        "mapping_file": MAPPING_FILE,
        "summary": {
            "total_pass": total_pass,
            "total_fail": total_fail,
            "total_warn": total_warn
        },
        "features": all_results
    }

    output_file = os.path.join(ARTIFACTS_DIR, "mapping_audit_results.json")
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults written to: {output_file}")

    if total_fail > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
