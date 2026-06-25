# accounts/models.py

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta


class SiteConfiguration(models.Model):
    """Store site-wide configuration in database"""
    
    key = models.CharField(max_length=100, unique=True, help_text='Configuration key')
    value = models.TextField(blank=True, help_text='Configuration value')
    description = models.CharField(max_length=255, blank=True, help_text='What this setting does')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'site_configuration'
        verbose_name = 'Site Configuration'
        verbose_name_plural = 'Site Configurations'
        ordering = ['key']
    
    def __str__(self):
        return f"{self.key}: {self.value[:50]}"
    
    @staticmethod
    def get(key, default=''):
        """Get configuration value"""
        try:
            config = SiteConfiguration.objects.get(key=key, is_active=True)
            return config.value
        except SiteConfiguration.DoesNotExist:
            return default
    
    @staticmethod
    def set(key, value, description=''):
        """Set configuration value"""
        config, created = SiteConfiguration.objects.update_or_create(
            key=key,
            defaults={'value': value, 'description': description, 'is_active': True}
        )
        return config


class UserProfile(models.Model):
    """Extended user profile with approval system and API management"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    is_approved = models.BooleanField(default=False, help_text='Admin approval required')
    email_verified = models.BooleanField(
        default=False,
        help_text='Set to True after the user enters the OTP from their welcome email.',
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    company = models.CharField(max_length=200, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    
    # Subscription & Limits
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('starter', 'Starter'),
        ('pro', 'Pro'),
        ('business', 'Business'),
        ('enterprise', 'Enterprise'),
    ]
    subscription_plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    plan_start_date = models.DateField(null=True, blank=True)
    plan_end_date = models.DateField(null=True, blank=True)
    plan_duration_months = models.IntegerField(default=1, help_text='Plan duration in months')
    
    # Limits
    max_social_accounts = models.IntegerField(default=3)
    max_posts_per_month = models.IntegerField(default=30)
    posts_this_month = models.IntegerField(default=0)
    max_captions_per_month = models.IntegerField(default=50)
    captions_this_month = models.IntegerField(default=0)
    max_videos_per_month = models.IntegerField(default=10)
    videos_this_month = models.IntegerField(default=0)
    max_images_per_month = models.IntegerField(default=20)
    images_this_month = models.IntegerField(default=0)
    max_messenger_messages = models.IntegerField(default=500)
    messenger_messages_this_month = models.IntegerField(default=0)
    
    # API Settings - Admin can provide or let user setup
    API_MODE_CHOICES = [
        ('admin', 'Admin Provided'),
        ('user', 'User Provided'),
    ]
    api_mode = models.CharField(max_length=20, choices=API_MODE_CHOICES, default='user')
    
    # Admin provided API keys (stored for admin-provided mode)
    admin_openai_key = models.TextField(blank=True, null=True, help_text='Admin provided OpenAI key')
    admin_gemini_key = models.TextField(blank=True, null=True, help_text='Admin provided Gemini key')
    
    # Token usage tracking
    total_openai_tokens_used = models.BigIntegerField(default=0)
    total_gemini_tokens_used = models.BigIntegerField(default=0)
    openai_tokens_this_month = models.BigIntegerField(default=0)
    gemini_tokens_this_month = models.BigIntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_activity = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_profiles'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
    
    def __str__(self):
        return f"{self.user.username} - {'Approved' if self.is_approved else 'Pending'}"
    
    @property
    def is_admin(self):
        return self.user.is_staff or self.user.is_superuser
    
    @property
    def is_plan_active(self):
        """Check if user's plan is still active"""
        if not self.plan_end_date:
            return True
        return self.plan_end_date >= timezone.now().date()
    
    @property
    def days_remaining(self):
        """Calculate remaining days in plan"""
        if not self.plan_end_date:
            return None
        delta = self.plan_end_date - timezone.now().date()
        return max(0, delta.days)
    
    @property
    def can_use_api_settings(self):
        """Check if user can configure their own API settings"""
        return self.api_mode == 'user'
    
    def hash_api_key(self, key):
        """Hash API key for display purposes"""
        if not key:
            return ''
        if len(key) <= 8:
            return '*' * len(key)
        return key[:4] + '*' * (len(key) - 8) + key[-4:]
    
    def get_masked_openai_key(self):
        return self.hash_api_key(self.admin_openai_key)
    
    def get_masked_gemini_key(self):
        return self.hash_api_key(self.admin_gemini_key)
    
    def can_add_account(self):
        from platforms.models import SocialAccount
        current_count = SocialAccount.objects.filter(user=self.user, is_active=True).count()
        return current_count < self.max_social_accounts
    
    def can_create_post(self):
        return self.posts_this_month < self.max_posts_per_month
    
    def can_generate_caption(self):
        return self.captions_this_month < self.max_captions_per_month
    
    def can_generate_video(self):
        return self.videos_this_month < self.max_videos_per_month
    
    def can_generate_image(self):
        return self.images_this_month < self.max_images_per_month
    
    def increment_usage(self, usage_type, count=1):
        if usage_type == 'post':
            self.posts_this_month += count
        elif usage_type == 'caption':
            self.captions_this_month += count
        elif usage_type == 'video':
            self.videos_this_month += count
        elif usage_type == 'image':
            self.images_this_month += count
        elif usage_type == 'messenger':
            self.messenger_messages_this_month += count
        self.save()
    
    def add_token_usage(self, service, tokens):
        if service == 'openai':
            self.openai_tokens_this_month += tokens
            self.total_openai_tokens_used += tokens
        elif service == 'gemini':
            self.gemini_tokens_this_month += tokens
            self.total_gemini_tokens_used += tokens
        self.save()
    
    def reset_monthly_counters(self):
        self.posts_this_month = 0
        self.captions_this_month = 0
        self.videos_this_month = 0
        self.images_this_month = 0
        self.messenger_messages_this_month = 0
        self.openai_tokens_this_month = 0
        self.gemini_tokens_this_month = 0
        self.save()
    
    def set_plan(self, plan, duration_months=1, start_date=None):
        self.subscription_plan = plan
        self.plan_duration_months = duration_months
        self.plan_start_date = start_date or timezone.now().date()
        self.plan_end_date = self.plan_start_date + timedelta(days=30*duration_months)
        
        # Limits aligned with public pricing (see api/subscription_views.PLAN_CATALOG
        # and tokenCostEstimations.md). 99999 represents "unlimited" in the UI.
        plan_limits = {
            'free':       {'posts': 3,     'captions': 10,    'videos': 0,     'images': 5,     'messenger': 0,     'accounts': 1},
            'starter':    {'posts': 15,    'captions': 100,   'videos': 1,     'images': 50,    'messenger': 100,   'accounts': 3},
            'pro':        {'posts': 30,    'captions': 99999, 'videos': 2,     'images': 100,   'messenger': 200,   'accounts': 8},
            'business':   {'posts': 99999, 'captions': 99999, 'videos': 8,     'images': 500,   'messenger': 1000,  'accounts': 10},
            'enterprise': {'posts': 99999, 'captions': 99999, 'videos': 99999, 'images': 99999, 'messenger': 99999, 'accounts': 50},
        }
        
        limits = plan_limits.get(plan, plan_limits['free'])
        self.max_posts_per_month = limits['posts']
        self.max_captions_per_month = limits['captions']
        self.max_videos_per_month = limits['videos']
        self.max_images_per_month = limits['images']
        self.max_messenger_messages = limits['messenger']
        self.max_social_accounts = limits['accounts']
        
        self.save()


