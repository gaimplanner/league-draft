"""
Division views (replaces DRF DivisionViewSet).
"""

from django.db import models
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from ..models import Division, Team
from ..transformers import transform_division, transform_division_summary
from ..input_validators import validate_division_create_data, validate_division_update_data
from .helpers import (
    json_response,
    parse_json_body,
    require_auth,
    get_league_from_request,
)


# Default scoring weights
DEFAULT_SCORING_WEIGHTS = {
    "fielding": {"field": 15.0, "throw": 13.0},
    "hitting": {"power": 9.0, "form": 9.0, "contact": 9.0},
    "pitching": {"strength": 20.0, "form": 15.0},
    "catching": 5.0,
    "running": 5.0,
}


@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def divisions_list_create(request):
    """List divisions or create a new one."""
    league = get_league_from_request(request)

    if request.method == "GET":
        # List divisions
        if request.user.role == "master_admin":
            divisions = Division.objects.all()
        elif league:
            divisions = Division.objects.for_league(league)
        else:
            divisions = Division.objects.none()

        return json_response([transform_division_summary(d) for d in divisions])

    # POST - create division
    if not league:
        return json_response({"error": "You must belong to a league to create divisions"}, status=403)

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_division_create_data(data)
    if errors:
        return json_response(errors, status=400)

    age_range = cleaned.pop("age_range")
    scoring_weights = cleaned.pop("scoring_weights", None) or DEFAULT_SCORING_WEIGHTS
    team_count = cleaned["team_count"]

    # Clean up any empty divisions with the same name (in the same league)
    name = cleaned.get("name")
    if name:
        empty_divisions = Division.objects.filter(
            league=league,
            name__iexact=name,
        ).annotate(
            player_count=models.Count("players")
        ).filter(player_count=0)
        empty_divisions.delete()

    # Create division
    division = Division.objects.create(
        league=league,
        age_range_min=age_range["min"],
        age_range_max=age_range["max"],
        scoring_weights=scoring_weights,
        **cleaned,
    )

    # Create teams
    for i in range(team_count):
        Team.objects.create(
            division=division,
            name="",
            draft_position=i + 1,
        )

    return json_response(transform_division(division, include_all=True), status=201)


@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
@csrf_protect
@require_auth
def division_detail(request, pk):
    """Retrieve, update, or delete a division."""
    league = get_league_from_request(request)

    # Get division with access control
    try:
        if request.user.role == "master_admin":
            division = Division.objects.get(id=pk)
        elif league:
            division = Division.objects.get(id=pk, league=league)
        else:
            return json_response({"error": "Not found"}, status=404)
    except Division.DoesNotExist:
        return json_response({"error": "Not found"}, status=404)

    if request.method == "GET":
        include = request.GET.get("include")
        if include == "all":
            return json_response(transform_division(division, include_all=True))
        return json_response(transform_division_summary(division))

    if request.method == "DELETE":
        division.delete()
        return json_response({}, status=204)

    # PUT or PATCH - update
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    # Security: Check if phase is being updated - require admin role
    if "phase" in data:
        if request.user.role != "master_admin" and not request.user.is_league_admin(division.league):
            return json_response(
                {"error": "Only league admins can change division phase"},
                status=403
            )

    cleaned, errors = validate_division_update_data(data)
    if errors:
        return json_response(errors, status=400)

    # Apply updates
    for attr, value in cleaned.items():
        setattr(division, attr, value)

    if cleaned.get("phase") == "complete":
        division.completed_at = timezone.now()

    division.save()

    return json_response(transform_division(division, include_all=True))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def division_reset(request, pk):
    """Reset a division's draft state - admin only."""
    league = get_league_from_request(request)

    # Get division with access control
    try:
        if request.user.role == "master_admin":
            division = Division.objects.get(id=pk)
        elif league:
            division = Division.objects.get(id=pk, league=league)
        else:
            return json_response({"error": "Not found"}, status=404)
    except Division.DoesNotExist:
        return json_response({"error": "Not found"}, status=404)

    # Verify user is admin of the league
    if request.user.role != "master_admin" and not request.user.is_league_admin(division.league):
        return json_response(
            {"error": "Only league admins can reset drafts"},
            status=403
        )

    # Delete draft state if exists
    if hasattr(division, "draft_state"):
        division.draft_state.delete()
        # Clear cached relationship so transform_division doesn't see deleted object
        try:
            del division.draft_state
        except AttributeError:
            pass

    # Reset all players
    division.players.update(
        is_drafted=False,
        drafted_by_team=None,
        drafted_in_round=None,
        drafted_at_pick=None,
        locked_to_round=None,
        locked_to_team=None,
    )

    # Reset all teams
    division.teams.update(total_score=0, age_breakdown={})

    # Update phase
    division.phase = "config"
    division.completed_at = None
    division.save()

    return json_response(transform_division(division, include_all=True))
