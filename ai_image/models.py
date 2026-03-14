# ai_image/models.py

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
    return f"user_logos/{instance.user.id}/{new_filename}"


def generated_image_path(instance, filename):
    """Generate unique path for generated images"""
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return f"generated_images/{instance.user.id}/{new_filename}"


class UserImageSettings(models.Model):
    """Store user's API keys and settings for image generation"""
    
    PROVIDER_CHOICES = [
        ('gemini', 'Google Gemini'),
        ('openai', 'OpenAI DALL-E'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='image_settings')
    
    # API Keys (base64 encoded)
    _gemini_api_key = models.TextField(blank=True, null=True, db_column='gemini_api_key')
    _openai_api_key = models.TextField(blank=True, null=True, db_column='openai_api_key')
    
    # Default provider
    default_provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='openai')
    
    # Default settings
    default_style = models.CharField(max_length=50, default='realistic', choices=[
        ('realistic', 'Realistic'),
        ('artistic', 'Artistic'),
        ('anime', 'Anime/Manga'),
        ('cartoon', 'Cartoon'),
        ('3d_render', '3D Render'),
        ('watercolor', 'Watercolor'),
        ('oil_painting', 'Oil Painting'),
        ('digital_art', 'Digital Art'),
        ('pixel_art', 'Pixel Art'),
        ('sketch', 'Sketch/Drawing'),
    ])
    
    default_size = models.CharField(max_length=20, default='1024x1024', choices=[
        ('512x512', '512x512 (Small)'),
        ('768x768', '768x768 (Medium)'),
        ('1024x1024', '1024x1024 (Large)'),
        ('1024x576', '1024x576 (Landscape)'),
        ('576x1024', '576x1024 (Portrait)'),
        ('1792x1024', '1792x1024 (Wide)'),
        ('1024x1792', '1024x1792 (Tall)'),
    ])
    
    # OpenAI specific settings
    openai_model = models.CharField(max_length=50, default='gpt-image-1.5', choices=[
        ('gpt-image-1.5', 'GPT Image 1.5 (Best)'),
        ('dall-e-3', 'DALL-E 3'),
        ('dall-e-2', 'DALL-E 2 (Faster)'),
    ])
    openai_quality = models.CharField(max_length=20, default='standard', choices=[
        ('standard', 'Standard'),
        ('hd', 'HD (Higher Detail)'),
    ])
    
    # Usage tracking
    total_images_generated = models.IntegerField(default=0)
    total_api_calls = models.IntegerField(default=0)
    openai_images_generated = models.IntegerField(default=0)
    gemini_images_generated = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Image Settings"
        verbose_name_plural = "User Image Settings"
        db_table = 'ai_image_userimagesettings'
    
    def __str__(self):
        return f"Image Settings - {self.user.username}"
    
    # Gemini API Key methods
    def set_gemini_api_key(self, api_key):
        if api_key:
            encoded = base64.b64encode(api_key.encode()).decode()
            self._gemini_api_key = encoded
        else:
            self._gemini_api_key = None
    
    def get_gemini_api_key(self):
        if self._gemini_api_key:
            try:
                return base64.b64decode(self._gemini_api_key.encode()).decode()
            except:
                return None
        return None
    
    # OpenAI API Key methods
    def set_openai_api_key(self, api_key):
        if api_key:
            encoded = base64.b64encode(api_key.encode()).decode()
            self._openai_api_key = encoded
        else:
            self._openai_api_key = None
    
    def get_openai_api_key(self):
        if self._openai_api_key:
            try:
                return base64.b64decode(self._openai_api_key.encode()).decode()
            except:
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
    def openai_api_key(self):
        """Get the decoded OpenAI API key"""
        return self.get_openai_api_key()

    @openai_api_key.setter
    def openai_api_key(self, value):
        """Set the OpenAI API key (will be encoded)"""
        self.set_openai_api_key(value)

    @property
    def has_gemini_key(self):
        return bool(self._gemini_api_key)

    @property
    def has_openai_key(self):
        return bool(self._openai_api_key)
    
    @property
    def has_api_key(self):
        """Check if user has at least one API key"""
        return self.has_gemini_key or self.has_openai_key
    
    @property
    def masked_gemini_key(self):
        key = self.get_gemini_api_key()
        if key and len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return None
    
    @property
    def masked_openai_key(self):
        key = self.get_openai_api_key()
        if key and len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return None
    
    def get_available_providers(self):
        """Return list of available providers based on configured API keys"""
        providers = []
        if self.has_openai_key:
            providers.append(('openai', 'OpenAI DALL-E'))
        if self.has_gemini_key:
            providers.append(('gemini', 'Google Gemini'))
        return providers


