# ai_video/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    UserVideoSettings, VideoLogo, VideoGeneration, 
    SavedVideo, VideoPromptTemplate
)


@admin.register(UserVideoSettings)
class UserVideoSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'has_api_key_badge', 'default_style', 'total_videos_generated', 
                    'total_duration_display', 'updated_at']
    list_filter = ['default_style', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['total_videos_generated', 'total_api_calls', 'total_duration_generated', 
                       'created_at', 'updated_at']
    ordering = ['-updated_at']
    
    def has_api_key_badge(self, obj):
        if obj.has_api_key:
            return format_html(
                '<span style="background-color: #28a745; color: white; padding: 3px 8px; '
                'border-radius: 3px; font-size: 11px;">✓ Connected</span>'
            )
        return format_html(
            '<span style="background-color: #dc3545; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px;">✗ Not Set</span>'
        )
    has_api_key_badge.short_description = 'API Key'
    
    def total_duration_display(self, obj):
        minutes = obj.total_duration_generated // 60
        seconds = obj.total_duration_generated % 60
        return f"{minutes}m {seconds}s"
    total_duration_display.short_description = 'Total Duration'


@admin.register(VideoLogo)
class VideoLogoAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'logo_preview', 'is_default', 'created_at']
    list_filter = ['is_default', 'created_at']
    search_fields = ['name', 'user__username']
    ordering = ['-created_at']
    
    def logo_preview(self, obj):
        if obj.logo_file:
            return format_html(
                '<img src="{}" style="max-width: 50px; max-height: 50px; border-radius: 4px;"/>',
                obj.logo_file.url
            )
        return '-'
    logo_preview.short_description = 'Preview'


@admin.register(VideoGeneration)
class VideoGenerationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'style_badge', 'duration_display', 'resolution',
                    'status_badge', 'has_logo_badge', 'processing_time', 'created_at']
    list_filter = ['status', 'style', 'resolution', 'aspect_ratio', 'created_at']
    search_fields = ['user__username', 'title', 'prompt']
    readonly_fields = ['user', 'created_at', 'updated_at', 'processing_time', 
                       'enhanced_prompt', 'file_size', 'thumbnail_preview']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    fieldsets = (
        ('User & Title', {
            'fields': ('user', 'title')
        }),
        ('Prompt', {
            'fields': ('prompt', 'negative_prompt', 'enhanced_prompt')
        }),
        ('Video Settings', {
            'fields': ('style', 'duration', 'resolution', 'aspect_ratio', 'fps')
        }),
        ('Motion Settings', {
            'fields': ('camera_motion', 'motion_intensity')
        }),
        ('Logo Settings', {
            'fields': ('logo', 'logo_position', 'logo_size', 'logo_opacity')
        }),
        ('Output', {
            'fields': ('thumbnail_preview', 'generated_video', 'generated_video_with_logo', 'thumbnail'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('status', 'error_message', 'processing_time', 'file_size', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def thumbnail_preview(self, obj):
        if obj.thumbnail:
            return format_html(
                '<img src="{}" style="max-width: 200px; max-height: 150px; border-radius: 8px;"/>',
                obj.thumbnail.url
            )
        return '-'
    thumbnail_preview.short_description = 'Preview'
    
    def duration_display(self, obj):
        return f"{obj.duration}s"
    duration_display.short_description = 'Duration'
    
    def style_badge(self, obj):
        colors = {
            'realistic': '#28a745',
            'cinematic': '#6c5ce7',
            'anime': '#e4405f',
            'cartoon': '#f39c12',
            '3d_animation': '#3498db',
            'artistic': '#9b59b6',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.style, '#6c757d'),
            obj.style.replace('_', ' ').title()
        )
    style_badge.short_description = 'Style'
    
    def status_badge(self, obj):
        colors = {
            'pending': '#ffc107',
            'processing': '#17a2b8',
            'completed': '#28a745',
            'failed': '#dc3545'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.status, '#6c757d'),
            obj.status.title()
        )
    status_badge.short_description = 'Status'
    
    def has_logo_badge(self, obj):
        if obj.logo and obj.logo_position != 'none':
            return format_html(
                '<span style="color: #28a745;">✓ {}</span>',
                obj.logo_position.replace('_', ' ').title()
            )
        return '-'
    has_logo_badge.short_description = 'Logo'


@admin.register(SavedVideo)
class SavedVideoAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'is_favorite_badge', 'duration_display', 
                    'download_count', 'created_at']
    list_filter = ['is_favorite', 'created_at']
    search_fields = ['user__username', 'title', 'prompt']
    ordering = ['-created_at']
    
    def duration_display(self, obj):
        return f"{obj.duration}s"
    duration_display.short_description = 'Duration'
    
    def is_favorite_badge(self, obj):
        if obj.is_favorite:
            return format_html('<span style="color: #ffc107; font-size: 18px;">⭐</span>')
        return '-'
    is_favorite_badge.short_description = 'Favorite'


@admin.register(VideoPromptTemplate)
class VideoPromptTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'user', 'is_global', 'recommended_style', 
                    'recommended_duration', 'created_at']
    list_filter = ['category', 'is_global', 'recommended_style', 'created_at']
    search_fields = ['name', 'prompt_template', 'user__username']
    ordering = ['category', 'name']
