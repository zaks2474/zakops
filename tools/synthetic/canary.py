#!/usr/bin/env python3
"""Synthetic canary monitoring for ZakOps services.

Performs health checks against all services and records results.
Gracefully skips checks if services are not running.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

# Paths
ROOT = Path(__file__).parent.parent.parent
OUTPUT_FILE = ROOT / "artifacts" / "observability" / "canary_run.json"

# Service endpoints
SERVICES = {
    "backend": {
        "health": "http://localhost:8090/health",
        "required": False,
    },
    "orchestration": {
        "health": "http://localhost:9200/health",
        "required": False,
    },
    "agent-api": {
        "health": "http://localhost:8095/health",
        "invoke": "http://localhost:8095/api/v1/agent/invoke",
        "required": False,
    },
}

TIMEOUT = 5  # seconds


def check_endpoint(url: str, method: str = "GET", timeout: int = TIMEOUT) -> dict:
    """Check a single endpoint."""
    start = time.time()
    try:
        req = Request(url, method=method)
        with urlopen(req, timeout=timeout) as response:
            latency_ms = (time.time() - start) * 1000
            return {
                "url": url,
                "status": "up",
                "status_code": response.status,
                "latency_ms": round(latency_ms, 2),
            }
    except URLError as e:
        latency_ms = (time.time() - start) * 1000
        reason = str(e.reason) if hasattr(e, "reason") else str(e)
        return {
            "url": url,
            "status": "down",
            "error": reason,
            "latency_ms": round(latency_ms, 2),
        }
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        return {
            "url": url,
            "status": "error",
            "error": str(e),
            "latency_ms": round(latency_ms, 2),
        }


def run_canary() -> dict:
    """Run all canary checks."""
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {},
        "summary": {
            "total": 0,
            "up": 0,
            "down": 0,
            "skipped": 0,
        },
    }

    for service_name, config in SERVICES.items():
        service_results = {"endpoints": []}

        # Check health endpoint
        if "health" in config:
            check = check_endpoint(config["health"])
            service_results["endpoints"].append(check)
            results["summary"]["total"] += 1

            if check["status"] == "up":
                results["summary"]["up"] += 1
            else:
                results["summary"]["down"] += 1

        # Check invoke endpoint (only if health is up)
        if "invoke" in config:
            health_up = any(
                e["status"] == "up" and "health" in e["url"]
                for e in service_results["endpoints"]
            )
            if health_up:
                check = check_endpoint(config["invoke"], method="HEAD")
                service_results["endpoints"].append(check)
                results["summary"]["total"] += 1
                if check["status"] == "up":
                    results["summary"]["up"] += 1
                else:
                    results["summary"]["down"] += 1
            else:
                results["summary"]["skipped"] += 1

        results["services"][service_name] = service_results

    # Calculate overall status
    if results["summary"]["total"] == 0:
        results["overall_status"] = "no_services"
    elif results["summary"]["up"] == results["summary"]["total"]:
        results["overall_status"] = "healthy"
    elif results["summary"]["up"] > 0:
        results["overall_status"] = "degraded"
    else:
        results["overall_status"] = "down"

    return results


def main():
    """Run canary and output results."""
    print("=== ZakOps Canary Monitor ===")
    print(f"Checking {len(SERVICES)} services...")

    results = run_canary()

    # Write results
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2)

    # Print summary
    print(f"\nResults: {results['summary']['up']}/{results['summary']['total']} endpoints up")
    print(f"Overall status: {results['overall_status']}")
    print(f"Results written to {OUTPUT_FILE}")

    # Return 0 even if services are down (graceful skip)
    # The canary just reports status, it doesn't fail the gate
    return 0


if __name__ == "__main__":
    sys.exit(main())
