import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, PublicLayout } from './components/layout';
import { AdminLayout } from './components/admin/AdminLayout';
import {
  DashboardPage,
  LandingPage,
  LoginPage,
  ForgotPasswordPage,
  UpgradePage,
  SuccessPage,
  CancelPage,
  BuyDiamondsPage,
  PaymentMethodsPage,
  PaymentHistoryPage,
  DiamondAnalyticsPage,
  MyPostsPage,
  CreatePostPage,
  ConnectAccountsPage,
  ProfilePage,
  SettingsPage,
  OnboardingPage,
  BusinessProfilePage,
  AboutPage,
  PrivacyPage,
  TermsPage,
  HelpPage,
  // V1.2.1
  StrategyHubPage,
  IdeasHubPage,
  CalendarPage,
  ApprovalReviewPage,
  PermissionsPage,
  // V1.3
  OverflowPage,
  IdeaHistoryPage,
  // Messenger Bot
  MessengerBotPage,
  // V2 Redesign
  MagicModePage,
  MagicHistoryPage,
  MagicDraftPage,
  GettingStartedPage,
  SetupFlowPage,
  DraftPostsPage,
  OverflowHistoryPage,
  // Video AI
  VideoAIPage,
  // Meta App Review pages
  LeadsPage,
  AdsPage,
  CommentsPage,
  InstagramContentPage,
  DiscoverPage,
  // Dev / Test
  APITestPage,
} from './pages';
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminUserDetailPage,
  AdminAPIKeysPage,
  AdminFacebookSettingsPage,
  AdminPaymentsPage,
  AdminFinancePage,
  AdminFeatureCostsPage,
  AdminStripeSettingsPage,
  AdminRefundsPage,
  AdminLinkedInSettingsPage,
  AdminPinterestSettingsPage,
  AdminYouTubeSettingsPage,
  AdminRedditSettingsPage,
  AdminTikTokSettingsPage,
  AdminEmailSettingsPage,
} from './pages/admin';
import { LoadingScreen } from './components/ui';
import { useAuthStore, useAdminStore } from './store';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();
  const { impersonatedUserId } = useAdminStore();
  const location = useLocation();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Skip onboarding gate when admin is impersonating — check both Zustand store and
  // localStorage directly to guard against any store-hydration timing edge cases.
  const isImpersonating = !!impersonatedUserId || !!localStorage.getItem('impersonate_user_id');
  if (!isImpersonating) {
    // Force onboarding for first-time users
    if (user?.onboarding_status?.needs_onboarding && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }

    // Force onboarding if user has no brand (business profile empty)
    if (user && user.has_brand === false && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}

// Public route wrapper (redirects to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    // Admin users go to admin panel
    if (user?.is_staff) {
      return <Navigate to="/admin-panel" replace />;
    }
    // Regular users land on dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Root route — public landing for logged-out, redirect to dashboard for logged-in
function RootRoute() {
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    if (user?.is_staff) {
      return <Navigate to="/admin-panel" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}

// Admin route wrapper - only allows staff users
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  if (!user?.is_staff) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root — public landing page (or redirect to dashboard if logged in) */}
        <Route path="/" element={<RootRoute />} />

        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        {/* Forgot-password is accessible whether or not the user is signed in —
            logged-in users can still reach it from the profile page if they
            don't remember their current password. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Onboarding route (no layout, full screen) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Magic Mode (full-screen wizard, no layout) */}
        <Route
          path="/magic"
          element={
            <ProtectedRoute>
              <MagicModePage />
            </ProtectedRoute>
          }
        />

        {/* Business Profile - accessible even during onboarding (has inline setup wizard) */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/business-profile" element={<BusinessProfilePage />} />
        </Route>

        {/* Protected routes with layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/billing/success" element={<SuccessPage />} />
          <Route path="/billing/cancelled" element={<CancelPage />} />
          <Route path="/buy-diamonds" element={<BuyDiamondsPage />} />
          <Route path="/settings/payment-methods" element={<PaymentMethodsPage />} />
          <Route path="/settings/payments" element={<PaymentHistoryPage />} />
          <Route path="/analytics/diamond" element={<DiamondAnalyticsPage />} />
          <Route path="/posts" element={<MyPostsPage />} />
          <Route path="/posts/drafts" element={<DraftPostsPage />} />
          <Route path="/posts/create" element={<CreatePostPage />} />
          <Route path="/posts/:id/edit" element={<CreatePostPage />} />
          <Route path="/platforms" element={<ConnectAccountsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* V1.2.1 Routes */}
          <Route path="/strategy" element={<StrategyHubPage />} />
          <Route path="/ideas" element={<IdeasHubPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/approvals" element={<ApprovalReviewPage />} />
          <Route path="/settings/permissions" element={<PermissionsPage />} />

          {/* V1.3 Routes */}
          <Route path="/overflow" element={<OverflowPage />} />
          <Route path="/overflow/history" element={<OverflowHistoryPage />} />
          <Route path="/ideas/history" element={<IdeaHistoryPage />} />

          {/* Messenger Bot */}
          <Route path="/messenger" element={<MessengerBotPage />} />

          {/* V2 Redesign Routes */}
          <Route path="/getting-started" element={<GettingStartedPage />} />
          <Route path="/setup/*" element={<SetupFlowPage />} />
          <Route path="/magic/history" element={<MagicHistoryPage />} />
          <Route path="/magic/draft" element={<MagicDraftPage />} />

          {/* Video AI */}
          <Route path="/video-ai" element={<VideoAIPage />} />

          {/* Meta App Review — permission demonstration pages */}
          <Route path="/comments" element={<CommentsPage />} />
          <Route path="/instagram-content" element={<InstagramContentPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/ads" element={<AdsPage />} />

          {/* Dev / Test */}
          <Route path="/test-api" element={<APITestPage />} />

        </Route>

        {/* Public info pages — accessible without login */}
        <Route element={<PublicLayout />}>
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>

        {/* Admin Panel routes */}
        <Route
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }
        >
          <Route path="/admin-panel" element={<AdminDashboardPage />} />
          <Route path="/admin-panel/users" element={<AdminUsersPage />} />
          <Route path="/admin-panel/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin-panel/api-keys" element={<AdminAPIKeysPage />} />
          <Route path="/admin-panel/facebook-settings" element={<AdminFacebookSettingsPage />} />
          <Route path="/admin-panel/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin-panel/finance" element={<AdminFinancePage />} />
          <Route path="/admin-panel/feature-costs" element={<AdminFeatureCostsPage />} />
          <Route path="/admin-panel/stripe-settings" element={<AdminStripeSettingsPage />} />
          <Route path="/admin-panel/refunds" element={<AdminRefundsPage />} />
          <Route path="/admin-panel/linkedin-settings" element={<AdminLinkedInSettingsPage />} />
          <Route path="/admin-panel/pinterest-settings" element={<AdminPinterestSettingsPage />} />
          <Route path="/admin-panel/youtube-settings" element={<AdminYouTubeSettingsPage />} />
          <Route path="/admin-panel/reddit-settings" element={<AdminRedditSettingsPage />} />
          <Route path="/admin-panel/tiktok-settings" element={<AdminTikTokSettingsPage />} />
          <Route path="/admin-panel/email-settings" element={<AdminEmailSettingsPage />} />
        </Route>

        {/* Catch all - redirect to root (which routes to landing or dashboard) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
