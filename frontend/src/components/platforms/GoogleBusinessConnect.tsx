/**
 * GoogleBusinessConnect — OAuth connect + location picker + Google Post composer.
 * Mirrors YouTubeConnect's popup/postMessage flow, extended with the
 * location-selection and post-publishing steps unique to Google Business Profile.
 *
 * Flow:
 *   1. Click "Connect Google Business" -> popup -> Google OAuth -> account linked
 *   2. Pick a business location (locations are fetched after connect)
 *   3. Compose + publish a Google Post (text + optional image + CTA)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon, XCircleIcon,
  BuildingStorefrontIcon, MapPinIcon, PaperAirplaneIcon, SparklesIcon,
  StarIcon, ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { googleBusinessService } from '../../services/googleBusinessService';
import type {
  GBPConnectionStatus, GBPLocation, GBPCtaType, GBPReview,
} from '../../services/googleBusinessService';

type Step = 'idle' | 'opening' | 'waiting' | 'refreshing' | 'done' | 'error';

interface OAuthError { title: string; detail: string; }

interface Props {
  onConnected?: () => void;
  buttonLabel?: string;
  compact?: boolean;
}

const OVERALL_CFG = {
  fully_connected:     { dot: 'bg-green-400',  label: 'Connected',           text: 'text-green-400',  ring: 'border-green-500/20 bg-green-500/5' },
  partially_connected: { dot: 'bg-amber-400',  label: 'Partially Connected', text: 'text-amber-400',  ring: 'border-amber-500/20 bg-amber-500/5' },
  needs_attention:     { dot: 'bg-red-400',    label: 'Needs Attention',     text: 'text-red-400',    ring: 'border-red-500/20 bg-red-500/5' },
  not_connected:       { dot: 'bg-slate-500',  label: 'Not Connected',       text: 'text-slate-400',  ring: 'border-white/5 bg-white/[0.02]' },
};

const STATUS_TEXT: Record<string, string> = {
  active: 'text-green-400', expired: 'text-red-400', invalid: 'text-red-400', disconnected: 'text-slate-400',
};

const CTA_OPTIONS: { value: GBPCtaType; label: string; needsUrl: boolean }[] = [
  { value: 'LEARN_MORE', label: 'Learn more', needsUrl: true },
  { value: 'BOOK',       label: 'Book',        needsUrl: true },
  { value: 'ORDER',      label: 'Order online', needsUrl: true },
  { value: 'SHOP',       label: 'Buy',         needsUrl: true },
  { value: 'SIGN_UP',    label: 'Sign up',     needsUrl: true },
  { value: 'CALL',       label: 'Call now',    needsUrl: false },
];

export function GoogleBusinessConnect({ onConnected, buttonLabel, compact = false }: Props) {
  const [step, setStep]             = useState<Step>('idle');
  const [oauthError, setOAuthError] = useState<OAuthError | null>(null);
  const [warning, setWarning]       = useState('');
  const [status, setStatus]         = useState<GBPConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Location selection
  const [locations, setLocations]   = useState<GBPLocation[] | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError]     = useState('');
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);

  // Post composer
  const [summary, setSummary]   = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ctaType, setCtaType]   = useState<GBPCtaType | ''>('');
  const [ctaUrl, setCtaUrl]     = useState('');
  const [posting, setPosting]   = useState(false);
  const [postError, setPostError] = useState('');
  const [postOk, setPostOk]     = useState<{ message: string; search_url: string } | null>(null);

  // AI generation
  const [aiTopic, setAiTopic]   = useState('');
  const [genCaption, setGenCaption] = useState(false);
  const [genImage, setGenImage] = useState(false);
  const [aiError, setAiError]   = useState('');

  // Reviews
  const [reviews, setReviews]   = useState<GBPReview[] | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<Record<string, 'ai' | 'send' | undefined>>({});

  const popupRef   = useRef<Window | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  // ── Status ───────────────────────────────────────────────────────────────
  const refreshStatus = useCallback(async (forceRefresh = false) => {
    setStatusLoading(true);
    try {
      const data = await googleBusinessService.getStatus(forceRefresh);
      setStatus(data);
      const acc = data.accounts[0];
      if (acc?.location_id) setSelectedLocId(acc.location_id);
    } catch { /* silent */ } finally { setStatusLoading(false); }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => cleanup(), [cleanup]);

  // ── OAuth result ─────────────────────────────────────────────────────────
  const processOAuthResult = useCallback((data: any) => {
    if (handledRef.current) return;
    handledRef.current = true;
    cleanup();

    if (data.type === 'GBP_OAUTH_SUCCESS') {
      if (data.warning) setWarning(data.warning);
      setStep('refreshing');
      refreshStatus(true).then(() => {
        setStep('done');
        onConnected?.();
      });
    } else if (data.type === 'GBP_OAUTH_ERROR') {
      setOAuthError({ title: data.title || 'Connection Failed', detail: data.detail || 'Please try again.' });
      setStep('error');
    }
  }, [cleanup, refreshStatus, onConnected]);

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== 'gbp_oauth_result' || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem('gbp_oauth_result');
      if (data?.type?.startsWith('GBP_OAUTH_')) processOAuthResult(data);
    } catch { /* ignore */ }
  }, [processOAuthResult]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin;
    if (event.origin !== apiBase && event.origin !== window.location.origin) return;
    if (!event.data?.type?.startsWith('GBP_OAUTH_')) return;
    processOAuthResult(event.data);
  }, [processOAuthResult]);

  // ── Connect ──────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setOAuthError(null); setWarning(''); setStep('opening');
    handledRef.current = false;
    localStorage.removeItem('gbp_oauth_result');

    try {
      const { auth_url } = await googleBusinessService.initiate();

      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth  - W) / 2);
      const top  = window.screenY + Math.round((window.outerHeight - H) / 2);

      popupRef.current = window.open(
        auth_url, 'gbp_oauth',
        `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      if (!popupRef.current || popupRef.current.closed) {
        setOAuthError({ title: 'Popup Blocked', detail: 'Your browser blocked the popup. Allow popups for this site, then try again.' });
        setStep('error');
        return;
      }

      setStep('waiting');
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          setTimeout(() => {
            const stored = localStorage.getItem('gbp_oauth_result');
            if (stored) {
              try {
                const data = JSON.parse(stored);
                localStorage.removeItem('gbp_oauth_result');
                if (data?.type?.startsWith('GBP_OAUTH_')) { processOAuthResult(data); return; }
              } catch { /* ignore */ }
            }
            cleanup();
            setStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          }, 300);
        }
      }, 500);
    } catch (err: any) {
      const msg = googleBusinessService.readError(err, 'Failed to start Google Business connection.');
      setOAuthError({ title: 'Connection Failed', detail: msg });
      setStep('error');
    }
  };

  // ── Locations ────────────────────────────────────────────────────────────
  const loadLocations = useCallback(async () => {
    setLocLoading(true); setLocError('');
    try {
      const data = await googleBusinessService.getLocations();
      setLocations(data.locations);
      if (data.selected_location_id) setSelectedLocId(data.selected_location_id);
    } catch (err: any) {
      setLocError(googleBusinessService.readError(err, 'Could not load business locations.'));
    } finally { setLocLoading(false); }
  }, []);

  const handleSelectLocation = async (loc: GBPLocation) => {
    setLocError('');
    try {
      await googleBusinessService.selectLocation(loc.location_id, loc.title);
      setSelectedLocId(loc.location_id);
      await refreshStatus();
    } catch (err: any) {
      setLocError(googleBusinessService.readError(err, 'Could not select this location.'));
    }
  };

  // ── Publish post ─────────────────────────────────────────────────────────
  const selectedCta = CTA_OPTIONS.find(c => c.value === ctaType);

  const canPublish =
    !!selectedLocId &&
    summary.trim().length > 0 &&
    (!ctaType || !selectedCta?.needsUrl || ctaUrl.trim().length > 0) &&
    !posting;

  const handlePublish = async () => {
    setPostError(''); setPostOk(null);

    if (!summary.trim()) { setPostError('Post text is required.'); return; }
    if (ctaType && selectedCta?.needsUrl && !ctaUrl.trim()) {
      setPostError(`The "${selectedCta.label}" button needs a URL.`); return;
    }
    if (imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) {
      setPostError('Image URL must start with http:// or https://'); return;
    }
    if (ctaUrl.trim() && !/^https?:\/\//i.test(ctaUrl.trim())) {
      setPostError('CTA URL must start with http:// or https://'); return;
    }

    setPosting(true);
    try {
      const res = await googleBusinessService.createPost({
        summary: summary.trim(),
        image_url: imageUrl.trim() || undefined,
        cta_type: ctaType || undefined,
        cta_url: ctaUrl.trim() || undefined,
      });
      setPostOk({ message: res.message, search_url: res.search_url });
      setSummary(''); setImageUrl(''); setCtaType(''); setCtaUrl('');
    } catch (err: any) {
      setPostError(googleBusinessService.readError(err, 'Failed to publish the Google Post.'));
    } finally { setPosting(false); }
  };

  // ── AI generation ────────────────────────────────────────────────────────
  const handleGenerateCaption = async () => {
    setAiError('');
    setGenCaption(true);
    try {
      const res = await googleBusinessService.generateCaption(aiTopic.trim(), 'friendly');
      if (res.caption) setSummary(res.caption);
    } catch (err: any) {
      setAiError(googleBusinessService.readError(err, 'AI caption generation failed.'));
    } finally { setGenCaption(false); }
  };

  const handleGenerateImage = async () => {
    setAiError('');
    const prompt = aiTopic.trim() || summary.trim();
    if (!prompt) { setAiError('Enter a topic or post text first to generate an image.'); return; }
    setGenImage(true);
    try {
      const res = await googleBusinessService.generateImage(prompt, 'realistic');
      if (res.image_url) setImageUrl(res.image_url);
    } catch (err: any) {
      setAiError(googleBusinessService.readError(err, 'AI image generation failed.'));
    } finally { setGenImage(false); }
  };

  // ── Reviews ──────────────────────────────────────────────────────────────
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true); setReviewsError('');
    try {
      const data = await googleBusinessService.getReviews();
      setReviews(data.reviews);
    } catch (err: any) {
      setReviewsError(googleBusinessService.readError(err, 'Could not load reviews.'));
    } finally { setReviewsLoading(false); }
  }, []);

  const handleAiReply = async (rev: GBPReview) => {
    setReviewsError('');
    setReplyBusy((p) => ({ ...p, [rev.review_id]: 'ai' }));
    try {
      const res = await googleBusinessService.generateReviewReply(rev.comment, rev.star_rating || undefined);
      if (res.reply) setReplyDraft((p) => ({ ...p, [rev.review_id]: res.reply }));
    } catch (err: any) {
      setReviewsError(googleBusinessService.readError(err, 'AI reply generation failed.'));
    } finally { setReplyBusy((p) => ({ ...p, [rev.review_id]: undefined })); }
  };

  const handleSendReply = async (rev: GBPReview) => {
    const text = (replyDraft[rev.review_id] || '').trim();
    if (!text) { setReviewsError('Write a reply before sending.'); return; }
    setReviewsError('');
    setReplyBusy((p) => ({ ...p, [rev.review_id]: 'send' }));
    try {
      await googleBusinessService.replyToReview(rev.name, text);
      // Reflect the published reply locally.
      setReviews((prev) => prev?.map((r) =>
        r.review_id === rev.review_id ? { ...r, reply: text, has_reply: true } : r
      ) ?? prev);
      setReplyDraft((p) => ({ ...p, [rev.review_id]: '' }));
    } catch (err: any) {
      setReviewsError(googleBusinessService.readError(err, 'Failed to publish the reply.'));
    } finally { setReplyBusy((p) => ({ ...p, [rev.review_id]: undefined })); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const isLoading   = ['opening', 'waiting', 'refreshing'].includes(step);
  const overall     = status?.overall_status ?? 'not_connected';
  const cfg         = OVERALL_CFG[overall];
  const isConnected = overall !== 'not_connected';
  const account     = status?.accounts[0];
  const effectiveLabel = buttonLabel ?? (isConnected ? 'Reconnect Google Business' : 'Connect Google Business');

  return (
    <div className="space-y-4">
      {/* ── Connect Button ── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className={`relative flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-white transition-all duration-200 overflow-hidden
            ${isLoading ? 'bg-[#4285F4]/60 cursor-wait' : 'bg-[#4285F4] hover:bg-[#3367D6] hover:shadow-lg hover:shadow-[#4285F4]/20 active:scale-[0.98]'}
            ${compact ? 'text-sm py-2 px-4' : 'text-base'}`}
        >
          <BuildingStorefrontIcon className="w-5 h-5" />
          {isLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {step === 'opening' && 'Opening Google...'}
              {step === 'waiting' && 'Waiting for authorization...'}
              {step === 'refreshing' && 'Finishing setup...'}
            </>
          ) : effectiveLabel}
        </button>

        {step === 'done' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircleIcon className="w-4 h-4" /><span>Google Business connected successfully!</span>
          </motion.div>
        )}

        {warning && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" /><span>{warning}</span>
          </motion.div>
        )}

        <AnimatePresence>
          {step === 'error' && oauthError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm"><XCircleIcon className="w-4 h-4" />{oauthError.title}</div>
              <p className="text-red-300/70 text-xs pl-6">{oauthError.detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Status + account ── */}
      {!statusLoading && status && isConnected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`border rounded-xl p-4 space-y-3 ${cfg.ring}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
            </div>
            <button onClick={() => refreshStatus(true)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
              <ArrowPathIcon className="w-3 h-3" /> Refresh
            </button>
          </div>

          {status.accounts.map((acc) => (
            <div key={acc.account_id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <BuildingStorefrontIcon className="w-4 h-4 text-[#4285F4]" />
                <span className="text-slate-200">{acc.name}</span>
                {acc.location_name && <span className="text-[10px] text-slate-500">· {acc.location_name}</span>}
              </div>
              <span className={`text-xs font-medium ${STATUS_TEXT[acc.status] || 'text-slate-400'}`}>{acc.status_display}</span>
            </div>
          ))}

          {status.accounts.filter(a => a.error_message && a.status !== 'active').map(a => (
            <div key={`err-${a.account_id}`} className="text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-2">
              <span className="font-medium">{a.name}:</span> {a.error_message}
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Location picker ── */}
      {isConnected && account?.status === 'active' && (
        <div className="border border-white/5 rounded-xl p-4 space-y-3 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <MapPinIcon className="w-4 h-4 text-[#4285F4]" /> Business Location
            </div>
            <button onClick={loadLocations} disabled={locLoading} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 disabled:opacity-50">
              {locLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <ArrowPathIcon className="w-3 h-3" />}
              {locations ? 'Reload' : 'Load locations'}
            </button>
          </div>

          {account?.location_name && (
            <div className="text-xs text-slate-400">
              Currently managing: <span className="text-green-400 font-medium">{account.location_name}</span>
            </div>
          )}

          {locError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{locError}</span>
            </div>
          )}

          {locations && locations.length === 0 && !locLoading && (
            <p className="text-xs text-slate-500">No business locations found on this account.</p>
          )}

          {locations && locations.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {locations.map((loc) => {
                const active = loc.location_id === selectedLocId;
                return (
                  <button
                    key={loc.location_id}
                    onClick={() => handleSelectLocation(loc)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${active ? 'border-[#4285F4]/40 bg-[#4285F4]/10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-200">{loc.title || '(Unnamed location)'}</span>
                      {active && <CheckCircleIcon className="w-4 h-4 text-[#4285F4]" />}
                    </div>
                    {loc.address && <p className="text-[11px] text-slate-500 mt-0.5">{loc.address}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Post composer ── */}
      {isConnected && account?.status === 'active' && selectedLocId && (
        <div className="border border-white/5 rounded-xl p-4 space-y-3 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <PaperAirplaneIcon className="w-4 h-4 text-[#4285F4]" /> New Google Post
          </div>

          {/* AI generate row */}
          <div className="space-y-2 p-2.5 rounded-lg bg-[#4285F4]/5 border border-[#4285F4]/10">
            <div className="flex items-center gap-1.5 text-[11px] text-[#4285F4] font-medium">
              <SparklesIcon className="w-3.5 h-3.5" /> Generate with AI
            </div>
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Topic or offer (e.g. weekend spa discount)"
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#4285F4]/50 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleGenerateCaption}
                disabled={genCaption}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-[#4285F4] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {genCaption ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                {genCaption ? 'Writing…' : 'Write caption'}
              </button>
              <button
                onClick={handleGenerateImage}
                disabled={genImage}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-[#4285F4] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {genImage ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                {genImage ? 'Creating…' : 'Generate image'}
              </button>
            </div>
            {aiError && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400">
                <XCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{aiError}</span>
              </div>
            )}
          </div>

          <div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={1500}
              rows={3}
              placeholder="What's new at your business? (e.g. Relax in comfort at Seven Door Spa…)"
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#4285F4]/50 transition-colors resize-none"
            />
            <p className="text-[10px] text-slate-600 mt-0.5 text-right">{summary.length}/1500</p>
          </div>

          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional) — https://…"
            className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#4285F4]/50 transition-colors font-mono"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={ctaType}
              onChange={(e) => setCtaType(e.target.value as GBPCtaType | '')}
              className="px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#4285F4]/50"
            >
              <option value="">No button</option>
              {CTA_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {ctaType && selectedCta?.needsUrl && (
              <input
                type="text"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="Button URL — https://…"
                className="px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#4285F4]/50 transition-colors font-mono"
              />
            )}
            {ctaType === 'CALL' && (
              <div className="px-3 py-2 text-[11px] text-slate-500 flex items-center">Uses the location's phone number.</div>
            )}
          </div>

          {postError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{postError}</span>
            </div>
          )}
          {postOk && (
            <div className="flex items-start gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <CheckCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{postOk.message}{postOk.search_url && <> · <a href={postOk.search_url} target="_blank" rel="noopener noreferrer" className="underline">View on Google</a></>}</span>
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={!canPublish}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#4285F4] hover:bg-[#3367D6] disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
          >
            {posting ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Publishing…</> : <><PaperAirplaneIcon className="w-4 h-4" /> Publish Google Post</>}
          </button>
        </div>
      )}

      {/* ── Reviews ── */}
      {isConnected && account?.status === 'active' && selectedLocId && (
        <div className="border border-white/5 rounded-xl p-4 space-y-3 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-[#4285F4]" /> Reviews
            </div>
            <button onClick={loadReviews} disabled={reviewsLoading} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 disabled:opacity-50">
              <ArrowPathIcon className={`w-3 h-3 ${reviewsLoading ? 'animate-spin' : ''}`} />
              {reviews ? 'Reload' : 'Load reviews'}
            </button>
          </div>

          {reviewsError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{reviewsError}</span>
            </div>
          )}

          {reviews && reviews.length === 0 && !reviewsLoading && (
            <p className="text-xs text-slate-500">No reviews yet for this location.</p>
          )}

          {reviews && reviews.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reviews.map((rev) => {
                const busy = replyBusy[rev.review_id];
                return (
                  <div key={rev.review_id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-200">{rev.reviewer}</span>
                      <span className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <StarIcon key={n} className={`w-3.5 h-3.5 ${n <= rev.star_rating ? 'text-amber-400' : 'text-slate-600'}`} />
                        ))}
                      </span>
                    </div>
                    {rev.comment && <p className="text-xs text-slate-400">{rev.comment}</p>}

                    {rev.has_reply ? (
                      <div className="text-[11px] text-green-400/80 bg-green-500/5 rounded px-2 py-1.5">
                        <span className="font-medium">Your reply:</span> {rev.reply}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={replyDraft[rev.review_id] || ''}
                          onChange={(e) => setReplyDraft((p) => ({ ...p, [rev.review_id]: e.target.value }))}
                          rows={2}
                          placeholder="Write a reply…"
                          className="w-full px-2.5 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-[#4285F4]/50 transition-colors resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAiReply(rev)}
                            disabled={!!busy}
                            className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-[#4285F4] disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {busy === 'ai' ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                            AI reply
                          </button>
                          <button
                            onClick={() => handleSendReply(rev)}
                            disabled={!!busy || !(replyDraft[rev.review_id] || '').trim()}
                            className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-[#4285F4] hover:bg-[#3367D6] text-white disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {busy === 'send' ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <PaperAirplaneIcon className="w-3 h-3" />}
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GoogleBusinessConnect;
