/**
 * BoostPostModal
 * ==============
 * Boosts an existing organic Facebook post into a paid ad campaign.
 *
 * Flow:
 *   1. Reserve boost budget from diamond wallet (wallet-first, falls back to card)
 *   2. If wallet is insufficient: show a "Top up" prompt -> CardEntryModal
 *   3. After reservation succeeds: POST /api/v1/ads/boost-post/
 *   4. If ad launch fails: release the wallet reservation (refund diamonds)
 */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { adsService, type AdAccount, type AdCampaign } from '../../services/adsService';
import { postService } from '../../services/postService';
import { stripeService } from '../../services/stripeService';
import { BuyDiamondsModal } from '../billing/BuyDiamondsModal';
import type { Post } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (campaign: AdCampaign) => void;
  preselectedPost?: Post | null;
}

const COUNTRY_OPTIONS = [
  { code: 'BD', name: 'Bangladesh' },
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'UAE' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'ID', name: 'Indonesia' },
];

export function BoostPostModal({ isOpen, onClose, onSuccess, preselectedPost }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedPostId, setSelectedPostId] = useState<number | null>(preselectedPost?.id ?? null);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<number | null>(null);
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState<string>('2.00');
  const [durationDays, setDurationDays] = useState<string>('1');
  const [country, setCountry] = useState<string>('BD');
  const [ageMin, setAgeMin] = useState<string>('18');
  const [ageMax, setAgeMax] = useState<string>('65');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; campaign?: AdCampaign } | null>(null);

  // Wallet reservation state
  const [shortfall, setShortfall] = useState<number | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  // Set when the backend blocks a LIVE (real-money) ad account pending confirmation.
  const [liveConfirm, setLiveConfirm] = useState<{ resId: string; detail: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingData(true);
    setResult(null);
    setShortfall(null);
    setReservationId(null);
    setLiveConfirm(null);
    if (preselectedPost?.id) setSelectedPostId(preselectedPost.id);

    Promise.all([
      postService.list({ status: 'posted', page_size: 100 }),
      adsService.listAdAccounts(),
    ])
      .then(([postsRes, accountsRes]) => {
        if (cancelled) return;
        setPosts(postsRes.results || []);
        const accs = accountsRes.accounts || [];
        setAdAccounts(accs);
        if (accs.length === 1) setSelectedAdAccountId(accs[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to load posts or ad accounts.';
        setResult({ type: 'error', message: msg });
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  const boostablePosts = useMemo(
    () => posts.filter((p) => !!p.facebook_post_id || (p.platforms || []).includes('facebook')),
    [posts],
  );

  const totalUsd = useMemo(
    () => parseFloat(dailyBudgetUsd || '0') * parseInt(durationDays || '0', 10),
    [dailyBudgetUsd, durationDays],
  );

  const canSubmit =
    !!selectedPostId &&
    !!selectedAdAccountId &&
    parseFloat(dailyBudgetUsd) >= 1.5 &&
    parseInt(durationDays, 10) >= 1 &&
    parseInt(ageMin, 10) >= 13 &&
    parseInt(ageMax, 10) <= 65 &&
    parseInt(ageMin, 10) <= parseInt(ageMax, 10);

  const launchBoost = async (resId: string, confirmLive = false) => {
    if (!selectedPostId || !selectedAdAccountId) return;
    setSubmitting(true);
    try {
      const campaign = await adsService.boostPost({
        post_id: selectedPostId,
        ad_account_id: selectedAdAccountId,
        daily_budget_usd: parseFloat(dailyBudgetUsd),
        duration_days: parseInt(durationDays, 10),
        targeting: {
          geo_locations: { countries: [country] },
          age_min: parseInt(ageMin, 10),
          age_max: parseInt(ageMax, 10),
        },
        confirm_live: confirmLive,
      });
      setLiveConfirm(null);
      setReservationId(null);
      setResult({
        type: 'success',
        message: `Campaign created: ${campaign.name} (status: ${campaign.status})`,
        campaign,
      });
      onSuccess?.(campaign);
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: { error?: string; detail?: string; requires_confirmation?: boolean; account_name?: string; code?: number; subcode?: number; error_user_title?: string; error_user_msg?: string; step?: string } } };
      const data = errObj?.response?.data || {};
      // LIVE ad-account guard (HTTP 409): don't burn the reservation — prompt
      // the user to confirm real spend, then re-run with confirm_live=true.
      if (errObj?.response?.status === 409 && data.requires_confirmation) {
        setLiveConfirm({ resId, detail: data.detail || 'This is a LIVE ad account — it will spend real money.' });
        setSubmitting(false);
        return;
      }
      // Release the reserved diamonds since the ad failed
      try { await stripeService.releaseBoostReservation(resId, 'boost_launch_failed'); } catch { /* non-fatal */ }
      const title = data.error_user_title;
      const userMsg = data.error_user_msg;
      const headline = title || data.error || 'Failed to create campaign.';
      const body = [
        userMsg,
        data.code ? `Meta code: ${data.code}${data.subcode ? `/${data.subcode}` : ''}` : null,
        data.step ? `Failed at: ${data.step}` : null,
      ].filter(Boolean).join('  -  ');
      setResult({ type: 'error', message: body ? `${headline}\n${body}` : headline });
    } finally {
      setSubmitting(false);
    }
  };

  const reserveAndLaunch = async (resId: string) => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await stripeService.reserveBoostBudget({
        amount_usd: totalUsd,
        reservation_id: resId,
        metadata: { post_id: selectedPostId ?? 0 },
      });

      if (res.status === 'insufficient_funds') {
        setShortfall(res.needed_usd ?? totalUsd);
        setSubmitting(false);
        return;
      }
      // reserved or already_reserved → proceed
      setShortfall(null);
      setSubmitting(false);
      await launchBoost(resId);
    } catch {
      setResult({ type: 'error', message: 'Could not verify wallet balance. Please try again.' });
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedPostId || !selectedAdAccountId) return;
    const resId = reservationId ?? crypto.randomUUID();
    setReservationId(resId);
    await reserveAndLaunch(resId);
  };

  const handleTopupSuccess = async () => {
    setTopupOpen(false);
    if (!reservationId) return;
    await reserveAndLaunch(reservationId);
  };

  const handleClose = () => {
    if (submitting) return;
    setResult(null);
    setShortfall(null);
    setReservationId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-dark-800 border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <RocketLaunchIcon className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Boost a Facebook Post</h2>
              <p className="text-[11px] text-text-muted">Turn an organic post into a paid ad</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {loadingData ? (
            <div className="py-12 text-center text-text-muted text-sm">Loading…</div>
          ) : (
            <>
              {/* Post picker */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
                  Post to boost
                </label>
                {preselectedPost ? (
                  <div className="px-4 py-3 rounded-xl bg-dark-900/60 border border-purple-500/30 text-sm text-text-primary">
                    #{preselectedPost.id} · {(preselectedPost.caption || '(no caption)').slice(0, 80)}
                    {preselectedPost.caption && preselectedPost.caption.length > 80 ? '…' : ''}
                  </div>
                ) : boostablePosts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    No posts found that were published to Facebook.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedPostId ?? ''}
                    onChange={(e) => setSelectedPostId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none"
                  >
                    <option value="">— Select a published post —</option>
                    {boostablePosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} · {(p.caption || '(no caption)').slice(0, 60)}
                        {p.caption && p.caption.length > 60 ? '…' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Ad account picker */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
                  Ad Account
                </label>
                {adAccounts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    No ad accounts connected.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedAdAccountId ?? ''}
                    onChange={(e) => setSelectedAdAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none"
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
                {selectedAdAccountId != null && (() => {
                  const sel = adAccounts.find((a) => a.id === selectedAdAccountId);
                  if (!sel) return null;
                  return sel.is_sandbox ? (
                    <p className="mt-1.5 text-[11px] text-amber-400">
                      🧪 Sandbox (test) account — no real money is spent.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-red-400">
                      🔴 Live account — launching will spend real money.
                    </p>
                  );
                })()}
              </div>

              {/* Budget + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
                    Daily Budget (USD)
                  </label>
                  <input
                    required type="number" step="0.50" min="1.5"
                    value={dailyBudgetUsd}
                    onChange={(e) => setDailyBudgetUsd(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none"
                  />
                  <p className="text-[10px] text-text-muted mt-1">Minimum $1.50/day</p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
                    Duration (days)
                  </label>
                  <input
                    required type="number" step="1" min="1" max="30"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none"
                  />
                  <p className="text-[10px] text-text-muted mt-1">Total spend ≤ daily × days</p>
                </div>
              </div>

              {/* Targeting */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
                  Audience — Country
                </label>
                <select
                  required value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Age Min</label>
                  <input required type="number" min="13" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Age Max</label>
                  <input required type="number" min="13" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)}
                    className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none" />
                </div>
              </div>

              {/* Estimated total */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-text-muted">Estimated max spend</span>
                <span className="font-bold text-text-primary">${totalUsd.toFixed(2)} USD</span>
              </div>

              {/* Insufficient funds banner */}
              {shortfall !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Insufficient diamond balance</p>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      You need ~${shortfall.toFixed(2)} more to boost this post.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTopupOpen(true)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Top up ${Math.ceil(shortfall)}
                  </button>
                </motion.div>
              )}

              {/* Result message */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl flex items-start gap-2.5 ${
                    result.type === 'success'
                      ? 'bg-success/10 border border-success/20 text-success'
                      : 'bg-red-500/10 border border-red-500/20 text-red-300'
                  }`}
                >
                  {result.type === 'success'
                    ? <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  }
                  <p className="text-xs font-semibold whitespace-pre-line">{result.message}</p>
                </motion.div>
              )}
            </>
          )}

          {/* LIVE ad-account confirmation (real spend) */}
          {liveConfirm && (
            <div className="mt-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-sm font-bold text-red-300">⚠️ Real money warning</p>
              <p className="text-xs text-red-200/90 mt-1">{liveConfirm.detail}</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setLiveConfirm(null)}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-text-secondary text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => launchBoost(liveConfirm.resId, true)}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Launching…' : 'Yes, spend real money'}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting || loadingData}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RocketLaunchIcon className="w-4 h-4" />
              {submitting ? 'Reserving…' : 'Launch Boost'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Top-up modal (shown when wallet is insufficient) */}
      {topupOpen && shortfall !== null && (
        <BuyDiamondsModal
          isOpen={topupOpen}
          onClose={() => setTopupOpen(false)}
          initialAmount={Math.ceil(shortfall)}
          onSuccess={handleTopupSuccess}
        />
      )}
    </div>
  );
}

export default BoostPostModal;
