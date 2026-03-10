import { useEffect } from 'react';
import {
  UsersIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { WelcomeSection, StatsCard, QuickActions, SubscriptionInfo } from '../components/dashboard';
import { LoadingPlaceholder } from '../components/ui';
import { DiamondBalanceWidget, DiamondUsageChart } from '../components/diamond';
import { useAuthStore, useDashboardStore } from '../store';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { stats, isLoading, fetchDashboardData } = useDashboardStore();

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading && !stats) {
    return <LoadingPlaceholder />;
  }

  // Mock data for demo (will be replaced with real API data)
  const mockStats = stats || {
    total_posts: 24,
    scheduled_posts: 8,
    posted_posts: 12,
    failed_posts: 2,
    posts_this_month: 18,
    connected_accounts: 4,
    subscription_plan: user?.profile?.subscription_plan || 'free',
    max_posts_per_month: user?.profile?.max_posts_per_month || 50,
    max_social_accounts: user?.profile?.max_social_accounts || 5,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Section */}
      <WelcomeSection username={user?.username || 'User'} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Connected Accounts"
          value={mockStats.connected_accounts}
          icon={<UsersIcon className="w-6 h-6" />}
          trend={{ value: 12, isPositive: true, label: 'vs last month' }}
          delay={0}
        />
        <StatsCard
          title="Total Posts"
          value={mockStats.total_posts}
          icon={<DocumentTextIcon className="w-6 h-6" />}
          trend={{ value: 8, isPositive: true, label: 'vs last month' }}
          delay={100}
        />
        <StatsCard
          title="Scheduled Posts"
          value={mockStats.scheduled_posts}
          icon={<CalendarIcon className="w-6 h-6" />}
          delay={200}
        />
        <StatsCard
          title="Posts This Month"
          value={mockStats.posts_this_month}
          icon={<ChartBarIcon className="w-6 h-6" />}
          progress={{
            current: mockStats.posts_this_month,
            max: mockStats.max_posts_per_month,
          }}
          delay={300}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Diamond Balance + Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <DiamondBalanceWidget />
        <div className="lg:col-span-2">
          <DiamondUsageChart />
        </div>
      </div>

      {/* Subscription Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Recent Activity */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Post scheduled successfully</p>
                  <p className="text-xs text-text-muted">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-info" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Connected Instagram account</p>
                  <p className="text-xs text-text-muted">5 hours ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <ChartBarIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Generated AI caption</p>
                  <p className="text-xs text-text-muted">1 day ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <SubscriptionInfo
            plan={mockStats.subscription_plan as any}
            maxAccounts={mockStats.max_social_accounts}
            maxPostsPerMonth={mockStats.max_posts_per_month}
            postsThisMonth={mockStats.posts_this_month}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
