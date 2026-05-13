import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  ArrowRightIcon,
  BoltIcon,
  CreditCardIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../ui';
import {
  stripeService,
  type DiamondRateResponse,
  type SavedCard,
} from '../../services/stripeService';
import { CardEntryModal } from './CardEntryModal';
import { QuickPayModal } from './QuickPayModal';

interface BuyDiamondsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill the USD amount (e.g. from a shortfall calculation) */
  initialAmount?: number;
  onSuccess?: () => void;
}

const QUICK_PICKS = [5, 10, 25, 50, 100];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; rate: DiamondRateResponse; hasCard: boolean; defaultCard: SavedCard | null }
  | { kind: 'error'; message: string };

export function BuyDiamondsModal({
  isOpen,
  onClose,
  initialAmount,
  onSuccess,
}: BuyDiamondsModalProps) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [amount, setAmount] = useState<string>(String(initialAmount ?? 10));
  const [purchasing, setPurchasing] = useState(false);

  // Reload when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    setAmount(String(initialAmount ?? 10));

    Promise.all([stripeService.getDiamondRate(), stripeService.hasCardOnFile()])
      .then(([rate, cardRes]) => {
        if (cancelled) return;
        setLoadState({
          kind: 'ready',
          rate,
          hasCard: cardRes.has_card,
          defaultCard: cardRes.default,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const e = err as { message?: string };
        setLoadState({ kind: 'error', message: e?.message || 'Failed to load rate' });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const numericAmount = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const rate = loadState.kind === 'ready' ? loadState.rate : null;
  const diamondsPreview = useMemo(
    () => (rate ? Math.floor(numericAmount * rate.diamonds_per_dollar) : 0),
    [numericAmount, rate],
  );

  const validation = useMemo(() => {
    if (!rate) return null;
    if (numericAmount <= 0) return 'Enter an amount';
    if (numericAmount < rate.min_usd) return `Minimum $${rate.min_usd}`;
    if (numericAmount > rate.max_usd) return `Maximum $${rate.max_usd.toLocaleString()}`;
    return null;
  }, [numericAmount, rate]);

  const canSubmit = validation === null && !purchasing && loadState.kind === 'ready';
  const usingQuickPay =
    loadState.kind === 'ready' && loadState.hasCard && loadState.defaultCard !== null;
  const defaultCard = loadState.kind === 'ready' ? loadState.defaultCard : null;

  const handleBuy = () => {
    if (!canSubmit) return;
    setPurchasing(true);
  };

  const onPurchaseSettled = () => {
    setPurchasing(false);
    onSuccess?.();
    onClose();
  };

  const onPurchaseFailed = () => {
    setPurchasing(false);
    // reload rate/card state in case something changed
    if (isOpen) {
      Promise.all([stripeService.getDiamondRate(), stripeService.hasCardOnFile()])
        .then(([r, c]) =>
          setLoadState({ kind: 'ready', rate: r, hasCard: c.has_card, defaultCard: c.default }),
        )
        .catch(() => {});
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !purchasing} onClose={onClose} size="md">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center flex-shrink-0">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Top up diamonds 💎</h3>
              <p className="text-xs text-text-muted">Diamonds never expire</p>
            </div>
          </div>

          {/* Loading */}
          {loadState.kind === 'loading' && (
            <div className="py-10 flex items-center justify-center gap-2 text-text-muted text-sm">
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Loading rate…
            </div>
          )}

          {/* Error */}
          {loadState.kind === 'error' && (
            <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-sm text-coral">
              {loadState.message}
            </div>
          )}

          {/* Ready */}
          {loadState.kind === 'ready' && (
            <>
              {/* Card-on-file banner */}
              {usingQuickPay && defaultCard ? (
                <div className="rounded-xl border border-coral/20 bg-coral/[0.06] p-3 flex items-center gap-3">
                  <BoltIcon className="w-4 h-4 text-coral flex-shrink-0" />
                  <p className="text-xs text-text-secondary flex-1">
                    1-click checkout with{' '}
                    <span className="text-text-primary font-semibold capitalize">
                      {defaultCard.brand} ····{defaultCard.last4}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 flex items-center gap-3">
                  <CreditCardIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <p className="text-xs text-text-muted">
                    We'll save your card after this purchase — future top-ups will be 1-click.
                  </p>
                </div>
              )}

              {/* USD input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">
                  How much?
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-text-muted pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    min={loadState.rate.min_usd}
                    max={loadState.rate.max_usd}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10"
                    className="w-full pl-10 pr-4 py-4 text-3xl font-extrabold font-heading text-text-primary bg-white/[0.04] border border-white/[0.08] rounded-2xl focus:outline-none focus:border-coral/40 focus:ring-2 focus:ring-coral/15"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Min ${loadState.rate.min_usd} · Max ${loadState.rate.max_usd.toLocaleString()}
                </p>
              </div>

              {/* Live diamond preview */}
              <motion.div
                key={diamondsPreview}
                initial={{ scale: 0.97, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="rounded-2xl bg-gradient-to-br from-coral/[0.08] via-purple/[0.05] to-amber/[0.08] border border-coral/15 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
                    You'll get
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold font-heading text-text-primary">
                      {diamondsPreview > 0 ? diamondsPreview.toLocaleString() : '—'}
                    </span>
                    <span className="text-xl">💎</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Rate</p>
                  <p className="text-sm font-mono text-text-secondary">
                    $1 = {loadState.rate.diamonds_per_dollar} 💎
                  </p>
                  {numericAmount > 0 && diamondsPreview > 0 && (
                    <p className="text-[10px] text-text-muted mt-0.5">
                      ≈ ${(numericAmount / diamondsPreview * 1000).toFixed(2)} per 1,000 💎
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Quick picks */}
              <div>
                <p className="text-xs font-semibold text-text-muted mb-2">Quick picks</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PICKS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(String(p))}
                      className={`px-3 py-1.5 text-sm font-semibold rounded-xl border transition-colors ${
                        numericAmount === p
                          ? 'bg-coral/15 border-coral/40 text-coral'
                          : 'bg-white/[0.04] border-white/[0.08] text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
                      }`}
                    >
                      ${p}
                      <span className="ml-1 text-[10px] opacity-60 font-normal">
                        = {(p * loadState.rate.diamonds_per_dollar).toLocaleString()}💎
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation error */}
              {validation && numericAmount > 0 && (
                <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-2.5 text-xs text-coral">
                  {validation}
                </div>
              )}

              {/* CTA */}
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  fullWidth
                  onClick={handleBuy}
                  disabled={!canSubmit}
                  rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                >
                  {usingQuickPay && defaultCard
                    ? `Pay $${numericAmount.toFixed(2)}`
                    : `Checkout · $${numericAmount.toFixed(2)}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* QuickPay for returning users */}
      {purchasing && usingQuickPay && defaultCard && (
        <QuickPayModal
          isOpen={purchasing}
          onClose={onPurchaseFailed}
          card={defaultCard}
          charge={{ kind: 'topup-flex', amount_usd: numericAmount, diamonds: diamondsPreview }}
          onSuccess={onPurchaseSettled}
        />
      )}

      {/* CardEntry for first-time users */}
      {purchasing && !usingQuickPay && (
        <CardEntryModal
          isOpen={purchasing}
          onClose={onPurchaseFailed}
          charge={{ kind: 'topup-flex', amount_usd: numericAmount, diamonds: diamondsPreview }}
          onSuccess={onPurchaseSettled}
        />
      )}
    </>
  );
}

export default BuyDiamondsModal;
