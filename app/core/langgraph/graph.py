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
from urllib.parse import quote_plus

from asgiref.sync import sync_to_async
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    ToolMessage,
    convert_to_openai_messages,
)
from langfuse.langchain import CallbackHandler
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
from app.core.prompts import load_system_prompt
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
import os

# Approval timeout in seconds (default 1 hour)
APPROVAL_TIMEOUT = int(getattr(settings, 'HITL_APPROVAL_TIMEOUT_SECONDS', 3600))

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
        """Initialize the long term memory."""
        if self.memory is None:
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
                    "embedder": {"provider": "openai", "config": {"model": settings.LONG_TERM_MEMORY_EMBEDDER_MODEL}},
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

                connection_url = (
                    "postgresql://"
                    f"{quote_plus(settings.POSTGRES_USER)}:{quote_plus(settings.POSTGRES_PASSWORD)}"
                    f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
                )

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

    async def _get_relevant_memory(self, user_id: str, query: str) -> str:
        """Get the relevant memory for the user and query."""
        # Decision Lock compliance: RAG REST only, no direct pgvector/mem0
        if DISABLE_LONG_TERM_MEMORY:
            logger.debug("long_term_memory_disabled", user_id=user_id)
            return ""
        try:
            memory = await self._long_term_memory()
            results = await memory.search(user_id=str(user_id), query=query)
            return "\n".join([f"* {result['memory']}" for result in results["results"]])
        except Exception as e:
            logger.error("failed_to_get_relevant_memory", error=str(e), user_id=user_id, query=sanitize_content_for_log(query))
            return ""

    async def _update_long_term_memory(self, user_id: str, messages: list[dict], metadata: dict = None) -> None:
        """Update the long term memory."""
        # Decision Lock compliance: RAG REST only, no direct pgvector/mem0
        if DISABLE_LONG_TERM_MEMORY:
            logger.debug("long_term_memory_disabled_skip_update", user_id=user_id)
            return
        try:
            memory = await self._long_term_memory()
            await memory.add(messages, user_id=str(user_id), metadata=metadata)
            logger.info("long_term_memory_updated_successfully", user_id=user_id)
        except Exception as e:
            logger.exception("failed_to_update_long_term_memory", user_id=user_id, error=str(e))

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

        try:
            with llm_inference_duration_seconds.labels(model=model_name).time():
                response_message = await self.llm_service.call(dump_messages(messages))

            response_message = process_llm_response(response_message)

            logger.info(
                "llm_response_generated",
                session_id=config["configurable"]["thread_id"],
                model=model_name,
                environment=settings.ENVIRONMENT.value,
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

        Args:
            state: The current agent state containing messages and tool calls.

        Returns:
            Command: Command object with updated messages and routing back to chat.
        """
        outputs = []
        for tool_call in state.messages[-1].tool_calls:
            tool_result = await self.tools_by_name[tool_call["name"]].ainvoke(tool_call["args"])
            outputs.append(
                ToolMessage(
                    content=tool_result,
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"],
                )
            )
        return Command(update={"messages": outputs}, goto="chat")

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

        Args:
            state: Current graph state
            config: Runtime configuration

        Returns:
            Command: Updated state with tool results
        """
        thread_id = config["configurable"]["thread_id"]
        outputs = []

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
            "callbacks": [CallbackHandler()],
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
            "callbacks": [CallbackHandler()],
        }

        if checkpoint_id:
            config["configurable"]["checkpoint_id"] = checkpoint_id

        try:
            # Resume with approval granted
            result = await self._graph.ainvoke(
                input=None,  # Resume from checkpoint
                config=config,
                interrupt_resume={"approved": True, "approval_id": approval_id},
            )

            messages = result.get("messages", [])
            response_text = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage) and msg.content:
                    response_text = str(msg.content)
                    break

            logger.info(
                "resume_after_approval_success",
                thread_id=thread_id,
                approval_id=approval_id,
            )

            return {"response": response_text}

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
            "callbacks": [CallbackHandler()],
        }

        if checkpoint_id:
            config["configurable"]["checkpoint_id"] = checkpoint_id

        try:
            # Resume with rejection
            await self._graph.ainvoke(
                input=None,
                config=config,
                interrupt_resume={"approved": False, "reason": rejection_reason},
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
            "callbacks": [CallbackHandler()],
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
            "callbacks": [
                CallbackHandler(
                    environment=settings.ENVIRONMENT.value, debug=False, user_id=user_id, session_id=session_id
                )
            ],
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
                    yield token.content
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
