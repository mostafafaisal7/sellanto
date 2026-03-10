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
        
        plan_limits = {
            'free': {'posts': 10, 'captions': 20, 'videos': 5, 'images': 10, 'messenger': 100, 'accounts': 1},
            'starter': {'posts': 50, 'captions': 100, 'videos': 20, 'images': 50, 'messenger': 500, 'accounts': 3},
            'pro': {'posts': 200, 'captions': 500, 'videos': 50, 'images': 200, 'messenger': 2000, 'accounts': 5},
            'business': {'posts': 500, 'captions': 1000, 'videos': 100, 'images': 500, 'messenger': 5000, 'accounts': 10},
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
    raw_tokens = models.IntegerField(default=0, help_text='Actual API tokens used')
    model_used = models.CharField(max_length=100, blank=True, default='')
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
    """Admin-managed global API keys shared by all users."""

    PROVIDER_CHOICES = [
        ('openai', 'OpenAI'),
        ('gemini', 'Google Gemini'),
        ('claude', 'Anthropic Claude'),
    ]

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, unique=True)
    api_key = models.TextField(help_text='API key (stored securely)')
    is_active = models.BooleanField(default=True)
    set_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'global_api_keys'
        verbose_name = 'Global API Key'
        verbose_name_plural = 'Global API Keys'

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
    if created:
        UserProfile.objects.create(user=instance)
        # Create Diamond Wallet with initial free-plan grant
        wallet = DiamondWallet.objects.create(user=instance, balance=50, total_recharged=50)
        DiamondTransaction.objects.create(
            user=instance, amount=50, transaction_type='plan_grant',
            balance_after=50, note='Initial free plan grant',
        )
        # Create OnboardingProgress for new users
        from onboarding.models import OnboardingProgress
        OnboardingProgress.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    UserProfile.objects.get_or_create(user=instance)
