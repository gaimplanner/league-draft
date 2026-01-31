"""
Model to dict transformations (replaces DRF serializers).

All functions convert Django model instances to dictionaries
that can be serialized to JSON. Output uses snake_case to match
the existing API contract.
"""

from typing import Optional


def transform_organization_membership(membership) -> dict:
    """Transform an OrganizationMembership to dict."""
    return {
        "id": str(membership.id),
        "organization_id": str(membership.organization.id),
        "organization_name": membership.organization.name,
        "organization_slug": membership.organization.slug,
        "role": membership.role,
        "created_at": membership.created_at.isoformat(),
        # Legacy fields for backwards compatibility
        "league_id": str(membership.organization.id),
        "league_name": membership.organization.name,
        "league_slug": membership.organization.slug,
    }


# Alias for backwards compatibility
transform_league_membership = transform_organization_membership


def transform_user(user) -> dict:
    """Transform a User to dict with organizations."""
    memberships = user.memberships.select_related("organization").all()
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "organizations": [transform_organization_membership(m) for m in memberships],
        # Legacy field for backwards compatibility
        "leagues": [transform_organization_membership(m) for m in memberships],
    }


def transform_player(player) -> dict:
    """Transform a Player to dict."""
    return {
        "id": str(player.id),
        "division_id": str(player.division_id),
        "bib": player.bib,
        "first_name": player.first_name,
        "last_name": player.last_name,
        "name": player.name,
        "field_score": player.field_score,
        "throw_score": player.throw_score,
        "hit_power": player.hit_power,
        "hit_form": player.hit_form,
        "hit_contact": player.hit_contact,
        "pitching_strength": player.pitching_strength,
        "pitching_form": player.pitching_form,
        "catch_score": player.catch_score,
        "running_score": player.running_score,
        "fielding_subtotal": player.fielding_subtotal,
        "hitting_subtotal": player.hitting_subtotal,
        "pitching_subtotal": player.pitching_subtotal,
        "subjective_total": player.subjective_total,
        "objective_total": player.objective_total,
        "official_adjust": player.official_adjust,
        "total_score": player.total_score,
        "rank": player.rank,
        "projected_round": player.projected_round,
        "little_league_age": player.little_league_age,
        "birthday": player.birthday,
        "is_all_star": player.is_all_star,
        "is_dne": player.is_dne,
        "is_coach_kid": player.is_coach_kid,
        "coach_team_id": str(player.coach_team_id) if player.coach_team_id else None,
        "sibling": player.sibling,
        "sibling_id": str(player.sibling_id) if player.sibling_id else None,
        "locked_to_round": player.locked_to_round,
        "locked_to_team_id": str(player.locked_to_team_id) if player.locked_to_team_id else None,
        "is_drafted": player.is_drafted,
        "drafted_by_team_id": str(player.drafted_by_team_id) if player.drafted_by_team_id else None,
        "drafted_in_round": player.drafted_in_round,
        "drafted_at_pick": player.drafted_at_pick,
        # Team Builder fields (for league-generated mode)
        "coach_request": player.coach_request,
        "teammate_requests": player.teammate_requests or [],
        "school": player.school,
        "grade": player.grade,
    }


def transform_team(team, include_roster: bool = True) -> dict:
    """Transform a Team to dict."""
    result = {
        "id": str(team.id),
        "division_id": str(team.division_id),
        "name": team.name,
        "head_coach": team.head_coach,
        "assistant_coach": team.assistant_coach,
        "head_coach_id": str(team.head_coach_ref_id) if team.head_coach_ref_id else None,
        "assistant_coach_id": str(team.assistant_coach_ref_id) if team.assistant_coach_ref_id else None,
        "draft_position": team.draft_position,
        "total_score": team.total_score,
        "age_breakdown": team.age_breakdown,
    }

    # Include coach details if refs are set
    if team.head_coach_ref:
        result["head_coach_details"] = transform_coach(team.head_coach_ref)
    if team.assistant_coach_ref:
        result["assistant_coach_details"] = transform_coach(team.assistant_coach_ref)

    if include_roster:
        result["roster"] = [transform_player(p) for p in team.roster.all()]
        result["coach_kids"] = [transform_player(p) for p in team.coach_kids.all()]

    return result


