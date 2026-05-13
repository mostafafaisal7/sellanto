import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../../components/ui';
import api from '../../services/api';

interface RefundItem {
  id: number;
  created_at: string;
  user_email: string;
  user_id: number;
  amount_usd: string;
  purpose: string;
  description: string;
  status: string;
  refund_status: string;
  refund_reason: string;
  refund_admin_notes: string;
  refund_requested_at: string | null;
  refund_reviewed_at: string | null;
  refund_reviewed_by_email: string | null;
  refund_amount_usd: string;
}

interface RefundsResponse {
  items: RefundItem[];
  total: number;
  page: number;
  total_pages: number;
}

interface ActionState {
  open: boolean;
  action: 'approve' | 'reject' | null;
  item: RefundItem | null;
  notes: string;
  submitting: boolean;
  error: string | null;
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'processing', label: 'Processing' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
];

function refundStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; Icon: typeof ClockIcon }> = {
    requested: { label: 'Requested', cls: 'text-amber-400 bg-amber-400/10', Icon: ClockIcon },
    approved: { label: 'Approved', cls: 'text-green-400 bg-green-400/10', Icon: CheckCircleIcon },
    processing: { label: 'Processing', cls: 'text-blue-400 bg-blue-400/10', Icon: ArrowPathIcon },
    refunded: { label: 'Refunded', cls: 'text-green-400 bg-green-400/10', Icon: CheckCircleIcon },
    rejected: { label: 'Rejected', cls: 'text-coral bg-coral/10', Icon: XCircleIcon },
    failed: { label: 'Failed', cls: 'text-coral bg-coral/10', Icon: XCircleIcon },
  };
  const info = map[status];
  if (!info) return <span className="text-xs text-text-muted capitalize">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
      <info.Icon className="w-3 h-3" />
      {info.label}
    </span>
  );
}

export function AdminRefundsPage() {
  const [data, setData] = useState<RefundsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('requested');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<ActionState>({
    open: false,
    action: null,
    item: null,
    notes: '',
    submitting: false,
    error: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      const { data: res } = await api.get<RefundsResponse>(`/admin/refunds/?${params}`);
      setData(res);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openAction = (item: RefundItem, act: 'approve' | 'reject') => {
    setAction({ open: true, action: act, item, notes: '', submitting: false, error: null });
  };

  const closeAction = () => {
    if (action.submitting) return;
    setAction({ open: false, action: null, item: null, notes: '', submitting: false, error: null });
  };

  const submitAction = async () => {
    if (!action.item || !action.action) return;
    if (action.action === 'reject' && action.notes.trim().length < 5) return;
    setAction((s) => ({ ...s, submitting: true, error: null }));
    try {
      await api.post(`/admin/refunds/${action.item.id}/${action.action}/`, {
        admin_notes: action.notes.trim(),
      });
      closeAction();
      load();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
      setAction((s) => ({
        ...s,
        submitting: false,
        error:
          e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.message ||
          'Action failed',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Refund Requests</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Review and action user-initiated refund requests. Approving issues a Stripe refund.
          Diamonds or plan are <strong className="text-white">not</strong> auto-adjusted — do that manually if needed.
        </p>
      </motion.header>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <FunnelIcon className="w-4 h-4 text-slate-400" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === f.value
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <ArrowPathIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No refund requests match this filter.</p>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Date', 'User', 'Amount', 'Purpose', 'Reason', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap text-xs">
                      {new Date(item.refund_requested_at || item.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4 text-white text-xs whitespace-nowrap">
                      {item.user_email}
                    </td>
                    <td className="px-5 py-4 text-white font-mono whitespace-nowrap">
                      ${parseFloat(item.refund_amount_usd || item.amount_usd).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-slate-300 text-xs capitalize">
                      {item.purpose || item.description || '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs max-w-[200px]">
                      <p className="truncate" title={item.refund_reason}>
                        {item.refund_reason || '—'}
                      </p>
                      {item.refund_admin_notes && (
                        <p className="mt-0.5 text-slate-500 truncate" title={item.refund_admin_notes}>
                          Admin: {item.refund_admin_notes}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">{refundStatusBadge(item.refund_status)}</td>
                    <td className="px-5 py-4">
                      {item.refund_status === 'requested' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => openAction(item, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openAction(item, 'reject')}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total_pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
              <p className="text-xs text-slate-500">
                Page {data.page} of {data.total_pages} · {data.total} total
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← Prev
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>
                  Next →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approve / Reject modal */}
      <Modal isOpen={action.open} onClose={closeAction} size="sm">
        {action.action && action.item && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                action.action === 'approve' ? 'bg-green-500/15' : 'bg-red-500/15'
              }`}>
                {action.action === 'approve'
                  ? <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  : <XCircleIcon className="w-5 h-5 text-red-400" />
                }
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary capitalize">
                  {action.action} refund
                </h3>
                <p className="text-xs text-text-muted">
                  ${parseFloat(action.item.refund_amount_usd || action.item.amount_usd).toFixed(2)} · {action.item.user_email}
                </p>
              </div>
            </div>

            {action.action === 'approve' && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-xs text-green-400 mb-4">
                This will immediately issue a Stripe refund for the full amount.
                Diamonds and plan status are <strong>not</strong> automatically adjusted.
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Admin notes {action.action === 'reject' ? '(required)' : '(optional)'}
              </label>
              <textarea
                rows={3}
                value={action.notes}
                onChange={(e) => setAction((s) => ({ ...s, notes: e.target.value }))}
                placeholder={
                  action.action === 'reject'
                    ? 'Explain why the refund was rejected (sent to user)…'
                    : 'Optional internal notes…'
                }
                className="w-full px-4 py-3 text-sm text-text-primary bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-coral/40 resize-none"
              />
            </div>

            {action.error && (
              <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-xs text-coral mb-4">
                {action.error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={closeAction} disabled={action.submitting}>
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={submitAction}
                isLoading={action.submitting}
                disabled={action.action === 'reject' && action.notes.trim().length < 5}
              >
                {action.action === 'approve' ? 'Issue refund' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminRefundsPage;