class APIUsageLog(models.Model):
    """Track detailed API usage for each user"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_usage_logs')
    
    SERVICE_CHOICES = [
        ('openai', 'OpenAI'),
        ('gemini', 'Gemini'),
        ('whisper', 'Whisper'),
        ('tts', 'Text-to-Speech'),
    ]
    service = models.CharField(max_length=20, choices=SERVICE_CHOICES)
    
    FEATURE_CHOICES = [
        ('caption', 'Caption Generation'),
        ('video', 'Video Generation'),
        ('image', 'Image Generation'),
        ('messenger', 'Messenger Bot'),
        ('transcription', 'Voice Transcription'),
        ('tts', 'Voice Reply'),
    ]
    feature = models.CharField(max_length=30, choices=FEATURE_CHOICES)
    
    tokens_used = models.IntegerField(default=0)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    request_data = models.TextField(blank=True, null=True, help_text='Request summary')
    response_status = models.CharField(max_length=20, default='success')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'api_usage_logs'
        ordering = ['-created_at']
        verbose_name = 'API Usage Log'
        verbose_name_plural = 'API Usage Logs'
    
    def __str__(self):
        return f"{self.user.username} - {self.service} - {self.tokens_used} tokens"
    
    @staticmethod
    def log_usage(user, service, feature, tokens, cost=0, request_data=''):
        return APIUsageLog.objects.create(
            user=user,
            service=service,
            feature=feature,
            tokens_used=tokens,
            estimated_cost=cost,
            request_data=request_data[:500] if request_data else ''
        )


# ============================================================
# DIAMOND TOKEN SYSTEM
# ============================================================

class DiamondWallet(models.Model):
    """Diamond Token wallet — one per user, stores current credit balance."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='diamond_wallet')
    balance = models.IntegerField(default=0, help_text='Current Diamond Token balance')
    total_recharged = models.IntegerField(default=0, help_text='Lifetime diamonds received')
    total_spent = models.IntegerField(default=0, help_text='Lifetime diamonds consumed')
    last_recharge_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'diamond_wallets'
        verbose_name = 'Diamond Wallet'
        verbose_name_plural = 'Diamond Wallets'

    def __str__(self):
        return f"{self.user.username} — {self.balance} diamonds"


class DiamondTransaction(models.Model):
    """Immutable ledger entry for every diamond movement."""

    TRANSACTION_TYPES = [
        ('recharge', 'Recharge'),
        ('deduction', 'Deduction'),
        ('refund', 'Refund'),
        ('plan_grant', 'Plan Grant'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='diamond_transactions')
    amount = models.IntegerField(help_text='Positive for recharge, negative for deduction')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    balance_after = models.IntegerField(help_text='Wallet balance after this transaction')

    # AI operation metadata
    feature = models.CharField(max_length=50, blank=True, default='',
                               help_text='e.g. caption, image, video, voice, messenger')
    provider = models.CharField(max_length=20, blank=True, default='',
                                help_text='e.g. claude, openai, gemini')
    raw_tokens = models.IntegerField(default=0, help_text='Total API tokens (input + output)')
    input_tokens = models.IntegerField(default=0, help_text='Exact input/prompt tokens from provider')
    output_tokens = models.IntegerField(default=0, help_text='Exact output/completion tokens from provider')
    cache_read_tokens = models.IntegerField(default=0, help_text='Cached input tokens (90% discount on Anthropic)')
    cache_write_tokens = models.IntegerField(default=0, help_text='Cache write tokens (1.25x cost on Anthropic)')
    model_used = models.CharField(max_length=100, blank=True, default='')
    media_count = models.IntegerField(default=0, help_text='Image/video count for media features')
    duration_seconds = models.IntegerField(default=0, help_text='Video duration in seconds (for video features)')
    raw_cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)

    # Admin recharge metadata
    recharged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='diamond_recharges_given'
    )
    note = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'diamond_transactions'
        verbose_name = 'Diamond Transaction'
        verbose_name_plural = 'Diamond Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['user', 'feature']),
            models.Index(fields=['user', 'provider']),
        ]

    def __str__(self):
        sign = '+' if self.amount > 0 else ''
        return f"{self.user.username} {sign}{self.amount} ({self.transaction_type})"


