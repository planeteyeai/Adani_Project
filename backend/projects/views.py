import json
import os

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis import derive_metrics
from .kml_utils import kml_to_geojson
from .models import Project
from .serializers import ProjectDetailSerializer, ProjectListSerializer

DEMO_FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "demo_project.json")


def _ensure_demo() -> Project:
    """Seed the bundled Digha-Koilwar demo project on first request."""
    project = Project.objects.filter(name__startswith="Digha").first()
    if project:
        return project
    if not os.path.exists(DEMO_FIXTURE):
        return None
    with open(DEMO_FIXTURE, encoding="utf-8") as f:
        payload = json.load(f)
    return Project.objects.create(
        name=payload["name"],
        location=payload.get("location", ""),
        industry=payload.get("industry", "Highways"),
        description="Bundled demo — real plan & profile alignment parsed from KMZ.",
        geojson=payload["geojson"],
        stats=payload["stats"],
        source_filename="digha_koilwar.kmz",
    )


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        return ProjectDetailSerializer

    def list(self, request, *args, **kwargs):
        _ensure_demo()
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def metrics(self, request, pk=None):
        project = self.get_object()
        return Response(derive_metrics(project.stats or {}))

    @action(detail=True, methods=["get"], url_path="schedule-b")
    def schedule_b(self, request, pk=None):
        project = self.get_object()
        data = (project.stats or {}).get("schedule_b")
        if not data:
            return Response(
                {"detail": "No Schedule-B data attached to this project."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "No file provided under key 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = request.data.get("name") or os.path.splitext(upload.name)[0]
        try:
            result = kml_to_geojson(upload.read())
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Could not parse file: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project = Project.objects.create(
            name=name,
            location=request.data.get("location", ""),
            industry=request.data.get("industry", "Other"),
            description=request.data.get("description", ""),
            geojson=result["geojson"],
            stats=result["stats"],
            source_filename=upload.name,
        )
        return Response(
            ProjectDetailSerializer(project).data, status=status.HTTP_201_CREATED
        )


class HealthView(APIView):
    def get(self, request):
        return Response(
            {
                "status": "ok",
                "service": "GeoVision API",
                "database": settings.DATABASES["default"]["ENGINE"].split(".")[-1],
            }
        )
