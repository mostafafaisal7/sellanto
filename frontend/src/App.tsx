import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/layout';
import { AdminLayout } from './components/admin/AdminLayout';
import {
  DashboardPage,
  LoginPage,
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
  // V2 Redesign
  ModeSelectPage,
  MagicModePage,
  MagicHistoryPage,
  MagicDraftPage,
  GettingStartedPage,
  SetupFlowPage,
  DraftPostsPage,
  OverflowHistoryPage,
  // Dev / Test
  APITestPage,
} from './pages';
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminUserDetailPage,
  AdminAPIKeysPage,
  AdminFacebookSettingsPage,
} from './pages/admin';
import { LoadingScreen } from './components/ui';
import { useAuthStore } from './store';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();
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

  // Force onboarding for first-time users
  if (user?.onboarding_status?.needs_onboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Force onboarding if user has no brand (business profile empty)
  if (user && user.has_brand === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
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
    // Regular users land on mode select page
    return <Navigate to="/mode-select" replace />;
  }

  return <>{children}</>;
}

// Admin route wrapper - only allows staff users
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  if (!user?.is_staff) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
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

        {/* Onboarding route (no layout, full screen) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Mode Select (full-screen, no layout) */}
        <Route
          path="/mode-select"
          element={
            <ProtectedRoute>
              <ModeSelectPage />
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
          <Route path="/" element={<DashboardPage />} />
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

          {/* V2 Redesign Routes */}
          <Route path="/getting-started" element={<GettingStartedPage />} />
          <Route path="/setup/*" element={<SetupFlowPage />} />
          <Route path="/magic/history" element={<MagicHistoryPage />} />
          <Route path="/magic/draft" element={<MagicDraftPage />} />

          {/* Dev / Test */}
          <Route path="/test-api" element={<APITestPage />} />

          {/* Info Pages */}
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
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
