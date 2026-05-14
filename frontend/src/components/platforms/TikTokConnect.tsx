/**
 * TikTokConnect — One-click OAuth connect (mirrors YouTubeConnect/LinkedInConnect/PinterestConnect)
 *
 * Flow:
 *   1. Click "Connect TikTok" -> GET /initiate/ -> open popup
 *   2. User logs in on TikTok -> popup sends postMessage / localStorage
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
import { tiktokOAuthService } from '../../services/tiktokOAuthService';
import type {
  TikTokOAuthAccount,
  TikTokConnectionStatus,
} from '../../services/tiktokOAuthService';

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
  onConnected?: (account?: TikTokOAuthAccount) => void;
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

export function TikTokConnect({ onConnected, buttonLabel, compact = false }: Props) {
  const [step, setStep]             = useState<Step>('idle');
  const [oauthError, setOAuthError] = useState<OAuthError | null>(null);
  const [warning, setWarning]       = useState<string>('');
  const [status, setStatus]         = useState<TikTokConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const popupRef   = useRef<Window | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  // ── Fetch live status ──────────────────────────────────────────────────────

  const refreshStatus = useCallback(async (forceRefresh = false) => {
    setStatusLoading(true);
    try {
      const data = await tiktokOAuthService.getStatus(forceRefresh);
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

    if (data.type === 'TT_OAUTH_SUCCESS') {
      if (data.warning) setWarning(data.warning);
      setStep('refreshing');
      refreshStatus(true).then(() => {
        setStep('done');
        onConnected?.(data.account);
      });
    } else if (data.type === 'TT_OAUTH_ERROR') {
      setOAuthError({
        title:  data.title  || 'Connection Failed',
        detail: data.detail || 'Please try again.',
      });
      setStep('error');
    }
  }, [cleanup, refreshStatus, onConnected]);

  // ── localStorage channel (immune to COOP headers) ──────────────────────────

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== 'tt_oauth_result' || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem('tt_oauth_result');
      if (data?.type?.startsWith('TT_OAUTH_')) processOAuthResult(data);
    } catch { /* ignore */ }
  }, [processOAuthResult]);

  // ── postMessage channel ────────────────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin;
    if (event.origin !== apiBase && event.origin !== window.location.origin) return;
    if (!event.data?.type?.startsWith('TT_OAUTH_')) return;
    processOAuthResult(event.data);
  }, [processOAuthResult]);

  // ── Open popup ─────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    setOAuthError(null);
    setWarning('');
    setStep('opening');
    handledRef.current = false;

    localStorage.removeItem('tt_oauth_result');

    try {
      const { auth_url } = await tiktokOAuthService.initiate();

      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth  - W) / 2);
      const top  = window.screenY + Math.round((window.outerHeight - H) / 2);

      popupRef.current = window.open(
        auth_url,
        'tt_oauth',
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
            const stored = localStorage.getItem('tt_oauth_result');
            if (stored) {
              try {
                const data = JSON.parse(stored);
                localStorage.removeItem('tt_oauth_result');
                if (data?.type?.startsWith('TT_OAUTH_')) processOAuthResult(data);
                return;
              } catch { /* ignore */ }
            }
            cleanup();
            setStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          }, 300);
        }
      }, 500);

    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to start TikTok connection.';
      setOAuthError({ title: 'Connection Failed', detail: msg });
      setStep('error');
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isLoading   = ['opening', 'waiting', 'refreshing'].includes(step);
  const overall     = status?.overall_status ?? 'not_connected';
  const cfg         = OVERALL_CFG[overall];
  const isConnected = overall !== 'not_connected';
  const effectiveLabel = buttonLabel ?? (isConnected ? 'Reconnect TikTok' : 'Connect TikTok');

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
              ? 'bg-[#000000]/60 cursor-wait'
              : 'bg-[#000000] hover:bg-[#E91E4A] hover:shadow-lg hover:shadow-[#FE2C55]/20 active:scale-[0.98]'
            }
            ${compact ? 'text-sm py-2 px-4' : 'text-base'}
          `}
        >
          {/* TikTok icon — music note */}
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
          </svg>

          {isLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {step === 'opening' && 'Opening TikTok...'}
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
            <span>TikTok connected successfully!</span>
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
                <svg className="w-4 h-4 text-[#FE2C55]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
                <span className="text-slate-200">{acc.name}</span>
                {acc.account_id && <span className="text-[10px] text-slate-500 font-mono">ID:{acc.account_id}</span>}
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
              <span>No refresh token. Access tokens expire after 24 hours. You may need to reconnect. Ensure your app has the correct permissions.</span>
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

          {/* Token expiry — TikTok tokens last 24 hours */}
          {status.accounts[0]?.token_expires_at && (() => {
            const expiresAt = new Date(status.accounts[0].token_expires_at!);
            const hoursLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
            const minutesLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60));
            const hasRefresh = status.accounts[0].has_refresh_token;

            if (minutesLeft <= 0 && !hasRefresh) {
              return (
                <div className="text-xs text-red-400 pt-1 border-t border-white/5">
                  Access token expired and no refresh token available. Click "Connect TikTok" to reconnect.
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
            if (hoursLeft <= 2 && !hasRefresh) {
              return (
                <div className="text-xs text-amber-400 pt-1 border-t border-white/5">
                  Token expires in {hoursLeft <= 1 ? `${minutesLeft} min` : `${hoursLeft} hours`} — no refresh token. Reconnect soon.
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

export default TikTokConnect;
