"""
Composite scoring views - Calculate, list, detail, and tier promotion endpoints.
"""

from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from ..models import Season
from ..services_composite import CompositeScoreService
from ..transformers import transform_composite_result, transform_composite_detail
from ..input_validators import validate_composite_weights, validate_promote_data
from .helpers import (
    json_response,
    parse_json_body,
    require_auth,
    get_organization_from_request,
)


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def composite_scores_calculate(request, season_id):
    """Calculate composite scores for all players in a season.

    POST: Trigger composite score calculation with provided weights (admin only).

    Body:
    {
        "coach_rating": int (0-100),
        "tryout_score": int (0-100),
        "station_weights": {station_id: int} (optional)
    }

    Returns: List of composite results.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    # Validate season exists and belongs to org
    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Parse and validate request body
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_composite_weights(data)
    if errors:
        return json_response(errors, status=400)

    # Calculate composite scores
    try:
        results = CompositeScoreService.calculate_composite_scores(
            season_id, cleaned
        )
    except Exception as e:
        return json_response(
            {"error": f"Composite calculation failed: {str(e)}"}, status=500
        )

    # Transform and return
    return json_response(
        [transform_composite_result(r) for r in results], status=200
    )


@require_http_methods(["GET"])
@csrf_protect
@require_auth
def composite_scores_list(request, season_id):
    """List composite scores for all players in a season.

    GET: Return ranked list of players with composite scores (admin only).

    Query params:
    - coach_rating: int (0-100, optional, defaults from template blend_weights)
    - tryout_score: int (0-100, optional, defaults from template blend_weights)

    Returns: List of composite results sorted by tier then score.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    # Validate season exists and belongs to org
    try:
        season = Season.objects.select_related("template").get(
            id=season_id, organization=organization
        )
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Get weights from query params or template defaults
    try:
        coach_rating = int(request.GET.get("coach_rating", 0))
        tryout_score = int(request.GET.get("tryout_score", 0))
    except (ValueError, TypeError):
        return json_response(
            {"error": "Invalid weight parameters"}, status=400
        )

    # If not provided, use template defaults
    if coach_rating == 0 and tryout_score == 0:
        blend_weights = season.template.blend_weights or {}
        coach_rating = blend_weights.get("coach_rating", 40)
        tryout_score = blend_weights.get("tryout_score", 60)

    weights = {"coach_rating": coach_rating, "tryout_score": tryout_score}

    # Validate weights sum to 100
    if coach_rating + tryout_score != 100:
        return json_response(
            {"error": "Weights must sum to 100"}, status=400
        )

    # Calculate composite scores
    try:
        results = CompositeScoreService.calculate_composite_scores(
            season_id, weights
        )
    except Exception as e:
        return json_response(
            {"error": f"Composite calculation failed: {str(e)}"}, status=500
        )

    # Transform and return
    return json_response(
        [transform_composite_result(r) for r in results], status=200
    )


@require_http_methods(["GET"])
@csrf_protect
@require_auth
def composite_score_detail(request, season_id, player_key):
    """Get full composite score breakdown for a single player.

    GET: Return detailed breakdown with coach categories, tryout stations, etc. (admin only).

    Query params:
    - coach_rating: int (0-100, optional)
    - tryout_score: int (0-100, optional)

    Returns: Composite detail with nested coach_detail and tryout_detail.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    # Validate season exists and belongs to org
    try:
        season = Season.objects.select_related("template").get(
            id=season_id, organization=organization
        )
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Get weights from query params or template defaults
    try:
        coach_rating = int(request.GET.get("coach_rating", 0))
        tryout_score = int(request.GET.get("tryout_score", 0))
    except (ValueError, TypeError):
        return json_response(
            {"error": "Invalid weight parameters"}, status=400
        )

    # If not provided, use template defaults
    if coach_rating == 0 and tryout_score == 0:
        blend_weights = season.template.blend_weights or {}
        coach_rating = blend_weights.get("coach_rating", 40)
        tryout_score = blend_weights.get("tryout_score", 60)

    weights = {"coach_rating": coach_rating, "tryout_score": tryout_score}

    # Validate weights sum to 100
    if coach_rating + tryout_score != 100:
        return json_response(
            {"error": "Weights must sum to 100"}, status=400
        )

    # Get player detail
    try:
        detail = CompositeScoreService.get_player_detail(
            season_id, player_key, weights
        )
    except Exception as e:
        return json_response(
            {"error": f"Failed to get player detail: {str(e)}"}, status=500
        )

    if not detail:
        return json_response({"error": "Player not found"}, status=404)

    # Transform and return
    return json_response(transform_composite_detail(detail), status=200)


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def composite_score_promote(request, season_id):
    """Promote or demote a player to a different tier.

    POST: Update tier override for a player (admin only).

    Body:
    {
        "player_key": str (first_last normalized),
        "target_tier": str ("full" | "coach_only" | "tryout_only")
    }

    Returns: Success message.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    # Validate season exists and belongs to org
    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Parse and validate request body
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_promote_data(data)
    if errors:
        return json_response(errors, status=400)

    # Promote player
    try:
        CompositeScoreService.promote_player(
            season_id, cleaned["player_key"], cleaned["target_tier"]
        )
    except Exception as e:
        return json_response(
            {"error": f"Failed to promote player: {str(e)}"}, status=500
        )

    return json_response(
        {
            "success": True,
            "message": f"Player {cleaned['player_key']} promoted to tier {cleaned['target_tier']}",
        },
        status=200,
    )
