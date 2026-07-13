from django.db import models


class Project(models.Model):
    """A satellite-based infrastructure planning project.

    Geometry is stored as GeoJSON in a JSONField. This keeps the stack easy to
    run anywhere; swap to PostGIS geometry columns later without touching the API.
    """

    INDUSTRY_CHOICES = [
        ("Highways", "Highways"),
        ("Oil & Gas", "Oil & Gas"),
        ("Railways", "Railways"),
        ("Power Transmission", "Power Transmission"),
        ("Solar", "Solar"),
        ("Water Supply", "Water Supply"),
        ("Mining", "Mining"),
        ("Smart Cities", "Smart Cities"),
        ("Metro Rail", "Metro Rail"),
        ("Other", "Other"),
    ]

    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    industry = models.CharField(max_length=64, choices=INDUSTRY_CHOICES, default="Highways")
    description = models.TextField(blank=True)

    geojson = models.JSONField(default=dict, blank=True)
    stats = models.JSONField(default=dict, blank=True)

    source_filename = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
