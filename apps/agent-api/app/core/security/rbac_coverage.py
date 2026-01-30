"""RBAC coverage validator for agent API endpoints.

Verifies that all protected endpoints have proper RBAC decorators
and that the role hierarchy is correctly enforced.
"""

import inspect
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class EndpointRBACInfo:
    """Information about an endpoint's RBAC configuration."""

    path: str
    method: str
    function_name: str
    has_auth_dependency: bool
    required_role: Optional[str]
    rate_limited: bool
    file_path: str
    line_number: int


@dataclass
class RBACCoverageReport:
    """Report on RBAC coverage across all endpoints."""

    endpoints: List[EndpointRBACInfo] = field(default_factory=list)
    total_endpoints: int = 0
    protected_endpoints: int = 0
    unprotected_endpoints: int = 0
    coverage_percentage: float = 0.0
    issues: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "total_endpoints": self.total_endpoints,
            "protected_endpoints": self.protected_endpoints,
            "unprotected_endpoints": self.unprotected_endpoints,
            "coverage_percentage": self.coverage_percentage,
            "issues": self.issues,
            "endpoints": [
                {
                    "path": e.path,
                    "method": e.method,
                    "function_name": e.function_name,
                    "has_auth_dependency": e.has_auth_dependency,
                    "required_role": e.required_role,
                    "rate_limited": e.rate_limited,
                    "file_path": e.file_path,
                    "line_number": e.line_number,
                }
                for e in self.endpoints
            ],
        }


# Endpoints that should always be public (no auth required)
PUBLIC_ENDPOINTS = {
    "/health",
    "/v1/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Endpoints that require specific roles
PROTECTED_ENDPOINTS = {
    # Approval endpoints require APPROVER role
    "POST /v1/agent/approvals/{approval_id}:approve": "APPROVER",
    "POST /v1/agent/approvals/{approval_id}:reject": "APPROVER",
    # Admin endpoints would require ADMIN role
    # "GET /v1/admin/*": "ADMIN",
}


def get_endpoint_protection_level(path: str, method: str) -> Optional[str]:
    """Get the required protection level for an endpoint.

    Args:
        path: The endpoint path
        method: HTTP method

    Returns:
        Required role name or None if public
    """
    # Check if public
    if path in PUBLIC_ENDPOINTS:
        return None

    # Check specific protections
    endpoint_key = f"{method} {path}"
    if endpoint_key in PROTECTED_ENDPOINTS:
        return PROTECTED_ENDPOINTS[endpoint_key]

    # Default: any authenticated user (no specific role)
    if path.startswith("/v1/"):
        return "authenticated"

    return None


def analyze_endpoint_rbac(app) -> RBACCoverageReport:
    """Analyze RBAC coverage for a FastAPI application.

    Args:
        app: FastAPI application instance

    Returns:
        RBACCoverageReport with coverage analysis
    """
    report = RBACCoverageReport()

    for route in app.routes:
        if not hasattr(route, "endpoint"):
            continue

        # Get route info
        path = route.path
        methods = getattr(route, "methods", {"GET"})

        for method in methods:
            endpoint_func = route.endpoint

            # Check for auth dependencies
            has_auth = False
            required_role = None

            # Check function signature for dependencies
            sig = inspect.signature(endpoint_func)
            for _param_name, param in sig.parameters.items():
                if param.default is not inspect.Parameter.empty:
                    default = param.default
                    # Check if it's a Depends() call
                    if hasattr(default, "dependency"):
                        dep_name = str(default.dependency)
                        if "get_agent_user" in dep_name:
                            has_auth = True
                        if "require_approve_role" in dep_name:
                            has_auth = True
                            required_role = "APPROVER"

            # Check for rate limiting decorator
            rate_limited = hasattr(endpoint_func, "__wrapped__") or "limiter" in str(
                getattr(endpoint_func, "__dict__", {})
            )

            # Get source info
            try:
                source_file = inspect.getfile(endpoint_func)
                source_lines, start_line = inspect.getsourcelines(endpoint_func)
            except (TypeError, OSError):
                source_file = "unknown"
                start_line = 0

            endpoint_info = EndpointRBACInfo(
                path=path,
                method=method,
                function_name=endpoint_func.__name__,
                has_auth_dependency=has_auth,
                required_role=required_role,
                rate_limited=rate_limited,
                file_path=source_file,
                line_number=start_line,
            )

            report.endpoints.append(endpoint_info)
            report.total_endpoints += 1

            # Check protection requirements
            expected_protection = get_endpoint_protection_level(path, method)

            if expected_protection is None:
                # Should be public
                pass
            elif expected_protection == "authenticated":
                if has_auth:
                    report.protected_endpoints += 1
                else:
                    report.unprotected_endpoints += 1
                    # Only warn for non-public endpoints
                    if path not in PUBLIC_ENDPOINTS:
                        report.issues.append(
                            f"Endpoint {method} {path} should have authentication"
                        )
            else:
                # Requires specific role
                if has_auth and required_role == expected_protection:
                    report.protected_endpoints += 1
                else:
                    report.unprotected_endpoints += 1
                    report.issues.append(
                        f"Endpoint {method} {path} requires role {expected_protection}"
                    )

    # Calculate coverage
    if report.total_endpoints > 0:
        report.coverage_percentage = (
            report.protected_endpoints / report.total_endpoints
        ) * 100

    return report


def validate_role_hierarchy() -> Dict[str, Any]:
    """Validate that the role hierarchy is correctly defined.

    Returns:
        dict with validation results
    """
    from app.core.security.agent_auth import ROLE_HIERARCHY

    issues = []

    # Expected hierarchy: VIEWER < OPERATOR < APPROVER < ADMIN
    expected_order = ["VIEWER", "OPERATOR", "APPROVER", "ADMIN"]

    for i, role in enumerate(expected_order):
        if role not in ROLE_HIERARCHY:
            issues.append(f"Missing role in hierarchy: {role}")
            continue

        expected_level = i + 1
        actual_level = ROLE_HIERARCHY[role]

        if actual_level != expected_level:
            issues.append(
                f"Role {role} has level {actual_level}, expected {expected_level}"
            )

    # Check for unexpected roles
    for role in ROLE_HIERARCHY:
        if role not in expected_order:
            issues.append(f"Unexpected role in hierarchy: {role}")

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "hierarchy": ROLE_HIERARCHY,
    }


def generate_rbac_report(app) -> Dict[str, Any]:
    """Generate a complete RBAC coverage report.

    Args:
        app: FastAPI application instance

    Returns:
        dict with complete RBAC analysis
    """
    coverage_report = analyze_endpoint_rbac(app)
    hierarchy_validation = validate_role_hierarchy()

    return {
        "coverage": coverage_report.to_dict(),
        "hierarchy": hierarchy_validation,
        "overall_passed": (
            len(coverage_report.issues) == 0 and hierarchy_validation["passed"]
        ),
    }
