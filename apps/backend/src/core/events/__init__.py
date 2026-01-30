"""
ZakOps Event System

Provides event publishing, querying, and taxonomy for full observability.

Usage:
    from src.core.events import (
        publish_event,
        publish_deal_event,
        publish_action_event,
        DealEventType,
        ActionEventType,
    )

    # Publish a deal event
    await publish_deal_event(
        deal_id=deal.id,
        event_type=DealEventType.CREATED.value,
        event_data={"name": deal.name, "source": "email"}
    )
"""

from .models import (
    ActionEvent,
    AgentEvent,
    DealEvent,
    EventBase,
    WorkerEvent,
)
from .publisher import (
    EventPublisher,
    get_publisher,
    publish_action_event,
    publish_agent_event,
    publish_deal_event,
    publish_event,
)
from .query import (
    EventQueryService,
    get_query_service,
)
from .taxonomy import (
    ALL_EVENT_TYPES,
    ActionEventType,
    AgentEventType,
    DealEventType,
    EventDomain,
    SystemEventType,
    WorkerEventType,
    get_domain,
    validate_event_type,
)

__all__ = [
    # Taxonomy
    "EventDomain",
    "DealEventType",
    "ActionEventType",
    "AgentEventType",
    "WorkerEventType",
    "SystemEventType",
    "validate_event_type",
    "get_domain",
    "ALL_EVENT_TYPES",
    # Models
    "EventBase",
    "AgentEvent",
    "DealEvent",
    "ActionEvent",
    "WorkerEvent",
    # Publisher
    "EventPublisher",
    "get_publisher",
    "publish_event",
    "publish_deal_event",
    "publish_action_event",
    "publish_agent_event",
    # Query
    "EventQueryService",
    "get_query_service",
]
