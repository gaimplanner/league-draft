import secrets

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.text import slugify
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from datetime import timedelta

from .throttling import AuthRateThrottle, PasswordResetRateThrottle

from .models import Division, Team, Player, DraftState, DraftPick, Trade, League, LeagueMembership, LeagueInvitation
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
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
    LeagueMemberSerializer,
    UpdateMemberRoleSerializer,
    LeagueInvitationSerializer,
    CreateInvitationSerializer,
    AcceptInvitationSerializer,
    JoinLinkStatusSerializer,
    JoinLinkInfoSerializer,
)
from .services import DraftService

User = get_user_model()


class HealthView(APIView):
    """Health check endpoint."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]  # Security: Rate limit public endpoint

    def get(self, request):
        return Response({"status": "ok", "timestamp": timezone.now().isoformat()})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFTokenView(APIView):
    """
    Endpoint to get a CSRF token cookie.
    Frontend should call this on app initialization to ensure the CSRF cookie is set.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set"})


# -----------------------------------------------------------------------------
# Auth Views
# -----------------------------------------------------------------------------


@method_decorator(ensure_csrf_cookie, name="dispatch")
class RegisterView(APIView):
    """User registration endpoint."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

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


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(APIView):
    """User login endpoint."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

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

    def patch(self, request):
        """Update current user profile."""
        serializer = ProfileUpdateSerializer(
            data=request.data,
            context={"user": request.user},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        if "first_name" in serializer.validated_data:
            user.first_name = serializer.validated_data["first_name"]
        if "last_name" in serializer.validated_data:
            user.last_name = serializer.validated_data["last_name"]
        if "email" in serializer.validated_data:
            user.email = serializer.validated_data["email"]
        user.save()

        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    """Change password endpoint."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"error": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()

        # Keep user logged in after password change
        login(request, user)

        return Response({"message": "Password changed successfully."})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class PasswordResetRequestView(APIView):
    """Request a password reset email."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].lower()

        # Always return success to prevent email enumeration
        try:
            user = User.objects.get(email__iexact=email)

            # Generate token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            # Build reset URL
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

            # Send email
            subject = "Password Reset Request - Little League Draft"
            message = f"""
Hello {user.first_name or user.email},

You requested a password reset for your Little League Draft account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you did not request this reset, please ignore this email.

Thanks,
Little League Draft Team
"""
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except User.DoesNotExist:
            # Don't reveal that the user doesn't exist
            pass

        return Response(
            {"message": "If an account exists with this email, a reset link has been sent."}
        )


@method_decorator(ensure_csrf_cookie, name="dispatch")
class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""

    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": "Invalid reset link"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify token
        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response(
                {"error": "Invalid or expired reset link"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Set new password
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        return Response({"message": "Password has been reset successfully."})


# -----------------------------------------------------------------------------
# Data ViewSets
# -----------------------------------------------------------------------------


class DivisionViewSet(viewsets.ModelViewSet):
    """ViewSet for Division CRUD operations."""

    permission_classes = [IsAuthenticated]
    queryset = Division.objects.all()

    def get_queryset(self):
        """Filter divisions by tenant (league)."""
        # Master admin can see all divisions
        if self.request.user.role == "master_admin":
            return Division.objects.all()
        # Regular users see only their league's divisions
        if hasattr(self.request, "league") and self.request.league:
            return Division.objects.for_league(self.request.league)
        # No league context - return empty queryset (user has no league memberships)
        return Division.objects.none()

    def perform_create(self, serializer):
        """Set league when creating a division."""
        league = getattr(self.request, "league", None)
        if not league:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must belong to a league to create divisions")
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

        # Security: Check if phase is being updated - require admin role
        if "phase" in request.data:
            if request.user.role != "master_admin" and not request.user.is_league_admin(instance.league):
                return Response(
                    {"error": "Only league admins can change division phase"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        division = serializer.save()
        return Response(DivisionSerializer(division).data)

    @action(detail=True, methods=["post"])
    def reset(self, request, pk=None):
        """Reset a division's draft state - admin only."""
        division = self.get_object()

        # Verify user is admin of the league
        if request.user.role != "master_admin" and not request.user.is_league_admin(division.league):
            return Response(
                {"error": "Only league admins can reset drafts"},
                status=status.HTTP_403_FORBIDDEN,
            )

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

    permission_classes = [IsAuthenticated]
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

    permission_classes = [IsAuthenticated]
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

        # Track old_id -> new_id mapping for sibling references
        # and store sibling_id values to fix after all players are created
        old_to_new_id = {}
        sibling_refs = {}  # new_player_id -> old_sibling_id

        for player_data in players_data:
            # Extract the original ID if present (for sibling mapping)
            original_id = player_data.pop("id", None)

            coach_team_id = player_data.pop("coach_team_id", None)
            coach_team = None
            if coach_team_id:
                try:
                    coach_team = Team.objects.get(id=coach_team_id, division=division)
                except (Team.DoesNotExist, ValueError):
                    # Invalid UUID or team not found - skip coach assignment
                    pass

            # Store sibling_id for later remapping, then clear it
            old_sibling_id = player_data.pop("sibling_id", None)

            # Sanitize remaining UUID fields - clear invalid values
            for uuid_field in ["locked_to_team_id", "drafted_by_team_id"]:
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

            # Track ID mapping
            if original_id:
                old_to_new_id[str(original_id)] = player.id

            # Track sibling reference to fix later
            if old_sibling_id:
                sibling_refs[player.id] = str(old_sibling_id)

        # Second pass: Fix sibling_id references using the mapping
        for player_id, old_sibling_id in sibling_refs.items():
            new_sibling_id = old_to_new_id.get(old_sibling_id)
            if new_sibling_id:
                Player.objects.filter(id=player_id).update(sibling_id=new_sibling_id)
                # Update the player object in our list too
                for p in created_players:
                    if p.id == player_id:
                        p.sibling_id = new_sibling_id
                        break

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

    permission_classes = [IsAuthenticated]

    def _verify_division_access(self, request, division):
        """Verify user has access to the division's league."""
        if request.user.role == "master_admin":
            return None
        if not hasattr(request, "league") or request.league != division.league:
            return Response(
                {"error": "You do not have access to this division"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _require_league_admin(self, request, division):
        """Verify user is admin of the division's league."""
        if request.user.role == "master_admin":
            return None
        if not request.user.is_league_admin(division.league):
            return Response(
                {"error": "Only league admins can perform this action"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def retrieve(self, request, pk=None):
        """Get draft state for a division."""
        try:
            draft_state = DraftState.objects.get(division_id=pk)
            # Verify access
            error = self._verify_division_access(request, draft_state.division)
            if error:
                return error
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

        # Verify access to division
        try:
            division = Division.objects.get(id=serializer.validated_data["division_id"])
        except Division.DoesNotExist:
            return Response(
                {"error": "Division not found"}, status=status.HTTP_404_NOT_FOUND
            )

        error = self._require_league_admin(request, division)
        if error:
            return error

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

        # Verify access to draft
        try:
            draft_state = DraftState.objects.get(id=serializer.validated_data["draft_state_id"])
        except DraftState.DoesNotExist:
            return Response(
                {"error": "Draft not found"}, status=status.HTTP_404_NOT_FOUND
            )

        error = self._verify_division_access(request, draft_state.division)
        if error:
            return error

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
        """Undo last pick - admin only."""
        serializer = UndoPickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verify admin access
        try:
            draft_state = DraftState.objects.get(id=serializer.validated_data["draft_state_id"])
        except DraftState.DoesNotExist:
            return Response(
                {"error": "Draft not found"}, status=status.HTTP_404_NOT_FOUND
            )

        error = self._require_league_admin(request, draft_state.division)
        if error:
            return error

        try:
            draft_state = DraftService.undo_last_pick(
                draft_state_id=serializer.validated_data["draft_state_id"]
            )
            return Response(self._get_full_draft_response(draft_state))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def trade(self, request):
        """Create a trade - admin only."""
        serializer = CreateTradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verify admin access
        try:
            draft_state = DraftState.objects.get(id=serializer.validated_data["draft_state_id"])
        except DraftState.DoesNotExist:
            return Response(
                {"error": "Draft not found"}, status=status.HTTP_404_NOT_FOUND
            )

        error = self._require_league_admin(request, draft_state.division)
        if error:
            return error

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


# -----------------------------------------------------------------------------
# League Member Management
# -----------------------------------------------------------------------------


class LeagueMemberViewSet(viewsets.ViewSet):
    """ViewSet for managing league members."""

    permission_classes = [IsAuthenticated]

    def _get_league(self, league_id):
        """Get league and verify user is admin."""
        try:
            league = League.objects.get(id=league_id)
        except League.DoesNotExist:
            return None, Response(
                {"error": "League not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return league, None

    def _require_admin(self, request, league):
        """Check if user is admin of the league."""
        if not request.user.is_league_admin(league):
            return Response(
                {"error": "Only league admins can perform this action"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def list(self, request, league_id=None):
        """List all members of a league."""
        league, error = self._get_league(league_id)
        if error:
            return error

        # Verify user is a member
        if not LeagueMembership.objects.filter(user=request.user, league=league).exists():
            return Response(
                {"error": "You are not a member of this league"},
                status=status.HTTP_403_FORBIDDEN,
            )

        memberships = LeagueMembership.objects.filter(league=league).select_related("user")
        serializer = LeagueMemberSerializer(memberships, many=True)
        return Response(serializer.data)

    def destroy(self, request, league_id=None, pk=None):
        """Remove a member from the league."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        try:
            membership = LeagueMembership.objects.get(league=league, user_id=pk)
        except LeagueMembership.DoesNotExist:
            return Response(
                {"error": "Member not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent removing self
        if membership.user == request.user:
            return Response(
                {"error": "You cannot remove yourself from the league"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent removing last admin
        if membership.role == "admin":
            admin_count = LeagueMembership.objects.filter(league=league, role="admin").count()
            if admin_count <= 1:
                return Response(
                    {"error": "Cannot remove the last admin"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="role")
    def update_role(self, request, league_id=None, pk=None):
        """Update a member's role."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        try:
            membership = LeagueMembership.objects.get(league=league, user_id=pk)
        except LeagueMembership.DoesNotExist:
            return Response(
                {"error": "Member not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UpdateMemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_role = serializer.validated_data["role"]

        # Prevent demoting self if last admin
        if membership.user == request.user and membership.role == "admin" and new_role != "admin":
            admin_count = LeagueMembership.objects.filter(league=league, role="admin").count()
            if admin_count <= 1:
                return Response(
                    {"error": "Cannot demote yourself as the last admin"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.role = new_role
        membership.save()
        return Response(LeagueMemberSerializer(membership).data)


# -----------------------------------------------------------------------------
# League Invitations
# -----------------------------------------------------------------------------


class LeagueInvitationViewSet(viewsets.ViewSet):
    """ViewSet for managing league invitations."""

    permission_classes = [IsAuthenticated]

    def _get_league(self, league_id):
        """Get league."""
        try:
            league = League.objects.get(id=league_id)
        except League.DoesNotExist:
            return None, Response(
                {"error": "League not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return league, None

    def _require_admin(self, request, league):
        """Check if user is admin of the league."""
        if not request.user.is_league_admin(league):
            return Response(
                {"error": "Only league admins can perform this action"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def list(self, request, league_id=None):
        """List pending invitations."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        invitations = LeagueInvitation.objects.filter(
            league=league,
            accepted_at__isnull=True,
            is_link_invite=False,
        ).select_related("invited_by")

        # Filter out expired
        invitations = [inv for inv in invitations if not inv.is_expired]

        serializer = LeagueInvitationSerializer(invitations, many=True)
        return Response(serializer.data)

    def create(self, request, league_id=None):
        """Send an email invitation."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        serializer = CreateInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].lower()
        role = serializer.validated_data["role"]

        # Check if already a member
        if LeagueMembership.objects.filter(league=league, user__email__iexact=email).exists():
            return Response(
                {"error": "This user is already a member of the league"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check for existing pending invitation
        existing = LeagueInvitation.objects.filter(
            league=league,
            email__iexact=email,
            accepted_at__isnull=True,
        ).first()
        if existing and not existing.is_expired:
            return Response(
                {"error": "An invitation has already been sent to this email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create invitation
        token = secrets.token_urlsafe(32)
        invitation = LeagueInvitation.objects.create(
            league=league,
            email=email,
            token=token,
            invited_by=request.user,
            role=role,
            is_link_invite=False,
            expires_at=timezone.now() + timedelta(days=7),
        )

        # Send invitation email
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        invite_url = f"{frontend_url}/join?token={token}"

        subject = f"You're invited to join {league.name} - Little League Draft"
        message = f"""
Hello,

{request.user.first_name or request.user.email} has invited you to join {league.name} on Little League Draft.

Click the link below to accept the invitation:
{invite_url}

This invitation will expire in 7 days.

Thanks,
Little League Draft Team
"""
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception:
            # Log but don't fail if email fails
            pass

        return Response(LeagueInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, league_id=None, pk=None):
        """Cancel an invitation."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        try:
            invitation = LeagueInvitation.objects.get(id=pk, league=league)
        except LeagueInvitation.DoesNotExist:
            return Response(
                {"error": "Invitation not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        invitation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptInvitationView(APIView):
    """Accept an invitation (email or link-based)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]

        # First check if it's a join link token
        league = League.objects.filter(
            join_link_token=token,
            join_link_enabled=True,
        ).first()

        if league:
            # Join via link
            if LeagueMembership.objects.filter(user=request.user, league=league).exists():
                return Response(
                    {"error": "You are already a member of this league"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            LeagueMembership.objects.create(
                user=request.user,
                league=league,
                role="member",
            )
            return Response({
                "message": "Successfully joined the league",
                "league_id": str(league.id),
                "league_name": league.name,
            })

        # Check email invitation
        try:
            invitation = LeagueInvitation.objects.get(
                token=token,
                accepted_at__isnull=True,
            )
        except LeagueInvitation.DoesNotExist:
            return Response(
                {"error": "Invalid or expired invitation"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if invitation.is_expired:
            return Response(
                {"error": "This invitation has expired"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # For email invites, check if email matches (optional - can be more flexible)
        if invitation.email and invitation.email.lower() != request.user.email.lower():
            return Response(
                {"error": "This invitation was sent to a different email address"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if already a member
        if LeagueMembership.objects.filter(user=request.user, league=invitation.league).exists():
            invitation.accepted_at = timezone.now()
            invitation.save()
            return Response(
                {"error": "You are already a member of this league"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create membership
        LeagueMembership.objects.create(
            user=request.user,
            league=invitation.league,
            role=invitation.role,
        )

        invitation.accepted_at = timezone.now()
        invitation.save()

        return Response({
            "message": "Successfully joined the league",
            "league_id": str(invitation.league.id),
            "league_name": invitation.league.name,
        })


# -----------------------------------------------------------------------------
# Join Link Management
# -----------------------------------------------------------------------------


class JoinLinkView(APIView):
    """Manage league join link."""

    permission_classes = [IsAuthenticated]

    def _get_league(self, league_id):
        """Get league."""
        try:
            league = League.objects.get(id=league_id)
        except League.DoesNotExist:
            return None, Response(
                {"error": "League not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return league, None

    def _require_admin(self, request, league):
        """Check if user is admin of the league."""
        if not request.user.is_league_admin(league):
            return Response(
                {"error": "Only league admins can perform this action"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def get(self, request, league_id):
        """Get join link status."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        url = None
        if league.join_link_enabled and league.join_link_token:
            url = f"{frontend_url}/join/{league.join_link_token}"

        return Response({
            "enabled": league.join_link_enabled,
            "token": league.join_link_token,
            "url": url,
        })

    def post(self, request, league_id):
        """Generate or regenerate join link."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        # Generate new token
        league.join_link_token = secrets.token_urlsafe(32)
        league.join_link_enabled = True
        league.save()

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        url = f"{frontend_url}/join/{league.join_link_token}"

        return Response({
            "enabled": True,
            "token": league.join_link_token,
            "url": url,
        })

    def delete(self, request, league_id):
        """Disable join link."""
        league, error = self._get_league(league_id)
        if error:
            return error

        error = self._require_admin(request, league)
        if error:
            return error

        league.join_link_enabled = False
        league.save()

        return Response({
            "enabled": False,
            "token": league.join_link_token,
            "url": None,
        })


class PublicJoinLinkView(APIView):
    """Public endpoint to get league info from join link or email invitation token."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]  # Security: Rate limit public endpoint

    def get(self, request, token):
        """Get league info from join link token or email invitation token."""
        # First, check if it's a join link token
        league = League.objects.filter(
            join_link_token=token,
            join_link_enabled=True,
        ).first()

        if league:
            return Response({
                "league_name": league.name,
                "league_slug": league.slug,
                "type": "join_link",
            })

        # Check if it's an email invitation token
        invitation = LeagueInvitation.objects.filter(
            token=token,
            accepted_at__isnull=True,
        ).select_related("league", "invited_by").first()

        if invitation and not invitation.is_expired:
            return Response({
                "league_name": invitation.league.name,
                "league_slug": invitation.league.slug,
                "type": "email_invitation",
                "invited_by": invitation.invited_by.email if invitation.invited_by else None,
                "role": invitation.role,
            })

        return Response(
            {"error": "Invalid or expired invitation link"},
            status=status.HTTP_404_NOT_FOUND,
        )
