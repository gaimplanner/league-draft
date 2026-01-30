"""
Plain Django views (replaces DRF ViewSets).
"""

from .auth import (
    health_view,
    csrf_token_view,
    register_view,
    login_view,
    logout_view,
    me_view,
    change_password_view,
    password_reset_request_view,
    password_reset_confirm_view,
    log_client_error_view,
)
from .divisions import (
    divisions_list_create,
    division_detail,
    division_reset,
)
from .teams import (
    teams_list_create,
    team_detail,
    teams_bulk_update,
    team_assign_coach_kid,
    team_remove_coach_kid,
)
from .players import (
    players_list_create,
    player_detail,
    players_bulk_create,
    players_bulk_sync,
    players_delete_by_division,
)
from .draft import (
    draft_retrieve,
    draft_start,
    draft_pick,
    draft_undo,
    draft_skip,
    draft_trade,
)
from .leagues import (
    league_members_list,
    league_member_remove,
    league_member_update_role,
    league_invitations_list_create,
    league_invitation_cancel,
    accept_invitation,
    join_link_view,
    public_join_link_view,
)
from .team_builder import (
    team_builder_run,
    team_builder_apply,
    team_builder_update_requests,
)
from .coaches import (
    coaches_list_create,
    coach_detail,
    coaches_bulk_create,
)
from .evaluation_templates import (
    evaluation_templates_list_create,
    evaluation_template_detail,
)
from .seasons import (
    seasons_list_create,
    season_detail,
)
from .coach_ratings import (
    coach_ratings_list_create,
    coach_rating_detail,
    coach_rating_submit,
    coach_ratings_progress,
)
from .tryout_scoring import (
    tryout_groups_list_create,
    tryout_group_detail,
    tryout_group_generate,
    tryout_group_add_player,
    tryout_station_scores,
    tryout_station_score_detail,
    tryout_bulk_scores,
    tryout_progress,
)

__all__ = [
    # Auth
    "health_view",
    "csrf_token_view",
    "register_view",
    "login_view",
    "logout_view",
    "me_view",
    "change_password_view",
    "password_reset_request_view",
    "password_reset_confirm_view",
    "log_client_error_view",
    # Divisions
    "divisions_list_create",
    "division_detail",
    "division_reset",
    # Teams
    "teams_list_create",
    "team_detail",
    "teams_bulk_update",
    "team_assign_coach_kid",
    "team_remove_coach_kid",
    # Players
    "players_list_create",
    "player_detail",
    "players_bulk_create",
    "players_bulk_sync",
    "players_delete_by_division",
    # Draft
    "draft_retrieve",
    "draft_start",
    "draft_pick",
    "draft_undo",
    "draft_skip",
    "draft_trade",
    # Leagues
    "league_members_list",
    "league_member_remove",
    "league_member_update_role",
    "league_invitations_list_create",
    "league_invitation_cancel",
    "accept_invitation",
    "join_link_view",
    "public_join_link_view",
    # Team Builder
    "team_builder_run",
    "team_builder_apply",
    "team_builder_update_requests",
    # Coaches
    "coaches_list_create",
    "coach_detail",
    "coaches_bulk_create",
    # Evaluation Templates
    "evaluation_templates_list_create",
    "evaluation_template_detail",
    # Seasons
    "seasons_list_create",
    "season_detail",
    # Coach Ratings
    "coach_ratings_list_create",
    "coach_rating_detail",
    "coach_rating_submit",
    "coach_ratings_progress",
    # Tryout Scoring
    "tryout_groups_list_create",
    "tryout_group_detail",
    "tryout_group_generate",
    "tryout_group_add_player",
    "tryout_station_scores",
    "tryout_station_score_detail",
    "tryout_bulk_scores",
    "tryout_progress",
]
