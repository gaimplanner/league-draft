"""Tests for DraftService operations."""
import uuid
from django.test import TestCase, TransactionTestCase
from django.db import transaction
from draft.models import (
    Organization, User, OrganizationMembership, Division, Team, Player, DraftState, DraftPick
)
from draft.services_draft import DraftService


class DraftServiceTestCase(TestCase):
    """Base test case with common setup for draft service tests."""

    def setUp(self):
        """Create test fixtures."""
        # Create organization
        self.org = Organization.objects.create(
            name="Test League",
            slug="test-league"
        )

        # Create user
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )

        # Create membership
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.org,
            role="admin"
        )

        # Create division
        self.division = Division.objects.create(
            organization=self.org,
            name="Test Division",
            preset="majors",
            age_range_min=10,
            age_range_max=12,
            team_count=4,
            roster_size=3,  # Small roster for testing
            phase="config"
        )

        # Create teams
        self.teams = []
        for i in range(4):
            team = Team.objects.create(
                division=self.division,
                name=f"Team {i + 1}",
                draft_position=i + 1,
                head_coach=f"Coach {i + 1}"
            )
            self.teams.append(team)

        # Create players (12 players for 4 teams x 3 roster)
        self.players = []
        for i in range(12):
            player = Player.objects.create(
                division=self.division,
                bib=str(100 + i),
                first_name=f"Player{i}",
                last_name=f"Test{i}",
                little_league_age=10 + (i % 3),
                birthday="2014-01-01",
                total_score=100 - (i * 5),
                rank=i + 1,
                projected_round=(i // 4) + 1
            )
            self.players.append(player)

        # Draft order
        self.draft_order = [team.id for team in self.teams]


class StartDraftTests(DraftServiceTestCase):
    """Tests for DraftService.start_draft."""

    def test_start_draft_creates_draft_state(self):
        """Starting a draft creates a DraftState."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        self.assertIsNotNone(draft_state)
        self.assertEqual(draft_state.division_id, self.division.id)
        self.assertEqual(draft_state.draft_format, "straight")
        self.assertEqual(draft_state.current_round, 1)
        self.assertEqual(draft_state.current_pick_in_round, 1)
        self.assertFalse(draft_state.is_draft_complete)

    def test_start_draft_sets_current_team(self):
        """Starting a draft sets the first team as current team."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        self.assertEqual(draft_state.current_team_id, self.teams[0].id)

    def test_start_draft_updates_division_phase(self):
        """Starting a draft changes division phase to 'draft'."""
        DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        self.division.refresh_from_db()
        self.assertEqual(self.division.phase, "draft")

    def test_start_draft_prevents_restart_without_force(self):
        """Cannot restart draft with picks unless force_restart is True."""
        # Start draft
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Make a pick
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        # Try to restart without force
        with self.assertRaises(ValueError) as ctx:
            DraftService.start_draft(
                division_id=self.division.id,
                draft_format="straight",
                draft_order=self.draft_order
            )

        self.assertIn("Draft already in progress", str(ctx.exception))

    def test_start_draft_allows_restart_with_force(self):
        """Can restart draft with picks when force_restart is True."""
        # Start draft
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Make a pick
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        # Restart with force
        new_draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="snake",
            draft_order=self.draft_order,
            force_restart=True
        )

        self.assertNotEqual(draft_state.id, new_draft_state.id)
        self.assertEqual(new_draft_state.draft_format, "snake")
        self.assertEqual(new_draft_state.picks.count(), 0)


