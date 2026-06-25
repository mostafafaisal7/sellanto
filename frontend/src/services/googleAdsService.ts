import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GAdsAccount {
  id: number;
  external_id: string;
  name: string;
  currency_code: string;
  last_synced_at: string | null;
}

export interface GAdsStatus {
  configured: boolean;        // OAuth client AND developer token both set
  oauth_configured: boolean;
  developer_token_set: boolean;
  accounts: GAdsAccount[];
  total_accounts: number;
}

export interface GAdsCustomer {
  customer_id: string;
  name: string;
  currency_code: string;
  timezone_name: string;
  is_manager: boolean;
  is_test_account: boolean;
  status?: string;        // ENABLED | CANCELED | CLOSED | SUSPENDED | ''
  connectable?: boolean;  // false for managers and draft/canceled clients
  manager_id?: string;    // parent MCC (set for sub-accounts discovered under a manager)
}

export interface GAdsCampaign {
  id: number;
  name: string;
  objective: string;
  status: string;
  provider: string;
  ad_account_id: number;
  external_campaign_id: string;
  daily_budget_minor: number;
  spend_to_date_minor: number;
  start_date: string | null;
  end_date: string | null;
  rejection_reason: string;
  created_at: string;
  warnings?: string[];
}

export interface GAdsInsightRow {
  date: string;
  impressions: number;
  clicks: number;
  spend_minor: number;
  ctr: number;
}

export type CampaignType = 'search' | 'display' | 'pmax' | 'video';

export interface Sitelink {
  text: string;
  url: string;
  description1?: string;
  description2?: string;
}

export interface AdScheduleSlot {
  day: string;        // MONDAY..SUNDAY
  start_hour: number; // 0-24
  end_hour: number;   // 0-24
}

export interface CreateCampaignPayload {
  ad_account_id: number;
  name: string;
  objective: string;          // traffic|leads|sales|awareness|engagement
  campaign_type?: CampaignType;
  daily_budget_usd: number;
  keywords?: string[];          // "quoted"=phrase, [bracketed]=exact, plain=broad
  negative_keywords?: string[];
  final_url?: string;
  headlines?: string[];       // >=3 to attach an ad (search/pmax), ≤30 chars
  descriptions?: string[];    // >=2, ≤90 chars
  long_headlines?: string[];  // pmax — ≤90 chars
  long_headline?: string;     // display — ≤90 chars
  business_name?: string;     // display/pmax — ≤25 chars
  marketing_image_urls?: string[];  // display/pmax
  logo_image_urls?: string[];       // display/pmax
  start_date?: string;        // YYYYMMDD
  end_date?: string;          // YYYYMMDD
  dry_run?: boolean;
  // Video
  video_url?: string;         // YouTube URL/id (video campaigns)
  // Search targeting + extensions
  geo_targets?: string[];     // country codes: US, GB, ...
  ad_schedule?: AdScheduleSlot[];
  sitelinks?: Sitelink[];
  callouts?: string[];        // ≤25 chars each
  snippet_header?: string;    // e.g. Brands, Services
  snippet_values?: string[];  // ≥3, ≤25 chars each
  // Display / PMax / Video targeting
  audience_ids?: string[];    // user-interest category IDs (audience picker)
  search_themes?: string[];   // pmax — asset-group signals
  // Fine-grained targeting
  languages?: string[];       // ISO codes: en, es, fr...
  devices?: string[];         // devices to KEEP: MOBILE, DESKTOP, TABLET
  radius_targets?: { lat: number; lng: number; radius: number; unit?: string }[];
  exclude_ages?: string[];    // '18-24', '25-34', ... '65+'
  exclude_genders?: string[]; // 'male', 'female'
  // Bidding (Search)
  bidding_strategy?: string;  // manual_cpc | maximize_clicks | maximize_conversions | target_cpa | maximize_conversion_value | target_roas
  target_cpa_usd?: number;
  target_roas?: number;
  // A/B testing — extra RSA variations in the same ad group
  ad_variations?: { headlines: string[]; descriptions: string[] }[];
}

