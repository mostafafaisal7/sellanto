# ai_voice/models.py

from django.db import models
from django.contrib.auth.models import User


class UserVoiceSettings(models.Model):
    """User's AI Voice settings and API configuration"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='voice_settings')
    openai_api_key = models.CharField(max_length=255, blank=True, null=True)
    default_voice = models.CharField(max_length=50, default='alloy')
    default_speed = models.FloatField(default=1.0)
    default_model = models.CharField(max_length=50, default='tts-1')
    total_characters_used = models.IntegerField(default=0)
    total_generations = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_voice_uservoicesettings'
        verbose_name = 'User Voice Settings'
        verbose_name_plural = 'User Voice Settings'

    def __str__(self):
        return f"{self.user.username}'s Voice Settings"


class VoiceGeneration(models.Model):
    """Individual voice generation record"""
    
    VOICE_CHOICES = [
        ('alloy', 'Alloy - Neutral'),
        ('echo', 'Echo - Male'),
        ('fable', 'Fable - British'),
        ('onyx', 'Onyx - Deep Male'),
        ('nova', 'Nova - Female'),
        ('shimmer', 'Shimmer - Soft Female'),
    ]
    
    MODEL_CHOICES = [
        ('tts-1', 'TTS-1 (Standard)'),
        ('tts-1-hd', 'TTS-1-HD (High Quality)'),
    ]
    
    FORMAT_CHOICES = [
        ('mp3', 'MP3'),
        ('opus', 'Opus'),
        ('aac', 'AAC'),
        ('flac', 'FLAC'),
        ('wav', 'WAV'),
        ('pcm', 'PCM'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='voice_generations')
    title = models.CharField(max_length=255, blank=True, null=True)
    input_text = models.TextField()
    voice = models.CharField(max_length=50, choices=VOICE_CHOICES, default='alloy')
    model = models.CharField(max_length=50, choices=MODEL_CHOICES, default='tts-1')
    speed = models.FloatField(default=1.0)  # 0.25 to 4.0
    output_format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='mp3')
    
    # Output
    audio_file = models.FileField(upload_to='ai_voice/generations/', blank=True, null=True)
    audio_url = models.URLField(max_length=500, blank=True, null=True)
    duration_seconds = models.FloatField(blank=True, null=True)
    file_size_bytes = models.IntegerField(blank=True, null=True)
    
    # Tracking
    characters_used = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    processing_time = models.FloatField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_voice_voicegeneration'
        ordering = ['-created_at']
        verbose_name = 'Voice Generation'
        verbose_name_plural = 'Voice Generations'

    def __str__(self):
        return f"{self.title or 'Untitled'} - {self.voice} ({self.status})"
    
    @property
    def text_preview(self):
        """Return truncated text for display"""
        if len(self.input_text) > 100:
            return self.input_text[:100] + '...'
        return self.input_text
