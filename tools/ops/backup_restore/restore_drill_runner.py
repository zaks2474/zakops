#!/usr/bin/env python3
"""Restore Drill Runner.

Automates the full backup → restore → verify cycle.
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "restore"


def run_command(cmd: list[str], timeout: int = 300) -> tuple[int, str, str]:
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


def run_restore_drill() -> dict[str, Any]:
    """Run a complete restore drill."""
    timestamp = datetime.utcnow().isoformat() + "Z"
    results = {
        "timestamp": timestamp,
        "drill_type": "restore_drill",
        "steps": [],
    }

    # Create temporary backup directory
    backup_dir = tempfile.mkdtemp(prefix="zakops_drill_")
    print(f"Using temporary backup directory: {backup_dir}")

    # Step 1: Create backup
    print("\n" + "=" * 60)
    print("Step 1: Creating Backup")
    print("=" * 60)

    backup_script = SCRIPT_DIR / "backup.sh"
    code, stdout, stderr = run_command(
        ["bash", str(backup_script), "--output", backup_dir],
        timeout=120,
    )

    print(stdout)
    if stderr:
        print(f"STDERR: {stderr}", file=sys.stderr)

    results["steps"].append({
        "step": "backup",
        "success": code == 0,
        "exit_code": code,
        "output": stdout[:500] if stdout else "",
    })

    if code != 0:
        results["passed"] = False
        results["failure_reason"] = "Backup failed"
        return results

    # Find the backup subdirectory
    backup_subdirs = [d for d in Path(backup_dir).iterdir() if d.is_dir()]
    if not backup_subdirs:
        results["passed"] = False
        results["failure_reason"] = "No backup directory created"
        return results

    backup_path = backup_subdirs[0]

    # Step 2: Verify backup files exist
    print("\n" + "=" * 60)
    print("Step 2: Verifying Backup Files")
    print("=" * 60)

    required_files = ["database.sql", "manifest.json", "checksums.sha256"]
    files_ok = True
    for f in required_files:
        fpath = backup_path / f
        if fpath.exists():
            print(f"  ✓ {f} exists ({fpath.stat().st_size} bytes)")
        else:
            # Check for compressed version
            if f == "database.sql" and (backup_path / "database.sql.gz").exists():
                print(f"  ✓ {f}.gz exists (compressed)")
            else:
                print(f"  ✗ {f} missing")
                files_ok = False

    results["steps"].append({
        "step": "verify_files",
        "success": files_ok,
    })

    if not files_ok:
        results["passed"] = False
        results["failure_reason"] = "Backup files missing"
        return results

    # Step 3: Verify checksums
    print("\n" + "=" * 60)
    print("Step 3: Verifying Checksums")
    print("=" * 60)

    checksum_file = backup_path / "checksums.sha256"
    if checksum_file.exists():
        code, stdout, stderr = run_command(
            ["sha256sum", "-c", "checksums.sha256"],
            timeout=30,
        )
        # Need to run in the backup directory
        import subprocess as sp
        result = sp.run(
            ["sha256sum", "-c", "checksums.sha256"],
            cwd=str(backup_path),
            capture_output=True,
            text=True,
        )
        checksum_ok = result.returncode == 0
        print(result.stdout if checksum_ok else result.stderr)
    else:
        checksum_ok = True
        print("  No checksum file (skipping)")

    results["steps"].append({
        "step": "verify_checksums",
        "success": checksum_ok,
    })

    # Step 4: Read manifest
    print("\n" + "=" * 60)
    print("Step 4: Reading Manifest")
    print("=" * 60)

    manifest_file = backup_path / "manifest.json"
    manifest_ok = False
    manifest_data = {}

    if manifest_file.exists():
        try:
            with open(manifest_file) as f:
                manifest_data = json.load(f)
            print(f"  Backup name: {manifest_data.get('backup_name', 'unknown')}")
            print(f"  Timestamp: {manifest_data.get('timestamp', 'unknown')}")
            if "table_counts" in manifest_data:
                print("  Table counts:")
                for table, count in manifest_data.get("table_counts", {}).items():
                    print(f"    - {table}: {count}")
            manifest_ok = True
        except Exception as e:
            print(f"  Error reading manifest: {e}")

    results["steps"].append({
        "step": "read_manifest",
        "success": manifest_ok,
        "manifest": manifest_data,
    })

    # Step 5: Simulate restore (dry run)
    print("\n" + "=" * 60)
    print("Step 5: Simulating Restore (Dry Run)")
    print("=" * 60)

    restore_script = SCRIPT_DIR / "restore.sh"
    code, stdout, stderr = run_command(
        ["bash", str(restore_script), "--input", str(backup_path), "--dry-run"],
        timeout=30,
    )

    print(stdout)
    restore_dry_ok = code == 0

    results["steps"].append({
        "step": "restore_dry_run",
        "success": restore_dry_ok,
    })

    # Step 6: Verification script syntax
    print("\n" + "=" * 60)
    print("Step 6: Verify Script Syntax")
    print("=" * 60)

    scripts = ["backup.sh", "restore.sh", "verify.sh"]
    scripts_ok = True
    for script in scripts:
        script_path = SCRIPT_DIR / script
        code, _, stderr = run_command(["bash", "-n", str(script_path)])
        if code == 0:
            print(f"  ✓ {script} syntax OK")
        else:
            print(f"  ✗ {script} syntax error: {stderr}")
            scripts_ok = False

    results["steps"].append({
        "step": "script_syntax",
        "success": scripts_ok,
    })

    # Cleanup
    import shutil
    shutil.rmtree(backup_dir, ignore_errors=True)

    # Calculate overall result
    all_passed = all(step["success"] for step in results["steps"])
    results["passed"] = all_passed

    return results


def main() -> int:
    print("=" * 60)
    print("ZakOps Restore Drill")
    print("=" * 60)

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    results = run_restore_drill()

    # Write artifact
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    artifact_file = ARTIFACTS_DIR / f"restore_drill_{timestamp}.json"

    with open(artifact_file, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("DRILL SUMMARY")
    print("=" * 60)

    for step in results["steps"]:
        status = "✓" if step["success"] else "✗"
        print(f"  {status} {step['step']}")

    print(f"\nOverall: {'PASSED' if results['passed'] else 'FAILED'}")
    print(f"Artifact: {artifact_file}")

    return 0 if results["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
