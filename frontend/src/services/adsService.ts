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

  async listCampaigns(): Promise<{ campaigns: AdCampaign[] }> {
    const res = await api.get('/ads/campaigns/');
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
    insights: Array<{
      date: string;
      impressions: number;
      clicks: number;
      spend_minor: number;
      ctr: number;
    }>;
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
  }): Promise<AdCampaign> {
    const res = await api.post('/ads/boost-post/', params);
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
};

export default adsService;
