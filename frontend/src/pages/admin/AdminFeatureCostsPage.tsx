import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ScaleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button, Input, Modal } from '../../components/ui';
import {
  adminFeatureCostsService,
  type FeatureCostListResponse,
  type FeatureCostRow,
  type FeatureCategory,
  type HistoricalAuditResponse,
  type HistoricalRow,
} from '../../services/adminFeatureCostsService';

const COLORS = {
  coral: '#E8364F',
  green: '#10B981',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  textMuted: '#6B7280',
  textSecondary: '#9CA3AF',
  textPrimary: '#F1F1F6',
};

const COST_TYPE_COLOR: Record<string, string> = {
  text: COLORS.purple,
  image: COLORS.amber,
  video: COLORS.coral,
  voice: COLORS.blue,
};

const CATEGORIES: { value: FeatureCategory | ''; label: string }[] = [
  { value: '',      label: 'All' },
  { value: 'text',  label: 'Text / LLM' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'voice', label: 'Voice' },
  { value: 'ads',   label: 'Ads' },
  { value: 'misc',  label: 'Misc' },
];

function fmtUSD(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!isFinite(n)) return '$0';
  if (n < 0.01 && n > 0) return `$${n.toFixed(6)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function gapBadge(pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: '—', color: COLORS.textMuted };
  if (pct >= -5 && pct <= 5) return { label: `${pct.toFixed(0)}%`, color: COLORS.green };
  if (pct > 5) return { label: `+${pct.toFixed(0)}%`, color: COLORS.amber };
  return { label: `${pct.toFixed(0)}%`, color: COLORS.coral };
}

interface EditState {
  feature: string;
  markup_pct: string;
  flat_override_diamonds: string; // '' means null/formula
  is_active: boolean;
  notes: string;
}

type Tab = 'live' | 'historical';

const WINDOW_OPTIONS = [7, 30, 60, 90];

export function AdminFeatureCostsPage() {
  const [tab, setTab] = useState<Tab>('live');

  // ── Live config tab state ────────────────────────────────────────
  const [data, setData] = useState<FeatureCostListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<FeatureCategory | ''>('');

  const [editRow, setEditRow] = useState<FeatureCostRow | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [previewDiamonds, setPreviewDiamonds] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendInfo, setRecommendInfo] = useState<string | null>(null);

  const [showReseedModal, setShowReseedModal] = useState(false);
  const [reseeding, setReseeding] = useState(false);

  // ── Historical tab state ─────────────────────────────────────────
  const [historical, setHistorical] = useState<HistoricalAuditResponse | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFeatureCostsService.list(category || undefined);
      setData(res);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || 'Failed to load feature costs');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (tab === 'live') load();
  }, [load, tab]);

  const loadHistorical = useCallback(async () => {
    setHistoricalLoading(true);
    setHistoricalError(null);
    try {
      const res = await adminFeatureCostsService.getHistorical(windowDays, category || undefined);
      setHistorical(res);
      setSelectedFeatures(new Set());
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setHistoricalError(e?.response?.data?.error || e?.message || 'Failed to load history');
    } finally {
      setHistoricalLoading(false);
    }
  }, [windowDays, category]);

  useEffect(() => {
    if (tab === 'historical') loadHistorical();
  }, [tab, loadHistorical]);

  // ── Edit modal handling ─────────────────────────────────────────
  const openEdit = (row: FeatureCostRow) => {
    setEditRow(row);
    setEditState({
      feature: row.feature,
      markup_pct: row.markup_pct,
      flat_override_diamonds:
        row.flat_override_diamonds !== null ? String(row.flat_override_diamonds) : '',
      is_active: row.is_active,
      notes: row.notes,
    });
    setPreviewDiamonds(row.current_diamonds);
    setRecommendInfo(null);
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditRow(null);
    setEditState(null);
    setPreviewDiamonds(null);
    setRecommendInfo(null);
  };

  const useRecommendation = async () => {
    if (!editState) return;
    setRecommendLoading(true);
    setRecommendInfo(null);
    try {
      const rec = await adminFeatureCostsService.recommendFromHistory(editState.feature, 30);
      setEditState({
        ...editState,
        flat_override_diamonds: String(rec.recommended_flat_override),
      });
      const tag = rec.fallback_used
        ? `Only ${rec.call_count} historical calls — fell back to typical-token estimate.`
        : `Based on ${rec.call_count} real calls in last 30 days · avg cost $${rec.avg_real_cost_per_call_usd}.`;
      setRecommendInfo(tag);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setRecommendInfo(e?.response?.data?.error || 'Recommendation failed.');
    } finally {
      setRecommendLoading(false);
    }
  };

  // Live preview whenever sliders change
  useEffect(() => {
    if (!editState || !editRow) return;
    let cancelled = false;

    const runPreview = async () => {
      try {
        const res = await adminFeatureCostsService.preview({
          feature: editState.feature,
          markup_pct: editState.markup_pct,
          flat_override_diamonds:
            editState.flat_override_diamonds === ''
              ? null
              : Number(editState.flat_override_diamonds),
        });
        if (!cancelled) {
          setPreviewDiamonds(res.preview_diamonds);
        }
      } catch {
        if (!cancelled) setPreviewDiamonds(null);
      }
    };

    const t = setTimeout(runPreview, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [editState, editRow]);

  const saveEdit = async () => {
    if (!editState || !editRow) return;
    setSavingEdit(true);
    try {
      await adminFeatureCostsService.update(editState.feature, {
        markup_pct: editState.markup_pct,
        flat_override_diamonds:
          editState.flat_override_diamonds === ''
            ? null
            : Number(editState.flat_override_diamonds),
        is_active: editState.is_active,
        notes: editState.notes,
      });
      await load();
      closeEdit();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'Save failed');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Historical: apply selected ──────────────────────────────────
  const applySelected = async () => {
    if (selectedFeatures.size === 0) return;
    setApplying(true);
    try {
      const res = await adminFeatureCostsService.applyRecommendations(
        Array.from(selectedFeatures),
        windowDays,
      );
      const appliedCount = res.applied.length;
      const skippedCount = res.skipped.length;
      const skippedMsg = skippedCount
        ? ` Skipped ${skippedCount} (${res.skipped.map((s) => s.feature + ':' + s.reason).join(', ')}).`
        : '';
      alert(`Applied ${appliedCount} recommendations.${skippedMsg}`);
      await loadHistorical();
      // Also refresh live config so it reflects new prices
      if (tab === 'live') await load();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const toggleFeatureSelection = (feature: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) next.delete(feature);
      else next.add(feature);
      return next;
    });
  };

  const selectAllUnderPriced = () => {
    if (!historical) return;
    const all = historical.rows.filter((r) => r.is_under_priced).map((r) => r.feature);
    setSelectedFeatures(new Set(all));
  };

  const clearSelection = () => setSelectedFeatures(new Set());

  const performReseed = async () => {
    setReseeding(true);
    try {
      const res = await adminFeatureCostsService.reseedFromCode();
      await load();
      setShowReseedModal(false);
      alert(`Reseeded ${res.reseeded_count} features from code defaults.`);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || 'Reseed failed');
    } finally {
      setReseeding(false);
    }
  };

  // ── Derived summary numbers ──────────────────────────────────────
  const summary = data?.summary;

  const totalRawUsdAcrossRows = useMemo(() => {
    if (!data) return 0;
    return data.rows.reduce((acc, r) => acc + Number(r.raw_cost_usd || 0), 0);
  }, [data]);

  if (loading && !data && tab === 'live') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-sm text-text-secondary">Loading feature cost configuration…</div>
      </div>
    );
  }
  if (error && tab === 'live') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-coral mb-2" />
        <p className="text-coral mb-4">{error}</p>
        <Button variant="secondary" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-coral">
          Admin · Feature Costs
        </span>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold font-heading text-text-primary tracking-tight">
          Per-feature diamond pricing
        </h1>
        <p className="mt-2 text-sm text-text-secondary max-w-3xl">
          Live billing reads from this table. <strong>1 diamond = $0.001 USD</strong> cost basis;
          target markup is 200% (3× cost). Set <em>Flat override</em> to charge a fixed amount, or
          leave it blank to compute from the live model rates × markup. See{' '}
          <code className="text-coral">docs/AI_COST_AUDIT.md</code> for the audit that established
          these targets.
        </p>
      </motion.header>

      {/* Tab switcher */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setTab('live')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
            tab === 'live'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Live Config
        </button>
        <button
          type="button"
          onClick={() => setTab('historical')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
            tab === 'historical'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <ClockIcon className="w-4 h-4" />
          Historical Audit
        </button>
      </div>

      {tab === 'live' && data && (
      <>
      {/* Summary cards */}
      {summary && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={ChartBarIcon}
            label="Features tracked"
            value={summary.row_count.toString()}
            subtext={`${data.categories.length} categories`}
            accent={COLORS.blue}
          />
          <StatCard
            icon={CurrencyDollarIcon}
            label="Avg raw API cost"
            value={fmtUSD(summary.avg_raw_cost_usd)}
            subtext="Per feature call (estimated)"
            accent={COLORS.amber}
          />
          <StatCard
            icon={SparklesIcon}
            label="Total current price"
            value={`${summary.total_current_diamonds.toLocaleString()} 💎`}
            subtext={`Target: ${summary.total_target_diamonds.toLocaleString()} 💎`}
            accent={COLORS.purple}
          />
          <StatCard
            icon={ScaleIcon}
            label="Avg gap vs target"
            value={`${summary.avg_gap_pct.toFixed(0)}%`}
            subtext={summary.avg_gap_pct < -25 ? 'Under-priced' : 'Near target'}
            accent={summary.avg_gap_pct < -25 ? COLORS.coral : COLORS.green}
          />
        </section>
      )}

      {/* Filters + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.value || 'all'}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                category === c.value
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowReseedModal(true)}
          leftIcon={<ArrowPathIcon className="w-4 h-4" />}
        >
          Reseed from code
        </Button>
      </div>

      {/* Main table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Feature pricing</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Total raw API cost across all listed features: {fmtUSD(totalRawUsdAcrossRows)}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/[0.04]">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider">Feature</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider">Provider / Model</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Raw $ / call</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Raw 💎</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Target 3× 💎</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Current 💎</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Gap</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const gap = gapBadge(row.gap_vs_target_pct);
                return (
                  <tr key={row.feature} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-primary">{row.feature}</span>
                        <span
                          className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded shrink-0"
                          style={{
                            background: `${COST_TYPE_COLOR[row.cost_type] || COLORS.textMuted}20`,
                            color: COST_TYPE_COLOR[row.cost_type] || COLORS.textMuted,
                          }}
                        >
                          {row.cost_type}
                        </span>
                        {!row.is_active && (
                          <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded bg-coral/15 text-coral">
                            inactive
                          </span>
                        )}
                      </div>
                      {row.notes && (
                        <div className="text-[10px] text-text-muted mt-0.5 truncate max-w-[280px]">
                          {row.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      <div className="capitalize">{row.provider || '—'}</div>
                      <div className="text-[10px] text-text-muted truncate max-w-[180px]">{row.model_used || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary text-xs">
                      {fmtUSD(row.raw_cost_usd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary text-xs">
                      {row.raw_cost_diamonds.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400 text-xs font-bold">
                      {row.target_3x_diamonds.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-primary text-sm font-bold">
                      {row.current_diamonds.toLocaleString()}
                      {row.flat_override_diamonds !== null && (
                        <div className="text-[9px] text-text-muted">flat override</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border"
                        style={{
                          color: gap.color,
                          background: `${gap.color}15`,
                          borderColor: `${gap.color}30`,
                        }}
                      >
                        {gap.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
                      >
                        <AdjustmentsHorizontalIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-text-muted">
                    No feature cost configs in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
      </>
      )}

      {tab === 'historical' && (
        <HistoricalAuditPanel
          data={historical}
          loading={historicalLoading}
          error={historicalError}
          windowDays={windowDays}
          setWindowDays={setWindowDays}
          category={category}
          setCategory={setCategory}
          selectedFeatures={selectedFeatures}
          toggleFeatureSelection={toggleFeatureSelection}
          selectAllUnderPriced={selectAllUnderPriced}
          clearSelection={clearSelection}
          applySelected={applySelected}
          applying={applying}
          refresh={loadHistorical}
        />
      )}

      {/* Edit modal */}
      <Modal
        isOpen={editRow !== null}
        onClose={closeEdit}
        size="md"
        showCloseButton={!savingEdit}
      >
        {editRow && editState && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary font-mono">
                  {editRow.feature}
                </h3>
                <p className="text-xs text-text-muted">
                  {editRow.provider || '—'} · {editRow.model_used || '—'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 mb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Raw cost</div>
                  <div className="text-sm font-mono font-bold text-text-secondary">
                    {fmtUSD(editRow.raw_cost_usd)}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    ({editRow.raw_cost_diamonds.toFixed(1)} 💎)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Target 3×</div>
                  <div className="text-sm font-mono font-bold text-amber-400">
                    {editRow.target_3x_diamonds.toLocaleString()} 💎
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Preview</div>
                  <div className="text-sm font-mono font-bold text-text-primary">
                    {previewDiamonds !== null ? `${previewDiamonds.toLocaleString()} 💎` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                  Markup percent (used when no flat override)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={5}
                    value={editState.markup_pct}
                    onChange={(e) =>
                      setEditState({ ...editState, markup_pct: e.target.value })
                    }
                    className="flex-1 accent-amber-500"
                  />
                  <Input
                    type="number"
                    value={editState.markup_pct}
                    onChange={(e) =>
                      setEditState({ ...editState, markup_pct: e.target.value })
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-text-muted">%</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  200% = 3× cost basis (target). 0% = at cost (loss). Higher = more margin.
                </p>
              </div>

              <div>
                <div className="flex items-end justify-between gap-2 mb-1.5">
                  <label className="block text-xs text-text-secondary font-medium">
                    Flat override (leave empty to use formula)
                  </label>
                  <button
                    type="button"
                    onClick={useRecommendation}
                    disabled={recommendLoading}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <LightBulbIcon className="w-3.5 h-3.5" />
                    {recommendLoading ? 'Computing…' : 'Use 30d historical recommendation'}
                  </button>
                </div>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={editState.flat_override_diamonds}
                  onChange={(e) =>
                    setEditState({ ...editState, flat_override_diamonds: e.target.value })
                  }
                  className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-coral focus:outline-none"
                />
                {recommendInfo && (
                  <div className="text-[10px] text-text-muted mt-1.5">{recommendInfo}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={editState.is_active}
                  onChange={(e) =>
                    setEditState({ ...editState, is_active: e.target.checked })
                  }
                  className="w-4 h-4 accent-coral"
                />
                <label htmlFor="is_active" className="text-xs text-text-secondary">
                  Active (uncheck to fall back to seed dict)
                </label>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                  Notes (visible only in admin UI)
                </label>
                <textarea
                  rows={2}
                  value={editState.notes}
                  onChange={(e) =>
                    setEditState({ ...editState, notes: e.target.value })
                  }
                  placeholder="e.g. Raised on 2026-05-18 to hit 3× target"
                  className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:border-coral focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="secondary" fullWidth onClick={closeEdit} disabled={savingEdit}>
                Cancel
              </Button>
              <Button fullWidth onClick={saveEdit} isLoading={savingEdit}>
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reseed confirm modal */}
      <Modal
        isOpen={showReseedModal}
        onClose={() => !reseeding && setShowReseedModal(false)}
        size="sm"
        showCloseButton={!reseeding}
      >
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-coral/20 text-coral flex items-center justify-center">
              <ArrowPathIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Reseed from code?</h3>
              <p className="text-xs text-text-muted">Resets every feature to its original value.</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Every feature&apos;s <em>flat override</em> will be reset to the value from{' '}
            <code className="text-coral">diamond_service.DIAMOND_COSTS</code>, markup will go back
            to <strong>200%</strong>, and every row will be marked active. Your current settings
            will be lost.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setShowReseedModal(false)} disabled={reseeding}>
              Cancel
            </Button>
            <Button fullWidth onClick={performReseed} isLoading={reseeding}>
              <CheckCircleIcon className="w-4 h-4 mr-1" />
              Reseed now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  accent: string;
}

function StatCard({ icon: Icon, label, value, subtext, accent }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-card p-5"
    >
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-[80px] opacity-25 pointer-events-none"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}25`, border: `1px solid ${accent}40`, color: accent }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
      </div>
      <div className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="relative mt-1.5 text-2xl md:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
        {value}
      </div>
      {subtext && <div className="relative mt-1 text-xs text-text-secondary">{subtext}</div>}
    </motion.div>
  );
}

