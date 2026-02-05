"""This file contains the prompts for the agent.

R3 REMEDIATION [P2.3]: Added prompt versioning and hash computation.
R3 REMEDIATION [P2.4]: Added dynamic tool list injection.
"""

import hashlib
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from app.core.config import settings


@dataclass
class PromptInfo:
    """R3 REMEDIATION [P2.3]: Prompt metadata for traceability."""
    content: str
    version: str
    content_hash: str


@dataclass
class ToolInfo:
    """R3 REMEDIATION [P2.4]: Tool metadata for prompt injection."""
    name: str
    description: str
    requires_hitl: bool


# R3 REMEDIATION [P2.3]: Cache for prompt info (version and hash)
_prompt_cache: Optional[PromptInfo] = None


def _extract_prompt_version(content: str) -> str:
    """Extract version from prompt header comment.

    Format: <!-- PROMPT_VERSION: v1.0.0-r3 -->
    """
    match = re.search(r'<!--\s*PROMPT_VERSION:\s*(\S+)\s*-->', content)
    return match.group(1) if match else "unknown"


def _compute_prompt_hash(content: str) -> str:
    """Compute SHA-256 hash of prompt content."""
    return hashlib.sha256(content.encode()).hexdigest()[:16]  # First 16 chars


def load_system_prompt(**kwargs) -> str:
    """Load the system prompt from the file.

    R3 REMEDIATION [P2.3]: Computes version and hash on first load.
    Use get_prompt_info() to access version/hash for tracing.
    """
    global _prompt_cache

    prompt_path = os.path.join(os.path.dirname(__file__), "system.md")
    with open(prompt_path, "r") as f:
        raw_content = f.read()

    # Cache version and hash on first load
    if _prompt_cache is None or _prompt_cache.content != raw_content:
        _prompt_cache = PromptInfo(
            content=raw_content,
            version=_extract_prompt_version(raw_content),
            content_hash=_compute_prompt_hash(raw_content),
        )

    return raw_content.format(
        agent_name=settings.PROJECT_NAME + " Agent",
        current_date_and_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        **kwargs,
    )


def get_prompt_info() -> PromptInfo:
    """Get prompt version and hash for tracing.

    R3 REMEDIATION [P2.3]: Called by observability layer to log prompt metadata.
    """
    global _prompt_cache

    if _prompt_cache is None:
        # Force load to populate cache
        load_system_prompt()

    return _prompt_cache


def get_tool_list_from_registry() -> List[ToolInfo]:
    """R3 REMEDIATION [P2.4]: Get tool list from actual LangGraph registry.

    Returns list of ToolInfo with name, description, and HITL status.
    """
    from app.core.langgraph.tools import tools
    from app.schemas.agent import HITL_TOOLS

    tool_list = []
    for tool in tools:
        tool_list.append(ToolInfo(
            name=tool.name,
            description=tool.description[:100] if tool.description else "No description",
            requires_hitl=tool.name in HITL_TOOLS,
        ))
    return tool_list


def generate_dynamic_tool_section() -> str:
    """R3 REMEDIATION [P2.4]: Generate tool list section from registry.

    Prevents prompt-registry drift by generating from actual tools.
    """
    tool_list = get_tool_list_from_registry()

    lines = ["# Available Tools (Auto-Generated)", ""]
    lines.append(f"You have access to {len(tool_list)} tools:")
    lines.append("")

    for i, tool in enumerate(tool_list, 1):
        hitl_marker = " **(requires HITL approval)**" if tool.requires_hitl else ""
        lines.append(f"{i}. **{tool.name}**{hitl_marker} - {tool.description}")

    return "\n".join(lines)


def validate_prompt_tool_list() -> tuple[bool, str]:
    """R3 REMEDIATION [P2.4]: CI check - validate prompt tool list matches registry.

    Returns:
        (is_valid, error_message)
    """
    registry_tools = {t.name for t in get_tool_list_from_registry()}

    # Read prompt and extract tool names mentioned
    prompt_path = os.path.join(os.path.dirname(__file__), "system.md")
    with open(prompt_path, "r") as f:
        prompt_content = f.read()

    # Find tool names in prompt (pattern: **tool_name**)
    prompt_tools = set(re.findall(r'\*\*(\w+)\*\*', prompt_content))

    # Filter to only known tool-like names
    prompt_tools = prompt_tools & (registry_tools | {"duckduckgo_search", "search_deals", "get_deal",
                                                       "transition_deal", "create_deal", "add_note"})

    missing_in_prompt = registry_tools - prompt_tools
    extra_in_prompt = prompt_tools - registry_tools

    if missing_in_prompt or extra_in_prompt:
        errors = []
        if missing_in_prompt:
            errors.append(f"Tools in registry but not in prompt: {missing_in_prompt}")
        if extra_in_prompt:
            errors.append(f"Tools in prompt but not in registry: {extra_in_prompt}")
        return False, "; ".join(errors)

    return True, f"Prompt tool list matches registry ({len(registry_tools)} tools)"