class UserLogo(models.Model):
    """Store user's uploaded logos"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='logos')
    name = models.CharField(max_length=100)
    logo_file = models.ImageField(upload_to=logo_upload_path)
    is_default = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_default', '-created_at']
        db_table = 'ai_image_userlogo'
    
    def __str__(self):
        return f"{self.name} - {self.user.username}"
    
    def save(self, *args, **kwargs):
        if self.is_default:
            UserLogo.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)


class ImageGeneration(models.Model):
    """Store generated images history"""
    
    PROVIDER_CHOICES = [
        ('gemini', 'Google Gemini'),
        ('openai', 'OpenAI DALL-E'),
    ]
    
    STYLE_CHOICES = [
        ('realistic', 'Realistic'),
        ('artistic', 'Artistic'),
        ('anime', 'Anime/Manga'),
        ('cartoon', 'Cartoon'),
        ('3d_render', '3D Render'),
        ('watercolor', 'Watercolor'),
        ('oil_painting', 'Oil Painting'),
        ('digital_art', 'Digital Art'),
        ('pixel_art', 'Pixel Art'),
        ('sketch', 'Sketch/Drawing'),
        ('cinematic', 'Cinematic'),
        ('fantasy', 'Fantasy'),
        ('minimalist', 'Minimalist'),
        ('vintage', 'Vintage/Retro'),
        ('neon', 'Neon/Cyberpunk'),
        ('vivid', 'Vivid'),
        ('natural', 'Natural'),
    ]
    
    SIZE_CHOICES = [
        ('256x256', '256x256'),
        ('512x512', '512x512'),
        ('768x768', '768x768'),
        ('1024x1024', '1024x1024'),
        ('1024x576', '1024x576 (Landscape)'),
        ('576x1024', '576x1024 (Portrait)'),
        ('1792x1024', '1792x1024 (Wide)'),
        ('1024x1792', '1024x1792 (Tall)'),
        ('1920x1080', '1920x1080 (Full HD)'),
        ('1080x1920', '1080x1920 (Story)'),
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
    
    QUALITY_CHOICES = [
        ('standard', 'Standard'),
        ('high', 'High Quality'),
        ('hd', 'HD'),
        ('ultra', 'Ultra HD'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    PRODUCT_POSITION_CHOICES = [
        ('center', 'Center'),
        ('center_bottom', 'Center Bottom'),
        ('left', 'Left'),
        ('right', 'Right'),
        ('center_top', 'Center Top'),
        ('full', 'Full Frame'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='image_generations')

    # V1.2.1 - Link to post/draft
    post = models.ForeignKey('posts.Post', on_delete=models.SET_NULL, null=True, blank=True, related_name='creative_assets')
    alt_text = models.TextField(blank=True, help_text='Accessibility alt text (max 125 chars)')
    version = models.IntegerField(default=1)
    is_current = models.BooleanField(default=True, help_text='Is this the current version?')
    brand_template = models.ForeignKey('brands.BrandTemplate', on_delete=models.SET_NULL, null=True, blank=True)

    # Provider
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='openai')
    model_used = models.CharField(max_length=50, blank=True, null=True)
    
    # Input
    title = models.CharField(max_length=200, help_text="Title for the image")
    prompt = models.TextField(help_text="Detailed description for image generation")
    negative_prompt = models.TextField(blank=True, null=True, help_text="What to avoid in the image")
    
    # Style Settings
    style = models.CharField(max_length=30, choices=STYLE_CHOICES, default='realistic')
    size = models.CharField(max_length=20, choices=SIZE_CHOICES, default='1024x1024')
    quality = models.CharField(max_length=20, choices=QUALITY_CHOICES, default='high')
    
    # Logo Settings (legacy UserLogo — kept for backward compat)
    logo = models.ForeignKey(UserLogo, on_delete=models.SET_NULL, null=True, blank=True)
    # Brand logo from BrandAsset (new mandatory system)
    brand_logo = models.ForeignKey('brands.BrandAsset', on_delete=models.SET_NULL, null=True, blank=True, related_name='image_generations')
    logo_position = models.CharField(max_length=20, choices=LOGO_POSITION_CHOICES, default='bottom_right')
    logo_size = models.IntegerField(default=10, help_text="Logo size as percentage of image (5-30)")
    logo_opacity = models.IntegerField(default=100, help_text="Logo opacity (10-100)")
    
    # Product Image Upload & Compositing
    product_image = models.ImageField(upload_to='product_uploads/', blank=True, null=True, help_text="Upload product image for compositing")
    product_position = models.CharField(max_length=20, choices=PRODUCT_POSITION_CHOICES, default='center', help_text="Product placement in scene")
    product_scale = models.IntegerField(default=50, help_text="Product size as percentage (20-90)")
    composited_image = models.ImageField(upload_to=generated_image_path, blank=True, null=True, help_text="Final composited image with product")

    # Copy Overlay (post-generation Pillow overlay)
    copy_overlay_image = models.ImageField(upload_to=generated_image_path, blank=True, null=True, help_text="Image with copy text overlay applied")
    copy_overlay_text = models.CharField(max_length=200, blank=True, default='', help_text="The copy text overlaid on the image")
    copy_overlay_settings = models.JSONField(blank=True, null=True, help_text="Overlay styling settings (position, font, color, etc.)")

    # With Copy (AI-rendered copy text in generated image)
    with_copy = models.BooleanField(default=False, help_text="Whether copy text was rendered in the image by AI")
    copy_text_in_image = models.CharField(max_length=500, blank=True, default='', help_text="Copy text rendered within the generated image")
    sibling_generation = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sibling', help_text="Linked variation when with_copy=true")

    # Advanced Options
    seed = models.IntegerField(blank=True, null=True, help_text="Seed for reproducibility")
    enhance_prompt = models.BooleanField(default=True, help_text="AI-enhance the prompt")
    add_lighting = models.CharField(max_length=50, blank=True, null=True, choices=[
        ('', 'Default'),
        ('natural', 'Natural Light'),
        ('studio', 'Studio Lighting'),
        ('dramatic', 'Dramatic'),
        ('soft', 'Soft/Diffused'),
        ('golden_hour', 'Golden Hour'),
        ('neon', 'Neon Lights'),
        ('backlit', 'Backlit'),
    ])
    camera_angle = models.CharField(max_length=50, blank=True, null=True, choices=[
        ('', 'Default'),
        ('front', 'Front View'),
        ('side', 'Side View'),
        ('aerial', 'Aerial/Bird\'s Eye'),
        ('low_angle', 'Low Angle'),
        ('high_angle', 'High Angle'),
        ('closeup', 'Close-up'),
        ('wide', 'Wide Shot'),
        ('macro', 'Macro'),
    ])
    
    # Prompt Engineering metadata
    brand_style_anchor = models.TextField(blank=True, null=True, help_text="Reusable brand visual DNA summary")
    prompt_engineering_used = models.BooleanField(default=False, help_text="Whether 9-layer prompt engineering was applied")
    failure_codes = models.JSONField(blank=True, null=True, help_text="Failure taxonomy codes e.g. ['C1','L2']")
    reprompt_attempt = models.IntegerField(default=0, help_text="Re-prompt attempt number (max 3)")

    # Output
    generated_image = models.ImageField(upload_to=generated_image_path, blank=True, null=True)
    generated_image_with_logo = models.ImageField(upload_to=generated_image_path, blank=True, null=True)
    enhanced_prompt = models.TextField(blank=True, null=True, help_text="AI-enhanced prompt used")
    revised_prompt = models.TextField(blank=True, null=True, help_text="OpenAI revised prompt")
    
    # Metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    processing_time = models.FloatField(default=0, help_text="Processing time in seconds")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Image Generation"
        verbose_name_plural = "Image Generations"
        db_table = 'ai_image_imagegeneration'
    
    def __str__(self):
        return f"{self.title} - {self.user.username} ({self.provider})"
    
    def get_display_image(self):
        if self.copy_overlay_image:
            return self.copy_overlay_image
        if self.composited_image:
            return self.composited_image
        if self.generated_image_with_logo:
            return self.generated_image_with_logo
        return self.generated_image
    
    @property
    def has_product(self):
        return bool(self.product_image)
    
    def get_size_tuple(self):
        parts = self.size.split('x')
        return (int(parts[0]), int(parts[1]))


class SavedImage(models.Model):
    """User's saved/favorite images"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_images')
    image_generation = models.ForeignKey(ImageGeneration, on_delete=models.CASCADE, null=True, blank=True)
    
    title = models.CharField(max_length=200)
    image_file = models.ImageField(upload_to=generated_image_path)
    prompt = models.TextField(blank=True, null=True)
    
    is_favorite = models.BooleanField(default=False)
    download_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'ai_image_savedimage'
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"


