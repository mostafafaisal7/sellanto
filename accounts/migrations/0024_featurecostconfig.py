"""Add FeatureCostConfig table + seed from current DIAMOND_COSTS so billing
behaviour is unchanged on day 1. Admin can then tune live via the
/admin-panel/feature-costs UI without deploys.
"""

from django.conf import settings
from django.db import migrations, models


# Seed payload: (feature, category, provider, model_used, flat_override_diamonds)
# Categories: text / image / video / voice / ads / misc
# Providers/models reflect the *default* path; the formula path uses
# cost_calculator's rate tables at runtime.
SEED_ROWS = [
    # Text / LLM (default: Claude Sonnet 4)
    ('caption',                  'text',  'claude', 'claude-sonnet-4-5',           5),
    ('caption_adapt',            'text',  'claude', 'claude-sonnet-4-5',           5),
    ('caption_regenerate',       'text',  'claude', 'claude-sonnet-4-5',           5),
    ('brand_dna',                'text',  'claude', 'claude-sonnet-4-5',          15),
    ('strategy_ideas',           'text',  'claude', 'claude-sonnet-4-5',          10),
    ('idea_regenerate',          'text',  'claude', 'claude-sonnet-4-5',          10),
    ('ai_reply_comment',         'text',  'claude', 'claude-haiku-4-5',            3),
    ('hashtag_generation',       'text',  'claude', 'claude-sonnet-4-5',           3),
    ('competitor_analysis',      'text',  'claude', 'claude-sonnet-4-5',          12),
    ('competitor_suggest',       'text',  'claude', 'claude-sonnet-4-5',           8),
    ('trending_generation',      'text',  'claude', 'claude-sonnet-4-5',           8),
    ('weekly_report',            'text',  'claude', 'claude-sonnet-4-5',          15),
    ('pillar_generation',        'text',  'claude', 'claude-sonnet-4-5',          10),
    ('pillar_compliance',        'text',  'claude', 'claude-sonnet-4-5',           5),
    ('support_chat',             'text',  'claude', 'claude-sonnet-4-5',           2),
    ('refine_prompt',            'text',  'claude', 'claude-sonnet-4-5',           3),
    ('alt_text',                 'text',  'claude', 'claude-sonnet-4-5',           3),
    ('copy_overlay_text',        'text',  'claude', 'claude-sonnet-4-5',           5),
    ('compute_times',            'text',  'claude', 'claude-sonnet-4-5',           5),
    ('repurpose_post',           'text',  'claude', 'claude-sonnet-4-5',          10),
    ('messenger_reply',          'text',  'claude', 'claude-haiku-4-5',            3),
    ('prompt_engineer_generate', 'text',  'claude', 'claude-sonnet-4-5',           5),
    ('prompt_engineer_diagnose', 'text',  'claude', 'claude-sonnet-4-5',           5),
    ('prompt_engineer_reprompt', 'text',  'claude', 'claude-sonnet-4-5',           5),
    ('ai_styles',                'text',  'claude', 'claude-sonnet-4-5',           5),

    # Image
    ('image_standard', 'image', 'gemini', 'gemini-3.1-flash-image-preview', 15),
    ('image_hd',       'image', 'gemini', 'gemini-3-pro-image-preview',     40),

    # Video (Gemini Veo) — kept as discrete tiers for now; switch to
    # duration-linear pricing by clearing flat_override_diamonds.
    ('video_5s',  'video', 'gemini', 'veo-3.1-generate-preview',  500),
    ('video_8s',  'video', 'gemini', 'veo-3.1-generate-preview',  800),
    ('video_10s', 'video', 'gemini', 'veo-3.1-generate-preview', 1000),
    ('video_15s', 'video', 'gemini', 'veo-3.1-generate-preview', 1500),
    ('video_30s', 'video', 'gemini', 'veo-3.1-generate-preview', 3000),

    # Voice (OpenAI TTS)
    ('voice_short',      'voice', 'openai', 'tts-1',  5),
    ('voice_medium',     'voice', 'openai', 'tts-1', 10),
    ('voice_long',       'voice', 'openai', 'tts-1', 15),
    ('voice_extra_long', 'voice', 'openai', 'tts-1', 25),
    ('voice_preview',    'voice', 'openai', 'tts-1',  2),

    # Ads automation (Meta + Google) — AI-driven setup calls only
    ('ads_boost_post',           'ads', 'claude', 'claude-sonnet-4-5',  50),
    ('ads_campaign_create',      'ads', 'claude', 'claude-sonnet-4-5', 100),
    ('ads_audience_create',      'ads', 'claude', 'claude-sonnet-4-5',  30),
    ('ads_ai_targeting_suggest', 'ads', 'claude', 'claude-sonnet-4-5',  20),
    ('ads_insights_pull',        'ads', 'claude', 'claude-haiku-4-5',    2),
]


