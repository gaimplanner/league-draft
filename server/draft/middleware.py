"""
Middleware for tenant (league) isolation.
"""

from django.utils.deprecation import MiddlewareMixin


class TenantMiddleware(MiddlewareMixin):
    """
    Injects tenant (league) from authenticated user into request.

    For regular users, their assigned league is used.
    For master_admin users, they can specify a league via X-League-ID header.
    """

    def process_request(self, request):
        request.league = None

        if hasattr(request, "user") and request.user.is_authenticated:
            if request.user.role == "master_admin":
                # Master admin can access any league via header
                league_id = request.headers.get("X-League-ID")
                if league_id:
                    from .models import League

                    try:
                        request.league = League.objects.get(id=league_id)
                    except League.DoesNotExist:
                        pass
            else:
                # Regular users use their assigned league
                request.league = request.user.league
