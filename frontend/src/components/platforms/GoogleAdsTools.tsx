import { useState } from 'react';
import {
  MagnifyingGlassIcon, LightBulbIcon, ClockIcon, ChartPieIcon,
  BanknotesIcon, TagIcon, UserGroupIcon, BeakerIcon,
} from '@heroicons/react/24/outline';
import googleAdsService from '../../services/googleAdsService';
import type { Experiment, ExperimentResultRow } from '../../services/googleAdsService';

/**
 * Account-level Google Ads tools — everything that doesn't belong to a single
 * campaign's create form: Keyword Planner, Recommendations, Change history,
 * Shared budgets, Labels, Customer Match upload. Each is a collapsible panel
 * that loads on demand. Requires a connected Google ad account id.
 */
export default function GoogleAdsTools({
  adAccountId,
  campaigns = [],
}: {
  adAccountId: number;
  campaigns?: Array<{ id: number; name: string }>;
}) {
  const [error, setError] = useState('');

  // Keyword Planner
  const [kpSeeds, setKpSeeds] = useState('');
  const [kpRows, setKpRows] = useState<Array<{ text: string; avg_monthly_searches: number; competition: string; low_bid_micros: number; high_bid_micros: number }> | null>(null);
  const [kpLoading, setKpLoading] = useState(false);

  // Recommendations
  const [recs, setRecs] = useState<Array<{ type: string; campaign: string; resource_name: string }> | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  // Change history
  const [history, setHistory] = useState<Array<{ date_time: string; resource_type: string; operation: string; user_email: string; client_type: string }> | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  // Shared budgets
  const [budgets, setBudgets] = useState<Array<{ id: string; name: string; daily_usd: number }> | null>(null);
  const [newBudget, setNewBudget] = useState({ name: '', daily_usd: '10' });

  // Labels
  const [labels, setLabels] = useState<Array<{ id: string; name: string; color: string }> | null>(null);
  const [newLabel, setNewLabel] = useState('');

  // Customer Match
  const [cmName, setCmName] = useState('');
  const [cmEmails, setCmEmails] = useState('');
  const [cmMsg, setCmMsg] = useState('');

  // Experiments (A/B at campaign level)
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [expBase, setExpBase] = useState('');
  const [expName, setExpName] = useState('');
  const [expSplit, setExpSplit] = useState('50');
  const [expBusy, setExpBusy] = useState(false);
  const [expMsg, setExpMsg] = useState('');
  const [expResults, setExpResults] = useState<Record<string, ExperimentResultRow[]>>({});

  const err = (e: unknown, f: string) => setError(googleAdsService.readError(e, f));

  const runKeywordPlanner = async () => {
    setKpLoading(true); setError('');
    try {
      const seeds = kpSeeds.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      const { ideas } = await googleAdsService.keywordIdeas({ ad_account_id: adAccountId, seeds, geo_codes: ['US'] });
      setKpRows(ideas);
    } catch (e) { err(e, 'Keyword Planner failed.'); } finally { setKpLoading(false); }
  };
  const loadRecs = async () => {
    setRecLoading(true); setError('');
    try { setRecs((await googleAdsService.listRecommendations(adAccountId)).recommendations); }
    catch (e) { err(e, 'Could not load recommendations.'); } finally { setRecLoading(false); }
  };
  const applyRec = async (rn: string) => {
    try { await googleAdsService.applyRecommendation(adAccountId, rn, 'apply'); await loadRecs(); }
    catch (e) { err(e, 'Could not apply recommendation.'); }
  };
  const loadHistory = async () => {
    setHistLoading(true); setError('');
    try { setHistory((await googleAdsService.changeHistory(adAccountId, 14)).events); }
    catch (e) { err(e, 'Could not load change history.'); } finally { setHistLoading(false); }
  };
  const loadBudgets = async () => {
    try { setBudgets((await googleAdsService.listSharedBudgets(adAccountId)).budgets); }
    catch (e) { err(e, 'Could not load shared budgets.'); }
  };
  const createBudget = async () => {
    try {
      await googleAdsService.createSharedBudget({ ad_account_id: adAccountId, name: newBudget.name || 'Shared budget', daily_usd: Number(newBudget.daily_usd) || 10 });
      setNewBudget({ name: '', daily_usd: '10' }); await loadBudgets();
    } catch (e) { err(e, 'Could not create shared budget.'); }
  };
  const loadLabels = async () => {
    try { setLabels((await googleAdsService.listLabels(adAccountId)).labels); }
    catch (e) { err(e, 'Could not load labels.'); }
  };
  const createLabel = async () => {
    try { await googleAdsService.createLabel({ ad_account_id: adAccountId, name: newLabel || 'Label' }); setNewLabel(''); await loadLabels(); }
    catch (e) { err(e, 'Could not create label.'); }
  };
  const uploadCustomerMatch = async () => {
    setCmMsg(''); setError('');
    try {
      const emails = cmEmails.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      const res = await googleAdsService.createCustomerMatch({ ad_account_id: adAccountId, name: cmName || 'CRM list', emails });
      setCmMsg(`✓ List created (${res.uploaded} contacts queued). It becomes targetable once Google processes it.`);
      setCmName(''); setCmEmails('');
    } catch (e) { err(e, 'Customer Match upload failed.'); }
  };

  const loadExperiments = async () => {
    try { setExperiments((await googleAdsService.listExperiments(adAccountId)).experiments); }
    catch (e) { err(e, 'Could not load experiments.'); }
  };
  const createExperiment = async () => {
    setExpMsg(''); setError('');
    if (!expBase) { setError('Pick a base campaign to experiment on.'); return; }
    setExpBusy(true);
    try {
      const res = await googleAdsService.createExperiment({
        campaign_pk: Number(expBase),
        name: expName || 'Experiment',
        traffic_split: Number(expSplit) || 50,
      });
      setExpMsg(`✓ Experiment created (trial campaign #${res.trial_campaign_id}). Edit the trial in "Manage", then Start it below.`);
      setExpName('');
      await loadExperiments();
    } catch (e) { err(e, 'Could not create experiment.'); } finally { setExpBusy(false); }
  };
  const experimentAction = async (
    id: string,
    action: 'schedule' | 'end' | 'promote' | 'graduate',
  ) => {
    setExpMsg(''); setError('');
    let budget_id: string | undefined;
    if (action === 'graduate') {
      const budgets = (await googleAdsService.listSharedBudgets(adAccountId).catch(() => ({ budgets: [] }))).budgets;
      // graduate keeps the variant as a standalone campaign — it needs a budget.
      budget_id = budgets[0]?.id;
      if (!budget_id) { setError('Create a shared budget first — graduate needs a budget.'); return; }
    }
    try {
      await googleAdsService.experimentAction(id, { ad_account_id: adAccountId, action, budget_id });
      setExpMsg(`✓ ${action} done.`);
      await loadExperiments();
    } catch (e) { err(e, `Could not ${action} experiment.`); }
  };
  const loadExperimentResults = async (id: string) => {
    try {
      const { results } = await googleAdsService.getExperimentResults(adAccountId, id);
      setExpResults((prev) => ({ ...prev, [id]: results }));
    } catch (e) { err(e, 'Could not load experiment results.'); }
  };

  const dollarsFromMicros = (m: number) => `$${(m / 1_000_000).toFixed(2)}`;
  const panel = 'bg-slate-800/50 border border-slate-700 rounded-xl p-4';
  const inp = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white';

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">{error}</div>}

      {/* Keyword Planner */}
      <div className={panel}>
        <details>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <MagnifyingGlassIcon className="w-4 h-4 text-[#1a73e8]" /> Keyword Planner (search volume)
          </summary>
          <div className="mt-3 space-y-2">
            <textarea value={kpSeeds} onChange={(e) => setKpSeeds(e.target.value)} rows={2}
              className={`w-full ${inp}`} placeholder={'running shoes\nmarathon gear'} />
            <button onClick={runKeywordPlanner} disabled={kpLoading}
              className="bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-3 py-1 rounded text-xs">
              {kpLoading ? 'Searching…' : 'Get ideas'}
            </button>
            {kpRows && (kpRows.length === 0 ? <p className="text-slate-500 text-xs">No ideas returned.</p> : (
              <table className="w-full text-xs text-slate-300 mt-2">
                <thead className="text-slate-500"><tr><th className="text-left">Keyword</th><th className="text-right">Avg/mo</th><th className="text-left pl-3">Comp.</th><th className="text-right">Top bid</th></tr></thead>
                <tbody>{kpRows.map((r, i) => (
                  <tr key={i}><td className="truncate max-w-[180px]">{r.text}</td>
                    <td className="text-right">{r.avg_monthly_searches.toLocaleString()}</td>
                    <td className="pl-3">{r.competition}</td>
                    <td className="text-right">{dollarsFromMicros(r.high_bid_micros)}</td></tr>
                ))}</tbody>
              </table>
            ))}
          </div>
        </details>
      </div>

      {/* Recommendations */}
      <div className={panel}>
        <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !recs) loadRecs(); }}>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <LightBulbIcon className="w-4 h-4 text-amber-400" /> Recommendations
          </summary>
          <div className="mt-3 space-y-2">
            {recLoading ? <p className="text-slate-500 text-xs">Loading…</p>
              : recs && (recs.length === 0 ? <p className="text-slate-500 text-xs">No recommendations right now.</p> : (
                recs.map((r) => (
                  <div key={r.resource_name} className="flex items-center justify-between bg-slate-900/50 rounded px-2 py-1.5 text-xs">
                    <span className="text-slate-300">{r.type}</span>
                    <button onClick={() => applyRec(r.resource_name)} className="text-[#8ab4f8] hover:underline">Apply</button>
                  </div>
                ))
              ))}
          </div>
        </details>
      </div>

      {/* Change history */}
      <div className={panel}>
        <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !history) loadHistory(); }}>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-slate-400" /> Change history (last 14 days)
          </summary>
          <div className="mt-3">
            {histLoading ? <p className="text-slate-500 text-xs">Loading…</p>
              : history && (history.length === 0 ? <p className="text-slate-500 text-xs">No changes.</p> : (
                <table className="w-full text-xs text-slate-300">
                  <thead className="text-slate-500"><tr><th className="text-left">When</th><th className="text-left">What</th><th className="text-left">Op</th><th className="text-left">By</th></tr></thead>
                  <tbody>{history.slice(0, 30).map((h, i) => (
                    <tr key={i}><td className="whitespace-nowrap">{h.date_time.slice(0, 16)}</td>
                      <td>{h.resource_type}</td><td>{h.operation}</td>
                      <td className="truncate max-w-[140px]">{h.user_email}</td></tr>
                  ))}</tbody>
                </table>
              ))}
          </div>
        </details>
      </div>

      {/* Shared budgets */}
      <div className={panel}>
        <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !budgets) loadBudgets(); }}>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <BanknotesIcon className="w-4 h-4 text-emerald-400" /> Shared budgets
          </summary>
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-end">
              <input value={newBudget.name} onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })} placeholder="Name" className={`flex-1 ${inp}`} />
              <input type="number" value={newBudget.daily_usd} onChange={(e) => setNewBudget({ ...newBudget, daily_usd: e.target.value })} placeholder="USD/day" className={`w-24 ${inp}`} />
              <button onClick={createBudget} className="bg-[#1a73e8] hover:bg-[#1765cc] text-white px-3 py-1.5 rounded text-xs">Create</button>
            </div>
            {budgets?.map((b) => (
              <div key={b.id} className="flex justify-between bg-slate-900/50 rounded px-2 py-1.5 text-xs text-slate-300">
                <span>{b.name}</span><span>${b.daily_usd.toFixed(2)}/day</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Labels */}
      <div className={panel}>
        <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !labels) loadLabels(); }}>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-purple-400" /> Labels
          </summary>
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New label name" className={`flex-1 ${inp}`} />
              <button onClick={createLabel} className="bg-[#1a73e8] hover:bg-[#1765cc] text-white px-3 py-1.5 rounded text-xs">Create</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {labels?.map((l) => (
                <span key={l.id} className="text-[11px] rounded-full px-2 py-0.5 border border-slate-600 text-slate-300">{l.name}</span>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Customer Match */}
      <div className={panel}>
        <details>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4 text-[#1a73e8]" /> Customer Match (upload CRM emails)
          </summary>
          <div className="mt-3 space-y-2">
            <input value={cmName} onChange={(e) => setCmName(e.target.value)} placeholder="List name" className={`w-full ${inp}`} />
            <textarea value={cmEmails} onChange={(e) => setCmEmails(e.target.value)} rows={3}
              className={`w-full ${inp}`} placeholder={'jane@example.com\njohn@example.com'} />
            <button onClick={uploadCustomerMatch} className="bg-[#1a73e8] hover:bg-[#1765cc] text-white px-3 py-1 rounded text-xs">Upload &amp; create list</button>
            {cmMsg && <p className="text-emerald-400 text-xs">{cmMsg}</p>}
            <p className="text-[10px] text-slate-500">Emails are hashed (SHA-256) before upload, per Google's requirement.</p>
          </div>
        </details>
      </div>

      {/* Experiments (A/B at campaign level) */}
      <div className={panel}>
        <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !experiments) loadExperiments(); }}>
          <summary className="text-white text-sm font-medium cursor-pointer flex items-center gap-2">
            <BeakerIcon className="w-4 h-4 text-cyan-400" /> Experiments (A/B test a campaign)
          </summary>
          <div className="mt-3 space-y-3">
            {/* Create */}
            <div className="space-y-2 bg-slate-900/40 rounded-lg p-2.5">
              <p className="text-[11px] text-slate-400">
                Pick a base campaign — Google clones it into a trial variant and splits live traffic between them.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <select value={expBase} onChange={(e) => setExpBase(e.target.value)} className={`flex-1 min-w-[160px] ${inp}`}>
                  <option value="">Base campaign…</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input value={expName} onChange={(e) => setExpName(e.target.value)} placeholder="Experiment name" className={`flex-1 min-w-[140px] ${inp}`} />
                <div className="flex items-center gap-1">
                  <input type="number" min={1} max={99} value={expSplit} onChange={(e) => setExpSplit(e.target.value)} className={`w-16 ${inp}`} />
                  <span className="text-[11px] text-slate-500">% to variant</span>
                </div>
                <button onClick={createExperiment} disabled={expBusy}
                  className="bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs">
                  {expBusy ? 'Creating…' : 'Create'}
                </button>
              </div>
              {expMsg && <p className="text-emerald-400 text-xs">{expMsg}</p>}
            </div>

            {/* List */}
            {experiments && (experiments.length === 0 ? <p className="text-slate-500 text-xs">No experiments yet.</p> : (
              <div className="space-y-2">
                {experiments.map((x) => (
                  <div key={x.id} className="bg-slate-900/50 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-slate-200 font-medium">{x.name}</span>
                        <span className="ml-2 text-[10px] rounded-full px-2 py-0.5 border border-slate-600 text-slate-400">{x.status}</span>
                      </div>
                      <div className="flex gap-2">
                        {x.status === 'SETUP' && (
                          <button onClick={() => experimentAction(x.id, 'schedule')} className="text-emerald-400 hover:underline">Start</button>
                        )}
                        {(x.status === 'RUNNING' || x.status === 'HALTED' || x.status === 'INITIATED') && (
                          <>
                            <button onClick={() => experimentAction(x.id, 'promote')} className="text-[#8ab4f8] hover:underline">Promote</button>
                            <button onClick={() => experimentAction(x.id, 'graduate')} className="text-purple-300 hover:underline">Graduate</button>
                            <button onClick={() => experimentAction(x.id, 'end')} className="text-red-400 hover:underline">End</button>
                          </>
                        )}
                        <button onClick={() => loadExperimentResults(x.id)} className="text-slate-400 hover:underline">Results</button>
                      </div>
                    </div>
                    {x.arms.length > 0 && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        {x.arms.map((a) => `${a.control ? 'Control' : 'Variant'} ${a.traffic_split}%`).join('  ·  ')}
                      </div>
                    )}
                    {expResults[x.id] && (
                      <table className="w-full text-[11px] text-slate-300 mt-2">
                        <thead className="text-slate-500"><tr>
                          <th className="text-left">Arm</th><th className="text-right">Impr.</th>
                          <th className="text-right">Clicks</th><th className="text-right">CTR</th>
                          <th className="text-right">Conv.</th><th className="text-right">Cost</th>
                        </tr></thead>
                        <tbody>{expResults[x.id].map((r, i) => (
                          <tr key={i}>
                            <td>{r.control ? 'Control' : 'Variant'}</td>
                            <td className="text-right">{r.impressions.toLocaleString()}</td>
                            <td className="text-right">{r.clicks.toLocaleString()}</td>
                            <td className="text-right">{(r.ctr * 100).toFixed(2)}%</td>
                            <td className="text-right">{r.conversions.toFixed(1)}</td>
                            <td className="text-right">{dollarsFromMicros(r.cost_micros)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      </div>

      <p className="text-[10px] text-slate-500 flex items-center gap-1">
        <ChartPieIcon className="w-3 h-3" /> Segment breakdowns (device/geo/hour) are available per campaign in the campaign list.
      </p>
    </div>
  );
}
