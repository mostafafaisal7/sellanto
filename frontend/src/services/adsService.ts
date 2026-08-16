/**
 * adsService — typed wrappers for /api/v1/ads/ endpoints.
 * Backend: ads/views.py
 */
import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdAccount {
  id: number;
  provider: 'meta' | 'google';
  external_id: string;
  name: string;
  currency_code: string;
  timezone_name: string;
  /** Meta account_status: 1 = live, 101 = sandbox/test, 2 = disabled, ... */
  account_status?: number | null;
  /** True for Meta sandbox (test) ad accounts — no real spend/delivery. */
  is_sandbox?: boolean;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  business_id?: string;
  business_name?: string;
}

export interface AdCampaign {
  id: number;
  name: string;
  objective: string;
  status:
    | 'draft'
    | 'pending_review'
    | 'active'
    | 'paused'
    | 'completed'
    | 'disapproved'
    | 'failed'
    | 'archived';
  provider: string;
  ad_account_id: number;
  brand_id: number | null;
  boosted_post_id: number | null;
  external_campaign_id: string;
  external_ad_id: string;
  daily_budget_minor: number;
  spend_to_date_minor: number;
  start_date: string | null;
  end_date: string | null;
  rejection_reason: string;
  created_at: string;
}

export interface AdAudience {
  id: number;
  name: string;
  audience_type: 'custom' | 'lookalike' | 'saved';
  ad_account_id: number;
  brand_id: number | null;
  external_id: string;
  size_estimate: number;
  config: Record<string, unknown>;
  is_ready: boolean;
  created_at: string;
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

/**
 * A deep per-day insight row returned by the campaign-insights and
 * entity-insights endpoints. `roas`/`cpa`/`conversions` are parsed server-side
 * from Meta's purchase_roas / cost_per_action_type / actions; they are 0 when
 * Meta reports no data for the row. `spend_minor`/`cpc`/`cpm` are money;
 * spend_minor is account-currency minor units (cents), cpc/cpm are major units.
 */
export interface DeepInsightRow {
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  spend_minor: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  conversions: number;
  roas: number;
  cpa: number;
}

/** Breakdown dimensions supported by /ads/campaigns/{id}/breakdown/. */
export type BreakdownDimension =
  | 'age'
  | 'gender'
  | 'age,gender'
  | 'publisher_platform'
  | 'region'
  | 'country'
  | 'impression_device'
  | 'device_platform';

/**
 * One row of a breakdown report. Metrics are always present; the dimension
 * fields (age/gender/publisher_platform/…) vary by the requested breakdown, so
 * they're indexed loosely as optional strings.
 */
export interface BreakdownRow {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  actions?: Array<{ action_type: string; value: number }>;
  age?: string;
  gender?: string;
  publisher_platform?: string;
  region?: string;
  country?: string;
  impression_device?: string;
  device_platform?: string;
  [key: string]: unknown;
}

export interface BreakdownResponse {
  breakdown: string;
  rows: BreakdownRow[];
}

/** A targeting spec result (interest / behavior / demographic). */
export interface TargetingSearchResult {
  id: string;
  name: string;
  audience_size: number;
  path?: string[];
  type: string;
}

/** A geo (city / region / country) targeting result. */
export interface GeoSearchResult {
  key: string;
  name: string;
  type: string;
  country_code: string;
}

/** A live Meta custom/lookalike/saved audience. */
export interface LiveAudience {
  id: string;
  name: string;
  subtype: string;
  approximate_count?: number | null;
  delivery_status?: string | null;
  operation_status?: string | null;
}

/** AI-generated campaign suggestion. */
export interface CampaignSuggestion {
  name: string;
  objective: string;
  daily_budget_usd: number;
  primary_text: string;
  headline: string;
  description: string;
  link_description?: string;
  call_to_action: string;
  targeting: {
    countries: string[];
    age_min: number;
    age_max: number;
    genders: number[];
    interests: Array<{ id: string; name: string }> | string[];
  };
}

export interface AccountSummary {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  reach: number;
  conversions: number;
  active_campaigns: number;
  paused_campaigns: number;
  total_campaigns: number;
}

export interface AccountRecommendation {
  title: string;
  message: string;
  severity: string;
}

/** A published/scheduled post eligible for boosting. */
export interface BoostablePost {
  id: number;
  caption: string;
  status: string;
  facebook_post_id?: string | null;
  instagram_post_id?: string | null;
  scheduled_time?: string | null;
  ai_generated: boolean;
  thumbnail?: string | null;
}

/** A reusable media asset for ad creatives, from the media library. */
export interface MediaItem {
  /** Prefixed id, e.g. "img-12", "mvid-3", "clip-7", "post-9". */
  id: string;
  kind: 'image' | 'video';
  /** Absolute URL Meta/the frontend can fetch. */
  url: string;
  thumbnail: string;
  source: 'generated_image' | 'generated_video' | 'post';
  label: string;
  created_at: string | null;
}

export interface MediaLibraryResponse {
  items: MediaItem[];
  count: number;
}

/** A native Instant Lead Form on a Facebook Page. */
export interface LeadForm {
  id: string;
  name: string;
  status?: string;
  leads_count?: number;
}

/** One submitted lead: field_data is a list of {name, values} answers. */
export interface FormLead {
  id: string;
  created_time: string;
  field_data: Array<{ name: string; values: string[] }>;
}

/** A lead-form question: a standard field or a custom free-text field. */
export type LeadFormQuestion =
  | string
  | { type: string }
  | { type: 'CUSTOM'; key?: string; label: string; options?: unknown[] };


// ── Service ───────────────────────────────────────────────────────────────────

export const adsService = {
  async listAdAccounts(): Promise<{ accounts: AdAccount[] }> {
    const res = await api.get('/ads/accounts/');
    return res.data;
  },

  async connectMeta(userAccessToken: string, brandId?: number): Promise<{
    connected: AdAccount[];
    count?: number;
    message?: string;
  }> {
    const res = await api.post('/ads/accounts/connect-meta/', {
      user_access_token: userAccessToken,
      brand_id: brandId,
    });
    return res.data;
  },

  async listCampaigns(provider?: 'meta' | 'google'): Promise<{ campaigns: AdCampaign[] }> {
    const res = await api.get('/ads/campaigns/', {
      params: provider ? { provider } : undefined,
    });
    return res.data;
  },

  async getCampaign(id: number): Promise<AdCampaign> {
    const res = await api.get(`/ads/campaigns/${id}/`);
    return res.data;
  },

  async pauseCampaign(id: number): Promise<AdCampaign> {
    const res = await api.post(`/ads/campaigns/${id}/pause/`);
    return res.data;
  },

  async resumeCampaign(id: number): Promise<AdCampaign> {
    const res = await api.post(`/ads/campaigns/${id}/resume/`);
    return res.data;
  },

  async getCampaignInsights(id: number, datePreset = 'last_7d'): Promise<{
    insights: DeepInsightRow[];
    count: number;
  }> {
    const res = await api.get(`/ads/campaigns/${id}/insights/`, {
      params: { date_preset: datePreset },
    });
    return res.data;
  },

  async boostPost(params: {
    post_id: number;
    ad_account_id: number;
    daily_budget_usd: number;
    duration_days: number;
    targeting: Record<string, unknown>;
    /**
     * Meta Advantage audience. Meta requires the flag on every ad set create;
     * the backend defaults it to 0 (targeting used as strict limits) when this
     * is omitted. Send true to let Meta reach beyond the selected audience.
     */
    advantage_audience?: boolean;
    /** Required (true) to proceed on a LIVE (non-sandbox) ad account — real spend. */
    confirm_live?: boolean;
  }): Promise<AdCampaign> {
    const res = await api.post('/ads/boost-post/', params);
    return res.data;
  },

  /** Create a from-scratch Meta link/website campaign (awareness/traffic/leads/sales). */
  async createMetaCampaign(params: {
    ad_account_id: number;
    objective: 'awareness' | 'traffic' | 'engagement' | 'leads' | 'sales';
    name?: string;
    daily_budget_usd: number;
    duration_days?: number;
    link_url: string;
    message?: string;
    headline?: string;
    description?: string;
    image_url?: string;
    targeting?: Record<string, unknown>;
    activate?: boolean;
    /** Meta call-to-action button, e.g. LEARN_MORE / SHOP_NOW / SIGN_UP. */
    cta?: string;
    /** Short display link shown under the headline (e.g. yoursite.com). */
    display_link?: string;
    /**
     * Advantage+ multi-version copy (optional). When any of these has >1 entry,
     * Meta builds a dynamic asset_feed_spec creative and optimizes across the
     * variants. Falls back to the single fields (headline/message/description/cta)
     * when omitted. Each list is capped at 5.
     */
    headlines?: string[];
    messages?: string[];
    descriptions?: string[];
    cta_types?: string[];
    /** UTM/query-string appended to the creative's destination URL (e.g. utm_source=fb&utm_medium=cpc). */
    url_tags?: string;
    /**
     * Regulated ad categories (Meta special_ad_categories). Allowed values:
     * HOUSING | CREDIT | EMPLOYMENT | ISSUES_ELECTIONS_POLITICS |
     * FINANCIAL_PRODUCTS_SERVICES | ONLINE_GAMBLING_AND_GAMING. Unknown values
     * are ignored server-side. Omit/empty for a standard campaign.
     */
    special_ad_categories?: string[];
    /**
     * Budget mode. 'daily' (default) uses daily_budget_usd; 'lifetime' uses
     * lifetime_budget_usd on the ad set (an end_time is derived from
     * duration_days when start_time/end_time are not supplied).
     */
    budget_type?: 'daily' | 'lifetime';
    /** Lifetime budget in USD (required when budget_type='lifetime', min $1.50). */
    lifetime_budget_usd?: number;
    /** Explicit ISO-8601 ad-set start time (e.g. 2026-07-15T09:00:00Z). Optional. */
    start_time?: string;
    /** Explicit ISO-8601 ad-set end time. Optional (required by Meta for lifetime budgets — auto-derived when omitted). */
    end_time?: string;
    /** Bid strategy: LOWEST_COST_WITHOUT_CAP (default) | LOWEST_COST_WITH_BID_CAP | COST_CAP | LOWEST_COST_WITH_MIN_ROAS. */
    bid_strategy?: 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP' | 'LOWEST_COST_WITH_MIN_ROAS';
    /** Bid cap/target in USD — used only by the cap/target bid strategies. */
    bid_amount_usd?: number;
    /** Campaign-level lifetime spend ceiling in USD. Optional. */
    spend_cap_usd?: number;
    /** Override the objective-mapped ad-set optimization goal (validated server-side; ignored if unknown). */
    optimization_goal?: string;
    /** Override the ad-set billing event (validated server-side; ignored if unknown). */
    billing_event?: string;
    /**
     * Meta Pixel id for conversion tracking. When set on a 'sales' or 'leads'
     * objective, the ad set optimizes for the pixel + custom_event_type instead
     * of just the Page. Ignored for other objectives / when omitted.
     */
    pixel_id?: string;
    /** Conversion event to optimize for, e.g. PURCHASE | LEAD | ADD_TO_CART | COMPLETE_REGISTRATION. Defaults to PURCHASE server-side. */
    custom_event_type?: string;
    /**
     * Meta Advantage audience. Meta requires the flag on every ad set create;
     * the backend defaults it to 0 (targeting used as strict limits) when this
     * is omitted. Send true to let Meta reach beyond the selected audience.
     */
    advantage_audience?: boolean;
    /** Required (true) to proceed on a LIVE (non-sandbox) ad account — real spend. */
    confirm_live?: boolean;
  }): Promise<AdCampaign> {
    const res = await api.post('/ads/meta/campaigns/create/', params);
    return res.data;
  },

  /** GET /ads/meta/pixels/ — Meta Pixels on the ad account (conversion tracking picker). */
  async listMetaPixels(
    adAccountId?: number,
  ): Promise<{ pixels: Array<{ id: string; name: string; last_fired_time: string }> }> {
    const res = await api.get('/ads/meta/pixels/', {
      params: adAccountId ? { ad_account_id: adAccountId } : undefined,
    });
    return res.data;
  },

  /** Create a from-scratch Meta carousel campaign (2-10 swipeable cards). */
  async createCarousel(params: {
    ad_account_id: number;
    objective: 'awareness' | 'traffic' | 'engagement' | 'leads' | 'sales';
    name?: string;
    daily_budget_usd: number;
    duration_days?: number;
    targeting?: Record<string, unknown>;
    /** 2-10 cards. Each card needs a link + image_url; name/description/cta optional. */
    cards: Array<{
      link: string;
      name?: string;
      description?: string;
      image_url: string;
      cta?: string;
    }>;
    activate?: boolean;
    /**
     * Meta Advantage audience. Meta requires the flag on every ad set create;
     * the backend defaults it to 0 (targeting used as strict limits) when this
     * is omitted. Send true to let Meta reach beyond the selected audience.
     */
    advantage_audience?: boolean;
    /** Required (true) to proceed on a LIVE (non-sandbox) ad account — real spend. */
    confirm_live?: boolean;
  }): Promise<AdCampaign> {
    const res = await api.post('/ads/meta/carousel/', params);
    return res.data;
  },

  /**
   * Render a live Meta ad preview (generatepreviews) — no spend, nothing is
   * created. Returns an <iframe> HTML string to embed, plus the ad_format used.
   * Builds the same object_story_spec link_data creative as createMetaCampaign.
   */
  async getMetaAdPreview(params: {
    ad_account_id: number;
    /** DESKTOP_FEED_STANDARD | MOBILE_FEED_STANDARD | INSTAGRAM_STANDARD | INSTAGRAM_STORY | FACEBOOK_STORY_MOBILE | INSTAGRAM_REELS */
    ad_format?: string;
    link_url: string;
    message?: string;
    headline?: string;
    description?: string;
    image_url?: string;
    cta?: string;
    display_link?: string;
    /** Optional — resolved server-side from the active FB page when omitted. */
    page_id?: string;
  }): Promise<{ preview_html: string; ad_format: string }> {
    const res = await api.post('/ads/meta/preview/', params);
    return res.data;
  },

  /** Edit a live campaign — rename and/or change daily budget (USD). Works for both providers. */
  async updateCampaign(id: number, changes: { name?: string; daily_budget_usd?: number }): Promise<AdCampaign> {
    const res = await api.patch(`/ads/campaigns/${id}/`, changes);
    return res.data;
  },

  /** Archive/remove a campaign on the provider. */
  async deleteCampaign(id: number): Promise<{ archived?: boolean; deleted?: boolean }> {
    const res = await api.delete(`/ads/campaigns/${id}/`);
    return res.data;
  },

  /**
   * Path A — One-click "Publish + Boost" video ad.
   * Uploads a video to the user's FB Page AND boosts it as a paid ad in a
   * single backend call. Takes 30s-3min due to Meta video encoding.
   */
  async runVideoAd(params: {
    video: File;
    caption: string;
    ad_account_id: number;
    daily_budget_usd: number;
    duration_days: number;
    targeting: Record<string, unknown>;
    /**
     * Meta Advantage audience. Meta requires the flag on every ad set create;
     * the backend defaults it to 0 (targeting used as strict limits) when this
     * is omitted. Send true to let Meta reach beyond the selected audience.
     */
    advantage_audience?: boolean;
    /** Required (true) to proceed on a LIVE (non-sandbox) ad account — real spend. */
    confirm_live?: boolean;
    onUploadProgress?: (percent: number) => void;
  }): Promise<{
    post: { id: number; facebook_post_id: string; video_id: string };
    campaign: {
      id: number;
      external_campaign_id: string;
      status: string;
      daily_budget_minor: number;
    };
  }> {
    const fd = new FormData();
    fd.append('video', params.video);
    fd.append('caption', params.caption);
    fd.append('ad_account_id', String(params.ad_account_id));
    fd.append('daily_budget_usd', String(params.daily_budget_usd));
    fd.append('duration_days', String(params.duration_days));
    fd.append('targeting', JSON.stringify(params.targeting));
    // Multipart: booleans must be appended explicitly as strings — _parse_bool
    // on the server reads 'true'/'false'.
    fd.append('advantage_audience', params.advantage_audience ? 'true' : 'false');
    if (params.confirm_live) fd.append('confirm_live', 'true');

    const res = await api.post('/ads/run-video-ad/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Meta video encoding can take ~3min; give 6min total room.
      timeout: 6 * 60 * 1000,
      onUploadProgress: (e) => {
        if (params.onUploadProgress && e.total) {
          params.onUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return res.data;
  },

  // ── Saved audiences (reusable targeting presets) ──────────────────────────
  async listAudiences(adAccountId?: number): Promise<{ audiences: AdAudience[] }> {
    const res = await api.get('/ads/audiences/', {
      params: adAccountId ? { ad_account_id: adAccountId } : undefined,
    });
    return res.data;
  },

  async createAudience(params: {
    name: string;
    ad_account_id: number;
    audience_type?: 'custom' | 'lookalike' | 'saved';
    config?: Record<string, unknown>;
  }): Promise<AdAudience> {
    const res = await api.post('/ads/audiences/', params);
    return res.data;
  },

  async deleteAudience(id: number): Promise<{ deleted: boolean }> {
    const res = await api.delete(`/ads/audiences/${id}/`);
    return res.data;
  },

  // ── Automation rules (auto-pause / budget pacing) ─────────────────────────
  async listRules(campaignId?: number): Promise<{ rules: AdRule[] }> {
    const res = await api.get('/ads/rules/', {
      params: campaignId ? { campaign_id: campaignId } : undefined,
    });
    return res.data;
  },

  async createRule(params: {
    campaign_id: number;
    metric: AdRule['metric'];
    operator: AdRule['operator'];
    threshold: number;
    action: AdRule['action'];
    name?: string;
    lookback_days?: number;
    action_value?: number;
    is_active?: boolean;
  }): Promise<AdRule> {
    const res = await api.post('/ads/rules/', params);
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

  // ── Insights breakdown (age / gender / placement / region / device) ───────
  /** 1) GET /ads/campaigns/{id}/breakdown/ — segmented performance rows. */
  async getBreakdown(
    campaignId: number,
    breakdown: BreakdownDimension,
    datePreset = 'last_7d',
  ): Promise<BreakdownResponse> {
    const res = await api.get(`/ads/campaigns/${campaignId}/breakdown/`, {
      params: { date_preset: datePreset, breakdown },
    });
    return res.data;
  },

  // ── Live Meta targeting search (interests / behaviors / demographics) ─────
  /** 2) GET /ads/meta/targeting/search/ — search the Meta targeting catalog. */
  async searchTargeting(params: {
    q: string;
    type: 'interest' | 'behavior' | 'demographic';
    ad_account_id?: number;
  }): Promise<{ success: boolean; type: string; results: TargetingSearchResult[] }> {
    const res = await api.get('/ads/meta/targeting/search/', {
      params: { q: params.q, type: params.type, ad_account_id: params.ad_account_id },
    });
    return res.data;
  },

  /** 3) GET /ads/meta/targeting/geo/ — search countries / regions / cities. */
  async searchGeo(params: {
    q: string;
    ad_account_id?: number;
  }): Promise<{ success: boolean; results: GeoSearchResult[] }> {
    const res = await api.get('/ads/meta/targeting/geo/', {
      params: { q: params.q, ad_account_id: params.ad_account_id },
    });
    return res.data;
  },

  // ── Live Meta audiences (read-through from the ad account) ────────────────
  /** 4) GET /ads/meta/audiences/live/ — custom/lookalike audiences on Meta. */
  async listLiveAudiences(
    adAccountId?: number,
  ): Promise<{ audiences: LiveAudience[]; count: number }> {
    const res = await api.get('/ads/meta/audiences/live/', {
      params: adAccountId ? { ad_account_id: adAccountId } : undefined,
    });
    return res.data;
  },

  // ── AI campaign suggestion ────────────────────────────────────────────────
  /** 5) POST /ads/meta/suggest/ — AI-drafted campaign name/copy/targeting. */
  async suggestMetaCampaign(params: {
    topic?: string;
    objective?: string;
    brand_id?: number;
  }): Promise<{ success: boolean; suggestion: CampaignSuggestion }> {
    const res = await api.post('/ads/meta/suggest/', params);
    return res.data;
  },

  // ── Account-level insights & recommendations ──────────────────────────────
  /** 6) GET /ads/meta/account-summary/ — rolled-up KPIs for an ad account. */
  async getAccountSummary(params: {
    ad_account_id?: number;
    date_preset?: string;
  }): Promise<AccountSummary> {
    const res = await api.get('/ads/meta/account-summary/', {
      params: { ad_account_id: params.ad_account_id, date_preset: params.date_preset },
    });
    return res.data;
  },

  /** 7) GET /ads/meta/recommendations/ — actionable optimization tips. */
  async getRecommendations(
    adAccountId?: number,
  ): Promise<{ recommendations: AccountRecommendation[] }> {
    const res = await api.get('/ads/meta/recommendations/', {
      params: adAccountId ? { ad_account_id: adAccountId } : undefined,
    });
    return res.data;
  },

  // ── Entity-scoped insights drill-down (ad set / ad) ───────────────────────
  /**
   * GET /ads/meta/insights/ — deep insights for a single Meta ad set or ad,
   * so the UI can drill campaign → ad set → ad. Authorize by passing
   * ad_account_id OR campaign_id (the entity must belong to an owned account).
   */
  async getEntityInsights(params: {
    entity_id: string;
    level?: 'adset' | 'ad' | 'campaign' | 'account';
    date_preset?: string;
    ad_account_id?: number;
    campaign_id?: number;
  }): Promise<{
    level: string;
    entity_id: string;
    insights: DeepInsightRow[];
    count: number;
  }> {
    const res = await api.get('/ads/meta/insights/', {
      params: {
        entity_id: params.entity_id,
        level: params.level || 'ad',
        date_preset: params.date_preset || 'last_7d',
        ad_account_id: params.ad_account_id,
        campaign_id: params.campaign_id,
      },
    });
    return res.data;
  },

  // ── Boost from content (published or scheduled posts) ─────────────────────
  /** 8) GET /ads/boostable-posts/ — posts eligible to boost. */
  async getBoostablePosts(): Promise<{ posts: BoostablePost[] }> {
    const res = await api.get('/ads/boostable-posts/');
    return res.data;
  },

  /**
   * 9) POST /ads/boost-from-post/ — boost a specific content post.
   * May 409 with { requires_confirmation, detail } on LIVE accounts — resubmit
   * with confirm_live=true (same pattern as boostPost).
   */
  async boostFromPost(params: {
    post_id: number;
    ad_account_id: number;
    daily_budget_usd: number;
    duration_days: number;
    targeting: Record<string, unknown>;
    /**
     * Meta Advantage audience. Meta requires the flag on every ad set create;
     * the backend defaults it to 0 (targeting used as strict limits) when this
     * is omitted. Send true to let Meta reach beyond the selected audience.
     */
    advantage_audience?: boolean;
    /** Required (true) to proceed on a LIVE (non-sandbox) ad account — real spend. */
    confirm_live?: boolean;
    /** For a scheduled post: boost automatically once it publishes. */
    schedule_after_publish?: boolean;
  }): Promise<AdCampaign & { boost_on_publish?: boolean; detail?: string }> {
    const res = await api.post('/ads/boost-from-post/', params);
    return res.data;
  },

  /** 10) GET /ads/prefill-from-post/ — creative prefill from a post. */
  async prefillFromPost(
    postId: number,
  ): Promise<{ message: string; headline: string; image_url: string }> {
    const res = await api.get('/ads/prefill-from-post/', {
      params: { post_id: postId },
    });
    return res.data;
  },

  /**
   * 11) POST /ads/google/image-upload/ — upload an ad image, get a public URL.
   * Provider-neutral (just stores the file + returns a URL); reused for Meta
   * creatives. Accepts PNG/JPG/GIF up to 10 MB.
   */
  async uploadAdImage(
    file: File,
    onUploadProgress?: (percent: number) => void,
  ): Promise<{ image_url: string }> {
    const fd = new FormData();
    fd.append('image', file);
    const res = await api.post('/ads/google/image-upload/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onUploadProgress && e.total) {
          onUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return res.data;
  },

  /**
   * 12) GET /ads/media-library/?kind= — list reusable ad-creative media
   * (AI-generated images/videos + media already on the user's posts).
   * Read-only, no billing. `kind` defaults to 'all'.
   */
  async listMediaLibrary(
    kind: 'image' | 'video' | 'all' = 'all',
  ): Promise<MediaLibraryResponse> {
    const res = await api.get('/ads/media-library/', { params: { kind } });
    return res.data;
  },

  /**
   * 13) POST /ads/google/generate-image/ — AI-generate an ad image.
   * Provider-neutral (OpenAI/Gemini under the hood); reused for Meta creatives.
   * `kind` ∈ {marketing, square, logo} picks the aspect ratio (default
   * 'marketing'). Returns a hosted image_url that drops into the creative.
   * Diamond-billed.
   */
  async generateAdImage(
    prompt: string,
    kind: 'marketing' | 'square' | 'logo' = 'marketing',
    brandId?: number,
  ): Promise<{
    success: boolean;
    image_url: string;
    kind: string;
    provider: string;
    model: string;
    enhanced_prompt: string;
  }> {
    const res = await api.post('/ads/google/generate-image/', {
      prompt,
      kind,
      brand_id: brandId,
    });
    return res.data;
  },

  /**
   * 14) POST /ads/google/generate-video/ — AI-generate an ad video (Gemini Veo).
   * Returns a hosted video_url; if a YouTube account is connected the clip is
   * auto-uploaded (unlisted) and youtube_url/youtube_video_id are filled in.
   * `note` explains the YouTube requirement for Google video ads. Diamond-billed.
   */
  async generateAdVideo(
    prompt: string,
    opts?: {
      brandId?: number;
      duration?: number;
      aspectRatio?: '16:9' | '9:16' | '1:1' | string;
    },
  ): Promise<{
    success: boolean;
    video_url: string;
    youtube_url: string;
    youtube_video_id: string;
    model: string;
    note: string;
  }> {
    const res = await api.post('/ads/google/generate-video/', {
      prompt,
      brand_id: opts?.brandId,
      duration: opts?.duration,
      aspect_ratio: opts?.aspectRatio,
    });
    return res.data;
  },

  // ── Native Instant Lead Forms (Page-scoped) ─────────────────────
  /** GET /ads/meta/lead-forms/ — list the Page's lead forms. */
  async listLeadForms(): Promise<{ forms: LeadForm[]; count: number }> {
    const res = await api.get('/ads/meta/lead-forms/');
    return res.data;
  },

  /** POST /ads/meta/lead-forms/ — create a native Instant Lead Form. */
  async createLeadForm(params: {
    name: string;
    questions: LeadFormQuestion[];
    privacy_policy_url: string;
    thank_you?: {
      title?: string;
      body?: string;
      button_text?: string;
      button_type?: 'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'DOWNLOAD';
      website_url?: string;
    };
    intro?: {
      title?: string;
      style?: 'PARAGRAPH_STYLE' | 'LIST_STYLE';
      content?: string | string[];
      button_text?: string;
    };
  }): Promise<{ form_id: string }> {
    const res = await api.post('/ads/meta/lead-forms/', params);
    return res.data;
  },

  /** GET /ads/meta/lead-forms/{formId}/leads/ — submitted leads for a form. */
  async getFormLeads(formId: string): Promise<{ leads: FormLead[]; count: number }> {
    const res = await api.get(`/ads/meta/lead-forms/${formId}/leads/`);
    return res.data;
  },
};

export default adsService;
