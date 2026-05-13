import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCardIcon,
  PlusIcon,
  TrashIcon,
  CheckBadgeIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Button, LoadingScreen } from '../components/ui';
import { stripeService, type SavedCard } from '../services/stripeService';
import { CardEntryModal } from '../components/billing/CardEntryModal';

interface PageState {
  loading: boolean;
  error: string | null;
  cards: SavedCard[];
}

export function PaymentMethodsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    cards: [],
  });
  const [addingCard, setAddingCard] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const cards = await stripeService.listPaymentMethods();
      setState({ loading: false, error: null, cards });
    } catch (err) {
      const e = err as { message?: string };
      setState({ loading: false, error: e?.message || 'Failed to load cards', cards: [] });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSetDefault = async (pmId: string) => {
    setBusyId(pmId);
    try {
      await stripeService.setDefaultPaymentMethod(pmId);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (pmId: string) => {
    if (!window.confirm('Remove this card? You can add it again later.')) return;
    setBusyId(pmId);
    try {
      await stripeService.removePaymentMethod(pmId);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (state.loading) return <LoadingScreen />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
            Billing
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Payment methods
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cards on file are used for diamond top-ups, ad boosts, and plan renewals.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
          onClick={() => navigate('/settings')}
        >
          Settings
        </Button>
      </header>

      {state.error && (
        <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-sm text-coral">
          {state.error}
        </div>
      )}

      {/* Cards list */}
      <section className="space-y-3">
        {state.cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center">
            <CreditCardIcon className="w-10 h-10 mx-auto text-text-muted mb-3" />
            <p className="text-sm text-text-secondary mb-4">
              No card on file yet. Add one to enable 1-click checkout.
            </p>
            <Button
              leftIcon={<PlusIcon className="w-4 h-4" />}
              onClick={() => setAddingCard(true)}
            >
              Add a card
            </Button>
          </div>
        )}

        {state.cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-2xl border p-5 flex items-center gap-4 ${
              card.is_default
                ? 'border-coral/30 bg-coral/[0.04]'
                : 'border-white/[0.08] bg-bg-card'
            }`}
          >
            <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <CreditCardIcon className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text-primary capitalize">
                  {card.brand} · · · · {card.last4}
                </p>
                {card.is_default && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-coral bg-coral/15 border border-coral/20 px-1.5 py-0.5 rounded-full">
                    <CheckBadgeIcon className="w-3 h-3" />
                    Default
                  </span>
                )}
                {card.funding && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {card.funding}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Expires {String(card.exp_month ?? '').padStart(2, '0')}/{card.exp_year ?? '—'}
              </p>
            </div>
            <div className="flex gap-2">
              {!card.is_default && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSetDefault(card.id)}
                  isLoading={busyId === card.id}
                >
                  Set default
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(card.id)}
                isLoading={busyId === card.id}
                leftIcon={<TrashIcon className="w-4 h-4" />}
              >
                Remove
              </Button>
            </div>
          </motion.div>
        ))}

        {state.cards.length > 0 && (
          <div className="pt-3">
            <Button
              leftIcon={<PlusIcon className="w-4 h-4" />}
              variant="secondary"
              onClick={() => setAddingCard(true)}
            >
              Add another card
            </Button>
          </div>
        )}
      </section>

      {/* Trust block */}
      <div className="rounded-2xl border border-white/[0.06] bg-bg-card/70 p-5 flex items-start gap-3">
        <ShieldCheckIcon className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary">
          Card details are stored by <strong className="text-text-primary">Stripe</strong> —
          we only keep the last 4 digits + expiry for display. Remove a card any time.
        </div>
      </div>

      {/*
        "Add a card" reuses CardEntryModal with a tiny ($0.50 minimum)
        verification charge that simultaneously verifies the card and
        saves it for future use. Pragmatic approach: charge $0.50 and
        give 50 diamonds — user gets value, we satisfy Stripe minimum.
      */}
      {addingCard && (
        <CardEntryModal
          isOpen={addingCard}
          onClose={() => {
            setAddingCard(false);
            load();
          }}
          charge={{
            kind: 'misc',
            amount_usd: 0.5,
            label: 'Verify & save card',
            metadata: { reason: 'card_setup' },
          }}
          onSuccess={() => load()}
        />
      )}
    </div>
  );
}

export default PaymentMethodsPage;
