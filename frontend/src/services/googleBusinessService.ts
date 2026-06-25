import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GBPStatusAccount {
  account_id: number;
  name: string;
  gbp_account_id: string | null;
  location_id: string | null;
  location_name: string | null;
  has_location: boolean;
  has_refresh_token: boolean;
  status: 'active' | 'invalid' | 'expired' | 'disconnected';
  status_display: string;
  is_active: boolean;
  token_expires_at: string | null;
  error_message: string | null;
  connected_at: string | null;
}

export interface GBPConnectionStatus {
  overall_status: 'fully_connected' | 'partially_connected' | 'needs_attention' | 'not_connected';
  accounts: GBPStatusAccount[];
  total_accounts: number;
  active_accounts: number;
}

export interface GBPLocation {
  location_id: string;
  title: string;
  address: string;
  phone: string;
  website: string;
}

export interface GBPLocationsResponse {
  account_id: string;
  locations: GBPLocation[];
  selected_location_id: string | null;
}

export type GBPCtaType = 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';

export interface GBPCreatePostPayload {
  summary: string;
  image_url?: string;
  cta_type?: GBPCtaType;
  cta_url?: string;
}

export interface GBPCreatePostResult {
  success: boolean;
  post_name: string;
  search_url: string;
  message: string;
}

export interface GBPReview {
  review_id: string;
  name: string;          // full resource path used for replying
  reviewer: string;
  star_rating: number;   // 0-5
  comment: string;
  reply: string;
  has_reply: boolean;
  create_time: string;
  update_time: string;
}

// ── Admin Types ───────────────────────────────────────────────────────────────

export interface GBPAdminSetting {
  value: string;
  is_set: boolean;
  description: string;
}

export interface GBPAdminSettings {
  settings: {
    google_business_client_id: GBPAdminSetting;
    google_business_client_secret: GBPAdminSetting;
    google_business_redirect_uri: GBPAdminSetting;
    frontend_url: GBPAdminSetting;
  };
  is_configured: boolean;
  missing: string[];
  help: {
    where_to_find: string;
    redirect_uri_note: string;
    scope_note: string;
  };
}

// ── Helper: normalize an axios error into a readable string ───────────────────

function readError(err: any, fallback: string): string {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.error ||
    err?.response?.data?.details?.join?.(', ') ||
    err?.message ||
    fallback
  );
}

// ── Service ───────────────────────────────────────────────────────────────────

export const googleBusinessService = {
  /** Step 1 — get auth URL to open in popup */
  async initiate(): Promise<{ auth_url: string }> {
    const res = await api.get('/platforms/google-business/initiate/');
    return res.data;
  },

  /** GET connection health */
  async getStatus(forceRefresh = false): Promise<GBPConnectionStatus> {
    const res = await api.get('/platforms/google-business/status/', {
      params: forceRefresh ? { refresh: '1' } : undefined,
    });
    return res.data;
  },

  /** List the connected account's business locations */
  async getLocations(): Promise<GBPLocationsResponse> {
    const res = await api.get('/platforms/google-business/locations/');
    return res.data;
  },

  /** Pick which location to manage/post to */
  async selectLocation(locationId: string, locationName: string): Promise<{
    success: boolean; location_id: string; location_name: string; message: string;
  }> {
    const res = await api.post('/platforms/google-business/select-location/', {
      location_id: locationId,
      location_name: locationName,
    });
    return res.data;
  },

  /** Publish a Google Post */
  async createPost(payload: GBPCreatePostPayload): Promise<GBPCreatePostResult> {
    const res = await api.post('/platforms/google-business/post/', payload);
    return res.data;
  },

  /** AI-write a Google Post caption */
  async generateCaption(topic: string, tone = 'friendly'): Promise<{ success: boolean; caption: string }> {
    const res = await api.post('/platforms/google-business/ai/caption/', { topic, tone });
    return res.data;
  },

  /** AI-generate an image; returns a public URL */
  async generateImage(prompt: string, style = 'realistic'): Promise<{ success: boolean; image_url: string }> {
    const res = await api.post('/platforms/google-business/ai/image/', { prompt, style });
    return res.data;
  },

  /** List reviews for the selected location */
  async getReviews(): Promise<{ reviews: GBPReview[] }> {
    const res = await api.get('/platforms/google-business/reviews/');
    return res.data;
  },

  /** AI-generate a reply to a review */
  async generateReviewReply(reviewText: string, starRating?: number): Promise<{ success: boolean; reply: string }> {
    const res = await api.post('/platforms/google-business/reviews/ai-reply/', {
      review_text: reviewText,
      star_rating: starRating,
    });
    return res.data;
  },

  /** Publish a reply to a review */
  async replyToReview(reviewName: string, replyText: string): Promise<{ success: boolean; message: string; reply: string }> {
    const res = await api.post('/platforms/google-business/reviews/reply/', {
      review_name: reviewName,
      reply_text: replyText,
    });
    return res.data;
  },

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<GBPAdminSettings> {
    const res = await api.get('/admin/google-business-settings/');
    return res.data;
  },

  async saveAdminSettings(data: Record<string, string>): Promise<{
    success: boolean; message: string; is_configured: boolean; warnings?: string[];
  }> {
    const res = await api.post('/admin/google-business-settings/', data);
    return res.data;
  },

  readError,
};

export default googleBusinessService;
