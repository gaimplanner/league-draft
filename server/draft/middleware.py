"""
Middleware for tenant (league) isolation.
"""

from django.utils.deprecation import MiddlewareMixin


class TenantMiddleware(MiddlewareMixin):
    """
    Injects tenant (league) from authenticated user into request.

    Users can belong to multiple leagues. The active league is determined by:
    1. X-League-ID header (if provided and user has membership)
    2. First league membership (if only one league)

    Master admin users can access any league via X-League-ID header.
    """

    def process_request(self, request):
        request.league = None

        if hasattr(request, "user") and request.user.is_authenticated:
            from .models import League

            league_id = request.headers.get("X-League-ID")

            if request.user.role == "master_admin":
                # Master admin can access any league via header
                if league_id:
                    try:
                        request.league = League.objects.get(id=league_id)
                    except League.DoesNotExist:
                        pass
            else:
                # Regular users - get league from membership
                if league_id:
                    # User specified a league - verify they have membership
                    membership = request.user.memberships.filter(league_id=league_id).first()
                    if membership:
                        request.league = membership.league
                else:
                    # No league specified - use first membership if only one league
                    memberships = request.user.memberships.select_related("league").all()
                    if memberships.count() == 1:
                        request.league = memberships.first().league
