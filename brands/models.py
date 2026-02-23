from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Workspace(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workspaces')
    name = models.CharField(max_length=200)
    timezone = models.CharField(max_length=50, default='UTC')
    team_size = models.IntegerField(null=True, blank=True)
    default_language = models.CharField(max_length=10, default='en')
    max_generations_per_day = models.IntegerField(default=200)
    generations_today = models.IntegerField(default=0)
    generation_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workspaces'
        verbose_name = 'Workspace'
        verbose_name_plural = 'Workspaces'

    def __str__(self):
        return f"{self.name} ({self.owner.username})"

    def reset_daily_generations(self):
        today = timezone.now().date()
        if self.generation_date != today:
            self.generations_today = 0
            self.generation_date = today
            self.save()

    def can_generate(self):
        self.reset_daily_generations()
        return self.generations_today < self.max_generations_per_day

    def increment_generation(self, count=1):
        self.reset_daily_generations()
        self.generations_today += count
        self.save()


class Brand(models.Model):
    GOAL_CHOICES = [
        ('leads', 'Lead Generation'),
        ('growth', 'Audience Growth'),
        ('authority', 'Thought Leadership / Authority'),
    ]

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='brands')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='brands')

    # Basic Info
    brand_name = models.CharField(max_length=200)
    industry = models.CharField(max_length=200)
    target_region = models.CharField(max_length=200)
    website_url = models.URLField(blank=True, null=True)
    social_links = models.JSONField(default=dict, blank=True)

    # Brand Assets
    logo = models.ImageField(upload_to='brands/logos/', blank=True, null=True)
    brand_guide_pdf = models.FileField(upload_to='brands/guides/', blank=True, null=True)

    # Voice & Tone
    voice_tone = models.CharField(max_length=100, default='professional')
    do_dont_rules = models.JSONField(default=dict, blank=True)

    # Goals & Audiences
    goals = models.JSONField(default=list, blank=True)
    audiences = models.JSONField(default=list, blank=True)

    # Brand DNA (generated in Step 5)
    brand_dna = models.JSONField(default=dict, blank=True)
    brand_dna_generated_at = models.DateTimeField(null=True, blank=True)
    brand_dna_source = models.CharField(
        max_length=20, blank=True,
        choices=[('website', 'Website Crawl'), ('pdf', 'Brand Guide PDF'), ('manual', 'Manual')]
    )

    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'brands'
        verbose_name = 'Brand'
        verbose_name_plural = 'Brands'

    def __str__(self):
        return f"{self.brand_name} ({self.workspace.name})"


class BrandAsset(models.Model):
    ASSET_TYPE_CHOICES = [
        ('logo', 'Logo'),
        ('icon', 'Icon'),
        ('banner', 'Banner'),
        ('font', 'Font File'),
        ('color_palette', 'Color Palette'),
        ('template', 'Template'),
        ('document', 'Document'),
        ('other', 'Other'),
    ]

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='assets')
    file = models.FileField(upload_to='brands/assets/')
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'brand_assets'
        verbose_name = 'Brand Asset'
        verbose_name_plural = 'Brand Assets'

    def __str__(self):
        return f"{self.brand.brand_name} - {self.name}"


class LaunchPlan(models.Model):
    VARIANT_LEVEL_CHOICES = [
        ('off', 'Off'),
        ('low', 'Low (1 variant)'),
        ('medium', 'Medium (2 variants)'),
        ('high', 'High (3 variants)'),
    ]

    brand = models.OneToOneField(Brand, on_delete=models.CASCADE, related_name='launch_plan')
    post_frequency = models.IntegerField(default=3, help_text='Posts per week')
    formats_allowed = models.JSONField(default=list, blank=True)
    variant_generation_level = models.CharField(
        max_length=10, choices=VARIANT_LEVEL_CHOICES, default='medium'
    )
    approval_required = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'launch_plans'
        verbose_name = 'Launch Plan'
        verbose_name_plural = 'Launch Plans'

    def __str__(self):
        return f"Launch Plan - {self.brand.brand_name}"


