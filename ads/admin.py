"""Django admin registration for ads models."""
from django.contrib import admin

from ads.models import AdAccount, AdCampaign, AdInsight, AdAudience


@admin.register(AdAccount)
class AdAccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'provider', 'external_id', 'name', 'currency_code', 'is_active', 'created_at')
    list_filter = ('provider', 'is_active', 'currency_code')
    search_fields = ('external_id', 'name', 'user__username', 'user__email')
    readonly_fields = ('encrypted_token', 'created_at', 'updated_at', 'last_synced_at')


@admin.register(AdCampaign)
class AdCampaignAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'objective', 'status', 'daily_budget_minor',
                    'start_date', 'end_date', 'created_at')
    list_filter = ('status', 'objective')
    search_fields = ('name', 'user__username', 'external_campaign_id')
    readonly_fields = ('external_campaign_id', 'external_adset_id', 'external_creative_id',
                       'external_ad_id', 'created_at', 'updated_at')


@admin.register(AdInsight)
class AdInsightAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'date', 'impressions', 'clicks', 'spend_minor', 'ctr', 'fetched_at')
    list_filter = ('date',)
    search_fields = ('campaign__name',)
    readonly_fields = ('fetched_at',)


@admin.register(AdAudience)
class AdAudienceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'audience_type', 'user', 'brand', 'is_ready', 'size_estimate', 'created_at')
    list_filter = ('audience_type', 'is_ready')
    search_fields = ('name', 'user__username')
