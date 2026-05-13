import api from './api';
import type { BillingCycle, PlanId } from './subscriptionService';

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

// ---- Card-on-file types --------------------------------------------------

export interface SavedCard {
  id: string;             // stripe pm_xxx
  brand: string;          // 'visa', 'mastercard', ...
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  funding: 'credit' | 'debit' | 'prepaid' | 'unknown' | '';
  is_default: boolean;
  created_at: string;
}

export interface HasCardResponse {
  has_card: boolean;
  default: SavedCard | null;
}

export interface ChargeIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  publishable_key: string;
  status: string | null;
  amount_cents: number;
}

export interface OffSessionChargeResponse {
  succeeded: boolean;
  payment_intent_id: string;
  status: string;
  needs_3ds: boolean;
  fallback_checkout_url: string | null;
  error: string | null;
  amount_cents: number;
}

export interface SubscribeResponse {
  subscription_id: string;
  client_secret: string;
  publishable_key: string;
}

// Body for /charge/ and /charge-saved/. Four shapes:
//   { sku }                                          → locked-catalog topup
//   { purpose: 'topup', amount_usd, metadata? }      → flexible topup (computes diamonds)
//   { purpose: 'boost', amount_usd, metadata? }      → ad-boost
//   { purpose: 'misc',  amount_usd, metadata? }      → generic
export type ChargeRequest =
  | { sku: string; metadata?: Record<string, string | number> }
  | {
      purpose: 'topup' | 'boost' | 'misc';
      amount_usd: number;
      metadata?: Record<string, string | number>;
    };

// ---- Flexible topup, history, refunds, boost types --------------------

export interface DiamondRateResponse {
  diamonds_per_dollar: number;
  min_usd: number;
  max_usd: number;
}

export type RefundStatus =
  | ''
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'refunded'
  | 'failed';

export interface PaymentHistoryItem {
  id: number;
  created_at: string;
  description: string;
  purpose: string;
  plan: string;
  billing_cycle: string;
  amount_usd: string;
  revenue_usd: string;
  status: string;
  payment_provider: string;
  payment_method: string;
  diamonds_granted: number;
  diamonds_topped_up: number;
  refund_status: RefundStatus;
  refund_amount_usd: string;
  refund_reason: string;
  refund_admin_notes: string;
  refund_requested_at: string | null;
  refund_processed_at: string | null;
  can_request_refund: boolean;
}

export interface PaymentHistoryResponse {
  items: PaymentHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  refund_window_days: number;
}

export interface RefundRequestResponse {
  ok: boolean;
  refund_status?: RefundStatus;
  refund_amount_usd?: string;
  error?: string;
}

export interface BoostReserveResponse {
  status:
    | 'reserved'
    | 'already_reserved'
    | 'insufficient_funds'
    | 'invalid';
  diamonds_deducted?: number;
  wallet_balance?: number;
  needed_usd?: number;
  needed_diamonds?: number;
  shortfall_usd?: number;
  shortfall_diamonds?: number;
  wallet_balance_usd?: number;
  reservation_id?: string;
  error?: string;
}

export interface BoostReleaseResponse {
  status: 'released' | 'already_released' | 'no_reservation' | 'invalid';
  diamonds_credited?: number;
  wallet_balance?: number;
  error?: string;
}

export type SessionStatus =
  | { status: 'pending' }
  | {
      status: 'completed';
      purpose: 'plan' | 'topup';
      plan: string;
      diamonds: number;
      amount_usd: string;
    };

export interface TopupCatalogItem {
  sku: string;
  diamonds: number;
  usd: number;
}

export interface CancelSubscriptionResponse {
  ok: boolean;
  status?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
  error?: string;
}

