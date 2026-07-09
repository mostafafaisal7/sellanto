/**
 * CreateCampaignModal
 * ===================
 * Create a from-scratch Meta link/website campaign (objective picker +
 * creative + targeting). Calls adsService.createMetaCampaign
 * → POST /ads/meta/campaigns/create/.
 *
 * Reuses the sandbox/live guard pattern: LIVE accounts require confirming
 * "Yes, spend real money" (backend returns 409 requires_confirmation).
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, MegaphoneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { adsService, type AdAccount, type AdCampaign } from '../../services/adsService';
import { extractApiError } from '../../utils/extractApiError';
import { TargetingBuilder, emptyTargeting, type TargetingValue } from './TargetingBuilder';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (c: AdCampaign) => void;
}

const OBJECTIVES: { value: 'awareness' | 'traffic' | 'engagement' | 'leads' | 'sales'; label: string; hint: string }[] = [
  { value: 'awareness',  label: 'Awareness',  hint: 'Reach the most people' },
  { value: 'traffic',    label: 'Traffic',    hint: 'Send clicks to a link' },
  { value: 'engagement', label: 'Engagement', hint: 'Likes, comments, shares' },
  { value: 'leads',      label: 'Leads',      hint: 'Collect sign-ups' },
  { value: 'sales',      label: 'Sales',      hint: 'Drive purchases' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'BD', name: 'Bangladesh' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
];

const CTA_OPTIONS: { value: string; label: string }[] = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'BOOK_TRAVEL', label: 'Book Now' },
  { value: 'CONTACT_US', label: 'Contact Us' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'GET_OFFER', label: 'Get Offer' },
  { value: 'SUBSCRIBE', label: 'Subscribe' },
  { value: 'NO_BUTTON', label: 'No Button' },
];

const OBJECTIVE_VALUES = ['awareness', 'traffic', 'engagement', 'leads', 'sales'] as const;
type ObjectiveValue = typeof OBJECTIVE_VALUES[number];

// Map an AI-suggested objective (which may be a Meta ODAX constant or free text)
// onto our five supported objective values.
function normalizeObjective(raw: string | undefined): ObjectiveValue | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (OBJECTIVE_VALUES.includes(v as ObjectiveValue)) return v as ObjectiveValue;
  if (v.includes('aware') || v.includes('reach')) return 'awareness';
  if (v.includes('traffic') || v.includes('link_click')) return 'traffic';
  if (v.includes('engage')) return 'engagement';
  if (v.includes('lead')) return 'leads';
  if (v.includes('sale') || v.includes('conversion') || v.includes('purchase')) return 'sales';
  return null;
}

export function CreateCampaignModal({ isOpen, onClose, onSuccess }: Props) {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adAccountId, setAdAccountId] = useState<number | null>(null);
  const [objective, setObjective] = useState<typeof OBJECTIVES[number]['value']>('traffic');
  const [name, setName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [message, setMessage] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [cta, setCta] = useState('LEARN_MORE');
  const [displayLink, setDisplayLink] = useState('');
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState('2.00');
  const [durationDays, setDurationDays] = useState('7');
  const [country, setCountry] = useState('US');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');
  const [activate, setActivate] = useState(false);

  // Advanced targeting (interests + placements + geo search) — optional, off by
  // default. When opened, it supersedes the basic country/age/gender inputs.
  const [advancedTargeting, setAdvancedTargeting] = useState(false);
  const [targeting, setTargeting] = useState<TargetingValue>(emptyTargeting('US'));

  // AI suggest
  const [suggestTopic, setSuggestTopic] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [liveConfirm, setLiveConfirm] = useState<{ detail: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setLiveConfirm(null);
    adsService.listAdAccounts()
      .then((r) => setAdAccounts(r.accounts || []))
      .catch(() => setAdAccounts([]));
  }, [isOpen]);

  const selected = adAccounts.find((a) => a.id === adAccountId);

  const runSuggest = async () => {
    setSuggesting(true);
    setResult(null);
    try {
      const { suggestion } = await adsService.suggestMetaCampaign({
        topic: suggestTopic.trim() || undefined,
        objective,
      });
      if (suggestion.name) setName(suggestion.name);
      const obj = normalizeObjective(suggestion.objective);
      if (obj) setObjective(obj);
      if (suggestion.daily_budget_usd) setDailyBudgetUsd(String(suggestion.daily_budget_usd));
      if (suggestion.primary_text) setMessage(suggestion.primary_text);
      if (suggestion.headline) setHeadline(suggestion.headline);
      if (suggestion.description) setDescription(suggestion.description);
      if (suggestion.link_description) setDisplayLink(suggestion.link_description);
      if (suggestion.call_to_action) setCta(suggestion.call_to_action);
      const t = suggestion.targeting;
      if (t) {
        if (t.countries && t.countries.length > 0) setCountry(t.countries[0]);
        if (typeof t.age_min === 'number') setAgeMin(String(t.age_min));
        if (typeof t.age_max === 'number') setAgeMax(String(t.age_max));
        if (Array.isArray(t.genders) && t.genders.length === 1) {
          setGender(t.genders[0] === 1 ? 'male' : t.genders[0] === 2 ? 'female' : 'all');
        } else {
          setGender('all');
        }
      }
      setResult({ type: 'success', message: '✨ Prefilled from AI suggestion — review before launching.' });
    } catch (err: unknown) {
      setResult({ type: 'error', message: extractApiError(err).message });
    } finally {
      setSuggesting(false);
    }
  };

  const canSubmit =
    !!adAccountId && !!linkUrl.trim() && parseFloat(dailyBudgetUsd) >= 1.5 &&
    parseInt(durationDays, 10) >= 1;

  const submit = async (confirmLive = false) => {
    if (!adAccountId || !canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const campaign = await adsService.createMetaCampaign({
        ad_account_id: adAccountId,
        objective,
        name: name.trim() || `${objective} campaign`,
        daily_budget_usd: parseFloat(dailyBudgetUsd),
        duration_days: parseInt(durationDays, 10),
        link_url: linkUrl.trim(),
        message: message.trim() || undefined,
        headline: headline.trim() || undefined,
        description: description.trim() || undefined,
        cta: cta || undefined,
        display_link: displayLink.trim() || undefined,
        // Advanced targeting (interests/placements/geo) supersedes the basic
        // inputs when the user has opened that section; otherwise use the simple
        // country/age/gender fields.
        targeting: advancedTargeting
          ? {
              geo_locations: targeting.geo_locations,
              age_min: targeting.age_min,
              age_max: targeting.age_max,
              ...(targeting.genders && targeting.genders.length ? { genders: targeting.genders } : {}),
              ...(targeting.interests.length ? { interests: targeting.interests } : {}),
              ...(targeting.placements.length ? { placements: targeting.placements } : {}),
            }
          : {
              geo_locations: { countries: [country] },
              age_min: parseInt(ageMin, 10),
              age_max: parseInt(ageMax, 10),
              // Meta genders: 1 = male, 2 = female; omit for all.
              ...(gender === 'male' ? { genders: [1] } : gender === 'female' ? { genders: [2] } : {}),
            },
        activate,
        confirm_live: confirmLive,
      });
      setLiveConfirm(null);
      setResult({ type: 'success', message: `Campaign created: ${campaign.name} (${campaign.status}).` });
      onSuccess?.(campaign);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; detail?: string; requires_confirmation?: boolean } } };
      const data = e?.response?.data || {};
      if (e?.response?.status === 409 && data.requires_confirmation) {
        setLiveConfirm({ detail: data.detail || 'This is a LIVE ad account — it will spend real money.' });
        return;
      }
      setResult({ type: 'error', message: data.error || 'Failed to create campaign.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#12121f] border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MegaphoneIcon className="w-5 h-5 text-purple-300" />
            <h2 className="text-lg font-bold text-text-primary">Create Campaign</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <XMarkIcon className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* AI suggest */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <label className="text-xs font-semibold text-purple-200 mb-1.5 flex items-center gap-1">
              <SparklesIcon className="w-3.5 h-3.5" /> AI suggest
            </label>
            <div className="flex items-center gap-2">
              <input
                value={suggestTopic}
                onChange={(e) => setSuggestTopic(e.target.value)}
                placeholder="What are you advertising? (e.g. handmade candles)"
                className="flex-1 bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none"
              />
              <button
                type="button"
                onClick={runSuggest}
                disabled={suggesting}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-semibold disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4" />
                {suggesting ? 'Thinking…' : 'Suggest'}
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1">Prefills name, copy, budget & targeting. You can edit everything after.</p>
          </div>

          {/* Objective */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Objective</label>
            <div className="grid grid-cols-2 gap-2">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setObjective(o.value)}
                  className={`text-left p-2.5 rounded-xl border transition-colors ${
                    objective === o.value
                      ? 'bg-purple-500/15 border-purple-500/40'
                      : 'bg-dark-900/60 border-white/10 hover:border-white/20'
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">{o.label}</p>
                  <p className="text-[10px] text-text-muted">{o.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Ad account */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Ad account</label>
            <select
              value={adAccountId ?? ''}
              onChange={(e) => setAdAccountId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm outline-none"
            >
              <option value="">— Select an ad account —</option>
              {adAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.is_sandbox ? '🧪 SANDBOX — ' : '🔴 LIVE — '}
                  {a.name || `act_${a.external_id}`} ({a.currency_code})
                </option>
              ))}
            </select>
            {selected && (
              <p className={`mt-1.5 text-[11px] ${selected.is_sandbox ? 'text-amber-400' : 'text-red-400'}`}>
                {selected.is_sandbox
                  ? '🧪 Sandbox (test) account — no real money is spent.'
                  : '🔴 Live account — launching will spend real money.'}
              </p>
            )}
          </div>

          {/* Name + link */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Campaign name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer sale"
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Destination link *</label>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://yoursite.com/product"
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Headline (optional)</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)}
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Primary text (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none resize-none" />
          </div>

          {/* Creative — description, CTA button, display link */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Extra line shown under the headline"
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Call to action</label>
              <select value={cta} onChange={(e) => setCta(e.target.value)}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none">
                {CTA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Display link (optional)</label>
              <input value={displayLink} onChange={(e) => setDisplayLink(e.target.value)} placeholder="yoursite.com"
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
            </div>
          </div>

          {/* Budget + targeting */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Daily budget (USD)</label>
              <input type="number" min="1.5" step="0.5" value={dailyBudgetUsd} onChange={(e) => setDailyBudgetUsd(e.target.value)}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Duration (days)</label>
              <input type="number" min="1" max="30" value={durationDays} onChange={(e) => setDurationDays(e.target.value)}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none" />
            </div>
          </div>
          {/* Targeting header + advanced toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text-secondary">Targeting</label>
            <button
              type="button"
              onClick={() => setAdvancedTargeting((v) => !v)}
              className="text-[11px] font-semibold text-purple-300 hover:text-purple-200"
            >
              {advancedTargeting ? '← Basic targeting' : 'Advanced targeting (interests, placements) →'}
            </button>
          </div>

          {advancedTargeting ? (
            <TargetingBuilder value={targeting} onChange={setTargeting} adAccountId={adAccountId ?? undefined} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Country</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none">
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Age min</label>
                  <input type="number" min="13" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Age max</label>
                  <input type="number" min="13" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'male', 'female'] as const).map((g) => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        gender === g ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                          : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Launch mode — explicit, defaults to PAUSED so nothing spends by accident */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Launch mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActivate(false)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  !activate
                    ? 'bg-green-500/15 border-green-500/50'
                    : 'bg-dark-900/60 border-white/10 hover:border-white/20'
                }`}
              >
                <p className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  ⏸ Create paused
                  {!activate && <span className="text-[10px] text-green-300 font-semibold">(default)</span>}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Nothing is spent. Review it, then turn it on later.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setActivate(true)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  activate
                    ? 'bg-red-500/15 border-red-500/50'
                    : 'bg-dark-900/60 border-white/10 hover:border-white/20'
                }`}
              >
                <p className="text-sm font-bold text-text-primary">▶ Activate now</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Starts delivering{selected && !selected.is_sandbox ? ' & spending' : ''} immediately.
                </p>
              </button>
            </div>
            {activate && selected && !selected.is_sandbox && (
              <p className="mt-2 text-[11px] text-red-300 font-semibold">
                🔴 This will spend up to ${parseFloat(dailyBudgetUsd || '0').toFixed(2)}/day of real money
                on “{selected.name || `act_${selected.external_id}`}”. You’ll be asked to confirm.
              </p>
            )}
            {activate && selected?.is_sandbox && (
              <p className="mt-2 text-[11px] text-amber-400">
                🧪 Sandbox account — no real money is spent even when active.
              </p>
            )}
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-xs ${result.type === 'success' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
              {result.message}
            </div>
          )}

          {/* LIVE confirmation */}
          {liveConfirm && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-sm font-bold text-red-300">⚠️ Real money warning</p>
              <p className="text-xs text-red-200/90 mt-1">{liveConfirm.detail}</p>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={() => setLiveConfirm(null)} disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-text-secondary text-xs font-semibold disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={() => submit(true)} disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50">
                  {submitting ? 'Creating…' : 'Yes, spend real money'}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-sm font-semibold disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => submit(false)} disabled={!canSubmit || submitting}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default CreateCampaignModal;
