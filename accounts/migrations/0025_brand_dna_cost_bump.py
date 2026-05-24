"""Bump the live `brand_dna` FeatureCostConfig from 15 → 35 diamonds.

The Brand DNA generator now uses Anthropic's web_search server tool and
extended thinking (10k thinking budget) on every call, which roughly
triples the raw API spend. This migration updates the live cost row so
existing installs pick up the new price without an admin having to hit
"Reseed from code" in the cost-config UI.

Idempotent: if no row exists yet (fresh install), this is a no-op and
the seed migration (0024) + DIAMOND_COSTS fallback handle it.
"""

from django.db import migrations


FEATURE = 'brand_dna'
NEW_COST = 35
OLD_COST = 15


def bump_brand_dna_cost(apps, schema_editor):
    FeatureCostConfig = apps.get_model('accounts', 'FeatureCostConfig')
    FeatureCostConfig.objects.filter(feature=FEATURE).update(
        flat_override_diamonds=NEW_COST,
    )


def revert_brand_dna_cost(apps, schema_editor):
    FeatureCostConfig = apps.get_model('accounts', 'FeatureCostConfig')
    FeatureCostConfig.objects.filter(feature=FEATURE).update(
        flat_override_diamonds=OLD_COST,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0024_featurecostconfig'),
    ]

    operations = [
        migrations.RunPython(bump_brand_dna_cost, revert_brand_dna_cost),
    ]
