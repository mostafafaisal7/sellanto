import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TikTokOAuthAccount {
  id: number;
  name: string;
  display_name: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
}

export interface TikTokStatusAccount {
  account_id: number;
  name: string;
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

export interface TikTokConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  accounts: TikTokStatusAccount[];
  total_accounts: number;
  active_accounts: number;
}

export interface TikTokAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface TikTokAdminSettings {
  settings: {
    tiktok_client_key: TikTokAdminSetting;
    tiktok_client_secret: TikTokAdminSetting;
    tiktok_redirect_uri: TikTokAdminSetting;
    frontend_url: TikTokAdminSetting;
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

export const tiktokOAuthService = {
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/tiktok/initiate/');
    return res.data;
  },

  async getStatus(forceRefresh = false): Promise<TikTokConnectionStatus> {
    const res = await api.get('/platforms/tiktok/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<TikTokAdminSettings> {
    const res = await api.get('/admin/tiktok-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{
    success: boolean;
    message: string;
    is_configured: boolean;
    warnings?: string[];
  }> {
    const res = await api.post('/admin/tiktok-settings/', data);
    return res.data;
  },
};

export default tiktokOAuthService;