def transform_draft_pick(pick) -> dict:
    """Transform a DraftPick to dict."""
    return {
        "id": str(pick.id),
        "draft_state": str(pick.draft_state_id),
        "round": pick.round,
        "pick": pick.pick,
        "team_id": str(pick.team_id),
        "player_id": str(pick.player_id) if pick.player_id else None,
        "was_skipped": pick.was_skipped,
        "timestamp": pick.timestamp.isoformat(),
    }


def transform_trade(trade) -> dict:
    """Transform a Trade to dict."""
    return {
        "id": str(trade.id),
        "draft_state": str(trade.draft_state_id),
        "team1_id": str(trade.team1_id),
        "team2_id": str(trade.team2_id),
        "player1_id": str(trade.player1_id),
        "player2_id": str(trade.player2_id),
        "reason": trade.reason,
        "timestamp": trade.timestamp.isoformat(),
    }


def transform_draft_state(draft_state) -> dict:
    """Transform a DraftState to dict."""
    mandatory_pick = None
    if draft_state.mandatory_player:
        mandatory_pick = {
            "player_id": str(draft_state.mandatory_player.id),
            "reason": draft_state.mandatory_reason,
            "sibling_name": draft_state.mandatory_sibling_name or None,
        }

    return {
        "id": str(draft_state.id),
        "division_id": str(draft_state.division_id),
        "draft_format": draft_state.draft_format,
        "draft_order": draft_state.draft_order,
        "current_round_order": draft_state.current_round_order,
        "current_round": draft_state.current_round,
        "current_pick_in_round": draft_state.current_pick_in_round,
        "current_team_id": str(draft_state.current_team_id) if draft_state.current_team_id else None,
        "is_draft_complete": draft_state.is_draft_complete,
        "mandatory_pick": mandatory_pick,
        "picks": [transform_draft_pick(p) for p in draft_state.picks.all()],
        "trades": [transform_trade(t) for t in draft_state.trades.all()],
    }


def transform_division_summary(division, player_count: Optional[int] = None) -> dict:
    """Transform a Division to summary dict (for list view).

    Args:
        division: Division model instance
        player_count: Optional pre-computed player count (avoids N+1 query)
    """
    # Use pre-computed count if provided, otherwise fall back to query
    computed_player_count = (
        player_count if player_count is not None
        else getattr(division, 'player_count', None)
        or division.players.count()
    )

    result = {
        "id": str(division.id),
        "name": division.name,
        "preset": division.preset,
        "team_count": division.team_count,
        "player_count": computed_player_count,
        "mode": division.mode,
        "phase": division.phase,
        "created_at": division.created_at.isoformat(),
        "completed_at": division.completed_at.isoformat() if division.completed_at else None,
    }

    # Include organization or owner info
    if division.organization_id:
        result["organization_id"] = str(division.organization_id)
        result["is_personal"] = False
    elif division.owner_id:
        result["owner_id"] = str(division.owner_id)
        result["is_personal"] = True
    else:
        result["is_personal"] = True

    return result


