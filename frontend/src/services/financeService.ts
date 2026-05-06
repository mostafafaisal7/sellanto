import api from './api';

export type ExpenseCategory =
  | 'server'
  | 'domain'
  | 'storage'
  | 'database'
  | 'email'
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'other_api'
  | 'marketing'
  | 'payroll'
  | 'legal'
  | 'other';

export interface ExpenseEntry {
  id: number;
  category: ExpenseCategory;
  category_label: string;
  amount_usd: string;
  description: string;
  incurred_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RevenueEntry {
  id: number;
  user: { id: number; username: string; email: string } | null;
  plan: string;
  billing_cycle: 'monthly' | 'yearly';
  amount_local: string;
  local_currency: string;
  revenue_usd: string;
  fx_rate_used: string;
  payment_method: string;
  payment_method_label: string;
  transaction_reference: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface MonthlyEntry {
  month: string;
  revenue: string;
  expense: string;
  net: string;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  total: string;
  count: number;
}

export interface FinanceSummary {
  window: { from: string; to: string };
  revenue_usd: string;
  expense_usd: string;
  net_profit_usd: string;
  revenue_count: number;
  expense_count: number;
  by_month: MonthlyEntry[];
  expense_by_category: CategoryBreakdown[];
  recent_revenue: RevenueEntry[];
  recent_expenses: ExpenseEntry[];
}

export interface ExpenseListResponse {
  expenses: ExpenseEntry[];
  total_in_filter_usd: string;
  categories: { value: ExpenseCategory; label: string }[];
}

export interface CreateExpenseBody {
  category: ExpenseCategory;
  amount_usd: number | string;
  description?: string;
  incurred_on?: string; // YYYY-MM-DD
}

export const financeService = {
  async getSummary(params?: { from?: string; to?: string; months?: number }): Promise<FinanceSummary> {
    const { data } = await api.get<FinanceSummary>('/admin/finance/summary/', { params });
    return data;
  },

  async getRevenue(limit = 200): Promise<{ revenue: RevenueEntry[] }> {
    const { data } = await api.get<{ revenue: RevenueEntry[] }>('/admin/finance/revenue/', {
      params: { limit },
    });
    return data;
  },

  async getExpenses(params?: {
    category?: ExpenseCategory;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<ExpenseListResponse> {
    const { data } = await api.get<ExpenseListResponse>('/admin/finance/expenses/', { params });
    return data;
  },

  async createExpense(body: CreateExpenseBody): Promise<{ expense: ExpenseEntry }> {
    const { data } = await api.post<{ expense: ExpenseEntry }>(
      '/admin/finance/expenses/',
      body
    );
    return data;
  },

  async updateExpense(
    id: number,
    body: Partial<CreateExpenseBody>
  ): Promise<{ expense: ExpenseEntry }> {
    const { data } = await api.put<{ expense: ExpenseEntry }>(
      `/admin/finance/expenses/${id}/`,
      body
    );
    return data;
  },

  async deleteExpense(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/admin/finance/expenses/${id}/`);
    return data;
  },
};

export default financeService;