export interface CampaignSuggestion {
  name: string;
  objective: string;
  campaign_type: CampaignType;
  daily_budget_usd: number;
  headlines: string[];
  descriptions: string[];
  long_headlines: string[];
  keywords: string[];
  business_name: string;
  final_url_hint?: string;
  callouts?: string[];
  sitelinks?: Sitelink[];
  snippet_header?: string;
  snippet_values?: string[];
  search_themes?: string[];   // pmax — asset-group signals
}

export interface CampaignDraft {
  brand_id: number;
  campaign_type: CampaignType;
  topic: string;
  suggestion: CampaignSuggestion;
  updated_at: string;
}

export interface AudienceCategory {
  id: string;
  name: string;
  taxonomy: string;
}

export interface GAdsLocation {
  id: string;
  resource_name: string;
  name: string;
  canonical_name: string;
  target_type: string;
  country_code: string;
  reach: number;
}

export interface AdRule {
  id: number;
  campaign_id: number;
  name: string;
  metric: 'spend' | 'cpc' | 'ctr' | 'conversions' | 'cpa';
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  lookback_days: number;
  action: 'pause' | 'notify' | 'increase_budget' | 'decrease_budget';
  action_value: number;
  is_active: boolean;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
}

export interface ExperimentArm {
  name: string;
  control: boolean;
  traffic_split: number;
  campaign_id: string;
}

export interface Experiment {
  id: string;
  resource_name: string;
  name: string;
  status: string;
  type: string;
  description: string;
  start_date: string;
  end_date: string;
  arms: ExperimentArm[];
}

export interface ExperimentResultRow {
  name: string;
  control: boolean;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  average_cpc_micros: number;
}

export interface GAdsAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface GAdsAdminSettings {
  settings: Record<string, GAdsAdminSetting>;
  is_configured: boolean;
  missing: string[];
  help: Record<string, string>;
}

// ── Error reader (mirrors googleBusinessService) ──────────────────────────────

function readError(err: any, fallback = 'Something went wrong.'): string {
  const msg =
    err?.response?.data?.error ||
    err?.response?.data?.detail ||
    err?.response?.data?.details?.map?.((d: any) => d?.message || d)?.join?.(', ') ||
    err?.message ||
    fallback;
  // Guard: if the backend ever returns a non-string in `error`, never let an
  // object reach a React child (which would crash the render).
  return typeof msg === 'string' ? msg : JSON.stringify(msg);
}

// ── Service ───────────────────────────────────────────────────────────────────

