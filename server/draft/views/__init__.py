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
]