class DraftPlayerTests(DraftServiceTestCase):
    """Tests for DraftService.draft_player."""

    def setUp(self):
        super().setUp()
        self.draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

    def test_draft_player_creates_pick(self):
        """Drafting a player creates a DraftPick record."""
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        self.assertEqual(self.draft_state.picks.count(), 1)
        pick = self.draft_state.picks.first()
        self.assertEqual(pick.player_id, self.players[0].id)
        self.assertEqual(pick.team_id, self.teams[0].id)
        self.assertEqual(pick.round, 1)
        self.assertEqual(pick.pick, 1)

    def test_draft_player_marks_player_drafted(self):
        """Drafting updates the player's draft status."""
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        self.players[0].refresh_from_db()
        self.assertTrue(self.players[0].is_drafted)
        self.assertEqual(self.players[0].drafted_by_team_id, self.teams[0].id)
        self.assertEqual(self.players[0].drafted_in_round, 1)
        self.assertEqual(self.players[0].drafted_at_pick, 1)

    def test_draft_player_advances_turn(self):
        """Drafting advances to next team's turn."""
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_team_id, self.teams[1].id)
        self.assertEqual(self.draft_state.current_pick_in_round, 2)

    def test_draft_player_updates_team_score(self):
        """Drafting updates the team's total score."""
        initial_score = self.teams[0].total_score
        player_score = self.players[0].total_score

        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        self.teams[0].refresh_from_db()
        self.assertEqual(self.teams[0].total_score, player_score)

    def test_draft_player_wrong_team_error(self):
        """Cannot draft if it's not your team's turn."""
        with self.assertRaises(ValueError) as ctx:
            DraftService.draft_player(
                draft_state_id=self.draft_state.id,
                player_id=self.players[0].id,
                team_id=self.teams[1].id  # Wrong team
            )

        self.assertIn("Not this team's turn", str(ctx.exception))

    def test_draft_player_already_drafted_error(self):
        """Cannot draft a player who is already drafted."""
        # Draft player first
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        # Try to draft same player again
        with self.assertRaises(ValueError) as ctx:
            DraftService.draft_player(
                draft_state_id=self.draft_state.id,
                player_id=self.players[0].id,
                team_id=self.teams[1].id
            )

        self.assertIn("already drafted", str(ctx.exception))

    def test_draft_advances_round(self):
        """Drafting last pick of round advances to next round."""
        # Draft all 4 teams in round 1
        for i in range(4):
            DraftService.draft_player(
                draft_state_id=self.draft_state.id,
                player_id=self.players[i].id,
                team_id=self.teams[i].id
            )

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_round, 2)
        self.assertEqual(self.draft_state.current_pick_in_round, 1)

    def test_draft_completes_when_all_picks_made(self):
        """Draft completes when all roster spots are filled."""
        # Draft all 12 players (4 teams x 3 roster)
        for i in range(12):
            team_idx = i % 4
            DraftService.draft_player(
                draft_state_id=self.draft_state.id,
                player_id=self.players[i].id,
                team_id=self.teams[team_idx].id
            )

        self.draft_state.refresh_from_db()
        self.assertTrue(self.draft_state.is_draft_complete)

        self.division.refresh_from_db()
        self.assertEqual(self.division.phase, "complete")


class SnakeDraftTests(DraftServiceTestCase):
    """Tests for snake draft format."""

    def test_snake_reverses_order_on_even_rounds(self):
        """Snake draft reverses team order on even rounds."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="snake",
            draft_order=self.draft_order
        )

        # Draft round 1 in normal order
        for i in range(4):
            DraftService.draft_player(
                draft_state_id=draft_state.id,
                player_id=self.players[i].id,
                team_id=self.teams[i].id
            )

        # Round 2 should start with team 4 (reversed)
        draft_state.refresh_from_db()
        self.assertEqual(draft_state.current_round, 2)
        self.assertEqual(draft_state.current_team_id, self.teams[3].id)

        # Draft round 2 in reversed order
        for i in range(4):
            team_idx = 3 - i  # 3, 2, 1, 0
            DraftService.draft_player(
                draft_state_id=draft_state.id,
                player_id=self.players[4 + i].id,
                team_id=self.teams[team_idx].id
            )

        # Round 3 should start with team 1 (normal again)
        draft_state.refresh_from_db()
        self.assertEqual(draft_state.current_round, 3)
        self.assertEqual(draft_state.current_team_id, self.teams[0].id)


class UndoPickTests(DraftServiceTestCase):
    """Tests for DraftService.undo_last_pick."""

    def setUp(self):
        super().setUp()
        self.draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

    def test_undo_removes_pick(self):
        """Undoing removes the DraftPick record."""
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        self.assertEqual(self.draft_state.picks.count(), 1)

        DraftService.undo_last_pick(self.draft_state.id)

        self.assertEqual(self.draft_state.picks.count(), 0)

    def test_undo_resets_player_status(self):
        """Undoing resets the player's draft status."""
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        DraftService.undo_last_pick(self.draft_state.id)

        self.players[0].refresh_from_db()
        self.assertFalse(self.players[0].is_drafted)
        self.assertIsNone(self.players[0].drafted_by_team_id)
        self.assertIsNone(self.players[0].drafted_in_round)
        self.assertIsNone(self.players[0].drafted_at_pick)

    def test_undo_reverts_turn(self):
        """Undoing reverts to the previous team's turn."""
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_team_id, self.teams[1].id)

        DraftService.undo_last_pick(self.draft_state.id)

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_team_id, self.teams[0].id)

    def test_undo_reverts_round(self):
        """Undoing first pick of round reverts to previous round."""
        # Draft round 1
        for i in range(4):
            DraftService.draft_player(
                draft_state_id=self.draft_state.id,
                player_id=self.players[i].id,
                team_id=self.teams[i].id
            )

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_round, 2)

        # Draft first pick of round 2
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[4].id,
            team_id=self.teams[0].id
        )

        # Undo
        DraftService.undo_last_pick(self.draft_state.id)

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_round, 2)
        self.assertEqual(self.draft_state.current_pick_in_round, 1)

    def test_undo_with_no_picks_raises_error(self):
        """Undoing with no picks raises error."""
        with self.assertRaises(ValueError) as ctx:
            DraftService.undo_last_pick(self.draft_state.id)

        self.assertIn("No pick to undo", str(ctx.exception))


