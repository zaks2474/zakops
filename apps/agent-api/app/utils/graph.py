"""This file contains the graph utilities for the application."""

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.messages import trim_messages as _trim_messages

from app.core.config import settings
from app.core.logging import logger
from app.schemas import Message


def dump_messages(messages: list[Message]) -> list[dict]:
    """Dump the messages to a list of dictionaries.

    Args:
        messages (list[Message]): The messages to dump.

    Returns:
        list[dict]: The dumped messages.
    """
    return [message.model_dump() for message in messages]


def process_llm_response(response: BaseMessage) -> BaseMessage:
    """Process LLM response to handle structured content blocks (e.g., from GPT-5 models).

    GPT-5 models return content as a list of blocks like:
    [
        {'id': '...', 'summary': [], 'type': 'reasoning'},
        {'type': 'text', 'text': 'actual response'}
    ]

    This function extracts the actual text content from such structures.

    Args:
        response: The raw response from the LLM

    Returns:
        BaseMessage with processed content
    """
    if isinstance(response.content, list):
        # Extract text from content blocks
        text_parts = []
        for block in response.content:
            if isinstance(block, dict):
                # Handle text blocks
                if block.get("type") == "text" and "text" in block:
                    text_parts.append(block["text"])
                # Log reasoning blocks for debugging
                elif block.get("type") == "reasoning":
                    logger.debug(
                        "reasoning_block_received",
                        reasoning_id=block.get("id"),
                        has_summary=bool(block.get("summary")),
                    )
            elif isinstance(block, str):
                text_parts.append(block)

        # Join all text parts
        response.content = "".join(text_parts)
        logger.debug(
            "processed_structured_content",
            block_count=len(response.content) if isinstance(response.content, list) else 1,
            extracted_length=len(response.content) if isinstance(response.content, str) else 0,
        )

    return response


def _approx_token_counter(messages: list[BaseMessage]) -> int:
    """Approximate token counter for non-OpenAI model names.

    LangChain's ChatOpenAI token counting can raise NotImplementedError for
    unknown model names (e.g., Qwen served via vLLM). For trimming purposes,
    an approximate counter is sufficient and avoids hard failures.
    """
    total_chars = 0
    for message in messages:
        content = getattr(message, "content", "")
        total_chars += len(content) if isinstance(content, str) else len(str(content))

    # Rough heuristic: ~4 chars per token + small per-message overhead.
    return (total_chars // 4) + (len(messages) * 4)


def _to_schema_messages(messages: list[BaseMessage] | list[dict] | list[Message]) -> list[Message]:
    """Normalize mixed message representations into `app.schemas.Message`."""
    normalized: list[Message] = []
    for message in messages:
        if isinstance(message, Message):
            normalized.append(message)
            continue

        if isinstance(message, dict):
            normalized.append(Message.model_validate(message))
            continue

        role: str
        if isinstance(message, HumanMessage):
            role = "user"
        elif isinstance(message, AIMessage):
            role = "assistant"
        elif isinstance(message, SystemMessage):
            role = "system"
        else:
            role = "assistant"

        content = message.content
        normalized.append(Message(role=role, content=content if isinstance(content, str) else str(content)))

    return normalized


def prepare_messages(messages: list[Message], llm: BaseChatModel, system_prompt: str) -> list[Message]:
    """Prepare the messages for the LLM.

    Args:
        messages (list[Message]): The messages to prepare.
        llm (BaseChatModel): The LLM to use.
        system_prompt (str): The system prompt to use.

    Returns:
        list[Message]: The prepared messages.
    """
    try:
        trimmed_messages = _trim_messages(
            dump_messages(messages),
            strategy="last",
            token_counter=llm,
            max_tokens=settings.MAX_TOKENS,
            start_on="human",
            include_system=False,
            allow_partial=False,
        )
    except NotImplementedError as e:
        logger.warning(
            "token_counting_not_implemented_fallback_to_approx",
            error=str(e),
            message_count=len(messages),
        )
        trimmed_messages = _trim_messages(
            dump_messages(messages),
            strategy="last",
            token_counter=_approx_token_counter,
            max_tokens=settings.MAX_TOKENS,
            start_on="human",
            include_system=False,
            allow_partial=False,
        )
    except ValueError as e:
        # Handle unrecognized content blocks (e.g., reasoning blocks from GPT-5)
        if "Unrecognized content block type" in str(e):
            logger.warning(
                "token_counting_failed_skipping_trim",
                error=str(e),
                message_count=len(messages),
            )
            # Skip trimming and return all messages
            trimmed_messages = messages
        else:
            raise

    return [Message(role="system", content=system_prompt)] + _to_schema_messages(trimmed_messages)
