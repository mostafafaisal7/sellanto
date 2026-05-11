"""URL routes for ads automation — mounted under /api/v1/ads/"""
from django.urls import path

from ads import views

urlpatterns = [
    # Ad accounts
    path('accounts/',
         views.AdAccountListView.as_view(),
         name='ads-accounts-list'),
    path('accounts/connect-meta/',
         views.ConnectMetaAdAccountView.as_view(),
         name='ads-connect-meta'),

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

    # MVP — Boost Post
    path('boost-post/',
         views.BoostPostView.as_view(),
         name='ads-boost-post'),
]