class GlobalAPIKey(models.Model):
    """Admin-managed global API keys shared by all users.
    Keys are encrypted with Fernet (derived from SECRET_KEY) before storage."""

    PROVIDER_CHOICES = [
        ('openai', 'OpenAI'),
        ('gemini', 'Google Gemini'),
        ('claude', 'Anthropic Claude'),
    ]

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, unique=True)
    api_key = models.TextField(blank=True, default='', help_text='Encrypted API key (Fernet)')
    is_active = models.BooleanField(default=True)
    set_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'global_api_keys'
        verbose_name = 'Global API Key'
        verbose_name_plural = 'Global API Keys'

    def set_key(self, plaintext: str):
        """Encrypt and store an API key."""
        from accounts.encryption import encrypt_value
        self.api_key = encrypt_value(plaintext) if plaintext else ''
        self.is_active = bool(plaintext)

    def get_key(self) -> str:
        """Decrypt and return the API key."""
        from accounts.encryption import decrypt_value
        if not self.api_key:
            return ''
        try:
            return decrypt_value(self.api_key)
        except Exception:
            return ''

    def __str__(self):
        return f"{self.provider} — {'Active' if self.is_active else 'Inactive'}"


class SupportDocument(models.Model):
    """PDF knowledge base documents for the AI support chatbot"""

    title = models.CharField(max_length=255, help_text='Document title')
    file = models.FileField(upload_to='support_docs/', help_text='PDF file')
    extracted_text = models.TextField(blank=True, help_text='Auto-extracted text from PDF')
    is_active = models.BooleanField(default=True, help_text='Include in chatbot knowledge')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'support_documents'
        verbose_name = 'Support Knowledge Document'
        verbose_name_plural = 'Support Knowledge Documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} ({'Active' if self.is_active else 'Inactive'})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Auto-extract text from PDF on save if not already extracted
        if self.file and not self.extracted_text:
            self._extract_text()

    def _extract_text(self):
        """Extract text from uploaded PDF"""
        try:
            import PyPDF2
            text_parts = []
            with open(self.file.path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text.strip())

            self.extracted_text = '\n\n'.join(text_parts)
            # Save without triggering save() again
            SupportDocument.objects.filter(pk=self.pk).update(
                extracted_text=self.extracted_text
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to extract PDF text: {e}")


# ============================================================
# V1.2.1 NEW MODEL - System-wide Notifications
# ============================================================

class SystemNotification(models.Model):
    """System-wide notification for all events across the platform"""

    EVENT_TYPE_CHOICES = [
        ('post_submitted', 'Post Submitted for Approval'),
        ('post_approved', 'Post Approved'),
        ('changes_requested', 'Changes Requested'),
        ('post_rejected', 'Post Rejected'),
        ('approval_reminder_12h', 'Approval Pending 12h'),
        ('approval_escalation_24h', 'Approval Escalated 24h'),
        ('post_scheduled', 'Post Scheduled'),
        ('post_published', 'Post Published'),
        ('publish_failed', 'Publish Failed'),
        ('captions_ready', 'Captions Generated'),
        ('images_ready', 'Images Generated'),
        ('video_rendering', 'Video Rendering Started'),
        ('video_ready', 'Video Ready'),
        ('batch_complete', 'Batch Complete'),
        ('weekly_report', 'Weekly Report Ready'),
        ('winner_detected', 'Winner Post Detected'),
        ('repurpose_suggestion', 'Repurpose Suggestion'),
        ('new_comment', 'New Comment on Post'),
        ('token_expiring', 'Platform Token Expiring'),
        ('daily_limit_warning', 'Daily Limit Approaching (80%)'),
        ('reply_sla_breach', 'Reply SLA Breach'),
        ('ad_rule_triggered', 'Ad Automation Rule Triggered'),
    ]

    CHANNEL_CHOICES = [
        ('in_app', 'In-App'),
        ('email', 'Email'),
        ('both', 'In-App + Email'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='system_notifications')
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    data_json = models.JSONField(default=dict, blank=True, help_text='Additional context data')
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default='in_app')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'system_notifications'
        verbose_name = 'System Notification'
        verbose_name_plural = 'System Notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', 'event_type']),
        ]

    def __str__(self):
        return f"{self.event_type}: {self.title} → {self.user.username}"


# ============================================================
# V1.2.1 NEW MODEL - Role-Based Access Control (RBAC)
# ============================================================