class PromptTemplate(models.Model):
    """Pre-defined prompt templates for image generation"""
    
    CATEGORY_CHOICES = [
        ('social_media', 'Social Media'),
        ('marketing', 'Marketing'),
        ('product', 'Product'),
        ('portrait', 'Portrait'),
        ('landscape', 'Landscape'),
        ('abstract', 'Abstract'),
        ('logo_design', 'Logo Design'),
        ('banner', 'Banner/Header'),
        ('illustration', 'Illustration'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='prompt_templates', null=True, blank=True)
    is_global = models.BooleanField(default=False, help_text="Available to all users")
    
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    prompt_template = models.TextField(help_text="Use {subject}, {style}, {color} as placeholders")
    negative_prompt = models.TextField(blank=True, null=True)
    recommended_style = models.CharField(max_length=30, choices=ImageGeneration.STYLE_CHOICES, default='realistic')
    recommended_size = models.CharField(max_length=20, choices=ImageGeneration.SIZE_CHOICES, default='1024x1024')
    
    preview_image = models.ImageField(upload_to='prompt_templates/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['category', 'name']
        db_table = 'ai_image_prompttemplate'
    
    def __str__(self):
        return f"{self.name} ({self.category})"


# ============================================================
# V1.2.1 NEW MODELS - Platform Variants & Version History
# ============================================================

class AssetPlatformVariant(models.Model):
    """Auto-resized asset variants per platform"""

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    ]

    # Platform dimension map
    PLATFORM_DIMENSIONS = {
        'instagram_feed': (1080, 1080),
        'instagram_story': (1080, 1920),
        'instagram_carousel': (1080, 1080),
        'linkedin_feed': (1200, 627),
        'twitter_feed': (1200, 675),
        'facebook_feed': (1200, 630),
        'facebook_story': (1080, 1920),
    }

    asset = models.ForeignKey(ImageGeneration, on_delete=models.CASCADE, related_name='platform_variants')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    format_label = models.CharField(max_length=50, help_text='e.g. feed, story, reel')
    file_url = models.ImageField(upload_to='platform_variants/', blank=True, null=True)
    dimensions = models.CharField(max_length=20, help_text='e.g. 1080x1080')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'asset_platform_variants'
        verbose_name = 'Asset Platform Variant'
        verbose_name_plural = 'Asset Platform Variants'

    def __str__(self):
        return f"{self.platform} {self.format_label} ({self.dimensions})"


class CreativeVersionHistory(models.Model):
    """Track all previous versions of creative assets"""

    asset = models.ForeignKey(ImageGeneration, on_delete=models.CASCADE, related_name='version_history')
    version = models.IntegerField()
    file_url = models.ImageField(upload_to='creative_versions/')
    generation_params = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'creative_version_history'
        verbose_name = 'Creative Version History'
        verbose_name_plural = 'Creative Version Histories'
        ordering = ['-version']

    def __str__(self):
        return f"Asset #{self.asset.id} v{self.version}"
