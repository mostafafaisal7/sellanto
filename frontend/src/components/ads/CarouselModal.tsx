/**
 * CarouselModal
 * =============
 * Create a from-scratch Meta carousel campaign (2-10 swipeable cards). Pick a
 * Meta ad account, objective, name, daily budget, duration, targeting (via
 * TargetingBuilder), and a repeatable list of cards — each with a link,
 * headline, description, image (via MediaPicker), and CTA.
 * Calls adsService.createCarousel → POST /ads/meta/carousel/.
 *
 * Paused-safe by default. LIVE (real-money) accounts trigger the 409
 * confirmation flow — same pattern as BoostFromContentModal / CreateCampaignModal.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  Squares2X2Icon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { adsService, type AdAccount, type AdCampaign } from '../../services/adsService';
import { extractApiError } from '../../utils/extractApiError';
import { TargetingBuilder, emptyTargeting, type TargetingValue } from './TargetingBuilder';
import { MediaPicker, type MediaSelection } from './MediaPicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (c: AdCampaign) => void;
}

type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'sales';

const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
  { value: 'sales', label: 'Sales' },
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

const MIN_CARDS = 2;
const MAX_CARDS = 10;

interface CardDraft {
  link: string;
  name: string;
  description: string;
  media: MediaSelection | null;
  cta: string;
}

function emptyCard(): CardDraft {
  return { link: '', name: '', description: '', media: null, cta: 'LEARN_MORE' };
}

export function CarouselModal({ isOpen, onClose, onSuccess }: Props) {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adAccountId, setAdAccountId] = useState<number | null>(null);
  const [objective, setObjective] = useState<Objective>('traffic');
  const [name, setName] = useState('');
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState('2.00');
  const [durationDays, setDurationDays] = useState('7');
  const [targeting, setTargeting] = useState<TargetingValue>(emptyTargeting('US'));
  const [cards, setCards] = useState<CardDraft[]>([emptyCard(), emptyCard()]);
  const [activate, setActivate] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [liveConfirm, setLiveConfirm] = useState<{ detail: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setLiveConfirm(null);
    setCards([emptyCard(), emptyCard()]);
    setTargeting(emptyTargeting('US'));
    adsService.listAdAccounts()
      .then((r) => {
        const metaAccs = (r.accounts || []).filter((a) => a.provider === 'meta');
        setAdAccounts(metaAccs);
        if (metaAccs.length === 1) setAdAccountId(metaAccs[0].id);
      })
      .catch(() => setAdAccounts([]));
  }, [isOpen]);

  const selected = adAccounts.find((a) => a.id === adAccountId) || null;

  const patchCard = (i: number, changes: Partial<CardDraft>) =>
    setCards((prev) => prev.map((c, j) => (j === i ? { ...c, ...changes } : c)));
  const addCard = () => setCards((prev) => (prev.length >= MAX_CARDS ? prev : [...prev, emptyCard()]));
  const removeCard = (i: number) =>
    setCards((prev) => (prev.length <= MIN_CARDS ? prev : prev.filter((_, j) => j !== i)));

  // Every card needs a link + an image.
  const cardsValid = cards.every((c) => c.link.trim() && c.media?.url);

  const canSubmit =
    !!adAccountId &&
    cards.length >= MIN_CARDS &&
    cardsValid &&
    parseFloat(dailyBudgetUsd) >= 1.5 &&
    parseInt(durationDays, 10) >= 1 &&
    targeting.geo_locations.countries.length > 0;

  const submit = async (confirmLive = false) => {
    if (!adAccountId || !canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const campaign = await adsService.createCarousel({
        ad_account_id: adAccountId,
        objective,
        name: name.trim() || `${objective} carousel`,
        daily_budget_usd: parseFloat(dailyBudgetUsd),
        duration_days: parseInt(durationDays, 10),
        targeting: {
          geo_locations: {
            ...targeting.geo_locations,
            ...(targeting.regions && targeting.regions.length
              ? { regions: targeting.regions.map((key) => ({ key })) }
              : {}),
            ...(targeting.cities && targeting.cities.length
              ? { cities: targeting.cities.map((key) => ({ key })) }
              : {}),
          },
          age_min: targeting.age_min,
          age_max: targeting.age_max,
          ...(targeting.genders && targeting.genders.length ? { genders: targeting.genders } : {}),
          ...(targeting.interests.length ? { interests: targeting.interests } : {}),
          ...(targeting.placements.length ? { placements: targeting.placements } : {}),
          ...(targeting.custom_audiences && targeting.custom_audiences.length
            ? { custom_audiences: targeting.custom_audiences }
            : {}),
        },
        cards: cards.map((c) => ({
          link: c.link.trim(),
          name: c.name.trim() || undefined,
          description: c.description.trim() || undefined,
          image_url: c.media?.url as string,
          cta: c.cta || undefined,
        })),
        activate,
        advantage_audience: !!targeting.advantage_audience,
        confirm_live: confirmLive,
      });
      setLiveConfirm(null);
      setResult({ type: 'success', message: `Carousel created: ${campaign.name} (${campaign.status}).` });
      onSuccess?.(campaign);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { requires_confirmation?: boolean; detail?: string } } };
      const data = e?.response?.data || {};
      if (e?.response?.status === 409 && data.requires_confirmation) {
        setLiveConfirm({ detail: data.detail || 'This is a LIVE ad account — it will spend real money.' });
        return;
      }
      setResult({ type: 'error', message: extractApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary text-sm outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-dark-800 border border-white/10 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-2">
            <Squares2X2Icon className="w-5 h-5 text-purple-300" />
            <h2 className="text-lg font-bold text-text-primary">Create Carousel</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
            <XMarkIcon className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Objective */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Objective</label>
            <div className="grid grid-cols-3 gap-2">
              {OBJECTIVES.map((o) => (
                <button key={o.value} type="button" onClick={() => setObjective(o.value)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                    objective === o.value
                      ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                      : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ad account */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Ad account</label>
            {adAccounts.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                No Meta ad accounts connected.
              </div>
            ) : (
              <select value={adAccountId ?? ''} onChange={(e) => setAdAccountId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                <option value="">— Select an ad account —</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.is_sandbox ? '🧪 SANDBOX — ' : '🔴 LIVE — '}
                    {a.name || `act_${a.external_id}`} ({a.currency_code})
                  </option>
                ))}
              </select>
            )}
            {selected && (
              <p className={`mt-1.5 text-[11px] ${selected.is_sandbox ? 'text-amber-400' : 'text-red-400'}`}>
                {selected.is_sandbox
                  ? '🧪 Sandbox (test) account — no real money is spent.'
                  : '🔴 Live account — launching will spend real money.'}
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Campaign name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer collection" className={inputCls} />
          </div>

          {/* Budget + duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Daily budget (USD)</label>
              <input type="number" min="1.5" step="0.5" value={dailyBudgetUsd} onChange={(e) => setDailyBudgetUsd(e.target.value)} className={inputCls} />
              <p className="text-[10px] text-text-muted mt-1">Minimum $1.50/day</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Duration (days)</label>
              <input type="number" min="1" max="30" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-secondary">
                Cards <span className="text-text-muted font-normal">({cards.length}/{MAX_CARDS} · min {MIN_CARDS})</span>
              </label>
              <button type="button" onClick={addCard} disabled={cards.length >= MAX_CARDS}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200 disabled:opacity-40">
                <PlusIcon className="w-3.5 h-3.5" /> Add card
              </button>
            </div>
            <div className="space-y-3">
              {cards.map((card, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-dark-900/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-text-primary">Card {i + 1}</p>
                    <button type="button" onClick={() => removeCard(i)} disabled={cards.length <= MIN_CARDS}
                      className="text-red-400 hover:text-red-300 disabled:opacity-30">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input value={card.link} onChange={(e) => patchCard(i, { link: e.target.value })}
                    placeholder="Destination link * (https://…)"
                    className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none" />
                  <input value={card.name} onChange={(e) => patchCard(i, { name: e.target.value })}
                    placeholder="Headline (optional)"
                    className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none" />
                  <input value={card.description} onChange={(e) => patchCard(i, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none" />
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">Card image *</label>
                    <MediaPicker value={card.media} onChange={(m) => patchCard(i, { media: m })} kind="image" adAccountId={adAccountId ?? undefined} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1">Call to action</label>
                    <select value={card.cta} onChange={(e) => patchCard(i, { cta: e.target.value })}
                      className="w-full bg-dark-900/60 border border-white/10 rounded-lg px-3 py-2 text-text-primary text-sm outline-none">
                      {CTA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            {!cardsValid && (
              <p className="text-[10px] text-amber-400 mt-1.5">Each card needs a destination link and an image.</p>
            )}
          </div>

          {/* Targeting */}
          <div className="pt-1">
            <p className="text-xs font-semibold text-text-secondary mb-2">Audience</p>
            <TargetingBuilder value={targeting} onChange={setTargeting} adAccountId={adAccountId ?? undefined} />
          </div>

          {/* Launch mode — defaults to PAUSED */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Launch mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setActivate(false)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  !activate ? 'bg-green-500/15 border-green-500/50' : 'bg-dark-900/60 border-white/10 hover:border-white/20'
                }`}>
                <p className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  ⏸ Create paused
                  {!activate && <span className="text-[10px] text-green-300 font-semibold">(default)</span>}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">Nothing is spent. Turn it on later.</p>
              </button>
              <button type="button" onClick={() => setActivate(true)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  activate ? 'bg-red-500/15 border-red-500/50' : 'bg-dark-900/60 border-white/10 hover:border-white/20'
                }`}>
                <p className="text-sm font-bold text-text-primary">▶ Activate now</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Starts delivering{selected && !selected.is_sandbox ? ' & spending' : ''} immediately.
                </p>
              </button>
            </div>
            {activate && selected && !selected.is_sandbox && (
              <p className="mt-2 text-[11px] text-red-300 font-semibold">
                🔴 This will spend up to ${parseFloat(dailyBudgetUsd || '0').toFixed(2)}/day of real money. You’ll be asked to confirm.
              </p>
            )}
            {activate && selected?.is_sandbox && (
              <p className="mt-2 text-[11px] text-amber-400">🧪 Sandbox account — no real money is spent even when active.</p>
            )}
          </div>

          {result && (
            <div className={`p-3 rounded-xl flex items-start gap-2 text-xs ${
              result.type === 'success' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
            }`}>
              {result.type === 'success'
                ? <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                : <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />}
              <p className="whitespace-pre-line">{result.message}</p>
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
              {submitting ? 'Creating…' : 'Create Carousel'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default CarouselModal;
