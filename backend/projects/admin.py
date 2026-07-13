from django.contrib import admin

from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "industry", "location", "created_at")
    list_filter = ("industry",)
    search_fields = ("name", "location")
