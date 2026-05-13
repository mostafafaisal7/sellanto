import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  RocketLaunchIcon,
  BuildingOffice2Icon,
  CheckIcon,
  CheckCircleIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ShieldCheckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal, LoadingScreen } from '../components/ui';
import { subscriptionService } from '../services';
import { useAuthStore } from '../store';
import { useDiamondStore } from '../store/diamondStore';
import type { DiamondGrantResult } from '../services/subscriptionService';
import { BillingChoiceModal } from '../components/billing/BillingChoiceModal';
import type {
  BillingCycle,
  PlanCatalogEntry,
  PlanId,
  SubscriptionStatus,
} from '../services/subscriptionService';

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; plans: PlanCatalogEntry[]; status: SubscriptionStatus };

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: SparklesIcon,
  pro: RocketLaunchIcon,
  business: BuildingOffice2Icon,
};

function pct(used: number, max: number) {
  if (max <= 0) return 0;
  if (max >= 99999) return Math.min(100, Math.max(0, (used / 1000) * 100)); // unlimited — show modest fill
  return Math.min(100, Math.max(0, (used / max) * 100));
}

function fmtLimit(n: number) {
  return n >= 99999 ? '∞' : n.toLocaleString();
}

interface UsageRowProps {
  label: string;
  used: number;
  max: number;
  color: string;
}

