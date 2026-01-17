from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    HealthView,
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    DivisionViewSet,
    TeamViewSet,
    PlayerViewSet,
    DraftViewSet,
)

router = DefaultRouter()
router.register(r"divisions", DivisionViewSet, basename="division")
router.register(r"teams", TeamViewSet, basename="team")
router.register(r"players", PlayerViewSet, basename="player")
router.register(r"draft", DraftViewSet, basename="draft")

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    # Auth endpoints
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    # API endpoints
    path("api/", include(router.urls)),
]
