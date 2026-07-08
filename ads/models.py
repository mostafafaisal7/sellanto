"""
Ads automation models — paid ad campaigns across Meta + Google.

Hierarchy:
    AdAccount (per-user link to a Meta/Google ad account)
        └─ AdCampaign (one campaign in our DB, mirrors a Meta/Google campaign)
                └─ AdInsight (daily metrics snapshot, one row per (campaign, date))
    AdAudience (saved custom/lookalike audiences, reusable across campaigns)

Source of truth is Meta/Google. Our DB is a cache + UX state. Always re-fetch
on-demand for write operations; nightly worker syncs status + insights.
"""
from django.db import models
from django.contrib.auth.models import User

from brands.models import Brand
from posts.models import Post


PROVIDER_CHOICES = [
    ('meta', 'Meta (Facebook + Instagram)'),
    ('google', 'Google Ads'),
]


class AdAccount(models.Model):
    """A user's connected ad account on Meta or Google.

    One user can connect multiple ad accounts per provider (e.g. agencies
    managing many clients). `external_id` is Meta's `act_<id>` or Google's
    customer_id (digits only, no hyphens).
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='ad_accounts',
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ad_accounts',
        help_text='Optional brand link — drives targeting suggestions from Brand DNA.',
    )
    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES)

    # Meta: stored as bare digits (without 'act_' prefix). Service layer adds prefix.
    # Google: customer_id digits only, no hyphens.
    external_id = models.CharField(max_length=64)
    name = models.CharField(max_length=200, blank=True)
    currency_code = models.CharField(max_length=3, blank=True)  # USD, BDT, EUR
    timezone_name = models.CharField(max_length=64, blank=True)

    # System User token (Meta — never expires) or refresh_token (Google).
    # Encrypted via cryptography.fernet keyed off SECRET_KEY.
    encrypted_token = models.TextField(blank=True)

    # Google-specific: MCC manager ID in the access chain (digits only).
    login_customer_id = models.CharField(max_length=20, blank=True)

    # Meta-specific: business_id under which this ad account sits.
    business_id = models.CharField(max_length=64, blank=True)

    # Meta account_status from the Graph API (1 = active/live, 101 = sandbox/test,
    # 2 = disabled, ...). Stored so the UI can label test vs real accounts.
    account_status = models.IntegerField(null=True, blank=True)
    # True when this is a Meta sandbox (test) ad account — no real spend/delivery.
    # Derived from account_status == 101 at discovery time.
    is_sandbox = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_accounts'
        unique_together = [('user', 'provider', 'external_id')]
        indexes = [
            models.Index(fields=['user', 'provider']),
            models.Index(fields=['brand']),
        ]

    def __str__(self):
        return f'{self.provider}:{self.external_id} ({self.user.username})'


OBJECTIVE_CHOICES = [
    ('traffic',    'Traffic / Link Clicks'),
    ('engagement', 'Engagement'),
    ('leads',      'Lead Generation'),
    ('sales',      'Sales / Conversions'),
    ('awareness',  'Brand Awareness'),
    ('boost_post', 'Boost Existing Post'),
]

CAMPAIGN_STATUS_CHOICES = [
    ('draft',          'Draft (not yet sent to provider)'),
    ('pending_review', 'Pending Review (sent, ad under review)'),
    ('active',         'Active'),
    ('paused',         'Paused'),
    ('completed',      'Completed (ran to end_date)'),
    ('disapproved',    'Disapproved'),
    ('failed',         'Failed (provider error)'),
    ('archived',       'Archived'),
]


class AdCampaign(models.Model):
    """One paid ad campaign — mirrors a Meta/Google campaign object.

    For the MVP "Boost Post" flow, `objective='boost_post'` and `boosted_post`
    links to the organic post that's being boosted. The service layer creates
    Campaign + AdSet + Creative + Ad on Meta's side in one chained call.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='ad_campaigns',
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, related_name='ad_campaigns',
    )
    ad_account = models.ForeignKey(
        AdAccount, on_delete=models.CASCADE, related_name='campaigns',
    )

    boosted_post = models.ForeignKey(
        Post, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ad_boosts',
    )

    name = models.CharField(max_length=255)
    objective = models.CharField(max_length=20, choices=OBJECTIVE_CHOICES)
    status = models.CharField(
        max_length=20, choices=CAMPAIGN_STATUS_CHOICES, default='draft',
    )

    # IDs returned by Meta/Google after creation
    external_campaign_id = models.CharField(max_length=64, blank=True)
    external_adset_id = models.CharField(max_length=64, blank=True)
    external_ad_id = models.CharField(max_length=64, blank=True)
    external_creative_id = models.CharField(max_length=64, blank=True)

    # Money: always integer minor units (cents/micros) — never floats.
    # Meta: cents in account currency. Google: micros (USD 1 = 1,000,000).
    daily_budget_minor = models.BigIntegerField()
    lifetime_budget_minor = models.BigIntegerField(null=True, blank=True)
    spend_to_date_minor = models.BigIntegerField(default=0)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)

    # Targeting blob — provider-specific JSON shape
    targeting_json = models.JSONField(default=dict, blank=True)

    # Creative blob — provider-specific
    creative_json = models.JSONField(default=dict, blank=True)

    # Why ad was disapproved — populated from policy_topic_entries / ad_review_feedback
    rejection_reason = models.TextField(blank=True)
    rejection_codes = models.JSONField(default=list, blank=True)

    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_status_check_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_campaigns'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['brand', '-created_at']),
            models.Index(fields=['ad_account', 'status']),
            models.Index(fields=['external_campaign_id']),
        ]

    def __str__(self):
        return f'{self.name} [{self.status}]'


