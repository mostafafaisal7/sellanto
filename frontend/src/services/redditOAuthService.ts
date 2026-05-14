import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RedditOAuthAccount {
  id: number;
  name: string;
  username: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
}

export interface RedditStatusAccount {
  account_id: number;
  name: string;
  username: string | null;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  status_display: string;
  is_active: boolean;
  is_validated: boolean;
  has_refresh_token: boolean;
  token_expires_at: string | null;
  error_message: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
}

export interface RedditConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  accounts: RedditStatusAccount[];
  total_accounts: number;
  active_accounts: number;
}

export interface RedditAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface RedditAdminSettings {
  settings: {
    reddit_client_id: RedditAdminSetting;
    reddit_client_secret: RedditAdminSetting;
    reddit_redirect_uri: RedditAdminSetting;
    frontend_url: RedditAdminSetting;
  };
  is_configured: boolean;
  missing: string[];
  help: {
    where_to_find: string;
    redirect_uri_note: string;
    frontend_url_note: string;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const redditOAuthService = {
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/reddit/initiate/');
    return res.data;
  },

  async getStatus(forceRefresh = false): Promise<RedditConnectionStatus> {
    const res = await api.get('/platforms/reddit/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<RedditAdminSettings> {
    const res = await api.get('/admin/reddit-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{
    success: boolean;
    message: string;
    is_configured: boolean;
    warnings?: string[];
  }> {
    const res = await api.post('/admin/reddit-settings/', data);
    return res.data;
  },
};

export default redditOAuthService;
