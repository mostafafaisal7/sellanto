# ai_video/models.py

from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
import os
import uuid
import base64


def logo_upload_path(instance, filename):
    """Generate unique path for uploaded logos"""
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f"video_logos/{instance.user.id}/{new_filename}"


def generated_video_path(instance, filename):
    """Generate unique path for generated videos"""
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f"generated_videos/{instance.user.id}/{new_filename}"


def thumbnail_path(instance, filename):
    """Generate unique path for video thumbnails"""
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f"video_thumbnails/{instance.user.id}/{new_filename}"


class UserVideoSettings(models.Model):
    """Store user's API keys and settings for video generation"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='video_settings')
    
    # Encrypted API key storage
    _gemini_api_key = models.TextField(blank=True, null=True, db_column='gemini_api_key')
    
    # Default settings
    default_style = models.CharField(max_length=50, default='realistic', choices=[
        ('realistic', 'Realistic'),
        ('cinematic', 'Cinematic'),
        ('anime', 'Anime/Animation'),
        ('cartoon', 'Cartoon'),
        ('3d_animation', '3D Animation'),
        ('artistic', 'Artistic'),
        ('vintage', 'Vintage/Retro'),
        ('slow_motion', 'Slow Motion'),
        ('timelapse', 'Timelapse'),
        ('documentary', 'Documentary'),
    ])
    
    default_duration = models.IntegerField(default=5, choices=[
        (3, '3 seconds'),
        (5, '5 seconds'),
        (8, '8 seconds'),
        (10, '10 seconds'),
        (15, '15 seconds'),
    ])
    
    default_resolution = models.CharField(max_length=20, default='1080p', choices=[
        ('480p', '480p (SD)'),
        ('720p', '720p (HD)'),
        ('1080p', '1080p (Full HD)'),
        ('4k', '4K (Ultra HD)'),
    ])
    
    # Usage tracking
    total_videos_generated = models.IntegerField(default=0)
    total_api_calls = models.IntegerField(default=0)
    total_duration_generated = models.IntegerField(default=0, help_text="Total seconds of video generated")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Video Settings"
        verbose_name_plural = "User Video Settings"
    
    def __str__(self):
        return f"Video Settings - {self.user.username}"
    
    def set_gemini_api_key(self, api_key):
        """Encode and store the API key"""
        if api_key:
            encoded = base64.b64encode(api_key.encode()).decode()
            self._gemini_api_key = encoded
        else:
            self._gemini_api_key = None
    
    def get_gemini_api_key(self):
        """Decode and return the API key"""
        if self._gemini_api_key:
            try:
                decoded = base64.b64decode(self._gemini_api_key.encode()).decode()
                return decoded
            except Exception:
                return None
        return None
    
    @property
    def gemini_api_key(self):
        """Get the decoded Gemini API key"""
        return self.get_gemini_api_key()

    @gemini_api_key.setter
    def gemini_api_key(self, value):
        """Set the Gemini API key (will be encoded)"""
        self.set_gemini_api_key(value)

    @property
    def has_api_key(self):
        """Check if user has set an API key"""
        return bool(self._gemini_api_key)

    @property
    def masked_api_key(self):
        """Return masked version of API key for display"""
        key = self.get_gemini_api_key()
        if key and len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return None


class VideoLogo(models.Model):
    """Store user's uploaded logos for video watermarks"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_logos')
    name = models.CharField(max_length=100)
    logo_file = models.ImageField(upload_to=logo_upload_path)
    is_default = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_default', '-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.user.username}"
    
    def save(self, *args, **kwargs):
        if self.is_default:
            VideoLogo.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)