class UserRole(models.Model):
    """Workspace-level role assignment for users (RBAC)"""

    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('creator', 'Creator'),
        ('approver', 'Approver'),
        ('publisher', 'Publisher'),
        ('viewer', 'Viewer'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workspace_roles')
    workspace = models.ForeignKey(
        'brands.Workspace', on_delete=models.CASCADE, related_name='user_roles'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    granted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='roles_granted'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_roles'
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
        unique_together = [('user', 'workspace', 'role')]
        indexes = [
            models.Index(fields=['user', 'workspace']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.role} @ {self.workspace.name}"

    @staticmethod
    def get_user_roles(user, workspace):
        """Get all roles for a user in a workspace."""
        return list(
            UserRole.objects.filter(
                user=user, workspace=workspace
            ).values_list('role', flat=True)
        )

    @staticmethod
    def has_role(user, workspace, role):
        """Check if user has a specific role in a workspace."""
        # Workspace owner always has all permissions
        if workspace.owner == user:
            return True
        return UserRole.objects.filter(
            user=user, workspace=workspace, role=role
        ).exists()

    @staticmethod
    def has_any_role(user, workspace, roles):
        """Check if user has any of the given roles."""
        if workspace.owner == user:
            return True
        return UserRole.objects.filter(
            user=user, workspace=workspace, role__in=roles
        ).exists()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Create related objects for new users.
    CRITICAL: This signal ONLY runs when created=True to prevent race conditions.
    DO NOT add get_or_create() calls here that run on every save.
    """
    if created:
        from django.db import transaction

        # Wrap in atomic block to prevent race conditions
        with transaction.atomic():
            # Create UserProfile (should not exist yet for new user)
            UserProfile.objects.create(user=instance)

            # Create Diamond Wallet with initial free-plan grant
            wallet = DiamondWallet.objects.create(
                user=instance,
                balance=400,
                total_recharged=400
            )

            # Create transaction record
            DiamondTransaction.objects.create(
                user=instance,
                amount=400,
                transaction_type='plan_grant',
                balance_after=400,
                note='Initial free plan grant (400 diamonds)',
            )

            # Create OnboardingProgress for new users
            from onboarding.models import OnboardingProgress
            OnboardingProgress.objects.create(user=instance)


# ============================================================
# MAGIC MODE PROMPT OVERRIDES (admin-only feature)
# ============================================================

class UserPromptOverride(models.Model):
    """Per-user overrides for Magic Mode prompt templates.

    Active overrides shadow the hardcoded default at runtime. Admins manage
    these from the admin panel; users never see them. See
    `accounts.services.prompt_resolver.resolve_prompt` for the lookup helper.
    """

    PROMPT_TYPE_CHOICES = [
        # ── Ideas ──────────────────────────────────────────────
        ('idea_system',           'Ideas — System Prompt'),
        ('idea_user',             'Ideas — User Prompt'),
        ('idea_regenerate',       'Ideas — Regenerate (Feedback)'),
        # ── Captions ───────────────────────────────────────────
        ('caption_system',        'Caption — System Prompt'),
        ('caption_user',          'Caption — User Prompt'),
        ('caption_regenerate',    'Caption — Regenerate (Feedback)'),
        ('caption_adapt',         'Caption — Cross-Platform Adapt'),
        # ── Images ─────────────────────────────────────────────
        ('image_refiner',         'Image — Prompt Refiner'),
        ('image_product_bg',      'Image — Product Background'),
        ('image_product_smart',   'Image — Style-Matched Background'),
        # ── Video ──────────────────────────────────────────────
        ('video_prompt',          'Video — Prompt Builder'),
        # ── Brand DNA ──────────────────────────────────────────
        ('brand_dna',             'Brand DNA — Registration Enrichment'),
        ('brand_dna_website',     'Brand DNA — Full Website Extraction'),
        ('brand_dna_manual',      'Brand DNA — Manual Input Enhancement'),
        # ── Trending ───────────────────────────────────────────
        ('trending_filter',       'Trending — Google Trends Filter'),
        # ── Competitors ────────────────────────────────────────
        ('competitor_analyze',    'Competitor — Crawl Analysis'),
        ('competitor_suggest',    'Competitor — Suggest'),
        # ── Pillars ────────────────────────────────────────────
        ('pillars_generate',      'Content Pillars — Generate'),
        # ── Support ────────────────────────────────────────────
        ('support_chat',          'Support — Chat System Prompt'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='prompt_overrides'
    )
    prompt_type = models.CharField(max_length=50, choices=PROMPT_TYPE_CHOICES)
    prompt_text = models.TextField()
    is_active = models.BooleanField(default=True)

    # Audit metadata (full history lives in PromptOverrideAuditLog)
    created_by = models.ForeignKey(
        User, related_name='prompt_overrides_authored',
        null=True, blank=True, on_delete=models.SET_NULL,
    )
    updated_by = models.ForeignKey(
        User, related_name='prompt_overrides_modified',
        null=True, blank=True, on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_prompt_overrides'
        unique_together = [('user', 'prompt_type')]
        verbose_name = 'User Prompt Override'
        verbose_name_plural = 'User Prompt Overrides'

    def __str__(self):
        return f'{self.user.username} · {self.prompt_type} · {"active" if self.is_active else "inactive"}'


class PromptOverrideAuditLog(models.Model):
    """Append-only audit trail for every admin edit to a UserPromptOverride."""

    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('activate', 'Activate'),
        ('deactivate', 'Deactivate'),
    ]

    override = models.ForeignKey(
        UserPromptOverride, on_delete=models.CASCADE,
        related_name='audit_log', null=True, blank=True,
    )
    target_user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='prompt_audit_targets',
    )
    prompt_type = models.CharField(max_length=50)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    admin = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='prompt_audit_actions',
    )
    previous_text = models.TextField(blank=True)
    new_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'prompt_override_audit_log'
        ordering = ['-created_at']
        verbose_name = 'Prompt Override Audit Log'
        verbose_name_plural = 'Prompt Override Audit Log'

    def __str__(self):
        admin_name = self.admin.username if self.admin else 'system'
        return f'{admin_name} · {self.action} · {self.prompt_type} · {self.target_user.username}'


class PromptExecution(models.Model):
    """Records every AI prompt sent and the response received, per user.

    Admins view these in the admin panel to see exactly what prompt
    was used (static default or active override) and what the AI returned.
    Kept for 90 days then auto-purged via management command.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='prompt_executions',
    )
    prompt_type = models.CharField(max_length=50)
    was_override = models.BooleanField(
        default=False,
        help_text='True if an active UserPromptOverride was applied.',
    )
    prompt_sent = models.TextField(help_text='Exact prompt text sent to the LLM.')
    response_received = models.TextField(
        blank=True, help_text='Raw text returned by the LLM.',
    )
    model_used = models.CharField(max_length=80, blank=True)
    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    brand_id = models.IntegerField(null=True, blank=True)
    brand_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'prompt_executions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'prompt_type', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        verbose_name = 'Prompt Execution'
        verbose_name_plural = 'Prompt Executions'

    def __str__(self):
        tag = '✦' if self.was_override else '·'
        return f'{self.user.username} {tag} {self.prompt_type} · {self.created_at:%Y-%m-%d %H:%M}'


# ============================================================
# BILLING / PAYMENT MVP
# ============================================================
# No real payment gateway is wired yet. Users submit payment proof
# (bKash/Nagad txn ID, card last-4, bank ref) and the request is
# queued for admin review. On approval, the plan is activated and
# diamonds granted via the existing helpers.

class AdminPayoutAccount(models.Model):
    """An account where users send money to upgrade.

    Admin manages these in the admin dashboard. Users see active rows
    on the payment modal so they know where to send their bKash/Nagad/
    bank transfer. Card and Stripe-style methods can also be modeled
    here as merchant-id placeholders until a real gateway is wired.
    """

    METHOD_CHOICES = [
        ('bkash', 'bKash'),
        ('nagad', 'Nagad'),
        ('rocket', 'Rocket'),
        ('bank', 'Bank Transfer'),
        ('card', 'Card (Stripe / 2C2P)'),
        ('paypal', 'PayPal'),
        ('crypto', 'Crypto'),
        ('stripe', 'Stripe'),
        ('other', 'Other'),
    ]

    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    display_name = models.CharField(max_length=100,
                                    help_text='e.g. "Personal bKash" or "Sellanto Bank — DBBL"')
    account_number = models.CharField(max_length=120, blank=True, default='',
                                      help_text='Phone, IBAN, merchant ID, etc.')
    account_holder_name = models.CharField(max_length=120, blank=True, default='')
    instructions = models.TextField(blank=True, default='',
                                    help_text='Free-form instructions shown to the user.')
    currency = models.CharField(max_length=10, default='BDT',
                                help_text='ISO code: BDT, USD, EUR, INR, …')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admin_payout_accounts'
        ordering = ['sort_order', 'method']
        verbose_name = 'Admin Payout Account'
        verbose_name_plural = 'Admin Payout Accounts'

    def __str__(self):
        return f'{self.get_method_display()} — {self.display_name}'


class PaymentRequest(models.Model):
    """A user's claim that they sent money to upgrade their plan.

    Status flow:
        pending  → user just submitted (admin email fired)
        approved → admin verified payout; plan applied + diamonds granted
        rejected → admin couldn't verify; nothing applied
        cancelled → user withdrew the request before review
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    ]

    PROVIDER_CHOICES = [
        ('manual', 'Manual (admin-verified)'),
        ('stripe', 'Stripe'),
        ('internal_wallet', 'Internal diamond wallet'),
    ]

    REFUND_STATUS_CHOICES = [
        ('', 'Not requested'),
        ('requested', 'Requested by user'),
        ('approved', 'Approved by admin (refunding…)'),
        ('rejected', 'Rejected by admin'),
        ('processing', 'Sent to Stripe — awaiting confirmation'),
        ('refunded', 'Refunded'),
        ('failed', 'Refund attempt failed'),
    ]

    PURPOSE_CHOICES = [
        ('plan', 'Plan upgrade'),
        ('topup', 'Diamond top-up'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_requests')

    # What the user is buying
    plan = models.CharField(max_length=20, help_text='Target plan id (free/pro/business/...)')
    billing_cycle = models.CharField(max_length=10, choices=BILLING_CYCLE_CHOICES, default='monthly')
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                     help_text='Plan list price in USD')
    amount_local = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                       help_text='Amount the user actually paid in their currency')
    local_currency = models.CharField(max_length=10, default='BDT')

    # How they paid
    payment_method = models.CharField(max_length=20, choices=AdminPayoutAccount.METHOD_CHOICES)
    payout_account = models.ForeignKey(
        AdminPayoutAccount, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payment_requests',
    )
    transaction_reference = models.CharField(
        max_length=120, blank=True, default='',
        help_text='bKash trxID, bank ref, card last-4, or a screenshot URL.'
    )
    payer_name = models.CharField(max_length=120, blank=True, default='')
    payer_phone = models.CharField(max_length=40, blank=True, default='')
    payer_email = models.EmailField(blank=True, default='')
    payer_notes = models.TextField(blank=True, default='',
                                   help_text='Optional message from the user.')

    # Review
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Side-effects of approval (filled in when approved so we can audit later)
    diamonds_granted = models.IntegerField(default=0)
    plan_applied_at = models.DateTimeField(null=True, blank=True)

    # Revenue snapshot — what we *actually* received in USD, after FX conversion.
    # `amount_usd` is the plan list price; `revenue_usd` is `amount_local`
    # converted to USD at the rate held in `fx_rate_used` on approval day.
    revenue_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                      help_text='amount_local converted to USD at approval time')
    fx_rate_used = models.DecimalField(max_digits=20, decimal_places=8, default=0,
                                       help_text='1 local_currency = X USD, captured at approval')

    # Provider / purpose — distinguishes manual claims from Stripe-originated rows
    # and plan purchases from diamond top-ups. Existing rows default to manual + plan.
    payment_provider = models.CharField(
        max_length=20, choices=PROVIDER_CHOICES, default='manual',
        help_text='Which gateway/flow created this row',
    )
    purpose = models.CharField(
        max_length=20, choices=PURPOSE_CHOICES, default='plan',
        help_text='plan = subscription purchase; topup = standalone diamond purchase',
    )
    stripe_checkout_session_id = models.CharField(
        max_length=128, blank=True, default='', db_index=True,
    )
    stripe_payment_intent_id = models.CharField(
        max_length=128, blank=True, default='', db_index=True,
    )
    stripe_invoice_id = models.CharField(
        max_length=128, blank=True, default='', db_index=True,
    )
    diamonds_topped_up = models.IntegerField(
        default=0,
        help_text='Diamonds added by a top-up purchase (separate from plan grant)',
    )

    # Refund flow — user requests, admin approves, Stripe processes,
    # webhook confirms. Diamonds/plan are NOT auto-reversed on refund;
    # admin adjusts those manually if needed.
    refund_status = models.CharField(
        max_length=20, choices=REFUND_STATUS_CHOICES, default='', blank=True,
        db_index=True,
    )
    refund_amount_usd = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='USD amount refunded. v1 = always full amount.',
    )
    refund_reason = models.TextField(
        blank=True, default='',
        help_text='User-supplied reason for the refund request.',
    )
    refund_admin_notes = models.TextField(
        blank=True, default='',
        help_text="Admin's notes on approve/reject decision.",
    )
    refund_requested_at = models.DateTimeField(null=True, blank=True)
    refund_reviewed_at = models.DateTimeField(null=True, blank=True)
    refund_reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='refunds_reviewed',
    )
    refund_processed_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Set when charge.refunded webhook confirms the refund.',
    )
    stripe_refund_id = models.CharField(
        max_length=64, blank=True, default='', db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_requests'
        ordering = ['-created_at']
        verbose_name = 'Payment Request'
        verbose_name_plural = 'Payment Requests'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['payment_provider', 'purpose']),
            models.Index(fields=['refund_status', 'refund_requested_at']),
        ]

    def __str__(self):
        return f'{self.user.username} · {self.plan} · ${self.amount_usd} · {self.status}'


class FxRate(models.Model):
    """Cached exchange rate. Refreshed once per ~24h via the FX service.

    Stored as: 1 unit of `from_currency` = `rate` units of `to_currency`.
    For payment accounting we always normalize to USD.
    """

    from_currency = models.CharField(max_length=10)
    to_currency = models.CharField(max_length=10, default='USD')
    rate = models.DecimalField(max_digits=20, decimal_places=8)
    source = models.CharField(max_length=40, default='frankfurter',
                              help_text='Provider that returned this rate')
    fetched_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fx_rates'
        unique_together = [('from_currency', 'to_currency')]
        verbose_name = 'FX Rate'
        verbose_name_plural = 'FX Rates'

    def __str__(self):
        return f'{self.from_currency}->{self.to_currency} @ {self.rate}'


class ExpenseEntry(models.Model):
    """A manual cost entry for the finance page (debit side of the ledger).

    Revenue (credit side) is computed automatically from approved
    PaymentRequest rows — no manual entry needed.
    """

    CATEGORY_CHOICES = [
        ('server', 'Server / Hosting'),
        ('domain', 'Domain & SSL'),
        ('storage', 'Storage / CDN'),
        ('database', 'Database hosting'),
        ('email', 'Email service'),
        ('openai', 'OpenAI API'),
        ('gemini', 'Gemini API'),
        ('claude', 'Claude API'),
        ('other_api', 'Other API / SaaS'),
        ('marketing', 'Marketing / Ads'),
        ('payroll', 'Payroll / Contractors'),
        ('legal', 'Legal / Accounting'),
        ('other', 'Other'),
    ]

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    amount_usd = models.DecimalField(max_digits=12, decimal_places=2,
                                     help_text='Cost in USD')
    description = models.CharField(max_length=255, blank=True, default='')
    incurred_on = models.DateField(help_text='Date the cost was incurred')

    # Audit
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='expense_entries_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'expense_entries'
        ordering = ['-incurred_on', '-id']
        verbose_name = 'Expense Entry'
        verbose_name_plural = 'Expense Entries'
        indexes = [
            models.Index(fields=['category', 'incurred_on']),
            models.Index(fields=['incurred_on']),
        ]

    def __str__(self):
        return f'{self.get_category_display()} · ${self.amount_usd} · {self.incurred_on}'


# ============================================================
# EMAIL OTP — first-time signup verification
# ============================================================

class EmailOTP(models.Model):
    """One-time 6-digit code emailed for signup OR password reset, valid for 60 seconds.

    A user may have many rows over their lifetime; only the most recent
    unused, unexpired one for a given purpose is honoured. `verify()` is
    single-use — once a code matches it's marked used so it can't be replayed.
    Issuing a code only invalidates prior codes of the same purpose, so a
    pending signup OTP isn't killed by a password-reset request and vice versa.
    """

    CODE_TTL_SECONDS = 180
    MAX_ATTEMPTS = 5

    PURPOSE_SIGNUP = 'signup'
    PURPOSE_PASSWORD_RESET = 'password_reset'
    PURPOSE_CHOICES = [
        (PURPOSE_SIGNUP, 'Signup / Email Verification'),
        (PURPOSE_PASSWORD_RESET, 'Password Reset'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_otps')
    code = models.CharField(max_length=6, db_index=True)
    purpose = models.CharField(
        max_length=20,
        choices=PURPOSE_CHOICES,
        default=PURPOSE_SIGNUP,
        db_index=True,
    )
    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'email_otps'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'purpose', '-created_at']),
        ]

    def __str__(self):
        return f'OTP ({self.purpose}) for {self.user.username} (expires {self.expires_at:%H:%M:%S})'

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @classmethod
    def issue(cls, user, purpose: str = PURPOSE_SIGNUP) -> 'EmailOTP':
        """Invalidate any prior outstanding codes *of this purpose* and create a fresh one."""
        import secrets
        cls.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)
        code = f'{secrets.randbelow(1_000_000):06d}'
        return cls.objects.create(
            user=user,
            code=code,
            purpose=purpose,
            expires_at=timezone.now() + timedelta(seconds=cls.CODE_TTL_SECONDS),
        )

    @classmethod
    def verify(cls, user, code: str, purpose: str = PURPOSE_SIGNUP) -> tuple[bool, str]:
        """Returns (ok, message). On success the OTP is marked used."""
        if not code or not code.strip().isdigit() or len(code.strip()) != 6:
            return False, 'Enter the 6-digit code from your email.'

        otp = (
            cls.objects
            .filter(user=user, purpose=purpose, is_used=False)
            .order_by('-created_at')
            .first()
        )
        if not otp:
            return False, 'No active code. Request a new one.'

        if otp.is_expired:
            otp.is_used = True
            otp.save(update_fields=['is_used'])
            return False, 'Code expired. Request a new one.'

        if otp.attempts >= cls.MAX_ATTEMPTS:
            otp.is_used = True
            otp.save(update_fields=['is_used'])
            return False, 'Too many wrong attempts. Request a new code.'

        if otp.code != code.strip():
            otp.attempts += 1
            otp.save(update_fields=['attempts'])
            remaining = cls.MAX_ATTEMPTS - otp.attempts
            return False, f'Wrong code. {remaining} attempt(s) left.'

        otp.is_used = True
        otp.save(update_fields=['is_used'])
        return True, 'ok'


# ============================================================
# STRIPE INTEGRATION
# ============================================================
# Stripe is canonical for *payment* state (subscription status, period,
# payment method). UserProfile remains canonical for *entitlement* state
# (plan id, limits, end date). Webhooks reconcile UserProfile from Stripe.
#
# These models intentionally avoid duplicating data that already lives on
# UserProfile or DiamondWallet — they only store the linkage to Stripe.


class StripeCustomer(models.Model):
    """Maps a Sellanto user to their Stripe Customer object.

    Created lazily on the user's first Checkout session. We never call
    Stripe.Customer.create on signup — it would create empty customers
    for every free signup and clutter the Stripe dashboard.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='stripe_customer',
    )
    stripe_customer_id = models.CharField(max_length=64, unique=True)
    default_payment_method_id = models.CharField(max_length=64, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stripe_customers'
        verbose_name = 'Stripe Customer'
        verbose_name_plural = 'Stripe Customers'

    def __str__(self):
        return f'{self.user.username} → {self.stripe_customer_id}'


class StripePaymentMethod(models.Model):
    """A card saved by a user, mirroring a Stripe PaymentMethod.

    Source of truth = Stripe. We keep a local copy so the UI can show
    "Pay with Visa **** 4242" without round-tripping to Stripe on every
    page load. `payment_method.attached` / `detached` webhooks keep this
    in sync.

    Default selection: at most one row per user has `is_default=True`.
    Repeat purchases off-session use the default PaymentMethod.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='stripe_payment_methods',
    )
    stripe_payment_method_id = models.CharField(max_length=64, unique=True)
    stripe_customer_id = models.CharField(max_length=64, db_index=True)

    # Display fields (denormalised from Stripe so we don't hit their API for UI)
    card_brand = models.CharField(max_length=20, blank=True, default='')
    card_last4 = models.CharField(max_length=4, blank=True, default='')
    card_exp_month = models.IntegerField(null=True, blank=True)
    card_exp_year = models.IntegerField(null=True, blank=True)
    card_funding = models.CharField(max_length=20, blank=True, default='',
                                    help_text='credit | debit | prepaid | unknown')

    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stripe_payment_methods'
        ordering = ['-is_default', '-created_at']
        verbose_name = 'Stripe Payment Method'
        verbose_name_plural = 'Stripe Payment Methods'
        indexes = [
            models.Index(fields=['user', 'is_default']),
        ]

    def __str__(self):
        return f'{self.user.username} · {self.card_brand} ****{self.card_last4}'


class StripeSubscription(models.Model):
    """Local mirror of a Stripe Subscription.

    Source of truth = Stripe. We keep a local copy so the app can answer
    "is this user's subscription healthy?" without round-tripping to
    Stripe on every request. Webhooks keep this in sync.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('trialing', 'Trialing'),
        ('past_due', 'Past Due'),
        ('canceled', 'Canceled'),
        ('unpaid', 'Unpaid'),
        ('incomplete', 'Incomplete'),
        ('incomplete_expired', 'Incomplete Expired'),
        ('paused', 'Paused'),
    ]

    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='stripe_subscriptions',
    )
    stripe_subscription_id = models.CharField(max_length=64, unique=True)
    stripe_customer_id = models.CharField(max_length=64, db_index=True)
    stripe_price_id = models.CharField(max_length=64)

    plan = models.CharField(max_length=20, choices=UserProfile.PLAN_CHOICES)
    billing_cycle = models.CharField(max_length=10, choices=BILLING_CYCLE_CHOICES)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stripe_subscriptions'
        ordering = ['-created_at']
        verbose_name = 'Stripe Subscription'
        verbose_name_plural = 'Stripe Subscriptions'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['stripe_customer_id']),
        ]

    def __str__(self):
        return f'{self.user.username} · {self.plan} · {self.status}'


