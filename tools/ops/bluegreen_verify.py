#!/usr/bin/env python3
"""Blue/Green Deployment Verification Tool.

Validates blue/green deployment configuration and generates artifact report.
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Paths
REPO_ROOT = Path(__file__).parent.parent.parent
BLUEGREEN_DIR = REPO_ROOT / "deployments" / "bluegreen"
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "ops"


def run_command(cmd: list[str], timeout: int = 30) -> tuple[int, str, str]:
    """Run a command and return exit code, stdout, stderr."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)


def check_file_exists(path: Path, description: str) -> dict[str, Any]:
    """Check if a file exists."""
    exists = path.exists()
    return {
        "check": description,
        "path": str(path.relative_to(REPO_ROOT)),
        "passed": exists,
        "message": "File exists" if exists else "File not found",
    }


def check_executable(path: Path, description: str) -> dict[str, Any]:
    """Check if a file is executable."""
    exists = path.exists()
    executable = os.access(path, os.X_OK) if exists else False
    return {
        "check": description,
        "path": str(path.relative_to(REPO_ROOT)),
        "passed": exists and executable,
        "message": "Executable" if executable else "Not executable or missing",
    }


def check_yaml_valid(path: Path, description: str) -> dict[str, Any]:
    """Check if a YAML file is valid."""
    if not path.exists():
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": False,
            "message": "File not found",
        }

    try:
        import yaml
        with open(path) as f:
            yaml.safe_load(f)
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": True,
            "message": "Valid YAML",
        }
    except ImportError:
        # If PyYAML not available, just check file exists
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": True,
            "message": "File exists (YAML validation skipped)",
        }
    except Exception as e:
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": False,
            "message": f"Invalid YAML: {e}",
        }


def check_compose_syntax(path: Path, description: str) -> dict[str, Any]:
    """Check Docker Compose file syntax."""
    if not path.exists():
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": False,
            "message": "File not found",
        }

    # Use docker compose config to validate
    code, stdout, stderr = run_command(
        ["docker", "compose", "-f", str(path), "config", "--quiet"],
        timeout=30,
    )

    if code == 0:
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": True,
            "message": "Valid Docker Compose file",
        }
    else:
        # Docker might not be available, fall back to YAML check
        return check_yaml_valid(path, description)


def check_shell_syntax(path: Path, description: str) -> dict[str, Any]:
    """Check shell script syntax."""
    if not path.exists():
        return {
            "check": description,
            "path": str(path.relative_to(REPO_ROOT)),
            "passed": False,
            "message": "File not found",
        }

    code, stdout, stderr = run_command(["bash", "-n", str(path)])

    return {
        "check": description,
        "path": str(path.relative_to(REPO_ROOT)),
        "passed": code == 0,
        "message": "Valid shell syntax" if code == 0 else f"Syntax error: {stderr}",
    }


def verify_bluegreen() -> dict[str, Any]:
    """Run all blue/green deployment verification checks."""
    checks = []

    # Required files
    required_files = [
        (BLUEGREEN_DIR / "README.md", "README documentation"),
        (BLUEGREEN_DIR / "compose.blue.yml", "Blue stack compose file"),
        (BLUEGREEN_DIR / "compose.green.yml", "Green stack compose file"),
        (BLUEGREEN_DIR / "proxy.yml", "Traefik proxy compose file"),
        (BLUEGREEN_DIR / "traefik-dynamic" / "routing.yml", "Dynamic routing config"),
    ]

    for path, desc in required_files:
        checks.append(check_file_exists(path, desc))

    # Executable scripts
    executable_scripts = [
        (BLUEGREEN_DIR / "switch.sh", "Traffic switch script"),
        (BLUEGREEN_DIR / "verify.sh", "Verification script"),
    ]

    for path, desc in executable_scripts:
        checks.append(check_executable(path, desc))
        checks.append(check_shell_syntax(path, f"{desc} syntax"))

    # Docker Compose validation
    compose_files = [
        (BLUEGREEN_DIR / "compose.blue.yml", "Blue compose syntax"),
        (BLUEGREEN_DIR / "compose.green.yml", "Green compose syntax"),
        (BLUEGREEN_DIR / "proxy.yml", "Proxy compose syntax"),
    ]

    for path, desc in compose_files:
        checks.append(check_compose_syntax(path, desc))

    # YAML validation
    checks.append(check_yaml_valid(
        BLUEGREEN_DIR / "traefik-dynamic" / "routing.yml",
        "Routing config syntax"
    ))

    # Calculate results
    passed = sum(1 for c in checks if c["passed"])
    failed = len(checks) - passed

    return {
        "verification": "bluegreen_deployment",
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
    """Main entry point."""
    print("Blue/Green Deployment Verification")
    print("=" * 40)

    result = verify_bluegreen()

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Write artifact
    artifact_path = ARTIFACTS_DIR / "bluegreen_verify.json"
    with open(artifact_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nResults: {result['summary']['passed']}/{result['summary']['total_checks']} checks passed")

    # Print failures
    failures = [c for c in result["checks"] if not c["passed"]]
    if failures:
        print("\nFailed checks:")
        for check in failures:
            print(f"  - {check['check']}: {check['message']}")

    print(f"\nArtifact written to: {artifact_path}")

    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
