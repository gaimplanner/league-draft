"""Custom throttling classes for rate limiting."""

from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """
    Strict rate limiting for authentication endpoints.
    Limits by IP address to prevent brute force attacks.
    """
    scope = "auth"

    def get_cache_key(self, request, view):
        # Use IP address for anonymous users
        ident = self.get_ident(request)
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class PasswordResetRateThrottle(SimpleRateThrottle):
    """
    Very strict rate limiting for password reset to prevent abuse.
    Limits by IP address.
    """
    scope = "password_reset"
    rate = "3/hour"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }
