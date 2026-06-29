import { useEffect, useState } from 'react';
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
import notificationService from '../services/notificationService';

interface Notification {
  id: number;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const EVENT_ICONS: Record<string, string> = {
  post_submitted: '📤', post_approved: '✅', changes_requested: '📝',
  post_rejected: '❌', post_scheduled: '📅', post_published: '🚀',
  publish_failed: '⚠️', captions_ready: '✍️', images_ready: '🎨',
  video_ready: '🎬', batch_complete: '📦', weekly_report: '📊',
  winner_detected: '🏆', new_comment: '💬', token_expiring: '🔑',
  repurpose_suggestion: '♻️',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { stats, isLoading, fetchDashboardData } = useDashboardStore();
  const [activities, setActivities] = useState<Notification[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    notificationService.getNotifications({ limit: 20 })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setActivities(list);
      })
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
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
      <WelcomeSection username={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'User'} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Connected Accounts"
          value={mockStats.connected_accounts}
          icon={<UsersIcon className="w-6 h-6" />}
          trend={{ value: 12, isPositive: true, label: 'vs last month' }}
          delay={0}
          href="/platforms"
        />
        <StatsCard
          title="Total Posts"
          value={mockStats.total_posts}
          icon={<DocumentTextIcon className="w-6 h-6" />}
          trend={{ value: 8, isPositive: true, label: 'vs last month' }}
          delay={100}
          href="/posts"
        />
        <StatsCard
          title="Scheduled Posts"
          value={mockStats.scheduled_posts}
          icon={<CalendarIcon className="w-6 h-6" />}
          delay={200}
          href="/posts?status=scheduled"
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
          href="/posts"
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
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'rgb(var(--c-coral))' }} />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No recent activity yet.</p>
            ) : (
              <div className="space-y-3 max-h-[340px] overflow-y-auto no-scrollbar">
                {activities.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-xl"
                    style={{ opacity: n.is_read ? 0.7 : 1 }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[18px] flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {EVENT_ICONS[n.event_type] || '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-text-muted truncate">{n.message}</p>
                      )}
                      <p className="text-xs text-text-muted mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--c-coral))' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
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