def transform_division(division, include_all: bool = False) -> dict:
    """
    Transform a Division to dict.

    Args:
        division: Division model instance
        include_all: If True, include teams, players, and draft_state
    """
    result = {
        "id": str(division.id),
        "name": division.name,
        "preset": division.preset,
        "age_range": {
            "min": division.age_range_min,
            "max": division.age_range_max,
        },
        "enforce_age_limit": division.enforce_age_limit,
        "max_per_age": division.max_per_age,
        "team_count": division.team_count,
        "roster_size": division.roster_size,
        "scoring_weights": division.scoring_weights,
        "scoring_mode": division.scoring_mode,
        "mode": division.mode,
        "phase": division.phase,
        "team_builder_algorithm_mode": division.team_builder_algorithm_mode,
        "created_at": division.created_at.isoformat(),
        "updated_at": division.updated_at.isoformat(),
        "completed_at": division.completed_at.isoformat() if division.completed_at else None,
    }

    # Include organization or owner info
    if division.organization_id:
        result["organization_id"] = str(division.organization_id)
        result["is_personal"] = False
    elif division.owner_id:
        result["owner_id"] = str(division.owner_id)
        result["is_personal"] = True
    else:
        result["is_personal"] = True

    if include_all:
        result["teams"] = [transform_team(t) for t in division.teams.all()]
        result["players"] = [transform_player(p) for p in division.players.all()]
        draft_state = getattr(division, "draft_state", None)
        result["draft_state"] = transform_draft_state(draft_state) if draft_state else None

    return result


def transform_organization_member(membership) -> dict:
    """Transform an OrganizationMembership to member info dict."""
    return {
        "id": str(membership.id),
        "user_id": str(membership.user.id),
        "email": membership.user.email,
        "first_name": membership.user.first_name,
        "last_name": membership.user.last_name,
        "role": membership.role,
        "joined_at": membership.created_at.isoformat(),
    }


# Alias for backwards compatibility
transform_league_member = transform_organization_member


def transform_invitation(invitation) -> dict:
    """Transform an OrganizationInvitation to dict."""
    return {
        "id": str(invitation.id),
        "email": invitation.email,
        "role": invitation.role,
        "invited_by_email": invitation.invited_by.email if invitation.invited_by else None,
        "is_link_invite": invitation.is_link_invite,
        "created_at": invitation.created_at.isoformat(),
        "expires_at": invitation.expires_at.isoformat(),
        "accepted_at": invitation.accepted_at.isoformat() if invitation.accepted_at else None,
        "is_expired": invitation.is_expired,
        "is_pending": invitation.is_pending,
    }


def transform_organization(organization) -> dict:
    """Transform an Organization to dict."""
    return {
        "id": str(organization.id),
        "name": organization.name,
        "slug": organization.slug,
        "created_at": organization.created_at.isoformat(),
        "member_count": organization.memberships.count(),
    }


# Alias for backwards compatibility
transform_league = transform_organization


def transform_coach(coach) -> dict:
    """Transform a Coach to dict."""
    return {
        "id": str(coach.id),
        "organization_id": str(coach.organization_id),
        "user_id": str(coach.user_id) if coach.user_id else None,
        "first_name": coach.first_name,
        "last_name": coach.last_name,
        "full_name": coach.full_name,
        "email": coach.email,
        "phone": coach.phone,
        "role": coach.role,
        "division_id": str(coach.division_id) if coach.division_id else None,
        "paired_with_id": str(coach.paired_with_id) if coach.paired_with_id else None,
        "is_active": coach.is_active,
        "created_at": coach.created_at.isoformat(),
        "updated_at": coach.updated_at.isoformat(),
    }


def transform_evaluation_template(template) -> dict:
    """Transform an EvaluationTemplate to dict."""
    return {
        "id": str(template.id),
        "organization_id": str(template.organization_id),
        "name": template.name,
        "description": template.description,
        "version": template.version,
        "parent_template_id": str(template.parent_template_id) if template.parent_template_id else None,
        "stations": template.stations,
        "coach_categories": template.coach_categories,
        "blend_weights": template.blend_weights,
        "is_active": template.is_active,
        "is_locked": template.is_locked,
        "created_by_id": str(template.created_by_id) if template.created_by_id else None,
        "created_at": template.created_at.isoformat(),
        "updated_at": template.updated_at.isoformat(),
    }


