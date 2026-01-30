"""
Tryout scoring views - Group management, score entry, bulk import, and progress tracking.
"""

from django.db import transaction, models
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

from ..models import TryoutGroup, GroupPlayer, StationScore, Season
from ..transformers import (
    transform_tryout_group,
    transform_group_player,
    transform_station_score,
    transform_tryout_progress,
)
from ..input_validators import (
    validate_tryout_group_data,
    validate_group_player_data,
    validate_station_score_data,
    validate_bulk_scores_data,
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
def tryout_groups_list_create(request, season_id):
    """List all groups for a season or create a new one.

    GET: List all groups (admin only). Returns groups with players.
    POST: Create a group (admin only).
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    if request.method == "GET":
        groups = TryoutGroup.objects.filter(season=season).prefetch_related("players")
        return json_response([transform_tryout_group(g, include_players=True) for g in groups])

    # POST - create group
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_tryout_group_data(data)
    if errors:
        return json_response(errors, status=400)

    # Default rotation_order to 0 if not provided
    rotation_order = cleaned.get("rotation_order", 0)

    group = TryoutGroup.objects.create(
        organization=organization,
        season=season,
        name=cleaned["name"],
        rotation_order=rotation_order,
    )

    return json_response(transform_tryout_group(group, include_players=True), status=201)


@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_protect
@require_auth
def tryout_group_detail(request, pk):
    """Get, update, or delete a single tryout group.

    GET: Return group details with players.
    PATCH: Update name and/or rotation_order (admin only).
    DELETE: Remove group and cascade (admin only).
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        group = TryoutGroup.objects.select_related("season").prefetch_related("players").get(id=pk)
    except TryoutGroup.DoesNotExist:
        return json_response({"error": "Group not found"}, status=404)

    # Verify the group belongs to this organization
    if group.organization_id != organization.id:
        return json_response({"error": "Group not found"}, status=404)

    if request.method == "GET":
        return json_response(transform_tryout_group(group, include_players=True))

    if request.method == "DELETE":
        group.delete()
        return json_response({"message": "Group deleted"})

    # PATCH - update group
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_tryout_group_data(data)
    if errors:
        return json_response(errors, status=400)

    if "name" in cleaned:
        group.name = cleaned["name"]
    if "rotation_order" in cleaned:
        group.rotation_order = cleaned["rotation_order"]

    group.save()
    return json_response(transform_tryout_group(group, include_players=True))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def tryout_group_generate(request, season_id):
    """Auto-generate groups from a list of players (admin only).

    Request body: { players: [{ first_name, last_name }], group_size?: number }
    Default group_size is 18.

    Algorithm: sort players by last_name, split into groups of group_size.
    Name groups "Group 1", "Group 2", etc.
    Auto-assign bib numbers sequentially starting from 1 across all groups.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    players = data.get("players", [])
    if not isinstance(players, list) or not players:
        return json_response({"error": "players array is required"}, status=400)

    group_size = data.get("group_size", 18)
    try:
        group_size = int(group_size)
        if group_size < 5 or group_size > 30:
            return json_response({"error": "group_size must be between 5 and 30"}, status=400)
    except (ValueError, TypeError):
        return json_response({"error": "group_size must be an integer"}, status=400)

    # Validate each player
    validated_players = []
    for i, player_data in enumerate(players):
        cleaned, errors = validate_group_player_data(player_data)
        if errors:
            return json_response({f"players[{i}]": errors}, status=400)
        validated_players.append(cleaned)

    # Sort by last name, then first name
    validated_players.sort(key=lambda p: (p["last_name"].lower(), p["first_name"].lower()))

    # Split into groups
    num_groups = (len(validated_players) + group_size - 1) // group_size
    groups_data = []
    for i in range(num_groups):
        start_idx = i * group_size
        end_idx = min((i + 1) * group_size, len(validated_players))
        groups_data.append({
            "name": f"Group {i + 1}",
            "rotation_order": i,
            "players": validated_players[start_idx:end_idx],
        })

    # Create groups and players in a transaction
    with transaction.atomic():
        created_groups = []
        bib_counter = 1

        for group_data in groups_data:
            group = TryoutGroup.objects.create(
                organization=organization,
                season=season,
                name=group_data["name"],
                rotation_order=group_data["rotation_order"],
            )

            for player_data in group_data["players"]:
                GroupPlayer.objects.create(
                    group=group,
                    season=season,
                    first_name=player_data["first_name"],
                    last_name=player_data["last_name"],
                    bib_number=bib_counter,
                )
                bib_counter += 1

            created_groups.append(group)

    # Return created groups with players
    result_groups = TryoutGroup.objects.filter(
        id__in=[g.id for g in created_groups]
    ).prefetch_related("players")

    return json_response(
        [transform_tryout_group(g, include_players=True) for g in result_groups],
        status=201
    )


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def tryout_group_add_player(request, pk):
    """Add a late-arriving player to an existing group (admin only).

    Request body: { first_name, last_name }
    Auto-assigns next bib number (max bib in season + 1).
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        group = TryoutGroup.objects.select_related("season").get(id=pk)
    except TryoutGroup.DoesNotExist:
        return json_response({"error": "Group not found"}, status=404)

    # Verify the group belongs to this organization
    if group.organization_id != organization.id:
        return json_response({"error": "Group not found"}, status=404)

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_group_player_data(data)
    if errors:
        return json_response(errors, status=400)

    # Auto-assign next bib number
    max_bib = GroupPlayer.objects.filter(season=group.season).aggregate(
        max_bib=models.Max("bib_number")
    )["max_bib"] or 0
    next_bib = max_bib + 1

    player = GroupPlayer.objects.create(
        group=group,
        season=group.season,
        first_name=cleaned["first_name"],
        last_name=cleaned["last_name"],
        bib_number=next_bib,
    )

    return json_response(transform_group_player(player), status=201)


@require_http_methods(["GET", "POST"])
@csrf_protect
@require_auth
def tryout_station_scores(request, season_id):
    """List station scores for a season or create/update a single score.

    GET: List station scores with optional filtering (group_id, station_id, player_id).
    POST: Create or update a single station score (coach or admin).
         Uses upsert pattern (update_or_create).
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Verify user has coach or admin role
    membership = request.user.get_membership(organization)
    if not membership or membership.role not in ("coach", "admin"):
        return json_response({"error": "Coach or admin role required"}, status=403)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    if request.method == "GET":
        scores = StationScore.objects.filter(season=season).select_related("scored_by", "player")

        # Optional filters
        group_id = request.GET.get("group_id")
        if group_id:
            scores = scores.filter(group_id=group_id)

        station_id = request.GET.get("station_id")
        if station_id:
            scores = scores.filter(station_id=station_id)

        player_id = request.GET.get("player_id")
        if player_id:
            scores = scores.filter(player_id=player_id)

        return json_response([transform_station_score(s) for s in scores])

    # POST - create or update score
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_station_score_data(data)
    if errors:
        return json_response(errors, status=400)

    player_id = cleaned.get("player_id")
    if not player_id:
        return json_response({"error": "player_id is required"}, status=400)

    try:
        player = GroupPlayer.objects.select_related("group").get(id=player_id, season=season)
    except GroupPlayer.DoesNotExist:
        return json_response({"error": "Player not found in this season"}, status=404)

    # Upsert score
    score, created = StationScore.objects.update_or_create(
        season=season,
        player=player,
        station_id=cleaned["station_id"],
        defaults={
            "group": player.group,
            "scores": cleaned["scores"],
            "scored_by": request.user,
        }
    )

    return json_response(transform_station_score(score), status=201 if created else 200)


@require_http_methods(["GET", "PATCH", "DELETE"])
@csrf_protect
@require_auth
def tryout_station_score_detail(request, pk):
    """Get, update, or delete a single station score.

    GET: Return score details.
    PATCH: Update scores (coach or admin).
    DELETE: Remove score (coach or admin).
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Verify user has coach or admin role
    membership = request.user.get_membership(organization)
    if not membership or membership.role not in ("coach", "admin"):
        return json_response({"error": "Coach or admin role required"}, status=403)

    try:
        score = StationScore.objects.select_related(
            "season", "season__organization", "scored_by", "player"
        ).get(id=pk)
    except StationScore.DoesNotExist:
        return json_response({"error": "Score not found"}, status=404)

    # Verify the score belongs to this organization
    if score.season.organization_id != organization.id:
        return json_response({"error": "Score not found"}, status=404)

    if request.method == "GET":
        return json_response(transform_station_score(score))

    if request.method == "DELETE":
        score.delete()
        return json_response({"message": "Score deleted"})

    # PATCH - update score
    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    if "scores" in data:
        scores = data["scores"]
        if not isinstance(scores, dict):
            return json_response({"scores": ["Scores must be an object"]}, status=400)
        for field_id, value in scores.items():
            if not isinstance(value, (int, float)):
                return json_response({f"scores.{field_id}": ["Score must be a number"]}, status=400)
        score.scores = scores
        score.scored_by = request.user  # Update scorer
        score.save()

    return json_response(transform_station_score(score))


@require_http_methods(["POST"])
@csrf_protect
@require_auth
def tryout_bulk_scores(request, season_id):
    """Bulk create/update station scores for a station (admin only).

    Request body: { station_id, scores: [{ player_id, scores: {...} }] }
    Uses upsert pattern for each entry.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        season = Season.objects.get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    data, parse_error = parse_json_body(request)
    if parse_error:
        return json_response({"error": parse_error}, status=400)

    cleaned, errors = validate_bulk_scores_data(data)
    if errors:
        return json_response(errors, status=400)

    station_id = cleaned["station_id"]
    scores_data = cleaned["scores"]

    # Fetch all players upfront
    player_ids = [entry["player_id"] for entry in scores_data]
    players = GroupPlayer.objects.filter(
        id__in=player_ids,
        season=season
    ).select_related("group")
    player_map = {str(p.id): p for p in players}

    # Verify all players exist
    for entry in scores_data:
        if entry["player_id"] not in player_map:
            return json_response(
                {"error": f"Player {entry['player_id']} not found in this season"},
                status=404
            )

    # Bulk upsert in transaction
    with transaction.atomic():
        created_count = 0
        updated_count = 0

        for entry in scores_data:
            player = player_map[entry["player_id"]]
            score, created = StationScore.objects.update_or_create(
                season=season,
                player=player,
                station_id=station_id,
                defaults={
                    "group": player.group,
                    "scores": entry["scores"],
                    "scored_by": request.user,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

    return json_response({
        "message": "Bulk scores saved",
        "created": created_count,
        "updated": updated_count,
    })


@require_http_methods(["GET"])
@csrf_protect
@require_auth
def tryout_progress(request, season_id):
    """Get tryout progress grid (group x station completion) for a season.

    Admin only. Returns completion status for all groups and stations.
    """
    organization = get_organization_from_request(request)
    if not organization:
        return json_response({"error": "No organization context"}, status=400)

    # Admin only
    if not request.user.is_org_admin(organization):
        return json_response({"error": "Admin access required"}, status=403)

    try:
        season = Season.objects.select_related("template").get(id=season_id, organization=organization)
    except Season.DoesNotExist:
        return json_response({"error": "Season not found"}, status=404)

    # Get all groups with prefetched scores and players
    groups = TryoutGroup.objects.filter(season=season).prefetch_related("scores", "players")

    # Get station definitions from template
    stations = season.template.stations or []

    # Build progress grid
    progress = []
    for group in groups:
        total_players = group.players.count()
        scores_by_station = {}

        # Group scores by station_id
        for score in group.scores.all():
            if score.station_id not in scores_by_station:
                scores_by_station[score.station_id] = []
            scores_by_station[score.station_id].append(score)

        # Generate progress entry for each station
        for station in stations:
            station_id = station.get("id", "")
            station_name = station.get("name", "")
            scored_count = len(scores_by_station.get(station_id, []))

            progress.append(transform_tryout_progress({
                "group_id": str(group.id),
                "group_name": group.name,
                "station_id": station_id,
                "station_name": station_name,
                "scored_count": scored_count,
                "total_players": total_players,
                "complete": scored_count == total_players,
            }))

    return json_response(progress)
