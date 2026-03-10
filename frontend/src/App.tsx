import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  AICaptionPage,
  AIImagePage,
  AIVideoPage,
  AIVoicePage,
  MessengerBotPage,
  AnalyticsPage,
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
  // Dev / Test
  APITestPage,
} from './pages';
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminUserDetailPage,
  AdminAnalyticsPage,
  AdminAPIKeysPage,
} from './pages/admin';
import { LoadingScreen } from './components/ui';
import { useAuthStore } from './store';

// Protected route wrapper
function ProtectedRoute({ children, skipOnboardingCheck }: { children: React.ReactNode; skipOnboardingCheck?: boolean }) {
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to business profile setup if needed (but not if we're already on onboarding/business-profile page)
  if (!skipOnboardingCheck && user?.onboarding_status?.needs_onboarding) {
    return <Navigate to="/business-profile" replace />;
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
    // Regular users always land on overflow page
    return <Navigate to="/overflow" replace />;
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
            <ProtectedRoute skipOnboardingCheck>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Business Profile - accessible even during onboarding (has inline setup wizard) */}
        <Route
          element={
            <ProtectedRoute skipOnboardingCheck>
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
          <Route path="/posts/create" element={<CreatePostPage />} />
          <Route path="/posts/:id/edit" element={<CreatePostPage />} />
          <Route path="/platforms" element={<ConnectAccountsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* AI Features */}
          <Route path="/ai-caption" element={<AICaptionPage />} />
          <Route path="/ai-image" element={<AIImagePage />} />
          <Route path="/ai-video" element={<AIVideoPage />} />
          <Route path="/ai-voice" element={<AIVoicePage />} />

          {/* Messenger Bot */}
          <Route path="/messenger" element={<MessengerBotPage />} />

          {/* Analytics */}
          <Route path="/analytics" element={<AnalyticsPage />} />

          {/* V1.2.1 Routes */}
          <Route path="/strategy" element={<StrategyHubPage />} />
          <Route path="/ideas" element={<IdeasHubPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/approvals" element={<ApprovalReviewPage />} />
          <Route path="/settings/permissions" element={<PermissionsPage />} />

          {/* V1.3 Routes */}
          <Route path="/overflow" element={<OverflowPage />} />
          <Route path="/ideas/history" element={<IdeaHistoryPage />} />

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
            <ProtectedRoute skipOnboardingCheck>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }
        >
          <Route path="/admin-panel" element={<AdminDashboardPage />} />
          <Route path="/admin-panel/users" element={<AdminUsersPage />} />
          <Route path="/admin-panel/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin-panel/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin-panel/api-keys" element={<AdminAPIKeysPage />} />
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