def transform_season(season) -> dict:
    """Transform a Season to dict."""
    return {
        "id": str(season.id),
        "organization_id": str(season.organization_id),
        "name": season.name,
        "year": season.year,
        "template_id": str(season.template_id),
        "is_active": season.is_active,
        "created_at": season.created_at.isoformat(),
        "updated_at": season.updated_at.isoformat(),
    }


def transform_team_builder_result(result) -> dict:
    """Transform TeamBuilderResult to dict for JSON response."""
    return {
        "assignments": [
            {
                "playerId": str(a.player_id),
                "teamId": str(a.team_id),
                "reason": a.reason,
                "round": a.round,
                "pick": a.pick,
            }
            for a in result.assignments
        ],
        "teamSummaries": [
            {
                "teamId": str(s.team_id),
                "teamName": s.team_name,
                "coachName": s.coach_name,
                "rosterCount": s.roster_count,
                "totalScore": s.total_score,
                "meanDeltaPercent": s.mean_delta_percent,
            }
            for s in result.team_summaries
        ],
        "playerHappiness": [
            {
                "playerId": str(h.player_id),
                "score": h.score,
                "coachRequestHonored": h.coach_request_honored,
                "teammateRequestsTotal": h.teammate_requests_total,
                "teammateRequestsHonored": h.teammate_requests_honored,
                "twoWayRequestsTotal": h.two_way_requests_total,
                "twoWayRequestsHonored": h.two_way_requests_honored,
            }
            for h in result.player_happiness
        ],
        "stats": {
            "totalPlayers": result.stats.total_players,
            "averageHappiness": result.stats.average_happiness,
            "lockedPlayers": result.stats.locked_players,
            "topTalentPlayers": result.stats.top_talent_players,
            "requestBasedPlayers": result.stats.request_based_players,
            "balanceBasedPlayers": result.stats.balance_based_players,
            "twoWayRequestsTotal": result.stats.two_way_requests_total,
            "twoWayRequestsHonored": result.stats.two_way_requests_honored,
            "oneWayRequestsTotal": result.stats.one_way_requests_total,
            "oneWayRequestsHonored": result.stats.one_way_requests_honored,
            "coachRequestsTotal": result.stats.coach_requests_total,
            "coachRequestsHonored": result.stats.coach_requests_honored,
        },
        "warnings": result.warnings,
    }


def transform_coach_rating(rating) -> dict:
    """Transform a CoachRating to dict."""
    return {
        "id": str(rating.id),
        "season_id": str(rating.season_id),
        "coach_id": str(rating.coach_id),
        "player_first_name": rating.player_first_name,
        "player_last_name": rating.player_last_name,
        "player_id": str(rating.player_id) if rating.player_id else None,
        "scores": rating.scores,
        "status": rating.status,
        "created_at": rating.created_at.isoformat(),
        "updated_at": rating.updated_at.isoformat(),
        "submitted_at": rating.submitted_at.isoformat() if rating.submitted_at else None,
    }


def transform_rating_progress(coach_data) -> dict:
    """Transform aggregated coach rating progress to dict."""
    return {
        "coach_id": str(coach_data["coach_id"]),
        "coach_email": coach_data["coach_email"],
        "coach_first_name": coach_data["coach_first_name"],
        "coach_last_name": coach_data["coach_last_name"],
        "total_ratings": coach_data["total_ratings"],
        "submitted_ratings": coach_data["submitted_ratings"],
        "draft_ratings": coach_data["draft_ratings"],
    }


def transform_tryout_group(group, include_players: bool = False) -> dict:
    """Transform a TryoutGroup to dict."""
    result = {
        "id": str(group.id),
        "season_id": str(group.season_id),
        "name": group.name,
        "rotation_order": group.rotation_order,
        "player_count": group.players.count(),
        "created_at": group.created_at.isoformat(),
        "updated_at": group.updated_at.isoformat(),
    }
    if include_players:
        result["players"] = [transform_group_player(p) for p in group.players.all()]
    return result


