import api from './api';
import type { Post, PlatformType } from '../types';

interface AnalyticsSummary {
  total_likes: number;
  total_shares: number;
  total_comments: number;
  total_views: number;
  total_impressions: number;
  engagement_rate: number;
}

interface PlatformAnalytics {
  platform: PlatformType;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  impressions: number;
  engagement_rate: number;
  post_count: number;
}

interface AnalyticsTrend {
  date: string;
  value: number;
}

export const analyticsService = {
  // Summary
  async getSummary(days?: number): Promise<AnalyticsSummary> {
    const params = days ? { days } : {};
    const response = await api.get<AnalyticsSummary>('/analytics/summary/', { params });
    return response.data;
  },

  // Platform breakdown
  async getPlatformAnalytics(days?: number): Promise<Record<PlatformType, PlatformAnalytics>> {
    const params = days ? { days } : {};
    const response = await api.get<Record<PlatformType, PlatformAnalytics>>('/analytics/platforms/', { params });
    return response.data;
  },

  // Trends
  async getTrends(metric?: string, days?: number): Promise<AnalyticsTrend[]> {
    const params: Record<string, string | number> = {};
    if (metric) params.metric = metric;
    if (days) params.days = days;
    const response = await api.get<AnalyticsTrend[]>('/analytics/trends/', { params });
    return response.data;
  },

  // Top posts
  async getTopPosts(metric?: string, limit?: number): Promise<Post[]> {
    const params: Record<string, string | number> = {};
    if (metric) params.metric = metric;
    if (limit) params.limit = limit;
    const response = await api.get<Post[]>('/analytics/top-posts/', { params });
    return response.data;
  },

  // Combined analytics data for dashboard
  async getDashboardData(days: number = 30): Promise<{
    summary: AnalyticsSummary;
    platforms: Record<PlatformType, PlatformAnalytics>;
    trends: AnalyticsTrend[];
    topPosts: Post[];
  }> {
    const [summary, platforms, trends, topPosts] = await Promise.all([
      this.getSummary(days),
      this.getPlatformAnalytics(days),
      this.getTrends('likes', days),
      this.getTopPosts('likes', 5),
    ]);

    return { summary, platforms, trends, topPosts };
  },

  // ===================== V1.2.1 Methods =====================

  // Post quick stats (24h/48h snapshots)
  async getPostStats(postId: number, snapshot?: string) {
    const params = snapshot ? { snapshot } : {};
    const res = await api.get(`/posts/${postId}/stats/`, { params });
    return res.data;
  },

  // Post comments
  async getPostComments(postId: number, sentiment?: string) {
    const params = sentiment ? { sentiment } : {};
    const res = await api.get(`/posts/${postId}/comments/`, { params });
    return res.data;
  },

  // Reply to comment (human)
  async replyToComment(commentId: number, replyBody: string) {
    const res = await api.post(`/comments/${commentId}/reply/`, {
      reply_body: replyBody,
      reply_type: 'human',
    });
    return res.data;
  },

  // AI reply to comment
  async aiReplyToComment(commentId: number) {
    const res = await api.post(`/comments/${commentId}/ai-reply/`);
    return res.data;
  },

  // Weekly report
  async getWeeklyReport(brandId: number) {
    const res = await api.get(`/brands/${brandId}/weekly-report/`);
    return res.data;
  },

  // Analytics dashboard (V1.2.1)
  async getBrandDashboard(brandId: number, period?: string) {
    const params = period ? { period } : {};
    const res = await api.get(`/brands/${brandId}/analytics/dashboard/`, { params });
    return res.data;
  },

  // A/B test results
  async getABResults(brandId: number) {
    const res = await api.get(`/brands/${brandId}/ab-results/`);
    return res.data;
  },

  // Learning signals
  async getLearningSignals(brandId: number) {
    const res = await api.get(`/brands/${brandId}/learning-signals/`);
    return res.data;
  },

  // Winner posts
  async getWinners(brandId: number, limit?: number) {
    const params = limit ? { limit } : {};
    const res = await api.get(`/brands/${brandId}/winners/`, { params });
    return res.data;
  },

  // Repurpose post
  async repurposePost(postId: number, repurposeFormat: string) {
    const res = await api.post(`/posts/${postId}/repurpose/`, { repurpose_format: repurposeFormat });
    return res.data;
  },
};

export default analyticsService;
