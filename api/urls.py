from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import admin_views
from . import strategy_views
from . import caption_views
from . import hashtag_views
from . import approval_views
from . import scheduling_views
from . import analytics_views as v2_analytics_views
from . import notification_views
from . import creative_views
from . import rbac_views
from . import diamond_views

# Create router for viewsets
router = DefaultRouter()
router.register(r'posts', views.PostViewSet, basename='post')
router.register(r'platforms', views.SocialAccountViewSet, basename='platform')
router.register(r'platforms-detail', views.SocialAccountDetailViewSet, basename='platform-detail')

# AI Caption routers
router.register(r'ai-caption/templates', views.CaptionTemplateViewSet, basename='caption-template')
router.register(r'ai-caption/saved', views.SavedCaptionViewSet, basename='saved-caption')

# AI Image routers
router.register(r'ai-image/logos', views.UserLogoViewSet, basename='user-logo')
router.register(r'ai-image/saved', views.SavedImageViewSet, basename='saved-image')
router.register(r'ai-image/templates', views.ImagePromptTemplateViewSet, basename='image-template')

# AI Video routers
router.register(r'ai-video/logos', views.VideoLogoViewSet, basename='video-logo')
router.register(r'ai-video/saved', views.SavedVideoViewSet, basename='saved-video')
router.register(r'ai-video/templates', views.VideoPromptTemplateViewSet, basename='video-template')

# Messenger routers
router.register(r'messenger/connections', views.MessengerConnectionViewSet, basename='messenger-connection')
router.register(r'messenger/notifications', views.NotificationViewSet, basename='notification')

# Onboarding & Brands routers
router.register(r'workspaces', views.WorkspaceViewSet, basename='workspace')
router.register(r'brands', views.BrandViewSet, basename='brand')
router.register(r'brand-assets', views.BrandAssetViewSet, basename='brand-asset')
router.register(r'content-ideas', views.ContentIdeaViewSet, basename='content-idea')
router.register(r'content-approvals', views.ContentApprovalViewSet, basename='content-approval')
router.register(r'weekly-reports', views.WeeklyReportViewSet, basename='weekly-report')

# V1.2.1 routers
router.register(r'content-pillars', strategy_views.ContentPillarViewSet, basename='content-pillar')
router.register(r'competitor-profiles', strategy_views.CompetitorProfileViewSet, basename='competitor-profile')
router.register(r'brand-templates', strategy_views.BrandTemplateViewSet, basename='brand-template')
router.register(r'post-captions', caption_views.PostCaptionViewSet, basename='post-caption')
router.register(r'hashtag-groups', hashtag_views.HashtagGroupViewSet, basename='hashtag-group')
router.register(r'banned-hashtags', hashtag_views.BannedHashtagViewSet, basename='banned-hashtag')