export const stripeService = {
  /**
   * Create a Stripe Checkout Session for a recurring plan subscription.
   * On success the caller should `window.location.assign(url)` to redirect
   * the user to Stripe's hosted checkout page.
   */
  async createPlanCheckout(
    plan: PlanId,
    billing_cycle: BillingCycle,
  ): Promise<CheckoutSessionResponse> {
    const { data } = await api.post<CheckoutSessionResponse>(
      '/billing/stripe/checkout/',
      { plan, billing_cycle },
    );
    return data;
  },

  /**
   * Create a Stripe Checkout Session for a one-time diamond top-up.
   */
  async createTopupCheckout(sku: string): Promise<CheckoutSessionResponse> {
    const { data } = await api.post<CheckoutSessionResponse>(
      '/billing/stripe/topup/',
      { sku },
    );
    return data;
  },

  /**
   * Cancel the current subscription. Default: cancel at period end so the
   * user keeps their entitlements until the cycle wraps. Pass `immediate`
   * for an instant termination.
   */
  async cancelSubscription(immediate = false): Promise<CancelSubscriptionResponse> {
    const { data } = await api.post<CancelSubscriptionResponse>(
      '/billing/stripe/cancel/',
      { immediate },
    );
    return data;
  },

  /**
   * Polled by the success page to confirm the webhook has landed and the
   * plan / diamonds have been applied. Returns `{status: 'pending'}` while
   * waiting for the webhook to arrive (usually < 2 seconds).
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const { data } = await api.get<SessionStatus>(
      `/billing/stripe/session/${encodeURIComponent(sessionId)}/`,
    );
    return data;
  },

  /**
   * Static catalog of diamond top-up SKUs for the BuyDiamonds page.
   */
  async getTopupCatalog(): Promise<TopupCatalogItem[]> {
    const { data } = await api.get<{ items: TopupCatalogItem[] }>(
      '/billing/stripe/topup-catalog/',
    );
    return data.items;
  },

  // ---- Card-on-file API ----------------------------------------------------

  /**
   * Does the user have a saved card? Used to decide between CardEntryModal
   * (embedded PaymentElement) and QuickPayModal (one-click confirm).
   */
  async hasCardOnFile(): Promise<HasCardResponse> {
    const { data } = await api.get<HasCardResponse>('/billing/stripe/has-card/');
    return data;
  },

  /**
   * Create a PaymentIntent for the embedded card-entry flow. Returns a
   * client_secret that the frontend passes to <PaymentElement /> via
   * stripe.confirmPayment(). The card is automatically saved for future
   * off-session charges (setup_future_usage='off_session').
   */
  async createChargeIntent(body: ChargeRequest): Promise<ChargeIntentResponse> {
    const { data } = await api.post<ChargeIntentResponse>(
      '/billing/stripe/charge/',
      body,
    );
    return data;
  },

  /**
   * One-click charge using the user's saved default card. No UI required
   * unless `needs_3ds=true` — in which case redirect to `fallback_checkout_url`.
   */
  async chargeSavedCard(body: ChargeRequest): Promise<OffSessionChargeResponse> {
    const { data } = await api.post<OffSessionChargeResponse>(
      '/billing/stripe/charge-saved/',
      body,
    );
    return data;
  },

  /**
   * Embedded plan-subscription flow. Returns client_secret for the
   * initial invoice's PaymentIntent. Frontend confirms via PaymentElement.
   */
  async createSubscription(
    plan: PlanId,
    billing_cycle: BillingCycle,
  ): Promise<SubscribeResponse> {
    const { data } = await api.post<SubscribeResponse>(
      '/billing/stripe/subscribe/',
      { plan, billing_cycle },
    );
    return data;
  },

  /**
   * List saved cards on the Stripe customer.
   */
  async listPaymentMethods(): Promise<SavedCard[]> {
    const { data } = await api.get<{ items: SavedCard[] }>(
      '/billing/stripe/payment-methods/',
    );
    return data.items;
  },

  /**
   * Mark a payment method as the user's default for renewals & off-session.
   */
  async setDefaultPaymentMethod(pmId: string): Promise<SavedCard> {
    const { data } = await api.post<{ item: SavedCard }>(
      `/billing/stripe/payment-methods/${encodeURIComponent(pmId)}/`,
    );
    return data.item;
  },

  /**
   * Detach a payment method from the customer.
   */
  async removePaymentMethod(pmId: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(
      `/billing/stripe/payment-methods/${encodeURIComponent(pmId)}/`,
    );
    return data;
  },

  // ---- Flexible top-up rate ------------------------------------------------

  /** Admin-configured rate + bounds for the BuyDiamonds page preview. */
  async getDiamondRate(): Promise<DiamondRateResponse> {
    const { data } = await api.get<DiamondRateResponse>(
      '/billing/stripe/diamond-rate/',
    );
    return data;
  },

  // ---- Payment history + refunds ------------------------------------------

  async getPaymentHistory(page = 1): Promise<PaymentHistoryResponse> {
    const { data } = await api.get<PaymentHistoryResponse>(
      `/billing/payments/?page=${page}`,
    );
    return data;
  },

  async requestRefund(
    paymentRequestId: number,
    reason: string,
  ): Promise<RefundRequestResponse> {
    const { data } = await api.post<RefundRequestResponse>(
      '/billing/refunds/request/',
      { payment_request_id: paymentRequestId, reason },
    );
    return data;
  },

  // ---- Ad-boost wallet reservation ----------------------------------------

  async reserveBoostBudget(body: {
    amount_usd: number;
    reservation_id: string;
    metadata?: Record<string, string | number>;
  }): Promise<BoostReserveResponse> {
    const { data } = await api.post<BoostReserveResponse>(
      '/billing/boost/reserve/',
      body,
    );
    return data;
  },

  async releaseBoostReservation(
    reservationId: string,
    reason = '',
  ): Promise<BoostReleaseResponse> {
    const { data } = await api.post<BoostReleaseResponse>(
      '/billing/boost/release/',
      { reservation_id: reservationId, reason },
    );
    return data;
  },
};

export default stripeService;