// ─── Historical Audit Panel ──────────────────────────────────────────

interface HistoricalAuditPanelProps {
  data: HistoricalAuditResponse | null;
  loading: boolean;
  error: string | null;
  windowDays: number;
  setWindowDays: (d: number) => void;
  category: FeatureCategory | '';
  setCategory: (c: FeatureCategory | '') => void;
  selectedFeatures: Set<string>;
  toggleFeatureSelection: (feature: string) => void;
  selectAllUnderPriced: () => void;
  clearSelection: () => void;
  applySelected: () => Promise<void>;
  applying: boolean;
  refresh: () => void;
}

function HistoricalAuditPanel(props: HistoricalAuditPanelProps) {
  const {
    data, loading, error, windowDays, setWindowDays,
    category, setCategory, selectedFeatures, toggleFeatureSelection,
    selectAllUnderPriced, clearSelection, applySelected, applying, refresh,
  } = props;

  if (loading && !data) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-bg-card p-12 text-center text-sm text-text-secondary">
        Computing per-feature historical costs from <code className="text-coral">DiamondTransaction</code>…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-3xl border border-coral/30 bg-coral/[0.05] p-6 text-center">
        <ExclamationTriangleIcon className="w-8 h-8 mx-auto text-coral mb-2" />
        <p className="text-coral text-sm mb-3">{error}</p>
        <Button variant="secondary" onClick={refresh}>Try again</Button>
      </div>
    );
  }
  if (!data) return null;

  const rows = data.rows;
  const summary = data.summary;
  const margin = Number(summary.total_margin_usd);
  const isLoss = margin < 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClockIcon}
          label="Calls in window"
          value={summary.total_calls.toLocaleString()}
          subtext={`${summary.feature_count} features tracked`}
          accent={COLORS.blue}
        />
        <StatCard
          icon={CurrencyDollarIcon}
          label="Real API cost"
          value={fmtUSD(summary.total_real_cost_usd)}
          subtext="What we paid providers"
          accent={COLORS.coral}
        />
        <StatCard
          icon={SparklesIcon}
          label="Diamonds charged"
          value={`${summary.total_diamonds_charged.toLocaleString()} 💎`}
          subtext={`= ${fmtUSD(summary.total_cost_basis_charged_usd)} cost-basis`}
          accent={COLORS.purple}
        />
        <StatCard
          icon={ScaleIcon}
          label={isLoss ? 'Net loss (cost-basis)' : 'Net margin (cost-basis)'}
          value={fmtUSD(summary.total_margin_usd)}
          subtext={`${summary.under_priced_count} features under-priced`}
          accent={isLoss ? COLORS.coral : COLORS.green}
        />
      </section>

      {/* Filters & actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[11px] text-text-muted px-2">Window:</span>
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  windowDays === d
                    ? 'bg-bg-elevated text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c.value || 'all'}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  category === c.value
                    ? 'bg-bg-elevated text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={selectAllUnderPriced}>
            Select all under-priced
          </Button>
          <Button variant="secondary" size="sm" onClick={clearSelection} disabled={selectedFeatures.size === 0}>
            Clear ({selectedFeatures.size})
          </Button>
          <Button
            size="sm"
            onClick={applySelected}
            disabled={selectedFeatures.size === 0 || applying}
            isLoading={applying}
            leftIcon={<LightBulbIcon className="w-4 h-4" />}
          >
            Apply {selectedFeatures.size} selected
          </Button>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/[0.08] bg-bg-card overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              Per-feature historical breakdown
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Last {windowDays} days · {data.window.from.slice(0, 10)} → {data.window.to.slice(0, 10)} ·
              Features with fewer than {data.min_calls_for_recommendation} calls are flagged "low confidence"
              and skipped from bulk-apply.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-white/[0.04]">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider">Feature</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Calls</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Avg cost/call</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Real cost</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Diamonds charged</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Margin</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Current 💎</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Rec'd 💎</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <HistoricalRowView
                  key={row.feature}
                  row={row}
                  selected={selectedFeatures.has(row.feature)}
                  onToggle={() => toggleFeatureSelection(row.feature)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-text-muted">
                    No DiamondTransaction history in this window
                    {category ? ` for category "${category}"` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

interface HistoricalRowViewProps {
  row: HistoricalRow;
  selected: boolean;
  onToggle: () => void;
}

function HistoricalRowView({ row, selected, onToggle }: HistoricalRowViewProps) {
  const marginNum = Number(row.margin_usd);
  const marginColor = marginNum < 0 ? COLORS.coral : COLORS.green;

  const gap = row.gap_per_call_diamonds;
  const gapColor =
    Math.abs(gap) <= 1 ? COLORS.green : gap > 0 ? COLORS.amber : COLORS.coral;

  return (
    <tr className={`border-t border-white/[0.04] hover:bg-white/[0.02] ${row.low_confidence ? 'opacity-60' : ''}`}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={row.low_confidence}
          className="w-4 h-4 accent-amber-500 disabled:opacity-40"
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-text-primary">{row.feature}</span>
          <span
            className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded shrink-0"
            style={{
              background: `${COST_TYPE_COLOR[row.cost_type] || COLORS.textMuted}20`,
              color: COST_TYPE_COLOR[row.cost_type] || COLORS.textMuted,
            }}
          >
            {row.cost_type}
          </span>
          {row.low_confidence && (
            <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/15 text-amber-400">
              low confidence
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted mt-0.5 truncate max-w-[260px]">
          {row.dominant_provider || '—'}
          {row.avg_input_tokens > 0 &&
            ` · avg ${row.avg_input_tokens.toFixed(0)} in / ${row.avg_output_tokens.toFixed(0)} out`}
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono text-text-secondary text-xs">
        {row.call_count.toLocaleString()}
      </td>
      <td className="px-3 py-3 text-right font-mono text-text-secondary text-xs">
        {fmtUSD(row.avg_real_cost_per_call_usd)}
      </td>
      <td className="px-3 py-3 text-right font-mono text-text-secondary text-xs">
        {fmtUSD(row.real_cost_usd)}
      </td>
      <td className="px-3 py-3 text-right font-mono text-text-secondary text-xs">
        {row.diamonds_charged_total.toLocaleString()}
        <div className="text-[9px] text-text-muted">{fmtUSD(row.cost_basis_charged_usd)}</div>
      </td>
      <td
        className="px-3 py-3 text-right font-mono text-xs font-bold"
        style={{ color: marginColor }}
      >
        {fmtUSD(row.margin_usd)}
      </td>
      <td className="px-3 py-3 text-right font-mono text-text-primary text-sm font-bold">
        {row.current_diamonds_per_call.toLocaleString()}
      </td>
      <td className="px-3 py-3 text-right font-mono text-amber-400 text-sm font-bold">
        {row.recommended_flat_override.toLocaleString()}
      </td>
      <td className="px-3 py-3 text-right">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border"
          style={{
            color: gapColor,
            background: `${gapColor}15`,
            borderColor: `${gapColor}30`,
          }}
        >
          {gap > 0 ? '+' : ''}{gap.toLocaleString()}
        </span>
      </td>
    </tr>
  );
}

export default AdminFeatureCostsPage;
