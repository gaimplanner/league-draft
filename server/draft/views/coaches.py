"""
Coach views for the Coach Registry feature.
"""

from django.db.models import Q
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from ..models import Coach
from ..transformers import transform_coach
from ..input_validators import (
    validate_coach_data,
    validate_coach_create_data,
    validate_bulk_coach_data,
)
from .helpers import (
    json_response,
    parse_json_body,
    require_auth,
    get_organization_from_request,
)


@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def coaches_list_create(request):
    """List coaches or create a new one."""
    organization = get_organization_from_request(request)

    if not organization:
        return json_response(
            {"error": "Organization context required"},
            status=400,
        )

    if request.method == "GET":
        # Get coaches for the organization
        queryset = Coach.objects.filter(organization=organization)

        # Filter by role if specified
        role = request.GET.get("role")
        if role:
            queryset = queryset.filter(role=role)

        # Filter by division if specified
        # - division_id=<uuid>: coaches assigned to this division
        # - division_id=null: coaches not assigned to any division
        # - division_id=<uuid>,null: coaches assigned to this division OR unassigned
        division_filter = request.GET.get("division_id")
        if division_filter:
            if division_filter == "null":
                # Only unassigned coaches
                queryset = queryset.filter(division_id__isnull=True)
            elif "," in division_filter:
                # Multiple values (e.g., "uuid,null" for division OR unassigned)
                parts = [p.strip() for p in division_filter.split(",")]
                q_filter = Q()
                for part in parts:
                    if part == "null":
                        q_filter |= Q(division_id__isnull=True)
                    else:
                        q_filter |= Q(division_id=part)
                queryset = queryset.filter(q_filter)
            else:
                # Single division ID
                queryset = queryset.filter(division_id=division_filter)

        # Filter by is_active (default: only active)
        show_inactive = request.GET.get("show_inactive", "").lower() == "true"
        if not show_inactive:
            queryset = queryset.filter(is_active=True)

        # Search by name
        search = request.GET.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        return json_response([transform_coach(c) for c in queryset])

    # POST - create coach
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    # Check admin permission
    membership = request.user.get_membership(organization)
    if not membership or membership.role != "admin":
        return json_response(
            {"error": "Admin permission required"},
            status=403,
        )

    cleaned, errors = validate_coach_create_data(data)
    if errors:
        return json_response(errors, status=400)

    coach = Coach.objects.create(
        organization=organization,
        **cleaned,
    )

    return json_response(transform_coach(coach), status=201)


@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
@csrf_protect
@require_auth
def coach_detail(request, pk):
    """Retrieve, update, or delete a coach."""
    organization = get_organization_from_request(request)

    if not organization:
        return json_response(
            {"error": "Organization context required"},
            status=400,
        )

    try:
        coach = Coach.objects.get(id=pk, organization=organization)
    except Coach.DoesNotExist:
        return json_response({"error": "Not found"}, status=404)

    if request.method == "GET":
        return json_response(transform_coach(coach))

    # All modifications require admin permission
    membership = request.user.get_membership(organization)
    if not membership or membership.role != "admin":
        return json_response(
            {"error": "Admin permission required"},
            status=403,
        )

    if request.method == "DELETE":
        # Soft delete by setting is_active = False
        coach.is_active = False
        coach.save()
        return json_response({}, status=204)

    # PUT or PATCH - update
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_coach_data(data)
    if errors:
        return json_response(errors, status=400)

    for attr, value in cleaned.items():
        setattr(coach, attr, value)
    coach.save()

    return json_response(transform_coach(coach))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def coaches_bulk_create(request):
    """Bulk create coaches from pasted text."""
    organization = get_organization_from_request(request)

    if not organization:
        return json_response(
            {"error": "Organization context required"},
            status=400,
        )

    # Check admin permission
    membership = request.user.get_membership(organization)
    if not membership or membership.role != "admin":
        return json_response(
            {"error": "Admin permission required"},
            status=403,
        )

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_bulk_coach_data(data)
    if errors:
        return json_response(errors, status=400)

    # Create all coaches
    created_coaches = []
    for coach_data in cleaned["coaches"]:
        coach = Coach.objects.create(
            organization=organization,
            **coach_data,
        )
        created_coaches.append(coach)

    return json_response(
        {
            "created": len(created_coaches),
            "coaches": [transform_coach(c) for c in created_coaches],
        },
        status=201,
    )