class ContentIdea(models.Model):
    STATUS_CHOICES = [
        ('new', 'New'),
        ('saved', 'Saved'),
        ('skipped', 'Skipped'),
        ('drafted', 'Converted to Draft'),
        ('scheduled', 'Linked to Calendar'),
    ]

    FORMAT_CHOICES = [
        ('text', 'Text Post'),
        ('image', 'Image Post'),
        ('video', 'Video'),
        ('carousel', 'Carousel'),
        ('reel', 'Reel/Short'),
        ('thread', 'Thread'),
        ('story', 'Story'),
    ]

    ENGAGEMENT_TIER_CHOICES = [
        ('low', 'Low'),
        ('mid', 'Mid'),
        ('high', 'High'),
    ]

    SOURCE_CHOICES = [
        ('ai_generated', 'AI Generated'),
        ('trending', 'Trending Topic'),
        ('competitor_inspired', 'Competitor Inspired'),
    ]

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='content_ideas')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='content_ideas')
    title = models.CharField(max_length=300)
    hook = models.TextField(blank=True)
    angle = models.CharField(max_length=300, blank=True)
    platform = models.CharField(max_length=20, blank=True)
    goal = models.CharField(max_length=20, blank=True)
    content_format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='text')
    language = models.CharField(max_length=10, default='en')
    persona = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    post = models.ForeignKey(
        'posts.Post', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='source_ideas'
    )
    batch_id = models.CharField(max_length=50, blank=True)
    generation_run = models.IntegerField(default=1)

    # V1.2.1 new fields
    pillar = models.ForeignKey(
        'ContentPillar', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='ideas'
    )
    engagement_tier = models.CharField(
        max_length=10, choices=ENGAGEMENT_TIER_CHOICES, default='mid'
    )
    source = models.CharField(
        max_length=25, choices=SOURCE_CHOICES, default='ai_generated'
    )
    trending_topic_ref = models.CharField(max_length=500, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    media_preference = models.CharField(
        max_length=10,
        choices=[('none', 'None'), ('image', 'Image'), ('video', 'Video')],
        default='none', blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'content_ideas'
        verbose_name = 'Content Idea'
        verbose_name_plural = 'Content Ideas'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title[:50]} ({self.status})"


class ContentApproval(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('changes_requested', 'Changes Requested'),
        ('rejected', 'Rejected'),
    ]

    post = models.ForeignKey('posts.Post', on_delete=models.CASCADE, related_name='approvals')
    submitted_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='submitted_approvals'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    approver = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_approvals'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    comments = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    compliance_checklist = models.JSONField(default=dict, blank=True)
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'content_approvals'
        verbose_name = 'Content Approval'
        verbose_name_plural = 'Content Approvals'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Approval for Post #{self.post.id} - {self.status}"


class WeeklyReport(models.Model):
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='weekly_reports')
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='weekly_reports', null=True, blank=True)
    period_start = models.DateField()
    period_end = models.DateField()
    data = models.JSONField(default=dict)

    # V1.2.1 structured report fields
    winners = models.JSONField(default=list, blank=True, help_text='Top performing posts [{post_id, metric, value}]')
    losers = models.JSONField(default=list, blank=True, help_text='Bottom performing posts')
    best_hooks = models.JSONField(default=list, blank=True, help_text='Best performing hooks/angles')
    best_times = models.JSONField(default=list, blank=True, help_text='Best posting times')
    pillar_performance = models.JSONField(default=dict, blank=True, help_text='Actual vs target per pillar')
    ab_test_results = models.JSONField(default=list, blank=True, help_text='A/B caption comparison results')
    recommendations = models.JSONField(default=list, blank=True, help_text='LLM-generated recommendations')
    test_plan = models.JSONField(default=list, blank=True, help_text='Next week experiment suggestions')

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'weekly_reports'
        verbose_name = 'Weekly Report'
        verbose_name_plural = 'Weekly Reports'
        ordering = ['-period_end']
        unique_together = ['brand', 'period_start']

    def __str__(self):
        return f"Report: {self.brand.brand_name} ({self.period_start} - {self.period_end})"


class GenerationUsage(models.Model):
    GENERATION_TYPES = [
        ('idea', 'Idea Generation'),
        ('caption', 'Caption Generation'),
        ('image', 'Image Generation'),
        ('video', 'Video Generation'),
        ('brand_dna', 'Brand DNA Generation'),
    ]

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='generation_usage')
    generation_type = models.CharField(max_length=20, choices=GENERATION_TYPES)
    date = models.DateField()
    count = models.IntegerField(default=0)

    class Meta:
        db_table = 'generation_usage'
        unique_together = ['workspace', 'generation_type', 'date']

    def __str__(self):
        return f"{self.workspace.name} - {self.generation_type}: {self.count} ({self.date})"

    @classmethod
    def increment(cls, workspace, gen_type, amount=1):
        today = timezone.now().date()
        obj, _ = cls.objects.get_or_create(
            workspace=workspace,
            generation_type=gen_type,
            date=today,
            defaults={'count': 0}
        )
        obj.count += amount
        obj.save()
        return obj.count


