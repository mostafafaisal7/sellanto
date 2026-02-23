# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\admin.py

from django.contrib import admin
from .models import Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['user', 'caption_preview', 'status', 'scheduled_time', 'created_at']
    list_filter = ['status', 'ai_generated', 'created_at']
    search_fields = ['user__username', 'caption']
    readonly_fields = ['created_at', 'updated_at', 'posted_at']
    date_hierarchy = 'scheduled_time'
    
    def caption_preview(self, obj):
        return obj.caption[:50] + '...' if len(obj.caption) > 50 else obj.caption
    caption_preview.short_description = 'Caption'
    
    fieldsets = (
        ('Post Info', {
            'fields': ('user', 'caption', 'ai_generated', 'media_files')
        }),
        ('Scheduling', {
            'fields': ('scheduled_time', 'timezone', 'platforms', 'status')
        }),
        ('Facebook', {
            'fields': ('facebook_post_id', 'facebook_error'),
            'classes': ('collapse',)
        }),
        ('Twitter', {
            'fields': ('twitter_post_id', 'twitter_error'),
            'classes': ('collapse',)
        }),
        ('Instagram', {
            'fields': ('instagram_post_id', 'instagram_error'),
            'classes': ('collapse',)
        }),
        ('LinkedIn', {
            'fields': ('linkedin_post_id', 'linkedin_error'),
            'classes': ('collapse',)
        }),
        ('TikTok', {
            'fields': ('tiktok_post_id', 'tiktok_error'),
            'classes': ('collapse',)
        }),
        ('YouTube', {
            'fields': ('youtube_post_id', 'youtube_error'),
            'classes': ('collapse',)
        }),
        ('Pinterest', {
            'fields': ('pinterest_post_id', 'pinterest_error'),
            'classes': ('collapse',)
        }),
        ('Telegram', {
            'fields': ('telegram_post_id', 'telegram_error'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'posted_at')
        }),
    )