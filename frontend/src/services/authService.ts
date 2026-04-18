import api, { setTokens, clearTokens } from './api';
import type { User, LoginCredentials, RegisterData, AuthTokens } from '../types';
import { useAuthStore } from '../store';

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login/', credentials);
    setTokens(response.data.tokens);
    return response.data;
  },

  async register(data: RegisterData): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/register/', data);
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout/');
    } finally {
      clearTokens();

      // 🔒 SECURITY FIX #1: Clear localStorage draft map
      // Prevents User A's draft post IDs leaking to User B on same browser
      try {
        localStorage.removeItem('magic_draft_post_ids');
        console.log('[Auth] Cleared magic draft post IDs from localStorage');
      } catch (err) {
        console.error('[Auth] Failed to clear draft IDs:', err);
      }

      // 🔒 SECURITY FIX #2: Clear Magic Mode session state
      // Without persist, Zustand state survives in memory until page reload
      // Must manually reset to prevent User A's state leaking to User B
      try {
        const { useMagicModeStore } = await import('../store/magicModeStore');
        useMagicModeStore.getState().reset();
        console.log('[Auth] Magic Mode state cleared on logout');
      } catch (err) {
        console.error('[Auth] Failed to clear Magic Mode state:', err);
      }

      // ✅ Clear localStorage resume flag on logout
      try {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          localStorage.removeItem(`magic_has_posts_${userId}`);
          console.log('[Auth] Magic Mode resume flag cleared from localStorage');
        }
      } catch (err) {
        console.error('[Auth] Failed to clear Magic Mode resume flag:', err);
      }
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me/');
    return response.data;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.put<User>('/auth/profile/', data);
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};

export default authService;