# ============================================================
# V1.2.1 NEW MODELS - Strategy & Content Pillars
# ============================================================

class ContentPillar(models.Model):
    """Content strategy pillars for balanced content calendar"""

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='content_pillars')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    target_percentage = models.IntegerField(default=0, help_text='Target % of content (0-100)')
    color_code = models.CharField(max_length=7, default='#6366F1', help_text='Hex color for UI calendar')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'content_pillars'
        verbose_name = 'Content Pillar'
        verbose_name_plural = 'Content Pillars'
        ordering = ['-target_percentage']

    def __str__(self):
        return f"{self.name} ({self.target_percentage}%) - {self.brand.brand_name}"


class CompetitorProfile(models.Model):
    """Competitor handles/URLs for inspiration and analysis"""

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('website', 'Website'),
    ]

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='competitor_profiles')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    handle_or_url = models.CharField(max_length=500)
    last_crawled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'competitor_profiles'
        verbose_name = 'Competitor Profile'
        verbose_name_plural = 'Competitor Profiles'

    def __str__(self):
        return f"{self.handle_or_url} ({self.platform}) - {self.brand.brand_name}"


class CompetitorInsight(models.Model):
    """Extracted insights from competitor content"""

    competitor_profile = models.ForeignKey(CompetitorProfile, on_delete=models.CASCADE, related_name='insights')
    hook_text = models.TextField()
    angle = models.CharField(max_length=200, blank=True)
    format_type = models.CharField(max_length=50, blank=True)
    engagement_score = models.FloatField(default=0, help_text='Estimated engagement score')
    extracted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'competitor_insights'
        verbose_name = 'Competitor Insight'
        verbose_name_plural = 'Competitor Insights'
        ordering = ['-engagement_score']

    def __str__(self):
        return f"Insight from {self.competitor_profile.handle_or_url}"


class BrandTemplate(models.Model):
    """Brand overlay templates for generated creatives"""

    LOGO_POSITION_CHOICES = [
        ('top_left', 'Top Left'),
        ('top_right', 'Top Right'),
        ('bottom_left', 'Bottom Left'),
        ('bottom_right', 'Bottom Right'),
        ('center', 'Center'),
    ]

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='brand_templates')
    name = models.CharField(max_length=100)
    template_file = models.FileField(upload_to='brands/templates/', blank=True, null=True)
    logo_position = models.CharField(max_length=20, choices=LOGO_POSITION_CHOICES, default='bottom_right')
    font_family = models.CharField(max_length=100, blank=True)
    primary_color = models.CharField(max_length=7, default='#000000')
    secondary_color = models.CharField(max_length=7, default='#FFFFFF')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'brand_templates'
        verbose_name = 'Brand Template'
        verbose_name_plural = 'Brand Templates'

    def __str__(self):
        return f"{self.name} - {self.brand.brand_name}"


