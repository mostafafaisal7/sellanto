import { create } from 'zustand';
import type { AdminUser, AdminDashboardStats, AdminUserDetail, AdminAPISettings, AdminAnalyticsData } from '../types';
import { api } from '../services/api';

interface AdminState {
  // Impersonation
  impersonatedUserId: number | null;
  impersonatedUser: { id: number; username: string; email: string } | null;
  startImpersonation: (userId: number, user: { id: number; username: string; email: string }) => void;
  stopImpersonation: () => void;
  isImpersonating: () => boolean;

  // Dashboard
  dashboardStats: AdminDashboardStats | null;
  dashboardLoading: boolean;
  fetchDashboard: () => Promise<void>;

  // Users
  users: AdminUser[];
  usersLoading: boolean;
  fetchUsers: (filters?: { status?: string; search?: string; plan?: string }) => Promise<void>;

  // User Detail
  userDetail: AdminUserDetail | null;
  userDetailLoading: boolean;
  fetchUserDetail: (userId: number) => Promise<void>;

  // User Actions
  approveUser: (userId: number) => Promise<void>;
  rejectUser: (userId: number) => Promise<void>;
  updatePlan: (userId: number, plan: string, maxPosts: number, maxAccounts: number) => Promise<void>;
  bulkApprove: (userIds: number[]) => Promise<void>;

  // API Settings
  apiSettings: AdminAPISettings | null;
  apiSettingsLoading: boolean;
  fetchAPISettings: (userId: number) => Promise<void>;
  updateAPISettings: (userId: number, data: { admin_managed: boolean; openai_key: string; gemini_key: string }) => Promise<void>;

  // User Data
  userData: Record<string, unknown> | null;
  userDataLoading: boolean;
  fetchUserPosts: (userId: number) => Promise<unknown>;
  fetchUserAccounts: (userId: number) => Promise<unknown>;
  fetchUserCaptions: (userId: number) => Promise<unknown>;
  fetchUserImages: (userId: number) => Promise<unknown>;
  fetchUserVideos: (userId: number) => Promise<unknown>;
  fetchUserMessenger: (userId: number) => Promise<unknown>;

  // Analytics
  analytics: AdminAnalyticsData | null;
  analyticsLoading: boolean;
  fetchAnalytics: (days?: number) => Promise<void>;
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  // Impersonation
  impersonatedUserId: (() => {
    const id = localStorage.getItem('impersonate_user_id');
    return id ? parseInt(id) : null;
  })(),
  impersonatedUser: (() => {
    const data = localStorage.getItem('impersonate_user_data');
    return data ? JSON.parse(data) : null;
  })(),

  startImpersonation: (userId, user) => {
    // Save admin's auth data so we can restore it when impersonation ends
    const authData = localStorage.getItem('auth-storage');
    if (authData) {
      localStorage.setItem('admin_original_auth', authData);
    }
    localStorage.setItem('impersonate_user_id', String(userId));
    localStorage.setItem('impersonate_user_data', JSON.stringify(user));
    set({ impersonatedUserId: userId, impersonatedUser: user });
  },

  stopImpersonation: () => {
    localStorage.removeItem('impersonate_user_id');
    localStorage.removeItem('impersonate_user_data');
    // Restore admin's original auth data before page reload
    const originalAuth = localStorage.getItem('admin_original_auth');
    if (originalAuth) {
      localStorage.setItem('auth-storage', originalAuth);
      localStorage.removeItem('admin_original_auth');
    }
    set({ impersonatedUserId: null, impersonatedUser: null });
  },

  isImpersonating: () => !!get().impersonatedUserId,

  // Dashboard
  dashboardStats: null,
  dashboardLoading: false,
  fetchDashboard: async () => {
    set({ dashboardLoading: true });
    try {
      const { data } = await api.get('/admin/dashboard/');
      set({ dashboardStats: data, dashboardLoading: false });
    } catch {
      set({ dashboardLoading: false });
    }
  },

  // Users
  users: [],
  usersLoading: false,
  fetchUsers: async (filters) => {
    set({ usersLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.plan) params.append('plan', filters.plan);
      const { data } = await api.get(`/admin/users/?${params.toString()}`);
      set({ users: data.users, usersLoading: false });
    } catch {
      set({ usersLoading: false });
    }
  },

  // User Detail
  userDetail: null,
  userDetailLoading: false,
  fetchUserDetail: async (userId) => {
    set({ userDetailLoading: true });
    try {
      const { data } = await api.get(`/admin/users/${userId}/`);
      set({ userDetail: data, userDetailLoading: false });
    } catch {
      set({ userDetailLoading: false });
    }
  },

  // User Actions
  approveUser: async (userId) => {
    await api.post(`/admin/users/${userId}/approve/`);
  },
  rejectUser: async (userId) => {
    await api.post(`/admin/users/${userId}/reject/`);
  },
  updatePlan: async (userId, plan, maxPosts, maxAccounts) => {
    await api.put(`/admin/users/${userId}/plan/`, {
      plan,
      max_posts: maxPosts,
      max_accounts: maxAccounts,
    });
  },
  bulkApprove: async (userIds) => {
    await api.post('/admin/bulk-approve/', { user_ids: userIds });
  },

  // API Settings
  apiSettings: null,
  apiSettingsLoading: false,
  fetchAPISettings: async (userId) => {
    set({ apiSettingsLoading: true });
    try {
      const { data } = await api.get(`/admin/users/${userId}/api-settings/`);
      set({ apiSettings: data, apiSettingsLoading: false });
    } catch {
      set({ apiSettingsLoading: false });
    }
  },
  updateAPISettings: async (userId, settingsData) => {
    await api.put(`/admin/users/${userId}/api-settings/`, settingsData);
  },

  // User Data
  userData: null,
  userDataLoading: false,
  fetchUserPosts: async (userId) => {
    const { data } = await api.get(`/admin/users/${userId}/posts/`);
    return data;
  },
  fetchUserAccounts: async (userId) => {
    const { data } = await api.get(`/admin/users/${userId}/accounts/`);
    return data;
  },
  fetchUserCaptions: async (userId) => {
    const { data } = await api.get(`/admin/users/${userId}/captions/`);
    return data;
  },
  fetchUserImages: async (userId) => {
    const { data } = await api.get(`/admin/users/${userId}/images/`);
    return data;
  },
  fetchUserVideos: async (userId) => {
    const { data } = await api.get(`/admin/users/${userId}/videos/`);
    return data;
  },
  fetchUserMessenger: async (userId) => {
    const { data } = await api.get(`/admin/users/${userId}/messenger/`);
    return data;
  },

  // Analytics
  analytics: null,
  analyticsLoading: false,
  fetchAnalytics: async (days = 30) => {
    set({ analyticsLoading: true });
    try {
      const { data } = await api.get(`/admin/analytics/?days=${days}`);
      set({ analytics: data, analyticsLoading: false });
    } catch {
      set({ analyticsLoading: false });
    }
  },
}));

export default useAdminStore;
