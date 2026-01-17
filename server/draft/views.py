from django.contrib.auth import authenticate, login, logout, get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Division, Team, Player, DraftState, DraftPick, Trade, League, LeagueMembership
from .serializers import (
    DivisionSerializer,
    DivisionSummarySerializer,
    DivisionCreateSerializer,
    DivisionUpdateSerializer,
    TeamSerializer,
    TeamUpdateSerializer,
    PlayerSerializer,
    PlayerCreateSerializer,
    DraftStateSerializer,
    StartDraftSerializer,
    DraftPlayerSerializer,
    UndoPickSerializer,
    CreateTradeSerializer,
    BulkCreatePlayersSerializer,
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
)
from .services import DraftService

User = get_user_model()


class HealthView(APIView):
    """Health check endpoint."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "timestamp": timezone.now().isoformat()})


# -----------------------------------------------------------------------------
# Auth Views
# -----------------------------------------------------------------------------


class RegisterView(APIView):
    """User registration endpoint."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create league if league_name provided
        league = None
        if data.get("league_name"):
            league_slug = data.get("league_slug") or slugify(data["league_name"])
            if League.objects.filter(slug=league_slug).exists():
                return Response(
                    {"error": "A league with this slug already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            league = League.objects.create(name=data["league_name"], slug=league_slug)

        # Create user
        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
        )

        # Create league membership if league was created
        if league:
            LeagueMembership.objects.create(
                user=user,
                league=league,
                role="admin",  # Creator is admin of the league
            )

        # Auto-login after registration
        login(request, user)

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """User login endpoint."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )

        if user is None:
            return Response(
                {"error": "Invalid email or password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """User logout endpoint."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """Current user info endpoint."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# -----------------------------------------------------------------------------
# Data ViewSets
# -----------------------------------------------------------------------------


class DivisionViewSet(viewsets.ModelViewSet):
    """ViewSet for Division CRUD operations."""

    queryset = Division.objects.all()

    def get_queryset(self):
        """Filter divisions by tenant (league)."""
        # Master admin can see all divisions
        if hasattr(self.request, "user") and self.request.user.is_authenticated:
            if self.request.user.role == "master_admin":
                return Division.objects.all()
        # Regular users see only their league's divisions
        if hasattr(self.request, "league") and self.request.league:
            return Division.objects.for_league(self.request.league)
        # Unauthenticated or no league - return all for now (backward compatibility)
        return Division.objects.all()

    def perform_create(self, serializer):
        """Set league when creating a division."""
        league = getattr(self.request, "league", None)
        serializer.save(league=league)

    def get_serializer_class(self):
        if self.action == "list":
            return DivisionSummarySerializer
        if self.action == "create":
            return DivisionCreateSerializer
        if self.action in ["update", "partial_update"]:
            return DivisionUpdateSerializer
        return DivisionSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        include = request.query_params.get("include")

        if include == "all":
            serializer = DivisionSerializer(instance)
        else:
            serializer = DivisionSummarySerializer(instance)

        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        division = serializer.instance
        return Response(
            DivisionSerializer(division).data, status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        division = serializer.save()
        return Response(DivisionSerializer(division).data)

    @action(detail=True, methods=["post"])
    def reset(self, request, pk=None):
        """Reset a division's draft state."""
        division = self.get_object()

        # Delete draft state if exists
        if hasattr(division, "draft_state"):
            division.draft_state.delete()

        # Reset all players
        division.players.update(
            is_drafted=False,
            drafted_by_team=None,
            drafted_in_round=None,
            drafted_at_pick=None,
            locked_to_round=None,
            locked_to_team=None,
        )

        # Reset all teams
        division.teams.update(total_score=0, age_breakdown={})

        # Update phase
        division.phase = "config"
        division.completed_at = None
        division.save()

        return Response(DivisionSerializer(division).data)


class TeamViewSet(viewsets.ModelViewSet):
    """ViewSet for Team operations."""

    queryset = Team.objects.all()
    serializer_class = TeamSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        division_id = self.request.query_params.get("division_id")
        if division_id:
            queryset = queryset.filter(division_id=division_id)
        return queryset

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return TeamUpdateSerializer
        return TeamSerializer

    @action(detail=False, methods=["put"])
    def bulk(self, request):
        """Bulk update teams."""
        division_id = request.data.get("division_id")
        teams_data = request.data.get("teams", [])

        updated_teams = []
        for team_data in teams_data:
            team_id = team_data.pop("id")
            team = Team.objects.get(id=team_id, division_id=division_id)
            serializer = TeamUpdateSerializer(team, data=team_data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            updated_teams.append(team)

        return Response(TeamSerializer(updated_teams, many=True).data)

    @action(detail=True, methods=["post"], url_path="coach-kids")
    def assign_coach_kid(self, request, pk=None):
        """Assign a player as coach's kid."""
        team = self.get_object()
        player_id = request.data.get("player_id")

        player = Player.objects.get(id=player_id)
        player.is_coach_kid = True
        player.coach_team = team
        player.save()

        return Response(TeamSerializer(team).data)

    @action(
        detail=True, methods=["delete"], url_path="coach-kids/(?P<player_id>[^/.]+)"
    )
    def remove_coach_kid(self, request, pk=None, player_id=None):
        """Remove coach's kid assignment."""
        player = Player.objects.get(id=player_id)
        player.is_coach_kid = False
        player.coach_team = None
        player.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class PlayerViewSet(viewsets.ModelViewSet):
    """ViewSet for Player operations."""

    queryset = Player.objects.all()

    def get_serializer_class(self):
        if self.action == "create":
            return PlayerCreateSerializer
        return PlayerSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        division_id = self.request.query_params.get("division_id")
        if division_id:
            queryset = queryset.filter(division_id=division_id)
        return queryset

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """Bulk create players."""
        serializer = BulkCreatePlayersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        division_id = serializer.validated_data["division_id"]
        players_data = serializer.validated_data["players"]

        division = Division.objects.get(id=division_id)
        created_players = []

        import uuid as uuid_module

        for player_data in players_data:
            coach_team_id = player_data.pop("coach_team_id", None)
            coach_team = None
            if coach_team_id:
                try:
                    coach_team = Team.objects.get(id=coach_team_id, division=division)
                except (Team.DoesNotExist, ValueError):
                    # Invalid UUID or team not found - skip coach assignment
                    pass

            # Sanitize UUID fields - clear invalid values
            for uuid_field in ["sibling_id", "locked_to_team_id", "drafted_by_team_id"]:
                if uuid_field in player_data and player_data[uuid_field]:
                    try:
                        uuid_module.UUID(str(player_data[uuid_field]))
                    except (ValueError, AttributeError):
                        # Invalid UUID - clear the field
                        player_data[uuid_field] = None

            player = Player.objects.create(
                division=division, coach_team=coach_team, **player_data
            )
            created_players.append(player)

        # Update roster size
        total_players = division.players.count()
        division.roster_size = (
            total_players // division.team_count
            if division.team_count > 0
            else 0
        )
        division.save()

        return Response(
            PlayerSerializer(created_players, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["delete"])
    def delete_by_division(self, request):
        """Delete all players in a division."""
        division_id = request.query_params.get("division_id")
        if not division_id:
            return Response(
                {"error": "division_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        count, _ = Player.objects.filter(division_id=division_id).delete()
        return Response({"deleted": count})


class DraftViewSet(viewsets.ViewSet):
    """ViewSet for draft operations."""

    def retrieve(self, request, pk=None):
        """Get draft state for a division."""
        try:
            draft_state = DraftState.objects.get(division_id=pk)
            return Response(DraftStateSerializer(draft_state).data)
        except DraftState.DoesNotExist:
            return Response(
                {"error": "Draft not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["post"])
    def start(self, request):
        """Start a draft."""
        serializer = StartDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            draft_state = DraftService.start_draft(
                division_id=serializer.validated_data["division_id"],
                draft_format=serializer.validated_data["draft_format"],
                draft_order=serializer.validated_data["draft_order"],
            )
            return Response(
                self._get_full_draft_response(draft_state),
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def pick(self, request):
        """Make a draft pick."""
        serializer = DraftPlayerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            draft_state = DraftService.draft_player(
                draft_state_id=serializer.validated_data["draft_state_id"],
                player_id=serializer.validated_data["player_id"],
                team_id=serializer.validated_data["team_id"],
            )
            return Response(self._get_full_draft_response(draft_state))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def undo(self, request):
        """Undo last pick."""
        serializer = UndoPickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            draft_state = DraftService.undo_last_pick(
                draft_state_id=serializer.validated_data["draft_state_id"]
            )
            return Response(self._get_full_draft_response(draft_state))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def trade(self, request):
        """Create a trade."""
        serializer = CreateTradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            draft_state = DraftService.create_trade(
                draft_state_id=serializer.validated_data["draft_state_id"],
                team1_id=serializer.validated_data["team1_id"],
                team2_id=serializer.validated_data["team2_id"],
                player1_id=serializer.validated_data["player1_id"],
                player2_id=serializer.validated_data["player2_id"],
                reason=serializer.validated_data["reason"],
            )
            return Response(self._get_full_draft_response(draft_state))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _get_full_draft_response(self, draft_state: DraftState) -> dict:
        """Get full draft response with players and teams."""
        division = draft_state.division
        return {
            "draft_state": DraftStateSerializer(draft_state).data,
            "players": PlayerSerializer(division.players.all(), many=True).data,
            "teams": TeamSerializer(division.teams.all(), many=True).data,
        }
