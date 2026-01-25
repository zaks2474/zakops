#!/usr/bin/env python3
"""Game Day Scenario Runner.

Orchestrates chaos engineering game day scenarios.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "chaos"

# Available scenarios
SCENARIOS = {
    "gd1": {
        "name": "Database Failure",
        "script": "gd1_db_failure.sh",
        "description": "Simulates PostgreSQL failure and tests recovery",
        "safe": False,
    },
    "gd2": {
        "name": "LLM Unavailable",
        "script": "gd2_llm_unavailable.sh",
        "description": "Simulates vLLM/Ollama failure, expects structured 503",
        "safe": True,
    },
    "gd3": {
        "name": "Redis Failure",
        "script": "gd3_redis_failure.sh",
        "description": "Simulates Redis failure and graceful degradation",
        "safe": True,
    },
    "gd4": {
        "name": "Network Partition",
        "script": "gd4_network_partition.sh",
        "description": "Blocks external network, internal ops should continue",
        "safe": False,
    },
    "gd5": {
        "name": "High Latency",
        "script": "gd5_high_latency.sh",
        "description": "Adds 5s delay via tc netem, tests timeouts",
        "safe": False,
    },
    "gd6": {
        "name": "Memory Pressure",
        "script": "gd6_memory_pressure.sh",
        "description": "Limits container memory, tests OOM handling",
        "safe": False,
    },
}

# Safe scenarios for CI/default runs
SAFE_SCENARIOS = ["gd2", "gd3"]


def run_scenario(scenario_id: str) -> dict[str, Any]:
    """Run a single game day scenario."""
    if scenario_id not in SCENARIOS:
        return {
            "scenario_id": scenario_id,
            "status": "error",
            "message": f"Unknown scenario: {scenario_id}",
        }

    scenario = SCENARIOS[scenario_id]
    script_path = SCRIPT_DIR / scenario["script"]

    if not script_path.exists():
        return {
            "scenario_id": scenario_id,
            "status": "error",
            "message": f"Script not found: {script_path}",
        }

    print(f"\n{'='*60}")
    print(f"Running: {scenario_id} - {scenario['name']}")
    print(f"Description: {scenario['description']}")
    print(f"{'='*60}\n")

    try:
        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout per scenario
            cwd=str(SCRIPT_DIR),
        )

        print(result.stdout)
        if result.stderr:
            print(f"STDERR: {result.stderr}", file=sys.stderr)

        return {
            "scenario_id": scenario_id,
            "name": scenario["name"],
            "status": "passed" if result.returncode == 0 else "failed",
            "exit_code": result.returncode,
            "safe": scenario["safe"],
        }

    except subprocess.TimeoutExpired:
        return {
            "scenario_id": scenario_id,
            "name": scenario["name"],
            "status": "timeout",
            "message": "Scenario timed out after 300s",
        }
    except Exception as e:
        return {
            "scenario_id": scenario_id,
            "name": scenario["name"],
            "status": "error",
            "message": str(e),
        }


def main():
    parser = argparse.ArgumentParser(
        description="Run game day chaos scenarios",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Available scenarios:
  gd1  Database Failure      (PostgreSQL)
  gd2  LLM Unavailable       (vLLM/Ollama) [SAFE]
  gd3  Redis Failure         (Redis cache) [SAFE]
  gd4  Network Partition     (External network)
  gd5  High Latency          (tc netem)
  gd6  Memory Pressure       (OOM)

Examples:
  %(prog)s --scenario gd2           # Run single scenario
  %(prog)s --scenario gd2,gd3       # Run multiple scenarios
  %(prog)s --full                   # Run all scenarios
  %(prog)s                          # Run safe scenarios (default: gd2, gd3)
        """,
    )

    parser.add_argument(
        "--scenario",
        "-s",
        type=str,
        help="Scenario(s) to run (comma-separated, e.g., gd2,gd3)",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Run all scenarios (not just safe ones)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available scenarios and exit",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be run without executing",
    )

    args = parser.parse_args()

    # List scenarios
    if args.list:
        print("Available Game Day Scenarios:")
        print("-" * 60)
        for sid, info in SCENARIOS.items():
            safe_tag = "[SAFE]" if info["safe"] else ""
            print(f"  {sid}: {info['name']} {safe_tag}")
            print(f"       {info['description']}")
        return 0

    # Determine which scenarios to run
    if args.scenario:
        scenarios_to_run = [s.strip() for s in args.scenario.split(",")]
    elif args.full:
        scenarios_to_run = list(SCENARIOS.keys())
    else:
        scenarios_to_run = SAFE_SCENARIOS

    # Validate scenarios
    for s in scenarios_to_run:
        if s not in SCENARIOS:
            print(f"Error: Unknown scenario '{s}'", file=sys.stderr)
            print(f"Available: {', '.join(SCENARIOS.keys())}", file=sys.stderr)
            return 1

    # Dry run
    if args.dry_run:
        print("Would run the following scenarios:")
        for s in scenarios_to_run:
            info = SCENARIOS[s]
            print(f"  {s}: {info['name']}")
        return 0

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Run scenarios
    results = []
    for scenario_id in scenarios_to_run:
        result = run_scenario(scenario_id)
        results.append(result)

    # Generate summary report
    timestamp = datetime.utcnow().isoformat() + "Z"
    passed = sum(1 for r in results if r["status"] == "passed")
    failed = len(results) - passed

    summary = {
        "timestamp": timestamp,
        "scenarios_run": len(results),
        "passed": passed,
        "failed": failed,
        "results": results,
    }

    # Write summary artifact
    summary_file = ARTIFACTS_DIR / f"game_day_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)

    # Print summary
    print("\n" + "=" * 60)
    print("GAME DAY SUMMARY")
    print("=" * 60)
    print(f"Scenarios run: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"\nArtifact: {summary_file}")

    for r in results:
        status_icon = "✓" if r["status"] == "passed" else "✗"
        print(f"  {status_icon} {r['scenario_id']}: {r.get('name', 'Unknown')} - {r['status']}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
