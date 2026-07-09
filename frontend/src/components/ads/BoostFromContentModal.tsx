/**
 * BoostFromContentModal
 * =====================
 * Boost a published (or scheduled) content post into a paid ad. Lists
 * boostable posts, lets the user pick a Meta ad account, budget, duration, and
 * targeting (via TargetingBuilder), then calls POST /ads/boost-from-post/.
 *
 * Paused-safe by default. LIVE (real-money) accounts trigger the 409
 * confirmation flow — same pattern as BoostPostModal / CreateCampaignModal.
 * Scheduled posts (no facebook_post_id) can opt into boosting after publish.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { adsService, type AdAccount, type BoostablePost } from '../../services/adsService';
import { extractApiError } from '../../utils/extractApiError';
import { TargetingBuilder, emptyTargeting, type TargetingValue } from './TargetingBuilder';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BoostFromContentModal({ isOpen, onClose, onSuccess }: Props) {
  const [posts, setPosts] = useState<BoostablePost[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [adAccountId, setAdAccountId] = useState<number | null>(null);
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState('2.00');
  const [durationDays, setDurationDays] = useState('7');
  const [targeting, setTargeting] = useState<TargetingValue>(emptyTargeting('US'));
  const [scheduleAfterPublish, setScheduleAfterPublish] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [liveConfirm, setLiveConfirm] = useState<{ detail: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingData(true);
    setResult(null);
    setLiveConfirm(null);
    setSelectedPostId(null);
    setTargeting(emptyTargeting('US'));

    Promise.all([adsService.getBoostablePosts(), adsService.listAdAccounts()])
      .then(([postsRes, accountsRes]) => {
        if (cancelled) return;
        setPosts(postsRes.posts || []);
        const metaAccs = (accountsRes.accounts || []).filter((a) => a.provider === 'meta');
        setAdAccounts(metaAccs);
        if (metaAccs.length === 1) setAdAccountId(metaAccs[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult({ type: 'error', message: extractApiError(err).message });
      })
      .finally(() => { if (!cancelled) setLoadingData(false); });

    return () => { cancelled = true; };
  }, [isOpen]);

  const selectedPost = posts.find((p) => p.id === selectedPostId) || null;
  const selectedAccount = adAccounts.find((a) => a.id === adAccountId) || null;
  // A post is "already live" (published) if it has a platform post id.
  const isPublished = !!(selectedPost?.facebook_post_id || selectedPost?.instagram_post_id);
  const isScheduled = !!selectedPost && !isPublished;

  const canSubmit =
    !!selectedPostId &&
    !!adAccountId &&
    parseFloat(dailyBudgetUsd) >= 1.5 &&
    parseInt(durationDays, 10) >= 1 &&
    targeting.age_min <= targeting.age_max &&
    (targeting.geo_locations.countries.length > 0);

  const submit = async (confirmLive = false) => {
    if (!selectedPostId || !adAccountId || !canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await adsService.boostFromPost({
        post_id: selectedPostId,
        ad_account_id: adAccountId,
        daily_budget_usd: parseFloat(dailyBudgetUsd),
        duration_days: parseInt(durationDays, 10),
        targeting: targeting as unknown as Record<string, unknown>,
        confirm_live: confirmLive,
        // Only meaningful for a scheduled post: boost once it publishes.
        ...(isScheduled && scheduleAfterPublish ? { schedule_after_publish: true } : {}),
      });
      setLiveConfirm(null);
      const msg = res.boost_on_publish
        ? 'Scheduled — this post will be boosted automatically once it publishes.'
        : res.detail || `Campaign created${res.name ? `: ${res.name}` : ''}${res.status ? ` (${res.status})` : ''}.`;
      setResult({ type: 'success', message: msg });
      onSuccess?.();
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
            <RocketLaunchIcon className="w-5 h-5 text-purple-300" />
            <h2 className="text-lg font-bold text-text-primary">Boost from Content</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
            <XMarkIcon className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadingData ? (
            <p className="py-8 text-center text-sm text-text-muted">Loading…</p>
          ) : (
            <>
              {/* Post picker */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Post to boost</label>
                {posts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    No boostable posts found.
                  </div>
                ) : (
                  <select
                    value={selectedPostId ?? ''}
                    onChange={(e) => setSelectedPostId(e.target.value ? Number(e.target.value) : null)}
                    className={inputCls}
                  >
                    <option value="">— Select a post —</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.facebook_post_id || p.instagram_post_id) ? '✅ ' : '🕓 '}
                        #{p.id} · {(p.caption || '(no caption)').slice(0, 60)}
                        {p.caption && p.caption.length > 60 ? '…' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {isScheduled && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <ClockIcon className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleAfterPublish}
                        onChange={(e) => setScheduleAfterPublish(e.target.checked)}
                        className="mt-0.5 accent-purple-500"
                      />
                      <span className="text-[11px] text-blue-200/90">
                        This post isn’t published yet. Schedule the boost to launch automatically once it publishes.
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Ad account */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Ad account</label>
                {adAccounts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    No Meta ad accounts connected.
                  </div>
                ) : (
                  <select
                    value={adAccountId ?? ''}
                    onChange={(e) => setAdAccountId(e.target.value ? Number(e.target.value) : null)}
                    className={inputCls}
                  >
                    <option value="">— Select an ad account —</option>
                    {adAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.is_sandbox ? '🧪 SANDBOX — ' : '🔴 LIVE — '}
                        {a.name || `act_${a.external_id}`} ({a.currency_code})
                      </option>
                    ))}
                  </select>
                )}
                {selectedAccount && (
                  <p className={`mt-1.5 text-[11px] ${selectedAccount.is_sandbox ? 'text-amber-400' : 'text-red-400'}`}>
                    {selectedAccount.is_sandbox
                      ? '🧪 Sandbox (test) account — no real money is spent.'
                      : '🔴 Live account — launching will spend real money.'}
                  </p>
                )}
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

              {/* Targeting */}
              <div className="pt-1">
                <p className="text-xs font-semibold text-text-secondary mb-2">Audience</p>
                <TargetingBuilder value={targeting} onChange={setTargeting} adAccountId={adAccountId ?? undefined} />
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
                      {submitting ? 'Launching…' : 'Yes, spend real money'}
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
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <RocketLaunchIcon className="w-4 h-4" />
                  {submitting ? 'Launching…' : isScheduled && scheduleAfterPublish ? 'Schedule Boost' : 'Launch Boost'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default BoostFromContentModal;
