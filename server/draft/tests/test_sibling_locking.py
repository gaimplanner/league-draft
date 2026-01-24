"""Tests for sibling chain locking/unlocking in DraftService."""
import uuid
from django.test import TestCase
from draft.models import (
    Organization, User, OrganizationMembership, Division, Team, Player, DraftState
)
from draft.services_draft import DraftService


class SiblingLockingTestCase(TestCase):
    """Test case for sibling locking functionality."""

    def setUp(self):
        """Create test fixtures."""
        # Create organization
        self.org = Organization.objects.create(
            name="Test League",
            slug="test-league-sibling"
        )

        # Create user
        self.user = User.objects.create_user(
            email="sibling-test@example.com",
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
            name="Sibling Test Division",
            preset="majors",
            age_range_min=10,
            age_range_max=12,
            team_count=4,
            roster_size=5,
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

        self.draft_order = [team.id for team in self.teams]


class DirectSiblingLockingTests(SiblingLockingTestCase):
    """Tests for direct sibling locking (2 siblings)."""

    def setUp(self):
        super().setUp()

        # Create two sibling players
        self.sibling_a = Player.objects.create(
            division=self.division,
            bib="100",
            first_name="Alice",
            last_name="Smith",
            little_league_age=10,
            birthday="2014-01-01",
            total_score=80,
            rank=1,
            projected_round=1
        )

        self.sibling_b = Player.objects.create(
            division=self.division,
            bib="101",
            first_name="Bob",
            last_name="Smith",
            little_league_age=11,
            birthday="2013-01-01",
            total_score=60,
            rank=2,
            projected_round=2
        )

        # Link siblings
        self.sibling_a.sibling_id = self.sibling_b.id
        self.sibling_a.sibling = "Bob Smith"
        self.sibling_a.save()

        self.sibling_b.sibling_id = self.sibling_a.id
        self.sibling_b.sibling = "Alice Smith"
        self.sibling_b.save()

        # Create other players to fill draft
        self.other_players = []
        for i in range(18):  # Need enough for 4 teams x 5 roster
            player = Player.objects.create(
                division=self.division,
                bib=str(200 + i),
                first_name=f"Player{i}",
                last_name="Other",
                little_league_age=10 + (i % 3),
                birthday="2014-01-01",
                total_score=50 - i,
                rank=3 + i,
                projected_round=(i // 4) + 1
            )
            self.other_players.append(player)

    def test_drafting_sibling_locks_other_to_team(self):
        """When one sibling is drafted, the other is locked to same team."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Sibling B should now be locked to team 1
        self.sibling_b.refresh_from_db()
        self.assertEqual(self.sibling_b.locked_to_team_id, self.teams[0].id)

    def test_locked_sibling_becomes_mandatory(self):
        """Locked sibling becomes mandatory pick in their projected round."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A (projected round 1) to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Complete round 1 with other teams
        for i in range(3):
            DraftService.draft_player(
                draft_state_id=draft_state.id,
                player_id=self.other_players[i].id,
                team_id=self.teams[i + 1].id
            )

        # Round 2 - sibling B is projected round 2
        # But team 1 picks 1st, and sibling B should be mandatory
        draft_state.refresh_from_db()
        self.assertEqual(draft_state.current_round, 2)
        self.assertEqual(draft_state.mandatory_player_id, self.sibling_b.id)
        self.assertEqual(draft_state.mandatory_reason, "sibling")

    def test_undo_unlocks_sibling(self):
        """Undoing a pick unlocks the sibling chain."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Verify sibling B is locked
        self.sibling_b.refresh_from_db()
        self.assertEqual(self.sibling_b.locked_to_team_id, self.teams[0].id)

        # Undo the pick
        DraftService.undo_last_pick(draft_state.id)

        # Sibling B should be unlocked
        self.sibling_b.refresh_from_db()
        self.assertIsNone(self.sibling_b.locked_to_team_id)


class SiblingChainTests(SiblingLockingTestCase):
    """Tests for sibling chains (3+ siblings)."""

    def setUp(self):
        super().setUp()

        # Create three siblings in a chain: A -> B -> C
        self.sibling_a = Player.objects.create(
            division=self.division,
            bib="100",
            first_name="Alice",
            last_name="Johnson",
            little_league_age=10,
            birthday="2014-01-01",
            total_score=80,
            rank=1,
            projected_round=1
        )

        self.sibling_b = Player.objects.create(
            division=self.division,
            bib="101",
            first_name="Bob",
            last_name="Johnson",
            little_league_age=11,
            birthday="2013-01-01",
            total_score=70,
            rank=2,
            projected_round=2
        )

        self.sibling_c = Player.objects.create(
            division=self.division,
            bib="102",
            first_name="Charlie",
            last_name="Johnson",
            little_league_age=12,
            birthday="2012-01-01",
            total_score=60,
            rank=3,
            projected_round=3
        )

        # Link as chain: A -> B, B -> C, C -> B (circular reference back)
        self.sibling_a.sibling_id = self.sibling_b.id
        self.sibling_a.sibling = "Bob Johnson"
        self.sibling_a.save()

        self.sibling_b.sibling_id = self.sibling_c.id
        self.sibling_b.sibling = "Charlie Johnson"
        self.sibling_b.save()

        self.sibling_c.sibling_id = self.sibling_b.id
        self.sibling_c.sibling = "Bob Johnson"
        self.sibling_c.save()

        # Create other players
        self.other_players = []
        for i in range(17):
            player = Player.objects.create(
                division=self.division,
                bib=str(200 + i),
                first_name=f"Player{i}",
                last_name="Other",
                little_league_age=10,
                birthday="2014-01-01",
                total_score=40 - i,
                rank=4 + i,
                projected_round=2
            )
            self.other_players.append(player)

    def test_drafting_first_sibling_locks_entire_chain(self):
        """Drafting one sibling locks ALL siblings in the chain."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Both B and C should be locked to team 1
        self.sibling_b.refresh_from_db()
        self.sibling_c.refresh_from_db()

        self.assertEqual(self.sibling_b.locked_to_team_id, self.teams[0].id)
        self.assertEqual(self.sibling_c.locked_to_team_id, self.teams[0].id)

    def test_drafting_middle_sibling_locks_chain(self):
        """Drafting middle sibling locks all connected siblings."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling B (middle) to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_b.id,
            team_id=self.teams[0].id
        )

        # A and C should be locked to team 1
        self.sibling_a.refresh_from_db()
        self.sibling_c.refresh_from_db()

        self.assertEqual(self.sibling_a.locked_to_team_id, self.teams[0].id)
        self.assertEqual(self.sibling_c.locked_to_team_id, self.teams[0].id)

    def test_undo_unlocks_entire_chain(self):
        """Undoing a pick unlocks the entire sibling chain."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Verify chain is locked
        self.sibling_b.refresh_from_db()
        self.sibling_c.refresh_from_db()
        self.assertEqual(self.sibling_b.locked_to_team_id, self.teams[0].id)
        self.assertEqual(self.sibling_c.locked_to_team_id, self.teams[0].id)

        # Undo
        DraftService.undo_last_pick(draft_state.id)

        # Entire chain should be unlocked
        self.sibling_a.refresh_from_db()
        self.sibling_b.refresh_from_db()
        self.sibling_c.refresh_from_db()

        self.assertIsNone(self.sibling_a.locked_to_team_id)
        self.assertIsNone(self.sibling_b.locked_to_team_id)
        self.assertIsNone(self.sibling_c.locked_to_team_id)


class ReverseSiblingLinkTests(SiblingLockingTestCase):
    """Tests for reverse sibling links (one-way references)."""

    def setUp(self):
        super().setUp()

        # Create sibling A with no sibling_id
        self.sibling_a = Player.objects.create(
            division=self.division,
            bib="100",
            first_name="Alice",
            last_name="Brown",
            little_league_age=10,
            birthday="2014-01-01",
            total_score=80,
            rank=1,
            projected_round=1
        )

        # Create sibling B pointing to A (but A doesn't point to B)
        self.sibling_b = Player.objects.create(
            division=self.division,
            bib="101",
            first_name="Bob",
            last_name="Brown",
            little_league_age=11,
            birthday="2013-01-01",
            total_score=60,
            rank=2,
            projected_round=2,
            sibling_id=self.sibling_a.id,
            sibling="Alice Brown"
        )

        # Create other players
        self.other_players = []
        for i in range(18):
            player = Player.objects.create(
                division=self.division,
                bib=str(200 + i),
                first_name=f"Player{i}",
                last_name="Other",
                little_league_age=10,
                birthday="2014-01-01",
                total_score=50 - i,
                rank=3 + i,
                projected_round=2
            )
            self.other_players.append(player)

    def test_reverse_link_locks_sibling(self):
        """Drafting player locks siblings who point TO them (reverse links)."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A (who has NO sibling_id) to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Sibling B should be locked (found via reverse lookup)
        self.sibling_b.refresh_from_db()
        self.assertEqual(self.sibling_b.locked_to_team_id, self.teams[0].id)


class SiblingAndCoachKidTests(SiblingLockingTestCase):
    """Tests for interactions between siblings and coach kids."""

    def setUp(self):
        super().setUp()

        # Create two siblings, one is a coach kid
        self.coach_kid = Player.objects.create(
            division=self.division,
            bib="100",
            first_name="Coach",
            last_name="Kid",
            little_league_age=10,
            birthday="2014-01-01",
            total_score=70,
            rank=1,
            projected_round=2,
            is_coach_kid=True,
            coach_team=self.teams[0]
        )

        self.sibling_of_coach_kid = Player.objects.create(
            division=self.division,
            bib="101",
            first_name="Sibling",
            last_name="Kid",
            little_league_age=11,
            birthday="2013-01-01",
            total_score=50,
            rank=2,
            projected_round=3
        )

        # Link siblings
        self.coach_kid.sibling_id = self.sibling_of_coach_kid.id
        self.coach_kid.sibling = "Sibling Kid"
        self.coach_kid.save()

        self.sibling_of_coach_kid.sibling_id = self.coach_kid.id
        self.sibling_of_coach_kid.sibling = "Coach Kid"
        self.sibling_of_coach_kid.save()

        # Create other players
        self.other_players = []
        for i in range(18):
            player = Player.objects.create(
                division=self.division,
                bib=str(200 + i),
                first_name=f"Player{i}",
                last_name="Other",
                little_league_age=10,
                birthday="2014-01-01",
                total_score=40 - i,
                rank=3 + i,
                projected_round=1
            )
            self.other_players.append(player)

    def test_drafting_coach_kid_locks_sibling(self):
        """Drafting coach kid locks their sibling to same team."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft first round with other players
        for i in range(4):
            DraftService.draft_player(
                draft_state_id=draft_state.id,
                player_id=self.other_players[i].id,
                team_id=self.teams[i].id
            )

        # Round 2 - team 1 must draft coach kid
        draft_state.refresh_from_db()
        self.assertEqual(draft_state.mandatory_player_id, self.coach_kid.id)

        # Draft the coach kid
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.coach_kid.id,
            team_id=self.teams[0].id
        )

        # Sibling should be locked to team 1
        self.sibling_of_coach_kid.refresh_from_db()
        self.assertEqual(self.sibling_of_coach_kid.locked_to_team_id, self.teams[0].id)


class BulkUpdateAtomicityTests(SiblingLockingTestCase):
    """Tests ensuring sibling locking uses bulk_update for atomicity."""

    def setUp(self):
        super().setUp()

        # Create 5 siblings to test bulk update
        self.siblings = []
        for i in range(5):
            sibling = Player.objects.create(
                division=self.division,
                bib=str(100 + i),
                first_name=f"Sibling{i}",
                last_name="Large",
                little_league_age=10 + (i % 3),
                birthday="2014-01-01",
                total_score=80 - (i * 10),
                rank=i + 1,
                projected_round=i + 1
            )
            self.siblings.append(sibling)

        # Link as a chain: 0 -> 1 -> 2 -> 3 -> 4
        for i in range(4):
            self.siblings[i].sibling_id = self.siblings[i + 1].id
            self.siblings[i].sibling = f"Sibling{i + 1} Large"
            self.siblings[i].save()

        # Last one points back
        self.siblings[4].sibling_id = self.siblings[3].id
        self.siblings[4].sibling = "Sibling3 Large"
        self.siblings[4].save()

        # Create other players
        for i in range(15):
            Player.objects.create(
                division=self.division,
                bib=str(200 + i),
                first_name=f"Player{i}",
                last_name="Other",
                little_league_age=10,
                birthday="2014-01-01",
                total_score=30 - i,
                rank=6 + i,
                projected_round=2
            )

    def test_large_chain_locked_atomically(self):
        """Large sibling chain is locked in a single bulk operation."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft first sibling
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.siblings[0].id,
            team_id=self.teams[0].id
        )

        # All other siblings should be locked
        for i in range(1, 5):
            self.siblings[i].refresh_from_db()
            self.assertEqual(
                self.siblings[i].locked_to_team_id,
                self.teams[0].id,
                f"Sibling {i} should be locked to team 0"
            )

    def test_large_chain_unlocked_atomically(self):
        """Large sibling chain is unlocked in a single bulk operation."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft first sibling
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.siblings[0].id,
            team_id=self.teams[0].id
        )

        # Undo
        DraftService.undo_last_pick(draft_state.id)

        # All siblings should be unlocked
        for i in range(5):
            self.siblings[i].refresh_from_db()
            self.assertIsNone(
                self.siblings[i].locked_to_team_id,
                f"Sibling {i} should be unlocked"
            )


