import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, LoadingScreen } from '../components/ui';


import { BuyDiamondsModal } from '../components/billing/BuyDiamondsModal';
import { diamondService } from '../services/diamondService';

import type {
  DiamondForecast,
  DiamondUsageTimeseries,
  PlanHistoryEntry,
  TimeseriesPeriod,
} from '../services/diamondService';
import type { DiamondTransaction, DiamondUsageBreakdown, DiamondWallet } from '../types';

// ─── Color palette (mirrors index.css design tokens) ─────────────────
const COLORS = {
  coral: '#E8364F',
  coralHover: '#FF4D66',
  purple: '#8B5CF6',
  amber: '#F59E0B',
  blue: '#3B82F6',
  green: '#10B981',
  textPrimary: '#F1F1F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  bgCard: '#16162A',
};

// Feature key → friendly label + accent color (cycles through palette).
const FEATURE_META: Record<string, { label: string; color: string }> = {
  caption: { label: 'Captions', color: COLORS.coral },
  caption_adapt: { label: 'Caption (adapt)', color: COLORS.coral },
  caption_regenerate: { label: 'Caption (re-gen)', color: COLORS.coral },
  brand_dna: { label: 'Brand DNA', color: COLORS.purple },
  strategy_ideas: { label: 'Strategy ideas', color: COLORS.purple },
  idea_regenerate: { label: 'Idea regen', color: COLORS.purple },
  hashtag_generation: { label: 'Hashtags', color: COLORS.amber },
  competitor_analysis: { label: 'Competitor', color: COLORS.amber },
  competitor_suggest: { label: 'Competitor sug.', color: COLORS.amber },
  trending_generation: { label: 'Trending', color: COLORS.amber },
  weekly_report: { label: 'Weekly report', color: COLORS.amber },
  pillar_generation: { label: 'Pillars', color: COLORS.amber },
  ai_reply_comment: { label: 'AI reply', color: COLORS.blue },
  image_standard: { label: 'Image (std)', color: COLORS.blue },
  image_hd: { label: 'Image (HD)', color: COLORS.blue },
  image: { label: 'Images', color: COLORS.blue },
  video_5s: { label: 'Video 5s', color: COLORS.green },
  video_8s: { label: 'Video 8s', color: COLORS.green },
  video_10s: { label: 'Video 10s', color: COLORS.green },
  video_15s: { label: 'Video 15s', color: COLORS.green },
  video_30s: { label: 'Video 30s', color: COLORS.green },
  video: { label: 'Videos', color: COLORS.green },
  voice_short: { label: 'Voice (short)', color: COLORS.purple },
  voice_medium: { label: 'Voice (med)', color: COLORS.purple },
  voice_long: { label: 'Voice (long)', color: COLORS.purple },
  voice: { label: 'Voice', color: COLORS.purple },
  messenger_reply: { label: 'Messenger', color: COLORS.coralHover },
};

const PLAN_META: Record<string, { label: string; color: string; icon: string }> = {
  free: { label: 'Solo (Free)', color: COLORS.textMuted, icon: '◇' },
  starter: { label: 'Starter', color: COLORS.blue, icon: '◆' },
  pro: { label: 'Pro', color: COLORS.coral, icon: '⭐' },
  business: { label: 'Business', color: COLORS.purple, icon: '🏢' },
  enterprise: { label: 'Enterprise', color: COLORS.amber, icon: '🚀' },
};

function getFeatureLabel(key: string): string {
  return FEATURE_META[key]?.label || key.replace(/_/g, ' ');
}
function getFeatureColor(key: string, idx = 0): string {
  return (
    FEATURE_META[key]?.color ||
    [COLORS.coral, COLORS.purple, COLORS.amber, COLORS.blue, COLORS.green][idx % 5]
  );
}

// ─── Period preset definitions ───────────────────────────────────────
type PresetKey = '7d' | '30d' | '12w' | '12m' | 'custom';

