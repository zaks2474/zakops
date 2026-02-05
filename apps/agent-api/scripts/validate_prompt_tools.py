#!/usr/bin/env python3
"""R3 REMEDIATION [P2.4]: CI script to validate prompt tool list matches registry.

This script ensures the system prompt's tool list stays in sync with the
actual registered tools in LangGraph, preventing drift.

Usage (in Docker container):
    docker exec zakops-agent-api python scripts/validate_prompt_tools.py

Usage (with CI mode - no deps required):
    CI=true python scripts/validate_prompt_tools.py

Exit codes:
    0 - Validation passed
    1 - Validation failed (tool list mismatch)
"""

import sys
import os
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# CI mode: validate without loading actual tools (for environments without full deps)
CI_MODE = os.getenv("CI", "false").lower() == "true"

# Known tools list for CI mode (must be kept in sync manually)
KNOWN_TOOLS = [
    ("duckduckgo_search", False),
    ("transition_deal", True),
    ("get_deal", False),
    ("search_deals", False),
    ("create_deal", True),
    ("add_note", True),
    ("get_deal_health", False),
]


def validate_ci_mode():
    """CI mode validation using known tools list."""
    # Read prompt file
    prompt_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app", "core", "prompts", "system.md"
    )

    with open(prompt_path, "r") as f:
        prompt_content = f.read()

    # Extract tool names mentioned in prompt (pattern: **tool_name**)
    prompt_tools = set(re.findall(r'\*\*(\w+)\*\*', prompt_content))

    # Filter to only known tool-like names
    known_tool_names = {t[0] for t in KNOWN_TOOLS}
    prompt_tools = prompt_tools & known_tool_names

    # Check for mismatches
    missing_in_prompt = known_tool_names - prompt_tools
    extra_in_prompt = prompt_tools - known_tool_names

    return missing_in_prompt, extra_in_prompt, known_tool_names


def main():
    """Run prompt tool list validation."""
    print("=" * 60)
    print("R3 REMEDIATION [P2.4]: Prompt Tool List Validation")
    print("=" * 60)

    if CI_MODE:
        print("\nRunning in CI mode (using static tool list)")
        print(f"\nKnown tools ({len(KNOWN_TOOLS)}):")
        for tool_name, requires_hitl in KNOWN_TOOLS:
            hitl_marker = " [HITL]" if requires_hitl else ""
            print(f"  - {tool_name}{hitl_marker}")

        missing, extra, known = validate_ci_mode()

        if missing or extra:
            print("\n❌ FAIL: Prompt tool list does NOT match known tools")
            if missing:
                print(f"\n  Missing in prompt: {missing}")
            if extra:
                print(f"\n  Extra in prompt (not in known list): {extra}")
            print("\nTo fix:")
            print("  1. Update app/core/prompts/system.md to include all tools")
            print("  2. Or update KNOWN_TOOLS in this script if tools were added")
            return 1
        else:
            print(f"\n✅ PASS: Prompt tool list matches known tools ({len(known)} tools)")
            return 0
    else:
        # Full validation with actual imports
        try:
            from app.core.prompts import validate_prompt_tool_list, get_tool_list_from_registry
        except ImportError as e:
            print(f"\n⚠️  Cannot import modules (run in Docker or use CI=true): {e}")
            return 1

        # Get registered tools
        tools = get_tool_list_from_registry()
        print(f"\nRegistered tools ({len(tools)}):")
        for tool in tools:
            hitl_marker = " [HITL]" if tool.requires_hitl else ""
            print(f"  - {tool.name}{hitl_marker}")

        # Run validation
        print("\nValidating prompt tool list...")
        is_valid, message = validate_prompt_tool_list()

        print(f"\n{message}")

        if is_valid:
            print("\n✅ PASS: Prompt tool list matches registry")
            return 0
        else:
            print("\n❌ FAIL: Prompt tool list does NOT match registry")
            print("\nTo fix:")
            print("  1. Update app/core/prompts/system.md to include all registered tools")
            print("  2. Or use generate_dynamic_tool_section() to auto-generate the list")
            return 1


if __name__ == "__main__":
    sys.exit(main())