class TrendingCache(models.Model):
    """Cached trending topics from platform APIs"""

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('google', 'Google Trends'),
    ]

    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    topic = models.CharField(max_length=500)
    volume_score = models.FloatField(default=0)
    region = models.CharField(max_length=100, default='global')
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, null=True, blank=True, related_name='trending_topics')
    relevance_explanation = models.TextField(blank=True)
    fetched_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'trending_cache'
        verbose_name = 'Trending Cache'
        verbose_name_plural = 'Trending Cache'
        ordering = ['-volume_score']

    def __str__(self):
        return f"{self.topic} ({self.platform}) - score: {self.volume_score}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class ApprovalLog(models.Model):
    """Track all approval state transitions with comments"""

    ACTION_CHOICES = [
        ('submitted', 'Submitted for Approval'),
        ('approved', 'Approved'),
        ('changes_requested', 'Changes Requested'),
        ('rejected', 'Rejected'),
        ('escalated', 'Escalated'),
    ]

    REJECTION_REASON_CHOICES = [
        ('off_brand', 'Off Brand'),
        ('compliance_issue', 'Compliance Issue'),
        ('quality', 'Quality'),
        ('factual_error', 'Factual Error'),
        ('timing', 'Timing'),
        ('other', 'Other'),
    ]

    post = models.ForeignKey('posts.Post', on_delete=models.CASCADE, related_name='approval_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    acted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='approval_actions')
    comment = models.TextField(blank=True)
    rejection_reason = models.CharField(
        max_length=20, choices=REJECTION_REASON_CHOICES, blank=True, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'approval_logs'
        verbose_name = 'Approval Log'
        verbose_name_plural = 'Approval Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"Post #{self.post.id} - {self.action} by {self.acted_by.username}"


class BestTimeSuggestion(models.Model):
    """Optimal posting times per platform based on analytics or industry defaults"""

    SOURCE_CHOICES = [
        ('own_data', 'Own Analytics Data'),
        ('industry_default', 'Industry Default'),
    ]

    PLATFORM_CHOICES = [
        ('twitter', 'Twitter/X'),
        ('linkedin', 'LinkedIn'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
    ]

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='best_time_suggestions')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    day_of_week = models.IntegerField(help_text='0=Monday, 6=Sunday')
    hour_utc = models.IntegerField(help_text='Hour in UTC (0-23)')
    score = models.FloatField(default=0, help_text='Engagement score')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='industry_default')
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'best_time_suggestions'
        verbose_name = 'Best Time Suggestion'
        verbose_name_plural = 'Best Time Suggestions'
        ordering = ['-score']
        unique_together = ['brand', 'platform', 'day_of_week', 'hour_utc']

    def __str__(self):
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        return f"{self.brand.brand_name} - {self.platform} {days[self.day_of_week]} {self.hour_utc}:00"


# ============================================================
# EXISTING V1.1 MODELS (unchanged)
# ============================================================

class BrandDNAChunk(models.Model):
    """Vectorized chunks of website content for Brand DNA RAG"""

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='dna_chunks')
    text = models.TextField()
    chunk_index = models.IntegerField()
    source_url = models.URLField(max_length=2000)
    page_title = models.CharField(max_length=500, blank=True)
    embedding = models.TextField(help_text="JSON array of vector embeddings")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'brand_dna_chunks'
        verbose_name = 'Brand DNA Chunk'
        verbose_name_plural = 'Brand DNA Chunks'
        ordering = ['chunk_index']
        indexes = [
            models.Index(fields=['brand', 'chunk_index']),
        ]

    def __str__(self):
        return f"Chunk {self.chunk_index} - {self.brand.brand_name}"

    def get_embedding(self):
        """Returns embedding as list of floats"""
        import json
        return json.loads(self.embedding)

    def set_embedding(self, embedding_list):
        """Stores embedding as JSON"""
        import json
        self.embedding = json.dumps(embedding_list)


class BrandDNAHistory(models.Model):
    """Historical DNA generations for reuse/rollback"""

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='dna_history')
    dna_data = models.JSONField(default=dict)
    website_url = models.URLField(max_length=2000)
    source = models.CharField(
        max_length=20,
        choices=[('website', 'Website'), ('pdf', 'PDF'), ('manual', 'Manual')],
        default='website'
    )
    is_active = models.BooleanField(default=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'brand_dna_history'
        verbose_name = 'Brand DNA History'
        verbose_name_plural = 'Brand DNA Histories'
        ordering = ['-generated_at']

    def __str__(self):
        return f"DNA v{self.id} - {self.brand.brand_name} ({self.generated_at:%Y-%m-%d})"


class OverflowProgress(models.Model):
    """Tracks user progress through the guided overflow flow"""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='overflow_progress')
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True)
    current_step = models.IntegerField(default=1)
    completed_steps = models.JSONField(default=list, blank=True)

    # Step 1 sub-steps
    dna_completed = models.BooleanField(default=False)
    pillars_completed = models.BooleanField(default=False)
    competitors_completed = models.BooleanField(default=False)
    trending_completed = models.BooleanField(default=False)

    # Step 2 selections
    selected_idea_ids = models.JSONField(default=list, blank=True)
    idea_media_preferences = models.JSONField(default=dict, blank=True)

    # Step 3 selections
    selected_caption_ids = models.JSONField(default=list, blank=True)

    # Step 4 generated media
    generated_media_ids = models.JSONField(default=list, blank=True)

    # Step 5 post
    created_post_id = models.IntegerField(null=True, blank=True)

    is_completed = models.BooleanField(default=False)
    is_skipped = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'overflow_progress'
        verbose_name = 'Overflow Progress'
        verbose_name_plural = 'Overflow Progress'

    def __str__(self):
        return f"Overflow: {self.user.username} - Step {self.current_step} ({'done' if self.is_completed else 'active'})"
