/**
 * FacebookConnect
 * ================
 * Full Facebook OAuth connect flow in one component.
 *
 * Flow:
 *   1. Click "Connect Facebook" → GET /initiate/ → open popup
 *   2. User logs in on Facebook → popup sends postMessage
 *   3. If 1 page  → auto-setup Messenger → done
 *   4. If many    → show MessengerPagePicker → user picks → setup → done
 *   5. Refresh status card below the button
 *
 * Props:
 *   onConnected — called after full flow completes (pages connected)
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
import { facebookOAuthService } from '../../services/facebookOAuthService';
import { MessengerPagePicker } from './MessengerPagePicker';
import type {
  FacebookOAuthPage,
  FacebookConnectionStatus,
  FacebookStatusPage,
} from '../../services/facebookOAuthService';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | 'idle'
  | 'opening'
  | 'waiting'
  | 'picking'
  | 'saving_messenger'
  | 'refreshing'
  | 'done'
  | 'error';

interface OAuthError {
  title: string;
  detail: string;
}

interface Props {
  onConnected?: (pages: FacebookOAuthPage[]) => void;
  buttonLabel?: string;
  compact?: boolean;
}

// ── Status colours ─────────────────────────────────────────────────────────────

const OVERALL_CFG = {
  fully_connected:     { dot: 'bg-green-400',  label: 'Fully Connected',       text: 'text-green-400',  ring: 'border-green-500/20 bg-green-500/5' },
  partially_connected: { dot: 'bg-amber-400',  label: 'Partially Connected',    text: 'text-amber-400',  ring: 'border-amber-500/20 bg-amber-500/5' },
  needs_attention:     { dot: 'bg-red-400',    label: 'Needs Attention',         text: 'text-red-400',    ring: 'border-red-500/20 bg-red-500/5' },
  not_connected:       { dot: 'bg-slate-500',  label: 'Not Connected',           text: 'text-slate-400',  ring: 'border-white/5 bg-white/[0.02]' },
};

const STATUS_TEXT: Record<string, string> = {
  active:       'text-green-400',
  expired:      'text-red-400',
  invalid:      'text-red-400',
  disconnected: 'text-slate-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function FacebookConnect({ onConnected, buttonLabel = 'Connect Facebook Page', compact = false }: Props) {
  const [step, setStep]           = useState<Step>('idle');
  const [oauthError, setOAuthError] = useState<OAuthError | null>(null);
  const [warning, setWarning]     = useState<string>('');
  const [pages, setPages]         = useState<FacebookOAuthPage[]>([]);
  const [status, setStatus]       = useState<FacebookConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const popupRef    = useRef<Window | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef  = useRef(false); // prevent double-processing from both channels

  // ── Fetch live status ──────────────────────────────────────────────────────

  const refreshStatus = useCallback(async (forceRefresh = false) => {
    setStatusLoading(true);
    try {
      const data = await facebookOAuthService.getStatus(forceRefresh);
      setStatus(data);
    } catch {
      // silently fail — status card just won't show
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

  // ── Step 2b — process OAuth result (shared by both channels) ─────────────

  const processOAuthResult = useCallback((data: any) => {
    if (handledRef.current) return; // already handled by other channel
    handledRef.current = true;
    cleanup();

    if (data.type === 'FB_OAUTH_SUCCESS') {
      const receivedPages: FacebookOAuthPage[] = data.pages || [];
      if (data.warning) setWarning(data.warning);

      if (!receivedPages.length) {
        setOAuthError({ title: 'No Pages Connected', detail: 'Please try again.' });
        setStep('error');
        return;
      }

      setPages(receivedPages);
      const activePages = receivedPages.filter((p) => p.status === 'active');

      if (activePages.length === 0) {
        setOAuthError({
          title: 'Pages Could Not Be Validated',
          detail: receivedPages.map((p: FacebookOAuthPage) => `${p.name}: ${p.error || 'Unknown error'}`).join(' · '),
        });
        setStep('error');
        return;
      }

      if (activePages.length === 1) {
        doSetupMessenger(activePages[0], receivedPages);
      } else {
        setStep('picking');
      }

    } else if (data.type === 'FB_OAUTH_ERROR') {
      setOAuthError({
        title:  data.title  || 'Connection Failed',
        detail: data.detail || 'Please try again.',
      });
      setStep('error');
    }
  }, [cleanup]);

  // ── Step 2a — localStorage channel (immune to Facebook's COOP headers) ────

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== 'fb_oauth_result' || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem('fb_oauth_result');
      if (data?.type?.startsWith('FB_OAUTH_')) processOAuthResult(data);
    } catch { /* ignore parse errors */ }
  }, [processOAuthResult]);

  // ── Step 2b — postMessage channel (works when opener is available) ─────────

  const handleMessage = useCallback((event: MessageEvent) => {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin;
    if (event.origin !== apiBase && event.origin !== window.location.origin) return;
    if (!event.data?.type?.startsWith('FB_OAUTH_')) return;
    processOAuthResult(event.data);
  }, [processOAuthResult]);

  // ── Step 1 — open popup ───────────────────────────────────────────────────

  const handleConnect = async () => {
    setOAuthError(null);
    setWarning('');
    setStep('opening');
    handledRef.current = false;

    // Clear any stale result from a previous OAuth flow
    localStorage.removeItem('fb_oauth_result');

    try {
      const { auth_url } = await facebookOAuthService.initiate();

      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth  - W) / 2);
      const top  = window.screenY + Math.round((window.outerHeight - H) / 2);

      popupRef.current = window.open(
        auth_url,
        'fb_oauth',
        `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      if (!popupRef.current || popupRef.current.closed) {
        setOAuthError({
          title:  'Popup Blocked',
          detail: 'Your browser blocked the popup. Allow popups for this site in your browser settings, then try again.',
        });
        setStep('error');
        return;
      }

      setStep('waiting');
      // Listen on both channels — whichever fires first wins
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      // Detect popup closed without completing
      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          // Give localStorage channel a brief moment to fire before giving up
          setTimeout(() => {
            const stored = localStorage.getItem('fb_oauth_result');
            if (stored) {
              try {
                const data = JSON.parse(stored);
                localStorage.removeItem('fb_oauth_result');
                if (data?.type?.startsWith('FB_OAUTH_')) processOAuthResult(data);
                return;
              } catch { /* ignore */ }
            }
            cleanup();
            setStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          }, 300);
        }
      }, 500);

    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to start Facebook connection.';
      setOAuthError({ title: 'Connection Failed', detail: msg });
      setStep('error');
    }
  };

  // ── Step 3 — setup Messenger ──────────────────────────────────────────────

  const doSetupMessenger = async (page: FacebookOAuthPage, allPages: FacebookOAuthPage[]) => {
    setStep('saving_messenger');
    try {
      await facebookOAuthService.setupMessenger(page.id);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Messenger setup failed.';
      setWarning(`Pages connected. Messenger setup failed: ${msg} You can retry in Messenger Settings.`);
    } finally {
      setStep('refreshing');
      await refreshStatus();
      setStep('done');
      onConnected?.(allPages);
    }
  };

  const handlePickerSelect = (page: FacebookOAuthPage) => doSetupMessenger(page, pages);
  const handlePickerSkip   = async () => {
    setStep('refreshing');
    await refreshStatus();
    setStep('done');
    onConnected?.(pages);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLoading = ['opening', 'waiting', 'saving_messenger', 'refreshing'].includes(step);
  const overall   = status?.overall_status ?? 'not_connected';
  const cfg       = OVERALL_CFG[overall];

  // ── Render: Messenger picker overlay ─────────────────────────────────────

  if (step === 'picking') {
    const activePages = pages.filter((p) => p.status === 'active');
    return (
      <MessengerPagePicker
        pages={activePages}
        onSelect={handlePickerSelect}
        onSkip={handlePickerSkip}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Connect Button ── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
            bg-[#1877F2] hover:bg-[#1565C0] text-white shadow-lg shadow-blue-900/30
            disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {/* Facebook F icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          {step === 'opening'          ? 'Opening Facebook...' :
           step === 'waiting'          ? 'Waiting for login...' :
           step === 'saving_messenger' ? 'Setting up Messenger...' :
           step === 'refreshing'       ? 'Refreshing status...' :
           overall !== 'not_connected' ? 'Reconnect Facebook' :
           buttonLabel}
        </button>

        {/* Warning notice */}
        <AnimatePresence>
          {warning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">{warning}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error notice */}
        <AnimatePresence>
          {step === 'error' && oauthError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-400">{oauthError.title}</p>
                <p className="text-xs text-red-300/80 mt-0.5 break-words">{oauthError.detail}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Status Card ── */}
      {!compact && (
        <div className={`rounded-xl border p-4 ${cfg.ring} transition-all`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot} ${overall !== 'not_connected' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
            </div>
            <button
              onClick={() => refreshStatus(true)}
              disabled={statusLoading}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Re-validate connection"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {statusLoading && !status ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : status ? (
            <div className="space-y-3">
              {/* Facebook Pages */}
              <StatusSection title="Facebook Pages" icon="📄">
                {status.facebook.pages.length === 0 ? (
                  <EmptyRow text="No pages connected" />
                ) : (
                  status.facebook.pages.map((p) => (
                    <PageRow key={p.page_id} page={p} />
                  ))
                )}
              </StatusSection>

              {/* Instagram */}
              <StatusSection title="Instagram" icon="📸">
                {status.instagram.accounts.length === 0 ? (
                  <EmptyRow text="No accounts linked" />
                ) : (
                  status.instagram.accounts.map((ig) => (
                    <div key={ig.ig_account_id} className="flex items-center justify-between py-1">
                      <span className="text-xs text-slate-300 truncate">{ig.account_name}</span>
                      <StatusBadge status={ig.status} label={ig.status_display} />
                    </div>
                  ))
                )}
              </StatusSection>

              {/* Messenger Bot */}
              <StatusSection title="Messenger Bot" icon="💬">
                {!status.messenger.connected ? (
                  <EmptyRow text="Not set up" />
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-300 truncate">{status.messenger.data?.page_name}</span>
                    <StatusBadge
                      status={
                        !status.messenger.data?.is_webhook_verified ? 'invalid' :
                        !status.messenger.data?.is_active ? 'disconnected' : 'active'
                      }
                      label={
                        !status.messenger.data?.is_webhook_verified ? 'Webhook unverified' :
                        !status.messenger.data?.is_active ? 'Disabled' : 'Active'
                      }
                    />
                  </div>
                )}
              </StatusSection>

              {/* Warnings */}
              {status.warnings.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  {status.warnings.map((w, i) => (
                    <AlertRow key={i} severity="warning" title={w.title} message={w.message} detail={w.detail} />
                  ))}
                </div>
              )}

              {/* Missing */}
              {status.missing.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  {status.missing.map((m, i) => (
                    <AlertRow key={i} severity={m.severity} title={m.title} message={m.message} detail={m.detail} />
                  ))}
                </div>
              )}

              {/* All good */}
              {status.missing.length === 0 && status.warnings.length === 0 && overall === 'fully_connected' && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Everything is connected and working</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PageRow({ page }: { page: FacebookStatusPage }) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300 truncate flex-1 mr-2">{page.page_name}</span>
        <StatusBadge status={page.status} label={page.status_display} />
      </div>
      {page.error_message && (
        <p className="text-[10px] text-red-400 mt-0.5 truncate">{page.error_message}</p>
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`text-[10px] font-semibold flex-shrink-0 ${STATUS_TEXT[status] ?? 'text-slate-400'}`}>
      {label}
    </span>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-[10px] text-slate-600 py-0.5">— {text}</p>;
}

function AlertRow({ severity, title, message, detail }: {
  severity: string; title: string; message: string; detail: string;
}) {
  const styles = {
    critical: 'text-red-400 bg-red-500/5',
    warning:  'text-amber-400 bg-amber-500/5',
    info:     'text-blue-400 bg-blue-500/5',
  }[severity] ?? 'text-slate-400 bg-white/5';

  return (
    <div className={`p-2 rounded-lg ${styles}`}>
      <p className="text-[10px] font-semibold">{title}: {message}</p>
      {detail && <p className="text-[10px] opacity-75 mt-0.5">{detail}</p>}
    </div>
  );
}

export default FacebookConnect;
