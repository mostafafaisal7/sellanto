import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YouTubeOAuthAccount {
  id: number;
  name: string;
  channel_id: string;
  account_type: string;
  profile_image: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
}

export interface YouTubeStatusAccount {
  account_id: number;
  name: string;
  channel_id: string | null;
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

export interface YouTubeConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  accounts: YouTubeStatusAccount[];
  total_accounts: number;
  active_accounts: number;
}

// ── Admin Types ───────────────────────────────────────────────────────────────

export interface YouTubeAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface YouTubeAdminSettings {
  settings: {
    youtube_client_id: YouTubeAdminSetting;
    youtube_client_secret: YouTubeAdminSetting;
    youtube_redirect_uri: YouTubeAdminSetting;
    frontend_url: YouTubeAdminSetting;
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

export const youtubeOAuthService = {
  /** Step 1 — get auth URL to open in popup */
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/youtube/initiate/');
    return res.data;
  },

  /** GET connection health — called on mount and after OAuth */
  async getStatus(forceRefresh = false): Promise<YouTubeConnectionStatus> {
    const res = await api.get('/platforms/youtube/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<YouTubeAdminSettings> {
    const res = await api.get('/admin/youtube-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{
    success: boolean;
    message: string;
    is_configured: boolean;
    warnings?: string[];
  }> {
    const res = await api.post('/admin/youtube-settings/', data);
    return res.data;
  },
};

export default youtubeOAuthService;
