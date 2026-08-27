/**
 * AccountInsightsPanel
 * ====================
 * Account-level rolled-up KPIs + AI/heuristic recommendations for a Meta ad
 * account. If no adAccountId is passed, it loads accounts and uses the first
 * Meta one. Backend: GET /ads/meta/account-summary/ and /ads/meta/recommendations/.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ChartBarIcon,
  BanknotesIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  UserGroupIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  adsService,
  type AccountSummary,
  type AccountRecommendation,
} from '../../services/adsService';
import { extractApiError } from '../../utils/extractApiError';
import { HelpButton } from '../ui';

const SEVERITY: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  high:     { color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: ExclamationTriangleIcon },
  critical: { color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: ExclamationTriangleIcon },
  warning:  { color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: ExclamationTriangleIcon },
  medium:   { color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: ExclamationTriangleIcon },
  low:      { color: 'text-blue-300',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: InformationCircleIcon },
  info:     { color: 'text-blue-300',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: InformationCircleIcon },
  success:  { color: 'text-green-300',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: CheckCircleIcon },
};

function severityCfg(s: string) {
  return SEVERITY[(s || '').toLowerCase()] ?? SEVERITY.info;
}

export function AccountInsightsPanel({ adAccountId }: { adAccountId?: number }) {
  const [resolvedId, setResolvedId] = useState<number | null>(adAccountId ?? null);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [recs, setRecs] = useState<AccountRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve an ad account id when none was provided (use the first Meta account).
  useEffect(() => {
    if (adAccountId != null) { setResolvedId(adAccountId); return; }
    let cancelled = false;
    adsService.listAdAccounts()
      .then((r) => {
        if (cancelled) return;
        const meta = (r.accounts || []).find((a) => a.provider === 'meta');
        setResolvedId(meta ? meta.id : null);
        if (!meta) { setError('No Meta ad account connected.'); setLoading(false); }
      })
      .catch(() => { if (!cancelled) { setError('Could not load ad accounts.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [adAccountId]);

  const load = useCallback(async () => {
    if (resolvedId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [sum, rec] = await Promise.all([
        adsService.getAccountSummary({ ad_account_id: resolvedId, date_preset: 'last_7d' }),
        adsService.getRecommendations(resolvedId),
      ]);
      setSummary(sum);
      setRecs(rec.recommendations || []);
    } catch (err: unknown) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { if (resolvedId != null) load(); }, [resolvedId, load]);

  const kpis = summary ? [
    { label: 'Spend',        value: `$${summary.spend.toFixed(2)}`,             icon: BanknotesIcon,        color: 'text-coral' },
    { label: 'Impressions',  value: summary.impressions.toLocaleString(),        icon: EyeIcon,              color: 'text-blue-400' },
    { label: 'Clicks',       value: summary.clicks.toLocaleString(),             icon: CursorArrowRaysIcon,  color: 'text-green-400' },
    { label: 'CTR',          value: `${summary.ctr.toFixed(2)}%`,                icon: ChartBarIcon,         color: 'text-purple-400' },
    { label: 'CPC',          value: `$${summary.cpc.toFixed(2)}`,                icon: BanknotesIcon,        color: 'text-amber-400' },
    { label: 'Reach',        value: summary.reach.toLocaleString(),              icon: UserGroupIcon,        color: 'text-cyan-400' },
    { label: 'Conversions',  value: summary.conversions.toLocaleString(),        icon: SparklesIcon,         color: 'text-pink-400' },
    { label: 'Active',       value: summary.active_campaigns,                    icon: CheckCircleIcon,      color: 'text-green-400' },
    { label: 'Paused',       value: summary.paused_campaigns,                    icon: ChartBarIcon,         color: 'text-yellow-400' },
    { label: 'Total',        value: summary.total_campaigns,                     icon: ChartBarIcon,         color: 'text-text-secondary' },
  ] : [];

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ChartBarIcon className="w-4 h-4 text-purple-300" />
        <h4 className="text-sm font-bold text-text-primary">Account overview</h4>
        <span className="text-[10px] text-text-muted">· last 7 days</span>
        <div className="ml-auto">
          <HelpButton
            title="Account overview"
            body={<>The <strong>last 7 days</strong> of results for this ad account, read
              from Meta — what you <strong>spent</strong>, how many people saw and clicked
              your ads, and how many campaigns are running.</>}
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 text-red-300 text-xs">{error}</div>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-[#1A1A2E] rounded-xl p-3 text-center">
                <kpi.icon className={`w-4 h-4 ${kpi.color} mx-auto mb-1`} />
                <p className="text-base font-bold text-text-primary">{kpi.value}</p>
                <p className="text-[10px] text-text-muted">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5 text-purple-300" /> Recommendations
              <span className="ml-auto">
                <HelpButton
                  title="Recommendations"
                  body={<>Suggestions based on <strong>how your ads actually performed</strong> —
                    for example when the same people are seeing an ad too often, or clicks
                    are falling.</>}
                />
              </span>
            </p>
            {recs.length === 0 ? (
              <p className="text-xs text-text-muted">No recommendations right now.</p>
            ) : (
              <ul className="space-y-2">
                {recs.map((r, i) => {
                  const cfg = severityCfg(r.severity);
                  return (
                    <li key={i} className={`p-2.5 rounded-lg border ${cfg.bg} ${cfg.border} flex items-start gap-2`}>
                      <cfg.icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${cfg.color}`}>{r.title}</p>
                        <p className="text-[11px] text-text-secondary mt-0.5">{r.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        !error && <p className="text-xs text-text-muted">No account data.</p>
      )}
    </div>
  );
}

export default AccountInsightsPanel;