class AdInsight(models.Model):
    """Daily metrics snapshot per campaign.

    Populated by a background job that pulls insights from Meta/Google.
    One row per (campaign, date) — uniqueness enforced.
    """
    campaign = models.ForeignKey(
        AdCampaign, on_delete=models.CASCADE, related_name='insights',
    )
    date = models.DateField()

    impressions = models.BigIntegerField(default=0)
    reach = models.BigIntegerField(default=0)
    clicks = models.IntegerField(default=0)
    spend_minor = models.BigIntegerField(default=0)
    conversions = models.IntegerField(default=0)
    conversion_value_minor = models.BigIntegerField(default=0)

    # Derived metrics stored explicitly so we don't recompute in queries
    ctr = models.FloatField(default=0.0)
    cpc_minor = models.BigIntegerField(default=0)
    cpm_minor = models.BigIntegerField(default=0)
    frequency = models.FloatField(default=0.0)

    # Full provider response for debugging + future fields without migrations
    raw_data = models.JSONField(default=dict, blank=True)

    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_insights'
        unique_together = [('campaign', 'date')]
        ordering = ['-date']
        indexes = [
            models.Index(fields=['campaign', '-date']),
        ]

    def __str__(self):
        return f'{self.campaign.name} @ {self.date}'


AUDIENCE_TYPE_CHOICES = [
    ('custom',    'Custom Audience'),
    ('lookalike', 'Lookalike Audience'),
    ('saved',     'Saved (rule-based) Audience'),
]


class AdAudience(models.Model):
    """Saved custom/lookalike audiences for reuse across campaigns."""
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='ad_audiences',
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, related_name='ad_audiences',
    )
    ad_account = models.ForeignKey(
        AdAccount, on_delete=models.CASCADE, related_name='audiences',
    )
    name = models.CharField(max_length=200)
    audience_type = models.CharField(max_length=20, choices=AUDIENCE_TYPE_CHOICES)
    external_id = models.CharField(max_length=64, blank=True)
    size_estimate = models.BigIntegerField(default=0)
    config_json = models.JSONField(default=dict, blank=True)
    source_audience = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='derived_audiences',
        help_text='For lookalikes — the source custom audience.',
    )
    is_ready = models.BooleanField(
        default=False,
        help_text='Meta needs time to build custom audiences; false until ready.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_audiences'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['brand', '-created_at']),
        ]

    def __str__(self):
        return f'{self.name} [{self.audience_type}]'


class AdCampaignDraft(models.Model):
    """A persisted, AI-generated campaign draft so generated content survives a
    page reload and can be re-generated on demand.

    One draft per (user, brand, campaign_type) — the AI-suggest endpoint upserts
    it on every run, and the frontend loads it on mount. This is pre-launch UX
    state only; once the user actually creates the campaign it becomes an
    AdCampaign. Drafts are disposable and never sync to Google.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='ad_campaign_drafts',
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, related_name='ad_campaign_drafts',
    )
    campaign_type = models.CharField(max_length=20, default='search')
    topic = models.CharField(max_length=300, blank=True)
    # The full suggestion payload returned to the frontend (name, objective,
    # headlines, descriptions, keywords, business_name, daily_budget_usd, etc.).
    suggestion = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_campaign_drafts'
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'brand', 'campaign_type'],
                name='uniq_draft_per_user_brand_type',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'brand', '-updated_at']),
        ]

    def __str__(self):
        return f'Draft({self.campaign_type}) for {self.brand_id} / user {self.user_id}'


RULE_METRIC_CHOICES = [
    ('spend',       'Spend (last N days)'),
    ('cpc',         'Average CPC'),
    ('ctr',         'CTR'),
    ('conversions', 'Conversions'),
    ('cpa',         'Cost per conversion (CPA)'),
]
RULE_OPERATOR_CHOICES = [('gt', '>'), ('lt', '<'), ('gte', '≥'), ('lte', '≤')]
RULE_ACTION_CHOICES = [
    ('pause',           'Pause the campaign'),
    ('notify',          'Notify only'),
    ('increase_budget', 'Increase daily budget by %'),
    ('decrease_budget', 'Decrease daily budget by %'),
]


class AdRule(models.Model):
    """An automation rule evaluated periodically against a campaign's metrics.

    Example: "if CPA > $50 over the last 7 days, pause the campaign" or
    "if spend > $100 today, notify me". Budget pacing is a spend rule with a
    notify/decrease action. Evaluated by the scheduler (every 30 min).
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='ad_rules',
    )
    campaign = models.ForeignKey(
        AdCampaign, on_delete=models.CASCADE, related_name='rules',
    )
    name = models.CharField(max_length=200)
    metric = models.CharField(max_length=20, choices=RULE_METRIC_CHOICES)
    operator = models.CharField(max_length=4, choices=RULE_OPERATOR_CHOICES)
    # Threshold in the metric's natural unit: USD for spend/cpc/cpa, fraction
    # for ctr (0.05 = 5%), integer for conversions.
    threshold = models.FloatField()
    lookback_days = models.IntegerField(default=7)
    action = models.CharField(max_length=20, choices=RULE_ACTION_CHOICES)
    action_value = models.FloatField(
        default=0, help_text='Percent for budget actions (e.g. 20 = ±20%).')
    is_active = models.BooleanField(default=True)
    last_evaluated_at = models.DateTimeField(null=True, blank=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    trigger_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ad_rules'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f'{self.name} ({self.metric} {self.operator} {self.threshold})'
