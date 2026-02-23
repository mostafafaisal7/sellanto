import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  ArrowPathIcon,
  HeartIcon,
  ShareIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  PresentationChartLineIcon,
  DocumentArrowDownIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import type {
  AnalyticsSummary,
  AnalyticsTrend,
  PlatformType,
  MetricType,
  AnalyticsFilters,
} from '../types';
import { PlatformIcon } from '../components/ui';

// Mock analytics data
const mockSummary: AnalyticsSummary = {
  total_likes: 12450,
  total_shares: 3280,
  total_comments: 1890,
  total_views: 156780,
  total_impressions: 425600,
  engagement_rate: 4.2,
  by_platform: {
    facebook: {
      platform: 'facebook',
      likes: 4200,
      shares: 1200,
      comments: 650,
      views: 52000,
      impressions: 145000,
      engagement_rate: 4.1,
      post_count: 28,
    },
    twitter: {
      platform: 'twitter',
      likes: 3100,
      shares: 980,
      comments: 420,
      views: 38000,
      impressions: 98000,
      engagement_rate: 4.6,
      post_count: 42,
    },
    instagram: {
      platform: 'instagram',
      likes: 4500,
      shares: 850,
      comments: 720,
      views: 48000,
      impressions: 132000,
      engagement_rate: 4.5,
      post_count: 35,
    },
    linkedin: {
      platform: 'linkedin',
      likes: 650,
      shares: 250,
      comments: 100,
      views: 18780,
      impressions: 50600,
      engagement_rate: 3.2,
      post_count: 15,
    },
    tiktok: {
      platform: 'tiktok',
      likes: 0,
      shares: 0,
      comments: 0,
      views: 0,
      impressions: 0,
      engagement_rate: 0,
      post_count: 0,
    },
    youtube: {
      platform: 'youtube',
      likes: 0,
      shares: 0,
      comments: 0,
      views: 0,
      impressions: 0,
      engagement_rate: 0,
      post_count: 0,
    },
    pinterest: {
      platform: 'pinterest',
      likes: 0,
      shares: 0,
      comments: 0,
      views: 0,
      impressions: 0,
      engagement_rate: 0,
      post_count: 0,
    },
    telegram: {
      platform: 'telegram',
      likes: 0,
      shares: 0,
      comments: 0,
      views: 0,
      impressions: 0,
      engagement_rate: 0,
      post_count: 0,
    },
  },
  by_post: [
    {
      post_id: 1,
      caption_preview: 'Exciting news! We just launched our new product line...',
      platforms: ['facebook', 'instagram', 'twitter'],
      total_engagement: 2450,
      likes: 1800,
      shares: 320,
      comments: 180,
      views: 12500,
      posted_at: '2024-01-18T10:00:00Z',
    },
    {
      post_id: 2,
      caption_preview: 'Behind the scenes of our latest photoshoot...',
      platforms: ['instagram'],
      total_engagement: 1890,
      likes: 1500,
      shares: 180,
      comments: 210,
      views: 8900,
      posted_at: '2024-01-17T14:30:00Z',
    },
    {
      post_id: 3,
      caption_preview: 'Join us for our upcoming webinar on industry trends...',
      platforms: ['linkedin', 'facebook'],
      total_engagement: 680,
      likes: 450,
      shares: 150,
      comments: 80,
      views: 5600,
      posted_at: '2024-01-16T09:00:00Z',
    },
  ],
  trends: [
    { date: '2024-01-14', likes: 1200, shares: 280, comments: 150, views: 15000, posts_count: 3 },
    { date: '2024-01-15', likes: 1450, shares: 320, comments: 180, views: 18500, posts_count: 4 },
    { date: '2024-01-16', likes: 980, shares: 210, comments: 120, views: 12000, posts_count: 2 },
    { date: '2024-01-17', likes: 1680, shares: 380, comments: 220, views: 21000, posts_count: 5 },
    { date: '2024-01-18', likes: 2100, shares: 450, comments: 280, views: 28000, posts_count: 4 },
    { date: '2024-01-19', likes: 1890, shares: 410, comments: 250, views: 24500, posts_count: 3 },
    { date: '2024-01-20', likes: 2250, shares: 520, comments: 310, views: 32000, posts_count: 5 },
  ],
};

