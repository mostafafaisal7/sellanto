import api from './api';
import type {
  DiamondWallet,
  DiamondTransaction,
  DiamondUsageBreakdown,
  DiamondCostPreview,
  DiamondCosts,
  GlobalAPIKeysStatus,
} from '../types';

interface PaginatedTransactions {
  count: number;
  next: string | null;
  previous: string | null;
  results: DiamondTransaction[];
}

export type TimeseriesPeriod = 'daily' | 'weekly' | 'monthly';

export interface DiamondUsagePoint {
  date: string;
  diamonds_spent: number;
  transaction_count: number;
}

export interface DiamondUsageTimeseries {
  period: TimeseriesPeriod;
  from: string;
  to: string;
  series: DiamondUsagePoint[];
  total_spent: number;
  total_transactions: number;
}

export interface PlanHistoryEntry {
  id: number;
  plan: string;
  amount: number;
  balance_after: number;
  note: string;
  created_at: string;
}

export interface DiamondForecast {
  balance: number;
  lookback_days: number;
  /**
   * Window the forecast actually used. May differ from `lookback_days`
   * when the requested window had zero usage and the backend auto-expanded
   * (up to 90d) or fell back to lifetime average.
   */
  effective_lookback_days?: number;
  spent_in_window: number;
  avg_daily_spend: number;
  days_remaining: number | null;
  depletion_date: string | null;
  /** '' | 'expanded_window' | 'lifetime_average' */
  fallback_used?: string;
}

export const diamondService = {
  // ── User endpoints ──────────────────────────────────────────────
  async getBalance(): Promise<DiamondWallet> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await api.get<DiamondWallet>('/diamond/balance/', { _silentError: true } as any);
    return data;
  },

  async getUsage(days = 30): Promise<DiamondUsageBreakdown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await api.get<DiamondUsageBreakdown>('/diamond/usage/', { params: { days }, _silentError: true } as any);
    return data;
  },

  async getTransactions(params?: {
    page?: number;
    page_size?: number;
    type?: string;
    feature?: string;
  }): Promise<PaginatedTransactions> {
    const { data } = await api.get<PaginatedTransactions>('/diamond/transactions/', { params });
    return data;
  },

  async getCostPreview(feature: string, opts?: {
    quality?: string;
    duration?: number;
    characters?: number;
  }): Promise<DiamondCostPreview> {
    const { data } = await api.get<DiamondCostPreview>('/diamond/cost-preview/', {
      params: { feature, ...opts },
    });
    return data;
  },

  async getCosts(): Promise<DiamondCosts> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await api.get<DiamondCosts>('/diamond/costs/', { _silentError: true } as any);
    return data;
  },

  async getUsageTimeseries(params: {
    period: TimeseriesPeriod;
    days?: number;
    from?: string;
    to?: string;
  }): Promise<DiamondUsageTimeseries> {
    const { data } = await api.get<DiamondUsageTimeseries>(
      '/diamond/usage-timeseries/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params, _silentError: true } as any
    );
    return data;
  },

  async getPlanHistory(): Promise<{ history: PlanHistoryEntry[] }> {
    const { data } = await api.get<{ history: PlanHistoryEntry[] }>(
      '/diamond/plan-history/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { _silentError: true } as any
    );
    return data;
  },

  async getForecast(lookback = 14): Promise<DiamondForecast> {
    const { data } = await api.get<DiamondForecast>(
      '/diamond/forecast/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { lookback }, _silentError: true } as any
    );
    return data;
  },

  // ── Admin endpoints ─────────────────────────────────────────────
  async rechargeUser(userId: number, amount: number, note?: string) {
    const { data } = await api.post(`/admin/users/${userId}/recharge/`, { amount, note });
    return data;
  },

  async getGlobalAPIKeys(): Promise<GlobalAPIKeysStatus> {
    const { data } = await api.get<GlobalAPIKeysStatus>('/admin/global-api-keys/');
    return data;
  },

  async updateGlobalAPIKeys(keys: {
    openai_api_key?: string;
    gemini_api_key?: string;
    claude_api_key?: string;
  }) {
    const { data } = await api.put('/admin/global-api-keys/', keys);
    return data;
  },

  async testAPIKey(provider: string, apiKey?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const payload: Record<string, string> = { provider };
    if (apiKey) payload.api_key = apiKey;
    const { data } = await api.post('/admin/test-api-key/', payload);
    return data;
  },

  async getDiamondOverview() {
    const { data } = await api.get('/admin/diamond-overview/');
    return data;
  },
};

export default diamondService;