function UsageRow({ label, used, max, color }: UsageRowProps) {
  const p = pct(used, max);
  const danger = p > 90 && max < 99999;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className={`font-mono ${danger ? 'text-coral' : 'text-text-primary'}`}>
          {used.toLocaleString()} / {fmtLimit(max)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${danger ? 'bg-coral' : color}`}
        />
      </div>
    </div>
  );
}

const PLAN_ORDER: PlanId[] = ['free', 'pro', 'business'];
const planRank = (id: PlanId) => PLAN_ORDER.indexOf(id);

export function UpgradePage() {
  const navigate = useNavigate();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const fetchWallet = useDiamondStore((s) => s.fetchWallet);
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [confirmPlan, setConfirmPlan] = useState<PlanCatalogEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [successGrant, setSuccessGrant] = useState<DiamondGrantResult | null>(null);

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const [plans, status] = await Promise.all([
        subscriptionService.getPlans(),
        subscriptionService.getStatus(),
      ]);
      // Only show the 3 public-facing plans on the upgrade page.
      const publicPlans = plans.filter((p) => PLAN_ORDER.includes(p.id));
      setState({ kind: 'ready', plans: publicPlans, status });
    } catch (err) {
      const e = err as {
        userMessage?: string;
        response?: { data?: { error?: string; detail?: string; message?: string } };
        message?: string;
      };
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.userMessage ||
        e?.message ||
        'Failed to load plans';
      setState({ kind: 'error', message });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConfirm = async () => {
    if (!confirmPlan) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await subscriptionService.upgrade(confirmPlan.id, billing);
      setState((prev) =>
        prev.kind === 'ready' ? { ...prev, status: res.subscription } : prev
      );
      // Refresh the auth store + diamond wallet so the sidebar card,
      // plan badges, and the navbar diamond counter all update immediately.
      await Promise.all([fetchUser(), fetchWallet()]);
      setSuccessGrant(res.diamond_grant);
      setSuccessPlan(confirmPlan.display_name);
      setConfirmPlan(null);
    } catch (err) {
      const e = err as {
        userMessage?: string;
        response?: { data?: { error?: string; detail?: string; message?: string } };
        message?: string;
      };
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.userMessage ||
        e?.message ||
        'Could not change plan';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state.kind === 'loading') return <LoadingScreen />;

  if (state.kind === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-coral mb-4">{state.message}</p>
        <Button onClick={load} variant="secondary">
          Try again
        </Button>
      </div>
    );
  }

  const { plans, status } = state;
  const currentRank = planRank(status.plan_id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-10">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
              Subscription
            </span>
            <h1 className="mt-2 text-3xl md:text-4xl font-extrabold font-heading text-text-primary tracking-tight">
              Upgrade your plan
            </h1>
            <p className="mt-2 text-sm md:text-base text-text-secondary max-w-xl">
              Power up Magic Mode, unlock more AI videos, and connect every platform.
              Switch any time — the change applies instantly.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            leftIcon={<ArrowRightIcon className="w-4 h-4 rotate-180" />}
          >
            Back to dashboard
          </Button>
        </div>
      </motion.header>

      {/* Current plan banner */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-bg-card"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-coral/15 blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-purple/10 blur-[100px]" />
        </div>

        <div className="relative grid lg:grid-cols-12 gap-8 p-6 md:p-8">
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted">
                Current plan
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold font-heading text-text-primary tracking-tight">
                    {status.plan_display_name}
                  </h2>
                  <p className="text-xs text-text-muted">
                    {status.plan_id === 'free'
                      ? 'Free forever'
                      : status.plan_end_date
                      ? `Renews ${new Date(status.plan_end_date).toLocaleDateString()}`
                      : 'Active'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-text-secondary">
                <ClockIcon className="w-4 h-4" />
                {status.days_remaining !== null && status.days_remaining > 0
                  ? `${status.days_remaining} days left in this cycle`
                  : status.plan_id === 'free'
                  ? 'No expiry on the free tier'
                  : 'Cycle ends soon — renew to keep your quotas'}
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <ShieldCheckIcon className="w-4 h-4" />
                {status.is_plan_active
                  ? 'All features active'
                  : 'Plan expired — choose a plan below'}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <UsageRow
              label="Magic Mode runs"
              used={status.usage.posts}
              max={status.limits.posts}
              color="bg-gradient-primary"
            />
            <UsageRow
              label="AI captions"
              used={status.usage.captions}
              max={status.limits.captions}
              color="bg-purple"
            />
            <UsageRow
              label="AI images"
              used={status.usage.images}
              max={status.limits.images}
              color="bg-amber"
            />
            <UsageRow
              label="AI videos (Veo)"
              used={status.usage.videos}
              max={status.limits.videos}
              color="bg-coral"
            />
            <UsageRow
              label="Messenger replies"
              used={status.usage.messenger}
              max={status.limits.messenger}
              color="bg-blue"
            />
            <UsageRow
              label="Connected accounts"
              used={0}
              max={status.limits.accounts}
              color="bg-green"
            />
          </div>
        </div>
      </motion.section>

      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${
              billing === 'monthly'
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 ${
              billing === 'yearly'
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Yearly
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-green/15 text-green border border-green/20">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <section className="grid md:grid-cols-3 gap-5 md:gap-6">
        {plans.map((plan, i) => {
          const Icon = PLAN_ICONS[plan.id] || SparklesIcon;
          const price =
            billing === 'monthly' ? plan.price_monthly_usd : plan.price_yearly_usd;
          const isCurrent = status.plan_id === plan.id;
          const isUpgrade = planRank(plan.id) > currentRank;
          const isDowngrade = planRank(plan.id) < currentRank;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`relative ${plan.highlight ? 'md:-mt-3 md:mb-3' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-coral via-purple to-amber opacity-50 blur-md pointer-events-none" />
              )}

              <div
                className={`relative h-full rounded-3xl p-7 flex flex-col transition-all ${
                  isCurrent
                    ? 'bg-bg-card border-2 border-coral/60 shadow-glow-coral'
                    : plan.highlight
                    ? 'bg-bg-card border border-white/[0.12] shadow-2xl'
                    : 'bg-bg-card/70 border border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {/* Ribbons */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-coral text-[11px] font-bold text-white uppercase tracking-wide">
                    Current plan
                  </div>
                )}
                {!isCurrent && plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary shadow-glow-coral text-[11px] font-bold text-white uppercase tracking-wide">
                    Most popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      plan.highlight
                        ? 'bg-gradient-primary shadow-glow-coral'
                        : 'bg-white/[0.06] border border-white/[0.08]'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold font-heading text-text-primary">
                    {plan.display_name}
                  </h3>
                </div>
                <p className="text-sm text-text-secondary mb-6">{plan.tagline}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold font-heading text-text-primary tracking-tight">
                      ${price}
                    </span>
                    {price > 0 && <span className="text-text-muted text-sm">/mo</span>}
                  </div>
                  <div className="mt-1.5 text-xs text-text-muted h-4">
                    {price === 0
                      ? 'Free forever'
                      : billing === 'yearly'
                      ? `Billed $${price * 12}/year`
                      : 'Billed monthly'}
                  </div>
                </div>

                <Button
                  variant={
                    isCurrent ? 'secondary' : plan.highlight ? 'primary' : 'secondary'
                  }
                  fullWidth
                  size="lg"
                  disabled={isCurrent}
                  onClick={() => setConfirmPlan(plan)}
                  leftIcon={
                    isUpgrade ? (
                      <ArrowUpIcon className="w-4 h-4" />
                    ) : isDowngrade ? (
                      <ArrowDownIcon className="w-4 h-4" />
                    ) : isCurrent ? (
                      <CheckIcon className="w-4 h-4" />
                    ) : undefined
                  }
                  className="mb-7"
                >
                  {isCurrent
                    ? 'Your current plan'
                    : isUpgrade
                    ? `Upgrade to ${plan.display_name}`
                    : `Switch to ${plan.display_name}`}
                </Button>

                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                          plan.highlight ? 'bg-coral/20' : 'bg-white/[0.06]'
                        }`}
                      >
                        <CheckIcon
                          className={`w-3 h-3 ${
                            plan.highlight ? 'text-coral' : 'text-text-secondary'
                          }`}
                          strokeWidth={3}
                        />
                      </span>
                      <span className="text-sm text-text-secondary leading-relaxed">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Comparison table */}
      <section className="rounded-3xl border border-white/[0.06] bg-bg-card overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="text-lg font-bold font-heading text-text-primary">
            Quota comparison
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Hard caps per billing cycle. ∞ = unlimited fair-use.
          </p>
        </div>
        <ComparisonTable plans={plans} />
      </section>

      {/* FAQ */}
      <section className="grid md:grid-cols-3 gap-5">
        {[
          {
            q: 'Can I switch plans any time?',
            a: 'Yes. Upgrades apply instantly and your new quotas activate immediately. Downgrades take effect at the next billing cycle.',
          },
          {
            q: 'What happens if I hit a quota cap?',
            a: 'You\'ll see an in-app upgrade nudge. Existing scheduled posts continue to publish — only new generations are paused until the cycle resets.',
          },
          {
            q: 'How is billing handled?',
            a: 'Pay via bKash, Nagad, bank transfer, or card. Submit your transaction reference and our billing team verifies within an hour during business hours — your plan and diamonds activate the moment it\'s approved.',
          },
        ].map((item) => (
          <div
            key={item.q}
            className="rounded-2xl bg-bg-card/70 border border-white/[0.06] p-5"
          >
            <h4 className="text-sm font-bold text-text-primary mb-2">{item.q}</h4>
            <p className="text-xs text-text-secondary leading-relaxed">{item.a}</p>
          </div>
        ))}
      </section>

      {/*
        Confirm modal — only used for the FREE plan (downgrade-to-free path).
        Paid plans route through PaymentModal below.
      */}
      <Modal
        isOpen={confirmPlan !== null && confirmPlan.id === 'free'}
        onClose={() => {
          if (!submitting) {
            setConfirmPlan(null);
            setSubmitError(null);
          }
        }}
        size="md"
        showCloseButton={!submitting}
      >
        {confirmPlan && confirmPlan.id === 'free' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow-coral flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  Switch to {confirmPlan.display_name}
                </h3>
                <p className="text-xs text-text-muted">
                  Free plan · no payment needed
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber/10 border border-amber/20 p-3 text-xs text-text-secondary mb-5">
              <strong className="text-amber">Heads up:</strong> downgrading drops your monthly
              quotas. Your existing diamond balance is preserved.
            </div>

            {submitError && (
              <div className="text-xs text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2 mb-4">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setConfirmPlan(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={handleConfirm}
                isLoading={submitting}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              >
                Confirm downgrade
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/*
        Billing modal — opens for any paid plan.
        Default tab: Stripe Checkout (redirects to checkout.stripe.com).
        Secondary tab: manual bKash/Nagad/Bank claim (admin-verified).
      */}
      <BillingChoiceModal
        isOpen={confirmPlan !== null && confirmPlan.id !== 'free'}
        onClose={() => setConfirmPlan(null)}
        plan={
          confirmPlan && confirmPlan.id !== 'free'
            ? { id: confirmPlan.id, display_name: confirmPlan.display_name }
            : { id: '', display_name: '' }
        }
        billingCycle={billing}
        amountUsd={
          confirmPlan
            ? billing === 'monthly'
              ? confirmPlan.price_monthly_usd
              : confirmPlan.price_yearly_usd
            : 0
        }
      />

      {/* Success modal */}
      <Modal
        isOpen={successPlan !== null}
        onClose={() => {
          setSuccessPlan(null);
          setSuccessGrant(null);
        }}
        size="sm"
      >
        <div className="text-center py-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-success flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">
            You're on {successPlan} 🎉
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            Your new quotas are live. Head back to the dashboard to start creating.
          </p>

          {/* Diamond grant — only shown when actually granted on this upgrade */}
          {successGrant?.granted && successGrant.amount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="mb-5 rounded-xl border border-coral/25 bg-gradient-to-r from-coral/10 via-purple/10 to-amber/10 px-4 py-3"
            >
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-text-primary">
                <span className="text-lg">💎</span>
                <span>+{successGrant.amount.toLocaleString()} Diamond Tokens</span>
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                New balance: {successGrant.balance.toLocaleString()}
              </div>
            </motion.div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setSuccessPlan(null);
                setSuccessGrant(null);
              }}
            >
              Stay here
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setSuccessPlan(null);
                setSuccessGrant(null);
                navigate('/dashboard');
              }}
              rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            >
              Open dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface ComparisonTableProps {
  plans: PlanCatalogEntry[];
}

function ComparisonTable({ plans }: ComparisonTableProps) {
  const rows = useMemo(
    () => [
      { label: 'Magic Mode runs / month', key: 'posts' as const },
      { label: 'AI captions / month', key: 'captions' as const },
      { label: 'AI images / month', key: 'images' as const },
      { label: 'AI videos (Veo) / month', key: 'videos' as const },
      { label: 'Messenger replies / month', key: 'messenger' as const },
      { label: 'Connected social accounts', key: 'accounts' as const },
    ],
    []
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">
              Feature
            </th>
            {plans.map((p) => (
              <th
                key={p.id}
                className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider"
              >
                {p.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-white/[0.04]">
              <td className="px-6 py-3 text-text-secondary">{row.label}</td>
              {plans.map((p) => (
                <td
                  key={p.id}
                  className="px-6 py-3 font-mono text-text-primary"
                >
                  {fmtLimit(p.limits[row.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UpgradePage;
