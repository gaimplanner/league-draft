"""
Authentication views (replaces DRF auth views).
"""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from ..logging import log_auth_event
from ..models import Organization, OrganizationMembership
# Legacy aliases
League = Organization
LeagueMembership = OrganizationMembership
from ..transformers import transform_user
from ..input_validators import (
    validate_register_data,
    validate_login_data,
    validate_profile_update_data,
    validate_change_password_data,
    validate_password_reset_request_data,
    validate_password_reset_confirm_data,
)
from .helpers import (
    json_response,
    parse_json_body,
    require_auth,
    rate_limit,
    auth_rate_limiter,
    password_reset_rate_limiter,
    anon_rate_limiter,
)

User = get_user_model()


@require_http_methods(["GET"])
@rate_limit(anon_rate_limiter)
def health_view(request):
    """
    Health check endpoint with database connectivity verification.

    Returns:
        - status: "healthy" or "degraded"
        - version: Application version
        - database: "connected" or "disconnected"
        - timestamp: Current server time
        - response_time_ms: Database query time (if connected)
    """
    import time
    from django.db import connection

    response_data = {
        "status": "healthy",
        "version": "1.0.0",  # TODO: Read from package or env
        "database": "connected",
        "timestamp": timezone.now().isoformat(),
    }

    # Test database connectivity
    start_time = time.time()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        response_data["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
    except Exception:
        response_data["status"] = "degraded"
        response_data["database"] = "disconnected"
        response_data["response_time_ms"] = None

    status_code = 200 if response_data["status"] == "healthy" else 503
    return json_response(response_data, status=status_code)


@require_http_methods(["GET"])
@ensure_csrf_cookie
def csrf_token_view(request):
    """
    Endpoint to get a CSRF token cookie.
    Frontend should call this on app initialization.
    """
    return json_response({"detail": "CSRF cookie set"})


@require_http_methods(["POST"])
@ensure_csrf_cookie
@csrf_protect
@rate_limit(auth_rate_limiter)
def register_view(request):
    """User registration endpoint."""
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_register_data(data)
    if errors:
        return json_response(errors, status=400)

    # Create league if league_name provided
    league = None
    if cleaned.get("league_name"):
        league_slug = cleaned.get("league_slug") or slugify(cleaned["league_name"])
        if League.objects.filter(slug=league_slug).exists():
            return json_response(
                {"error": "A league with this slug already exists"},
                status=400
            )
        league = League.objects.create(name=cleaned["league_name"], slug=league_slug)

    # Create user
    user = User.objects.create_user(
        email=cleaned["email"],
        password=cleaned["password"],
        first_name=cleaned.get("first_name", ""),
        last_name=cleaned.get("last_name", ""),
    )

    # Create league membership if league was created
    if league:
        LeagueMembership.objects.create(
            user=user,
            organization=league,
            role="admin",
        )

    # Auto-login after registration
    login(request, user)

    log_auth_event(
        "register",
        user_id=str(user.id),
        email=user.email,
        success=True,
        created_league=league.name if league else None,
    )

    return json_response(transform_user(user), status=201)


@require_http_methods(["POST"])
@ensure_csrf_cookie
@csrf_protect
@rate_limit(auth_rate_limiter)
def login_view(request):
    """User login endpoint."""
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_login_data(data)
    if errors:
        return json_response(errors, status=400)

    user = authenticate(
        request,
        username=cleaned["email"],
        password=cleaned["password"],
    )

    if user is None:
        log_auth_event(
            "login",
            email=cleaned["email"],
            success=False,
        )
        return json_response({"error": "Invalid email or password"}, status=401)

    login(request, user)

    log_auth_event(
        "login",
        user_id=str(user.id),
        email=user.email,
        success=True,
    )

    return json_response(transform_user(user))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def logout_view(request):
    """User logout endpoint."""
    user_id = str(request.user.id)
    logout(request)

    log_auth_event("logout", user_id=user_id, success=True)

    return json_response({}, status=204)


@require_http_methods(["GET", "PATCH"])
@csrf_protect
@require_auth
def me_view(request):
    """Current user info endpoint."""
    if request.method == "GET":
        return json_response(transform_user(request.user))

    # PATCH - update profile
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_profile_update_data(data, request.user)
    if errors:
        return json_response(errors, status=400)

    user = request.user
    if "first_name" in cleaned:
        user.first_name = cleaned["first_name"]
    if "last_name" in cleaned:
        user.last_name = cleaned["last_name"]
    if "email" in cleaned:
        user.email = cleaned["email"]
    user.save()

    return json_response(transform_user(user))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def change_password_view(request):
    """Change password endpoint."""
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_change_password_data(data)
    if errors:
        return json_response(errors, status=400)

    user = request.user
    if not user.check_password(cleaned["current_password"]):
        return json_response({"error": "Current password is incorrect"}, status=400)

    user.set_password(cleaned["new_password"])
    user.save()

    # Keep user logged in after password change
    login(request, user)

    log_auth_event("password_change", user_id=str(user.id), success=True)

    return json_response({"message": "Password changed successfully."})


@require_http_methods(["POST"])
@ensure_csrf_cookie
@csrf_protect
@rate_limit(password_reset_rate_limiter)
def password_reset_request_view(request):
    """Request a password reset email."""
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_password_reset_request_data(data)
    if errors:
        return json_response(errors, status=400)

    email = cleaned["email"]

    # Always return success to prevent email enumeration
    try:
        user = User.objects.get(email__iexact=email)

        # Generate token
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Build reset URL
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        # Send email
        subject = "Password Reset Request - Little League Draft"
        message = f"""
Hello {user.first_name or user.email},

You requested a password reset for your Little League Draft account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you did not request this reset, please ignore this email.

Thanks,
Little League Draft Team
"""
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        log_auth_event("password_reset_request", user_id=str(user.id), email=email, success=True)
    except User.DoesNotExist:
        # Don't reveal that the user doesn't exist
        # Log without user_id to track potential enumeration attempts
        log_auth_event("password_reset_request", email=email, success=False)

    return json_response({
        "message": "If an account exists with this email, a reset link has been sent."
    })


@require_http_methods(["POST"])
@ensure_csrf_cookie
@csrf_protect
@rate_limit(auth_rate_limiter)
def password_reset_confirm_view(request):
    """Confirm password reset with token."""
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_password_reset_confirm_data(data)
    if errors:
        return json_response(errors, status=400)

    try:
        uid = force_str(urlsafe_base64_decode(cleaned["uid"]))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return json_response({"error": "Invalid reset link"}, status=400)

    # Verify token
    if not default_token_generator.check_token(user, cleaned["token"]):
        return json_response({"error": "Invalid or expired reset link"}, status=400)

    # Set new password
    user.set_password(cleaned["new_password"])
    user.save()

    log_auth_event("password_reset_confirm", user_id=str(user.id), success=True)

    return json_response({"message": "Password has been reset successfully."})


@require_http_methods(["POST"])
@ensure_csrf_cookie
@csrf_protect
def log_client_error_view(request):
    """
    Log a client-side error from the frontend.
    Used by ErrorBoundary to report React errors.
    """
    from ..logging import get_logger

    logger = get_logger("draft.client")

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    # Extract error details
    message = data.get("message", "Unknown error")
    stack = data.get("stack", "")
    component_stack = data.get("componentStack", "")
    url = data.get("url", "")
    user_agent = data.get("userAgent", "")
    timestamp = data.get("timestamp", "")

    # Log the error with context
    logger.error(
        f"Client error: {message}",
        extra={
            "error_type": "client_error",
            "stack": stack[:2000] if stack else None,  # Truncate long stacks
            "component_stack": component_stack[:1000] if component_stack else None,
            "client_url": url,
            "user_agent": user_agent,
            "client_timestamp": timestamp,
        }
    )

    return json_response({"status": "logged"})
