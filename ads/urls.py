"""URL routes for ads automation — mounted under /api/v1/ads/"""
from django.urls import path

from ads import views
from ads import advanced_views as adv_views
from ads import google_ads_oauth_views as gads_oauth

urlpatterns = [
    # Ad accounts
    path('accounts/',
         views.AdAccountListView.as_view(),
         name='ads-accounts-list'),
    path('accounts/connect-meta/',
         views.ConnectMetaAdAccountView.as_view(),
         name='ads-connect-meta'),

    # Meta — AI campaign suggestion from Brand DNA + topic
    path('meta/suggest/',
         views.MetaAdsSuggestCampaignView.as_view(),
         name='ads-meta-suggest'),

    # Meta — create a from-scratch link/website campaign
    path('meta/campaigns/create/',
         views.MetaCreateCampaignView.as_view(),
         name='ads-meta-create-campaign'),

    # Meta — advanced targeting lookups (interests/behaviors/demographics + geo)
    path('meta/targeting/search/',
         views.MetaTargetingSearchView.as_view(),
         name='ads-meta-targeting-search'),
    path('meta/targeting/geo/',
         views.MetaGeoSearchView.as_view(),
         name='ads-meta-targeting-geo'),

    # ── Google Ads OAuth + account connection ──────────────────────────
    path('google/initiate/',  gads_oauth.google_ads_initiate,  name='ads-google-initiate'),
    path('google/callback/',  gads_oauth.google_ads_callback,  name='ads-google-callback'),
    path('google/pending/',   gads_oauth.google_ads_pending,   name='ads-google-pending'),
    path('google/customers/', gads_oauth.google_ads_customers, name='ads-google-customers'),
    path('google/connect/',   gads_oauth.google_ads_connect,   name='ads-google-connect'),
    path('google/status/',    gads_oauth.google_ads_status,    name='ads-google-status'),

    # Google Ads — create a campaign (Search / Display / PMax via campaign_type)
    path('google/campaigns/create/',
         views.GoogleCreateCampaignView.as_view(),
         name='ads-google-create-campaign'),
    # Google Ads — upload an image asset → returns a public URL (Display/PMax)
    path('google/image-upload/',
         views.GoogleAdsImageUploadView.as_view(),
         name='ads-google-image-upload'),
    # Google Ads — AI campaign suggestion from Brand DNA + topic
    path('google/suggest/',
         views.GoogleAdsSuggestCampaignView.as_view(),
         name='ads-google-suggest'),
    # Google Ads — create a conversion action (conversion tracking setup)
    path('google/conversion-action/',
         views.GoogleAdsConversionActionView.as_view(),
         name='ads-google-conversion-action'),
    # Google Ads — search audience interest categories (audience picker)
    path('google/audiences/',
         views.GoogleAdsAudienceSearchView.as_view(),
         name='ads-google-audiences'),
    # Google Ads — account-level dashboard rollup
    path('google/account-summary/',
         views.GoogleAccountSummaryView.as_view(),
         name='ads-google-account-summary'),
    # Google Ads — offline/CRM conversion import
    path('google/offline-conversions/',
         views.GoogleAdsOfflineConversionsView.as_view(),
         name='ads-google-offline-conversions'),

    # ── Advanced Google Ads (full feature parity) ──────────────────────
    path('google/locations/',      adv_views.LocationSearchView.as_view(),    name='ads-google-locations'),
    path('google/audience-list/',  adv_views.AudienceListView.as_view(),      name='ads-google-audience-list'),
    path('google/customer-match/', adv_views.CustomerMatchView.as_view(),     name='ads-google-customer-match'),
    path('google/shared-budgets/', adv_views.SharedBudgetView.as_view(),      name='ads-google-shared-budgets'),
    path('google/portfolio-strategies/', adv_views.PortfolioStrategyView.as_view(), name='ads-google-portfolio'),
    path('google/recommendations/', adv_views.RecommendationsView.as_view(),  name='ads-google-recommendations'),
    path('google/keyword-ideas/',  adv_views.KeywordIdeasView.as_view(),      name='ads-google-keyword-ideas'),
    path('google/change-history/', adv_views.ChangeHistoryView.as_view(),     name='ads-google-change-history'),
    path('google/labels/',         adv_views.LabelView.as_view(),             name='ads-google-labels'),
    path('google/experiments/',    adv_views.ExperimentView.as_view(),        name='ads-google-experiments'),
    path('google/experiments/<str:experiment_id>/',
         adv_views.ExperimentDetailView.as_view(),  name='ads-google-experiment-detail'),

    # Campaign-scoped editing + segments
    path('campaigns/<int:pk>/ad-groups/',
         adv_views.CampaignAdGroupsView.as_view(), name='ads-campaign-ad-groups'),
    path('campaigns/<int:pk>/ad-groups/<str:ad_group_id>/',
         adv_views.AdGroupDetailView.as_view(), name='ads-ad-group-detail'),
    path('campaigns/<int:pk>/keywords-edit/',
         adv_views.CampaignKeywordsEditView.as_view(), name='ads-campaign-keywords-edit'),
    path('campaigns/<int:pk>/ads-edit/',
         adv_views.CampaignAdsEditView.as_view(), name='ads-campaign-ads-edit'),
    path('campaigns/<int:pk>/segments/',
         adv_views.SegmentBreakdownView.as_view(), name='ads-campaign-segments'),
    # Google Ads — AI-generate an ad image (Display/PMax creative)
    path('google/generate-image/',
         views.GoogleAdsGenerateImageView.as_view(),
         name='ads-google-generate-image'),
    # Google Ads — AI-generate a video clip (Video/PMax creative)
    path('google/generate-video/',
         views.GoogleAdsGenerateVideoView.as_view(),
         name='ads-google-generate-video'),

    # Campaigns
    path('campaigns/',
         views.CampaignListCreateView.as_view(),
         name='ads-campaigns-list'),
    path('campaigns/<int:pk>/',
         views.CampaignDetailView.as_view(),
         name='ads-campaign-detail'),
    path('campaigns/<int:pk>/pause/',
         views.CampaignPauseView.as_view(),
         name='ads-campaign-pause'),
    path('campaigns/<int:pk>/resume/',
         views.CampaignResumeView.as_view(),
         name='ads-campaign-resume'),
    path('campaigns/<int:pk>/insights/',
         views.CampaignInsightsView.as_view(),
         name='ads-campaign-insights'),
    path('campaigns/<int:pk>/breakdown/',
         views.MetaInsightBreakdownView.as_view(),
         name='ads-campaign-breakdown'),
    path('campaigns/<int:pk>/keywords/',
         views.CampaignKeywordInsightsView.as_view(),
         name='ads-campaign-keywords'),
    path('campaigns/<int:pk>/search-terms/',
         views.CampaignSearchTermsView.as_view(),
         name='ads-campaign-search-terms'),

    # Automation rules (budget pacing / auto-pause / auto-budget)
    path('rules/',
         views.AdRuleListCreateView.as_view(),
         name='ads-rules-list'),
    path('rules/<int:pk>/',
         views.AdRuleDetailView.as_view(),
         name='ads-rule-detail'),

    # Saved audiences (reusable targeting presets)
    path('audiences/',
         views.AdAudienceListCreateView.as_view(),
         name='ads-audiences-list'),
    path('audiences/<int:pk>/',
         views.AdAudienceDetailView.as_view(),
         name='ads-audience-detail'),
    # Live Meta Custom/Lookalike audiences (real Graph API, read-only)
    path('meta/audiences/live/',
         views.MetaAudienceSyncView.as_view(),
         name='ads-meta-audiences-live'),

    # MVP — Boost Post
    path('boost-post/',
         views.BoostPostView.as_view(),
         name='ads-boost-post'),

    # Boost from content — turn a scheduled/published/AI post into a Meta ad
    path('boost-from-post/',
         views.BoostFromPostView.as_view(),
         name='ads-boost-from-post'),
    path('boostable-posts/',
         views.BoostablePostsView.as_view(),
         name='ads-boostable-posts'),
    path('prefill-from-post/',
         views.PrefillFromContentView.as_view(),
         name='ads-prefill-from-post'),

    # Path A — One-click "Publish video + Boost" as a paid video ad
    path('run-video-ad/',
         views.RunVideoAdView.as_view(),
         name='ads-run-video-ad'),

    # Meta — account-level dashboard rollup + recommendations (read-only)
    path('meta/account-summary/',
         views.MetaAccountSummaryView.as_view(),
         name='ads-meta-account-summary'),
    path('meta/recommendations/',
         views.MetaRecommendationsView.as_view(),
         name='ads-meta-recommendations'),
]