class DraftedSiblingNotLockedTests(SiblingLockingTestCase):
    """Tests ensuring already drafted siblings are not re-locked."""

    def setUp(self):
        super().setUp()

        # Create two siblings
        self.sibling_a = Player.objects.create(
            division=self.division,
            bib="100",
            first_name="Alice",
            last_name="Test",
            little_league_age=10,
            birthday="2014-01-01",
            total_score=80,
            rank=1,
            projected_round=1
        )

        self.sibling_b = Player.objects.create(
            division=self.division,
            bib="101",
            first_name="Bob",
            last_name="Test",
            little_league_age=11,
            birthday="2013-01-01",
            total_score=60,
            rank=2,
            projected_round=1
        )

        # Link siblings
        self.sibling_a.sibling_id = self.sibling_b.id
        self.sibling_a.sibling = "Bob Test"
        self.sibling_a.save()

        self.sibling_b.sibling_id = self.sibling_a.id
        self.sibling_b.sibling = "Alice Test"
        self.sibling_b.save()

        # Create other players
        for i in range(18):
            Player.objects.create(
                division=self.division,
                bib=str(200 + i),
                first_name=f"Player{i}",
                last_name="Other",
                little_league_age=10,
                birthday="2014-01-01",
                total_score=50 - i,
                rank=3 + i,
                projected_round=2
            )

    def test_undo_does_not_unlock_drafted_sibling(self):
        """Undoing doesn't unlock siblings that were already drafted."""
        draft_state = DraftService.start_draft(
            division_id=self.division.id,
            draft_format="straight",
            draft_order=self.draft_order
        )

        # Draft sibling A to team 1
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_a.id,
            team_id=self.teams[0].id
        )

        # Sibling B is now locked
        self.sibling_b.refresh_from_db()
        self.assertEqual(self.sibling_b.locked_to_team_id, self.teams[0].id)

        # Draft sibling B to team 1 (mandatory)
        # Need to complete other team picks first
        other_players = list(Player.objects.filter(
            division=self.division,
            is_drafted=False
        ).exclude(id__in=[self.sibling_a.id, self.sibling_b.id])[:3])

        for i, player in enumerate(other_players):
            DraftService.draft_player(
                draft_state_id=draft_state.id,
                player_id=player.id,
                team_id=self.teams[i + 1].id
            )

        # Now team 1 should have mandatory sibling B
        draft_state.refresh_from_db()

        # Draft sibling B
        DraftService.draft_player(
            draft_state_id=draft_state.id,
            player_id=self.sibling_b.id,
            team_id=self.teams[0].id
        )

        # Both siblings are now drafted
        self.sibling_a.refresh_from_db()
        self.sibling_b.refresh_from_db()
        self.assertTrue(self.sibling_a.is_drafted)
        self.assertTrue(self.sibling_b.is_drafted)

        # Undo sibling B
        DraftService.undo_last_pick(draft_state.id)

        # Sibling B should be undrafted but sibling A stays drafted
        self.sibling_a.refresh_from_db()
        self.sibling_b.refresh_from_db()
        self.assertTrue(self.sibling_a.is_drafted)
        self.assertFalse(self.sibling_b.is_drafted)
