"""
Composite score calculation service.

Normalizes heterogeneous score types (scales, times, counts) to 0-100 scale,
aggregates coach ratings and tryout scores, blends using configurable weights,
and classifies players into tiers based on data completeness.
"""

from django.db import transaction
from uuid import UUID
from typing import Dict, List, Optional, Tuple
import statistics

from .models import Season, CoachRating, StationScore, GroupPlayer, EvaluationTemplate
from .logging import get_logger

logger = get_logger(__name__)


class CompositeScoreService:
    """Service for composite score calculations."""

    @classmethod
    @transaction.atomic
    def calculate_composite_scores(
        cls, season_id: UUID, weights: dict
    ) -> List[dict]:
        """Calculate composite scores for all players in a season.

        Args:
            season_id: Season to calculate scores for
            weights: {
                "coach_rating": int (0-100),
                "tryout_score": int (0-100),
                "station_weights": {station_id: int} (optional, sums to 100)
            }

        Returns:
            List of composite result dicts sorted by tier then composite_score descending.
            Each dict contains: player_key, first_name, last_name, bib_number, tier,
            composite_score, coach_aggregate, tryout_aggregate, rank, is_partial_tryout, etc.
        """
        try:
            season = Season.objects.select_related("template").get(id=season_id)
        except Season.DoesNotExist:
            logger.error(f"Season not found: {season_id}")
            raise

        template = season.template
        logger.info(
            f"Calculating composite scores for season {season.name} "
            f"with weights coach={weights.get('coach_rating')}%, "
            f"tryout={weights.get('tryout_score')}%"
        )

        # Gather all unique players
        players = cls._gather_players(season)
        logger.debug(f"Found {len(players)} unique players")

        # Aggregate coach ratings
        coach_scores = cls._aggregate_coach_ratings(season, template)
        logger.debug(f"Aggregated coach ratings for {len(coach_scores)} players")

        # Aggregate tryout scores
        tryout_scores = cls._aggregate_tryout_scores(season, template)
        logger.debug(f"Aggregated tryout scores for {len(tryout_scores)} players")

        # Blend and rank
        results = cls._blend_and_rank(
            players, coach_scores, tryout_scores, weights, template, season
        )
        logger.info(
            f"Composite calculation complete: {len(results)} players ranked"
        )

        return results

    @classmethod
    def _gather_players(cls, season: Season) -> List[dict]:
        """Gather all unique players from GroupPlayer and CoachRating records.

        Returns:
            List of dicts with first_name, last_name, bib_number, group_player_id.
        """
        players = {}

        # Get all tryout players
        for gp in GroupPlayer.objects.filter(season=season):
            key = cls._make_player_key(gp.first_name, gp.last_name)
            players[key] = {
                "first_name": gp.first_name,
                "last_name": gp.last_name,
                "bib_number": gp.bib_number,
                "group_player_id": gp.id,
            }

        # Add players who have coach ratings but no tryout record
        for cr in CoachRating.objects.filter(season=season, status="submitted"):
            key = cls._make_player_key(cr.player_first_name, cr.player_last_name)
            if key not in players:
                players[key] = {
                    "first_name": cr.player_first_name,
                    "last_name": cr.player_last_name,
                    "bib_number": None,
                    "group_player_id": None,
                }

        return list(players.values())

    @classmethod
    def _aggregate_coach_ratings(
        cls, season: Season, template: EvaluationTemplate
    ) -> Dict[str, dict]:
        """Aggregate coach ratings per player.

        Returns:
            Dict keyed by player_key, values contain:
            {
                "raw_scores": {category_id: raw_value},
                "normalized_scores": {category_id: normalized_value},
                "aggregate": float,
                "coach_name": str,
                "status": str
            }
        """
        results = {}
        categories = {cat["id"]: cat for cat in template.coach_categories}

        for rating in CoachRating.objects.filter(
            season=season, status="submitted"
        ).select_related("coach"):
            key = cls._make_player_key(
                rating.player_first_name, rating.player_last_name
            )

            raw_scores = {}
            normalized_scores = {}

            for cat_id, raw_value in rating.scores.items():
                if cat_id not in categories:
                    logger.warning(
                        f"Category {cat_id} not found in template for rating {rating.id}"
                    )
                    continue

                category = categories[cat_id]
                # Coach categories are always scales (1-5 or similar)
                # Higher is better
                max_value = category.get("max", 5)
                normalized = cls._normalize_score_value(
                    raw_value, {"type": "scale", "max": max_value}
                )

                raw_scores[cat_id] = raw_value
                if normalized is not None:
                    normalized_scores[cat_id] = normalized

            # Calculate aggregate (average of normalized category scores)
            if normalized_scores:
                aggregate = sum(normalized_scores.values()) / len(normalized_scores)
            else:
                aggregate = None

            results[key] = {
                "raw_scores": raw_scores,
                "normalized_scores": normalized_scores,
                "aggregate": aggregate,
                "coach_name": rating.coach.email,
                "status": rating.status,
            }

        return results

    @classmethod
    def _aggregate_tryout_scores(
        cls, season: Season, template: EvaluationTemplate
    ) -> Dict[str, dict]:
        """Aggregate tryout station scores per player.

        Returns:
            Dict keyed by player_key, values contain:
            {
                "stations": {
                    station_id: {
                        "raw_scores": {field_id: raw_value},
                        "normalized_scores": {field_id: normalized_value},
                        "aggregate": float
                    }
                },
                "aggregate": float,
                "stations_scored": int,
                "stations_total": int
            }
        """
        results = {}
        stations = {station["id"]: station for station in template.stations}

        # First pass: collect all values for each field for percentile calculation
        field_values = {}  # field_id -> list of values

        for score_record in StationScore.objects.filter(season=season).select_related(
            "player"
        ):
            station_id = score_record.station_id
            if station_id not in stations:
                continue

            station = stations[station_id]
            for field in station.get("score_fields", []):
                field_id = field["id"]
                if field_id in score_record.scores:
                    value = score_record.scores[field_id]
                    if value is not None:
                        if field_id not in field_values:
                            field_values[field_id] = []
                        field_values[field_id].append(value)

        # Second pass: normalize and aggregate
        for score_record in StationScore.objects.filter(season=season).select_related(
            "player"
        ):
            player = score_record.player
            key = cls._make_player_key(player.first_name, player.last_name)

            if key not in results:
                results[key] = {
                    "stations": {},
                    "aggregate": None,
                    "stations_scored": 0,
                    "stations_total": len(stations),
                }

            station_id = score_record.station_id
            if station_id not in stations:
                logger.warning(
                    f"Station {station_id} not found in template for score {score_record.id}"
                )
                continue

            station = stations[station_id]
            raw_scores = {}
            normalized_scores = {}

            for field in station.get("score_fields", []):
                field_id = field["id"]
                if field_id not in score_record.scores:
                    continue

                raw_value = score_record.scores[field_id]
                raw_scores[field_id] = raw_value

                # Get all values for this field for percentile-based normalization
                all_field_values = field_values.get(field_id, [])

                # Normalize
                normalized = cls._normalize_score_value(
                    raw_value, field, all_field_values
                )
                if normalized is not None:
                    normalized_scores[field_id] = normalized

            # Calculate station aggregate (average of normalized field scores)
            if normalized_scores:
                station_aggregate = sum(normalized_scores.values()) / len(
                    normalized_scores
                )
            else:
                station_aggregate = None

            results[key]["stations"][station_id] = {
                "raw_scores": raw_scores,
                "normalized_scores": normalized_scores,
                "aggregate": station_aggregate,
            }
            results[key]["stations_scored"] += 1

        # Calculate overall tryout aggregate for each player
        for key, player_data in results.items():
            station_aggregates = [
                station["aggregate"]
                for station in player_data["stations"].values()
                if station["aggregate"] is not None
            ]
            if station_aggregates:
                player_data["aggregate"] = sum(station_aggregates) / len(
                    station_aggregates
                )

        return results

    @classmethod
    def _blend_and_rank(
        cls,
        players: List[dict],
        coach_scores: Dict[str, dict],
        tryout_scores: Dict[str, dict],
        weights: dict,
        template: EvaluationTemplate,
        season: Season,
    ) -> List[dict]:
        """Blend coach and tryout scores using weights, classify into tiers, and rank.

        Args:
            players: List of player dicts
            coach_scores: Aggregated coach ratings by player_key
            tryout_scores: Aggregated tryout scores by player_key
            weights: Weight configuration
            template: Evaluation template
            season: Season (for tier overrides)

        Returns:
            List of composite result dicts sorted by tier then score.
        """
        coach_weight = weights.get("coach_rating", 50)
        tryout_weight = weights.get("tryout_score", 50)
        station_weights = weights.get("station_weights", {})

        # Get tier overrides from season (if exists)
        tier_overrides = getattr(season, "composite_tier_overrides", {}) or {}

        composites = []

        for player in players:
            key = cls._make_player_key(player["first_name"], player["last_name"])
            coach_data = coach_scores.get(key)
            tryout_data = tryout_scores.get(key)

            has_coach = coach_data and coach_data.get("aggregate") is not None
            has_tryout = tryout_data and tryout_data.get("aggregate") is not None

            # Determine tier (with override support)
            if key in tier_overrides:
                tier = tier_overrides[key]
            elif has_coach and has_tryout:
                tier = "full"
            elif has_coach:
                tier = "coach_only"
            elif has_tryout:
                tier = "tryout_only"
            else:
                # No data for this player, skip
                continue

            # Calculate composite score
            coach_aggregate = coach_data.get("aggregate") if coach_data else None
            tryout_aggregate = tryout_data.get("aggregate") if tryout_data else None

            # Apply station-level weights if provided
            if station_weights and tryout_data:
                weighted_station_scores = []
                total_weight = 0
                for station_id, weight in station_weights.items():
                    if station_id in tryout_data.get("stations", {}):
                        station_agg = tryout_data["stations"][station_id].get(
                            "aggregate"
                        )
                        if station_agg is not None:
                            weighted_station_scores.append(station_agg * weight)
                            total_weight += weight
                if total_weight > 0:
                    tryout_aggregate = sum(weighted_station_scores) / total_weight

            if tier == "full":
                # Both sources: blend using weights
                composite_score = (
                    coach_aggregate * (coach_weight / 100)
                    + tryout_aggregate * (tryout_weight / 100)
                )
            elif tier == "coach_only":
                # Coach-only: use coach score as-is (NOT weighted)
                composite_score = coach_aggregate
            elif tier == "tryout_only":
                # Tryout-only: use tryout score as-is (NOT weighted)
                composite_score = tryout_aggregate
            else:
                composite_score = None

            # Check if partial tryout data
            is_partial_tryout = False
            if tryout_data:
                stations_scored = tryout_data.get("stations_scored", 0)
                stations_total = tryout_data.get("stations_total", 0)
                is_partial_tryout = (
                    0 < stations_scored < stations_total if stations_total > 0 else False
                )

            composites.append(
                {
                    "player_key": key,
                    "first_name": player["first_name"],
                    "last_name": player["last_name"],
                    "bib_number": player.get("bib_number"),
                    "group_player_id": str(player["group_player_id"])
                    if player.get("group_player_id")
                    else None,
                    "tier": tier,
                    "composite_score": round(composite_score, 2)
                    if composite_score is not None
                    else None,
                    "coach_aggregate": round(coach_aggregate, 2)
                    if coach_aggregate is not None
                    else None,
                    "tryout_aggregate": round(tryout_aggregate, 2)
                    if tryout_aggregate is not None
                    else None,
                    "is_partial_tryout": is_partial_tryout,
                    "coach_detail": coach_data,
                    "tryout_detail": tryout_data,
                }
            )

        # Sort: full-data first, then coach-only, then tryout-only
        # Within each tier, sort by composite_score descending
        tier_order = {"full": 0, "coach_only": 1, "tryout_only": 2}
        composites.sort(
            key=lambda x: (
                tier_order.get(x["tier"], 3),
                -(x["composite_score"] or 0),
            )
        )

        # Assign rank within each tier
        current_tier = None
        rank_in_tier = 0
        for composite in composites:
            if composite["tier"] != current_tier:
                current_tier = composite["tier"]
                rank_in_tier = 1
            else:
                rank_in_tier += 1
            composite["rank"] = rank_in_tier

        return composites

    @classmethod
    def _normalize_score_value(
        cls,
        value: Optional[float],
        field_def: dict,
        all_values_for_field: Optional[List[float]] = None,
    ) -> Optional[float]:
        """Normalize a single score value to 0-100 scale.

        Args:
            value: Raw score value
            field_def: Field definition with type and min/max
            all_values_for_field: All values for this field (for percentile calculation)

        Returns:
            Normalized value 0-100, or None if value is None
        """
        if value is None:
            return None

        field_type = field_def.get("type", "scale")

        if field_type == "time":
            # Lower is better - invert scale
            # Use percentile-based range if available
            if all_values_for_field and len(all_values_for_field) >= 5:
                min_val, max_val = cls._calculate_percentile_range(
                    all_values_for_field, percentile=5
                )
            else:
                min_val = field_def.get("min", 0)
                max_val = field_def.get("max", 10)

            if max_val == min_val:
                return 50.0

            # Invert: lower time = higher score
            normalized = ((max_val - value) / (max_val - min_val)) * 100
        else:
            # scale or count: higher is better
            max_val = field_def.get("max", 5)
            if value <= 0:
                return 0.0
            if value >= max_val:
                return 100.0
            normalized = (value / max_val) * 100

        # Clamp to 0-100
        return max(0.0, min(100.0, normalized))

    @classmethod
    def _calculate_percentile_range(
        cls, values: List[float], percentile: int = 5
    ) -> Tuple[float, float]:
        """Calculate percentile-based min/max range.

        Args:
            values: List of values
            percentile: Percentile to use for min/max (default 5 for 5th/95th)

        Returns:
            (min_value, max_value) tuple
        """
        if len(values) < 5:
            return min(values), max(values)

        sorted_values = sorted(values)
        n = len(sorted_values)

        # Calculate indices for percentiles
        low_index = int((percentile / 100) * n)
        high_index = int(((100 - percentile) / 100) * n)

        # Ensure indices are within bounds
        low_index = max(0, min(low_index, n - 1))
        high_index = max(0, min(high_index, n - 1))

        return sorted_values[low_index], sorted_values[high_index]

    @classmethod
    def get_player_detail(
        cls, season_id: UUID, player_key: str, weights: dict
    ) -> Optional[dict]:
        """Get full composite breakdown for a single player.

        Args:
            season_id: Season ID
            player_key: Player key (first_last normalized)
            weights: Weight configuration

        Returns:
            Composite result dict for the player, or None if not found
        """
        results = cls.calculate_composite_scores(season_id, weights)
        for result in results:
            if result["player_key"] == player_key:
                return result
        return None

    @classmethod
    @transaction.atomic
    def promote_player(
        cls, season_id: UUID, player_key: str, target_tier: str
    ) -> None:
        """Promote or demote a player to a different tier.

        Args:
            season_id: Season ID
            player_key: Player key (first_last normalized)
            target_tier: "full", "coach_only", or "tryout_only"

        Raises:
            Season.DoesNotExist if season not found
        """
        season = Season.objects.select_for_update().get(id=season_id)

        # Initialize tier_overrides if needed
        if not hasattr(season, "composite_tier_overrides") or season.composite_tier_overrides is None:
            season.composite_tier_overrides = {}

        # Update override
        season.composite_tier_overrides[player_key] = target_tier
        season.save(update_fields=["composite_tier_overrides"])

        logger.info(
            f"Promoted player {player_key} to tier {target_tier} in season {season.name}"
        )

    @classmethod
    def _make_player_key(cls, first_name: str, last_name: str) -> str:
        """Create normalized player key for matching.

        Args:
            first_name: Player first name
            last_name: Player last name

        Returns:
            Normalized key: "first_last" in lowercase
        """
        return f"{first_name.lower().strip()}_{last_name.lower().strip()}"
