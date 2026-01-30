"""
Shared API Utilities

Phase 5: API Stabilization

Common utilities, responses, and middleware for all API endpoints.
"""

from .error_codes import (
    ErrorCode,
    get_status_code,
    is_client_error,
    is_server_error,
)
from .exceptions import (
    AgentError,
    APIException,
    BusinessLogicError,
    ConflictError,
    DatabaseError,
    ExternalServiceError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from .middleware import (
    TraceMiddleware,
    get_correlation_id,
    get_trace_id,
    register_error_handlers,
    set_correlation_id,
    set_trace_id,
)
from .responses import (
    ErrorBody,
    ErrorDetail,
    ErrorResponse,
    ListMeta,
    ListResponse,
    ResponseMeta,
    SuccessResponse,
)

__all__ = [
    # Responses
    "ResponseMeta",
    "SuccessResponse",
    "ListMeta",
    "ListResponse",
    "ErrorDetail",
    "ErrorBody",
    "ErrorResponse",
    # Error codes
    "ErrorCode",
    "get_status_code",
    "is_client_error",
    "is_server_error",
    # Exceptions
    "APIException",
    "ValidationError",
    "NotFoundError",
    "ConflictError",
    "UnauthorizedError",
    "ForbiddenError",
    "BusinessLogicError",
    "DatabaseError",
    "ExternalServiceError",
    "AgentError",
    # Middleware
    "register_error_handlers",
    "TraceMiddleware",
    "get_trace_id",
    "get_correlation_id",
    "set_trace_id",
    "set_correlation_id",
]
