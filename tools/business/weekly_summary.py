#!/usr/bin/env python3
"""Weekly Business Summary Generator.

Generates a weekly summary of key business metrics.
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
ARTIFACTS_DIR = REPO_ROOT / "artifacts" / "business"


def get_mock_metrics() -> dict[str, Any]:
    """Get metrics (mock data for now, would query Prometheus/DB in production)."""
    # In production, this would query:
    # - Prometheus for counters/histograms
    # - Database for business data
    # - Analytics for user behavior

    return {
        "period": {
            "start": (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z",
            "end": datetime.utcnow().isoformat() + "Z",
        },
        "activation": {
            "users_invited": 25,
            "users_activated": 18,
            "activation_rate": 72.0,
            "target": 60.0,
            "status": "on_track",
        },
        "engagement": {
            "wau": 45,
            "mau": 62,
            "wau_mau_ratio": 72.6,
            "actions_total": 1250,
            "actions_per_user": 27.8,
        },
        "deals": {
            "created": 34,
            "updated": 156,
            "closed_won": 8,
            "closed_lost": 3,
            "pipeline_value": 425000,
        },
        "agent": {
            "invocations": 89,
            "suggestions_shown": 156,
            "suggestions_accepted": 112,
            "acceptance_rate": 71.8,
            "adoption_rate": 35.0,
            "target": 30.0,
            "status": "on_track",
        },
        "approvals": {
            "created": 45,
            "resolved": 42,
            "pending": 3,
            "avg_latency_hours": {
                "p1": 2.5,
                "p2": 18.3,
                "p3": 48.2,
            },
            "within_sla": 38,
            "sla_compliance": 90.5,
        },
        "reliability": {
            "availability": 99.7,
            "p50_latency_ms": 145,
            "p95_latency_ms": 890,
            "p99_latency_ms": 2100,
            "error_rate": 0.3,
        },
        "feedback": {
            "total": 12,
            "by_type": {
                "bug": 4,
                "feature": 5,
                "usability": 2,
                "performance": 1,
            },
            "by_severity": {
                "critical": 1,
                "high": 3,
                "medium": 5,
                "low": 3,
            },
            "resolved": 8,
            "resolution_rate": 66.7,
        },
    }


def generate_summary(metrics: dict[str, Any]) -> str:
    """Generate human-readable summary."""
    summary = []
    summary.append("=" * 60)
    summary.append("ZAKOPS WEEKLY BUSINESS SUMMARY")
    summary.append(f"Period: {metrics['period']['start'][:10]} to {metrics['period']['end'][:10]}")
    summary.append("=" * 60)

    # Activation
    summary.append("\n## ACTIVATION")
    act = metrics["activation"]
    status_icon = "✓" if act["status"] == "on_track" else "⚠"
    summary.append(f"  {status_icon} Activation Rate: {act['activation_rate']:.1f}% (target: {act['target']:.1f}%)")
    summary.append(f"    Users invited: {act['users_invited']}, activated: {act['users_activated']}")

    # Engagement
    summary.append("\n## ENGAGEMENT")
    eng = metrics["engagement"]
    summary.append(f"  Weekly Active Users: {eng['wau']}")
    summary.append(f"  Monthly Active Users: {eng['mau']}")
    summary.append(f"  WAU/MAU Ratio: {eng['wau_mau_ratio']:.1f}%")
    summary.append(f"  Total Actions: {eng['actions_total']} ({eng['actions_per_user']:.1f}/user)")

    # Deals
    summary.append("\n## DEALS")
    deals = metrics["deals"]
    summary.append(f"  Created: {deals['created']}, Updated: {deals['updated']}")
    summary.append(f"  Closed Won: {deals['closed_won']}, Closed Lost: {deals['closed_lost']}")
    summary.append(f"  Pipeline Value: ${deals['pipeline_value']:,}")

    # Agent
    summary.append("\n## AI AGENT")
    agent = metrics["agent"]
    status_icon = "✓" if agent["status"] == "on_track" else "⚠"
    summary.append(f"  {status_icon} Adoption Rate: {agent['adoption_rate']:.1f}% (target: {agent['target']:.1f}%)")
    summary.append(f"  Invocations: {agent['invocations']}")
    summary.append(f"  Suggestion Acceptance: {agent['acceptance_rate']:.1f}%")

    # Approvals
    summary.append("\n## APPROVALS")
    appr = metrics["approvals"]
    summary.append(f"  Created: {appr['created']}, Resolved: {appr['resolved']}, Pending: {appr['pending']}")
    summary.append(f"  SLA Compliance: {appr['sla_compliance']:.1f}%")
    summary.append(f"  Avg Latency - P1: {appr['avg_latency_hours']['p1']:.1f}h, P2: {appr['avg_latency_hours']['p2']:.1f}h")

    # Reliability
    summary.append("\n## RELIABILITY")
    rel = metrics["reliability"]
    summary.append(f"  Availability: {rel['availability']:.2f}%")
    summary.append(f"  Latency - P50: {rel['p50_latency_ms']}ms, P95: {rel['p95_latency_ms']}ms, P99: {rel['p99_latency_ms']}ms")
    summary.append(f"  Error Rate: {rel['error_rate']:.2f}%")

    # Feedback
    summary.append("\n## FEEDBACK")
    fb = metrics["feedback"]
    summary.append(f"  Total: {fb['total']} (Resolved: {fb['resolved']}, Rate: {fb['resolution_rate']:.1f}%)")
    summary.append(f"  By Type: Bug={fb['by_type']['bug']}, Feature={fb['by_type']['feature']}, Usability={fb['by_type']['usability']}")
    summary.append(f"  By Severity: Critical={fb['by_severity']['critical']}, High={fb['by_severity']['high']}")

    summary.append("\n" + "=" * 60)

    return "\n".join(summary)


def main() -> int:
    print("Generating Weekly Business Summary...")
    print()

    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Get metrics
    metrics = get_mock_metrics()

    # Generate summary
    summary = generate_summary(metrics)
    print(summary)

    # Write JSON artifact
    timestamp = datetime.now().strftime("%Y%m%d")
    artifact_path = ARTIFACTS_DIR / f"weekly_summary_{timestamp}.json"
    with open(artifact_path, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "metrics": metrics,
        }, f, indent=2)

    print(f"\nArtifact: {artifact_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
