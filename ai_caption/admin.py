# ai_caption/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import CaptionGeneration, CaptionTemplate, SavedCaption, UserAPISettings


@admin.register(UserAPISettings)
class UserAPISettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'has_api_key_badge', 'default_model', 'total_generations', 
                    'total_tokens_used', 'updated_at']
    list_filter = ['default_model', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['total_tokens_used', 'total_generations', 'created_at', 'updated_at']
    ordering = ['-updated_at']
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Settings', {
            'fields': ('default_model',)
        }),
        ('Usage Statistics', {
            'fields': ('total_generations', 'total_tokens_used'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
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


@admin.register(CaptionGeneration)
class CaptionGenerationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'get_input_preview', 'media_type_badge', 'tone', 
                    'platform_badge', 'status_badge', 'tokens_used', 'created_at']
    list_filter = ['status', 'media_type', 'tone', 'platform', 'created_at']
    search_fields = ['user__username', 'input_text', 'generated_caption']
    readonly_fields = ['user', 'created_at', 'updated_at', 'tokens_used', 
                       'processing_time', 'model_used', 'media_type']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    fieldsets = (
        ('User & Input', {
            'fields': ('user', 'input_text', 'media_file', 'media_type')
        }),
        ('Settings', {
            'fields': ('tone', 'length', 'platform', 'include_hashtags', 
                      'include_emojis', 'include_cta', 'custom_instructions')
        }),
        ('Generated Output', {
            'fields': ('generated_caption', 'generated_hashtags', 'media_analysis'),
            'classes': ('collapse',)
        }),
        ('Status & Metadata', {
            'fields': ('status', 'error_message', 'tokens_used', 'processing_time', 
                      'model_used', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_input_preview(self, obj):
        if obj.input_text:
            return obj.input_text[:50] + '...' if len(obj.input_text) > 50 else obj.input_text
        return '-'
    get_input_preview.short_description = 'Input'
    
    def media_type_badge(self, obj):
        colors = {
            'none': '#6c757d',
            'image': '#28a745',
            'video': '#007bff'
        }
        icons = {
            'none': '📝',
            'image': '🖼️',
            'video': '🎬'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 12px;">{} {}</span>',
            colors.get(obj.media_type, '#6c757d'),
            icons.get(obj.media_type, ''),
            obj.media_type.upper()
        )
    media_type_badge.short_description = 'Media'
    
    def platform_badge(self, obj):
        colors = {
            'general': '#6c757d',
            'facebook': '#1877f2',
            'instagram': '#e4405f',
            'twitter': '#1da1f2',
            'linkedin': '#0a66c2',
            'tiktok': '#000000',
            'youtube': '#ff0000',
            'pinterest': '#e60023'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            colors.get(obj.platform, '#6c757d'),
            obj.platform.title()
        )
    platform_badge.short_description = 'Platform'
    
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


@admin.register(CaptionTemplate)
class CaptionTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'user', 'is_global', 'tone', 'platform', 'created_at']
    list_filter = ['category', 'is_global', 'tone', 'platform', 'created_at']
    search_fields = ['name', 'template_text', 'user__username']
    ordering = ['category', 'name']
    
    fieldsets = (
        ('Template Info', {
            'fields': ('name', 'category', 'template_text')
        }),
        ('Settings', {
            'fields': ('tone', 'platform')
        }),
        ('Access', {
            'fields': ('user', 'is_global')
        }),
    )


@admin.register(SavedCaption)
class SavedCaptionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'get_caption_preview', 'is_favorite_badge', 
                    'used_count', 'created_at']
    list_filter = ['is_favorite', 'created_at']
    search_fields = ['user__username', 'caption_text', 'notes']
    ordering = ['-created_at']
    
    def get_caption_preview(self, obj):
        return obj.caption_text[:60] + '...' if len(obj.caption_text) > 60 else obj.caption_text
    get_caption_preview.short_description = 'Caption'
    
    def is_favorite_badge(self, obj):
        if obj.is_favorite:
            return format_html('<span style="color: #ffc107; font-size: 18px;">⭐</span>')
        return '-'
    is_favorite_badge.short_description = 'Favorite'