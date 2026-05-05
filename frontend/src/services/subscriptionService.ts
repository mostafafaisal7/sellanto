import api from './api';

export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanLimits {
  posts: number;
  captions: number;
  videos: number;
  images: number;
  messenger: number;
  accounts: number;
}

export interface PlanUsage {
  posts: number;
  captions: number;
  videos: number;
  images: number;
  messenger: number;
}

export interface PlanCatalogEntry {
  id: PlanId;
  display_name: string;
  tagline: string;
  price_monthly_usd: number;
  price_yearly_usd: number;
  limits: PlanLimits;
  features: string[];
  highlight: boolean;
  cta: string;
}

export interface SubscriptionStatus {
  plan_id: PlanId;
  plan_display_name: string;
  plan_start_date: string | null;
  plan_end_date: string | null;
  plan_duration_months: number;
  is_plan_active: boolean;
  days_remaining: number | null;
  limits: PlanLimits;
  usage: PlanUsage;
}

export interface UpgradeResponse {
  ok: boolean;
  previous_plan: PlanId;
  billing_cycle: BillingCycle;
  subscription: SubscriptionStatus;
  message: string;
}

export const subscriptionService = {
  async getStatus(): Promise<SubscriptionStatus> {
    const { data } = await api.get<SubscriptionStatus>('/subscription/');
    return data;
  },

  async getPlans(): Promise<PlanCatalogEntry[]> {
    const { data } = await api.get<{ plans: PlanCatalogEntry[] }>(
      '/subscription/plans/'
    );
    return data.plans;
  },

  async upgrade(plan: PlanId, billing_cycle: BillingCycle): Promise<UpgradeResponse> {
    const { data } = await api.post<UpgradeResponse>('/subscription/upgrade/', {
      plan,
      billing_cycle,
    });
    return data;
  },
};

export default subscriptionService;
