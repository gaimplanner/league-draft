"""
Middleware for tenant (organization) isolation.
"""

from django.utils.deprecation import MiddlewareMixin


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