class StripeWebhookEvent(models.Model):
    """Append-only log of every Stripe webhook we've processed.

    The `stripe_event_id` UNIQUE constraint is the primary idempotency
    guard: Stripe retries webhooks aggressively, and replaying an event
    that already granted diamonds would double-mint. We do
    `get_or_create(stripe_event_id=...)` and short-circuit if not created.
    """

    PROCESSING_STATUS_CHOICES = [
        ('ok', 'OK'),
        ('error', 'Error'),
        ('ignored', 'Ignored'),
    ]

    stripe_event_id = models.CharField(max_length=64, unique=True)
    event_type = models.CharField(max_length=80, db_index=True)
    payload = models.JSONField(blank=True, null=True)
    processing_status = models.CharField(
        max_length=20, choices=PROCESSING_STATUS_CHOICES, default='ok',
    )
    error = models.TextField(blank=True, default='')

    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stripe_webhook_events'
        ordering = ['-processed_at']
        verbose_name = 'Stripe Webhook Event'
        verbose_name_plural = 'Stripe Webhook Events'
        indexes = [
            models.Index(fields=['event_type', 'processed_at']),
        ]

    def __str__(self):
        return f'{self.event_type} · {self.stripe_event_id} · {self.processing_status}'


class FeatureCostConfig(models.Model):
    """Per-feature diamond cost configuration — admin-tunable without deploys.

    Replaces the previously hard-coded `DIAMOND_COSTS` dict in
    `accounts/services/diamond_service.py`. The dict still exists as
    seed/fallback data, but live billing reads this table.

    Resolution order for `get_diamond_cost(feature, **kwargs)`:
      1. If a row exists and `flat_override_diamonds` is set → use that.
      2. Else compute raw API cost via `cost_calculator` and multiply by
         `(1 + markup_pct / 100)`.
      3. If no row exists, fall back to the seed dict at 200% markup.
    """

    CATEGORY_CHOICES = [
        ('text',  'Text / LLM'),
        ('image', 'Image generation'),
        ('video', 'Video generation'),
        ('voice', 'Voice / TTS'),
        ('ads',   'Ads automation'),
        ('misc',  'Miscellaneous'),
    ]

    feature = models.CharField(
        max_length=64,
        unique=True,
        help_text='Feature key, e.g. "caption", "video_5s", "image_standard".',
    )
    category = models.CharField(
        max_length=10,
        choices=CATEGORY_CHOICES,
        default='misc',
        help_text='UI grouping; does not affect billing.',
    )
    provider = models.CharField(
        max_length=32,
        blank=True,
        default='',
        help_text='Default provider used for this feature (informational).',
    )
    model_used = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='Default model ID used for this feature (informational).',
    )

    markup_pct = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=200,
        help_text=(
            'Markup over raw API cost, in percent. 200 = 3× cost basis. '
            'Ignored when flat_override_diamonds is set.'
        ),
    )
    flat_override_diamonds = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            'If set, bypasses the formula and charges this exact number of '
            'diamonds. Use for hand-tuned features or emergency price floors.'
        ),
    )

    is_active = models.BooleanField(
        default=True,
        help_text='If false, falls back to seed dict (DIAMOND_COSTS).',
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text='Admin annotations — visible only in admin UI.',
    )

    updated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='feature_cost_updates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'feature_cost_configs'
        ordering = ['category', 'feature']
        verbose_name = 'Feature Cost Config'
        verbose_name_plural = 'Feature Cost Configs'
        indexes = [
            models.Index(fields=['category', 'feature']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        if self.flat_override_diamonds is not None:
            return f'{self.feature} · flat={self.flat_override_diamonds}💎'
        return f'{self.feature} · {self.markup_pct}% markup'
