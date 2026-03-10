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

export const diamondService = {
  // ── User endpoints ──────────────────────────────────────────────
  async getBalance(): Promise<DiamondWallet> {
    const { data } = await api.get<DiamondWallet>('/diamond/balance/');
    return data;
  },

  async getUsage(days = 30): Promise<DiamondUsageBreakdown> {
    const { data } = await api.get<DiamondUsageBreakdown>('/diamond/usage/', { params: { days } });
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
    const { data } = await api.get<DiamondCosts>('/diamond/costs/');
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

  async getDiamondOverview() {
    const { data } = await api.get('/admin/diamond-overview/');
    return data;
  },
};

export default diamondService;
