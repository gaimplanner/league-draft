"""
Team Builder service for auto-assigning players to teams.

This implements the greedy assignment algorithm that:
1. Places locked players (coach kids, siblings)
2. Spreads top talent evenly for balance
3. Honors two-way and one-way friend requests
4. Falls back to team balance
"""

from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID
from django.db import transaction

from ..models import Division, Team, Player, DraftState, DraftPick


# -----------------------------------------------------------------------------
# Types
# -----------------------------------------------------------------------------

@dataclass
class TeamBuilderConfig:
    """Configuration for the team builder algorithm."""
    balance_tolerance: float = 0.10  # e.g., 0.10 for ±10%
    top_talent_rounds: int = 2       # Number of "rounds" of top talent to spread
    max_roster_size: int = 13        # Hard max per team
    prioritize_balance: bool = True  # Balance > happiness


@dataclass
class PlayerHappiness:
    """Happiness tracking for a player."""
    player_id: UUID
    score: str  # 'all', 'some', 'none', 'no-requests'
    coach_request_honored: Optional[bool] = None
    teammate_requests_total: int = 0
    teammate_requests_honored: int = 0
    two_way_requests_total: int = 0
    two_way_requests_honored: int = 0


@dataclass
class AssignmentResult:
    """Result of assigning a player to a team."""
    player_id: UUID
    team_id: UUID
    reason: str  # 'coach-kid', 'sibling-lock', 'top-talent', 'two-way-friend', etc.
    round: int
    pick: int


@dataclass
class TeamSummary:
    """Summary stats for a team after assignment."""
    team_id: UUID
    team_name: str
    coach_name: str
    roster_count: int
    total_score: float
    mean_delta_percent: float


@dataclass
class TeamBuilderStats:
    """Overall statistics for the assignment."""
    total_players: int = 0
    average_happiness: float = 0.0
    locked_players: int = 0
    top_talent_players: int = 0
    request_based_players: int = 0
    balance_based_players: int = 0
    two_way_requests_total: int = 0
    two_way_requests_honored: int = 0
    one_way_requests_total: int = 0
    one_way_requests_honored: int = 0
    coach_requests_total: int = 0
    coach_requests_honored: int = 0


@dataclass
class TeamBuilderResult:
    """Complete result of the team builder algorithm."""
    assignments: list[AssignmentResult] = field(default_factory=list)
    team_summaries: list[TeamSummary] = field(default_factory=list)
    player_happiness: list[PlayerHappiness] = field(default_factory=list)
    stats: TeamBuilderStats = field(default_factory=TeamBuilderStats)
    warnings: list[str] = field(default_factory=list)


@dataclass
class TeamBuilderPlayer:
    """Extended player data for team builder algorithm."""
    id: UUID
    bib: str
    first_name: str
    last_name: str
    name: str
    total_score: float
    is_coach_kid: bool
    coach_team_id: Optional[UUID]
    sibling_id: Optional[UUID]
    locked_to_team_id: Optional[UUID]

    # Team Builder specific fields
    coach_request: str = ""
    teammate_requests: list[str] = field(default_factory=list)
    school: str = ""
    grade: Optional[int] = None

    # Resolved request IDs
    resolved_coach_team_id: Optional[UUID] = None
    resolved_teammate_ids: list[UUID] = field(default_factory=list)
    two_way_teammate_ids: list[UUID] = field(default_factory=list)
    one_way_teammate_ids: list[UUID] = field(default_factory=list)


# -----------------------------------------------------------------------------
# Algorithm
# -----------------------------------------------------------------------------

