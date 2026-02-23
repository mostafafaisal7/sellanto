from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import json


class Post(models.Model):
    """Scheduled social media posts"""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Approval'),
        ('changes_requested', 'Changes Requested'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('scheduled', 'Scheduled'),
        ('posting', 'Posting'),
        ('posted', 'Posted'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    GOAL_CHOICES = [
        ('leads', 'Lead Generation'),
        ('growth', 'Audience Growth'),
        ('authority', 'Thought Leadership'),
    ]

    FORMAT_TYPE_CHOICES = [
        ('static', 'Static Image'),
        ('carousel', 'Carousel'),
        ('reel', 'Reel/Short'),
        ('thread', 'Thread'),
        ('story', 'Story'),
        ('text', 'Text Only'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')

    # Content
    caption = models.TextField(help_text='Post caption/text')
    ai_generated = models.BooleanField(default=False, help_text='Was caption AI-generated?')

    # Media files
    media_files = models.TextField(default='[]', help_text='JSON array of media file paths')

    # Scheduling
    scheduled_time = models.DateTimeField(help_text='When to post')
    timezone = models.CharField(max_length=50, default='UTC')

    # Platforms (JSON array)
    platforms = models.TextField(default='[]', help_text='JSON array of platforms to post to')

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    # V1.2.1 - Draft/Strategy fields
    idea = models.ForeignKey(
        'brands.ContentIdea', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='drafts'
    )
    brand = models.ForeignKey(
        'brands.Brand', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='posts'
    )
    pillar = models.ForeignKey(
        'brands.ContentPillar', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='posts'
    )
    hook = models.TextField(blank=True, help_text='Post hook text')
    angle = models.CharField(max_length=300, blank=True)
    format_type = models.CharField(max_length=20, choices=FORMAT_TYPE_CHOICES, blank=True)
    cta_text = models.CharField(max_length=300, blank=True, help_text='Call-to-action text')
    goal = models.CharField(max_length=20, choices=GOAL_CHOICES, blank=True)

    # V1.2.1 - Checklist & Approval tracking
    checklist_status = models.JSONField(
        default=dict, blank=True,
        help_text='{"caption": true, "hashtags": false, "creative": false, "alt_text": false, "platform_mapping": false}'
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    # Platform-specific post IDs
    facebook_post_id = models.CharField(max_length=200, blank=True, null=True)
    twitter_post_id = models.CharField(max_length=200, blank=True, null=True)
    instagram_post_id = models.CharField(max_length=200, blank=True, null=True)
    linkedin_post_id = models.CharField(max_length=200, blank=True, null=True)
    tiktok_post_id = models.CharField(max_length=200, blank=True, null=True)
    youtube_post_id = models.CharField(max_length=200, blank=True, null=True)
    pinterest_post_id = models.CharField(max_length=200, blank=True, null=True)
    telegram_post_id = models.CharField(max_length=200, blank=True, null=True)
    
    # Platform-specific errors
    facebook_error = models.TextField(blank=True, null=True)
    twitter_error = models.TextField(blank=True, null=True)
    instagram_error = models.TextField(blank=True, null=True)
    linkedin_error = models.TextField(blank=True, null=True)
    tiktok_error = models.TextField(blank=True, null=True)
    youtube_error = models.TextField(blank=True, null=True)
    pinterest_error = models.TextField(blank=True, null=True)
    telegram_error = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    posted_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = 'posts'
        verbose_name = 'Post'
        verbose_name_plural = 'Posts'
        ordering = ['-scheduled_time']
    
    def __str__(self):
        caption_preview = self.caption[:50] + '...' if len(self.caption) > 50 else self.caption
        return f"{self.user.username} - {caption_preview} ({self.status})"
    
    @property
    def platforms_list(self):
        """Get platforms as list"""
        try:
            return json.loads(self.platforms)
        except:
            return []
    
    def set_platforms(self, platforms):
        """Set platforms from list"""
        self.platforms = json.dumps(platforms)
    
    @property
    def media_files_list(self):
        """Get media files as list"""
        try:
            return json.loads(self.media_files)
        except:
            return []
    
    def set_media_files(self, files):
        """Set media files from list"""
        self.media_files = json.dumps(files)
    
    def is_scheduled_for_future(self):
        """Check if post is scheduled for future"""
        return self.scheduled_time > timezone.now()
    
    def can_be_edited(self):
        """Check if post can be edited"""
        return self.status in ['draft', 'scheduled', 'changes_requested']
    
    def can_be_cancelled(self):
        """Check if post can be cancelled"""
        return self.status in ['scheduled']
    
    def mark_as_posted(self):
        """Mark post as successfully posted"""
        self.status = 'posted'
        self.posted_at = timezone.now()
        self.save()
    
    def mark_as_failed(self):
        """Mark post as failed"""
        self.status = 'failed'
        self.save()
    
    def get_success_platforms(self):
        """Get list of platforms where post was successful"""
        successful = []
        if self.facebook_post_id: successful.append('facebook')
        if self.twitter_post_id: successful.append('twitter')
        if self.instagram_post_id: successful.append('instagram')
        if self.linkedin_post_id: successful.append('linkedin')
        if self.tiktok_post_id: successful.append('tiktok')
        if self.youtube_post_id: successful.append('youtube')
        if self.pinterest_post_id: successful.append('pinterest')
        if self.telegram_post_id: successful.append('telegram')
        return successful
    
    def get_failed_platforms(self):
        """Get list of platforms where post failed"""
        failed = []
        if self.facebook_error: failed.append('facebook')
        if self.twitter_error: failed.append('twitter')
        if self.instagram_error: failed.append('instagram')
        if self.linkedin_error: failed.append('linkedin')
        if self.tiktok_error: failed.append('tiktok')
        if self.youtube_error: failed.append('youtube')
        if self.pinterest_error: failed.append('pinterest')
        if self.telegram_error: failed.append('telegram')
        return failed

    def update_checklist(self):
        """Auto-update checklist based on related objects"""
        status = {
            'caption': self.captions.filter(is_selected=True).exists(),
            'hashtags': self.hashtags.filter(is_selected=True).exists(),
            'creative': bool(self.media_files_list) or self.creative_assets.exists(),
            'alt_text': not self.creative_assets.filter(alt_text='').exists() if self.creative_assets.exists() else not bool(self.media_files_list),
            'platform_mapping': bool(self.platforms_list),
        }
        self.checklist_status = status
        self.save(update_fields=['checklist_status'])
        return status

    @property
    def is_checklist_complete(self):
        """Check if all required checklist items are complete"""
        required = ['caption', 'platform_mapping']
        return all(self.checklist_status.get(k, False) for k in required)


# ============================================================
# V1.2.1 NEW MODELS - Captions, Hashtags, Scheduling
# ============================================================

class PostCaption(models.Model):
    """Platform-optimized caption variants with A/B tagging"""

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('all', 'All Platforms'),
    ]

    AB_LABEL_CHOICES = [
        ('A', 'Variant A'),
        ('B', 'Variant B'),
    ]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='captions')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='all')
    variant_number = models.IntegerField(default=1)
    body = models.TextField()
    cta_text = models.CharField(max_length=300, blank=True)
    tone = models.CharField(max_length=100, blank=True)
    char_count = models.IntegerField(default=0)
    is_selected = models.BooleanField(default=False)
    is_ab_test = models.BooleanField(default=False)
    ab_label = models.CharField(max_length=1, choices=AB_LABEL_CHOICES, blank=True, null=True)
    generation_prompt_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Platform character limits
    PLATFORM_CHAR_LIMITS = {
        'twitter': 280,
        'linkedin': 3000,
        'facebook': 63206,
        'instagram': 2200,
    }

    class Meta:
        db_table = 'post_captions'
        verbose_name = 'Post Caption'
        verbose_name_plural = 'Post Captions'
        ordering = ['variant_number']

    def __str__(self):
        return f"Caption #{self.variant_number} ({self.platform}) - Post #{self.post.id}"

    def save(self, *args, **kwargs):
        self.char_count = len(self.body)
        super().save(*args, **kwargs)

    @property
    def is_within_limit(self):
        limit = self.PLATFORM_CHAR_LIMITS.get(self.platform)
        if limit:
            return self.char_count <= limit
        return True

    @property
    def char_status(self):
        """Returns green/yellow/red based on character count vs platform limit"""
        limit = self.PLATFORM_CHAR_LIMITS.get(self.platform)
        if not limit:
            return 'green'
        ratio = self.char_count / limit
        if ratio > 1:
            return 'red'
        elif ratio > 0.85:
            return 'yellow'
        return 'green'


class PostHashtag(models.Model):
    """Generated hashtags organized by reach tier"""

    TIER_CHOICES = [
        ('high_volume', 'High Volume (Reach)'),
        ('mid_volume', 'Mid Volume (Relevance)'),
        ('niche', 'Niche (Authority)'),
    ]

    PLACEMENT_CHOICES = [
        ('inline', 'Inline in Caption'),
        ('end_of_caption', 'End of Caption'),
        ('first_comment', 'First Comment (Instagram)'),
    ]

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    ]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='hashtags')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    tag = models.CharField(max_length=200, help_text='Hashtag without #')
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='mid_volume')
    estimated_volume = models.IntegerField(default=0)
    is_selected = models.BooleanField(default=True)
    placement = models.CharField(max_length=20, choices=PLACEMENT_CHOICES, default='end_of_caption')
    created_at = models.DateTimeField(auto_now_add=True)

    # Default hashtag counts per platform
    PLATFORM_DEFAULTS = {
        'instagram': {'default': 20, 'max': 30},
        'linkedin': {'default': 5, 'max': 10},
        'twitter': {'default': 3, 'max': 5},
        'facebook': {'default': 3, 'max': 5},
    }

    class Meta:
        db_table = 'post_hashtags'
        verbose_name = 'Post Hashtag'
        verbose_name_plural = 'Post Hashtags'
        ordering = ['tier', 'tag']

    def __str__(self):
        return f"#{self.tag} ({self.tier}) - {self.platform}"


