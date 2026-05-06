import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Button, Input, Modal } from '../ui';
import {
  paymentService,
  type PayoutAccount,
  type PaymentMethod,
  type SubmitPaymentResponse,
} from '../../services/paymentService';

// Method ordering + labels + icons for the tab strip.
const METHOD_TABS: { key: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'bkash', label: 'bKash', icon: DevicePhoneMobileIcon },
  { key: 'nagad', label: 'Nagad', icon: DevicePhoneMobileIcon },
  { key: 'rocket', label: 'Rocket', icon: DevicePhoneMobileIcon },
  { key: 'bank', label: 'Bank', icon: BanknotesIcon },
  { key: 'card', label: 'Card', icon: CreditCardIcon },
  { key: 'paypal', label: 'PayPal', icon: GlobeAltIcon },
  { key: 'crypto', label: 'Crypto', icon: GlobeAltIcon },
  { key: 'other', label: 'Other', icon: GlobeAltIcon },
];

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'PKR', 'AED', 'SGD', 'MYR', 'AUD', 'CAD'];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: { id: string; display_name: string };
  billingCycle: 'monthly' | 'yearly';
  amountUsd: number;
  defaultPayerEmail?: string;
  defaultPayerName?: string;
  // Called after a successful submission (status: pending). Parent typically
  // refreshes user/wallet & closes the modal.
  onSubmitted?: (response: SubmitPaymentResponse) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  plan,
  billingCycle,
  amountUsd,
  defaultPayerEmail,
  defaultPayerName,
  onSubmitted,
}: PaymentModalProps) {
  const [methods, setMethods] = useState<PayoutAccount[] | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [trxRef, setTrxRef] = useState('');
  const [payerName, setPayerName] = useState(defaultPayerName ?? '');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerEmail, setPayerEmail] = useState(defaultPayerEmail ?? '');
  const [payerNotes, setPayerNotes] = useState('');
  const [amountLocal, setAmountLocal] = useState<string>('');
  const [currency, setCurrency] = useState('BDT');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitPaymentResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // ── Load payout accounts on open ────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingMethods(true);
    setError(null);
    paymentService
      .getMethods()
      .then(({ methods }) => {
        if (cancelled) return;
        setMethods(methods);
        // Auto-select first available method.
        if (methods.length > 0) {
          setSelectedMethod(methods[0].method);
          setSelectedAccountId(methods[0].id);
          setCurrency(methods[0].currency);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load payment methods. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ── Reset state when closed ─────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSubmitted(null);
      setTrxRef('');
      setPayerNotes('');
      setError(null);
    }
  }, [isOpen]);

  // ── Available accounts for the currently-selected method ──
  const accountsForMethod = useMemo(
    () => (methods || []).filter((a) => a.method === selectedMethod),
    [methods, selectedMethod]
  );

  // Auto-pick the first account when switching method.
  useEffect(() => {
    if (accountsForMethod.length > 0) {
      setSelectedAccountId((prev) =>
        accountsForMethod.find((a) => a.id === prev) ? prev : accountsForMethod[0].id
      );
      setCurrency(accountsForMethod[0].currency);
    } else {
      setSelectedAccountId(null);
    }
  }, [accountsForMethod]);

  const selectedAccount = accountsForMethod.find((a) => a.id === selectedAccountId) || null;

  // Visible methods from server — collapse the tab bar to only what's available.
  const availableMethods = useMemo(() => {
    const set = new Set((methods || []).map((m) => m.method));
    return METHOD_TABS.filter((t) => set.has(t.key));
  }, [methods]);

  // Reference label is contextual per method.
  const refLabel = useMemo(() => {
    switch (selectedMethod) {
      case 'bkash':
      case 'nagad':
      case 'rocket':
        return 'bKash / Nagad TrxID';
      case 'bank':
        return 'Bank reference / SWIFT confirmation';
      case 'card':
        return 'Card last-4 + cardholder name';
      case 'paypal':
        return 'PayPal transaction ID';
      case 'crypto':
        return 'Tx hash';
      default:
        return 'Reference / receipt ID';
    }
  }, [selectedMethod]);

  const refRequired = selectedMethod !== 'card' && selectedMethod !== 'other';

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* ignore — older browsers */
    }
  };

  const handleSubmit = async () => {
    if (!selectedMethod) {
      setError('Pick a payment method first.');
      return;
    }
    if (refRequired && !trxRef.trim()) {
      setError('Please enter your transaction reference.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await paymentService.submit({
        plan: plan.id,
        billing_cycle: billingCycle,
        payment_method: selectedMethod,
        payout_account_id: selectedAccountId,
        amount_local: amountLocal || undefined,
        local_currency: currency,
        transaction_reference: trxRef,
        payer_name: payerName,
        payer_phone: payerPhone,
        payer_email: payerEmail,
        payer_notes: payerNotes,
      });
      setSubmitted(res);
      onSubmitted?.(res);
    } catch (err) {
      const e = err as {
        userMessage?: string;
        response?: { data?: { error?: string; detail?: string } };
        message?: string;
      };
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.userMessage ||
          e?.message ||
          'Could not submit payment. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} size="lg" showCloseButton={!submitting}>
      {submitted ? (
        <SuccessView
          response={submitted}
          plan={plan}
          onClose={() => {
            setSubmitted(null);
            onClose();
          }}
        />
      ) : (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-text-primary">
                Pay for {plan.display_name}
              </h2>
              <p className="text-xs text-text-muted">
                ${amountUsd}/mo · billed {billingCycle}
              </p>
            </div>
          </div>

          {loadingMethods && !methods ? (
            <div className="py-12 text-center text-sm text-text-secondary">
              Loading payment methods…
            </div>
          ) : !methods || methods.length === 0 ? (
            <div className="py-10 text-center">
              <ExclamationTriangleIcon className="w-8 h-8 mx-auto text-amber mb-2" />
              <p className="text-sm text-text-secondary">
                No payment methods configured yet. Please contact support.
              </p>
            </div>
          ) : (
            <>
              {/* Method tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4">
                {availableMethods.map((tab) => {
                  const Icon = tab.icon;
                  const active = selectedMethod === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedMethod(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-bg-elevated text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Payout account info */}
              {selectedAccount && (
                <motion.div
                  key={selectedAccount.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-coral/25 bg-gradient-to-br from-coral/10 via-purple/5 to-transparent p-4 mb-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-coral">
                        Send {currency} to
                      </div>
                      <div className="mt-1 text-base font-bold text-text-primary">
                        {selectedAccount.display_name}
                      </div>
                      {selectedAccount.account_holder_name && (
                        <div className="text-xs text-text-muted">
                          {selectedAccount.account_holder_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedAccount.account_number && (
                    <div className="flex items-center gap-2 rounded-lg bg-bg-card/60 border border-white/[0.06] px-3 py-2 mb-3">
                      <span className="font-mono text-sm text-text-primary flex-1 select-all">
                        {selectedAccount.account_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(selectedAccount.account_number, 'acct')}
                        className="text-xs text-text-secondary hover:text-coral transition-colors flex items-center gap-1"
                      >
                        {copied === 'acct' ? (
                          <>
                            <CheckCircleIcon className="w-4 h-4 text-green" />
                            Copied
                          </>
                        ) : (
                          <>
                            <ClipboardDocumentIcon className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {selectedAccount.instructions && (
                    <div className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                      <InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-text-muted" />
                      <p>{selectedAccount.instructions}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Form */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label={`Amount paid (${currency})`}
                    placeholder={String(amountUsd)}
                    value={amountLocal}
                    onChange={(e) => setAmountLocal(e.target.value)}
                  />
                  <div className="col-span-2">
                    <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-coral focus:outline-none"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Input
                  label={`${refLabel}${refRequired ? ' *' : ''}`}
                  placeholder={
                    selectedMethod === 'card'
                      ? 'e.g. **** 4242 — Md. Swapnil'
                      : 'e.g. 8H7G6F5D4S'
                  }
                  value={trxRef}
                  onChange={(e) => setTrxRef(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Your name"
                    placeholder="Md. Swapnil"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                  />
                  <Input
                    label="Phone (optional)"
                    placeholder="+8801…"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                  />
                </div>

                <Input
                  label="Contact email"
                  type="email"
                  placeholder="you@email.com"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                />

                <div>
                  <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={payerNotes}
                    onChange={(e) => setPayerNotes(e.target.value)}
                    placeholder="Anything our billing team should know?"
                    className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:border-coral focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-3 text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* MVP disclaimer */}
              <div className="mt-4 flex gap-2 text-[11px] text-text-muted leading-relaxed">
                <InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  Payments are verified manually right now — usually within an hour during
                  business hours. We'll email you the moment your plan is active.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  fullWidth
                  onClick={handleSubmit}
                  isLoading={submitting}
                  disabled={!selectedMethod}
                >
                  I've sent the money
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Success view ─────────────────────────────────────────────────────
interface SuccessViewProps {
  response: SubmitPaymentResponse;
  plan: { id: string; display_name: string };
  onClose: () => void;
}
function SuccessView({ response, plan, onClose }: SuccessViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-2"
    >
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-success flex items-center justify-center mb-4">
        <CheckCircleIcon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-text-primary mb-1">
        Payment received — verification queued
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        We've recorded your payment for <strong>{plan.display_name}</strong> and notified our
        billing team. You'll get an email the moment it's approved.
      </p>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-4 text-left text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-text-muted">Request ID</span>
          <span className="text-text-primary font-mono">#{response.payment_request.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Amount</span>
          <span className="text-text-primary font-mono">
            {response.payment_request.amount_local} {response.payment_request.local_currency} ·
            ${response.payment_request.amount_usd}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Method</span>
          <span className="text-text-primary">
            {response.payment_request.payment_method_label}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Reference</span>
          <span className="text-text-primary font-mono">
            {response.payment_request.transaction_reference || '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">When approved you'll receive</span>
          <span className="text-coral font-bold">
            💎 {response.expected_diamonds.toLocaleString()}
          </span>
        </div>
      </div>

      <Button fullWidth onClick={onClose}>
        Got it
      </Button>
    </motion.div>
  );
}

export default PaymentModal;
