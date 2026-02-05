"""This file contains the LangGraph Agent/workflow and interactions with the LLM.

Extended to support HITL (Human-in-the-Loop) workflow with approval gates
for sensitive tool executions like transition_deal.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, UTC
from typing import (
    Any,
    AsyncGenerator,
    Dict,
    List,
    Optional,
)

from asgiref.sync import sync_to_async
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    ToolMessage,
    convert_to_openai_messages,
)
from app.core.tracing import (
    get_callbacks,
    trace_agent_turn,
    trace_tool_execution,
    trace_llm_call,
    trace_hitl_approval,
)
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import (
    END,
    StateGraph,
)
from langgraph.graph.state import (
    Command,
    CompiledStateGraph,
)
from langgraph.types import (
    RunnableConfig,
    StateSnapshot,
    interrupt,
)
from mem0 import AsyncMemory
from psycopg_pool import AsyncConnectionPool
from sqlmodel import Session, select

from app.core.config import (
    Environment,
    settings,
)
from app.core.langgraph.tools import tools
from app.core.logging import logger, sanitize_content_for_log
from app.core.metrics import llm_inference_duration_seconds
from app.core.prompts import load_system_prompt, get_prompt_info
from app.models.approval import Approval, ApprovalStatus, ToolExecution
from app.schemas import (
    GraphState,
    Message,
)
from app.schemas.agent import HITL_TOOLS, requires_approval
from app.schemas.graph import PendingToolCall
from app.services.database import database_service
from app.services.llm import llm_service
from app.utils import (
    dump_messages,
    prepare_messages,
    process_llm_response,
)
from app.core.idempotency import tool_idempotency_key
from app.core.security.output_validation import sanitize_llm_output
from app.core.langgraph.tools.schemas import ToolResult
from app.core.langgraph.tools.deal_tools import set_correlation_id
import os

# Approval timeout in seconds (default 1 hour)
APPROVAL_TIMEOUT = int(getattr(settings, 'HITL_APPROVAL_TIMEOUT_SECONDS', 3600))

# R3 REMEDIATION [P1.4]: Tool call budget per turn to prevent infinite loops
MAX_TOOL_CALLS_PER_TURN = int(os.getenv("MAX_TOOL_CALLS_PER_TURN", "10"))

# Decision Lock compliance: retrieval must use RAG REST only, not pgvector/mem0 directly
# Set to "false" to re-enable long-term memory (mem0/pgvector) for non-spike environments
DISABLE_LONG_TERM_MEMORY = os.getenv("DISABLE_LONG_TERM_MEMORY", "true").lower() == "true"


class LangGraphAgent:
    """Manages the LangGraph Agent/workflow and interactions with the LLM.

    This class handles the creation and management of the LangGraph workflow,
    including LLM interactions, database connections, response processing,
    and HITL approval gates.
    """

    def __init__(self):
        """Initialize the LangGraph Agent with necessary components."""
        # Use the LLM service with tools bound
        self.llm_service = llm_service
        self.llm_service.bind_tools(tools)
        self.tools_by_name = {tool.name: tool for tool in tools}
        self._connection_pool: Optional[AsyncConnectionPool] = None
        self._graph: Optional[CompiledStateGraph] = None
        self.memory: Optional[AsyncMemory] = None
        logger.info(
            "langgraph_agent_initialized",
            model=settings.DEFAULT_LLM_MODEL,
            environment=settings.ENVIRONMENT.value,
        )

    async def _long_term_memory(self) -> AsyncMemory:
        """Initialize the long term memory.

        R3 REMEDIATION [P3.3]: Supports local embeddings when configured.
        """
        if self.memory is None:
            # R3 REMEDIATION [P3.3]: Configure embedder based on settings
            if settings.USE_LOCAL_EMBEDDINGS and settings.LOCAL_EMBEDDER_URL:
                embedder_config = {
                    "provider": "openai",  # mem0 uses OpenAI-compatible API
                    "config": {
                        "model": settings.LOCAL_EMBEDDER_MODEL,
                        "api_key": "local",  # Placeholder for local embedding server
                        "openai_base_url": settings.LOCAL_EMBEDDER_URL,
                    },
                }
                logger.info(
                    "using_local_embeddings",
                    url=settings.LOCAL_EMBEDDER_URL,
                    model=settings.LOCAL_EMBEDDER_MODEL,
                )
            else:
                embedder_config = {
                    "provider": "openai",
                    "config": {"model": settings.LONG_TERM_MEMORY_EMBEDDER_MODEL},
                }

            self.memory = await AsyncMemory.from_config(
                config_dict={
                    "vector_store": {
                        "provider": "pgvector",
                        "config": {
                            "collection_name": settings.LONG_TERM_MEMORY_COLLECTION_NAME,
                            "dbname": settings.POSTGRES_DB,
                            "user": settings.POSTGRES_USER,
                            "password": settings.POSTGRES_PASSWORD,
                            "host": settings.POSTGRES_HOST,
                            "port": settings.POSTGRES_PORT,
                        },
                    },
                    "llm": {
                        "provider": "openai",
                        "config": {"model": settings.LONG_TERM_MEMORY_MODEL},
                    },
                    "embedder": embedder_config,
                }
            )
        return self.memory

    async def _get_connection_pool(self) -> AsyncConnectionPool:
        """Get a PostgreSQL connection pool using environment-specific settings.

        Returns:
            AsyncConnectionPool: A connection pool for PostgreSQL database.
        """
        if self._connection_pool is None:
            try:
                max_size = settings.POSTGRES_POOL_SIZE

                connection_url = settings.DATABASE_URL

                self._connection_pool = AsyncConnectionPool(
                    connection_url,
                    open=False,
                    max_size=max_size,
                    kwargs={
                        "autocommit": True,
                        "connect_timeout": 5,
                        "prepare_threshold": None,
                    },
                )
                await self._connection_pool.open()
                logger.info("connection_pool_created", max_size=max_size, environment=settings.ENVIRONMENT.value)
            except Exception as e:
                logger.error("connection_pool_creation_failed", error=str(e), environment=settings.ENVIRONMENT.value)
                if settings.ENVIRONMENT == Environment.PRODUCTION:
                    logger.warning("continuing_without_connection_pool", environment=settings.ENVIRONMENT.value)
                    return None
                raise e
        return self._connection_pool

    def _validate_user_id(self, user_id: str) -> bool:
        """R3 REMEDIATION [P3.1]: Validate user_id format to prevent tenant isolation bypass.

        User IDs must be:
        - Non-empty strings
        - UUID format or alphanumeric with hyphens/underscores
        - Max 255 characters
        - No path traversal characters

        Args:
            user_id: The user ID to validate

        Returns:
            bool: True if valid, False otherwise
        """
        import re

        if not user_id or not isinstance(user_id, str):
            return False

        # Max length check
        if len(user_id) > 255:
            return False

        # Block path traversal and special characters
        if any(char in user_id for char in ['..', '/', '\\', '\x00', '\n', '\r']):
            return False

        # Allow UUIDs or alphanumeric with hyphens/underscores
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        alphanum_pattern = r'^[a-zA-Z0-9_-]+$'

        if re.match(uuid_pattern, user_id, re.IGNORECASE) or re.match(alphanum_pattern, user_id):
            return True

        logger.warning(
            "invalid_user_id_format",
            user_id_preview=user_id[:20] if len(user_id) > 20 else user_id,
            reason="failed_validation_pattern"
        )
        return False

    async def _get_relevant_memory(self, user_id: str, query: str) -> str:
        """Get the relevant memory for the user and query.

        R3 REMEDIATION [P3.1]: Added tenant isolation validation.
        """
        # Decision Lock compliance: RAG REST only, no direct pgvector/mem0
        if DISABLE_LONG_TERM_MEMORY:
            logger.debug("long_term_memory_disabled", user_id=user_id)
            return ""

        # R3 REMEDIATION [P3.1]: Validate user_id to prevent tenant isolation bypass
        if not self._validate_user_id(user_id):
            logger.warning(
                "memory_access_blocked_invalid_user_id",
                user_id_preview=str(user_id)[:20] if user_id else "None",
            )
            return ""

        try:
            memory = await self._long_term_memory()
            results = await memory.search(user_id=str(user_id), query=query)
            return "\n".join([f"* {result['memory']}" for result in results["results"]])
        except Exception as e:
            logger.error("failed_to_get_relevant_memory", error=str(e), user_id=user_id, query=sanitize_content_for_log(query))
            return ""

    async def _update_long_term_memory(self, user_id: str, messages: list[dict], metadata: dict = None) -> None:
        """Update the long term memory.

        R3 REMEDIATION [P3.1]: Added tenant isolation validation.
        """
        # Decision Lock compliance: RAG REST only, no direct pgvector/mem0
        if DISABLE_LONG_TERM_MEMORY:
            logger.debug("long_term_memory_disabled_skip_update", user_id=user_id)
            return

        # R3 REMEDIATION [P3.1]: Validate user_id to prevent tenant isolation bypass
        if not self._validate_user_id(user_id):
            logger.warning(
                "memory_update_blocked_invalid_user_id",
                user_id_preview=str(user_id)[:20] if user_id else "None",
            )
            return

        try:
            memory = await self._long_term_memory()
            await memory.add(messages, user_id=str(user_id), metadata=metadata)
            logger.info("long_term_memory_updated_successfully", user_id=user_id)
        except Exception as e:
            logger.exception("failed_to_update_long_term_memory", user_id=user_id, error=str(e))

    async def forget_user_memory(self, user_id: str) -> bool:
        """R3 REMEDIATION [P3.1]: Delete all memory for a user (privacy control).

        Provides GDPR-style "right to be forgotten" capability.
        Includes tenant isolation validation.

        Args:
            user_id: The user whose memory should be deleted

        Returns:
            bool: True if deletion succeeded, False otherwise
        """
        if DISABLE_LONG_TERM_MEMORY:
            logger.info("forget_user_memory_skipped_disabled", user_id=user_id)
            return True  # Nothing to delete

        # R3 REMEDIATION [P3.1]: Validate user_id to prevent tenant isolation bypass
        if not self._validate_user_id(user_id):
            logger.warning(
                "memory_delete_blocked_invalid_user_id",
                user_id_preview=str(user_id)[:20] if user_id else "None",
            )
            return False

        try:
            memory = await self._long_term_memory()
            # mem0's delete_all method removes all memories for a user
            await memory.delete_all(user_id=str(user_id))
            logger.info(
                "user_memory_deleted",
                user_id=user_id,
                reason="user_request",
            )
            return True
        except Exception as e:
            logger.error(
                "forget_user_memory_failed",
                user_id=user_id,
                error=str(e),
            )
            return False

    async def _chat(self, state: GraphState, config: RunnableConfig) -> Command:
        """Process the chat state and generate a response.

        Args:
            state (GraphState): The current state of the conversation.
            config (RunnableConfig): Runtime configuration.

        Returns:
            Command: Command object with updated state and next node to execute.
        """
        current_llm = self.llm_service.get_llm()
        model_name = (
            current_llm.model_name
            if current_llm and hasattr(current_llm, "model_name")
            else settings.DEFAULT_LLM_MODEL
        )

        SYSTEM_PROMPT = load_system_prompt(long_term_memory=state.long_term_memory)
        messages = prepare_messages(state.messages, current_llm, SYSTEM_PROMPT)

        # R3 REMEDIATION [P2.3]: Get prompt version for tracing
        prompt_info = get_prompt_info()
        thread_id = config["configurable"]["thread_id"]
        correlation_id = state.metadata.get("correlation_id", "")

        try:
            # R3 REMEDIATION [P2.2]: Add LLM call tracing
            with trace_llm_call(
                model=model_name,
                thread_id=thread_id,
                correlation_id=correlation_id,
                prompt_version=prompt_info.version,
            ) as llm_span:
                with llm_inference_duration_seconds.labels(model=model_name).time():
                    response_message = await self.llm_service.call(dump_messages(messages))

            response_message = process_llm_response(response_message)

            # R3 REMEDIATION [P2.3]: Include prompt version in logs
            logger.info(
                "llm_response_generated",
                session_id=thread_id,
                model=model_name,
                environment=settings.ENVIRONMENT.value,
                prompt_version=prompt_info.version,
                prompt_hash=prompt_info.content_hash,
            )

            # Check for tool calls that require approval
            if response_message.tool_calls:
                hitl_calls = [tc for tc in response_message.tool_calls if requires_approval(tc["name"])]
                if hitl_calls:
                    # Store pending tool calls and go to approval gate
                    pending = [
                        PendingToolCall(
                            tool_name=tc["name"],
                            tool_args=tc["args"],
                            tool_call_id=tc["id"],
                        )
                        for tc in hitl_calls
                    ]
                    return Command(
                        update={
                            "messages": [response_message],
                            "pending_tool_calls": pending,
                            "approval_status": "pending",
                        },
                        goto="approval_gate"
                    )
                else:
                    # Regular tool calls, no approval needed
                    return Command(update={"messages": [response_message]}, goto="tool_call")
            else:
                return Command(update={"messages": [response_message]}, goto=END)

        except Exception as e:
            logger.error(
                "llm_call_failed_all_models",
                session_id=config["configurable"]["thread_id"],
                error=str(e),
                environment=settings.ENVIRONMENT.value,
            )
            raise Exception(f"failed to get llm response after trying all models: {str(e)}")

    async def _tool_call(self, state: GraphState) -> Command:
        """Process tool calls from the last message.

        R3 REMEDIATION [P1.1/P1.2]: Added try/except and ToolResult schema.
        R3 REMEDIATION [P1.4]: Added tool call budget enforcement.
        R3 REMEDIATION [P2.1]: Added correlation_id propagation to tools.

        Args:
            state: The current agent state containing messages and tool calls.

        Returns:
            Command: Command object with updated messages and routing back to chat.
        """
        # R3 REMEDIATION [P2.1]: Set correlation_id context for tool HTTP calls
        correlation_id = state.metadata.get("correlation_id", "")
        if correlation_id:
            set_correlation_id(correlation_id)

        # R3 REMEDIATION [P1.4]: Check tool call budget
        current_count = state.tool_call_count
        tool_calls = state.messages[-1].tool_calls
        new_count = current_count + len(tool_calls)

        if new_count > MAX_TOOL_CALLS_PER_TURN:
            logger.warning(
                "tool_call_budget_exceeded",
                current_count=current_count,
                requested=len(tool_calls),
                max_allowed=MAX_TOOL_CALLS_PER_TURN,
            )
            # Return error for all tool calls
            outputs = [
                ToolMessage(
                    content=ToolResult.error_result(
                        f"Tool call budget exceeded ({new_count}/{MAX_TOOL_CALLS_PER_TURN}). "
                        "Please complete the task with fewer tool calls.",
                        metadata={"budget_exceeded": True, "count": new_count, "max": MAX_TOOL_CALLS_PER_TURN}
                    ).to_json_string(),
                    name=tc["name"],
                    tool_call_id=tc["id"],
                )
                for tc in tool_calls
            ]
            return Command(update={"messages": outputs, "tool_call_count": new_count}, goto="chat")

        outputs = []
        for tool_call in tool_calls:
            # R3 REMEDIATION [P1.5]: Validate tool call structure
            try:
                tool_name = tool_call.get("name") if isinstance(tool_call, dict) else getattr(tool_call, "name", None)
                tool_args = tool_call.get("args", {}) if isinstance(tool_call, dict) else getattr(tool_call, "args", {})
                tool_call_id = tool_call.get("id") if isinstance(tool_call, dict) else getattr(tool_call, "id", None)

                # Validate required fields
                if not tool_name:
                    logger.error("tool_call_missing_name", tool_call=str(tool_call)[:200])
                    outputs.append(
                        ToolMessage(
                            content=ToolResult.error_result(
                                "Malformed tool call: missing 'name' field",
                                metadata={"raw_call": str(tool_call)[:200]}
                            ).to_json_string(),
                            name="unknown",
                            tool_call_id=tool_call_id or f"error-{len(outputs)}",
                        )
                    )
                    continue

                if not tool_call_id:
                    tool_call_id = f"generated-{tool_name}-{len(outputs)}"
                    logger.warning("tool_call_missing_id", tool_name=tool_name, generated_id=tool_call_id)

                # Ensure args is a dict
                if not isinstance(tool_args, dict):
                    if isinstance(tool_args, str):
                        # Try to parse as JSON
                        try:
                            tool_args = json.loads(tool_args)
                        except json.JSONDecodeError:
                            logger.error("tool_call_args_not_json", tool_name=tool_name, args_type=type(tool_args).__name__)
                            outputs.append(
                                ToolMessage(
                                    content=ToolResult.error_result(
                                        f"Malformed tool call: 'args' must be a dict, got string that is not valid JSON",
                                        metadata={"tool_name": tool_name, "args_preview": str(tool_args)[:100]}
                                    ).to_json_string(),
                                    name=tool_name,
                                    tool_call_id=tool_call_id,
                                )
                            )
                            continue
                    else:
                        logger.error("tool_call_args_invalid_type", tool_name=tool_name, args_type=type(tool_args).__name__)
                        outputs.append(
                            ToolMessage(
                                content=ToolResult.error_result(
                                    f"Malformed tool call: 'args' must be a dict, got {type(tool_args).__name__}",
                                    metadata={"tool_name": tool_name}
                                ).to_json_string(),
                                name=tool_name,
                                tool_call_id=tool_call_id,
                            )
                        )
                        continue

            except Exception as parse_error:
                logger.error("tool_call_parse_error", error=str(parse_error), tool_call=str(tool_call)[:200])
                outputs.append(
                    ToolMessage(
                        content=ToolResult.error_result(
                            f"Failed to parse tool call: {str(parse_error)}",
                            metadata={"parse_error": True}
                        ).to_json_string(),
                        name="unknown",
                        tool_call_id=f"parse-error-{len(outputs)}",
                    )
                )
                continue

            try:
                # Check tool exists
                if tool_name not in self.tools_by_name:
                    result = ToolResult.error_result(
                        f"Tool '{tool_name}' not found",
                        metadata={"tool_name": tool_name}
                    )
                    logger.warning("tool_not_found", tool_name=tool_name)
                else:
                    # R3 REMEDIATION [P2.2]: Add tool execution tracing
                    thread_id = state.metadata.get("thread_id", "unknown")
                    with trace_tool_execution(
                        tool_name=tool_name,
                        thread_id=thread_id,
                        correlation_id=correlation_id,
                        tool_args=tool_args,
                    ) as tool_span:
                        # Execute tool with error handling
                        raw_result = await self.tools_by_name[tool_name].ainvoke(tool_args)

                    # Convert legacy JSON string responses to ToolResult
                    if isinstance(raw_result, str):
                        result = ToolResult.from_legacy(raw_result)
                    elif isinstance(raw_result, dict):
                        # Already a dict, wrap it
                        if "ok" in raw_result:
                            # Legacy format
                            if raw_result.get("ok"):
                                result = ToolResult.success_result(raw_result)
                            else:
                                result = ToolResult.error_result(
                                    raw_result.get("error", "Unknown error"),
                                    metadata={"legacy_data": raw_result}
                                )
                        else:
                            result = ToolResult.success_result(raw_result)
                    else:
                        result = ToolResult.success_result({"result": str(raw_result)})

                    logger.info(
                        "tool_call_executed",
                        tool_name=tool_name,
                        success=result.success,
                    )

            except Exception as e:
                # R3 REMEDIATION [P1.2]: Graceful error handling
                logger.error(
                    "tool_call_exception",
                    tool_name=tool_name,
                    error=str(e),
                    exc_info=True,
                )
                result = ToolResult.error_result(
                    f"Tool execution failed: {str(e)}",
                    metadata={"tool_name": tool_name, "exception_type": type(e).__name__}
                )

            outputs.append(
                ToolMessage(
                    content=result.to_json_string(),
                    name=tool_name,
                    tool_call_id=tool_call_id,
                )
            )

        # R3 REMEDIATION [P1.4]: Update tool call count
        return Command(update={"messages": outputs, "tool_call_count": new_count}, goto="chat")

    async def _approval_gate(self, state: GraphState, config: RunnableConfig) -> Command:
        """Approval gate node - interrupts execution for HITL approval.

        This node is triggered when tool calls require human approval.
        It uses LangGraph's interrupt() to pause execution.

        Args:
            state: Current graph state with pending tool calls
            config: Runtime configuration

        Returns:
            Command: Either continues to tool_call (approved) or back to chat (rejected)
        """
        thread_id = config["configurable"]["thread_id"]

        if state.approval_status == "pending":
            # Interrupt and wait for approval
            logger.info(
                "approval_gate_interrupt",
                thread_id=thread_id,
                pending_tools=[tc.tool_name for tc in state.pending_tool_calls],
            )

            # This will pause execution until resumed
            approval_result = interrupt({
                "type": "approval_required",
                "pending_tool_calls": [tc.model_dump() for tc in state.pending_tool_calls],
                "thread_id": thread_id,
            })

            # After resume, check the result
            if approval_result.get("approved"):
                return Command(
                    update={"approval_status": "approved"},
                    goto="execute_approved_tools"
                )
            else:
                # Rejected - add rejection message and go back to chat
                rejection_reason = approval_result.get("reason", "Action was rejected by user")
                rejection_message = AIMessage(
                    content=f"The requested action was not approved. Reason: {rejection_reason}"
                )
                return Command(
                    update={
                        "messages": [rejection_message],
                        "approval_status": "rejected",
                        "pending_tool_calls": [],
                    },
                    goto=END
                )

        elif state.approval_status == "approved":
            return Command(goto="execute_approved_tools")

        else:
            # No pending approval, continue normally
            return Command(goto="chat")

    async def _execute_approved_tools(self, state: GraphState, config: RunnableConfig) -> Command:
        """Execute tools that have been approved.

        Implements claim-first idempotency pattern.
        R3 REMEDIATION [P2.1]: Propagates correlation_id to tool HTTP calls.

        Args:
            state: Current graph state
            config: Runtime configuration

        Returns:
            Command: Updated state with tool results
        """
        thread_id = config["configurable"]["thread_id"]
        outputs = []

        # R3 REMEDIATION [P2.1]: Set correlation_id context for tool HTTP calls
        correlation_id = state.metadata.get("correlation_id", "")
        if correlation_id:
            set_correlation_id(correlation_id)

        for pending_call in state.pending_tool_calls:
            # Generate deterministic idempotency key (SHA-256 based, restart-safe)
            idempotency_key = tool_idempotency_key(thread_id, pending_call.tool_name, pending_call.tool_args)

            try:
                # Claim-first: record execution attempt before executing
                execution_id = str(uuid.uuid4())
                logger.info(
                    "executing_approved_tool",
                    tool_name=pending_call.tool_name,
                    idempotency_key=idempotency_key,
                    execution_id=execution_id,
                )

                # Execute the tool
                tool = self.tools_by_name.get(pending_call.tool_name)
                if tool:
                    result = await tool.ainvoke(pending_call.tool_args)
                    outputs.append(
                        ToolMessage(
                            content=result,
                            name=pending_call.tool_name,
                            tool_call_id=pending_call.tool_call_id,
                        )
                    )
                    logger.info(
                        "tool_execution_success",
                        tool_name=pending_call.tool_name,
                        execution_id=execution_id,
                    )
                else:
                    outputs.append(
                        ToolMessage(
                            content=f"Error: Tool {pending_call.tool_name} not found",
                            name=pending_call.tool_name,
                            tool_call_id=pending_call.tool_call_id,
                        )
                    )

            except Exception as e:
                logger.error(
                    "tool_execution_failed",
                    tool_name=pending_call.tool_name,
                    error=str(e),
                )
                outputs.append(
                    ToolMessage(
                        content=f"Error executing {pending_call.tool_name}: {str(e)}",
                        name=pending_call.tool_name,
                        tool_call_id=pending_call.tool_call_id,
                    )
                )

        return Command(
            update={
                "messages": outputs,
                "pending_tool_calls": [],
                "approval_status": None,
            },
            goto="chat"
        )

    async def create_graph(self) -> Optional[CompiledStateGraph]:
        """Create and configure the LangGraph workflow with HITL support.

        Returns:
            Optional[CompiledStateGraph]: The configured LangGraph instance or None if init fails
        """
        if self._graph is None:
            try:
                graph_builder = StateGraph(GraphState)

                # Add nodes
                graph_builder.add_node("chat", self._chat, ends=["tool_call", "approval_gate", END])
                graph_builder.add_node("tool_call", self._tool_call, ends=["chat"])
                graph_builder.add_node("approval_gate", self._approval_gate, ends=["execute_approved_tools", "chat", END])
                graph_builder.add_node("execute_approved_tools", self._execute_approved_tools, ends=["chat"])

                # Set entry and finish points
                graph_builder.set_entry_point("chat")
                graph_builder.set_finish_point("chat")

                # Get connection pool
                connection_pool = await self._get_connection_pool()
                if connection_pool:
                    checkpointer = AsyncPostgresSaver(connection_pool)
                    await checkpointer.setup()
                else:
                    checkpointer = None
                    if settings.ENVIRONMENT != Environment.PRODUCTION:
                        raise Exception("Connection pool initialization failed")

                # Compile with interrupt_before for approval gate
                self._graph = graph_builder.compile(
                    checkpointer=checkpointer,
                    interrupt_before=["approval_gate"],  # HITL interrupt point
                    name=f"{settings.PROJECT_NAME} Agent ({settings.ENVIRONMENT.value})"
                )

                logger.info(
                    "graph_created_with_hitl",
                    graph_name=f"{settings.PROJECT_NAME} Agent",
                    environment=settings.ENVIRONMENT.value,
                    has_checkpointer=checkpointer is not None,
                    interrupt_before=["approval_gate"],
                )

            except Exception as e:
                logger.error("graph_creation_failed", error=str(e), environment=settings.ENVIRONMENT.value)
                if settings.ENVIRONMENT == Environment.PRODUCTION:
                    logger.warning("continuing_without_graph")
                    return None
                raise e

        return self._graph

    async def invoke_with_hitl(
        self,
        message: str,
        thread_id: str,
        actor_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Invoke the agent with HITL support.

        This method processes a message and may return a pending approval
        if the agent attempts to use a tool that requires human approval.

        Args:
            message: The user's message
            thread_id: Thread ID for conversation continuity
            actor_id: ID of the actor initiating the request
            metadata: Optional metadata

        Returns:
            Dict containing either:
                - response: The agent's response (if completed)
                - pending_approval: Approval info (if HITL triggered)
        """
        if self._graph is None:
            self._graph = await self.create_graph()

        config = {
            "configurable": {"thread_id": thread_id},
            "callbacks": get_callbacks(),
            "metadata": {
                "actor_id": actor_id,
                "thread_id": thread_id,
                "environment": settings.ENVIRONMENT.value,
                **(metadata or {}),
            },
        }

        relevant_memory = (
            await self._get_relevant_memory(actor_id, message)
        ) or "No relevant memory found."

        try:
            # Invoke the graph
            result = await self._graph.ainvoke(
                input={
                    "messages": [{"role": "user", "content": message}],
                    "long_term_memory": relevant_memory,
                    "actor_id": actor_id,
                    "metadata": metadata or {},
                },
                config=config,
            )

            # Check if we hit an interrupt (pending approval)
            state: StateSnapshot = await sync_to_async(self._graph.get_state)(config=config)

            if state.next and "approval_gate" in state.next:
                # HITL interrupt - pending approval
                pending_calls = result.get("pending_tool_calls", [])
                if pending_calls:
                # Create approval record in database
                    with database_service.get_session_maker() as db:
                        first_call = pending_calls[0]
                        tool_name = first_call.tool_name if hasattr(first_call, 'tool_name') else first_call["tool_name"]
                        tool_args = first_call.tool_args if hasattr(first_call, 'tool_args') else first_call["tool_args"]
                        approval = Approval(
                            id=str(uuid.uuid4()),
                            thread_id=thread_id,
                            checkpoint_id=state.config.get("configurable", {}).get("checkpoint_id"),
                            tool_name=tool_name,
                            tool_args=json.dumps(tool_args),
                            actor_id=actor_id,
                            status=ApprovalStatus.PENDING,
                            idempotency_key=tool_idempotency_key(thread_id, tool_name, tool_args),
                            expires_at=datetime.now(UTC) + timedelta(seconds=APPROVAL_TIMEOUT),
                        )
                        db.add(approval)
                        db.commit()

                        approval_id = approval.id
                        approval_tool_name = approval.tool_name
                        approval_tool_args = json.loads(approval.tool_args)
                        approval_expires_at = approval.expires_at
                        approval_created_at = approval.created_at

                    return {
                        "pending_approval": {
                            "approval_id": approval_id,
                            "tool_name": approval_tool_name,
                            "tool_args": approval_tool_args,
                            "description": f"Approve execution of {approval_tool_name}?",
                            "expires_at": approval_expires_at,
                            "requested_at": approval_created_at,
                        },
                        "checkpoint_id": state.config.get("configurable", {}).get("checkpoint_id"),
                    }

            # Normal completion
            messages = result.get("messages", [])
            response_text = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage) and msg.content:
                    response_text = str(msg.content)
                    break

            # Sanitize LLM output before returning (UF-004)
            if response_text:
                sanitization_result = sanitize_llm_output(response_text)
                if sanitization_result.was_modified:
                    logger.warning(
                        "llm_output_sanitized",
                        modifications=sanitization_result.modifications,
                        thread_id=thread_id,
                    )
                response_text = sanitization_result.sanitized

            # Update memory in background
            asyncio.create_task(
                self._update_long_term_memory(
                    actor_id,
                    convert_to_openai_messages(messages),
                    config["metadata"]
                )
            )

            return {"response": response_text, "metadata": {"thread_id": thread_id}}

        except Exception as e:
            logger.exception("invoke_with_hitl_failed", error=str(e))
            raise

    async def resume_after_approval(
        self,
        thread_id: str,
        checkpoint_id: Optional[str],
        tool_name: str,
        tool_args: Dict[str, Any],
        approval_id: str,
    ) -> Dict[str, Any]:
        """Resume the agent after approval is granted.

        Args:
            thread_id: The thread ID to resume
            checkpoint_id: The checkpoint ID to resume from
            tool_name: Name of the approved tool
            tool_args: Arguments for the tool
            approval_id: ID of the approval record

        Returns:
            Dict with the agent's response after execution
        """
        if self._graph is None:
            self._graph = await self.create_graph()

        config = {
            "configurable": {
                "thread_id": thread_id,
            },
            "callbacks": get_callbacks(),
        }

        if checkpoint_id:
            config["configurable"]["checkpoint_id"] = checkpoint_id

        try:
            # Resume with approval granted using Command(resume=...)
            # The resume value becomes the return value of interrupt() in _approval_gate
            result = await self._graph.ainvoke(
                Command(resume={"approved": True, "approval_id": approval_id}),
                config=config,
            )

            messages = result.get("messages", [])
            response_text = ""
            tool_result = None
            tool_executed = False

            # Extract tool result and AI response from messages
            for msg in reversed(messages):
                if isinstance(msg, ToolMessage) and tool_result is None:
                    # Found the tool execution result
                    tool_executed = True
                    try:
                        tool_result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                    except json.JSONDecodeError:
                        tool_result = {"raw": msg.content}
                    logger.info(
                        "tool_result_extracted",
                        thread_id=thread_id,
                        tool_name=msg.name,
                        tool_result=tool_result,
                    )
                elif isinstance(msg, AIMessage) and msg.content and not response_text:
                    response_text = str(msg.content)

            # Sanitize LLM output (UF-004)
            if response_text:
                sanitization_result = sanitize_llm_output(response_text)
                if sanitization_result.was_modified:
                    logger.warning("llm_output_sanitized_on_resume", modifications=sanitization_result.modifications)
                response_text = sanitization_result.sanitized

            logger.info(
                "resume_after_approval_success",
                thread_id=thread_id,
                approval_id=approval_id,
                tool_executed=tool_executed,
            )

            return {
                "response": response_text,
                "tool_executed": tool_executed,
                "tool_result": tool_result,
            }

        except Exception as e:
            logger.error(f"resume_after_approval failed: {str(e)}", exc_info=True)
            raise

    async def resume_after_rejection(
        self,
        thread_id: str,
        checkpoint_id: Optional[str],
        tool_name: str,
        rejection_reason: Optional[str],
    ) -> Dict[str, Any]:
        """Resume the agent after rejection.

        Args:
            thread_id: The thread ID
            checkpoint_id: The checkpoint ID
            tool_name: Name of the rejected tool
            rejection_reason: Reason for rejection

        Returns:
            Dict with status
        """
        if self._graph is None:
            self._graph = await self.create_graph()

        config = {
            "configurable": {"thread_id": thread_id},
            "callbacks": get_callbacks(),
        }

        if checkpoint_id:
            config["configurable"]["checkpoint_id"] = checkpoint_id

        try:
            # Resume with rejection using Command(resume=...)
            await self._graph.ainvoke(
                Command(resume={"approved": False, "reason": rejection_reason}),
                config=config,
            )

            logger.info(
                "resume_after_rejection_success",
                thread_id=thread_id,
                tool_name=tool_name,
            )

            return {"status": "rejected", "reason": rejection_reason}

        except Exception as e:
            logger.error(f"resume_after_rejection failed: {str(e)}", exc_info=True)
            raise

    # Original methods preserved for backward compatibility

    async def get_response(
        self,
        messages: list[Message],
        session_id: str,
        user_id: Optional[str] = None,
    ) -> list[dict]:
        """Get a response from the LLM (original method preserved)."""
        if self._graph is None:
            self._graph = await self.create_graph()
        config = {
            "configurable": {"thread_id": session_id},
            "callbacks": get_callbacks(),
            "metadata": {
                "user_id": user_id,
                "session_id": session_id,
                "environment": settings.ENVIRONMENT.value,
                "debug": settings.DEBUG,
            },
        }
        from app.utils import dump_messages
        relevant_memory = (
            await self._get_relevant_memory(user_id, messages[-1].content)
        ) or "No relevant memory found."
        try:
            response = await self._graph.ainvoke(
                input={"messages": dump_messages(messages), "long_term_memory": relevant_memory},
                config=config,
            )
            asyncio.create_task(
                self._update_long_term_memory(
                    user_id, convert_to_openai_messages(response["messages"]), config["metadata"]
                )
            )
            return self.__process_messages(response["messages"])
        except Exception as e:
            logger.error(f"Error getting response: {str(e)}")

    async def get_stream_response(
        self, messages: list[Message], session_id: str, user_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Get a stream response from the LLM (original method preserved)."""
        config = {
            "configurable": {"thread_id": session_id},
            "callbacks": get_callbacks(
                environment=settings.ENVIRONMENT.value, debug=False, user_id=user_id, session_id=session_id
            ),
            "metadata": {
                "user_id": user_id,
                "session_id": session_id,
                "environment": settings.ENVIRONMENT.value,
                "debug": settings.DEBUG,
            },
        }
        if self._graph is None:
            self._graph = await self.create_graph()

        from app.utils import dump_messages
        relevant_memory = (
            await self._get_relevant_memory(user_id, messages[-1].content)
        ) or "No relevant memory found."

        try:
            async for token, _ in self._graph.astream(
                {"messages": dump_messages(messages), "long_term_memory": relevant_memory},
                config,
                stream_mode="messages",
            ):
                try:
                    # UF-004: Sanitize streaming tokens before yielding
                    content = token.content
                    if content:
                        sanitization_result = sanitize_llm_output(content)
                        if sanitization_result.was_modified:
                            logger.warning("llm_stream_output_sanitized", session_id=session_id)
                        content = sanitization_result.sanitized
                    yield content
                except Exception as token_error:
                    logger.error("Error processing token", error=str(token_error), session_id=session_id)
                    continue

            state: StateSnapshot = await sync_to_async(self._graph.get_state)(config=config)
            if state.values and "messages" in state.values:
                asyncio.create_task(
                    self._update_long_term_memory(
                        user_id, convert_to_openai_messages(state.values["messages"]), config["metadata"]
                    )
                )
        except Exception as stream_error:
            logger.error("Error in stream processing", error=str(stream_error), session_id=session_id)
            raise stream_error

    async def get_chat_history(self, session_id: str) -> list[Message]:
        """Get the chat history for a given thread ID."""
        if self._graph is None:
            self._graph = await self.create_graph()

        state: StateSnapshot = await sync_to_async(self._graph.get_state)(
            config={"configurable": {"thread_id": session_id}}
        )
        return self.__process_messages(state.values["messages"]) if state.values else []

    def __process_messages(self, messages: list[BaseMessage]) -> list[Message]:
        openai_style_messages = convert_to_openai_messages(messages)
        return [
            Message(role=message["role"], content=str(message["content"]))
            for message in openai_style_messages
            if message["role"] in ["assistant", "user"] and message["content"]
        ]

    async def clear_chat_history(self, session_id: str) -> None:
        """Clear all chat history for a given thread ID."""
        try:
            conn_pool = await self._get_connection_pool()
            async with conn_pool.connection() as conn:
                for table in settings.CHECKPOINT_TABLES:
                    try:
                        await conn.execute(f"DELETE FROM {table} WHERE thread_id = %s", (session_id,))
                        logger.info(f"Cleared {table} for session {session_id}")
                    except Exception as e:
                        logger.error(f"Error clearing {table}", error=str(e))
                        raise
        except Exception as e:
            logger.error("Failed to clear chat history", error=str(e))
            raise
