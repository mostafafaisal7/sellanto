# ai_image/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    UserImageSettings, UserLogo, ImageGeneration, 
    SavedImage, PromptTemplate
)


@admin.register(UserImageSettings)
class UserImageSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'has_api_key_badge', 'default_style', 'total_images_generated', 
                    'total_api_calls', 'updated_at']
    list_filter = ['default_style', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['total_images_generated', 'total_api_calls', 'created_at', 'updated_at']
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


@admin.register(UserLogo)
class UserLogoAdmin(admin.ModelAdmin):
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


@admin.register(ImageGeneration)
class ImageGenerationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'style_badge', 'size', 'status_badge', 
                    'has_logo_badge', 'has_product_badge', 'processing_time', 'created_at']
    list_filter = ['status', 'style', 'size', 'logo_position', 'created_at']
    search_fields = ['user__username', 'title', 'prompt']
    readonly_fields = ['user', 'created_at', 'updated_at', 'processing_time', 
                       'enhanced_prompt', 'image_preview', 'product_preview']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    fieldsets = (
        ('User & Title', {
            'fields': ('user', 'title')
        }),
        ('Prompt', {
            'fields': ('prompt', 'negative_prompt', 'enhanced_prompt')
        }),
        ('Style Settings', {
            'fields': ('style', 'size', 'quality', 'add_lighting', 'camera_angle')
        }),
        ('Logo Settings', {
            'fields': ('logo', 'logo_position', 'logo_size', 'logo_opacity')
        }),
        ('Product Image', {
            'fields': ('product_preview', 'product_image', 'product_position', 'product_scale', 'composited_image'),
            'classes': ('collapse',)
        }),
        ('Output', {
            'fields': ('image_preview', 'generated_image', 'generated_image_with_logo'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('status', 'error_message', 'processing_time', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def image_preview(self, obj):
        img = obj.get_display_image()
        if img:
            return format_html(
                '<img src="{}" style="max-width: 300px; max-height: 300px; border-radius: 8px;"/>',
                img.url
            )
        return '-'
    image_preview.short_description = 'Preview'
    
    def style_badge(self, obj):
        colors = {
            'realistic': '#28a745',
            'anime': '#e4405f',
            'artistic': '#9b59b6',
            'cartoon': '#f39c12',
            '3d_render': '#3498db',
            'digital_art': '#1abc9c',
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
    
    def has_product_badge(self, obj):
        if obj.has_product:
            return format_html(
                '<span style="background-color: #8b5cf6; color: white; padding: 3px 8px; '
                'border-radius: 3px; font-size: 11px;">📦 Product</span>'
            )
        return '-'
    has_product_badge.short_description = 'Product'
    
    def product_preview(self, obj):
        if obj.product_image:
            return format_html(
                '<img src="{}" style="max-width: 150px; max-height: 150px; border-radius: 8px;"/>',
                obj.product_image.url
            )
        return '-'
    product_preview.short_description = 'Product Preview'
    
    def has_logo_badge(self, obj):
        if obj.logo and obj.logo_position != 'none':
            return format_html(
                '<span style="color: #28a745;">✓ {}</span>',
                obj.logo_position.replace('_', ' ').title()
            )
        return '-'
    has_logo_badge.short_description = 'Logo'


@admin.register(SavedImage)
class SavedImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'is_favorite_badge', 'download_count', 'created_at']
    list_filter = ['is_favorite', 'created_at']
    search_fields = ['user__username', 'title', 'prompt']
    ordering = ['-created_at']
    
    def is_favorite_badge(self, obj):
        if obj.is_favorite:
            return format_html('<span style="color: #ffc107; font-size: 18px;">⭐</span>')
        return '-'
    is_favorite_badge.short_description = 'Favorite'


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'user', 'is_global', 'recommended_style', 'created_at']
    list_filter = ['category', 'is_global', 'recommended_style', 'created_at']
    search_fields = ['name', 'prompt_template', 'user__username']
    ordering = ['category', 'name']