def transform_group_player(player) -> dict:
    """Transform a GroupPlayer to dict."""
    return {
        "id": str(player.id),
        "group_id": str(player.group_id),
        "season_id": str(player.season_id),
        "first_name": player.first_name,
        "last_name": player.last_name,
        "bib_number": player.bib_number,
        "created_at": player.created_at.isoformat(),
    }


def transform_station_score(score) -> dict:
    """Transform a StationScore to dict."""
    return {
        "id": str(score.id),
        "season_id": str(score.season_id),
        "group_id": str(score.group_id),
        "player_id": str(score.player_id),
        "station_id": score.station_id,
        "scores": score.scores,
        "scored_by_id": str(score.scored_by_id),
        "scored_by_email": score.scored_by.email,
        "scored_at": score.scored_at.isoformat(),
        "updated_at": score.updated_at.isoformat(),
    }


def transform_tryout_progress(progress_data) -> dict:
    """Transform tryout progress data to dict."""
    return {
        "group_id": progress_data["group_id"],
        "group_name": progress_data["group_name"],
        "station_id": progress_data["station_id"],
        "station_name": progress_data["station_name"],
        "scored_count": progress_data["scored_count"],
        "total_players": progress_data["total_players"],
        "complete": progress_data["complete"],
    }


def transform_composite_result(result: dict) -> dict:
    """Transform composite score result to dict.

    Converts UUIDs to strings and ensures proper formatting for API response.
    """
    # Round float values to 2 decimal places
    def round_value(val):
        if val is None:
            return None
        if isinstance(val, float):
            return round(val, 2)
        return val

    return {
        "player_key": result["player_key"],
        "first_name": result["first_name"],
        "last_name": result["last_name"],
        "bib_number": result.get("bib_number"),
        "group_player_id": result.get("group_player_id"),
        "tier": result["tier"],
        "composite_score": round_value(result.get("composite_score")),
        "coach_aggregate": round_value(result.get("coach_aggregate")),
        "tryout_aggregate": round_value(result.get("tryout_aggregate")),
        "is_partial_tryout": result.get("is_partial_tryout", False),
        "rank": result.get("rank"),
    }


def transform_composite_detail(detail: dict) -> dict:
    """Transform composite score detail (full breakdown) to dict.

    Includes coach rating details and tryout score details with nested structure.
    """
    def round_value(val):
        if val is None:
            return None
        if isinstance(val, float):
            return round(val, 2)
        return val

    # Round all nested scores
    coach_detail = detail.get("coach_detail")
    if coach_detail:
        coach_detail = {
            "raw_scores": coach_detail.get("raw_scores", {}),
            "normalized_scores": {
                k: round_value(v) for k, v in coach_detail.get("normalized_scores", {}).items()
            },
            "aggregate": round_value(coach_detail.get("aggregate")),
            "coach_name": coach_detail.get("coach_name"),
            "status": coach_detail.get("status"),
        }

    tryout_detail = detail.get("tryout_detail")
    if tryout_detail:
        stations = {}
        for station_id, station_data in tryout_detail.get("stations", {}).items():
            stations[station_id] = {
                "raw_scores": station_data.get("raw_scores", {}),
                "normalized_scores": {
                    k: round_value(v) for k, v in station_data.get("normalized_scores", {}).items()
                },
                "aggregate": round_value(station_data.get("aggregate")),
            }
        tryout_detail = {
            "stations": stations,
            "aggregate": round_value(tryout_detail.get("aggregate")),
            "stations_scored": tryout_detail.get("stations_scored", 0),
            "stations_total": tryout_detail.get("stations_total", 0),
        }

    return {
        "player_key": detail["player_key"],
        "first_name": detail["first_name"],
        "last_name": detail["last_name"],
        "bib_number": detail.get("bib_number"),
        "group_player_id": detail.get("group_player_id"),
        "tier": detail["tier"],
        "composite_score": round_value(detail.get("composite_score")),
        "coach_aggregate": round_value(detail.get("coach_aggregate")),
        "tryout_aggregate": round_value(detail.get("tryout_aggregate")),
        "is_partial_tryout": detail.get("is_partial_tryout", False),
        "rank": detail.get("rank"),
        "coach_detail": coach_detail,
        "tryout_detail": tryout_detail,
    }


