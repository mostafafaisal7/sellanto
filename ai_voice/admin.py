# ai_voice/admin.py

from django.contrib import admin
from .models import VoiceGeneration, UserVoiceSettings


@admin.register(UserVoiceSettings)
class UserVoiceSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'default_voice', 'default_model', 'total_generations', 'total_characters_used', 'updated_at']
    list_filter = ['default_voice', 'default_model']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['total_generations', 'total_characters_used', 'created_at', 'updated_at']


@admin.register(VoiceGeneration)
class VoiceGenerationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'voice', 'model', 'status', 'characters_used', 'created_at']
    list_filter = ['status', 'voice', 'model', 'created_at']
    search_fields = ['user__username', 'title', 'input_text']
    readonly_fields = ['characters_used', 'processing_time', 'file_size_bytes', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('user', 'title', 'status')
        }),
        ('Input', {
            'fields': ('input_text',)
        }),
        ('Voice Settings', {
            'fields': ('voice', 'model', 'speed', 'output_format')
        }),
        ('Output', {
            'fields': ('audio_file', 'audio_url', 'duration_seconds', 'file_size_bytes')
        }),
        ('Tracking', {
            'fields': ('characters_used', 'processing_time', 'error_message')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
