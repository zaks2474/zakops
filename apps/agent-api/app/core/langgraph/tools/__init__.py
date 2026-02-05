"""LangGraph tools for enhanced language model capabilities.

This package contains custom tools that can be used with LangGraph to extend
the capabilities of language models. Currently includes tools for web search,
deal management, and other external integrations.

REMEDIATION-V3 [ZK-ISSUE-0009]: Added create_deal and add_note tools.
R3 REMEDIATION [P4.3]: Added get_deal_health tool for deal health scoring.
"""

from langchain_core.tools.base import BaseTool

from .duckduckgo_search import duckduckgo_search_tool
from .deal_tools import (
    transition_deal,
    get_deal,
    search_deals,
    create_deal,
    add_note,
    get_deal_health,
)

tools: list[BaseTool] = [
    duckduckgo_search_tool,
    transition_deal,
    get_deal,
    search_deals,
    create_deal,
    add_note,
    get_deal_health,
]
