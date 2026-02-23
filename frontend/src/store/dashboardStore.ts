import { create } from 'zustand';
import type { DashboardStats, Post, SocialAccount } from '../types';
import { dashboardService, platformService } from '../services';

interface DashboardState {
  stats: DashboardStats | null;
  recentPosts: Post[];
  socialAccounts: SocialAccount[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDashboardData: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchRecentPosts: () => Promise<void>;
  fetchSocialAccounts: () => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  stats: null,
  recentPosts: [],
  socialAccounts: [],
  isLoading: false,
  error: null,

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [stats, recentPosts, socialAccounts] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentPosts(5),
        platformService.list(),
      ]);
      set({ stats, recentPosts, socialAccounts, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
      set({ error: message, isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await dashboardService.getStats();
      set({ stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch stats';
      set({ error: message });
    }
  },

  fetchRecentPosts: async () => {
    try {
      const recentPosts = await dashboardService.getRecentPosts(5);
      set({ recentPosts });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch recent posts';
      set({ error: message });
    }
  },

  fetchSocialAccounts: async () => {
    try {
      const socialAccounts = await platformService.list();
      set({ socialAccounts });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch social accounts';
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));

export default useDashboardStore;