const metricTypes: { value: MetricType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'likes', label: 'Likes', icon: <HeartIcon className="w-5 h-5" />, color: 'text-red-400' },
  { value: 'shares', label: 'Shares', icon: <ShareIcon className="w-5 h-5" />, color: 'text-blue-400' },
  { value: 'comments', label: 'Comments', icon: <ChatBubbleLeftIcon className="w-5 h-5" />, color: 'text-green-400' },
  { value: 'views', label: 'Views', icon: <EyeIcon className="w-5 h-5" />, color: 'text-purple-400' },
  { value: 'clicks', label: 'Clicks', icon: <CursorArrowRaysIcon className="w-5 h-5" />, color: 'text-yellow-400' },
  { value: 'impressions', label: 'Impressions', icon: <PresentationChartLineIcon className="w-5 h-5" />, color: 'text-cyan-400' },
  { value: 'engagement_rate', label: 'Engagement', icon: <ChartBarIcon className="w-5 h-5" />, color: 'text-orange-400' },
];

const platforms: PlatformType[] = ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'telegram'];

const dateRanges = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom Range' },
];

export function AnalyticsPage() {
  const [_filters, _setFilters] = useState<AnalyticsFilters>({});
  const [dateRange, setDateRange] = useState('30d');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | 'all'>('all');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('likes');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  // Calculate growth (mock data - comparing last period)
  const growth = {
    likes: 12.5,
    shares: 8.3,
    comments: -2.1,
    views: 18.7,
    impressions: 15.2,
    engagement: 0.8,
  };

  const activePlatforms = platforms.filter(p => (mockSummary.by_platform[p]?.post_count ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-text-secondary mt-1">
            Track your social media performance across all platforms
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <DocumentArrowDownIcon className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-text-muted" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input py-2 min-w-[150px]"
            >
              {dateRanges.map((range) => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>

          {/* Platform Filter */}
          <div className="flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-text-muted" />
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as PlatformType | 'all')}
              className="input py-2 min-w-[150px]"
            >
              <option value="all">All Platforms</option>
              {activePlatforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Filter */}
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-text-muted" />
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="input py-2 min-w-[150px]"
            >
              {metricTypes.map((metric) => (
                <option key={metric.value} value={metric.value}>{metric.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Likes', value: mockSummary.total_likes, growth: growth.likes, icon: <HeartIcon className="w-6 h-6" />, color: 'from-red-500 to-pink-500' },
          { label: 'Total Shares', value: mockSummary.total_shares, growth: growth.shares, icon: <ShareIcon className="w-6 h-6" />, color: 'from-blue-500 to-cyan-500' },
          { label: 'Total Comments', value: mockSummary.total_comments, growth: growth.comments, icon: <ChatBubbleLeftIcon className="w-6 h-6" />, color: 'from-green-500 to-emerald-500' },
          { label: 'Total Views', value: mockSummary.total_views, growth: growth.views, icon: <EyeIcon className="w-6 h-6" />, color: 'from-purple-500 to-violet-500' },
          { label: 'Impressions', value: mockSummary.total_impressions, growth: growth.impressions, icon: <PresentationChartLineIcon className="w-6 h-6" />, color: 'from-cyan-500 to-teal-500' },
          { label: 'Engagement Rate', value: `${mockSummary.engagement_rate}%`, growth: growth.engagement, icon: <ChartBarIcon className="w-6 h-6" />, color: 'from-orange-500 to-amber-500', isPercentage: true },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-5"
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                stat.growth >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {stat.growth >= 0 ? (
                  <ArrowTrendingUpIcon className="w-4 h-4" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4" />
                )}
                {Math.abs(stat.growth)}%
              </div>
            </div>
            <p className="text-2xl font-bold mt-3">
              {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
            </p>
            <p className="text-text-secondary text-sm mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Engagement Trend</h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="input py-1.5 text-sm min-w-[120px]"
            >
              <option value="likes">Likes</option>
              <option value="shares">Shares</option>
              <option value="comments">Comments</option>
              <option value="views">Views</option>
            </select>
          </div>
          {/* Chart Placeholder - Simple bar representation */}
          <div className="h-64 flex items-end justify-between gap-2">
            {mockSummary.trends.map((trend, i) => {
              const maxValue = Math.max(...mockSummary.trends.map(t => t[selectedMetric as keyof AnalyticsTrend] as number));
              const value = trend[selectedMetric as keyof AnalyticsTrend] as number;
              const height = (value / maxValue) * 100;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end h-48">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="w-full bg-gradient-to-t from-primary to-secondary rounded-t-lg relative group"
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-dark-600 px-2 py-1 rounded text-xs whitespace-nowrap">
                        {formatNumber(value)}
                      </div>
                    </motion.div>
                  </div>
                  <span className="text-text-muted text-xs">{formatDate(trend.date)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6">Performance by Platform</h3>
          <div className="space-y-4">
            {activePlatforms.map((platform) => {
              const stats = mockSummary.by_platform[platform];
              if (!stats) return null;
              const totalEngagement = stats.likes + stats.shares + stats.comments;
              const maxEngagement = Math.max(
                ...activePlatforms.map(p => {
                  const s = mockSummary.by_platform[p];
                  return s ? s.likes + s.shares + s.comments : 0;
                })
              );
              const percentage = maxEngagement > 0 ? (totalEngagement / maxEngagement) * 100 : 0;

              return (
                <div key={platform}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={platform} size="sm" />
                      <span className="font-medium capitalize">{platform}</span>
                    </div>
                    <div className="flex items-center gap-4 text-text-secondary text-sm">
                      <span>{stats.post_count} posts</span>
                      <span className="text-primary font-medium">{stats.engagement_rate}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-text-muted text-xs">
                    <span>{formatNumber(stats.likes)} likes</span>
                    <span>{formatNumber(stats.shares)} shares</span>
                    <span>{formatNumber(stats.comments)} comments</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Top Performing Posts</h3>
          <button className="text-primary text-sm hover:underline">View All Posts</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Post</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Platforms</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Likes</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Shares</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Comments</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Views</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Engagement</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockSummary.by_post.map((post, i) => (
                <motion.tr
                  key={post.post_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="max-w-xs">
                      <p className="text-sm truncate">{post.caption_preview}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1">
                      {post.platforms.map((platform) => (
                        <PlatformIcon key={platform} platform={platform} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-red-400">
                      <HeartIcon className="w-4 h-4" />
                      {formatNumber(post.likes)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-blue-400">
                      <ShareIcon className="w-4 h-4" />
                      {formatNumber(post.shares)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-green-400">
                      <ChatBubbleLeftIcon className="w-4 h-4" />
                      {formatNumber(post.comments)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-purple-400">
                      <EyeIcon className="w-4 h-4" />
                      {formatNumber(post.views)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="px-2 py-1 rounded-lg text-xs bg-primary/10 text-primary font-medium">
                      {formatNumber(post.total_engagement)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-text-secondary text-sm">
                    {formatDate(post.posted_at)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {activePlatforms.map((platform, i) => {
          const stats = mockSummary.by_platform[platform];
          if (!stats) return null;

          return (
            <motion.div
              key={platform}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <PlatformIcon platform={platform} size="md" />
                <div>
                  <h4 className="font-semibold capitalize">{platform}</h4>
                  <p className="text-text-secondary text-sm">{stats.post_count} posts</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-dark-700/30">
                  <p className="text-text-muted text-xs">Likes</p>
                  <p className="text-lg font-semibold mt-1">{formatNumber(stats.likes)}</p>
                </div>
                <div className="p-3 rounded-xl bg-dark-700/30">
                  <p className="text-text-muted text-xs">Shares</p>
                  <p className="text-lg font-semibold mt-1">{formatNumber(stats.shares)}</p>
                </div>
                <div className="p-3 rounded-xl bg-dark-700/30">
                  <p className="text-text-muted text-xs">Comments</p>
                  <p className="text-lg font-semibold mt-1">{formatNumber(stats.comments)}</p>
                </div>
                <div className="p-3 rounded-xl bg-dark-700/30">
                  <p className="text-text-muted text-xs">Engagement</p>
                  <p className="text-lg font-semibold mt-1 text-primary">{stats.engagement_rate}%</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Views</span>
                  <span className="font-medium">{formatNumber(stats.views)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-text-secondary">Impressions</span>
                  <span className="font-medium">{formatNumber(stats.impressions)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Insights Section */}
      <div className="card p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-4">AI Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <ArrowTrendingUpIcon className="w-5 h-5" />
              <span className="font-medium">Best Performing</span>
            </div>
            <p className="text-text-secondary text-sm">
              Instagram posts have 12% higher engagement than other platforms this month.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <CalendarIcon className="w-5 h-5" />
              <span className="font-medium">Best Time to Post</span>
            </div>
            <p className="text-text-secondary text-sm">
              Your audience is most active between 6-8 PM on weekdays.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <ChartBarIcon className="w-5 h-5" />
              <span className="font-medium">Content Tip</span>
            </div>
            <p className="text-text-secondary text-sm">
              Posts with images get 2.3x more engagement than text-only posts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
