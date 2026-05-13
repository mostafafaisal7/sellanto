import { useEffect, useMemo, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import {
  CreditCardIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../ui';
import { stripeService, type ChargeRequest } from '../../services/stripeService';
import { useAuthStore } from '../../store';
import { useDiamondStore } from '../../store/diamondStore';

interface CardEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  // What we're charging for + how much.
  charge:
    | { kind: 'topup'; sku: string; diamonds: number; usd: number }
    | { kind: 'topup-flex'; amount_usd: number; diamonds: number }
    | {
        kind: 'boost';
        amount_usd: number;
        label: string;
        metadata?: Record<string, string | number>;
      }
    | { kind: 'misc'; amount_usd: number; label: string; metadata?: Record<string, string | number> }
    | { kind: 'subscription'; plan: 'pro' | 'business'; billing_cycle: 'monthly' | 'yearly'; usd: number };
  onSuccess?: () => void;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; clientSecret: string; stripe: Stripe }
  | { kind: 'error'; message: string };

// Cache the stripe.js singleton across mounts.
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

function chargeTitle(charge: CardEntryModalProps['charge']): string {
  if (charge.kind === 'topup') return `${charge.diamonds.toLocaleString()} Diamonds`;
  if (charge.kind === 'topup-flex') return `${charge.diamonds.toLocaleString()} Diamonds`;
  if (charge.kind === 'subscription')
    return `${charge.plan === 'pro' ? 'Pro' : 'Business'} plan · ${charge.billing_cycle}`;
  return charge.label;
}

function chargeAmount(charge: CardEntryModalProps['charge']): number {
  if (charge.kind === 'topup') return charge.usd;
  if (charge.kind === 'topup-flex') return charge.amount_usd;
  if (charge.kind === 'subscription') return charge.usd;
  return charge.amount_usd;
}

export function CardEntryModal(props: CardEntryModalProps) {
  const { isOpen, onClose, charge } = props;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const init = async () => {
      try {
        let clientSecret: string;
        let publishableKey: string;

        if (charge.kind === 'subscription') {
          const res = await stripeService.createSubscription(
            charge.plan,
            charge.billing_cycle,
          );
          clientSecret = res.client_secret;
          publishableKey = res.publishable_key;
        } else {
          let body: ChargeRequest;
          if (charge.kind === 'topup') {
            body = { sku: charge.sku };
          } else if (charge.kind === 'topup-flex') {
            body = { purpose: 'topup', amount_usd: charge.amount_usd };
          } else if (charge.kind === 'boost') {
            body = {
              purpose: 'boost',
              amount_usd: charge.amount_usd,
              metadata: { boost_label: charge.label, ...(charge.metadata || {}) },
            };
          } else {
            // misc
            body = {
              purpose: 'misc',
              amount_usd: charge.amount_usd,
              metadata: { label: charge.label, ...(charge.metadata || {}) },
            };
          }
          const res = await stripeService.createChargeIntent(body);
          clientSecret = res.client_secret;
          publishableKey = res.publishable_key;
        }

        const stripe = await getStripe(publishableKey);
        if (cancelled) return;
        if (!stripe) {
          setState({ kind: 'error', message: 'Could not load Stripe.js' });
          return;
        }
        setState({ kind: 'ready', clientSecret, stripe });
      } catch (err) {
        if (cancelled) return;
        const e = err as {
          response?: { data?: { error?: string; detail?: string } };
          message?: string;
        };
        setState({
          kind: 'error',
          message:
            e?.response?.data?.error ||
            e?.response?.data?.detail ||
            e?.message ||
            'Failed to start checkout',
        });
      }
    };
    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, JSON.stringify(charge)]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
            <CreditCardIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              Pay ${chargeAmount(charge)}
            </h3>
            <p className="text-xs text-text-muted">{chargeTitle(charge)}</p>
          </div>
        </div>

        {state.kind === 'loading' && (
          <div className="py-12 text-center text-sm text-text-muted">
            Preparing secure checkout…
          </div>
        )}

        {state.kind === 'error' && (
          <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-sm text-coral mb-4">
            {state.message}
          </div>
        )}

        {state.kind === 'ready' && (
          <Elements
            stripe={state.stripe}
            options={{
              clientSecret: state.clientSecret,
              appearance: { theme: 'night', labels: 'floating' },
            }}
          >
            <CardForm
              amountUsd={chargeAmount(charge)}
              onClose={onClose}
              onSuccess={props.onSuccess}
            />
          </Elements>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-text-muted">
          <ShieldCheckIcon className="w-3.5 h-3.5" />
          <span>
            Powered by Stripe. Your card details never touch our servers. Your card
            will be saved for future one-click purchases.
          </span>
        </div>
      </div>
    </Modal>
  );
}

interface CardFormProps {
  amountUsd: number;
  onClose: () => void;
  onSuccess?: () => void;
}

function CardForm({ amountUsd, onClose, onSuccess }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const fetchWallet = useDiamondStore((s) => s.fetchWallet);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pull base URL once so we can build a stable return_url.
  const returnUrl = useMemo(
    () => `${window.location.origin}/billing/success`,
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || 'Payment failed');
      setSubmitting(false);
      return;
    }

    // No redirect needed → succeeded inline
    setSuccess(true);
    setSubmitting(false);

    // Refresh user/wallet state so plan badge + diamond counter update.
    try {
      await Promise.all([fetchUser(), fetchWallet()]);
    } catch {
      // Non-fatal — the webhook will eventually reconcile.
    }
    onSuccess?.();
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-success flex items-center justify-center mb-4">
          <CheckCircleIcon className="w-7 h-7 text-white" />
        </div>
        <h4 className="text-lg font-bold text-text-primary mb-1">Payment successful</h4>
        <p className="text-sm text-text-secondary mb-5">
          Your card is saved. Future purchases will be one-click.
        </p>
        <Button fullWidth onClick={onClose}>
          Done
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {error && (
        <div className="mt-4 rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-xs text-coral">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          fullWidth
          isLoading={submitting}
          disabled={!stripe || !elements}
          rightIcon={<ArrowRightIcon className="w-4 h-4" />}
        >
          Pay ${amountUsd}
        </Button>
      </div>
    </form>
  );
}

export default CardEntryModal;
