"""
Middleware for tenant (organization) isolation and request tracking.
"""

import threading
import uuid

from django.utils.deprecation import MiddlewareMixin

# Thread-local storage for request context (used by logging)
_request_context = threading.local()


def get_request_context() -> dict:
    """Get the current request context from thread-local storage."""
    return getattr(_request_context, "data", {})


def set_request_context(request_id: str = None, user_id: str = None, league_id: str = None):
    """Set the current request context in thread-local storage."""
    _request_context.data = {
        "request_id": request_id,
        "user_id": user_id,
        "league_id": league_id,
    }


def clear_request_context():
    """Clear the request context from thread-local storage."""
    _request_context.data = {}


class RequestIDMiddleware(MiddlewareMixin):
    """
    Assigns a unique request ID to each request for log correlation.

    The request ID is:
    1. Stored on the request object as request.request_id
    2. Stored in thread-local storage for logging
    3. Added to the response as X-Request-ID header
    """

    def process_request(self, request):
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        request.request_id = request_id

        # Initialize context (will be updated by TenantMiddleware)
        set_request_context(request_id=request_id)

    def process_response(self, request, response):
        # Add request ID to response headers
        if hasattr(request, "request_id"):
            response["X-Request-ID"] = request.request_id

        # Clear thread-local context
        clear_request_context()

        return response


class TenantMiddleware(MiddlewareMixin):
    """
    Injects tenant (organization) from authenticated user into request.

    Users can belong to multiple organizations. The active organization is determined by:
    1. X-Organization-ID header (if provided and user has membership)
    2. X-League-ID header (legacy, for backwards compatibility)
    3. First organization membership (if only one organization)

    Master admin users can access any organization via header.
    """

    def process_request(self, request):
        request.organization = None
        request.league = None  # Backwards compatibility alias

        if hasattr(request, "user") and request.user.is_authenticated:
            from .models import Organization

            # Check both new and legacy headers
            org_id = request.headers.get("X-Organization-ID") or request.headers.get("X-League-ID")

            if request.user.role == "master_admin":
                # Master admin can access any organization via header
                if org_id:
                    try:
                        request.organization = Organization.objects.get(id=org_id)
                    except Organization.DoesNotExist:
                        pass
            else:
                # Regular users - get organization from membership
                if org_id:
                    # User specified an organization - verify they have membership
                    membership = request.user.memberships.filter(organization_id=org_id).first()
                    if membership:
                        request.organization = membership.organization
                else:
                    # No organization specified - use first membership if only one
                    memberships = request.user.memberships.select_related("organization").all()
                    if memberships.count() == 1:
                        request.organization = memberships.first().organization

            # Backwards compatibility alias
            request.league = request.organization

            # Update logging context with user and organization info
            request_id = getattr(request, "request_id", None)
            user_id = str(request.user.id) if request.user.id else None
            league_id = str(request.organization.id) if request.organization else None
            set_request_context(
                request_id=request_id,
                user_id=user_id,
                league_id=league_id,
            )
