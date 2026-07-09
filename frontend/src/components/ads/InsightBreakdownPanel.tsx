/**
 * InsightBreakdownPanel
 * =====================
 * Segmented performance for a campaign — pick a dimension (age / gender /
 * placement / region / device) and see impressions, clicks, spend, CTR per
 * segment. Backend: GET /ads/campaigns/{id}/breakdown/.
 */
import { useState, useEffect, useCallback } from 'react';
import { ChartPieIcon } from '@heroicons/react/24/outline';
import { adsService, type BreakdownDimension, type BreakdownRow } from '../../services/adsService';

const DIMENSIONS: { value: BreakdownDimension; label: string; field: keyof BreakdownRow | (keyof BreakdownRow)[] }[] = [
  { value: 'age', label: 'Age', field: 'age' },
  { value: 'gender', label: 'Gender', field: 'gender' },
  { value: 'age,gender', label: 'Age + Gender', field: ['age', 'gender'] },
  { value: 'publisher_platform', label: 'Placement', field: 'publisher_platform' },
  { value: 'region', label: 'Region', field: 'region' },
  { value: 'country', label: 'Country', field: 'country' },
  { value: 'impression_device', label: 'Device', field: 'impression_device' },
  { value: 'device_platform', label: 'Device platform', field: 'device_platform' },
];

// Compose a row's dimension label from one or more breakdown fields.
function rowLabel(r: BreakdownRow, field: keyof BreakdownRow | (keyof BreakdownRow)[]): string {
  const fields = Array.isArray(field) ? field : [field];
  const parts = fields.map((f) => String(r[f] ?? '')).filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export function InsightBreakdownPanel({ campaignId }: { campaignId: number }) {
  const [dimension, setDimension] = useState<BreakdownDimension>('age');
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const active = DIMENSIONS.find((d) => d.value === dimension) ?? DIMENSIONS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adsService.getBreakdown(campaignId, dimension);
      setRows(r.rows || []);
    } catch {
      setError('Could not load this breakdown.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, dimension]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ChartPieIcon className="w-4 h-4 text-blue-300" />
          <h4 className="text-sm font-bold text-text-primary">Breakdown</h4>
        </div>
      </div>

      {/* Dimension toggles */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {DIMENSIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDimension(d.value)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              dimension === d.value
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 text-red-300 text-xs">{error}</div>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-text-muted">No breakdown data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted border-b border-white/10">
                <th className="text-left font-semibold py-1.5 pr-2 capitalize">{active.label}</th>
                <th className="text-right font-semibold py-1.5 px-2">Impressions</th>
                <th className="text-right font-semibold py-1.5 px-2">Reach</th>
                <th className="text-right font-semibold py-1.5 px-2">Clicks</th>
                <th className="text-right font-semibold py-1.5 px-2">Spend</th>
                <th className="text-right font-semibold py-1.5 px-2">CTR</th>
                <th className="text-right font-semibold py-1.5 px-2">CPC</th>
                <th className="text-right font-semibold py-1.5 px-2">CPM</th>
                <th className="text-right font-semibold py-1.5 pl-2">Freq.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const label = rowLabel(r, active.field);
                return (
                  <tr key={`${label}-${i}`} className="border-b border-white/5 last:border-0">
                    <td className="text-text-primary py-1.5 pr-2 capitalize whitespace-nowrap">{label}</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">{num(r.impressions).toLocaleString()}</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">{num(r.reach).toLocaleString()}</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">{num(r.clicks).toLocaleString()}</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">${num(r.spend).toFixed(2)}</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">{num(r.ctr).toFixed(2)}%</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">${num(r.cpc).toFixed(2)}</td>
                    <td className="text-right text-text-secondary py-1.5 px-2">${num(r.cpm).toFixed(2)}</td>
                    <td className="text-right text-text-secondary py-1.5 pl-2">{num(r.frequency).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default InsightBreakdownPanel;
