import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCardIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../ui';
import {
  stripeService,
  type ChargeRequest,
  type SavedCard,
} from '../../services/stripeService';
import { useAuthStore } from '../../store';
import { useDiamondStore } from '../../store/diamondStore';

interface QuickPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: SavedCard;
  // What we're charging for + how much.
  charge:
    | { kind: 'topup'; sku: string; diamonds: number; usd: number }
    | { kind: 'topup-flex'; amount_usd: number; diamonds: number }
    | { kind: 'boost'; amount_usd: number; label: string; metadata?: Record<string, string | number> }
    | { kind: 'misc'; amount_usd: number; label: string; metadata?: Record<string, string | number> };
  onSuccess?: () => void;
}

function brandLogo(brand: string): string {
  // Plain text initials — keeps the bundle small.
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function chargeLine(charge: QuickPayModalProps['charge']): {
  title: string;
  amount: number;
} {
  if (charge.kind === 'topup') {
    return { title: `${charge.diamonds.toLocaleString()} 💎 Diamonds`, amount: charge.usd };
  }
  if (charge.kind === 'topup-flex') {
    return { title: `${charge.diamonds.toLocaleString()} 💎 Diamonds`, amount: charge.amount_usd };
  }
  return { title: charge.label, amount: charge.amount_usd };
}

export function QuickPayModal({
  isOpen,
  onClose,
  card,
  charge,
  onSuccess,
}: QuickPayModalProps) {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const fetchWallet = useDiamondStore((s) => s.fetchWallet);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { title, amount } = chargeLine(charge);

  const handleCharge = async () => {
    setSubmitting(true);
    setError(null);
    try {
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
        body = {
          purpose: 'misc',
          amount_usd: charge.amount_usd,
          metadata: { label: charge.label, ...(charge.metadata || {}) },
        };
      }
      const res = await stripeService.chargeSavedCard(body);

      if (res.needs_3ds && res.fallback_checkout_url) {
        // Bank wants SCA — redirect once to Stripe Checkout.
        window.location.assign(res.fallback_checkout_url);
        return;
      }
      if (!res.succeeded) {
        setError(res.error || 'Card was declined');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setSubmitting(false);
      try {
        await Promise.all([fetchUser(), fetchWallet()]);
      } catch {
        // non-fatal — webhook reconciles
      }
      onSuccess?.();
    } catch (err) {
      const e = err as {
        response?: { data?: { error?: string; detail?: string } };
        message?: string;
      };
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          e?.message ||
          'Charge failed',
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      {success ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-success flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-7 h-7 text-white" />
          </div>
          <h4 className="text-lg font-bold text-text-primary mb-1">Charged ${amount}</h4>
          <p className="text-sm text-text-secondary mb-5">{title} — activated.</p>
          <Button fullWidth onClick={onClose}>
            Done
          </Button>
        </motion.div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
              <BoltIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Confirm payment</h3>
              <p className="text-xs text-text-muted">1-click checkout</p>
            </div>
          </div>

          {/* Summary row */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">
                  You're paying
                </p>
                <p className="text-sm font-semibold text-text-primary">{title}</p>
              </div>
              <p className="text-2xl font-extrabold font-heading text-text-primary">
                ${amount}
              </p>
            </div>
          </div>

          {/* Card row */}
          <div className="rounded-2xl border border-white/[0.08] p-4 mb-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">
                {brandLogo(card.brand)} · · · · {card.last4}
              </p>
              <p className="text-xs text-text-muted">
                Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-xs text-coral mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
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
              onClick={handleCharge}
              isLoading={submitting}
              rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            >
              Charge ${amount}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default QuickPayModal;
