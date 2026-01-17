from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    HealthView,
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
    path("api/", include(router.urls)),
]