const PRESETS: { key: PresetKey; label: string; period: TimeseriesPeriod; days?: number }[] = [
  { key: '7d', label: '7 days', period: 'daily', days: 7 },
  { key: '30d', label: '30 days', period: 'daily', days: 30 },
  { key: '12w', label: '12 weeks', period: 'weekly', days: 84 },
  { key: '12m', label: '12 months', period: 'monthly', days: 365 },
  { key: 'custom', label: 'Custom', period: 'daily' },
];

function fmtDate(iso: string, period: TimeseriesPeriod): string {
  const d = new Date(iso);
  if (period === 'monthly') {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  if (period === 'weekly') {
    return `Wk ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Tooltip styling for recharts ────────────────────────────────────
interface TooltipPayload {
  value: number;
  payload: { date: string; transaction_count?: number };
}
function ChartTooltip({
  active,
  payload,
  period,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  period: TimeseriesPeriod;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-bg-card/95 backdrop-blur-md border border-white/[0.12] px-3.5 py-2.5 shadow-2xl">
      <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
        {fmtDate(point.date, period)}
      </div>
      <div className="text-base font-bold text-text-primary mt-0.5 flex items-center gap-1">
        <span className="text-coral">💎</span>
        {payload[0].value.toLocaleString()}
      </div>
      {point.transaction_count != null && (
        <div className="text-[11px] text-text-muted mt-0.5">
          {point.transaction_count} txn{point.transaction_count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  accent?: string;
  warning?: boolean;
  delay?: number;
}
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent = COLORS.coral,
  warning,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-card p-5"
    >
      {/* accent gradient blob */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-[80px] opacity-30 pointer-events-none"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: `${accent}25`,
            border: `1px solid ${accent}40`,
            color: accent,
          }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {warning && (
          <ExclamationTriangleIcon className="w-4 h-4 text-amber" title="Low balance" />
        )}
      </div>
      <div className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="relative mt-1.5 text-2xl md:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
        {value}
      </div>
      {subtext && (
        <div className="relative mt-1 text-xs text-text-secondary">{subtext}</div>
      )}
    </motion.div>
  );
}

// ─── Page state ──────────────────────────────────────────────────────
type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      wallet: DiamondWallet;
      forecast: DiamondForecast;
      usage: DiamondUsageBreakdown;
      planHistory: PlanHistoryEntry[];
      recentTxns: DiamondTransaction[];
    };

export function DiamondAnalyticsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  // Timeseries chart state — independent of main page load so the user
  // can switch periods without re-fetching everything else.
  const [preset, setPreset] = useState<PresetKey>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [series, setSeries] = useState<DiamondUsageTimeseries | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);


  const load = async () => {
    try {
      const [wallet, forecast, usage, planHistRes, txnsRes] = await Promise.all([
        diamondService.getBalance(),
        diamondService.getForecast(14),
        diamondService.getUsage(30),
        diamondService.getPlanHistory(),
        diamondService.getTransactions({ page: 1, page_size: 12 }),
      ]);
      setState({
        kind: 'ready',
        wallet,
        forecast,
        usage,
        planHistory: planHistRes.history,
        recentTxns: txnsRes.results,
      });
    } catch (err) {
      const e = err as {
        userMessage?: string;
        response?: { data?: { error?: string; detail?: string } };
        message?: string;
      };
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.userMessage ||
        e?.message ||
        'Failed to load analytics';
      setState({ kind: 'error', message });
    }
  };

  // ── Initial load (everything except timeseries) ────────────────
  useEffect(() => {
    setState({ kind: 'loading' });
    load();
  }, []);


  // ── Timeseries fetcher (re-runs on preset change) ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSeriesLoading(true);
      try {
        const def = PRESETS.find((p) => p.key === preset)!;
        const params: { period: TimeseriesPeriod; days?: number; from?: string; to?: string } = {
          period: def.period,
        };
        if (preset === 'custom' && customFrom && customTo) {
          params.from = customFrom;
          params.to = customTo;
          // Heuristic: choose period based on range width.
          const days = Math.round(
            (new Date(customTo).getTime() - new Date(customFrom).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          params.period = days > 120 ? 'monthly' : days > 35 ? 'weekly' : 'daily';
        } else if (def.days) {
          params.days = def.days;
        }
        const data = await diamondService.getUsageTimeseries(params);
        if (!cancelled) setSeries(data);
      } catch {
        if (!cancelled) setSeries(null);
      } finally {
        if (!cancelled) setSeriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, customFrom, customTo]);

  // ── Derived metrics for the timeseries section ────────────────
  const seriesStats = useMemo(() => {
    if (!series || series.series.length === 0) {
      return { peak: 0, peakDate: '', average: 0 };
    }
    const peakPoint = series.series.reduce(
      (acc, p) => (p.diamonds_spent > acc.diamonds_spent ? p : acc),
      series.series[0]
    );
    const average = series.total_spent / series.series.length;
    return {
      peak: peakPoint.diamonds_spent,
      peakDate: peakPoint.date,
      average: Math.round(average),
    };
  }, [series]);

  if (state.kind === 'loading') return <LoadingScreen />;
  if (state.kind === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-coral mb-4">{state.message}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  const { wallet, forecast, usage, planHistory, recentTxns } = state;

  // ── Hero stat values ──────────────────────────────────────────
  const balanceLow = wallet.balance < 100;

  const daysRemainingValue =
    forecast.days_remaining == null
      ? '∞'
      : forecast.days_remaining < 1
      ? '<1'
      : Math.floor(forecast.days_remaining).toLocaleString();

  const effectiveWindow = forecast.effective_lookback_days ?? forecast.lookback_days;
  const daysRemainingSub =
    forecast.days_remaining == null
      ? 'No usage yet — generate something to see runway'
      : forecast.depletion_date
      ? forecast.fallback_used === 'lifetime_average'
        ? `Empty by ${fmtFullDate(forecast.depletion_date)} · all-time avg`
        : forecast.fallback_used === 'expanded_window'
        ? `Empty by ${fmtFullDate(forecast.depletion_date)} · last ${effectiveWindow}d avg`
        : `Empty by ${fmtFullDate(forecast.depletion_date)}`
      : '';

  // Top 8 features by spend, sorted desc.
  const topFeatures = [...usage.by_feature]
    .sort((a, b) => b.diamonds_spent - a.diamonds_spent)
    .slice(0, 8)
    .map((f, i) => ({
      ...f,
      label: getFeatureLabel(f.feature),
      color: getFeatureColor(f.feature, i),
    }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-8">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
      >
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
            Diamond Analytics
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold font-heading text-text-primary tracking-tight">
            Token usage &amp; runway
          </h1>
          <p className="mt-2 text-sm md:text-base text-text-secondary max-w-xl">
            Track every diamond — what you've spent, what's left, and how long
            it'll last at your current pace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
          >
            Dashboard
          </Button>
          <Button
            size="sm"
            onClick={() => setIsTopupOpen(true)}
            leftIcon={<SparklesIcon className="w-4 h-4" />}
            className="shadow-glow-coral"
          >
            Top up diamonds
          </Button>

        </div>
      </motion.div>

      {/* ─── Hero stat row ───────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={SparklesIcon}
          label="Current balance"
          value={`💎 ${wallet.balance.toLocaleString()}`}
          subtext={
            wallet.last_recharge_at
              ? `Last topped up ${fmtFullDate(wallet.last_recharge_at)}`
              : 'No recharges yet'
          }
          accent={COLORS.coral}
          warning={balanceLow}
          delay={0}
        />
        <StatCard
          icon={ClockIcon}
          label="Days remaining"
          value={`${daysRemainingValue}d`}
          subtext={daysRemainingSub}
          accent={
            forecast.days_remaining != null && forecast.days_remaining < 7
              ? COLORS.coral
              : forecast.days_remaining != null && forecast.days_remaining < 14
              ? COLORS.amber
              : COLORS.green
          }
          warning={forecast.days_remaining != null && forecast.days_remaining < 7}
          delay={0.05}
        />
        <StatCard
          icon={ArrowTrendingDownIcon}
          label="Total spent"
          value={wallet.total_spent.toLocaleString()}
          subtext={`${usage.total_spent_today} today · ${usage.total_spent_this_month} this month`}
          accent={COLORS.purple}
          delay={0.1}
        />
        <StatCard
          icon={ArrowTrendingUpIcon}
          label="Total recharged"
          value={wallet.total_recharged.toLocaleString()}
          subtext={`Net: ${(
            wallet.total_recharged - wallet.total_spent
          ).toLocaleString()}`}
          accent={COLORS.green}
          delay={0.15}
        />
      </section>

      {/* ─── Forecast banner (if balance low) ────────────────────── */}
      {forecast.days_remaining != null && forecast.days_remaining < 14 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-2xl border border-amber/30 bg-gradient-to-r from-amber/10 via-coral/10 to-coral/5 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber/20 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-text-primary">
                Running low — {Math.floor(forecast.days_remaining)} days of runway
              </div>
              <div className="text-xs text-text-secondary mt-1">
                You're spending an average of{' '}
                <span className="text-text-primary font-mono font-semibold">
                  {forecast.avg_daily_spend} 💎/day
                </span>
                . At this rate, you'll hit zero on{' '}
                <span className="text-text-primary font-semibold">
                  {forecast.depletion_date
                    ? fmtFullDate(forecast.depletion_date)
                    : 'soon'}
                </span>
                .
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsTopupOpen(true)}
                leftIcon={<SparklesIcon className="w-4 h-4" />}
              >
                Top up
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/upgrade')}
                rightIcon={<RocketLaunchIcon className="w-4 h-4" />}
              >
                Upgrade
              </Button>
            </div>

          </div>
        </motion.div>
      )}

      {/* ─── Timeseries chart ────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold font-heading text-text-primary">
              Usage over time
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Diamonds spent in the selected window
            </p>
          </div>

          {/* Period switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  preset === p.key
                    ? 'bg-bg-elevated text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom range inputs */}
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <CalendarDaysIcon className="w-4 h-4 text-text-muted" />
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-bg-elevated border border-white/[0.08] rounded-md px-2 py-1 text-xs text-text-primary focus:border-coral focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              To
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-bg-elevated border border-white/[0.08] rounded-md px-2 py-1 text-xs text-text-primary focus:border-coral focus:outline-none"
              />
            </label>
            {(!customFrom || !customTo) && (
              <span className="text-[11px] text-text-muted">
                Pick both dates to load
              </span>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="h-72">
          {seriesLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-text-muted">
              Loading…
            </div>
          ) : !series || series.series.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2">
              <ChartBarIcon className="w-10 h-10 text-text-muted/40" />
              <p className="text-sm text-text-secondary">
                No usage in this window
              </p>
              <p className="text-xs text-text-muted">
                Generate a caption, image, or video to see data here
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="diamondFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.coral} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={COLORS.coral} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => fmtDate(v, series.period)}
                  stroke={COLORS.textMuted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <YAxis
                  stroke={COLORS.textMuted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip
                  content={<ChartTooltip period={series.period} />}
                  cursor={{ stroke: COLORS.coral, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="diamonds_spent"
                  stroke={COLORS.coral}
                  strokeWidth={2}
                  fill="url(#diamondFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Below-chart stats */}
        {series && series.series.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/[0.06]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Total spent
              </div>
              <div className="mt-0.5 text-base font-bold text-text-primary">
                💎 {series.total_spent.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Per-{series.period === 'monthly' ? 'month' : series.period === 'weekly' ? 'week' : 'day'} avg
              </div>
              <div className="mt-0.5 text-base font-bold text-text-primary">
                💎 {seriesStats.average.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Peak
              </div>
              <div className="mt-0.5 text-base font-bold text-text-primary">
                💎 {seriesStats.peak.toLocaleString()}
              </div>
              <div className="text-[10px] text-text-muted">
                {seriesStats.peakDate ? fmtDate(seriesStats.peakDate, series.period) : ''}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* ─── Two-column: Feature breakdown + Plan history ────────── */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Feature breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-3xl border border-white/[0.08] bg-bg-card p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-text-primary">
                Top features
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Last 30 days · by spend</p>
            </div>
            <BoltIcon className="w-5 h-5 text-text-muted" />
          </div>

          {topFeatures.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2">
              <ChartBarIcon className="w-8 h-8 text-text-muted/40" />
              <p className="text-sm text-text-secondary">No usage yet</p>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topFeatures}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke={COLORS.textMuted}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke={COLORS.textMuted}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={92}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: COLORS.bgCard,
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      fontSize: 12,
                      color: COLORS.textPrimary,
                    }}
                    formatter={(value) => [
                      `💎 ${Number(value ?? 0).toLocaleString()}`,
                      'Spent',
                    ]}
                  />
                  <Bar dataKey="diamonds_spent" radius={[0, 6, 6, 0]}>
                    {topFeatures.map((f) => (
                      <Cell key={f.feature} fill={f.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Plan / payment history */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border border-white/[0.08] bg-bg-card p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-text-primary">
                Plan history
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Subscriptions &amp; diamond grants
              </p>
            </div>
            <RocketLaunchIcon className="w-5 h-5 text-text-muted" />
          </div>

          {planHistory.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
              <RocketLaunchIcon className="w-8 h-8 text-text-muted/40" />
              <p className="text-sm text-text-secondary">No plan history yet</p>
              <p className="text-xs text-text-muted">
                Upgrade to Pro to see your subscription log here
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
              {planHistory.map((g) => {
                const meta = PLAN_META[g.plan] || {
                  label: g.plan || 'Bonus',
                  color: COLORS.textMuted,
                  icon: '🎁',
                };
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{
                        background: `${meta.color}20`,
                        border: `1px solid ${meta.color}40`,
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary">
                        {meta.label}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {fmtFullDate(g.created_at)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono font-bold text-green">
                        +{g.amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        bal: {g.balance_after.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </section>

      {/* ─── Recent transactions table ───────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-heading text-text-primary">
              Recent transactions
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Last {recentTxns.length} entries from your ledger
            </p>
          </div>
          <SparklesIcon className="w-5 h-5 text-text-muted" />
        </div>

        {recentTxns.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-secondary">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-white/[0.04]">
                  <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">
                    Amount
                  </th>
                  <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                      {fmtFullDate(t.created_at)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          t.transaction_type === 'deduction'
                            ? 'bg-coral/15 text-coral border border-coral/25'
                            : t.transaction_type === 'recharge'
                            ? 'bg-green/15 text-green border border-green/25'
                            : t.transaction_type === 'plan_grant'
                            ? 'bg-purple/15 text-purple border border-purple/25'
                            : 'bg-blue/15 text-blue border border-blue/25'
                        }`}
                      >
                        {t.transaction_type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-text-primary">
                      {t.feature ? getFeatureLabel(t.feature) : '—'}
                    </td>
                    <td className="px-6 py-3 text-text-secondary">
                      {t.provider || '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">
                      <span
                        className={t.amount < 0 ? 'text-coral' : 'text-green'}
                      >
                        {t.amount > 0 ? '+' : ''}
                        {t.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-text-primary">
                      {t.balance_after.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      {/* Diamond Top-up Modal */}
      <BuyDiamondsModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        onSuccess={() => {
          setIsTopupOpen(false);
          load(); // Refresh all stats
        }}
      />
    </div>

  );
}

export default DiamondAnalyticsPage;
