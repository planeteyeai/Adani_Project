from rest_framework import serializers

from .models import Project


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight — excludes the heavy geojson blob."""

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "location",
            "industry",
            "description",
            "stats",
            "source_filename",
            "created_at",
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "location",
            "industry",
            "description",
            "geojson",
            "stats",
            "source_filename",
            "created_at",
            "updated_at",
        ]