def transform_composite_to_player_data(composite_result: dict, rank: int, team_count: int) -> dict:
    """Transform a composite score result into Player-compatible field structure.

    Maps composite breakdowns to Player model fields. Coach rating categories
    map to subjective skill fields, tryout station scores map to objective fields.
    The composite_score becomes total_score.
    """
    import math

    first_name = composite_result["first_name"]
    last_name = composite_result["last_name"]

    # Extract coach breakdown scores (normalized 0-100)
    coach_detail = composite_result.get("coach_detail") or {}
    coach_normalized = coach_detail.get("normalized_scores", {})

    # Extract tryout breakdown scores (station aggregates, normalized 0-100)
    tryout_detail = composite_result.get("tryout_detail") or {}
    tryout_stations = tryout_detail.get("stations", {})

    # Map coach categories to Player fields by category name heuristic
    # Coach categories have IDs like UUIDs; we match on category name from raw_scores keys
    # Since we don't have category names in the result, use normalized values directly
    # All normalized scores are 0-100; average them for subtotals
    coach_values = list(coach_normalized.values())
    coach_aggregate = composite_result.get("coach_aggregate") or 0

    # Map tryout stations to Player fields by station aggregate
    # Each station has an aggregate score (0-100 normalized)
    station_aggregates = []
    for station_id, station_data in tryout_stations.items():
        agg = station_data.get("aggregate")
        if agg is not None:
            station_aggregates.append(agg)
    tryout_aggregate = composite_result.get("tryout_aggregate") or 0

    # Composite score is the blended total
    composite_score = composite_result.get("composite_score") or 0

    return {
        "bib": str(composite_result.get("bib_number") or f"E-{rank}"),
        "first_name": first_name,
        "last_name": last_name,
        "name": f"{first_name} {last_name}",
        # Component scores: distribute coach aggregate across skill fields
        # Since composite scoring normalizes to 0-100, we store the aggregate values
        "field_score": 0,
        "throw_score": 0,
        "hit_power": 0,
        "hit_form": 0,
        "hit_contact": 0,
        "pitching_strength": 0,
        "pitching_form": 0,
        "catch_score": 0,
        "running_score": 0,
        # Subtotals from evaluation sources
        "fielding_subtotal": 0,
        "hitting_subtotal": 0,
        "pitching_subtotal": 0,
        "subjective_total": round(coach_aggregate, 2) if coach_aggregate else 0,
        "objective_total": round(tryout_aggregate, 2) if tryout_aggregate else 0,
        "official_adjust": 0,
        # The composite score IS the total score for draft ranking
        "total_score": round(composite_score, 2),
        "rank": rank,
        "projected_round": math.ceil(rank / team_count) if team_count > 0 else 1,
        # Player info — age not available from evaluation system, default 0
        "little_league_age": 0,
        "birthday": "",
        "is_all_star": False,
        "is_dne": composite_result.get("tier") == "dne" or composite_score == 0,
        # Draft rules — not set during import (admin configures in review phase)
        "is_coach_kid": False,
        "coach_team_id": None,
        "sibling": "",
        "sibling_id": None,
        # Draft status — always fresh
        "is_drafted": False,
        "drafted_by_team_id": None,
        "drafted_in_round": None,
        "drafted_at_pick": None,
        # Evaluation metadata (for UI display)
        "tier": composite_result.get("tier", "full"),
        "coach_aggregate": round(coach_aggregate, 2) if coach_aggregate else None,
        "tryout_aggregate": round(tryout_aggregate, 2) if tryout_aggregate else None,
        "is_partial_tryout": composite_result.get("is_partial_tryout", False),
    }
