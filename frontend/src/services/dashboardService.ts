import api from './api';
import type { DashboardStats, Post } from '../types';

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats/');
    return response.data;
  },

  async getRecentPosts(limit: number = 5): Promise<Post[]> {
    const response = await api.get<Post[]>('/dashboard/recent/', { params: { limit } });
    return response.data;
  },
};

export default dashboardService;
