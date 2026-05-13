import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Button, LoadingScreen, Modal } from '../components/ui';
import {
  stripeService,
  type PaymentHistoryItem,
  type PaymentHistoryResponse,
} from '../services/stripeService';

interface RefundState {
  open: boolean;
  item: PaymentHistoryItem | null;
  reason: string;
  submitting: boolean;
  error: string | null;
}

function statusBadge(status: string) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
        <CheckCircleIcon className="w-3.5 h-3.5" />
        Approved
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
        <ClockIcon className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-coral">
        <XCircleIcon className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }
  return <span className="text-xs text-text-muted capitalize">{status}</span>;
}

function refundBadge(item: PaymentHistoryItem) {
  const { refund_status } = item;
  if (!refund_status) return null;
  const map: Record<string, { label: string; color: string }> = {
    requested: { label: 'Refund: pending review', color: 'text-amber-400' },
    approved: { label: 'Refund: approved', color: 'text-green-400' },
    rejected: { label: 'Refund: rejected', color: 'text-coral' },
    processing: { label: 'Refund: processing', color: 'text-blue-400' },
    refunded: { label: 'Refunded', color: 'text-green-400' },
    failed: { label: 'Refund failed', color: 'text-coral' },
  };
  const info = map[refund_status];
  if (!info) return null;
  return <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>;
}

function purposeLabel(item: PaymentHistoryItem): string {
  if (item.diamonds_topped_up > 0) return `${item.diamonds_topped_up.toLocaleString()} 💎 top-up`;
  if (item.diamonds_granted > 0) return `${item.diamonds_granted.toLocaleString()} 💎 (plan)`;
  if (item.purpose === 'boost') return `Boost · ${item.description || 'Ad'}`;
  if (item.plan) return `${item.plan} plan · ${item.billing_cycle || ''}`.trim();
  return item.description || item.purpose || 'Payment';
}

export function PaymentHistoryPage() {
  const [data, setData] = useState<PaymentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refund, setRefund] = useState<RefundState>({
    open: false,
    item: null,
    reason: '',
    submitting: false,
    error: null,
  });

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await stripeService.getPaymentHistory(p);
      setData(res);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const openRefundModal = (item: PaymentHistoryItem) => {
    setRefund({ open: true, item, reason: '', submitting: false, error: null });
  };

  const closeRefundModal = () => {
    if (refund.submitting) return;
    setRefund({ open: false, item: null, reason: '', submitting: false, error: null });
  };

  const submitRefund = async () => {
    if (!refund.item || refund.reason.trim().length < 10) return;
    setRefund((s) => ({ ...s, submitting: true, error: null }));
    try {
      await stripeService.requestRefund(refund.item.id, refund.reason.trim());
      setRefund({ open: false, item: null, reason: '', submitting: false, error: null });
      load(page);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setRefund((s) => ({
        ...s,
        submitting: false,
        error: e?.response?.data?.error || e?.message || 'Failed to submit refund request',
      }));
    }
  };

  if (loading && !data) return <LoadingScreen />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">Billing</span>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold font-heading text-text-primary tracking-tight">
          Payment history
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Your past charges. Eligible payments can be refunded within {data?.refund_window_days ?? 90} days.
        </p>
      </motion.header>

      {error && (
        <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No payment history yet.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                    Date
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                    Description
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">
                    Amount
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-text-muted">
                    Status
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-text-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-text-muted whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4 text-text-primary">
                      <div>{purposeLabel(item)}</div>
                      {refundBadge(item)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-text-primary whitespace-nowrap">
                      ${parseFloat(item.amount_usd).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-center">{statusBadge(item.status)}</td>
                    <td className="px-5 py-4 text-center">
                      {item.can_request_refund ? (
                        <Button size="sm" variant="ghost" onClick={() => openRefundModal(item)}>
                          Request refund
                        </Button>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
              <p className="text-xs text-text-muted">
                Page {data.page} of {data.total_pages} · {data.total} total
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeftIcon className="w-4 h-4" />}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= data.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRightIcon className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Refund request modal */}
      <Modal isOpen={refund.open} onClose={closeRefundModal} size="sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
            <ArrowPathIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">Request a refund</h3>
            {refund.item && (
              <p className="text-xs text-text-muted">
                ${parseFloat(refund.item.amount_usd).toFixed(2)} · {purposeLabel(refund.item)}
              </p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Why are you requesting a refund?
          </label>
          <textarea
            rows={4}
            value={refund.reason}
            onChange={(e) => setRefund((s) => ({ ...s, reason: e.target.value }))}
            placeholder="Please describe the issue (min. 10 characters)..."
            className="w-full px-4 py-3 text-sm text-text-primary bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-coral/40 focus:ring-2 focus:ring-coral/15 resize-none"
          />
          <p className="mt-1 text-xs text-text-muted">
            {refund.reason.trim().length}/10 characters minimum
          </p>
        </div>

        {refund.error && (
          <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-xs text-coral mb-4">
            {refund.error}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={closeRefundModal} disabled={refund.submitting}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={submitRefund}
            isLoading={refund.submitting}
            disabled={refund.reason.trim().length < 10}
          >
            Submit request
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-text-muted text-center">
          Refund requests are reviewed by our team within 1–3 business days.
          Approval does not automatically adjust your diamond balance or plan.
        </p>
      </Modal>
    </div>
  );
}

export default PaymentHistoryPage;