class HashtagGroup(models.Model):
    """Reusable saved hashtag sets per brand"""

    brand = models.ForeignKey('brands.Brand', on_delete=models.CASCADE, related_name='hashtag_groups')
    name = models.CharField(max_length=100)
    tags = models.JSONField(default=list, help_text='Array of hashtag strings')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hashtag_groups')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hashtag_groups'
        verbose_name = 'Hashtag Group'
        verbose_name_plural = 'Hashtag Groups'

    def __str__(self):
        return f"{self.name} ({len(self.tags)} tags) - {self.brand.brand_name}"


class BannedHashtag(models.Model):
    """Brand-level banned hashtags"""

    brand = models.ForeignKey('brands.Brand', on_delete=models.CASCADE, related_name='banned_hashtags')
    tag = models.CharField(max_length=200, help_text='Hashtag without #')
    reason = models.CharField(max_length=300, blank=True)
    added_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='banned_hashtags')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'banned_hashtags'
        verbose_name = 'Banned Hashtag'
        verbose_name_plural = 'Banned Hashtags'
        unique_together = ['brand', 'tag']

    def __str__(self):
        return f"#{self.tag} (banned) - {self.brand.brand_name}"


class ScheduledPostPlatform(models.Model):
    """Per-platform scheduling with caption and asset mapping"""

    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('publishing', 'Publishing'),
        ('published', 'Published'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    ]

    HASHTAG_PLACEMENT_CHOICES = [
        ('inline', 'Inline'),
        ('end_of_caption', 'End of Caption'),
        ('first_comment', 'First Comment'),
    ]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='scheduled_platforms')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    caption = models.ForeignKey(PostCaption, on_delete=models.SET_NULL, null=True, blank=True)
    hashtag_placement = models.CharField(max_length=20, choices=HASHTAG_PLACEMENT_CHOICES, default='end_of_caption')
    scheduled_at = models.DateTimeField()
    timezone = models.CharField(max_length=50, default='UTC')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    asset_variant = models.ForeignKey(
        'ai_image.AssetPlatformVariant', on_delete=models.SET_NULL,
        null=True, blank=True, help_text='Platform-specific resized creative asset',
    )
    publish_result_json = models.JSONField(default=dict, blank=True)
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scheduled_platform_posts')
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'scheduled_post_platforms'
        verbose_name = 'Scheduled Post Platform'
        verbose_name_plural = 'Scheduled Post Platforms'
        ordering = ['scheduled_at']

    def __str__(self):
        return f"Post #{self.post.id} → {self.platform} at {self.scheduled_at}"