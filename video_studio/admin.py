# video_studio/admin.py

from django.contrib import admin
from .models import (
    VideoProject,
    VideoClip,
    MergedVideo,
    PromptOptimizationLog,
    VideoTemplate,
    ABTestVariant
)


@admin.register(VideoProject)
class VideoProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'brand', 'status', 'progress', 'total_clips', 'completed_clips', 'created_at')
    list_filter = ('status', 'created_at', 'brand')
    search_fields = ('name', 'description', 'product_name', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'progress')

    fieldsets = (
        ('Project Info', {
            'fields': ('user', 'workspace', 'brand', 'name', 'description')
        }),
        ('Product Details', {
            'fields': ('product_name', 'product_description', 'product_category', 'product_images')
        }),
        ('Settings', {
            'fields': ('target_platforms', 'default_aspect_ratio', 'default_resolution', 'auto_merge')
        }),
        ('Status', {
            'fields': ('status', 'progress', 'total_clips', 'completed_clips')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(VideoClip)
class VideoClipAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'status', 'duration', 'aspect_ratio', 'resolution', 'generation_cost', 'created_at')
    list_filter = ('status', 'aspect_ratio', 'resolution', 'created_at')
    search_fields = ('prompt', 'enhanced_prompt', 'project__name')
    readonly_fields = ('created_at', 'updated_at', 'processing_time', 'generation_cost', 'file_size')

    fieldsets = (
        ('Project', {
            'fields': ('project',)
        }),
        ('Prompts', {
            'fields': ('prompt', 'enhanced_prompt', 'optimized_prompt')
        }),
        ('Generation Settings', {
            'fields': (
                'duration', 'aspect_ratio', 'resolution', 'style',
                'camera_movement', 'lighting_style', 'veo_seed'
            )
        }),
        ('Output', {
            'fields': ('video_file', 'thumbnail', 'audio_included', 'start_frame')
        }),
        ('Metadata', {
            'fields': ('file_size', 'fps', 'codec', 'veo_model_used')
        }),
        ('Selection', {
            'fields': ('is_selected', 'order_index')
        }),
        ('Status', {
            'fields': ('status', 'error_message', 'processing_time', 'generation_cost')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MergedVideo)
class MergedVideoAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'status', 'total_duration', 'transition_type', 'created_at')
    list_filter = ('status', 'transition_type', 'created_at')
    search_fields = ('project__name',)
    readonly_fields = ('created_at', 'processing_time', 'total_duration', 'file_size')

    fieldsets = (
        ('Project', {
            'fields': ('project',)
        }),
        ('Clips', {
            'fields': ('clip_ids',)
        }),
        ('Merge Settings', {
            'fields': ('transition_type', 'transition_duration')
        }),
        ('Output', {
            'fields': ('merged_video', 'thumbnail', 'total_duration', 'file_size', 'resolution', 'aspect_ratio')
        }),
        ('Enhancements', {
            'fields': ('has_captions', 'captions_data', 'background_music', 'music_volume')
        }),
        ('Status', {
            'fields': ('status', 'error_message', 'processing_time')
        }),
        ('Timestamp', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(PromptOptimizationLog)
class PromptOptimizationLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'brand', 'optimization_model', 'user_rating', 'created_at')
    list_filter = ('optimization_model', 'enhancement_type', 'was_regenerated', 'created_at')
    search_fields = ('original_prompt', 'optimized_prompt', 'project__name')
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Context', {
            'fields': ('project', 'brand')
        }),
        ('Prompts', {
            'fields': ('original_prompt', 'optimized_prompt')
        }),
        ('Enhancement', {
            'fields': ('optimization_model', 'enhancement_type', 'enhancement_data')
        }),
        ('Results', {
            'fields': ('video_quality_score', 'user_rating', 'was_regenerated')
        }),
        ('Performance', {
            'fields': ('views', 'engagement_rate', 'conversion_rate')
        }),
        ('Timestamp', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(VideoTemplate)
class VideoTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'is_global', 'is_active', 'times_used', 'avg_rating', 'created_at')
    list_filter = ('category', 'is_global', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('times_used', 'avg_rating', 'created_at', 'updated_at')

    fieldsets = (
        ('Template Info', {
            'fields': ('name', 'description', 'category')
        }),
        ('Configuration', {
            'fields': ('clips_config', 'transition_type', 'recommended_duration', 'aspect_ratio')
        }),
        ('Availability', {
            'fields': ('is_global', 'is_active', 'created_by')
        }),
        ('Preview', {
            'fields': ('preview_video', 'preview_thumbnail')
        }),
        ('Stats', {
            'fields': ('times_used', 'avg_rating')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ABTestVariant)
class ABTestVariantAdmin(admin.ModelAdmin):
    list_display = ('variant_name', 'project', 'clip', 'engagement_rate', 'conversion_rate', 'is_winner', 'created_at')
    list_filter = ('is_winner', 'created_at')
    search_fields = ('variant_name', 'project__name')
    readonly_fields = ('created_at', 'updated_at', 'confidence_score')

    fieldsets = (
        ('Test Info', {
            'fields': ('project', 'clip', 'variant_name', 'variant_config')
        }),
        ('Performance Metrics', {
            'fields': ('views', 'clicks', 'engagement_rate', 'conversion_rate', 'watch_time_avg')
        }),
        ('Results', {
            'fields': ('is_winner', 'confidence_score')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
