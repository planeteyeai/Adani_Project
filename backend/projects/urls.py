from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HealthView, ProjectViewSet

router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("", include(router.urls)),
]
