import api from './api';

export type PaymentMethod =
  | 'bkash'
  | 'nagad'
  | 'rocket'
  | 'bank'
  | 'card'
  | 'paypal'
  | 'crypto'
  | 'other';

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PayoutAccount {
  id: number;
  method: PaymentMethod;
  method_label: string;
  display_name: string;
  account_number: string;
  account_holder_name: string;
  instructions: string;
  currency: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRequestRecord {
  id: number;
  plan: string;
  billing_cycle: 'monthly' | 'yearly';
  amount_usd: string;
  amount_local: string;
  local_currency: string;
  payment_method: PaymentMethod;
  payment_method_label: string;
  payout_account: PayoutAccount | null;
  transaction_reference: string;
  payer_name: string;
  payer_phone: string;
  payer_email: string;
  payer_notes: string;
  status: PaymentStatus;
  admin_notes: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  diamonds_granted: number;
  plan_applied_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

export interface SubmitPaymentBody {
  plan: string;
  billing_cycle: 'monthly' | 'yearly';
  payment_method: PaymentMethod;
  payout_account_id?: number | null;
  amount_local?: string | number;
  local_currency?: string;
  transaction_reference?: string;
  payer_name?: string;
  payer_phone?: string;
  payer_email?: string;
  payer_notes?: string;
}

export interface SubmitPaymentResponse {
  ok: boolean;
  payment_request: PaymentRequestRecord;
  expected_diamonds: number;
  message: string;
}

export interface AdminPaymentListResponse {
  requests: PaymentRequestRecord[];
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    total: number;
  };
}

export const paymentService = {
  // ── User ─────────────────────────────────────────────────
  async getMethods(): Promise<{ methods: PayoutAccount[] }> {
    const { data } = await api.get<{ methods: PayoutAccount[] }>('/payments/methods/');
    return data;
  },

  async submit(body: SubmitPaymentBody): Promise<SubmitPaymentResponse> {
    const { data } = await api.post<SubmitPaymentResponse>('/payments/submit/', body);
    return data;
  },

  async getMyRequests(): Promise<{ requests: PaymentRequestRecord[] }> {
    const { data } = await api.get<{ requests: PaymentRequestRecord[] }>(
      '/payments/my-requests/'
    );
    return data;
  },

  // ── Admin ────────────────────────────────────────────────
  async adminList(statusFilter?: PaymentStatus): Promise<AdminPaymentListResponse> {
    const { data } = await api.get<AdminPaymentListResponse>('/admin/payments/', {
      params: statusFilter ? { status: statusFilter } : undefined,
    });
    return data;
  },

  async adminApprove(
    id: number,
    adminNotes?: string
  ): Promise<{ ok: boolean; payment_request: PaymentRequestRecord; result: Record<string, unknown> }> {
    const { data } = await api.post(`/admin/payments/${id}/approve/`, {
      admin_notes: adminNotes || '',
    });
    return data;
  },

  async adminReject(
    id: number,
    adminNotes?: string
  ): Promise<{ ok: boolean; payment_request: PaymentRequestRecord }> {
    const { data } = await api.post(`/admin/payments/${id}/reject/`, {
      admin_notes: adminNotes || '',
    });
    return data;
  },

  // ── Admin: payout account management ─────────────────────
  async adminListPayoutAccounts(): Promise<{ accounts: PayoutAccount[] }> {
    const { data } = await api.get<{ accounts: PayoutAccount[] }>('/admin/payout-accounts/');
    return data;
  },

  async adminCreatePayoutAccount(
    body: Partial<PayoutAccount> & { method: PaymentMethod; display_name: string }
  ): Promise<{ account: PayoutAccount }> {
    const { data } = await api.post('/admin/payout-accounts/', body);
    return data;
  },

  async adminUpdatePayoutAccount(
    id: number,
    body: Partial<PayoutAccount>
  ): Promise<{ account: PayoutAccount }> {
    const { data } = await api.put(`/admin/payout-accounts/${id}/`, body);
    return data;
  },

  async adminDeletePayoutAccount(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/admin/payout-accounts/${id}/`);
    return data;
  },
};

export default paymentService;
