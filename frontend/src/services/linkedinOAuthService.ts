import api from './api';

// ── Shared Types ───────────────────────────────────────────────────────────────

export interface LinkedInOAuthAccount {
  id: number;
  name: string;
  type: 'personal' | 'organization';
  person_urn?: string;
  org_urn?: string;
  email?: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  error?: string;
}

export interface LinkedInStatusAccount {
  account_id: number;
  name: string;
  type: 'personal' | 'organization';
  person_urn: string | null;
  org_urn: string | null;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  status_display: string;
  is_active: boolean;
  is_validated: boolean;
  token_expires_at: string | null;
  error_message: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
}

export interface LinkedInConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  accounts: LinkedInStatusAccount[];
  personal: LinkedInStatusAccount | null;
  organizations: LinkedInStatusAccount[];
  total_accounts: number;
  active_accounts: number;
}

// ── Admin Types ────────────────────────────────────────────────────────────────

export interface LinkedInAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

/** Shape returned by GET /admin/linkedin-settings/ */
export interface LinkedInAdminSettings {
  personal: {
    settings: {
      linkedin_client_id:     LinkedInAdminSetting;
      linkedin_client_secret: LinkedInAdminSetting;
      linkedin_redirect_uri:  LinkedInAdminSetting;
    };
    is_configured: boolean;
    missing: string[];
  };
  community: {
    settings: {
      linkedin_community_client_id:     LinkedInAdminSetting;
      linkedin_community_client_secret: LinkedInAdminSetting;
      linkedin_community_redirect_uri:  LinkedInAdminSetting;
    };
    is_configured: boolean;
    missing: string[];
  };
  shared: {
    frontend_url: LinkedInAdminSetting;
  };
  help: {
    personal_note:    string;
    community_note:   string;
    frontend_url_note: string;
  };
}

export interface LinkedInSaveResult {
  success: boolean;
  message: string;
  personal_configured:  boolean;
  community_configured: boolean;
  warnings?: string[];
}

export interface LinkedInAccountRow {
  account_id: number;
  user_id: number;
  username: string;
  account_name: string;
  type: 'personal' | 'organization';
  person_urn: string | null;
  org_urn: string | null;
  status: string;
  has_token: boolean;
  token_expires_at: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
}

// ── Service ────────────────────────────────────────────────────────────────────

export const linkedinOAuthService = {
  // ── Personal App OAuth ──────────────────────────────────────────────────────

  /** Get auth URL for personal LinkedIn popup */
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/linkedin/initiate/');
    return res.data;
  },

  /** Get connection status (personal + any org pages) */
  async getStatus(forceRefresh = false): Promise<LinkedInConnectionStatus> {
    const res = await api.get('/platforms/linkedin/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  // ── Community App OAuth ─────────────────────────────────────────────────────

  /** Get auth URL for Community (Company Page) popup */
  async inititateCommunity(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/linkedin/community/initiate/');
    return res.data;
  },

  // ── Admin ───────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<LinkedInAdminSettings> {
    const res = await api.get('/admin/linkedin-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<LinkedInSaveResult> {
    const res = await api.post('/admin/linkedin-settings/', data);
    return res.data;
  },

  async getLinkedInAccounts(): Promise<{ accounts: LinkedInAccountRow[]; total: number }> {
    const res = await api.get('/admin/linkedin-accounts/');
    return res.data;
  },
};

export default linkedinOAuthService;