class VideoGeneration(models.Model):
    """Store generated videos history"""
    
    STYLE_CHOICES = [
        ('realistic', 'Realistic'),
        ('cinematic', 'Cinematic'),
        ('anime', 'Anime/Animation'),
        ('cartoon', 'Cartoon'),
        ('3d_animation', '3D Animation'),
        ('artistic', 'Artistic'),
        ('vintage', 'Vintage/Retro'),
        ('slow_motion', 'Slow Motion'),
        ('timelapse', 'Timelapse'),
        ('documentary', 'Documentary'),
        ('sci_fi', 'Sci-Fi'),
        ('fantasy', 'Fantasy'),
        ('horror', 'Horror/Dark'),
        ('comedy', 'Comedy/Fun'),
        ('music_video', 'Music Video'),
    ]
    
    DURATION_CHOICES = [
        (3, '3 seconds'),
        (5, '5 seconds'),
        (8, '8 seconds'),
        (10, '10 seconds'),
        (15, '15 seconds'),
        (30, '30 seconds'),
    ]
    
    RESOLUTION_CHOICES = [
        ('480p', '480p (SD)'),
        ('720p', '720p (HD)'),
        ('1080p', '1080p (Full HD)'),
        ('4k', '4K (Ultra HD)'),
    ]
    
    ASPECT_RATIO_CHOICES = [
        ('16:9', '16:9 (Landscape)'),
        ('9:16', '9:16 (Portrait/Story)'),
        ('1:1', '1:1 (Square)'),
        ('4:3', '4:3 (Classic)'),
        ('21:9', '21:9 (Cinematic)'),
    ]
    
    LOGO_POSITION_CHOICES = [
        ('none', 'No Logo'),
        ('top_left', 'Top Left'),
        ('top_right', 'Top Right'),
        ('top_center', 'Top Center'),
        ('bottom_left', 'Bottom Left'),
        ('bottom_right', 'Bottom Right'),
        ('bottom_center', 'Bottom Center'),
        ('center', 'Center'),
    ]
    
    FPS_CHOICES = [
        (24, '24 FPS (Cinematic)'),
        (30, '30 FPS (Standard)'),
        (60, '60 FPS (Smooth)'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_generations')
    
    # Input
    title = models.CharField(max_length=200, help_text="Title for the video")
    prompt = models.TextField(help_text="Detailed description for video generation")
    negative_prompt = models.TextField(blank=True, null=True, help_text="What to avoid in the video")
    
    # Style Settings
    style = models.CharField(max_length=30, choices=STYLE_CHOICES, default='realistic')
    duration = models.IntegerField(choices=DURATION_CHOICES, default=5)
    resolution = models.CharField(max_length=20, choices=RESOLUTION_CHOICES, default='1080p')
    aspect_ratio = models.CharField(max_length=10, choices=ASPECT_RATIO_CHOICES, default='16:9')
    fps = models.IntegerField(choices=FPS_CHOICES, default=30)
    
    # Logo Settings
    logo = models.ForeignKey(VideoLogo, on_delete=models.SET_NULL, null=True, blank=True)
    logo_position = models.CharField(max_length=20, choices=LOGO_POSITION_CHOICES, default='none')
    logo_size = models.IntegerField(default=10, help_text="Logo size as percentage (5-25)")
    logo_opacity = models.IntegerField(default=100, help_text="Logo opacity (10-100)")
    
    # Advanced Options
    seed = models.IntegerField(blank=True, null=True, help_text="Seed for reproducibility")
    enhance_prompt = models.BooleanField(default=True, help_text="AI-enhance the prompt")
    camera_motion = models.CharField(max_length=50, blank=True, null=True, choices=[
        ('', 'Default'),
        ('static', 'Static (No Movement)'),
        ('pan_left', 'Pan Left'),
        ('pan_right', 'Pan Right'),
        ('tilt_up', 'Tilt Up'),
        ('tilt_down', 'Tilt Down'),
        ('zoom_in', 'Zoom In'),
        ('zoom_out', 'Zoom Out'),
        ('orbit', 'Orbit/Circle'),
        ('dolly', 'Dolly/Track'),
        ('crane', 'Crane Shot'),
        ('handheld', 'Handheld/Shaky'),
    ])
    motion_intensity = models.CharField(max_length=20, blank=True, null=True, choices=[
        ('', 'Default'),
        ('subtle', 'Subtle'),
        ('moderate', 'Moderate'),
        ('dynamic', 'Dynamic'),
        ('intense', 'Intense'),
    ])
    
    # Output
    generated_video = models.FileField(upload_to=generated_video_path, blank=True, null=True)
    generated_video_with_logo = models.FileField(upload_to=generated_video_path, blank=True, null=True)
    thumbnail = models.ImageField(upload_to=thumbnail_path, blank=True, null=True)
    enhanced_prompt = models.TextField(blank=True, null=True, help_text="AI-enhanced prompt used")
    
    # Metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    processing_time = models.FloatField(default=0, help_text="Processing time in seconds")
    file_size = models.BigIntegerField(default=0, help_text="File size in bytes")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Video Generation"
        verbose_name_plural = "Video Generations"
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"
    
    def get_display_video(self):
        """Return video with logo if available, otherwise original"""
        if self.generated_video_with_logo:
            return self.generated_video_with_logo
        return self.generated_video
    
    def get_resolution_tuple(self):
        """Return resolution as tuple (width, height)"""
        resolutions = {
            '480p': (854, 480),
            '720p': (1280, 720),
            '1080p': (1920, 1080),
            '4k': (3840, 2160),
        }
        return resolutions.get(self.resolution, (1920, 1080))
    
    @property
    def file_size_mb(self):
        """Return file size in MB"""
        if self.file_size:
            return round(self.file_size / (1024 * 1024), 2)
        return 0


class SavedVideo(models.Model):
    """User's saved/favorite videos"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_videos')
    video_generation = models.ForeignKey(VideoGeneration, on_delete=models.CASCADE, null=True, blank=True)
    
    title = models.CharField(max_length=200)
    video_file = models.FileField(upload_to=generated_video_path)
    thumbnail = models.ImageField(upload_to=thumbnail_path, blank=True, null=True)
    prompt = models.TextField(blank=True, null=True)
    duration = models.IntegerField(default=0)
    
    is_favorite = models.BooleanField(default=False)
    download_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"


class VideoPromptTemplate(models.Model):
    """Pre-defined prompt templates for video generation"""
    
    CATEGORY_CHOICES = [
        ('social_media', 'Social Media'),
        ('marketing', 'Marketing/Ads'),
        ('product', 'Product Demo'),
        ('intro_outro', 'Intro/Outro'),
        ('background', 'Background/Loop'),
        ('tutorial', 'Tutorial'),
        ('storytelling', 'Storytelling'),
        ('music_visual', 'Music Visual'),
        ('nature', 'Nature/Landscape'),
        ('abstract', 'Abstract/Art'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_templates', null=True, blank=True)
    is_global = models.BooleanField(default=False, help_text="Available to all users")
    
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    prompt_template = models.TextField(help_text="Use {subject}, {style}, {action} as placeholders")
    negative_prompt = models.TextField(blank=True, null=True)
    recommended_style = models.CharField(max_length=30, choices=VideoGeneration.STYLE_CHOICES, default='cinematic')
    recommended_duration = models.IntegerField(choices=VideoGeneration.DURATION_CHOICES, default=5)
    recommended_aspect_ratio = models.CharField(max_length=10, choices=VideoGeneration.ASPECT_RATIO_CHOICES, default='16:9')
    
    preview_thumbnail = models.ImageField(upload_to='video_templates/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['category', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category})"