class SkipPickTests(DraftServiceTestCase):
    """Tests for DraftService.skip_pick."""

    def setUp(self):
        super().setUp()
        # Skip requires: available_players < remaining_spots
        # We have 12 players for 12 spots (4 teams x 3 roster)
        # To allow skipping, we need fewer players than spots.
        # Delete 4 players to have 8 players for 12 spots (can skip 4 times)
        ids_to_delete = list(
            Player.objects.filter(division=self.division)
            .order_by('-rank')
            .values_list('id', flat=True)[:4]
        )
        Player.objects.filter(id__in=ids_to_delete).delete()

        self.draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

    def test_skip_creates_skipped_pick_record(self):
        """Skipping creates a pick record with was_skipped=True."""
        # With 12 roster spots and 8 players, we can skip 4 picks
        DraftService.skip_pick(
            draft_state_id=self.draft_state.id,
            team_id=self.teams[0].id
        )

        pick = self.draft_state.picks.first()
        self.assertTrue(pick.was_skipped)
        self.assertIsNone(pick.player_id)

    def test_skip_advances_turn(self):
        """Skipping advances to next team's turn."""
        DraftService.skip_pick(
            draft_state_id=self.draft_state.id,
            team_id=self.teams[0].id
        )

        self.draft_state.refresh_from_db()
        self.assertEqual(self.draft_state.current_team_id, self.teams[1].id)

    def test_skip_wrong_team_error(self):
        """Cannot skip if it's not your team's turn."""
        with self.assertRaises(ValueError) as ctx:
            DraftService.skip_pick(
                draft_state_id=self.draft_state.id,
                team_id=self.teams[1].id
            )

        self.assertIn("Not this team's turn", str(ctx.exception))

    def test_skip_not_allowed_when_all_must_be_drafted(self):
        """Cannot skip when all remaining players must be drafted."""
        # Create a fresh division with exactly matching players and spots
        division = Division.objects.create(
            organization=self.org,
            name="No Skip Division",
            preset="majors",
            age_range_min=10,
            age_range_max=12,
            team_count=2,
            roster_size=2,  # 2 teams x 2 = 4 spots
            phase="config"
        )

        teams = []
        for i in range(2):
            team = Team.objects.create(
                division=division,
                name=f"NoSkip Team {i + 1}",
                draft_position=i + 1,
            )
            teams.append(team)

        # Create exactly 4 players for 4 spots
        for i in range(4):
            Player.objects.create(
                division=division,
                bib=str(300 + i),
                first_name=f"NoSkip{i}",
                last_name="Player",
                little_league_age=10,
                birthday="2014-01-01",
                total_score=50,
                rank=i + 1,
                projected_round=1
            )

        draft_order = [t.id for t in teams]
        draft_state = DraftService.start_draft(
            division_id=division.id,
            draft_format="straight",
            draft_order=draft_order
        )

        with self.assertRaises(ValueError) as ctx:
            DraftService.skip_pick(
                draft_state_id=draft_state.id,
                team_id=teams[0].id
            )

        self.assertIn("all remaining players must be drafted", str(ctx.exception))


