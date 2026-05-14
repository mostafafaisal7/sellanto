import api from './api';

export interface PinterestOAuthAccount {
  id: number;
  name: string;
  account_type: string;
  profile_image: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  boards: Array<{ id: string; name: string; description: string; privacy: string; pin_count: number }>;
}

export interface PinterestStatusAccount {
  account_id: number;
  name: string;
  board_id: string | null;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  status_display: string;
  is_active: boolean;
  is_validated: boolean;
  token_expires_at: string | null;
  error_message: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
}

export interface PinterestConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  accounts: PinterestStatusAccount[];
  total_accounts: number;
  active_accounts: number;
}

export interface PinterestAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface PinterestAdminSettings {
  settings: {
    pinterest_client_id: PinterestAdminSetting;
    pinterest_client_secret: PinterestAdminSetting;
    pinterest_redirect_uri: PinterestAdminSetting;
    frontend_url: PinterestAdminSetting;
  };
  is_configured: boolean;
  missing: string[];
  help: {
    where_to_find: string;
    redirect_uri_note: string;
    frontend_url_note: string;
  };
}

export const pinterestOAuthService = {
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/pinterest/initiate/');
    return res.data;
  },

  async getStatus(forceRefresh = false): Promise<PinterestConnectionStatus> {
    const res = await api.get('/platforms/pinterest/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  async getBoards(): Promise<{ boards: Array<{ id: string; name: string }>; current_board_id: string | null }> {
    const res = await api.get('/platforms/pinterest/boards/');
    return res.data;
  },

  // Admin
  async getAdminSettings(): Promise<PinterestAdminSettings> {
    const res = await api.get('/admin/pinterest-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{
    success: boolean; message: string; is_configured: boolean; warnings?: string[];
  }> {
    const res = await api.post('/admin/pinterest-settings/', data);
    return res.data;
  },
};

export default pinterestOAuthService;
