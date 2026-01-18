from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    HealthView,
    CSRFTokenView,
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    DivisionViewSet,
    TeamViewSet,
    PlayerViewSet,
    DraftViewSet,
    LeagueMemberViewSet,
    LeagueInvitationViewSet,
    AcceptInvitationView,
    JoinLinkView,
    PublicJoinLinkView,
)

router = DefaultRouter()
router.register(r"divisions", DivisionViewSet, basename="division")
router.register(r"teams", TeamViewSet, basename="team")
router.register(r"players", PlayerViewSet, basename="player")
router.register(r"draft", DraftViewSet, basename="draft")

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    # CSRF token endpoint
    path("api/auth/csrf/", CSRFTokenView.as_view(), name="csrf-token"),
    # Auth endpoints
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("api/auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("api/auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    # League member management
    path(
        "api/leagues/<uuid:league_id>/members/",
        LeagueMemberViewSet.as_view({"get": "list"}),
        name="league-members-list",
    ),
    path(
        "api/leagues/<uuid:league_id>/members/<uuid:pk>/",
        LeagueMemberViewSet.as_view({"delete": "destroy"}),
        name="league-members-detail",
    ),
    path(
        "api/leagues/<uuid:league_id>/members/<uuid:pk>/role/",
        LeagueMemberViewSet.as_view({"patch": "update_role"}),
        name="league-members-role",
    ),
    # League invitations
    path(
        "api/leagues/<uuid:league_id>/invitations/",
        LeagueInvitationViewSet.as_view({"get": "list", "post": "create"}),
        name="league-invitations",
    ),
    path(
        "api/leagues/<uuid:league_id>/invitations/<uuid:pk>/",
        LeagueInvitationViewSet.as_view({"delete": "destroy"}),
        name="league-invitations-detail",
    ),
    # Join link management
    path(
        "api/leagues/<uuid:league_id>/join-link/",
        JoinLinkView.as_view(),
        name="league-join-link",
    ),
    # Accept invitation
    path("api/invitations/accept/", AcceptInvitationView.as_view(), name="accept-invitation"),
    # Public join link info
    path("api/leagues/join/<str:token>/", PublicJoinLinkView.as_view(), name="public-join-link"),
    # API endpoints
    path("api/", include(router.urls)),
]