export const googleAdsService = {
  /** Connection health: is the app configured + which Google ad accounts are saved */
  async getStatus(): Promise<GAdsStatus> {
    const res = await api.get('/ads/google/status/');
    return res.data;
  },

  /** Step 1 — get OAuth URL to open in popup */
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/ads/google/initiate/');
    return res.data;
  },

  /**
   * Step 1b — server-side handoff. Poll this after opening the OAuth popup;
   * the callback stashes the pending_token in the cache keyed to the user, so
   * this works even when cross-origin postMessage/localStorage fail.
   */
  async getPending(): Promise<{ pending_token: string | null }> {
    const res = await api.get('/ads/google/pending/');
    return res.data;
  },

  /** Step 2 — after popup returns a pending_token, list accessible customers */
  async listCustomers(pendingToken: string): Promise<{ customers: GAdsCustomer[]; count: number; connectable_count?: number; notice?: string | null }> {
    const res = await api.post('/ads/google/customers/', { pending_token: pendingToken });
    return res.data;
  },

  /** Step 3 — persist a chosen customer as a connected ad account.
   *  managerId is the parent MCC of a client sub-account (required as
   *  login-customer-id to read it); omit for standalone accounts. */
  async connect(pendingToken: string, customerId: string, brandId?: number, managerId?: string): Promise<{
    connected: boolean; created: boolean; account: any;
  }> {
    const res = await api.post('/ads/google/connect/', {
      pending_token: pendingToken,
      customer_id: customerId,
      brand_id: brandId,
      manager_id: managerId,
    });
    return res.data;
  },

  /** List the user's connected Google ad accounts */
  async getAccounts(): Promise<{ accounts: GAdsAccount[] }> {
    const res = await api.get('/ads/accounts/', { params: { provider: 'google' } });
    return res.data;
  },

  /** List the user's campaigns (all providers — filter client-side by provider) */
  async getCampaigns(): Promise<{ campaigns: GAdsCampaign[] }> {
    const res = await api.get('/ads/campaigns/');
    return res.data;
  },

  /** Create a Google Search campaign (set dry_run to validate only) */
  async createCampaign(payload: CreateCampaignPayload): Promise<GAdsCampaign & { dry_run?: boolean; validated?: boolean }> {
    const res = await api.post('/ads/google/campaigns/create/', payload);
    return res.data;
  },

  /** AI proposes a full campaign from Brand DNA + a topic */
  async suggestCampaign(topic: string, campaignType: CampaignType, brandId?: number): Promise<{
    success: boolean; suggestion: CampaignSuggestion;
  }> {
    const res = await api.post('/ads/google/suggest/', {
      topic, campaign_type: campaignType, brand_id: brandId,
    });
    return res.data;
  },

  /** Load the last saved AI draft so generated content survives a reload. */
  async getDraft(campaignType: CampaignType, brandId?: number): Promise<{
    success: boolean; draft: CampaignDraft | null;
  }> {
    const res = await api.get('/ads/google/suggest/', {
      params: { campaign_type: campaignType, brand_id: brandId },
    });
    return res.data;
  },

  /** Create a website conversion action (conversion tracking setup) */
  async createConversionAction(params: {
    ad_account_id: number; name: string; category?: string; value_usd?: number; dry_run?: boolean;
  }): Promise<{ success: boolean; conversion_action_resource?: string; note?: string; dry_run?: boolean }> {
    const res = await api.post('/ads/google/conversion-action/', params);
    return res.data;
  },

  /** Search Google's user-interest catalog → audience categories for targeting */
  async searchAudiences(adAccountId: number, q: string): Promise<{
    success: boolean; results: AudienceCategory[];
  }> {
    const res = await api.get('/ads/google/audiences/', {
      params: { ad_account_id: adAccountId, q },
    });
    return res.data;
  },

  /** AI-generate an ad image (Brand-DNA aware) → public URL for Display/PMax.
   *  kind: 'marketing' (1.91:1) | 'square' (1:1) | 'logo' (1:1). */
  async generateImage(params: {
    prompt?: string; kind?: 'marketing' | 'square'; brand_id?: number; ad_account_id?: number;
  }): Promise<{ success: boolean; image_url: string; kind: string; provider: string; model: string }> {
    const res = await api.post('/ads/google/generate-image/', params);
    return res.data;
  },

  /** AI-generate a video clip (Brand-DNA aware). Returns a hosted preview URL +
   *  a note: Google runs video ads only from YouTube, so the user must upload it. */
  async generateVideo(params: {
    prompt?: string; brand_id?: number; duration?: number; aspect_ratio?: string;
  }): Promise<{
    success: boolean; video_url: string; youtube_url: string; youtube_video_id: string;
    model: string; note: string;
  }> {
    const res = await api.post('/ads/google/generate-video/', params);
    return res.data;
  },

  /** Upload offline/CRM conversions against a conversion action (smart-bidding fuel). */
  async uploadOfflineConversions(params: {
    ad_account_id: number;
    conversion_action_resource: string;
    conversions: Array<{ gclid: string; conversion_date_time: string; value?: number; currency?: string }>;
  }): Promise<{ success: boolean; uploaded: number; failed: number; errors: string[] }> {
    const res = await api.post('/ads/google/offline-conversions/', params);
    return res.data;
  },

  /** Upload an image file → returns a public URL usable as a Display/PMax asset */
  async uploadImage(file: File): Promise<{ image_url: string }> {
    const fd = new FormData();
    fd.append('image', file);
    const res = await api.post('/ads/google/image-upload/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Edit a live campaign — rename and/or change daily budget (USD). */
  async updateCampaign(campaignId: number, changes: { name?: string; daily_budget_usd?: number }): Promise<GAdsCampaign> {
    const res = await api.patch(`/ads/campaigns/${campaignId}/`, changes);
    return res.data;
  },

  /** Remove/archive a campaign (stops serving; hidden on the provider). */
  async deleteCampaign(campaignId: number): Promise<{ archived?: boolean; deleted?: boolean }> {
    const res = await api.delete(`/ads/campaigns/${campaignId}/`);
    return res.data;
  },

  // ── Automation rules ─────────────────────────────────────────────────────────
  async listRules(campaignId?: number): Promise<{ rules: AdRule[] }> {
    const res = await api.get('/ads/rules/', { params: campaignId ? { campaign_id: campaignId } : {} });
    return res.data;
  },
  async createRule(rule: { campaign_id: number; name?: string; metric: string; operator: string;
    threshold: number; lookback_days?: number; action: string; action_value?: number; is_active?: boolean }): Promise<AdRule> {
    const res = await api.post('/ads/rules/', rule);
    return res.data;
  },
  async updateRule(id: number, changes: Partial<AdRule>): Promise<AdRule> {
    const res = await api.patch(`/ads/rules/${id}/`, changes);
    return res.data;
  },
  async deleteRule(id: number): Promise<{ deleted: boolean }> {
    const res = await api.delete(`/ads/rules/${id}/`);
    return res.data;
  },

  async pauseCampaign(campaignId: number): Promise<GAdsCampaign> {
    const res = await api.post(`/ads/campaigns/${campaignId}/pause/`);
    return res.data;
  },

  async resumeCampaign(campaignId: number): Promise<GAdsCampaign> {
    const res = await api.post(`/ads/campaigns/${campaignId}/resume/`);
    return res.data;
  },

  async getInsights(campaignId: number, datePreset = 'last_7d'): Promise<{ insights: GAdsInsightRow[]; count: number }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/insights/`, {
      params: { date_preset: datePreset },
    });
    return res.data;
  },

  /** Per-keyword performance for a campaign. */
  async getKeywordInsights(campaignId: number, datePreset = 'last_7d'): Promise<{
    keywords: Array<{ keyword: string; match_type: string; impressions: number; clicks: number;
      cost_micros: number; conversions: number; ctr: number }>;
    count: number;
  }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/keywords/`, {
      params: { date_preset: datePreset },
    });
    return res.data;
  },

  /** Search-terms report (actual queries that triggered ads). */
  async getSearchTerms(campaignId: number, datePreset = 'last_7d'): Promise<{
    search_terms: Array<{ search_term: string; status: string; impressions: number; clicks: number;
      cost_micros: number; conversions: number; ctr: number }>;
    count: number;
  }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/search-terms/`, {
      params: { date_preset: datePreset },
    });
    return res.data;
  },

  /** Account-level dashboard rollup (per-campaign totals + grand totals). */
  async getAccountSummary(adAccountId: number, datePreset = 'last_30d'): Promise<{
    campaigns: Array<{ campaign_id: string; name: string; status: string; channel_type: string;
      impressions: number; clicks: number; cost_micros: number; conversions: number;
      conversions_value: number; ctr: number }>;
    totals: { impressions: number; clicks: number; cost_micros: number; conversions: number; conversions_value: number };
    count: number;
  }> {
    const res = await api.get('/ads/google/account-summary/', {
      params: { ad_account_id: adAccountId, date_preset: datePreset },
    });
    return res.data;
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<GAdsAdminSettings> {
    const res = await api.get('/admin/google-ads-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{
    success: boolean; message: string; is_configured: boolean; warnings?: string[];
  }> {
    const res = await api.post('/admin/google-ads-settings/', data);
    return res.data;
  },

  // ── Advanced (full feature parity) ──────────────────────────────────────────
  /** Location lookup by name → geo-target constants. */
  async searchLocations(adAccountId: number, q: string, country = ''): Promise<{ results: GAdsLocation[] }> {
    const res = await api.get('/ads/google/locations/', { params: { ad_account_id: adAccountId, q, country } });
    return res.data;
  },
  /** Richer audience lists: in_market | affinity | custom | user_list. */
  async listAudiences(adAccountId: number, kind: string, q = ''): Promise<{ results: AudienceCategory[] }> {
    const res = await api.get('/ads/google/audience-list/', { params: { ad_account_id: adAccountId, kind, q } });
    return res.data;
  },
  async createCustomerMatch(params: { ad_account_id: number; name: string; emails?: string[]; phones?: string[]; membership_days?: number }): Promise<any> {
    const res = await api.post('/ads/google/customer-match/', params);
    return res.data;
  },
  async listSharedBudgets(adAccountId: number): Promise<{ budgets: Array<{ id: string; name: string; daily_usd: number }> }> {
    const res = await api.get('/ads/google/shared-budgets/', { params: { ad_account_id: adAccountId } });
    return res.data;
  },
  async createSharedBudget(params: { ad_account_id: number; name: string; daily_usd: number }): Promise<any> {
    const res = await api.post('/ads/google/shared-budgets/', params);
    return res.data;
  },
  async listPortfolioStrategies(adAccountId: number): Promise<{ strategies: Array<{ id: string; name: string; type: string }> }> {
    const res = await api.get('/ads/google/portfolio-strategies/', { params: { ad_account_id: adAccountId } });
    return res.data;
  },
  async createPortfolioStrategy(params: { ad_account_id: number; name: string; strategy: string; target_cpa_usd?: number; target_roas?: number }): Promise<any> {
    const res = await api.post('/ads/google/portfolio-strategies/', params);
    return res.data;
  },
  async listRecommendations(adAccountId: number): Promise<{ recommendations: Array<{ type: string; campaign: string; resource_name: string }> }> {
    const res = await api.get('/ads/google/recommendations/', { params: { ad_account_id: adAccountId } });
    return res.data;
  },
  async applyRecommendation(adAccountId: number, resourceName: string, doAction: 'apply' | 'dismiss' = 'apply'): Promise<any> {
    const res = await api.post('/ads/google/recommendations/', { ad_account_id: adAccountId, resource_name: resourceName, do: doAction });
    return res.data;
  },
  async keywordIdeas(params: { ad_account_id: number; seeds?: string[]; url?: string; language?: string; geo_codes?: string[] }): Promise<{ ideas: Array<{ text: string; avg_monthly_searches: number; competition: string; low_bid_micros: number; high_bid_micros: number }> }> {
    const res = await api.post('/ads/google/keyword-ideas/', params);
    return res.data;
  },
  async changeHistory(adAccountId: number, days = 14): Promise<{ events: Array<{ date_time: string; resource_type: string; operation: string; user_email: string; client_type: string }> }> {
    const res = await api.get('/ads/google/change-history/', { params: { ad_account_id: adAccountId, days } });
    return res.data;
  },
  async listLabels(adAccountId: number): Promise<{ labels: Array<{ id: string; name: string; color: string }> }> {
    const res = await api.get('/ads/google/labels/', { params: { ad_account_id: adAccountId } });
    return res.data;
  },
  async createLabel(params: { ad_account_id: number; name: string; color?: string; description?: string }): Promise<any> {
    const res = await api.post('/ads/google/labels/', params);
    return res.data;
  },
  // Campaign-scoped editing + segments
  async listAdGroups(campaignId: number): Promise<{ ad_groups: Array<{ id: string; name: string; status: string; type: string }> }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/ad-groups/`);
    return res.data;
  },
  async createAdGroup(campaignId: number, name: string, cpcBidUsd = 1.0): Promise<any> {
    const res = await api.post(`/ads/campaigns/${campaignId}/ad-groups/`, { name, cpc_bid_usd: cpcBidUsd });
    return res.data;
  },
  async updateAdGroup(campaignId: number, adGroupId: string, changes: { name?: string; status?: string }): Promise<any> {
    const res = await api.patch(`/ads/campaigns/${campaignId}/ad-groups/${adGroupId}/`, changes);
    return res.data;
  },
  async removeAdGroup(campaignId: number, adGroupId: string): Promise<any> {
    const res = await api.delete(`/ads/campaigns/${campaignId}/ad-groups/${adGroupId}/`);
    return res.data;
  },
  async listKeywordsEdit(campaignId: number): Promise<{ keywords: Array<{ criterion_id: string; ad_group_id: string; text: string; match_type: string; status: string; negative: boolean }> }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/keywords-edit/`);
    return res.data;
  },
  async addKeyword(campaignId: number, params: { ad_group_id: string; text: string; match_type?: string; negative?: boolean }): Promise<any> {
    const res = await api.post(`/ads/campaigns/${campaignId}/keywords-edit/`, params);
    return res.data;
  },
  async removeKeywordEdit(campaignId: number, adGroupId: string, criterionId: string): Promise<any> {
    const res = await api.delete(`/ads/campaigns/${campaignId}/keywords-edit/`, { data: { ad_group_id: adGroupId, criterion_id: criterionId } });
    return res.data;
  },
  async listAdsEdit(campaignId: number): Promise<{ ads: Array<{ ad_id: string; ad_group_id: string; type: string; status: string }> }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/ads-edit/`);
    return res.data;
  },
  async setAdStatus(campaignId: number, adGroupId: string, adId: string, status: string): Promise<any> {
    const res = await api.patch(`/ads/campaigns/${campaignId}/ads-edit/`, { ad_group_id: adGroupId, ad_id: adId, status });
    return res.data;
  },
  async getSegments(campaignId: number, segment = 'device', datePreset = 'last_30d'): Promise<{ rows: Array<{ segment: string; impressions: number; clicks: number; cost_micros: number; conversions: number }> }> {
    const res = await api.get(`/ads/campaigns/${campaignId}/segments/`, { params: { segment, date_preset: datePreset } });
    return res.data;
  },

  // ── Experiments (A/B at campaign level) ────────────────────────────────────
  async listExperiments(adAccountId: number): Promise<{ experiments: Experiment[] }> {
    const res = await api.get('/ads/google/experiments/', { params: { ad_account_id: adAccountId } });
    return res.data;
  },
  async createExperiment(params: {
    campaign_pk: number;
    name: string;
    traffic_split?: number;
    description?: string;
    goals?: Array<{ metric: string; direction: string }>;
  }): Promise<{ experiment_id: string; trial_campaign_id: string; traffic_split: number }> {
    const res = await api.post('/ads/google/experiments/', params);
    return res.data;
  },
  async getExperimentResults(adAccountId: number, experimentId: string, datePreset = 'last_30d'): Promise<{ results: ExperimentResultRow[] }> {
    const res = await api.get(`/ads/google/experiments/${experimentId}/`, { params: { ad_account_id: adAccountId, date_preset: datePreset } });
    return res.data;
  },
  async experimentAction(
    experimentId: string,
    params: { ad_account_id: number; action: 'schedule' | 'end' | 'promote' | 'graduate'; validate_only?: boolean; budget_resource?: string; budget_id?: string },
  ): Promise<any> {
    const res = await api.post(`/ads/google/experiments/${experimentId}/`, params);
    return res.data;
  },

  readError,
};

export default googleAdsService;