class TeamBuilderService:
    """Service for auto-assigning players to teams."""

    def __init__(self, config: Optional[TeamBuilderConfig] = None):
        self.config = config or TeamBuilderConfig()

    def run_algorithm(
        self,
        players: list[TeamBuilderPlayer],
        teams: list[Team]
    ) -> TeamBuilderResult:
        """
        Run the team builder algorithm.

        Args:
            players: List of players with resolved requests
            teams: List of teams to assign players to

        Returns:
            TeamBuilderResult with all assignments and statistics
        """
        result = TeamBuilderResult()

        # Track team state
        team_scores: dict[UUID, float] = {t.id: 0.0 for t in teams}
        team_rosters: dict[UUID, list[UUID]] = {t.id: [] for t in teams}
        assigned_players: set[UUID] = set()

        pick_counter = 0
        round_counter = 1

        def get_lowest_score_team() -> Optional[Team]:
            """Get team with lowest total score that has room."""
            valid_teams = [
                t for t in teams
                if len(team_rosters[t.id]) < self.config.max_roster_size
            ]
            if not valid_teams:
                return None
            return min(valid_teams, key=lambda t: team_scores[t.id])

        def assign_player(
            player: TeamBuilderPlayer,
            team: Team,
            reason: str
        ) -> AssignmentResult:
            nonlocal pick_counter, round_counter

            pick_counter += 1
            team_scores[team.id] += player.total_score
            team_rosters[team.id].append(player.id)
            assigned_players.add(player.id)

            # Calculate round (1-indexed)
            picks_per_round = len(teams)
            current_round = ((pick_counter - 1) // picks_per_round) + 1

            assignment = AssignmentResult(
                player_id=player.id,
                team_id=team.id,
                reason=reason,
                round=current_round,
                pick=pick_counter
            )
            result.assignments.append(assignment)

            # Update stats
            if reason in ('coach-kid', 'assistant-coach-kid', 'sibling-lock', 'manual-lock'):
                result.stats.locked_players += 1
            elif reason == 'top-talent':
                result.stats.top_talent_players += 1
            elif reason in ('two-way-friend', 'one-way-friend', 'coach-request', 'school-cluster'):
                result.stats.request_based_players += 1
            else:
                result.stats.balance_based_players += 1

            return assignment

        def is_team_valid(team: Team, player: TeamBuilderPlayer) -> bool:
            """Check if team can accept this player (roster size and balance)."""
            if len(team_rosters[team.id]) >= self.config.max_roster_size:
                return False

            if self.config.prioritize_balance:
                # Check balance tolerance
                new_score = team_scores[team.id] + player.total_score
                mean_score = sum(team_scores.values()) / len(teams)
                if mean_score > 0:
                    delta = abs(new_score - mean_score) / mean_score
                    if delta > self.config.balance_tolerance:
                        return False

            return True

        # ---------------------------------------------------------------------
        # Phase 0: Place locked players
        # ---------------------------------------------------------------------

        locked_players = [
            p for p in players
            if p.is_coach_kid or p.locked_to_team_id
        ]

        for player in locked_players:
            team_id = player.coach_team_id or player.locked_to_team_id
            if not team_id:
                continue

            team = next((t for t in teams if t.id == team_id), None)
            if not team:
                result.warnings.append(f"Could not find team for locked player {player.name}")
                continue

            reason = 'coach-kid' if player.is_coach_kid else 'manual-lock'
            assign_player(player, team, reason)

        # Place siblings with their locked sibling
        for player in players:
            if player.id in assigned_players:
                continue
            if not player.sibling_id:
                continue

            # Find sibling's assignment
            sibling_assignment = next(
                (a for a in result.assignments if a.player_id == player.sibling_id),
                None
            )
            if sibling_assignment:
                team = next((t for t in teams if t.id == sibling_assignment.team_id), None)
                if team:
                    assign_player(player, team, 'sibling-lock')

        # ---------------------------------------------------------------------
        # Phase 1: Top talent distribution
        # ---------------------------------------------------------------------

        remaining_players = [p for p in players if p.id not in assigned_players]
        remaining_players.sort(key=lambda p: p.total_score, reverse=True)

        top_talent_count = len(teams) * self.config.top_talent_rounds
        top_talent_players = remaining_players[:top_talent_count]

        for player in top_talent_players:
            if player.id in assigned_players:
                continue

            team = get_lowest_score_team()
            if team:
                assign_player(player, team, 'top-talent')

        # ---------------------------------------------------------------------
        # Phase 2: Request-based placement
        # ---------------------------------------------------------------------

        remaining_players = [p for p in players if p.id not in assigned_players]
        remaining_players.sort(key=lambda p: p.total_score, reverse=True)

        for player in remaining_players:
            if player.id in assigned_players:
                continue

            best_team: Optional[Team] = None
            best_reason = 'balance'

            # Priority 1: Two-way friend already on a team
            for friend_id in player.two_way_teammate_ids:
                friend_team_id = next(
                    (a.team_id for a in result.assignments if a.player_id == friend_id),
                    None
                )
                if friend_team_id:
                    team = next((t for t in teams if t.id == friend_team_id), None)
                    if team and is_team_valid(team, player):
                        best_team = team
                        best_reason = 'two-way-friend'
                        break

            # Priority 2: One-way friend already on a team
            if not best_team:
                for friend_id in player.one_way_teammate_ids:
                    friend_team_id = next(
                        (a.team_id for a in result.assignments if a.player_id == friend_id),
                        None
                    )
                    if friend_team_id:
                        team = next((t for t in teams if t.id == friend_team_id), None)
                        if team and is_team_valid(team, player):
                            best_team = team
                            best_reason = 'one-way-friend'
                            break

            # Priority 3: Coach request
            if not best_team and player.resolved_coach_team_id:
                team = next(
                    (t for t in teams if t.id == player.resolved_coach_team_id),
                    None
                )
                if team and is_team_valid(team, player):
                    best_team = team
                    best_reason = 'coach-request'

            # Priority 4: School clustering
            if not best_team and player.school:
                school_counts: dict[UUID, int] = {}
                for assignment in result.assignments:
                    assigned_player = next(
                        (p for p in players if p.id == assignment.player_id),
                        None
                    )
                    if assigned_player and assigned_player.school == player.school:
                        school_counts[assignment.team_id] = \
                            school_counts.get(assignment.team_id, 0) + 1

                if school_counts:
                    best_school_team_id = max(school_counts, key=school_counts.get)
                    team = next((t for t in teams if t.id == best_school_team_id), None)
                    if team and is_team_valid(team, player):
                        best_team = team
                        best_reason = 'school-cluster'

            # Priority 5: Balance (lowest score)
            if not best_team:
                best_team = get_lowest_score_team()
                best_reason = 'balance'

            if best_team:
                assign_player(player, best_team, best_reason)
            else:
                result.warnings.append(f"Could not assign player {player.name}")

        # ---------------------------------------------------------------------
        # Calculate happiness scores
        # ---------------------------------------------------------------------

        for player in players:
            assignment = next(
                (a for a in result.assignments if a.player_id == player.id),
                None
            )
            if not assignment:
                continue

            happiness = PlayerHappiness(
                player_id=player.id,
                score='no-requests'
            )

            has_requests = False
            all_honored = True
            some_honored = False

            # Coach request
            if player.resolved_coach_team_id:
                has_requests = True
                result.stats.coach_requests_total += 1
                if assignment.team_id == player.resolved_coach_team_id:
                    happiness.coach_request_honored = True
                    result.stats.coach_requests_honored += 1
                    some_honored = True
                else:
                    happiness.coach_request_honored = False
                    all_honored = False

            # Teammate requests
            for friend_id in player.two_way_teammate_ids:
                has_requests = True
                happiness.two_way_requests_total += 1
                result.stats.two_way_requests_total += 1
                friend_assignment = next(
                    (a for a in result.assignments if a.player_id == friend_id),
                    None
                )
                if friend_assignment and friend_assignment.team_id == assignment.team_id:
                    happiness.two_way_requests_honored += 1
                    result.stats.two_way_requests_honored += 1
                    some_honored = True
                else:
                    all_honored = False

            for friend_id in player.one_way_teammate_ids:
                has_requests = True
                happiness.teammate_requests_total += 1
                result.stats.one_way_requests_total += 1
                friend_assignment = next(
                    (a for a in result.assignments if a.player_id == friend_id),
                    None
                )
                if friend_assignment and friend_assignment.team_id == assignment.team_id:
                    happiness.teammate_requests_honored += 1
                    result.stats.one_way_requests_honored += 1
                    some_honored = True
                else:
                    all_honored = False

            # Determine happiness score
            if not has_requests:
                happiness.score = 'no-requests'
            elif all_honored:
                happiness.score = 'all'
            elif some_honored:
                happiness.score = 'some'
            else:
                happiness.score = 'none'

            result.player_happiness.append(happiness)

        # ---------------------------------------------------------------------
        # Build team summaries
        # ---------------------------------------------------------------------

        total_score = sum(team_scores.values())
        mean_score = total_score / len(teams) if teams else 0

        for team in teams:
            roster_count = len(team_rosters[team.id])
            team_score = team_scores[team.id]
            delta_percent = ((team_score - mean_score) / mean_score * 100) if mean_score > 0 else 0

            summary = TeamSummary(
                team_id=team.id,
                team_name=team.name or team.head_coach,
                coach_name=team.head_coach,
                roster_count=roster_count,
                total_score=team_score,
                mean_delta_percent=delta_percent
            )
            result.team_summaries.append(summary)

            # Check for balance warning
            if abs(delta_percent) > self.config.balance_tolerance * 100:
                result.warnings.append(
                    f"Team {summary.team_name} is {delta_percent:+.1f}% from mean "
                    f"(outside {self.config.balance_tolerance * 100}% tolerance)"
                )

        # Final stats
        result.stats.total_players = len(players)
        happiness_scores = {
            'all': 1.0,
            'some': 0.5,
            'none': 0.0,
            'no-requests': 1.0  # Neutral
        }
        if result.player_happiness:
            result.stats.average_happiness = sum(
                happiness_scores.get(h.score, 0.5)
                for h in result.player_happiness
            ) / len(result.player_happiness)

        return result

    @classmethod
    @transaction.atomic
    def apply_assignments(
        cls,
        division_id: UUID,
        result: TeamBuilderResult
    ) -> DraftState:
        """
        Apply team builder assignments to the database.

        Creates a DraftState and DraftPicks as if it were a completed draft,
        allowing the existing trade and export functionality to work.
        """
        division = Division.objects.get(id=division_id)
        teams = list(division.teams.all())

        # Delete existing draft state if any
        DraftState.objects.filter(division=division).delete()

        # Create draft state
        draft_order = [str(t.id) for t in teams]
        draft_state = DraftState.objects.create(
            division=division,
            draft_format='league-generated',
            draft_order=draft_order,
            current_round_order=draft_order,
            current_round=1,
            current_pick_in_round=1,
            is_draft_complete=True,
        )

        # Reset all players
        Player.objects.filter(division=division).update(
            is_drafted=False,
            drafted_by_team=None,
            drafted_in_round=None,
            drafted_at_pick=None,
        )

        # Reset team scores
        Team.objects.filter(division=division).update(total_score=0)

        # Apply each assignment
        for assignment in result.assignments:
            player = Player.objects.get(id=assignment.player_id)
            team = Team.objects.get(id=assignment.team_id)

            # Update player
            player.is_drafted = True
            player.drafted_by_team = team
            player.drafted_in_round = assignment.round
            player.drafted_at_pick = assignment.pick
            player.save()

            # Create draft pick record
            DraftPick.objects.create(
                draft_state=draft_state,
                round=assignment.round,
                pick=assignment.pick,
                team_id=team.id,
                player_id=player.id,
                player_name=player.name,
                player_score=player.total_score,
                pick_reason='league-generated',
            )

            # Update team score
            team.total_score += player.total_score
            team.save()

        # Update division phase
        division.phase = 'complete'
        division.save()

        return draft_state


# -----------------------------------------------------------------------------
# Registration Data Parsing
# -----------------------------------------------------------------------------

def detect_two_way_requests(players: list[TeamBuilderPlayer]) -> dict[UUID, set[UUID]]:
    """
    Detect two-way teammate requests (both players named each other).

    Returns a dict mapping player_id -> set of two-way friend IDs.
    """
    two_way_map: dict[UUID, set[UUID]] = {}

    for player in players:
        two_way_map[player.id] = set()

        for friend_id in player.resolved_teammate_ids:
            friend = next((p for p in players if p.id == friend_id), None)
            if friend and player.id in friend.resolved_teammate_ids:
                two_way_map[player.id].add(friend_id)

    return two_way_map


def resolve_coach_request(
    coach_request: str,
    teams: list[Team]
) -> Optional[UUID]:
    """
    Resolve a coach request string to a team ID.

    Tries to match by last name first, then full name.
    """
    if not coach_request:
        return None

    coach_request_lower = coach_request.strip().lower()

    for team in teams:
        # Try exact match on head coach
        if team.head_coach.lower() == coach_request_lower:
            return team.id

        # Try last name match
        coach_parts = team.head_coach.split()
        if coach_parts:
            coach_last_name = coach_parts[-1].lower()
            if coach_last_name == coach_request_lower:
                return team.id

        # Try assistant coach
        if team.assistant_coach:
            if team.assistant_coach.lower() == coach_request_lower:
                return team.id
            asst_parts = team.assistant_coach.split()
            if asst_parts and asst_parts[-1].lower() == coach_request_lower:
                return team.id

    return None
