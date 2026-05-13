import api from './api';

export interface StripeAdminField {
  key: string;            // 'publishable_key', 'secret_key', 'price_pro_monthly', ...
  site_config_key: string;
  env_var: string;
  description: string;
  is_secret: boolean;
  is_set: boolean;
  value: string;          // masked if is_secret=true
  source: '' | 'db' | 'env';
}

export interface StripeAdminStatus {
  keys_ready: boolean;
  plan_prices_ready: boolean;
  topup_prices_ready: boolean;
  fully_configured: boolean;
  mode: 'test' | 'live' | 'unknown';
}

export interface StripeWebhookInfo {
  url: string;
  events_to_subscribe: string[];
  note: string;
}

export interface StripeAdminConfigResponse {
  fields: StripeAdminField[];
  status: StripeAdminStatus;
  webhook: StripeWebhookInfo;
  help: { dashboard_url: string; mode_note: string };
}

export interface StripeAdminSaveResponse {
  updated: string[];
  errors: string[];
  fields: StripeAdminField[];
  fully_configured: boolean;
}

export interface StripeTestConnectionResponse {
  ok: boolean;
  account_id?: string;
  mode?: 'test' | 'live';
  email?: string;
  business_name?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  error?: string;
}

export const adminStripeService = {
  async get(): Promise<StripeAdminConfigResponse> {
    const { data } = await api.get<StripeAdminConfigResponse>(
      '/admin/stripe-settings/',
    );
    return data;
  },

  /**
   * Save a partial payload. Empty-string values clear the DB row so the
   * field falls back to the env var. Secrets that come back masked from
   * the GET endpoint should NOT be re-posted unchanged.
   */
  async save(payload: Record<string, string>): Promise<StripeAdminSaveResponse> {
    const { data } = await api.post<StripeAdminSaveResponse>(
      '/admin/stripe-settings/',
      payload,
    );
    return data;
  },

  async testConnection(): Promise<StripeTestConnectionResponse> {
    const { data } = await api.get<StripeTestConnectionResponse>(
      '/admin/stripe-settings/test/',
    );
    return data;
  },
};

export default adminStripeService;
