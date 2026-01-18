from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import models
from rest_framework import serializers

from .models import Division, Team, Player, DraftState, DraftPick, Trade, League, LeagueMembership, LeagueInvitation

User = get_user_model()


# -----------------------------------------------------------------------------
# Auth Serializers
# -----------------------------------------------------------------------------


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    league_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    league_slug = serializers.SlugField(max_length=100, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class LeagueMembershipSerializer(serializers.ModelSerializer):
    """Serializer for league membership."""

    league_id = serializers.UUIDField(source="league.id", read_only=True)
    league_name = serializers.CharField(source="league.name", read_only=True)
    league_slug = serializers.CharField(source="league.slug", read_only=True)

    class Meta:
        model = LeagueMembership
        fields = ["id", "league_id", "league_name", "league_slug", "role", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user info."""

    leagues = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "leagues",
        ]

    def get_leagues(self, obj):
        memberships = obj.memberships.select_related("league").all()
        return LeagueMembershipSerializer(memberships, many=True).data


class LeagueSerializer(serializers.ModelSerializer):
    """Serializer for League model."""

    member_count = serializers.SerializerMethodField()

    class Meta:
        model = League
        fields = ["id", "name", "slug", "created_at", "member_count"]
        read_only_fields = ["id", "created_at"]

    def get_member_count(self, obj):
        return obj.memberships.count()


# -----------------------------------------------------------------------------
# Game Data Serializers
# -----------------------------------------------------------------------------


# Default scoring weights
DEFAULT_SCORING_WEIGHTS = {
    "fielding": {"field": 15.0, "throw": 13.0},
    "hitting": {"power": 9.0, "form": 9.0, "contact": 9.0},
    "pitching": {"strength": 20.0, "form": 15.0},
    "catching": 5.0,
    "running": 5.0,
}


class PlayerSerializer(serializers.ModelSerializer):
    """Serializer for Player model."""

    division_id = serializers.UUIDField(source="division.id", read_only=True)
    coach_team_id = serializers.UUIDField(
        source="coach_team.id", read_only=True, allow_null=True
    )
    locked_to_team_id = serializers.UUIDField(
        source="locked_to_team.id", read_only=True, allow_null=True
    )
    drafted_by_team_id = serializers.UUIDField(
        source="drafted_by_team.id", read_only=True, allow_null=True
    )

    class Meta:
        model = Player
        fields = [
            "id",
            "division_id",
            "bib",
            "first_name",
            "last_name",
            "name",
            "field_score",
            "throw_score",
            "hit_power",
            "hit_form",
            "hit_contact",
            "pitching_strength",
            "pitching_form",
            "catch_score",
            "running_score",
            "fielding_subtotal",
            "hitting_subtotal",
            "pitching_subtotal",
            "subjective_total",
            "objective_total",
            "official_adjust",
            "total_score",
            "rank",
            "projected_round",
            "little_league_age",
            "birthday",
            "is_all_star",
            "is_dne",
            "is_coach_kid",
            "coach_team_id",
            "sibling",
            "sibling_id",
            "locked_to_round",
            "locked_to_team_id",
            "is_drafted",
            "drafted_by_team_id",
            "drafted_in_round",
            "drafted_at_pick",
        ]
        read_only_fields = ["id", "name"]


class PlayerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating players."""

    division_id = serializers.UUIDField(write_only=True)
    coach_team_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Player
        fields = [
            "division_id",
            "bib",
            "first_name",
            "last_name",
            "field_score",
            "throw_score",
            "hit_power",
            "hit_form",
            "hit_contact",
            "pitching_strength",
            "pitching_form",
            "catch_score",
            "running_score",
            "fielding_subtotal",
            "hitting_subtotal",
            "pitching_subtotal",
            "subjective_total",
            "objective_total",
            "official_adjust",
            "total_score",
            "rank",
            "projected_round",
            "little_league_age",
            "birthday",
            "is_all_star",
            "is_dne",
            "is_coach_kid",
            "coach_team_id",
            "sibling",
            "sibling_id",
        ]

    def create(self, validated_data):
        division_id = validated_data.pop("division_id")
        coach_team_id = validated_data.pop("coach_team_id", None)

        division = Division.objects.get(id=division_id)
        coach_team = Team.objects.get(id=coach_team_id) if coach_team_id else None

        return Player.objects.create(
            division=division, coach_team=coach_team, **validated_data
        )


class TeamSerializer(serializers.ModelSerializer):
    """Serializer for Team model."""

    division_id = serializers.UUIDField(source="division.id", read_only=True)
    roster = PlayerSerializer(many=True, read_only=True)
    coach_kids = PlayerSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = [
            "id",
            "division_id",
            "name",
            "draft_position",
            "total_score",
            "assistant_coaches",
            "age_breakdown",
            "roster",
            "coach_kids",
        ]
        read_only_fields = ["id"]


class TeamUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating teams."""

    class Meta:
        model = Team
        fields = [
            "name",
            "draft_position",
            "assistant_coaches",
            "total_score",
            "age_breakdown",
        ]


class DraftPickSerializer(serializers.ModelSerializer):
    """Serializer for DraftPick model."""

    class Meta:
        model = DraftPick
        fields = [
            "id",
            "draft_state",
            "round",
            "pick",
            "team_id",
            "player_id",
            "was_skipped",
            "timestamp",
        ]
        read_only_fields = ["id", "timestamp"]


class TradeSerializer(serializers.ModelSerializer):
    """Serializer for Trade model."""

    class Meta:
        model = Trade
        fields = [
            "id",
            "draft_state",
            "team1_id",
            "team2_id",
            "player1_id",
            "player2_id",
            "reason",
            "timestamp",
        ]
        read_only_fields = ["id", "timestamp"]


class DraftStateSerializer(serializers.ModelSerializer):
    """Serializer for DraftState model."""

    division_id = serializers.UUIDField(source="division.id", read_only=True)
    current_team_id = serializers.UUIDField(
        source="current_team.id", read_only=True, allow_null=True
    )
    picks = DraftPickSerializer(many=True, read_only=True)
    trades = TradeSerializer(many=True, read_only=True)
    mandatory_pick = serializers.SerializerMethodField()

    class Meta:
        model = DraftState
        fields = [
            "id",
            "division_id",
            "draft_format",
            "draft_order",
            "current_round_order",
            "current_round",
            "current_pick_in_round",
            "current_team_id",
            "is_draft_complete",
            "mandatory_pick",
            "picks",
            "trades",
        ]
        read_only_fields = ["id"]

    def get_mandatory_pick(self, obj):
        if not obj.mandatory_player:
            return None
        return {
            "player_id": str(obj.mandatory_player.id),
            "reason": obj.mandatory_reason,
            "sibling_name": obj.mandatory_sibling_name or None,
        }


class DivisionSummarySerializer(serializers.ModelSerializer):
    """Serializer for division list view."""

    player_count = serializers.SerializerMethodField()

    class Meta:
        model = Division
        fields = [
            "id",
            "name",
            "preset",
            "team_count",
            "player_count",
            "phase",
            "created_at",
            "completed_at",
        ]

    def get_player_count(self, obj):
        return obj.players.count()


class DivisionSerializer(serializers.ModelSerializer):
    """Serializer for Division model."""

    age_range = serializers.SerializerMethodField()
    teams = TeamSerializer(many=True, read_only=True)
    players = PlayerSerializer(many=True, read_only=True)
    draft_state = DraftStateSerializer(read_only=True)

    class Meta:
        model = Division
        fields = [
            "id",
            "name",
            "preset",
            "age_range",
            "enforce_age_limit",
            "max_per_age",
            "team_count",
            "roster_size",
            "scoring_weights",
            "scoring_mode",
            "phase",
            "created_at",
            "updated_at",
            "completed_at",
            "teams",
            "players",
            "draft_state",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_age_range(self, obj):
        return {"min": obj.age_range_min, "max": obj.age_range_max}


class DivisionCreateSerializer(serializers.Serializer):
    """Serializer for creating divisions."""

    name = serializers.CharField(max_length=100)
    preset = serializers.ChoiceField(choices=Division.PRESET_CHOICES)
    age_range = serializers.DictField(child=serializers.IntegerField())
    enforce_age_limit = serializers.BooleanField(default=True)
    max_per_age = serializers.IntegerField(default=0)
    team_count = serializers.IntegerField(min_value=2, max_value=12)
    scoring_weights = serializers.DictField(required=False)
    scoring_mode = serializers.ChoiceField(
        choices=Division.SCORING_MODE_CHOICES, default="pre-weighted"
    )

    def create(self, validated_data):
        age_range = validated_data.pop("age_range")
        scoring_weights = validated_data.pop(
            "scoring_weights", DEFAULT_SCORING_WEIGHTS
        )
        # league is passed from perform_create via validated_data
        league = validated_data.pop("league", None)

        # Clean up any empty divisions with the same name (in the same league)
        # These can occur when players get wiped or imports fail
        name = validated_data.get("name")
        if name and league:
            empty_divisions = Division.objects.filter(
                league=league,
                name__iexact=name,
            ).annotate(
                player_count=models.Count("players")
            ).filter(player_count=0)
            empty_divisions.delete()

        division = Division.objects.create(
            age_range_min=age_range["min"],
            age_range_max=age_range["max"],
            scoring_weights=scoring_weights,
            league=league,
            **validated_data,
        )

        # Create teams
        for i in range(validated_data["team_count"]):
            Team.objects.create(
                division=division,
                name="",
                draft_position=i + 1,
            )

        return division


class DivisionUpdateSerializer(serializers.Serializer):
    """Serializer for updating divisions."""

    name = serializers.CharField(max_length=100, required=False)
    preset = serializers.ChoiceField(choices=Division.PRESET_CHOICES, required=False)
    age_range = serializers.DictField(child=serializers.IntegerField(), required=False)
    enforce_age_limit = serializers.BooleanField(required=False)
    max_per_age = serializers.IntegerField(required=False)
    team_count = serializers.IntegerField(min_value=2, max_value=12, required=False)
    roster_size = serializers.IntegerField(required=False)
    scoring_weights = serializers.DictField(required=False)
    scoring_mode = serializers.ChoiceField(
        choices=Division.SCORING_MODE_CHOICES, required=False
    )
    phase = serializers.ChoiceField(choices=Division.PHASE_CHOICES, required=False)

    def update(self, instance, validated_data):
        if "age_range" in validated_data:
            age_range = validated_data.pop("age_range")
            instance.age_range_min = age_range.get("min", instance.age_range_min)
            instance.age_range_max = age_range.get("max", instance.age_range_max)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if validated_data.get("phase") == "complete":
            from django.utils import timezone

            instance.completed_at = timezone.now()

        instance.save()
        return instance


class StartDraftSerializer(serializers.Serializer):
    """Serializer for starting a draft."""

    division_id = serializers.UUIDField()
    draft_format = serializers.ChoiceField(choices=DraftState.DRAFT_FORMAT_CHOICES)
    draft_order = serializers.ListField(child=serializers.UUIDField())


class DraftPlayerSerializer(serializers.Serializer):
    """Serializer for drafting a player."""

    draft_state_id = serializers.UUIDField()
    player_id = serializers.UUIDField()
    team_id = serializers.UUIDField()


class UndoPickSerializer(serializers.Serializer):
    """Serializer for undoing a pick."""

    draft_state_id = serializers.UUIDField()


class CreateTradeSerializer(serializers.Serializer):
    """Serializer for creating a trade."""

    draft_state_id = serializers.UUIDField()
    team1_id = serializers.UUIDField()
    team2_id = serializers.UUIDField()
    player1_id = serializers.UUIDField()
    player2_id = serializers.UUIDField()
    reason = serializers.CharField()


class BulkCreatePlayersSerializer(serializers.Serializer):
    """Serializer for bulk creating players."""

    division_id = serializers.UUIDField()
    players = serializers.ListField(child=serializers.DictField())


# -----------------------------------------------------------------------------
# Password Reset Serializers
# -----------------------------------------------------------------------------


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting a password reset."""

    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming a password reset."""

    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


# -----------------------------------------------------------------------------
# Profile Serializers
# -----------------------------------------------------------------------------


class ProfileUpdateSerializer(serializers.Serializer):
    """Serializer for updating user profile."""

    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)

    def validate_email(self, value):
        user = self.context.get("user")
        if user and User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


# -----------------------------------------------------------------------------
# League Member Serializers
# -----------------------------------------------------------------------------


class LeagueMemberSerializer(serializers.ModelSerializer):
    """Serializer for league member info (user + membership)."""

    user_id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    joined_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = LeagueMembership
        fields = ["id", "user_id", "email", "first_name", "last_name", "role", "joined_at"]
        read_only_fields = ["id", "user_id", "email", "first_name", "last_name", "joined_at"]


class UpdateMemberRoleSerializer(serializers.Serializer):
    """Serializer for updating member role."""

    role = serializers.ChoiceField(choices=LeagueMembership.ROLE_CHOICES)


# -----------------------------------------------------------------------------
# League Invitation Serializers
# -----------------------------------------------------------------------------


class LeagueInvitationSerializer(serializers.ModelSerializer):
    """Serializer for league invitations."""

    invited_by_email = serializers.EmailField(source="invited_by.email", read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_pending = serializers.BooleanField(read_only=True)

    class Meta:
        model = LeagueInvitation
        fields = [
            "id",
            "email",
            "role",
            "invited_by_email",
            "is_link_invite",
            "created_at",
            "expires_at",
            "accepted_at",
            "is_expired",
            "is_pending",
        ]
        read_only_fields = ["id", "created_at", "expires_at", "accepted_at"]


class CreateInvitationSerializer(serializers.Serializer):
    """Serializer for creating an email invitation."""

    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=LeagueMembership.ROLE_CHOICES, default="member")


class AcceptInvitationSerializer(serializers.Serializer):
    """Serializer for accepting an invitation."""

    token = serializers.CharField()


# -----------------------------------------------------------------------------
# Join Link Serializers
# -----------------------------------------------------------------------------


class JoinLinkStatusSerializer(serializers.Serializer):
    """Serializer for join link status."""

    enabled = serializers.BooleanField()
    token = serializers.CharField(allow_null=True)
    url = serializers.CharField(allow_null=True)


class JoinLinkInfoSerializer(serializers.Serializer):
    """Serializer for public join link info."""

    league_name = serializers.CharField()
    league_slug = serializers.CharField()