def seed_feature_costs(apps, schema_editor):
    FeatureCostConfig = apps.get_model('accounts', 'FeatureCostConfig')
    for feature, category, provider, model_used, current_diamonds in SEED_ROWS:
        FeatureCostConfig.objects.update_or_create(
            feature=feature,
            defaults={
                'category':              category,
                'provider':              provider,
                'model_used':            model_used,
                'markup_pct':            200,
                'flat_override_diamonds': current_diamonds,
                'is_active':             True,
            },
        )


def unseed_feature_costs(apps, schema_editor):
    FeatureCostConfig = apps.get_model('accounts', 'FeatureCostConfig')
    FeatureCostConfig.objects.filter(
        feature__in=[row[0] for row in SEED_ROWS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_rename_email_otps_user_id_purpose_idx_email_otps_user_id_e725d5_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='FeatureCostConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('feature', models.CharField(help_text='Feature key, e.g. "caption", "video_5s", "image_standard".', max_length=64, unique=True)),
                ('category', models.CharField(
                    choices=[('text', 'Text / LLM'), ('image', 'Image generation'), ('video', 'Video generation'), ('voice', 'Voice / TTS'), ('ads', 'Ads automation'), ('misc', 'Miscellaneous')],
                    default='misc',
                    help_text='UI grouping; does not affect billing.',
                    max_length=10,
                )),
                ('provider', models.CharField(blank=True, default='', help_text='Default provider used for this feature (informational).', max_length=32)),
                ('model_used', models.CharField(blank=True, default='', help_text='Default model ID used for this feature (informational).', max_length=64)),
                ('markup_pct', models.DecimalField(
                    decimal_places=2,
                    default=200,
                    help_text='Markup over raw API cost, in percent. 200 = 3× cost basis. Ignored when flat_override_diamonds is set.',
                    max_digits=7,
                )),
                ('flat_override_diamonds', models.PositiveIntegerField(
                    blank=True,
                    help_text='If set, bypasses the formula and charges this exact number of diamonds. Use for hand-tuned features or emergency price floors.',
                    null=True,
                )),
                ('is_active', models.BooleanField(default=True, help_text='If false, falls back to seed dict (DIAMOND_COSTS).')),
                ('notes', models.TextField(blank=True, default='', help_text='Admin annotations — visible only in admin UI.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=models.deletion.SET_NULL,
                    related_name='feature_cost_updates',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Feature Cost Config',
                'verbose_name_plural': 'Feature Cost Configs',
                'db_table': 'feature_cost_configs',
                'ordering': ['category', 'feature'],
                'indexes': [
                    models.Index(fields=['category', 'feature'], name='feature_cos_categor_b1ddc0_idx'),
                    models.Index(fields=['is_active'], name='feature_cos_is_acti_0ee75e_idx'),
                ],
            },
        ),
        migrations.RunPython(seed_feature_costs, reverse_code=unseed_feature_costs),
    ]
