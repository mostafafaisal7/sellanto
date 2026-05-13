import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/ui';
import { stripeService, type SessionStatus } from '../services/stripeService';
import { useAuthStore } from '../store';
import { useDiamondStore } from '../store/diamondStore';

const POLL_INTERVAL_MS = 1_500;
const MAX_ATTEMPTS = 8; // ~12 seconds total

export function SuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const fetchWallet = useDiamondStore((s) => s.fetchWallet);

  const [status, setStatus] = useState<SessionStatus>({ status: 'pending' });
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session id. If you were charged, please contact support.');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      attemptRef.current += 1;
      try {
        const res = await stripeService.getSessionStatus(sessionId);
        if (cancelled) return;
        setStatus(res);
        if (res.status === 'completed') {
          // Refresh global stores so sidebar plan badge + navbar diamond
          // counter reflect the new state right away.
          await Promise.all([fetchUser(), fetchWallet()]);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        const e = err as { message?: string };
        setError(e?.message || 'Could not confirm payment');
        return;
      }
      if (attemptRef.current < MAX_ATTEMPTS) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, fetchUser, fetchWallet]);

  const isCompleted = status.status === 'completed';
  const stillPolling = !isCompleted && !error && attemptRef.current < MAX_ATTEMPTS;

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card p-8 md:p-10 text-center"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-success flex items-center justify-center mb-5">
          <CheckCircleIcon className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold font-heading text-text-primary mb-2">
          {isCompleted ? 'Payment successful 🎉' : 'Confirming your payment…'}
        </h1>

        <p className="text-sm text-text-secondary mb-6">
          {isCompleted
            ? status.purpose === 'topup'
              ? `Your wallet has been topped up. New diamonds are live and ready to use.`
              : `You're now on the ${status.plan?.toUpperCase()} plan. New quotas are active immediately.`
            : 'This usually takes a couple of seconds while Stripe finishes processing.'}
        </p>

        {isCompleted && status.diamonds > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-coral/25 bg-gradient-to-r from-coral/10 via-purple/10 to-amber/10 px-4 py-3 mb-6"
          >
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-text-primary">
              <span className="text-lg">💎</span>
              <span>+{status.diamonds.toLocaleString()} Diamonds</span>
            </div>
          </motion.div>
        )}

        {stillPolling && (
          <p className="text-xs text-text-muted mb-6">
            Still confirming · attempt {attemptRef.current}/{MAX_ATTEMPTS}
          </p>
        )}

        {!isCompleted && !stillPolling && !error && (
          <div className="rounded-xl bg-amber/10 border border-amber/20 px-4 py-3 mb-6 text-xs text-text-secondary text-left">
            <strong className="text-amber">Heads up:</strong> the confirmation is taking longer
            than usual. Your payment was likely successful — refresh in a minute, or contact
            support if your plan hasn't updated.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 mb-6 text-xs text-coral text-left">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<SparklesIcon className="w-4 h-4" />}
            onClick={() => navigate('/upgrade')}
          >
            View plan
          </Button>
          <Button
            fullWidth
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Go to dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default SuccessPage;
