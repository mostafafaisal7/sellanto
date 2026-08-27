import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FacebookOAuthPage {
  id: number;           // SocialAccount DB pk — used for setup-messenger
  page_id: string;
  name: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  has_instagram: boolean;
  instagram_name?: string | null;
  instagram_warning?: string;
  error?: string;
}

export interface FacebookStatusPage {
  account_id: number;
  page_id: string;
  page_name: string;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  status_display: string;
  is_active: boolean;
  is_validated: boolean;
  error_message: string | null;
  connected_at: string;
  last_validated_at: string | null;
}

export interface FacebookStatusIGAccount {
  account_id: number;
  account_name: string;
  ig_account_id: string;
  status: string;
  status_display: string;
  is_active: boolean;
  error_message: string | null;
  connected_at: string;
  /** instagram_basic profile metadata — null when the live profile read failed */
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
}

export interface MessengerStatusData {
  page_id: string;
  page_name: string;
  is_active: boolean;
  is_webhook_verified: boolean;
  auto_reply_enabled: boolean;
  connected_at: string;
}

export interface StatusItem {
  key: string;
  title: string;
  message: string;
  detail: string;
  action: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface FacebookConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  facebook: {
    connected: boolean;
    total_pages: number;
    active_pages: number;
    pages: FacebookStatusPage[];
  };
  instagram: {
    connected: boolean;
    total: number;
    accounts: FacebookStatusIGAccount[];
  };
  messenger: {
    connected: boolean;
    enabled?: boolean;
    data: MessengerStatusData | null;
  };
  messenger_enabled: boolean;
  missing: StatusItem[];
  warnings: StatusItem[];
}

export interface FacebookAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface FacebookAccountRow {
  account_id: number;
  user_id: number;
  username: string;
  page_id: string;
  page_name: string;
  status: string;
  has_token: boolean;
  has_messenger: boolean;
  connected_at: string | null;
  last_validated_at: string | null;
}

export interface MessengerAppWebhook {
  webhook_url: string;
  verify_token: string;
  fields: string;
  is_token_set: boolean;
  note: string;
}

export interface MessengerWebhookConnection {
  id: number;
  username: string;
  page_id: string;
  page_name: string;
  is_webhook_verified: boolean;
  is_active: boolean;
  auto_reply_enabled: boolean;
  connected_at: string | null;
}

export interface FacebookAdminSettings {
  settings: {
    facebook_app_id: FacebookAdminSetting;
    facebook_app_secret: FacebookAdminSetting;
    facebook_redirect_uri: FacebookAdminSetting;
    frontend_url: FacebookAdminSetting;
  };
  is_configured: boolean;
  missing: string[];
  messenger_feature_enabled: boolean;
  instagram_comment_hide_enabled: boolean;
  help: {
    where_to_find: string;
    redirect_uri_note: string;
    frontend_url_note: string;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const facebookOAuthService = {
  /** Step 1 — get auth URL to open in popup */
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/facebook/initiate/');
    return res.data;
  },

  /** Step 3 — user picks which page for Messenger */
  async setupMessenger(accountId: number): Promise<{ success: boolean; page_name: string }> {
    const res = await api.post('/platforms/facebook/setup-messenger/', { account_id: accountId });
    return res.data;
  },

  /** GET connection health — called on mount and after OAuth */
  async getStatus(forceRefresh = false): Promise<FacebookConnectionStatus> {
    const res = await api.get('/platforms/facebook/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  /**
   * Disconnect every Meta surface at once — Facebook Pages, Instagram Business
   * accounts and the Messenger bot. They are granted together on one consent
   * screen, so they are revoked together.
   */
  async disconnect(): Promise<{
    success: boolean;
    removed: { facebook: number; instagram: number; messenger: number; ad_accounts: number };
    message: string;
  }> {
    const res = await api.post('/platforms/facebook/disconnect/');
    return res.data;
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<FacebookAdminSettings> {
    const res = await api.get('/admin/facebook-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{ success: boolean; message: string; is_configured: boolean; warnings?: string[] }> {
    const res = await api.post('/admin/facebook-settings/', data);
    return res.data;
  },

  async getMessengerWebhooks(): Promise<{ app_webhook: MessengerAppWebhook; connections: MessengerWebhookConnection[]; total: number }> {
    const res = await api.get('/admin/messenger-webhooks/');
    return res.data;
  },

  async regenerateVerifyToken(): Promise<{ success: boolean; message: string; messenger_webhook?: { webhook_url: string; verify_token: string } }> {
    const res = await api.post('/admin/facebook-settings/', { regenerate_verify_token: 'true' });
    return res.data;
  },

  async getFacebookAccounts(forceRefresh = false): Promise<{ accounts: FacebookAccountRow[]; total: number }> {
    const res = await api.get('/admin/facebook-accounts/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  async adminSetupMessenger(accountId: number): Promise<{
    success: boolean; page_name: string; webhook_verified: boolean;
    verify_token: string; webhook_url: string; warning?: string;
  }> {
    const res = await api.post('/admin/setup-messenger/', { account_id: accountId });
    return res.data;
  },

  async adminCheckSubscription(connectionId: number, resubscribe = false): Promise<{
    is_subscribed: boolean;
    subscribed_fields: string[];
    missing_fields: string[];
    app_mode?: { name: string; status: string; is_live: boolean; note: string };
    resubscribe_result?: { attempted: boolean; success?: boolean; error?: string };
    diagnosis: string;
  }> {
    const res = await api.post('/admin/check-subscription/', { connection_id: connectionId, resubscribe });
    return res.data;
  },

  async adminTestWebhook(connectionId: number): Promise<{
    connection: {
      id: number; page_id: string; page_name: string; user: string;
      is_active: boolean; is_webhook_verified: boolean; has_ai_config: boolean;
    };
    webhook_call: { status_code?: number; ok?: boolean; error?: string };
    conversations: {
      before_test: number; after_test: number; new_conversation: boolean;
      recent: Array<{ id: number; sender_id: string; sender_name: string | null; message_count: number; last_message_at: string }>;
    };
    diagnosis: string;
  }> {
    const res = await api.post('/admin/test-webhook/', { connection_id: connectionId });
    return res.data;
  },
};

export default facebookOAuthService;
