from django.db import models
from django.contrib.auth.models import User
from posts.models import Post


class Analytics(models.Model):
    """Track engagement metrics for posts (V1.1 legacy)"""

    METRIC_TYPES = [
        ('likes', 'Likes'),
        ('shares', 'Shares'),
        ('comments', 'Comments'),
        ('views', 'Views'),
        ('clicks', 'Clicks'),
        ('impressions', 'Impressions'),
        ('engagement_rate', 'Engagement Rate'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analytics')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='analytics', null=True, blank=True)
    platform = models.CharField(max_length=20)
    metric_type = models.CharField(max_length=30, choices=METRIC_TYPES)
    metric_value = models.IntegerField(default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analytics'
        verbose_name = 'Analytics'
        verbose_name_plural = 'Analytics'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['user', 'platform']),
            models.Index(fields=['post', 'platform']),
        ]

    def __str__(self):
        post_info = f"Post {self.post.id}" if self.post else "Overall"
        return f"{self.user.username} - {self.platform} - {self.metric_type}: {self.metric_value} ({post_info})"


# ============================================================
# V1.2.1 NEW MODELS - Post Analytics, Comments, Learning
# ============================================================

class PostAnalytics(models.Model):
    """Performance metrics snapshots (24h/48h/daily/weekly)"""

    SNAPSHOT_CHOICES = [
        ('24h', '24 Hour Snapshot'),
        ('48h', '48 Hour Snapshot'),
        ('daily', 'Daily Sync'),
        ('weekly', 'Weekly Aggregate'),
    ]

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    ]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_analytics')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    platform_post_id = models.CharField(max_length=200, blank=True)
    snapshot_type = models.CharField(max_length=10, choices=SNAPSHOT_CHOICES)
    impressions = models.IntegerField(default=0)
    reach = models.IntegerField(default=0)
    engagement_rate = models.FloatField(default=0)
    likes = models.IntegerField(default=0)
    comments_count = models.IntegerField(default=0)
    shares = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    saves = models.IntegerField(default=0)
    profile_visits = models.IntegerField(default=0)
    data_json = models.JSONField(default=dict, blank=True, help_text='Platform-specific extra metrics')
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'post_analytics'
        verbose_name = 'Post Analytics'
        verbose_name_plural = 'Post Analytics'
        ordering = ['-fetched_at']
        indexes = [
            models.Index(fields=['post', 'platform', 'snapshot_type']),
        ]

    def __str__(self):
        return f"Post #{self.post.id} - {self.platform} ({self.snapshot_type})"

    @property
    def performance_indicator(self):
        """Returns green/yellow/red based on engagement vs brand average"""
        if self.engagement_rate > 3.0:
            return 'green'
        elif self.engagement_rate > 1.5:
            return 'yellow'
        return 'red'


class PostComment(models.Model):
    """Comment tracking and reply management for published posts"""

    SENTIMENT_CHOICES = [
        ('positive', 'Positive'),
        ('neutral', 'Neutral'),
        ('negative', 'Negative'),
    ]

    REPLY_TYPE_CHOICES = [
        ('ai', 'AI Auto-Reply'),
        ('human', 'Human Reply'),
    ]

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    ]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_comments')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    platform_comment_id = models.CharField(max_length=200, blank=True)
    author_name = models.CharField(max_length=200, blank=True)
    author_handle = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    sentiment = models.CharField(max_length=10, choices=SENTIMENT_CHOICES, default='neutral')
    replied = models.BooleanField(default=False)
    reply_type = models.CharField(max_length=10, choices=REPLY_TYPE_CHOICES, blank=True, null=True)
    reply_body = models.TextField(blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'post_comments'
        verbose_name = 'Post Comment'
        verbose_name_plural = 'Post Comments'
        ordering = ['-fetched_at']

    def __str__(self):
        return f"Comment by {self.author_name} on Post #{self.post.id}"


class LearningSignal(models.Model):
    """Performance-based insights fed back into content generation"""

    SIGNAL_TYPES = [
        ('best_hook', 'Best Performing Hook'),
        ('best_time', 'Best Posting Time'),
        ('best_format', 'Best Content Format'),
        ('best_pillar', 'Best Content Pillar'),
        ('worst_hook', 'Worst Performing Hook'),
        ('worst_time', 'Worst Posting Time'),
        ('worst_format', 'Worst Content Format'),
        ('ab_winner', 'A/B Test Winner'),
        ('winner', 'Winner Post'),
    ]

    brand = models.ForeignKey('brands.Brand', on_delete=models.CASCADE, related_name='learning_signals')
    signal_type = models.CharField(max_length=20, choices=SIGNAL_TYPES)
    reference_id = models.CharField(max_length=100, help_text='Post or caption ID')
    data_json = models.JSONField(default=dict, blank=True)
    applied = models.BooleanField(default=False, help_text='Has this signal been used in generation?')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'learning_signals'
        verbose_name = 'Learning Signal'
        verbose_name_plural = 'Learning Signals'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.signal_type} - {self.brand.brand_name}"


class RepurposedContent(models.Model):
    """Track original-to-repurposed content relationships"""

    REPURPOSE_FORMAT_CHOICES = [
        ('carousel', 'Carousel'),
        ('thread', 'Thread'),
        ('reel', 'Reel'),
        ('email', 'Email'),
        ('blog_outline', 'Blog Outline'),
    ]

    original_post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='repurposed_from')
    new_post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='repurposed_to')
    repurpose_format = models.CharField(max_length=20, choices=REPURPOSE_FORMAT_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'repurposed_content'
        verbose_name = 'Repurposed Content'
        verbose_name_plural = 'Repurposed Content'

    def __str__(self):
        return f"Post #{self.original_post.id} → #{self.new_post.id} ({self.repurpose_format})"