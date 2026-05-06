import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal, Input } from '../../components/ui';
import {
  paymentService,
  type PaymentMethod,
  type PaymentRequestRecord,
  type PaymentStatus,
  type PayoutAccount,
} from '../../services/paymentService';

const STATUS_TABS: { key: PaymentStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    pending: 'bg-amber/15 text-amber border-amber/30',
    approved: 'bg-green/15 text-green border-green/30',
    rejected: 'bg-coral/15 text-coral border-coral/30',
    cancelled: 'bg-text-muted/15 text-text-muted border-text-muted/30',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function AdminPaymentsPage() {
  const [section, setSection] = useState<'requests' | 'accounts'>('requests');

  // ── Payment requests state ──────────────────────────────
  const [tab, setTab] = useState<PaymentStatus | 'all'>('pending');
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    req: PaymentRequestRecord;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // ── Payout accounts state ───────────────────────────────
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PayoutAccount | null>(null);
  const [accountForm, setAccountForm] = useState<Partial<PayoutAccount>>({});
  const [savingAccount, setSavingAccount] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await paymentService.adminList(tab === 'all' ? undefined : tab);
      setRequests(res.requests);
      setCounts(res.counts);
    } finally {
      setLoadingRequests(false);
    }
  }, [tab]);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { accounts } = await paymentService.adminListPayoutAccounts();
      setAccounts(accounts);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'requests') loadRequests();
  }, [section, loadRequests]);

  useEffect(() => {
    if (section === 'accounts') loadAccounts();
  }, [section, loadAccounts]);

  // ── Approve / reject handlers ──────────────────────────
  const submitReview = async () => {
    if (!reviewModal) return;
    setActioning(reviewModal.req.id);
    try {
      if (reviewModal.action === 'approve') {
        await paymentService.adminApprove(reviewModal.req.id, reviewNotes);
      } else {
        await paymentService.adminReject(reviewModal.req.id, reviewNotes);
      }
      setReviewModal(null);
      setReviewNotes('');
      await loadRequests();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'Action failed');
    } finally {
      setActioning(null);
    }
  };

  // ── Account CRUD handlers ──────────────────────────────
  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({
      method: 'bkash',
      currency: 'BDT',
      is_active: true,
      sort_order: accounts.length,
    });
  };

  const openEditAccount = (acct: PayoutAccount) => {
    setEditingAccount(acct);
    setAccountForm({ ...acct });
  };

  const saveAccount = async () => {
    if (!accountForm.method || !accountForm.display_name) {
      alert('Method and display name are required.');
      return;
    }
    setSavingAccount(true);
    try {
      if (editingAccount) {
        await paymentService.adminUpdatePayoutAccount(editingAccount.id, accountForm);
      } else {
        await paymentService.adminCreatePayoutAccount(
          accountForm as Parameters<typeof paymentService.adminCreatePayoutAccount>[0]
        );
      }
      setEditingAccount(null);
      setAccountForm({});
      await loadAccounts();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'Save failed');
    } finally {
      setSavingAccount(false);
    }
  };

  const deleteAccount = async (acct: PayoutAccount) => {
    if (!window.confirm(`Delete payout account "${acct.display_name}"?`)) return;
    try {
      await paymentService.adminDeletePayoutAccount(acct.id);
      await loadAccounts();
    } catch {
      alert('Delete failed');
    }
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
            Admin · Billing
          </span>
          <h1 className="mt-2 text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Payments &amp; payouts
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Verify user payments and manage the bKash, Nagad, bank, and card accounts they pay to.
          </p>
        </div>
      </div>

      {/* Section switcher */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setSection('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            section === 'requests'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Payment requests
        </button>
        <button
          type="button"
          onClick={() => setSection('accounts')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            section === 'accounts'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Payout accounts
        </button>
      </div>

      {section === 'requests' ? (
        <RequestsSection
          tab={tab}
          setTab={setTab}
          counts={counts}
          requests={requests}
          loading={loadingRequests}
          actioning={actioning}
          openReview={(req, action) => {
            setReviewModal({ req, action });
            setReviewNotes('');
          }}
        />
      ) : (
        <AccountsSection
          accounts={accounts}
          loading={loadingAccounts}
          openNew={openNewAccount}
          openEdit={openEditAccount}
          deleteAccount={deleteAccount}
        />
      )}

      {/* Approve / reject confirmation */}
      <Modal
        isOpen={reviewModal !== null}
        onClose={() => {
          if (actioning === null) {
            setReviewModal(null);
            setReviewNotes('');
          }
        }}
        size="md"
        showCloseButton={actioning === null}
      >
        {reviewModal && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  reviewModal.action === 'approve'
                    ? 'bg-green/20 text-green'
                    : 'bg-coral/20 text-coral'
                }`}
              >
                {reviewModal.action === 'approve' ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <XCircleIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  {reviewModal.action === 'approve' ? 'Approve' : 'Reject'} payment #
                  {reviewModal.req.id}
                </h3>
                <p className="text-xs text-text-muted">
                  {reviewModal.req.user?.username} · {reviewModal.req.plan} · $
                  {reviewModal.req.amount_usd}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted">Method</span>
                <span className="text-text-primary">{reviewModal.req.payment_method_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Reference</span>
                <span className="text-text-primary font-mono">
                  {reviewModal.req.transaction_reference || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Amount paid</span>
                <span className="text-text-primary">
                  {reviewModal.req.amount_local} {reviewModal.req.local_currency}
                </span>
              </div>
            </div>

            {reviewModal.action === 'approve' && (
              <div className="text-xs text-text-secondary mb-3 leading-relaxed">
                Approving switches the user to <strong>{reviewModal.req.plan}</strong>, grants
                their plan diamonds, and sends them a confirmation email.
              </div>
            )}

            <label className="block text-xs text-text-secondary mb-1.5 font-medium">
              Notes (sent to the user)
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={
                reviewModal.action === 'approve'
                  ? 'Optional thank-you note…'
                  : 'Why couldn\'t we verify? (e.g. TrxID not found)'
              }
              className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:border-coral focus:outline-none resize-none"
            />

            <div className="flex gap-3 mt-4">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setReviewModal(null);
                  setReviewNotes('');
                }}
                disabled={actioning !== null}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={submitReview}
                isLoading={actioning !== null}
              >
                {reviewModal.action === 'approve' ? 'Approve & switch plan' : 'Reject payment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Account create/edit modal */}
      <Modal
        isOpen={editingAccount !== null || (accountForm.method != null && !editingAccount && Object.keys(accountForm).length > 0)}
        onClose={() => {
          if (!savingAccount) {
            setEditingAccount(null);
            setAccountForm({});
          }
        }}
        size="lg"
        showCloseButton={!savingAccount}
      >
        {(accountForm.method || editingAccount) && (
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-4">
              {editingAccount ? 'Edit' : 'Add'} payout account
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                  Method *
                </label>
                <select
                  value={accountForm.method || 'bkash'}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, method: e.target.value as PaymentMethod })
                  }
                  className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-coral focus:outline-none"
                >
                  {METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Display name *"
                placeholder="e.g. Sellanto bKash (Personal)"
                value={accountForm.display_name || ''}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, display_name: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Account number / phone"
                  placeholder="01XXX-XXXXXX"
                  value={accountForm.account_number || ''}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, account_number: e.target.value })
                  }
                />
                <Input
                  label="Account holder name"
                  placeholder="Sellanto Billing"
                  value={accountForm.account_holder_name || ''}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, account_holder_name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Currency"
                  placeholder="BDT"
                  value={accountForm.currency || ''}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, currency: e.target.value.toUpperCase() })
                  }
                />
                <Input
                  label="Sort order"
                  type="number"
                  value={String(accountForm.sort_order ?? 0)}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, sort_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                  Instructions for the user
                </label>
                <textarea
                  rows={3}
                  value={accountForm.instructions || ''}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, instructions: e.target.value })
                  }
                  placeholder="How should the user send money? Branch info, SWIFT code, etc."
                  className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:border-coral focus:outline-none resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accountForm.is_active ?? true}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-white/20 bg-bg-elevated text-coral focus:ring-coral/50"
                />
                <span className="text-sm text-text-secondary">
                  Visible to users on the payment modal
                </span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setEditingAccount(null);
                  setAccountForm({});
                }}
                disabled={savingAccount}
              >
                Cancel
              </Button>
              <Button fullWidth onClick={saveAccount} isLoading={savingAccount}>
                {editingAccount ? 'Save changes' : 'Add account'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Requests subsection ─────────────────────────────────────────────
interface RequestsSectionProps {
  tab: PaymentStatus | 'all';
  setTab: (t: PaymentStatus | 'all') => void;
  counts: Record<string, number>;
  requests: PaymentRequestRecord[];
  loading: boolean;
  actioning: number | null;
  openReview: (req: PaymentRequestRecord, action: 'approve' | 'reject') => void;
}

function RequestsSection({
  tab,
  setTab,
  counts,
  requests,
  loading,
  actioning,
  openReview,
}: RequestsSectionProps) {
  const visible = useMemo(() => {
    if (tab === 'all') return requests;
    return requests.filter((r) => r.status === tab);
  }, [requests, tab]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 py-4 border-b border-white/[0.06]">
        {STATUS_TABS.map((t) => {
          const count = t.key === 'all'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : counts[t.key] ?? 0;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                active
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-text-secondary">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center">
          <ClockIcon className="w-10 h-10 mx-auto text-text-muted/40 mb-2" />
          <p className="text-sm text-text-secondary">No {tab} payments.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/[0.04]">
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">User</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Method</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Reference</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="font-semibold text-text-primary">
                      {r.user?.username || '—'}
                    </div>
                    <div className="text-[11px] text-text-muted">{r.user?.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-text-primary font-semibold">
                      {r.plan.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-text-muted">{r.billing_cycle}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-mono text-text-primary">${r.amount_usd}</div>
                    <div className="text-[11px] text-text-muted font-mono">
                      {r.amount_local} {r.local_currency}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                    {r.payment_method_label}
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] text-text-secondary max-w-[200px] truncate">
                    {r.transaction_reference || '—'}
                  </td>
                  <td className="px-5 py-3 text-[11px] text-text-muted whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                    {r.status === 'approved' && r.diamonds_granted > 0 && (
                      <div className="text-[10px] text-coral mt-1">
                        💎 +{r.diamonds_granted.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {r.status === 'pending' ? (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openReview(r, 'approve')}
                          disabled={actioning === r.id}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-green/15 text-green border border-green/25 hover:bg-green/25 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openReview(r, 'reject')}
                          disabled={actioning === r.id}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-coral/15 text-coral border border-coral/25 hover:bg-coral/25 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-muted">
                        {r.reviewed_by ? `by ${r.reviewed_by}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ─── Accounts subsection ─────────────────────────────────────────────
interface AccountsSectionProps {
  accounts: PayoutAccount[];
  loading: boolean;
  openNew: () => void;
  openEdit: (a: PayoutAccount) => void;
  deleteAccount: (a: PayoutAccount) => void;
}

function AccountsSection({
  accounts,
  loading,
  openNew,
  openEdit,
  deleteAccount,
}: AccountsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Active payout accounts</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Users see active rows on the payment modal.
          </p>
        </div>
        <Button size="sm" onClick={openNew} leftIcon={<PlusIcon className="w-4 h-4" />}>
          Add account
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-text-secondary">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="py-16 text-center">
          <BanknotesIcon className="w-10 h-10 mx-auto text-text-muted/40 mb-2" />
          <p className="text-sm text-text-secondary">No payout accounts configured yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  a.is_active ? 'bg-coral/15 text-coral' : 'bg-text-muted/15 text-text-muted'
                }`}
              >
                {a.method === 'card' ? (
                  <CreditCardIcon className="w-5 h-5" />
                ) : a.method === 'bank' ? (
                  <BanknotesIcon className="w-5 h-5" />
                ) : (
                  <span className="text-base">💸</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-text-primary">{a.display_name}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
                    {a.method_label}
                  </span>
                  {!a.is_active && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber bg-amber/10 px-1.5 py-0.5 rounded border border-amber/20">
                      hidden
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {a.account_number || '(no number)'}
                  {a.account_holder_name && ` · ${a.account_holder_name}`}
                  {' · '}
                  {a.currency}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
                  title="Edit"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteAccount(a)}
                  className="p-2 rounded-lg text-text-secondary hover:text-coral hover:bg-coral/10 transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default AdminPaymentsPage;
