/**
 * RedditConnect — One-click OAuth connect (mirrors YouTubeConnect/LinkedInConnect/PinterestConnect)
 *
 * Flow:
 *   1. Click "Connect Reddit" -> GET /initiate/ -> open popup
 *   2. User logs in on Reddit -> popup sends postMessage / localStorage
 *   3. Refresh status card below the button
 *
 * Props:
 *   onConnected — called after full flow completes
 *   buttonLabel — optional label override
 *   compact     — smaller variant for inline use
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { redditOAuthService } from '../../services/redditOAuthService';
import type {
  RedditOAuthAccount,
  RedditConnectionStatus,
} from '../../services/redditOAuthService';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | 'idle'
  | 'opening'
  | 'waiting'
  | 'refreshing'
  | 'done'
  | 'error';

interface OAuthError {
  title: string;
  detail: string;
}

interface Props {
  onConnected?: (account?: RedditOAuthAccount) => void;
  buttonLabel?: string;
  compact?: boolean;
}

// ── Status colours ───────────────────────────────────────────────────────────

const OVERALL_CFG = {
  fully_connected:     { dot: 'bg-green-400',  label: 'Connected',          text: 'text-green-400',  ring: 'border-green-500/20 bg-green-500/5' },
  partially_connected: { dot: 'bg-amber-400',  label: 'Partially Connected', text: 'text-amber-400',  ring: 'border-amber-500/20 bg-amber-500/5' },
  needs_attention:     { dot: 'bg-red-400',    label: 'Needs Attention',     text: 'text-red-400',    ring: 'border-red-500/20 bg-red-500/5' },
  not_connected:       { dot: 'bg-slate-500',  label: 'Not Connected',       text: 'text-slate-400',  ring: 'border-white/5 bg-white/[0.02]' },
};

const STATUS_TEXT: Record<string, string> = {
  active:       'text-green-400',
  expired:      'text-red-400',
  invalid:      'text-red-400',
  disconnected: 'text-slate-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function RedditConnect({ onConnected, buttonLabel, compact = false }: Props) {
  const [step, setStep]             = useState<Step>('idle');
  const [oauthError, setOAuthError] = useState<OAuthError | null>(null);
  const [warning, setWarning]       = useState<string>('');
  const [status, setStatus]         = useState<RedditConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const popupRef   = useRef<Window | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  // ── Fetch live status ──────────────────────────────────────────────────────

  const refreshStatus = useCallback(async (forceRefresh = false) => {
    setStatusLoading(true);
    try {
      const data = await redditOAuthService.getStatus(forceRefresh);
      setStatus(data);
    } catch {
      // silently fail
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Process OAuth result (shared by both channels) ─────────────────────────

  const processOAuthResult = useCallback((data: any) => {
    if (handledRef.current) return;
    handledRef.current = true;
    cleanup();

    if (data.type === 'REDDIT_OAUTH_SUCCESS') {
      if (data.warning) setWarning(data.warning);
      setStep('refreshing');
      refreshStatus(true).then(() => {
        setStep('done');
        onConnected?.(data.account);
      });
    } else if (data.type === 'REDDIT_OAUTH_ERROR') {
      setOAuthError({
        title:  data.title  || 'Connection Failed',
        detail: data.detail || 'Please try again.',
      });
      setStep('error');
    }
  }, [cleanup, refreshStatus, onConnected]);

  // ── localStorage channel (immune to COOP headers) ──────────────────────────

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== 'reddit_oauth_result' || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem('reddit_oauth_result');
      if (data?.type?.startsWith('REDDIT_OAUTH_')) processOAuthResult(data);
    } catch { /* ignore */ }
  }, [processOAuthResult]);

  // ── postMessage channel ────────────────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin;
    if (event.origin !== apiBase && event.origin !== window.location.origin) return;
    if (!event.data?.type?.startsWith('REDDIT_OAUTH_')) return;
    processOAuthResult(event.data);
  }, [processOAuthResult]);

  // ── Open popup ─────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    setOAuthError(null);
    setWarning('');
    setStep('opening');
    handledRef.current = false;

    localStorage.removeItem('reddit_oauth_result');

    try {
      const { auth_url } = await redditOAuthService.initiate();

      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth  - W) / 2);
      const top  = window.screenY + Math.round((window.outerHeight - H) / 2);

      popupRef.current = window.open(
        auth_url,
        'reddit_oauth',
        `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      if (!popupRef.current || popupRef.current.closed) {
        setOAuthError({
          title:  'Popup Blocked',
          detail: 'Your browser blocked the popup. Allow popups for this site, then try again.',
        });
        setStep('error');
        return;
      }

      setStep('waiting');
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      // Detect popup closed without completing
      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          setTimeout(() => {
            const stored = localStorage.getItem('reddit_oauth_result');
            if (stored) {
              try {
                const data = JSON.parse(stored);
                localStorage.removeItem('reddit_oauth_result');
                if (data?.type?.startsWith('REDDIT_OAUTH_')) processOAuthResult(data);
                return;
              } catch { /* ignore */ }
            }
            cleanup();
            setStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          }, 300);
        }
      }, 500);

    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to start Reddit connection.';
      setOAuthError({ title: 'Connection Failed', detail: msg });
      setStep('error');
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isLoading   = ['opening', 'waiting', 'refreshing'].includes(step);
  const overall     = status?.overall_status ?? 'not_connected';
  const cfg         = OVERALL_CFG[overall];
  const isConnected = overall !== 'not_connected';
  const effectiveLabel = buttonLabel ?? (isConnected ? 'Reconnect Reddit' : 'Connect Reddit');

  return (
    <div className="space-y-4">
      {/* ── Connect Button ── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className={`
            relative flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold
            text-white transition-all duration-200 overflow-hidden
            ${isLoading
              ? 'bg-[#FF4500]/60 cursor-wait'
              : 'bg-[#FF4500] hover:bg-[#CC3700] hover:shadow-lg hover:shadow-[#FF4500]/20 active:scale-[0.98]'
            }
            ${compact ? 'text-sm py-2 px-4' : 'text-base'}
          `}
        >
          {/* Reddit icon — snoo alien head */}
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
          </svg>

          {isLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {step === 'opening' && 'Opening Reddit...'}
              {step === 'waiting' && 'Waiting for authorization...'}
              {step === 'refreshing' && 'Finishing setup...'}
            </>
          ) : (
            effectiveLabel
          )}
        </button>

        {/* Step: done */}
        {step === 'done' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircleIcon className="w-4 h-4" />
            <span>Reddit connected successfully!</span>
          </motion.div>
        )}

        {/* Warning */}
        {warning && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{warning}</span>
          </motion.div>
        )}

        {/* Error */}
        <AnimatePresence>
          {step === 'error' && oauthError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <XCircleIcon className="w-4 h-4" />
                {oauthError.title}
              </div>
              <p className="text-red-300/70 text-xs pl-6">{oauthError.detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Status Card ── */}
      {!statusLoading && status && status.overall_status !== 'not_connected' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`border rounded-xl p-4 space-y-3 ${cfg.ring}`}>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
            </div>
            <button
              onClick={() => refreshStatus(true)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowPathIcon className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {/* Accounts */}
          {status.accounts.map((acc) => (
            <div key={acc.account_id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#FF4500]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                </svg>
                <span className="text-slate-200">{acc.name}</span>
                {acc.username && <span className="text-[10px] text-slate-500 font-mono">{acc.username}</span>}
              </div>
              <span className={`text-xs font-medium ${STATUS_TEXT[acc.status] || 'text-slate-400'}`}>
                {acc.status_display}
              </span>
            </div>
          ))}

          {/* No refresh token warning */}
          {status.accounts.some(a => a.is_active && !a.has_refresh_token) && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>No refresh token. Access tokens expire after 1 hour. You may need to reconnect frequently. Ensure your app uses <strong>duration=permanent</strong> in the auth request.</span>
            </div>
          )}

          {/* Error messages for invalid/expired accounts */}
          {status.accounts
            .filter((a) => a.error_message && a.status !== 'active')
            .map((a) => (
              <div key={`err-${a.account_id}`} className="text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-2">
                <span className="font-medium">{a.name}:</span> {a.error_message}
              </div>
            ))
          }

          {/* Token expiry — Reddit tokens last 1 hour */}
          {status.accounts[0]?.token_expires_at && (() => {
            const expiresAt = new Date(status.accounts[0].token_expires_at!);
            const minutesLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60));
            const hasRefresh = status.accounts[0].has_refresh_token;

            if (minutesLeft <= 0 && !hasRefresh) {
              return (
                <div className="text-xs text-red-400 pt-1 border-t border-white/5">
                  Access token expired and no refresh token available. Click "Connect Reddit" to reconnect.
                </div>
              );
            }
            if (minutesLeft <= 0 && hasRefresh) {
              return (
                <div className="text-xs text-slate-500 pt-1 border-t border-white/5">
                  Access token expired — will auto-refresh via refresh token.
                </div>
              );
            }
            if (minutesLeft <= 10 && !hasRefresh) {
              return (
                <div className="text-xs text-amber-400 pt-1 border-t border-white/5">
                  Token expires in {minutesLeft} min — no refresh token. Reconnect soon.
                </div>
              );
            }
            return (
              <div className="text-xs text-slate-500 pt-1 border-t border-white/5">
                Token expires: {expiresAt.toLocaleString()} {hasRefresh ? '(auto-refresh enabled)' : '(no refresh token)'}
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}

export default RedditConnect;
