from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from platforms.oauth_views import (
    facebook_oauth_initiate,
    facebook_oauth_callback,
    facebook_setup_messenger,
    facebook_connection_status,
)
from platforms.linkedin_oauth_views import (
    linkedin_oauth_initiate,
    linkedin_oauth_callback,
    linkedin_connection_status,
    linkedin_community_oauth_initiate,
    linkedin_community_oauth_callback,
)
from platforms.pinterest_oauth_views import (
    pinterest_oauth_initiate,
    pinterest_oauth_callback,
    pinterest_connection_status,
    pinterest_list_boards,
)
from platforms.youtube_oauth_views import (
    youtube_oauth_initiate,
    youtube_oauth_callback,
    youtube_connection_status,
)
from platforms.reddit_oauth_views import (
    reddit_oauth_initiate,
    reddit_oauth_callback,
    reddit_connection_status,
)
from platforms.tiktok_oauth_views import (
    tiktok_oauth_initiate,
    tiktok_oauth_callback,
    tiktok_connection_status,
)
from . import admin_views
from . import strategy_views
from . import caption_views
from . import hashtag_views
from . import subscription_views
from . import approval_views
from . import scheduling_views
from . import notification_views
from . import creative_views
from . import rbac_views
from . import diamond_views
from . import payment_views
from . import finance_views
from . import stripe_views

