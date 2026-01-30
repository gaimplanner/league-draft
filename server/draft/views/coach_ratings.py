"""
Coach rating views - CRUD with draft/submit workflow and admin progress.
"""

from django.utils import timezone
from django.db.models import Count, Q
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from ..models import CoachRating, Season
from ..transformers import transform_coach_rating, transform_rating_progress
from ..input_validators import validate_coach_rating_data, validate_rating_scores_complete
from .helpers import (
    json_response,
    parse_json_body,
    require_auth,
    get_organization_from_request,
)


@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def coach_ratings_list_create(request, season_id):
    """List coach ratings for a season or create a new one.

    GET: Coaches see only their own ratings; admins see all.
    POST: Creates a new draft rating for the authenticated coach.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Verify user has coach or admin role
    membership = request.user.get_membership(organization)
    if not membership or membership.role not in ("coach", "admin"):
        return json_response({"error": "Coach or admin role required"}, status=403)

    if request.method == "GET":
        if membership.role == "admin":
            ratings = CoachRating.objects.filter(season=season)
        else:
            ratings = CoachRating.objects.filter(season=season, coach=request.user)
        return json_response([transform_coach_rating(r) for r in ratings])

    # POST - create rating
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_coach_rating_data(data)
    if errors:
        return json_response(errors, status=400)

    # Check for duplicate (same coach, same player name, same season)
    if CoachRating.objects.filter(
        season=season,
        coach=request.user,
        player_first_name__iexact=cleaned["player_first_name"],
        player_last_name__iexact=cleaned["player_last_name"],
    ).exists():
        return json_response(
            {"error": "A rating for this player already exists in this season"},
            status=409,
        )

    rating = CoachRating.objects.create(
        season=season,
        coach=request.user,
        player_first_name=cleaned["player_first_name"],
        player_last_name=cleaned["player_last_name"],
        player_id=cleaned.get("player_id"),
        scores=cleaned["scores"],
        status="draft",
    )

    # Lock the template on first rating creation for this season
    template = season.template
    if not template.is_locked:
        template.is_locked = True
        template.save(update_fields=["is_locked"])

    return json_response(transform_coach_rating(rating), status=201)


@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_protect
@require_auth
def coach_rating_detail(request, pk):
    """Get, update, or delete a single coach rating.

    GET: Return rating details.
    PATCH: Update scores and/or player name. Only the rating's coach (or admin) can update.
    DELETE: Remove a rating. Only the rating's coach (or admin) can delete.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    try:
        rating = CoachRating.objects.select_related(
            "season", "season__organization"
        ).get(id=pk)
    except CoachRating.DoesNotExist:
        return json_response({"error": "Rating not found"}, status=404)

    # Verify the rating belongs to this organization
    if rating.season.organization_id != organization.id:
        return json_response({"error": "Rating not found"}, status=404)

    # Verify user has coach or admin role
    membership = request.user.get_membership(organization)
    if not membership or membership.role not in ("coach", "admin"):
        return json_response({"error": "Coach or admin role required"}, status=403)

    # Non-admin coaches can only access their own ratings
    if membership.role != "admin" and rating.coach_id != request.user.id:
        return json_response({"error": "You can only access your own ratings"}, status=403)

    if request.method == "GET":
        return json_response(transform_coach_rating(rating))

    if request.method == "DELETE":
        # Cannot delete submitted ratings (only admin can)
        if rating.status == "submitted" and membership.role != "admin":
            return json_response({"error": "Cannot delete a submitted rating"}, status=400)
        rating.delete()
        return json_response({"message": "Rating deleted"})

    # PATCH - update rating
    if rating.status == "submitted" and membership.role != "admin":
        return json_response({"error": "Cannot update a submitted rating"}, status=400)

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    # Update scores if provided
    if "scores" in data:
        scores = data["scores"]
        if not isinstance(scores, dict):
            return json_response({"scores": ["Scores must be an object"]}, status=400)
        for cat_id, score in scores.items():
            if not isinstance(score, (int, float)):
                return json_response(
                    {f"scores.{cat_id}": ["Score must be a number"]}, status=400
                )
        rating.scores = scores

    # Update player_first_name if provided
    if "player_first_name" in data:
        name = str(data["player_first_name"]).strip()
        if not name:
            return json_response(
                {"player_first_name": ["Player first name is required"]}, status=400
            )
        rating.player_first_name = name

    # Update player_last_name if provided
    if "player_last_name" in data:
        name = str(data["player_last_name"]).strip()
        if not name:
            return json_response(
                {"player_last_name": ["Player last name is required"]}, status=400
            )
        rating.player_last_name = name

    rating.save()
    return json_response(transform_coach_rating(rating))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def coach_rating_submit(request, pk):
    """Submit a coach rating (transition from draft to submitted).

    Validates that all template coach category IDs have scores before allowing submission.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    try:
        rating = CoachRating.objects.select_related(
            "season", "season__organization", "season__template"
        ).get(id=pk)
    except CoachRating.DoesNotExist:
        return json_response({"error": "Rating not found"}, status=404)

    # Verify the rating belongs to this organization
    if rating.season.organization_id != organization.id:
        return json_response({"error": "Rating not found"}, status=404)

    # Verify user is the rating's coach or an admin
    membership = request.user.get_membership(organization)
    if not membership or membership.role not in ("coach", "admin"):
        return json_response({"error": "Coach or admin role required"}, status=403)

    if membership.role != "admin" and rating.coach_id != request.user.id:
        return json_response(
            {"error": "You can only submit your own ratings"}, status=403
        )

    if rating.status == "submitted":
        return json_response({"error": "Rating is already submitted"}, status=400)

    # Validate all category scores are present
    template = rating.season.template
    coach_categories = template.coach_categories or []
    is_complete, missing = validate_rating_scores_complete(
        rating.scores, coach_categories
    )

    if not is_complete:
        return json_response(
            {"error": f"Missing scores for: {', '.join(missing)}"},
            status=400,
        )

    # Validate score ranges
    cat_lookup = {cat["id"]: cat for cat in coach_categories}
    for cat_id, score in rating.scores.items():
        cat = cat_lookup.get(cat_id)
        if cat:
            cat_min = cat.get("min", 1)
            cat_max = cat.get("max", 5)
            if score < cat_min or score > cat_max:
                return json_response(
                    {
                        "error": f"Score for '{cat.get('name', cat_id)}' must be between {cat_min} and {cat_max}"
                    },
                    status=400,
                )

    rating.status = "submitted"
    rating.submitted_at = timezone.now()
    rating.save(update_fields=["status", "submitted_at", "updated_at"])

    return json_response(transform_coach_rating(rating))


@require_http_methods(["GET"])
@csrf_protect
@require_auth
def coach_ratings_progress(request, season_id):
    """Admin dashboard: per-coach rating progress for a season.

    Returns a list of coaches who have ratings, with counts of total/submitted/draft.
    Admin-only endpoint.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin-only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Aggregate per coach
    progress = (
        CoachRating.objects.filter(season=season)
        .values(
            "coach__id",
            "coach__email",
            "coach__first_name",
            "coach__last_name",
        )
        .annotate(
            total_ratings=Count("id"),
            submitted_ratings=Count("id", filter=Q(status="submitted")),
            draft_ratings=Count("id", filter=Q(status="draft")),
        )
        .order_by("coach__last_name", "coach__first_name")
    )

    result = []
    for row in progress:
        result.append(
            transform_rating_progress(
                {
                    "coach_id": row["coach__id"],
                    "coach_email": row["coach__email"],
                    "coach_first_name": row["coach__first_name"],
                    "coach_last_name": row["coach__last_name"],
                    "total_ratings": row["total_ratings"],
                    "submitted_ratings": row["submitted_ratings"],
                    "draft_ratings": row["draft_ratings"],
                }
            )
        )

    return json_response(result)
