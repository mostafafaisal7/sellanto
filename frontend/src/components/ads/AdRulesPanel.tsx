/**
 * AdRulesPanel
 * ============
 * List + create + toggle + delete automation rules for a campaign
 * (auto-pause / notify / budget changes when a metric crosses a threshold).
 * Backend: /ads/rules/ (AdRuleListCreateView / AdRuleDetailView).
 */
import { useState, useEffect, useCallback } from 'react';
import { BoltIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { adsService, type AdRule } from '../../services/adsService';

const METRICS: AdRule['metric'][] = ['spend', 'cpc', 'ctr', 'conversions', 'cpa'];
const OPERATORS: { value: AdRule['operator']; label: string }[] = [
  { value: 'gt', label: '>' }, { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' }, { value: 'lte', label: '≤' },
];
const ACTIONS: { value: AdRule['action']; label: string }[] = [
  { value: 'pause', label: 'Pause campaign' },
  { value: 'notify', label: 'Notify me' },
  { value: 'increase_budget', label: 'Increase budget' },
  { value: 'decrease_budget', label: 'Decrease budget' },
];

export function AdRulesPanel({ campaignId }: { campaignId: number }) {
  const [rules, setRules] = useState<AdRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [metric, setMetric] = useState<AdRule['metric']>('spend');
  const [operator, setOperator] = useState<AdRule['operator']>('gt');
  const [threshold, setThreshold] = useState('');
  const [action, setAction] = useState<AdRule['action']>('pause');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adsService.listRules(campaignId);
      setRules(r.rules || []);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const t = parseFloat(threshold);
    if (Number.isNaN(t)) return;
    setSaving(true);
    try {
      await adsService.createRule({ campaign_id: campaignId, metric, operator, threshold: t, action });
      setThreshold('');
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: AdRule) => {
    const updated = await adsService.updateRule(r.id, { is_active: !r.is_active });
    setRules((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
  };

  const remove = async (r: AdRule) => {
    if (!window.confirm('Delete this rule?')) return;
    await adsService.deleteRule(r.id);
    setRules((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BoltIcon className="w-4 h-4 text-amber-300" />
          <h4 className="text-sm font-bold text-text-primary">Automation rules</h4>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200">
          <PlusIcon className="w-3.5 h-3.5" /> Add rule
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 rounded-lg bg-dark-900/60 border border-white/10 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <select value={metric} onChange={(e) => setMetric(e.target.value as AdRule['metric'])}
              className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none">
              {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={operator} onChange={(e) => setOperator(e.target.value as AdRule['operator'])}
              className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none">
              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="value"
              className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none" />
          </div>
          <select value={action} onChange={(e) => setAction(e.target.value as AdRule['action'])}
            className="w-full bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none">
            {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <button onClick={create} disabled={saving || !threshold}
            className="w-full py-1.5 rounded-lg bg-purple-500/20 text-purple-200 text-xs font-semibold hover:bg-purple-500/30 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create rule'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-text-muted">No rules yet. Add one to auto-manage this campaign.</p>
      ) : (
        <ul className="space-y-1.5">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-dark-900/60">
              <span className="text-text-secondary">
                If <b className="text-text-primary">{r.metric}</b> {OPERATORS.find((o) => o.value === r.operator)?.label} {r.threshold} → <b className="text-text-primary">{ACTIONS.find((a) => a.value === r.action)?.label}</b>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(r)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.is_active ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-text-muted'}`}>
                  {r.is_active ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => remove(r)} className="text-red-400 hover:text-red-300">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AdRulesPanel;
