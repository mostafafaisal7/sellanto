import api from './api';

export type FeatureCategory = 'text' | 'image' | 'video' | 'voice' | 'ads' | 'misc';
export type CostType = 'text' | 'image' | 'video' | 'voice';

export interface FeatureCostRow {
  feature: string;
  category: FeatureCategory;
  cost_type: CostType;
  provider: string;
  model_used: string;
  markup_pct: string;
  flat_override_diamonds: number | null;
  is_active: boolean;
  notes: string;
  raw_cost_usd: string;
  raw_cost_diamonds: number;
  target_3x_diamonds: number;
  current_diamonds: number;
  gap_vs_target_pct: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface FeatureCostListResponse {
  rows: FeatureCostRow[];
  summary: {
    row_count: number;
    avg_raw_cost_usd: number;
    total_current_diamonds: number;
    total_target_diamonds: number;
    avg_gap_pct: number;
  };
  categories: FeatureCategory[];
}

export interface FeatureCostPatch {
  markup_pct?: number | string;
  flat_override_diamonds?: number | null;
  is_active?: boolean;
  notes?: string;
}

export interface FeatureCostPreviewBody {
  feature: string;
  markup_pct?: number | string;
  flat_override_diamonds?: number | null;
  modifiers?: {
    duration_seconds?: number;
    characters?: number;
    media_count?: number;
    model?: string;
  };
}

export interface FeatureCostPreviewResponse {
  feature: string;
  preview_diamonds: number;
  raw_cost_usd: string;
  raw_cost_diamonds: number;
  target_3x_diamonds: number;
  gap_vs_target_pct: number | null;
  used_flat_override: boolean;
}

export interface FeatureCostReseedResponse {
  ok: boolean;
  reseeded_count: number;
  features: string[];
}

// ── Historical audit ────────────────────────────────────────────

export interface HistoricalRow {
  feature: string;
  cost_type: CostType;
  category: FeatureCategory;
  provider_mix: Record<string, number>;
  dominant_provider: string;
  call_count: number;
  tokens_total: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  diamonds_charged_total: number;
  cost_basis_charged_usd: string;
  real_cost_usd: string;
  avg_real_cost_per_call_usd: string;
  margin_usd: string;
  current_diamonds_per_call: number;
  recommended_flat_override: number;
  gap_per_call_diamonds: number;
  projected_extra_revenue_usd: string;
  is_under_priced: boolean;
  low_confidence: boolean;
}

export interface HistoricalSummary {
  feature_count: number;
  total_calls: number;
  total_real_cost_usd: string;
  total_diamonds_charged: number;
  total_cost_basis_charged_usd: string;
  total_margin_usd: string;
  under_priced_count: number;
}

export interface HistoricalAuditResponse {
  window: {
    from: string;
    to: string;
    lookback_days: number | null;
  };
  summary: HistoricalSummary;
  rows: HistoricalRow[];
  min_calls_for_recommendation: number;
}

export interface FeatureRecommendation {
  feature: string;
  call_count: number;
  avg_real_cost_per_call_usd: string;
  recommended_flat_override: number;
  current_diamonds_per_call: number;
  gap_per_call_diamonds: number;
  markup_pct: string;
  low_confidence: boolean;
  fallback_used: boolean;
  window_days: number;
}

export interface ApplyRecommendationsResponse {
  applied: Array<{
    feature: string;
    old: number | null;
    new: number;
    call_count: number;
  }>;
  skipped: Array<{
    feature: string;
    reason: string;
    call_count?: number;
  }>;
}

export const adminFeatureCostsService = {
  async list(category?: FeatureCategory): Promise<FeatureCostListResponse> {
    const params = category ? { category } : undefined;
    const { data } = await api.get<FeatureCostListResponse>('/admin/feature-costs/', { params });
    return data;
  },

  async update(feature: string, patch: FeatureCostPatch): Promise<FeatureCostRow> {
    const { data } = await api.patch<FeatureCostRow>(
      `/admin/feature-costs/${feature}/`,
      patch,
    );
    return data;
  },

  async preview(body: FeatureCostPreviewBody): Promise<FeatureCostPreviewResponse> {
    const { data } = await api.post<FeatureCostPreviewResponse>(
      '/admin/feature-costs/preview/',
      body,
    );
    return data;
  },

  async reseedFromCode(): Promise<FeatureCostReseedResponse> {
    const { data } = await api.post<FeatureCostReseedResponse>(
      '/admin/feature-costs/reseed-from-code/',
    );
    return data;
  },

  async getHistorical(
    days: number,
    category?: FeatureCategory,
  ): Promise<HistoricalAuditResponse> {
    const params: Record<string, string | number> = { days };
    if (category) params.category = category;
    const { data } = await api.get<HistoricalAuditResponse>(
      '/admin/feature-costs/history/',
      { params },
    );
    return data;
  },

  async recommendFromHistory(
    feature: string,
    days: number,
  ): Promise<FeatureRecommendation> {
    const { data } = await api.post<FeatureRecommendation>(
      `/admin/feature-costs/${feature}/recommend-from-history/`,
      { days },
    );
    return data;
  },

  async applyRecommendations(
    features: string[],
    days: number,
  ): Promise<ApplyRecommendationsResponse> {
    const { data } = await api.post<ApplyRecommendationsResponse>(
      '/admin/feature-costs/apply-recommendations/',
      { features, days },
    );
    return data;
  },
};

export default adminFeatureCostsService;