# Create router for viewsets
router = DefaultRouter()
router.register(r'posts', views.PostViewSet, basename='post')
router.register(r'platforms', views.SocialAccountViewSet, basename='platform')
router.register(r'platforms-detail', views.SocialAccountDetailViewSet, basename='platform-detail')

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
    # ── Facebook OAuth & Connection Status ───────────────────────────────────
    path('platforms/facebook/initiate/',        facebook_oauth_initiate,    name='fb-oauth-initiate'),
    path('platforms/facebook/callback/',        facebook_oauth_callback,    name='fb-oauth-callback'),
    path('platforms/facebook/setup-messenger/', facebook_setup_messenger,   name='fb-setup-messenger'),
    path('platforms/facebook/status/',          facebook_connection_status, name='fb-conn-status'),

    # ── LinkedIn OAuth & Connection Status ──────────────────────────────────
    path('platforms/linkedin/initiate/',            linkedin_oauth_initiate,            name='li-oauth-initiate'),
    path('platforms/linkedin/callback/',            linkedin_oauth_callback,            name='li-oauth-callback'),
    path('platforms/linkedin/status/',              linkedin_connection_status,         name='li-conn-status'),
    path('platforms/linkedin/community/initiate/', linkedin_community_oauth_initiate,  name='li-community-initiate'),
    path('platforms/linkedin/community/callback/', linkedin_community_oauth_callback,  name='li-community-callback'),

    # ── YouTube OAuth & Connection Status ───────────────────────────────────
    path('platforms/youtube/initiate/', youtube_oauth_initiate, name='yt-oauth-initiate'),
    path('platforms/youtube/callback/', youtube_oauth_callback, name='yt-oauth-callback'),
    path('platforms/youtube/status/',   youtube_connection_status, name='yt-conn-status'),

    # ── Pinterest OAuth & Connection Status ──────────────────────────────────
    path('platforms/pinterest/initiate/', pinterest_oauth_initiate, name='pin-oauth-initiate'),
    path('platforms/pinterest/callback/', pinterest_oauth_callback, name='pin-oauth-callback'),
    path('platforms/pinterest/status/',   pinterest_connection_status, name='pin-conn-status'),
    path('platforms/pinterest/boards/',   pinterest_list_boards, name='pin-boards'),

    # ── Reddit OAuth & Connection Status ──────────────────────────────────
    path('platforms/reddit/initiate/', reddit_oauth_initiate, name='reddit-oauth-initiate'),
    path('platforms/reddit/callback/', reddit_oauth_callback, name='reddit-oauth-callback'),
    path('platforms/reddit/status/',   reddit_connection_status, name='reddit-conn-status'),

    # ── TikTok OAuth & Connection Status ──────────────────────────────────
    path('platforms/tiktok/initiate/', tiktok_oauth_initiate, name='tt-oauth-initiate'),
    path('platforms/tiktok/callback/', tiktok_oauth_callback, name='tt-oauth-callback'),
    path('platforms/tiktok/status/',   tiktok_connection_status, name='tt-conn-status'),

    # Auth endpoints
    path('auth/register/', views.RegisterView.as_view(), name='api-register'),
    path('auth/register-with-brand/', views.RegisterWithBrandView.as_view(), name='api-register-with-brand'),
    path('auth/login/', views.LoginView.as_view(), name='api-login'),
    path('auth/logout/', views.LogoutView.as_view(), name='api-logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('auth/me/', views.CurrentUserView.as_view(), name='api-current-user'),
    path('auth/verify-otp/', views.VerifyOTPView.as_view(), name='api-verify-otp'),
    path('auth/resend-otp/', views.ResendOTPView.as_view(), name='api-resend-otp'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='api-change-password'),
    path('auth/forgot-password/', views.ForgotPasswordRequestView.as_view(), name='api-forgot-password'),
    path('auth/forgot-password/resend/', views.ForgotPasswordResendView.as_view(), name='api-forgot-password-resend'),
    path('auth/forgot-password/verify/', views.ForgotPasswordVerifyView.as_view(), name='api-forgot-password-verify'),

    # User Profile endpoints
    path('profile/', views.UserProfileView.as_view(), name='api-profile'),
    path('profile/api-keys/', views.GlobalAPIKeysView.as_view(), name='api-global-keys'),

    # Subscription / Upgrade Plan endpoints
    path('subscription/', subscription_views.SubscriptionStatusView.as_view(), name='api-subscription-status'),
    path('subscription/plans/', subscription_views.SubscriptionPlansView.as_view(), name='api-subscription-plans'),
    path('subscription/upgrade/', subscription_views.SubscriptionUpgradeView.as_view(), name='api-subscription-upgrade'),

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

    # AI Image endpoints
    path('ai-image/generate/', views.generate_image, name='api-generate-image'),
    path('ai-image/refine-prompt/', views.refine_image_prompt, name='api-refine-image-prompt'),

    # Messenger Bot endpoints
    path('messenger/dashboard/', views.MessengerDashboardView.as_view(), name='api-messenger-dashboard'),
    path('messenger/connections/<int:connection_id>/config/', views.AIConfigurationView.as_view(), name='api-ai-config'),
    path('messenger/connections/<int:connection_id>/pdfs/', views.PDFKnowledgeBaseViewSet.as_view({
        'get': 'list', 'post': 'create',
    }), name='api-pdf-list'),
    path('messenger/connections/<int:connection_id>/pdfs/<int:pk>/', views.PDFKnowledgeBaseViewSet.as_view({
        'get': 'retrieve', 'delete': 'destroy',
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
        'get': 'list', 'post': 'create',
    }), name='api-prompts'),
    path('messenger/connections/<int:connection_id>/prompts/<int:pk>/', views.CustomPromptViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'delete': 'destroy',
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
    path('admin/facebook-settings/',    admin_views.FacebookSettingsView.as_view(),        name='api-admin-fb-settings'),
    path('admin/facebook-accounts/',    admin_views.AdminFacebookAccountsView.as_view(),   name='api-admin-facebook-accounts'),
    path('admin/linkedin-settings/',    admin_views.LinkedInSettingsView.as_view(),        name='api-admin-li-settings'),
    path('admin/linkedin-accounts/',    admin_views.AdminLinkedInAccountsView.as_view(),   name='api-admin-linkedin-accounts'),
    path('admin/youtube-settings/',     admin_views.YouTubeSettingsView.as_view(),         name='api-admin-yt-settings'),
    path('admin/youtube-accounts/',     admin_views.AdminYouTubeAccountsView.as_view(),    name='api-admin-youtube-accounts'),
    path('admin/pinterest-settings/',   admin_views.PinterestSettingsView.as_view(),       name='api-admin-pin-settings'),
    path('admin/pinterest-accounts/',   admin_views.AdminPinterestAccountsView.as_view(),  name='api-admin-pinterest-accounts'),
    path('admin/reddit-settings/',      admin_views.RedditSettingsView.as_view(),          name='api-admin-reddit-settings'),
    path('admin/reddit-accounts/',      admin_views.AdminRedditAccountsView.as_view(),     name='api-admin-reddit-accounts'),
    path('admin/tiktok-settings/',      admin_views.TikTokSettingsView.as_view(),          name='api-admin-tiktok-settings'),
    path('admin/tiktok-accounts/',      admin_views.AdminTikTokAccountsView.as_view(),     name='api-admin-tiktok-accounts'),
    path('admin/messenger-webhooks/',   admin_views.AdminMessengerWebhooksView.as_view(),  name='api-admin-messenger-webhooks'),
    path('admin/setup-messenger/',      admin_views.AdminSetupMessengerView.as_view(),     name='api-admin-setup-messenger'),
    path('admin/check-subscription/',   admin_views.AdminCheckSubscriptionView.as_view(),  name='api-admin-check-subscription'),
    path('admin/test-webhook/',         admin_views.AdminTestWebhookView.as_view(),        name='api-admin-test-webhook'),
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
    path('admin/users/<int:user_id>/messenger/', admin_views.AdminUserMessengerView.as_view(), name='api-admin-user-messenger'),

    # Per-user Magic Mode prompt overrides (admin-only)
    path('admin/users/<int:user_id>/prompt-overrides/',
         admin_views.AdminPromptOverridesListView.as_view(),
         name='api-admin-prompt-overrides'),
    path('admin/users/<int:user_id>/prompt-overrides/<str:prompt_type>/',
         admin_views.AdminPromptOverrideDetailView.as_view(),
         name='api-admin-prompt-override-detail'),
    path('admin/users/<int:user_id>/prompt-overrides/<str:prompt_type>/audit/',
         admin_views.AdminPromptOverrideAuditView.as_view(),
         name='api-admin-prompt-override-audit'),
    path('admin/users/<int:user_id>/prompt-executions/',
         admin_views.AdminPromptExecutionHistoryView.as_view(),
         name='api-admin-prompt-executions'),
    path('admin/conversations/<int:conv_id>/messages/', admin_views.AdminConversationMessagesView.as_view(), name='api-admin-conv-messages'),
    path('admin/bulk-approve/', admin_views.AdminBulkApproveView.as_view(), name='api-admin-bulk-approve'),

    # Diamond Token endpoints
    path('diamond/balance/', diamond_views.DiamondBalanceView.as_view(), name='api-diamond-balance'),
    path('diamond/usage/', diamond_views.DiamondUsageView.as_view(), name='api-diamond-usage'),
    path('diamond/transactions/', diamond_views.DiamondTransactionsView.as_view(), name='api-diamond-transactions'),
    path('diamond/cost-preview/', diamond_views.DiamondCostPreviewView.as_view(), name='api-diamond-cost-preview'),
    path('diamond/costs/', diamond_views.DiamondCostTableView.as_view(), name='api-diamond-costs'),
    path('diamond/usage-timeseries/', diamond_views.DiamondUsageTimeseriesView.as_view(), name='api-diamond-usage-timeseries'),
    path('diamond/plan-history/', diamond_views.DiamondPlanHistoryView.as_view(), name='api-diamond-plan-history'),
    path('diamond/forecast/', diamond_views.DiamondForecastView.as_view(), name='api-diamond-forecast'),

    # Payment / Billing — user
    path('payments/methods/', payment_views.PayoutMethodsView.as_view(), name='api-payment-methods'),
    path('payments/submit/', payment_views.SubmitPaymentView.as_view(), name='api-payment-submit'),
    path('payments/my-requests/', payment_views.MyPaymentRequestsView.as_view(), name='api-payment-my-requests'),
    # One-click approve/reject from admin email — no auth, token signs the action.
    path('payments/action/<str:token>/', payment_views.payment_action_by_token, name='api-payment-action-by-token'),

    # Billing — Stripe (card-on-file primary)
    path('billing/stripe/charge/',
         stripe_views.CreateChargeIntentView.as_view(),
         name='api-stripe-charge'),
    path('billing/stripe/charge-saved/',
         stripe_views.ChargeOffSessionView.as_view(),
         name='api-stripe-charge-saved'),
    path('billing/stripe/subscribe/',
         stripe_views.CreateSubscriptionView.as_view(),
         name='api-stripe-subscribe'),
    path('billing/stripe/payment-methods/',
         stripe_views.PaymentMethodsView.as_view(),
         name='api-stripe-payment-methods'),
    path('billing/stripe/payment-methods/<str:pm_id>/',
         stripe_views.PaymentMethodDetailView.as_view(),
         name='api-stripe-payment-method-detail'),
    path('billing/stripe/has-card/',
         stripe_views.HasCardOnFileView.as_view(),
         name='api-stripe-has-card'),
    path('billing/stripe/cancel/',
         stripe_views.CancelSubscriptionView.as_view(),
         name='api-stripe-cancel'),
    path('billing/stripe/session/<str:session_id>/',
         stripe_views.CheckoutSessionStatusView.as_view(),
         name='api-stripe-session-status'),
    path('billing/stripe/topup-catalog/',
         stripe_views.TopupCatalogView.as_view(),
         name='api-stripe-topup-catalog'),
    path('billing/stripe/diamond-rate/',
         stripe_views.DiamondRateView.as_view(),
         name='api-stripe-diamond-rate'),
    path('billing/stripe/webhook/',
         stripe_views.StripeWebhookView.as_view(),
         name='api-stripe-webhook'),

    # Billing — Payment history & refunds (user-facing)
    path('billing/payments/',
         stripe_views.PaymentHistoryView.as_view(),
         name='api-billing-payments'),
    path('billing/refunds/request/',
         stripe_views.RequestRefundView.as_view(),
         name='api-billing-refund-request'),

    # Billing — Ad-boost wallet reservation
    path('billing/boost/reserve/',
         stripe_views.BoostReserveView.as_view(),
         name='api-billing-boost-reserve'),
    path('billing/boost/release/',
         stripe_views.BoostReleaseView.as_view(),
         name='api-billing-boost-release'),

    # Admin — refunds queue
    path('admin/refunds/',
         admin_views.AdminRefundListView.as_view(),
         name='api-admin-refunds'),
    path('admin/refunds/<int:pr_id>/<str:action>/',
         admin_views.AdminRefundActionView.as_view(),
         name='api-admin-refund-action'),

    # Admin — Stripe settings test connection
    path('admin/stripe-settings/test/',
         admin_views.AdminStripeSettingsTestView.as_view(),
         name='api-admin-stripe-settings-test'),

    # Billing — Stripe Hosted Checkout (legacy / 3DS fallback path)
    path('billing/stripe/checkout/',
         stripe_views.CreatePlanCheckoutView.as_view(),
         name='api-stripe-checkout'),
    path('billing/stripe/topup/',
         stripe_views.CreateTopupCheckoutView.as_view(),
         name='api-stripe-topup'),

    # Payment / Billing — admin
    path('admin/payments/', payment_views.AdminPaymentRequestListView.as_view(), name='api-admin-payments-list'),
    path('admin/payments/<int:payment_id>/approve/', payment_views.AdminPaymentApproveView.as_view(), name='api-admin-payments-approve'),
    path('admin/payments/<int:payment_id>/reject/', payment_views.AdminPaymentRejectView.as_view(), name='api-admin-payments-reject'),
    path('admin/payout-accounts/', payment_views.AdminPayoutAccountListView.as_view(), name='api-admin-payout-accounts'),
    path('admin/payout-accounts/<int:account_id>/', payment_views.AdminPayoutAccountDetailView.as_view(), name='api-admin-payout-account-detail'),

    # Admin Stripe Settings (DB-stored Stripe keys & price IDs)
    path('admin/stripe-settings/',
         admin_views.AdminStripeSettingsView.as_view(),
         name='api-admin-stripe-settings'),

    # Admin Email Settings (DB-stored SMTP config)
    path('admin/email-settings/',        admin_views.AdminEmailSettingsView.as_view(),     name='api-admin-email-settings'),
    path('admin/email-settings/update/', admin_views.AdminEmailSettingsView.as_view(),     name='api-admin-email-settings-update'),
    path('admin/email-settings/test/',   admin_views.AdminEmailSettingsTestView.as_view(), name='api-admin-email-settings-test'),

    # Admin Finance / Accounting
    path('admin/finance/summary/', finance_views.FinanceSummaryView.as_view(), name='api-admin-finance-summary'),
    path('admin/finance/revenue/', finance_views.RevenueListView.as_view(), name='api-admin-finance-revenue'),
    path('admin/finance/expenses/', finance_views.ExpenseListView.as_view(), name='api-admin-finance-expenses'),
    path('admin/finance/expenses/<int:expense_id>/', finance_views.ExpenseDetailView.as_view(), name='api-admin-finance-expense-detail'),
    path('admin/finance/auto-expenses/', finance_views.AutoExpensesView.as_view(), name='api-admin-finance-auto-expenses'),

    # Diamond Admin endpoints
    path('admin/users/<int:user_id>/recharge/', diamond_views.AdminRechargeView.as_view(), name='api-admin-recharge'),
    path('admin/global-api-keys/', diamond_views.AdminGlobalAPIKeysView.as_view(), name='api-admin-global-keys'),
    path('admin/test-api-key/', diamond_views.AdminTestAPIKeyView.as_view(), name='api-admin-test-api-key'),
    path('admin/diamond-overview/', diamond_views.AdminDiamondOverviewView.as_view(), name='api-admin-diamond-overview'),

    # Video AI (React-accessible JWT endpoints)
    path('video/generate/', views.VideoGenerateAPIView.as_view(), name='api-video-generate'),
    path('video/history/', views.VideoHistoryAPIView.as_view(), name='api-video-history'),

    # Magic Mode History
    path('magic/history/', views.MagicHistoryView.as_view(), name='api-magic-history'),

    # Magic Mode Cached Posts Lookup (with user_id and optional custom parameter)
    path('magic/posts/<int:user_id>/<str:industry>/<str:goal>/<str:tone>/<str:platforms>/<str:colors>/<str:custom>/',
         views.MagicModeCachedPostsView.as_view(), name='api-magic-cached-posts-user-custom'),
    path('magic/posts/<int:user_id>/<str:industry>/<str:goal>/<str:tone>/<str:platforms>/<str:colors>/',
         views.MagicModeCachedPostsView.as_view(), name='api-magic-cached-posts-user'),
    # Backward compatibility (old URLs without user_id)
    path('magic/posts/<str:industry>/<str:goal>/<str:tone>/<str:platforms>/<str:colors>/<str:custom>/',
         views.MagicModeCachedPostsView.as_view(), name='api-magic-cached-posts-custom'),
    path('magic/posts/<str:industry>/<str:goal>/<str:tone>/<str:platforms>/<str:colors>/',
         views.MagicModeCachedPostsView.as_view(), name='api-magic-cached-posts'),

    # Paid ads automation (Meta + Google Ads) — mounted under /api/v1/ads/
    path('ads/', include('ads.urls')),

    # ViewSet routes
    path('', include(router.urls)),
]
