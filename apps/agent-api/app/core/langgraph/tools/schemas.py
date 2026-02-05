"""Unified tool output schema for all agent tools.

R3 REMEDIATION [ZK-BRAIN-ISSUE-0013]: All tools MUST return ToolResult schema.
This ensures consistent error handling, logging, and LLM interpretation.
"""

from datetime import datetime, UTC
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ToolResult(BaseModel):
    """Unified tool output schema. Every tool MUST return this.
    
    Attributes:
        success: Whether the tool execution succeeded
        data: The result data on success (tool-specific structure)
        error: Error message on failure
        metadata: Additional context (timing, correlation_id, etc.)
    """
    success: bool = Field(..., description="Whether the tool execution succeeded")
    data: Optional[Dict[str, Any]] = Field(None, description="Result data on success")
    error: Optional[str] = Field(None, description="Error message on failure")
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional context (timing, correlation_id, etc.)"
    )
    
    def to_json_string(self) -> str:
        """Convert to JSON string for LLM consumption."""
        import json
        return json.dumps(self.model_dump(), default=str)
    
    @classmethod
    def success_result(
        cls,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> "ToolResult":
        """Factory for successful results."""
        return cls(
            success=True,
            data=data,
            metadata=metadata or {"timestamp": datetime.now(UTC).isoformat()}
        )
    
    @classmethod
    def error_result(
        cls,
        error: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "ToolResult":
        """Factory for error results."""
        return cls(
            success=False,
            error=error,
            metadata=metadata or {"timestamp": datetime.now(UTC).isoformat()}
        )
    
    @classmethod
    def from_legacy(cls, json_string: str) -> "ToolResult":
        """Convert legacy JSON string response to ToolResult.
        
        Legacy format: {"ok": bool, "error"?: str, ...other fields}
        """
        import json
        try:
            data = json.loads(json_string)
            if data.get("ok", False):
                return cls.success_result(data)
            else:
                return cls.error_result(
                    data.get("error", "Unknown error"),
                    metadata={"legacy_data": data}
                )
        except json.JSONDecodeError:
            return cls.error_result(f"Invalid JSON response: {json_string[:100]}")
