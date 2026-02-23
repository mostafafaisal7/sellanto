from django.contrib import admin
from .models import (
    Workspace, Brand, BrandAsset, LaunchPlan,
    ContentIdea, ContentApproval, WeeklyReport, GenerationUsage
)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'timezone', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'owner__username']


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['brand_name', 'workspace', 'industry', 'is_primary', 'created_at']
    list_filter = ['is_primary', 'industry']
    search_fields = ['brand_name', 'workspace__name']


@admin.register(BrandAsset)
class BrandAssetAdmin(admin.ModelAdmin):
    list_display = ['name', 'brand', 'asset_type', 'created_at']
    list_filter = ['asset_type']


@admin.register(LaunchPlan)
class LaunchPlanAdmin(admin.ModelAdmin):
    list_display = ['brand', 'post_frequency', 'approval_required', 'created_at']


@admin.register(ContentIdea)
class ContentIdeaAdmin(admin.ModelAdmin):
    list_display = ['title', 'brand', 'platform', 'status', 'created_at']
    list_filter = ['status', 'platform', 'content_format']
    search_fields = ['title', 'hook']


@admin.register(ContentApproval)
class ContentApprovalAdmin(admin.ModelAdmin):
    list_display = ['post', 'submitted_by', 'approver', 'status', 'submitted_at']
    list_filter = ['status']


@admin.register(WeeklyReport)
class WeeklyReportAdmin(admin.ModelAdmin):
    list_display = ['brand', 'period_start', 'period_end', 'generated_at']


@admin.register(GenerationUsage)
class GenerationUsageAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'generation_type', 'date', 'count']
    list_filter = ['generation_type']
