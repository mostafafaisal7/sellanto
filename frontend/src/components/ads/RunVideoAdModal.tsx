/**
 * RunVideoAdModal — Publish + Boost video in one click.
 *
 * Flow:
 *   1. Reserve boost budget from diamond wallet (wallet-first)
 *   2. If wallet insufficient: prompt top-up -> CardEntryModal -> retry
 *   3. Upload video to FB + create ad campaign
 *   4. If creation fails: release wallet reservation (refund diamonds)
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  FilmIcon,
  RocketLaunchIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { adsService, type AdAccount } from '../../services/adsService';
import { stripeService } from '../../services/stripeService';
import { BuyDiamondsModal } from '../billing/BuyDiamondsModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm'];
const MAX_SIZE_MB = 200;

type Phase = 'idle' | 'reserving' | 'uploading' | 'processing' | 'creating' | 'done' | 'error';

export function RunVideoAdModal({ isOpen, onClose, onSuccess }: Props) {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [adAccountId, setAdAccountId] = useState<number | null>(null);
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState('2.00');
  const [durationDays, setDurationDays] = useState('1');
  const [country, setCountry] = useState('BD');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');

  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [result, setResult] = useState<
    | null
    | { type: 'success'; campaignId: string; message: string }
    | { type: 'error'; message: string; title?: string; userMsg?: string; step?: string; code?: number; subcode?: number }
  >(null);

  // Wallet reservation state
  const [shortfall, setShortfall] = useState<number | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setVideoPreviewUrl('');
  }, [videoFile]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingAccounts(true);
    setResult(null);
    setPhase('idle');
    setShortfall(null);
    setReservationId(null);
    adsService
      .listAdAccounts()
      .then((data) => {
        setAdAccounts(data.accounts || []);
        if ((data.accounts || []).length === 1) {
          setAdAccountId(data.accounts[0].id);
        }
      })
      .catch(() => setAdAccounts([]))
      .finally(() => setLoadingAccounts(false));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setVideoFile(null);
    setCaption('');
    setUploadPercent(0);
  }, [isOpen]);

  const totalUsd = useMemo(
    () => parseFloat(dailyBudgetUsd || '0') * parseInt(durationDays || '0', 10),
    [dailyBudgetUsd, durationDays],
  );

  const handleFile = (file: File | null) => {
    if (!file) return;
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setResult({ type: 'error', message: `Unsupported format ${ext}. Use ${ALLOWED_EXT.join(', ')}.` });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setResult({ type: 'error', message: `Video must be under ${MAX_SIZE_MB} MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.` });
      return;
    }
    setVideoFile(file);
    setResult(null);
  };

  const canSubmit = useMemo(
    () =>
      phase === 'idle' &&
      !!videoFile &&
      !!adAccountId &&
      parseFloat(dailyBudgetUsd) >= 1.5 &&
      parseInt(durationDays, 10) >= 1 &&
      parseInt(ageMin, 10) >= 13 &&
      parseInt(ageMax, 10) <= 65 &&
      parseInt(ageMin, 10) <= parseInt(ageMax, 10),
    [phase, videoFile, adAccountId, dailyBudgetUsd, durationDays, ageMin, ageMax],
  );

  const isBusy = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  // Pre-computed booleans — avoids TypeScript narrowing issues inside JSX conditions
  const isReserving: boolean = phase === 'reserving';
  const isUploading: boolean = phase === 'uploading';
  const isProcessing: boolean = phase === 'processing';
  const isCreating: boolean = phase === 'creating';
  const isDone: boolean = phase === 'done';
  const showPhaseProgress: boolean = isReserving || isUploading || isProcessing || isCreating;

  const launchVideoAd = async (resId: string) => {
    if (!videoFile || !adAccountId) return;
    setResult(null);
    setPhase('uploading');
    setUploadPercent(0);

    try {
      const data = await adsService.runVideoAd({
        video: videoFile,
        caption,
        ad_account_id: adAccountId,
        daily_budget_usd: parseFloat(dailyBudgetUsd),
        duration_days: parseInt(durationDays, 10),
        targeting: {
          geo_locations: { countries: [country] },
          age_min: parseInt(ageMin, 10),
          age_max: parseInt(ageMax, 10),
        },
        onUploadProgress: (pct) => {
          setUploadPercent(pct);
          if (pct >= 100) setPhase('processing');
        },
      });
      setPhase('done');
      setReservationId(null);
      setResult({
        type: 'success',
        campaignId: data.campaign.external_campaign_id,
        message: `Campaign created (status: ${data.campaign.status}). Meta will review and approve within 30 min.`,
      });
      onSuccess?.();
    } catch (err: unknown) {
      // Release reserved diamonds since the ad failed
      try { await stripeService.releaseBoostReservation(resId, 'video_ad_failed'); } catch { /* non-fatal */ }
      const errObj = err as {
        response?: { data?: { error?: string; error_user_title?: string; error_user_msg?: string; step?: string; code?: number; subcode?: number } };
        message?: string;
      };
      const d = errObj?.response?.data || {};
      setPhase('error');
      setResult({
        type: 'error',
        message: d.error || errObj?.message || 'Failed to run video ad.',
        title: d.error_user_title,
        userMsg: d.error_user_msg,
        step: d.step,
        code: d.code,
        subcode: d.subcode,
      });
    }
  };

  const reserveAndLaunch = async (resId: string) => {
    setPhase('reserving');
    setResult(null);
    try {
      const res = await stripeService.reserveBoostBudget({
        amount_usd: totalUsd,
        reservation_id: resId,
        metadata: {},
      });

      if (res.status === 'insufficient_funds') {
        setShortfall(res.needed_usd ?? totalUsd);
        setPhase('idle');
        return;
      }
      setShortfall(null);
      await launchVideoAd(resId);
    } catch {
      setResult({ type: 'error', message: 'Could not verify wallet balance. Please try again.' });
      setPhase('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !videoFile || !adAccountId) return;
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
    if (isBusy) return;
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
        className="bg-dark-800 border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
              <FilmIcon className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Run Video Ad</h2>
              <p className="text-[11px] text-text-muted">Publish to your FB Page AND boost as a paid ad in one click</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Video picker / preview */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
              Video file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXT.join(',')}
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="hidden"
              disabled={isBusy}
            />
            {videoFile ? (
              <div className="rounded-xl border border-blue-500/30 bg-dark-900/60 p-3 space-y-3">
                <video src={videoPreviewUrl} controls className="w-full max-h-64 rounded-lg bg-black" />
                <div className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="text-text-primary font-semibold truncate">{videoFile.name}</p>
                    <p className="text-text-muted">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={() => setVideoFile(null)} disabled={isBusy}
                    className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-50">
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="w-full py-8 rounded-xl border border-dashed border-white/20 hover:border-blue-500/50 hover:bg-white/[0.02] transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
              >
                <ArrowUpTrayIcon className="w-7 h-7 text-text-muted" />
                <p className="text-sm text-text-secondary font-semibold">Click to pick a video</p>
                <p className="text-[10px] text-text-muted">{ALLOWED_EXT.join(', ')} · max {MAX_SIZE_MB} MB</p>
              </button>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
              Caption / Description
            </label>
            <textarea
              required value={caption} onChange={(e) => setCaption(e.target.value)}
              rows={3} maxLength={1000} disabled={isBusy}
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50"
              placeholder="Description that appears on the FB post AND as the ad text"
            />
            <p className="text-[10px] text-text-muted mt-1">{caption.length}/1000</p>
          </div>

          {/* Ad account */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
              Ad Account
            </label>
            {loadingAccounts ? (
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            ) : adAccounts.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                No ad accounts connected.
              </div>
            ) : (
              <select
                required value={adAccountId ?? ''}
                onChange={(e) => setAdAccountId(e.target.value ? Number(e.target.value) : null)}
                disabled={isBusy}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50"
              >
                <option value="">— Select an ad account —</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || `act_${a.external_id}`} ({a.currency_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Budget + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Daily Budget (USD)</label>
              <input required type="number" step="0.50" min="1.5" value={dailyBudgetUsd}
                onChange={(e) => setDailyBudgetUsd(e.target.value)} disabled={isBusy}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50" />
              <p className="text-[10px] text-text-muted mt-1">Minimum $1.50/day</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Duration (days)</label>
              <input required type="number" min="1" max="30" value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)} disabled={isBusy}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50" />
              <p className="text-[10px] text-text-muted mt-1">Total ≤ daily × days</p>
            </div>
          </div>

          {/* Targeting */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Audience — Country</label>
            <select required value={country} onChange={(e) => setCountry(e.target.value)} disabled={isBusy}
              className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50">
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Age Min</label>
              <input required type="number" min="13" max="65" value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)} disabled={isBusy}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Age Max</label>
              <input required type="number" min="13" max="65" value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)} disabled={isBusy}
                className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-primary/50 outline-none disabled:opacity-50" />
            </div>
          </div>

          {/* Estimated spend */}
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
                  You need ~${shortfall.toFixed(2)} more to run this video ad.
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

          {/* Phased progress */}
          {showPhaseProgress && (
            <div className="space-y-2 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <PhaseRow label="0. Reserving boost budget from wallet" active={isReserving} done={!isReserving && (isUploading || isProcessing || isCreating || isDone)} />
              <PhaseRow label="1. Uploading video to your FB Page" active={isUploading} done={isProcessing || isCreating || isDone} detail={isUploading ? `${uploadPercent}%` : undefined} />
              <PhaseRow label="2. Waiting for Meta to encode the video" active={isProcessing} done={isCreating || isDone} detail={isProcessing ? 'Usually 30-90 sec' : undefined} />
              <PhaseRow label="3. Creating ad campaign on Meta" active={isCreating} done={isDone} />
            </div>
          )}

          {/* Result */}
          {result?.type === 'success' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl flex items-start gap-2.5 bg-success/10 border border-success/20 text-success">
              <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs">
                <p className="font-semibold">{result.message}</p>
                <p className="opacity-75 mt-1 font-mono">Campaign ID: {result.campaignId}</p>
              </div>
            </motion.div>
          )}
          {result?.type === 'error' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300">
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs space-y-1">
                <p className="font-semibold whitespace-pre-line">{result.title || result.message}</p>
                {result.userMsg && result.userMsg !== result.title && <p className="opacity-90">{result.userMsg}</p>}
                <p className="opacity-60 text-[10px]">
                  {result.step ? `Failed at: ${result.step}` : null}
                  {result.code ? ` · Meta code: ${result.code}${result.subcode ? `/${result.subcode}` : ''}` : null}
                </p>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={handleClose} disabled={isBusy}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-sm font-semibold transition-colors disabled:opacity-50">
              {phase === 'done' || phase === 'error' ? 'Close' : 'Cancel'}
            </button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <RocketLaunchIcon className="w-4 h-4" />
              {isBusy ? 'Running…' : 'Run Video Ad'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Top-up modal */}
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

function PhaseRow({ label, active, done, detail }: { label: string; active: boolean; done: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-success/20 text-success' : active ? 'bg-blue-500/30 text-blue-200' : 'bg-white/5 text-text-muted'}`}>
        {done ? <CheckCircleIcon className="w-3 h-3" /> : active ? <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> : <span className="w-1 h-1 rounded-full bg-current opacity-50" />}
      </span>
      <span className={done ? 'text-success' : active ? 'text-text-primary font-semibold' : 'text-text-muted'}>{label}</span>
      {detail && <span className="ml-auto text-text-muted font-mono text-[10px]">{detail}</span>}
    </div>
  );
}

export default RunVideoAdModal;
