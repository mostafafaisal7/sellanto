import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
  ClockIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../ui';
import { PaymentModal } from './PaymentModal';
import { CardEntryModal } from './CardEntryModal';
import {
  stripeService,
  type SavedCard,
} from '../../services/stripeService';
import type { BillingCycle } from '../../services/subscriptionService';
import { useAuthStore } from '../../store';
import { useDiamondStore } from '../../store/diamondStore';

type Tab = 'stripe' | 'manual';

interface BillingChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: { id: string; display_name: string };
  billingCycle: BillingCycle;
  amountUsd: number;
  defaultPayerEmail?: string;
  defaultPayerName?: string;
}

export function BillingChoiceModal({
  isOpen,
  onClose,
  plan,
  billingCycle,
  amountUsd,
  defaultPayerEmail,
  defaultPayerName,
}: BillingChoiceModalProps) {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const fetchWallet = useDiamondStore((s) => s.fetchWallet);
  const [tab, setTab] = useState<Tab>('stripe');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultCard, setDefaultCard] = useState<SavedCard | null>(null);
  const [hasCardChecked, setHasCardChecked] = useState(false);
  const [showCardEntry, setShowCardEntry] = useState(false);

  // Probe for a saved card so we can show "Charge to Visa ****4242" if available.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await stripeService.hasCardOnFile();
        if (cancelled) return;
        setDefaultCard(res.default);
      } catch {
        // not fatal — fall back to first-time flow
      } finally {
        if (!cancelled) setHasCardChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubscribeWithSavedCard = async () => {
    if (!plan.id || plan.id === 'free') return;
    setBusy(true);
    setError(null);
    try {
      // For subscriptions, even with a saved card we still create a
      // Stripe Subscription (so renewals are automatic). Stripe will
      // use the customer's default PaymentMethod when the initial
      // invoice is paid. We just need to confirm it client-side.
      setShowCardEntry(true);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || 'Could not start subscription');
    } finally {
      setBusy(false);
    }
  };

  // Manual tab renders the existing PaymentModal directly
  if (tab === 'manual') {
    return (
      <PaymentModal
        isOpen={isOpen}
        onClose={() => {
          setTab('stripe');
          onClose();
        }}
        plan={plan}
        billingCycle={billingCycle}
        amountUsd={amountUsd}
        defaultPayerEmail={defaultPayerEmail}
        defaultPayerName={defaultPayerName}
      />
    );
  }

  // If user clicked the primary subscribe button → open the embedded
  // PaymentElement flow that creates the Stripe Subscription.
  if (showCardEntry) {
    return (
      <CardEntryModal
        isOpen={showCardEntry}
        onClose={() => {
          setShowCardEntry(false);
          onClose();
        }}
        charge={{
          kind: 'subscription',
          plan: plan.id as 'pro' | 'business',
          billing_cycle: billingCycle,
          usd: amountUsd,
        }}
        onSuccess={async () => {
          try {
            await Promise.all([fetchUser(), fetchWallet()]);
          } catch {
            // best-effort
          }
        }}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      size="md"
      showCloseButton={!busy}
    >
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
            <CreditCardIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              Upgrade to {plan.display_name}
            </h3>
            <p className="text-xs text-text-muted">
              ${amountUsd}/mo · {billingCycle === 'yearly' ? 'Billed yearly' : 'Billed monthly'}
            </p>
          </div>
        </div>

        {/* Tab strip */}
        <div className="inline-flex w-full p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-5">
          <button
            onClick={() => setTab('stripe')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              tab === 'stripe'
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <CreditCardIcon className="w-4 h-4" />
            Pay by card
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              (tab as Tab) === 'manual'
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <DevicePhoneMobileIcon className="w-4 h-4" />
            bKash / Bank
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="stripe"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {hasCardChecked && defaultCard && (
              <div className="rounded-2xl border border-coral/25 bg-coral/[0.04] p-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-coral/15 flex items-center justify-center">
                  <BoltIcon className="w-5 h-5 text-coral" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary capitalize">
                    {defaultCard.brand} ····{defaultCard.last4}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Saved card — used for renewals
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 text-sm text-text-secondary mb-5">
              <div className="flex items-start gap-2.5">
                <ShieldCheckIcon className="w-4 h-4 text-green mt-0.5 flex-shrink-0" />
                <span>
                  Powered by <strong className="text-text-primary">Stripe</strong>. Your card
                  details never touch our servers — Stripe handles PCI compliance and 3-D Secure.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ClockIcon className="w-4 h-4 text-coral mt-0.5 flex-shrink-0" />
                <span>
                  Plan activates instantly. Auto-renews each cycle — cancel anytime.
                </span>
              </div>
            </div>

            {error && (
              <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={handleSubscribeWithSavedCard}
                isLoading={busy}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                {defaultCard ? `Subscribe with ${defaultCard.brand}` : `Pay $${amountUsd} & subscribe`}
              </Button>
            </div>

            <p className="mt-4 text-center text-[11px] text-text-muted">
              Need bKash, Nagad, or bank transfer? Use the tab above.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}
