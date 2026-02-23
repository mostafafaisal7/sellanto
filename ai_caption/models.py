# ai_caption/models.py

from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
import os
import uuid
import base64
import hashlib


def get_encryption_key():
    """Generate a consistent encryption key from Django's SECRET_KEY"""
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key)


class UserAPISettings(models.Model):
    """Store user's API keys securely"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='api_settings')
    
    # Encrypted API key storage (simple base64 encoding for now)
    _openai_api_key = models.TextField(blank=True, null=True, db_column='openai_api_key')
    
    # Settings
    default_model = models.CharField(max_length=50, default='gpt-4o', choices=[
        ('gpt-4o', 'GPT-4o (Best Quality)'),
        ('gpt-4o-mini', 'GPT-4o Mini (Faster & Cheaper)'),
        ('gpt-4-turbo', 'GPT-4 Turbo'),
    ])
    
    # Usage tracking
    total_tokens_used = models.IntegerField(default=0)
    total_generations = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User API Settings"
        verbose_name_plural = "User API Settings"
    
    def __str__(self):
        return f"API Settings - {self.user.username}"
    
    def set_openai_api_key(self, api_key):
        """Encode and store the API key"""
        if api_key:
            # Simple base64 encoding (use cryptography.fernet for production)
            encoded = base64.b64encode(api_key.encode()).decode()
            self._openai_api_key = encoded
        else:
            self._openai_api_key = None
    
    def get_openai_api_key(self):
        """Decode and return the API key"""
        if self._openai_api_key:
            try:
                decoded = base64.b64decode(self._openai_api_key.encode()).decode()
                return decoded
            except Exception:
                return None
        return None
    
    @property
    def openai_api_key(self):
        """Get the decoded API key"""
        return self.get_openai_api_key()

    @openai_api_key.setter
    def openai_api_key(self, value):
        """Set the API key (will be encoded)"""
        self.set_openai_api_key(value)

    @property
    def has_api_key(self):
        """Check if user has set an API key"""
        return bool(self._openai_api_key)

    @property
    def masked_api_key(self):
        """Return masked version of API key for display"""
        key = self.get_openai_api_key()
        if key and len(key) > 8:
            return f"{key[:7]}...{key[-4:]}"
        return None


def caption_media_path(instance, filename):
    """Generate unique path for uploaded media"""
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f"caption_media/{instance.user.id}/{new_filename}"


class CaptionGeneration(models.Model):
    """Store generated captions history"""
    
    TONE_CHOICES = [
        ('professional', 'Professional'),
        ('casual', 'Casual'),
        ('friendly', 'Friendly'),
        ('enthusiastic', 'Enthusiastic'),
        ('humorous', 'Humorous'),
        ('inspirational', 'Inspirational'),
        ('formal', 'Formal'),
        ('conversational', 'Conversational'),
    ]
    
    LENGTH_CHOICES = [
        ('short', 'Short (20-40 words)'),
        ('medium', 'Medium (40-80 words)'),
        ('long', 'Long (80-120 words)'),
        ('extra_long', 'Extra Long (120-200 words)'),
    ]
    
    PLATFORM_CHOICES = [
        ('general', 'General'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('tiktok', 'TikTok'),
        ('youtube', 'YouTube'),
        ('pinterest', 'Pinterest'),
    ]
    
    MEDIA_TYPE_CHOICES = [
        ('none', 'Text Only'),
        ('image', 'Image'),
        ('video', 'Video'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='caption_generations')
    
    # Input
    input_text = models.TextField(blank=True, null=True, help_text="Topic or text to generate caption from")
    media_file = models.FileField(upload_to=caption_media_path, blank=True, null=True)
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES, default='none')
    
    # Settings
    tone = models.CharField(max_length=20, choices=TONE_CHOICES, default='professional')
    length = models.CharField(max_length=20, choices=LENGTH_CHOICES, default='medium')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='general')
    include_hashtags = models.BooleanField(default=True)
    include_emojis = models.BooleanField(default=True)
    include_cta = models.BooleanField(default=True, verbose_name="Include Call-to-Action")
    custom_instructions = models.TextField(blank=True, null=True, help_text="Additional instructions for AI")
    
    # Output
    generated_caption = models.TextField(blank=True, null=True)
    generated_hashtags = models.TextField(blank=True, null=True)
    media_analysis = models.TextField(blank=True, null=True, help_text="AI analysis of the media")
    
    # Metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    tokens_used = models.IntegerField(default=0)
    processing_time = models.FloatField(default=0, help_text="Processing time in seconds")
    model_used = models.CharField(max_length=50, default='gpt-4o')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Caption Generation"
        verbose_name_plural = "Caption Generations"
    
    def __str__(self):
        if self.input_text:
            return f"{self.input_text[:50]}... - {self.user.username}"
        elif self.media_file:
            return f"Media Caption - {self.user.username}"
        return f"Caption #{self.id} - {self.user.username}"
    
    def get_media_filename(self):
        if self.media_file:
            return os.path.basename(self.media_file.name)
        return None
    
    def is_image(self):
        if self.media_file:
            ext = self.media_file.name.lower().split('.')[-1]
            return ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
        return False
    
    def is_video(self):
        if self.media_file:
            ext = self.media_file.name.lower().split('.')[-1]
            return ext in ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v']
        return False


class CaptionTemplate(models.Model):
    """Pre-defined caption templates"""
    
    CATEGORY_CHOICES = [
        ('product', 'Product Launch'),
        ('promotion', 'Promotion/Sale'),
        ('event', 'Event'),
        ('announcement', 'Announcement'),
        ('engagement', 'Engagement'),
        ('educational', 'Educational'),
        ('behind_scenes', 'Behind the Scenes'),
        ('testimonial', 'Testimonial'),
        ('holiday', 'Holiday'),
        ('motivational', 'Motivational'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='caption_templates', null=True, blank=True)
    is_global = models.BooleanField(default=False, help_text="Available to all users")
    
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    template_text = models.TextField(help_text="Use {topic}, {brand}, {product} as placeholders")
    tone = models.CharField(max_length=20, choices=CaptionGeneration.TONE_CHOICES, default='professional')
    platform = models.CharField(max_length=20, choices=CaptionGeneration.PLATFORM_CHOICES, default='general')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['category', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category})"


class SavedCaption(models.Model):
    """User's saved/favorite captions"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_captions')
    caption_generation = models.ForeignKey(CaptionGeneration, on_delete=models.CASCADE, null=True, blank=True)
    
    caption_text = models.TextField()
    hashtags = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    is_favorite = models.BooleanField(default=False)
    used_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.caption_text[:50]}..."