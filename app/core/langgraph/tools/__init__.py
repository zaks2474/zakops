"""LangGraph tools for enhanced language model capabilities.

This package contains custom tools that can be used with LangGraph to extend
the capabilities of language models. Currently includes tools for web search,
deal management, and other external integrations.
"""

from langchain_core.tools.base import BaseTool

from .duckduckgo_search import duckduckgo_search_tool
from .deal_tools import (
    transition_deal,
    get_deal,
    search_deals,
)

tools: list[BaseTool] = [
    duckduckgo_search_tool,
    transition_deal,
    get_deal,
    search_deals,
]