urlpatterns = [
    # Auth endpoints
    path('auth/register/', views.RegisterView.as_view(), name='api-register'),
    path('auth/register-with-brand/', views.RegisterWithBrandView.as_view(), name='api-register-with-brand'),
    path('auth/login/', views.LoginView.as_view(), name='api-login'),
    path('auth/logout/', views.LogoutView.as_view(), name='api-logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('auth/me/', views.CurrentUserView.as_view(), name='api-current-user'),

    # User Profile endpoints
    path('profile/', views.UserProfileView.as_view(), name='api-profile'),
    path('profile/api-keys/', views.GlobalAPIKeysView.as_view(), name='api-global-keys'),

    # Dashboard endpoints
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='api-dashboard-stats'),
    path('dashboard/recent/', views.RecentPostsView.as_view(), name='api-recent-posts'),

    # Onboarding endpoints
    path('onboarding/', views.OnboardingProgressView.as_view(), name='api-onboarding'),
    path('onboarding/step/<int:step_number>/', views.OnboardingStepView.as_view(), name='api-onboarding-step'),
    path('onboarding/skip/', views.OnboardingSkipView.as_view(), name='api-onboarding-skip'),

    # Launch Plan endpoints
    path('brands/<int:brand_id>/launch-plan/', views.LaunchPlanView.as_view(), name='api-launch-plan'),
    path('launch-plans/', views.CreateLaunchPlanView.as_view(), name='api-create-launch-plan'),

    # Generation Usage endpoints
    path('generation-usage/', views.GenerationUsageView.as_view(), name='api-generation-usage'),

    # AI Caption endpoints
    path('ai-caption/generate/', views.generate_caption, name='api-generate-caption'),
    path('ai-caption/regenerate/<int:pk>/', views.regenerate_caption, name='api-regenerate-caption'),
    path('ai-caption/history/', views.CaptionHistoryView.as_view(), name='api-caption-history'),
    path('ai-caption/settings/', views.CaptionAPISettingsView.as_view(), name='api-caption-settings'),

    # AI Image endpoints
    path('ai-image/generate/', views.generate_image, name='api-generate-image'),
    path('ai-image/refine-prompt/', views.refine_image_prompt, name='api-refine-image-prompt'),
    path('ai-image/history/', views.ImageGenerationHistoryView.as_view(), name='api-image-history'),
    path('ai-image/settings/', views.ImageSettingsView.as_view(), name='api-image-settings'),

    # AI Video endpoints
    path('ai-video/generate/', views.generate_video, name='api-generate-video'),
    path('ai-video/history/', views.VideoGenerationHistoryView.as_view(), name='api-video-history'),
    path('ai-video/settings/', views.VideoSettingsView.as_view(), name='api-video-settings'),

    # AI Voice endpoints
    path('ai-voice/generate/', views.generate_voice, name='api-generate-voice'),
    path('ai-voice/preview/', views.preview_voice, name='api-preview-voice'),
    path('ai-voice/history/', views.VoiceGenerationHistoryView.as_view(), name='api-voice-history'),
    path('ai-voice/settings/', views.VoiceSettingsView.as_view(), name='api-voice-settings'),
    path('ai-voice/generation/<int:generation_id>/', views.get_voice_generation, name='api-voice-generation'),
    path('ai-voice/generation/<int:generation_id>/delete/', views.delete_voice_generation, name='api-voice-delete'),
    path('ai-voice/generation/<int:generation_id>/regenerate/', views.regenerate_voice, name='api-voice-regenerate'),

    # Messenger Bot endpoints
    path('messenger/dashboard/', views.MessengerDashboardView.as_view(), name='api-messenger-dashboard'),
    path('messenger/connections/<int:connection_id>/config/', views.AIConfigurationView.as_view(), name='api-ai-config'),
    path('messenger/connections/<int:connection_id>/pdfs/', views.PDFKnowledgeBaseViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='api-pdf-list'),
    path('messenger/connections/<int:connection_id>/pdfs/<int:pk>/', views.PDFKnowledgeBaseViewSet.as_view({
        'get': 'retrieve',
        'delete': 'destroy',
    }), name='api-pdf-detail'),
    path('messenger/connections/<int:connection_id>/conversations/', views.ConversationViewSet.as_view({
        'get': 'list',
    }), name='api-conversations'),
    path('messenger/connections/<int:connection_id>/conversations/<int:pk>/', views.ConversationViewSet.as_view({
        'get': 'retrieve',
    }), name='api-conversation-detail'),
    path('messenger/connections/<int:connection_id>/conversations/<int:pk>/toggle-takeover/', views.ConversationViewSet.as_view({
        'post': 'toggle_takeover',
    }), name='api-conversation-takeover'),
    path('messenger/connections/<int:connection_id>/conversations/<int:pk>/send-message/', views.ConversationViewSet.as_view({
        'post': 'send_message',
    }), name='api-conversation-send'),
    path('messenger/connections/<int:connection_id>/prompts/', views.CustomPromptViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='api-prompts'),
    path('messenger/connections/<int:connection_id>/prompts/<int:pk>/', views.CustomPromptViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'delete': 'destroy',
    }), name='api-prompt-detail'),
    path('messenger/connections/<int:connection_id>/prompts/<int:pk>/activate/', views.CustomPromptViewSet.as_view({
        'post': 'activate',
    }), name='api-prompt-activate'),
    path('messenger/connections/<int:connection_id>/crawl-website/', views.CrawlWebsiteView.as_view(), name='api-crawl-website'),

    # E-Commerce endpoints
    path('messenger/connections/<int:connection_id>/ecommerce/', views.ECommerceSettingsView.as_view(), name='api-ecommerce-settings'),
    path('messenger/connections/<int:connection_id>/ecommerce/test/', views.TestECommerceConnectionView.as_view(), name='api-ecommerce-test'),
    path('messenger/connections/<int:connection_id>/ecommerce/sync/', views.SyncProductsView.as_view(), name='api-ecommerce-sync'),
    path('messenger/connections/<int:connection_id>/ecommerce/embeddings/', views.RegenerateEmbeddingsView.as_view(), name='api-ecommerce-embeddings'),
    path('messenger/connections/<int:connection_id>/ecommerce/products/', views.ProductListView.as_view(), name='api-ecommerce-products'),

    # Brand DNA endpoints
    path('brands/<int:brand_id>/generate-dna/', views.GenerateBrandDNAView.as_view(), name='api-generate-brand-dna'),
    path('brands/<int:brand_id>/dna-status/', views.BrandDNAStatusView.as_view(), name='api-brand-dna-status'),
    path('brands/<int:brand_id>/regenerate-dna-inputs/', views.RegenerateBrandDNAFromInputsView.as_view(), name='api-regenerate-dna-inputs'),

    # Analytics endpoints (V1.1)
    path('analytics/summary/', views.AnalyticsSummaryView.as_view(), name='api-analytics-summary'),
    path('analytics/platforms/', views.PlatformAnalyticsView.as_view(), name='api-analytics-platforms'),
    path('analytics/trends/', views.AnalyticsTrendView.as_view(), name='api-analytics-trends'),
    path('analytics/top-posts/', views.TopPostsView.as_view(), name='api-top-posts'),

    # Support Chat
    path('support-chat/', views.SupportChatView.as_view(), name='api-support-chat'),

    # API Test
    path('test-claude/', views.TestClaudeAPIView.as_view(), name='api-test-claude'),

    # ============================
    # V1.2.1 NEW ENDPOINTS
    # ============================

    # Strategy & Pillars
    path('brands/<int:brand_id>/pillar-compliance/', strategy_views.PillarComplianceView.as_view(), name='api-pillar-compliance'),
    path('brands/<int:brand_id>/competitors/crawl/', strategy_views.CompetitorCrawlView.as_view(), name='api-competitor-crawl'),
    path('brands/<int:brand_id>/competitors/insights/', strategy_views.CompetitorInsightsView.as_view(), name='api-competitor-insights'),

    # Ideation
    path('ideas/generate/', strategy_views.GenerateIdeasView.as_view(), name='api-generate-ideas'),
    path('ideas/<int:idea_id>/regenerate/', strategy_views.RegenerateIdeaView.as_view(), name='api-regenerate-idea'),
    path('ideas/<int:idea_id>/add-to-calendar/', strategy_views.AddIdeaToCalendarView.as_view(), name='api-idea-to-calendar'),
    path('trending/', strategy_views.TrendingTopicsView.as_view(), name='api-trending'),

    # V1.3 — Overflow, Trending, DNA History, Idea History
    path('overflow/progress/', strategy_views.OverflowProgressView.as_view(), name='api-overflow-progress'),
    path('overflow/skip/', strategy_views.OverflowSkipView.as_view(), name='api-overflow-skip'),
    path('brands/<int:brand_id>/trending/generate/', strategy_views.GenerateTrendingView.as_view(), name='api-generate-trending'),
    path('brands/<int:brand_id>/trending/', strategy_views.BrandTrendingTopicsView.as_view(), name='api-brand-trending'),
    path('brands/<int:brand_id>/dna-history/', strategy_views.BrandDNAHistoryView.as_view(), name='api-dna-history'),
    path('brands/<int:brand_id>/dna-history/<int:history_id>/restore/', strategy_views.RestoreDNAView.as_view(), name='api-dna-restore'),
    path('ideas/history/', strategy_views.IdeaHistoryView.as_view(), name='api-idea-history'),

    # V1.4 — Competitor Suggest, Pillar Generate, Trend Feedback, Manual Trends, Scheduling
    path('competitors/suggest/', strategy_views.SuggestCompetitorsView.as_view(), name='api-suggest-competitors'),
    path('brands/<int:brand_id>/pillars/generate/', strategy_views.GeneratePillarsView.as_view(), name='api-generate-pillars'),
    path('brands/<int:brand_id>/trending/feedback/', strategy_views.TrendFeedbackView.as_view(), name='api-trend-feedback'),
    path('brands/<int:brand_id>/trending/manual/', strategy_views.ManualTrendView.as_view(), name='api-manual-trend'),
    path('brands/<int:brand_id>/prompt-history/', strategy_views.PromptHistoryView.as_view(), name='api-prompt-history'),
    path('schedule/compute-times/', scheduling_views.ComputeRecommendedTimesView.as_view(), name='api-compute-times'),

    # Draft Captions
    path('drafts/<int:post_id>/captions/', caption_views.DraftCaptionsView.as_view(), name='api-draft-captions'),
    path('drafts/<int:post_id>/captions/generate/', caption_views.GenerateCaptionsView.as_view(), name='api-generate-captions'),
    path('drafts/<int:post_id>/captions/adapt/', caption_views.AdaptCaptionView.as_view(), name='api-adapt-caption'),
    path('captions/<int:caption_id>/select/', caption_views.SelectCaptionView.as_view(), name='api-select-caption'),
    path('captions/<int:caption_id>/preview/<str:platform>/', caption_views.CaptionPreviewView.as_view(), name='api-caption-preview'),
    path('captions/<int:caption_id>/ab-tag/', caption_views.ABTagCaptionView.as_view(), name='api-ab-tag-caption'),

    # Draft Hashtags
    path('drafts/<int:post_id>/hashtags/', hashtag_views.DraftHashtagsView.as_view(), name='api-draft-hashtags'),
    path('drafts/<int:post_id>/hashtags/generate/', hashtag_views.GenerateHashtagsView.as_view(), name='api-generate-hashtags'),
    path('hashtags/<int:hashtag_id>/', hashtag_views.ToggleHashtagView.as_view(), name='api-toggle-hashtag'),

    # Draft Checklist
    path('drafts/<int:post_id>/checklist/', approval_views.DraftChecklistView.as_view(), name='api-draft-checklist'),

    # Approval Pipeline
    path('drafts/<int:post_id>/submit/', approval_views.SubmitForApprovalView.as_view(), name='api-submit-approval'),
    path('drafts/<int:post_id>/approve/', approval_views.ApprovePostView.as_view(), name='api-approve-post'),
    path('drafts/<int:post_id>/request-changes/', approval_views.RequestChangesView.as_view(), name='api-request-changes'),
    path('drafts/<int:post_id>/reject/', approval_views.RejectPostView.as_view(), name='api-reject-post'),
    path('approvals/pending/', approval_views.PendingApprovalsView.as_view(), name='api-pending-approvals'),
    path('drafts/<int:post_id>/approval-log/', approval_views.ApprovalLogView.as_view(), name='api-approval-log'),

    # Scheduling
    path('drafts/<int:post_id>/schedule/', scheduling_views.SchedulePostView.as_view(), name='api-schedule-post'),
    path('scheduled-posts/<int:spp_id>/', scheduling_views.RescheduleView.as_view(), name='api-reschedule'),
    path('schedule/calendar/', scheduling_views.CalendarView.as_view(), name='api-calendar'),
    path('brands/<int:brand_id>/best-times/', scheduling_views.BestTimeSuggestionsView.as_view(), name='api-best-times'),
    path('schedule/conflict-check/', scheduling_views.ConflictCheckView.as_view(), name='api-conflict-check'),

    # Post Analytics (V1.2.1)
    path('posts/<int:post_id>/stats/', v2_analytics_views.PostQuickStatsView.as_view(), name='api-post-stats'),
    path('posts/<int:post_id>/comments/', v2_analytics_views.PostCommentsView.as_view(), name='api-post-comments'),
    path('comments/<int:comment_id>/reply/', v2_analytics_views.ReplyToCommentView.as_view(), name='api-reply-comment'),
    path('comments/<int:comment_id>/ai-reply/', v2_analytics_views.AIReplyToCommentView.as_view(), name='api-ai-reply-comment'),
    path('brands/<int:brand_id>/weekly-report/', v2_analytics_views.WeeklyReportView.as_view(), name='api-weekly-report-v2'),
    path('brands/<int:brand_id>/analytics/dashboard/', v2_analytics_views.AnalyticsDashboardView.as_view(), name='api-analytics-dashboard'),
    path('brands/<int:brand_id>/ab-results/', v2_analytics_views.ABTestResultsView.as_view(), name='api-ab-results'),

    # Learning & Repurposing
    path('brands/<int:brand_id>/learning-signals/', v2_analytics_views.LearningSignalsView.as_view(), name='api-learning-signals'),
    path('brands/<int:brand_id>/winners/', v2_analytics_views.WinnerPostsView.as_view(), name='api-winner-posts'),
    path('posts/<int:post_id>/repurpose/', v2_analytics_views.RepurposePostView.as_view(), name='api-repurpose-post'),

    # Creative Assets (V1.2.1)
    path('assets/<int:asset_id>/alt-text/', creative_views.GenerateAltTextView.as_view(), name='api-generate-alt-text'),
    path('assets/<int:asset_id>/resize/', creative_views.ResizeAssetView.as_view(), name='api-resize-asset'),
    path('assets/<int:asset_id>/apply-template/', creative_views.ApplyTemplateView.as_view(), name='api-apply-template'),
    path('assets/<int:asset_id>/versions/', creative_views.AssetVersionsView.as_view(), name='api-asset-versions'),
    path('assets/<int:asset_id>/regenerate/', creative_views.AssetRegenerateView.as_view(), name='api-asset-regenerate'),

    # Draft-Scoped Assets (V1.2.1)
    path('posts/<int:post_id>/assets/', creative_views.DraftAssetsListView.as_view(), name='api-post-assets'),
    path('drafts/<int:post_id>/assets/', creative_views.DraftAssetsListView.as_view(), name='api-draft-assets'),
    path('drafts/<int:post_id>/assets/generate/', creative_views.DraftAssetGenerateView.as_view(), name='api-draft-asset-generate'),
    path('drafts/<int:post_id>/assets/upload/', creative_views.DraftAssetUploadView.as_view(), name='api-draft-asset-upload'),
    path('drafts/<int:post_id>/assets/carousel-split/', creative_views.CarouselSplitView.as_view(), name='api-carousel-split'),

    # Clone Draft (V1.2.1)
    path('drafts/<int:post_id>/clone/', creative_views.CloneDraftView.as_view(), name='api-clone-draft'),

    # Prompt Engineering
    path('prompt-engineer/generate/', creative_views.PromptEngineerGenerateView.as_view(), name='api-prompt-engineer-generate'),
    path('prompt-engineer/diagnose/', creative_views.PromptEngineerDiagnoseView.as_view(), name='api-prompt-engineer-diagnose'),
    path('prompt-engineer/reprompt/', creative_views.PromptEngineerRepromptView.as_view(), name='api-prompt-engineer-reprompt'),

    # Copy Overlay (V1.2.2)
    path('copy-overlay/generate-text/', creative_views.GenerateCopyOverlayTextView.as_view(), name='api-copy-overlay-generate'),
    path('assets/<int:asset_id>/copy-overlay/', creative_views.ApplyCopyOverlayView.as_view(), name='api-apply-copy-overlay'),
    path('assets/<int:asset_id>/copy-overlay/ai-styles/', creative_views.GenerateAIStylesView.as_view(), name='api-copy-overlay-ai-styles'),

    # Notifications (V1.2.1)
    path('notifications/', notification_views.NotificationListView.as_view(), name='api-notifications'),
    path('notifications/unread-count/', notification_views.UnreadCountView.as_view(), name='api-notification-unread'),
    path('notifications/mark-all-read/', notification_views.MarkAllNotificationsReadView.as_view(), name='api-mark-all-read'),
    path('notifications/<int:notification_id>/read/', notification_views.MarkNotificationReadView.as_view(), name='api-mark-notification-read'),
    path('notifications/<int:notification_id>/', notification_views.DeleteNotificationView.as_view(), name='api-delete-notification'),

    # RBAC (V1.2.1)
    path('workspaces/<int:workspace_id>/roles/', rbac_views.WorkspaceRolesView.as_view(), name='api-workspace-roles'),
    path('workspaces/<int:workspace_id>/roles/assign/', rbac_views.AssignRoleView.as_view(), name='api-assign-role'),
    path('workspaces/<int:workspace_id>/roles/remove/', rbac_views.RemoveRoleView.as_view(), name='api-remove-role'),
    path('my-roles/', rbac_views.MyRolesView.as_view(), name='api-my-roles'),

    # Admin Panel API
    path('admin/dashboard/', admin_views.AdminDashboardView.as_view(), name='api-admin-dashboard'),
    path('admin/users/', admin_views.AdminUserListView.as_view(), name='api-admin-users'),
    path('admin/users/<int:user_id>/', admin_views.AdminUserDetailView.as_view(), name='api-admin-user-detail'),
    path('admin/users/<int:user_id>/approve/', admin_views.AdminApproveUserView.as_view(), name='api-admin-approve'),
    path('admin/users/<int:user_id>/reject/', admin_views.AdminRejectUserView.as_view(), name='api-admin-reject'),
    path('admin/users/<int:user_id>/plan/', admin_views.AdminUpdatePlanView.as_view(), name='api-admin-plan'),
    path('admin/users/<int:user_id>/api-settings/', admin_views.AdminAPISettingsView.as_view(), name='api-admin-api-settings'),
    path('admin/users/<int:user_id>/posts/', admin_views.AdminUserPostsView.as_view(), name='api-admin-user-posts'),
    path('admin/users/<int:user_id>/accounts/', admin_views.AdminUserAccountsView.as_view(), name='api-admin-user-accounts'),
    path('admin/users/<int:user_id>/captions/', admin_views.AdminUserCaptionsView.as_view(), name='api-admin-user-captions'),
    path('admin/users/<int:user_id>/images/', admin_views.AdminUserImagesView.as_view(), name='api-admin-user-images'),
    path('admin/users/<int:user_id>/videos/', admin_views.AdminUserVideosView.as_view(), name='api-admin-user-videos'),
    path('admin/users/<int:user_id>/messenger/', admin_views.AdminUserMessengerView.as_view(), name='api-admin-user-messenger'),
    path('admin/conversations/<int:conv_id>/messages/', admin_views.AdminConversationMessagesView.as_view(), name='api-admin-conv-messages'),
    path('admin/analytics/', admin_views.AdminAnalyticsView.as_view(), name='api-admin-analytics'),
    path('admin/bulk-approve/', admin_views.AdminBulkApproveView.as_view(), name='api-admin-bulk-approve'),

    # Diamond Token endpoints
    path('diamond/balance/', diamond_views.DiamondBalanceView.as_view(), name='api-diamond-balance'),
    path('diamond/usage/', diamond_views.DiamondUsageView.as_view(), name='api-diamond-usage'),
    path('diamond/transactions/', diamond_views.DiamondTransactionsView.as_view(), name='api-diamond-transactions'),
    path('diamond/cost-preview/', diamond_views.DiamondCostPreviewView.as_view(), name='api-diamond-cost-preview'),
    path('diamond/costs/', diamond_views.DiamondCostTableView.as_view(), name='api-diamond-costs'),

    # Diamond Admin endpoints
    path('admin/users/<int:user_id>/recharge/', diamond_views.AdminRechargeView.as_view(), name='api-admin-recharge'),
    path('admin/global-api-keys/', diamond_views.AdminGlobalAPIKeysView.as_view(), name='api-admin-global-keys'),
    path('admin/diamond-overview/', diamond_views.AdminDiamondOverviewView.as_view(), name='api-admin-diamond-overview'),

    # ViewSet routes
    path('', include(router.urls)),
]