class TradeTests(DraftServiceTestCase):
    """Tests for DraftService.create_trade."""

    def setUp(self):
        super().setUp()
        # Start draft and draft some players
        self.draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft 2 players: one for team 1, one for team 2
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[0].id,
            team_id=self.teams[0].id
        )
        DraftService.draft_player(
            draft_state_id=self.draft_state.id,
            player_id=self.players[1].id,
            team_id=self.teams[1].id
        )

    def test_trade_swaps_players(self):
        """Trade swaps player team assignments."""
        self.players[0].refresh_from_db()
        self.players[1].refresh_from_db()
        self.assertEqual(self.players[0].drafted_by_team_id, self.teams[0].id)
        self.assertEqual(self.players[1].drafted_by_team_id, self.teams[1].id)

        DraftService.create_trade(
            draft_state_id=self.draft_state.id,
            team1_id=self.teams[0].id,
            team2_id=self.teams[1].id,
            player1_id=self.players[0].id,
            player2_id=self.players[1].id,
            reason="Balance trade"
        )

        self.players[0].refresh_from_db()
        self.players[1].refresh_from_db()
        self.assertEqual(self.players[0].drafted_by_team_id, self.teams[1].id)
        self.assertEqual(self.players[1].drafted_by_team_id, self.teams[0].id)

    def test_trade_creates_record(self):
        """Trade creates a Trade record."""
        DraftService.create_trade(
            draft_state_id=self.draft_state.id,
            team1_id=self.teams[0].id,
            team2_id=self.teams[1].id,
            player1_id=self.players[0].id,
            player2_id=self.players[1].id,
            reason="Balance trade"
        )

        self.assertEqual(self.draft_state.trades.count(), 1)

    def test_trade_wrong_team_error(self):
        """Trade fails if player doesn't belong to specified team."""
        with self.assertRaises(ValueError) as ctx:
            DraftService.create_trade(
                draft_state_id=self.draft_state.id,
                team1_id=self.teams[1].id,  # Wrong - player 0 is on team 0
                team2_id=self.teams[0].id,
                player1_id=self.players[0].id,
                player2_id=self.players[1].id,
                reason="Bad trade"
            )

        self.assertIn("does not belong to team", str(ctx.exception))


class MandatoryPickTests(DraftServiceTestCase):
    """Tests for mandatory pick detection (coach kids)."""

    def test_coach_kid_mandatory_in_projected_round(self):
        """Coach kid becomes mandatory pick in their projected round."""
        # Set up a coach kid
        coach_kid = self.players[4]  # projected_round = 2
        coach_kid.is_coach_kid = True
        coach_kid.coach_team = self.teams[0]
        coach_kid.save()

        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft round 1 - no mandatory pick
        for i in range(4):
            if self.players[i].id != coach_kid.id:
                draft_state.refresh_from_db()
                self.assertIsNone(draft_state.mandatory_player_id)
                DraftService.draft_player(
                    draft_state_id=draft_state.id,
                    player_id=self.players[i].id,
                    team_id=self.teams[i].id
                )
            else:
                # Draft different player for team 0
                DraftService.draft_player(
                    draft_state_id=draft_state.id,
                    player_id=self.players[0].id,
                    team_id=self.teams[i].id
                )

        # Round 2 - team 0 should have mandatory pick
        draft_state.refresh_from_db()
        self.assertEqual(draft_state.current_round, 2)
        self.assertEqual(draft_state.mandatory_player_id, coach_kid.id)
        self.assertEqual(draft_state.mandatory_reason, "coach-kid")

    def test_must_draft_mandatory_player(self):
        """Cannot draft different player when mandatory pick exists."""
        # Set up a coach kid in round 1
        coach_kid = self.players[0]
        coach_kid.is_coach_kid = True
        coach_kid.coach_team = self.teams[0]
        coach_kid.projected_round = 1
        coach_kid.save()

        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Should have mandatory pick set
        draft_state.refresh_from_db()
        self.assertEqual(draft_state.mandatory_player_id, coach_kid.id)

        # Try to draft different player
        with self.assertRaises(ValueError) as ctx:
            DraftService.draft_player(
                draft_state_id=draft_state.id,
                player_id=self.players[1].id,  # Not the coach kid
                team_id=self.teams[0].id
            )

        self.assertIn("Must draft mandatory player", str(ctx.exception))

    def test_can_draft_mandatory_player(self):
        """Can draft the mandatory player when required."""
        # Set up a coach kid in round 1
        coach_kid = self.players[0]
        coach_kid.is_coach_kid = True
        coach_kid.coach_team = self.teams[0]
        coach_kid.projected_round = 1
        coach_kid.save()

        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Should be able to draft the coach kid
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=coach_kid.id,
            team_id=self.teams[0].id
        )

        coach_kid.refresh_from_db()
        self.assertTrue(coach_kid.is_drafted)
        self.assertEqual(coach_kid.drafted_by_team_id, self.teams[0].id)
