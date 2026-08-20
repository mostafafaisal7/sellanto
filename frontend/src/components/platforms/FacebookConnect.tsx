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
  TrashIcon,
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
  /** Called after a successful disconnect, so parents can refetch their own lists. */
  onDisconnected?: () => void;
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

export function FacebookConnect({ onConnected, onDisconnected, buttonLabel = 'Connect Facebook, Instagram & Messenger', compact = false }: Props) {
  const [step, setStep]           = useState<Step>('idle');
  const [oauthError, setOAuthError] = useState<OAuthError | null>(null);
  const [warning, setWarning]     = useState<string>('');
  const [pages, setPages]         = useState<FacebookOAuthPage[]>([]);
  const [status, setStatus]       = useState<FacebookConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  /** Set when a post-OAuth status read disagrees with the OAuth we just completed. */
  const [needsManualRefresh, setNeedsManualRefresh] = useState(false);

  const popupRef    = useRef<Window | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Second interval: the browser-channel backstop, cleared alongside pollRef. */
  const localPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef  = useRef(false); // prevent double-processing from both channels

  // ── Fetch live status ──────────────────────────────────────────────────────

  /**
   * Mirror of `status` for the OAuth callbacks. They are memoised on [cleanup]
   * so the state they close over is frozen at first render (null); reading the
   * ref gives them the current value without making them unstable — the
   * listeners registered in handleConnect must keep one identity to be
   * removable.
   */
  const statusRef = useRef<FacebookConnectionStatus | null>(null);

  /**
   * Same reason as statusRef: the OAuth callbacks are memoised on [cleanup], so
   * they would otherwise keep calling the FIRST render's onConnected. The parent
   * rebuilds that closure on every render, so after one connect the component
   * held a stale callback and the parent's card stopped updating — the "still
   * needs a reload" report, which only reproduced on a second connect within the
   * same page session.
   */
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
  });

  /** Set just below; settleAfterConnect is declared first and calls it via this ref. */
  const refreshStatusRef = useRef<(force?: boolean) => Promise<FacebookConnectionStatus | null>>(
    async () => null,
  );

  /**
   * Settle the UI after a successful connect.
   *
   * Re-reads status (forced — the backend serves a 6h-stale view otherwise) and
   * notifies the parent. If the fresh read still disagrees with the OAuth that
   * just succeeded, surfaces a visible "refresh to see it" prompt rather than
   * leaving the user guessing. The normal path updates in place.
   */
  const settleAfterConnect = useCallback(async (connectedPages: FacebookOAuthPage[]) => {
    const fresh = await refreshStatusRef.current(true);
    setStep('done');
    onConnectedRef.current?.(connectedPages);

    // If the freshly-read status still says "not connected" right after a
    // successful OAuth, the page and the server have genuinely diverged. Ask
    // rather than reloading underneath the user — an unannounced reload during
    // a flow they just completed reads as the app losing their work.
    setNeedsManualRefresh(!fresh || fresh.overall_status === 'not_connected');
  }, []);

  const refreshStatus = useCallback(async (forceRefresh = false) => {
    setStatusLoading(true);
    try {
      const data = await facebookOAuthService.getStatus(forceRefresh);
      setStatus(data);
      statusRef.current = data;
      return data;
    } catch {
      // Keep the last known status rather than falling back to null: null renders
      // as 'not_connected', so a transient failure (expired token, dropped
      // request) made a connected account look disconnected. Returning null still
      // signals the failure to settleAfterConnect, which surfaces the refresh
      // prompt instead of silently showing the wrong state.
      return null;
    } finally {
      setStatusLoading(false);
    }
  }, []);

  refreshStatusRef.current = refreshStatus;

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  /**
   * Listeners are registered through refs rather than the `handleMessage` /
   * `handleStorage` bindings directly.
   *
   * `cleanup` is declared before those two callbacks, so the identities it
   * captured were not the ones `handleConnect` later passed to
   * addEventListener — removeEventListener silently did nothing and every
   * reconnect attempt stacked another live listener on window. Holding the
   * exact registered function in a ref guarantees add/remove use one identity.
   */
  const msgListenerRef  = useRef<((e: MessageEvent) => void) | null>(null);
  const strListenerRef  = useRef<((e: StorageEvent) => void) | null>(null);
  const channelRef      = useRef<BroadcastChannel | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (localPollRef.current) {
      clearInterval(localPollRef.current);
      localPollRef.current = null;
    }
    if (msgListenerRef.current) {
      window.removeEventListener('message', msgListenerRef.current);
      msgListenerRef.current = null;
    }
    if (strListenerRef.current) {
      window.removeEventListener('storage', strListenerRef.current);
      strListenerRef.current = null;
    }
    if (channelRef.current) {
      try { channelRef.current.close(); } catch { /* already closed */ }
      channelRef.current = null;
    }
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

      // Skip messenger setup if feature is disabled.
      // Read through the ref: this callback is memoised on [cleanup], so the
      // `status` captured in its closure is the first-render value (null) and
      // this branch could never be taken.
      if (statusRef.current?.messenger_enabled === false) {
        setStep('refreshing');
        // force=true — the OAuth we just completed changed the connection, but
        // the backend only re-validates tokens older than 6h unless forced, so
        // an unforced read returns the pre-connect state and the card keeps
        // saying "Reconnect" until a manual page reload.
        settleAfterConnect(receivedPages);
      } else if (activePages.length === 1) {
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

  // ── Step 2a — localStorage channel ────────────────────────────────────────
  //
  // NOTE: the 'storage' event only fires in OTHER tabs of the origin, never in
  // the tab that wrote the value. So when the popup is same-origin with the app
  // (single-port deployment, or through the ngrok tunnel) this never fires and
  // the connect flow appeared to hang until a manual reload. It still covers
  // the cross-origin-tab case; BroadcastChannel below covers the same-origin one.

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
    setNeedsManualRefresh(false);
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
      // Listen on both channels — whichever fires first wins.
      // Stash the exact functions we register so cleanup() can remove these
      // very instances (see the note on msgListenerRef).
      cleanup();
      msgListenerRef.current = handleMessage;
      strListenerRef.current = handleStorage;
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      // Same-origin channel. Unlike 'storage', BroadcastChannel delivers to the
      // opener when the popup shares this origin — the single-port case, which
      // is exactly when the other two channels go silent.
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('fb_oauth');
          bc.onmessage = (ev) => {
            if (ev.data?.type?.startsWith('FB_OAUTH_')) processOAuthResult(ev.data);
          };
          channelRef.current = bc;
        }
      } catch { /* unsupported — the other channels still apply */ }

      // Backstop: poll the SERVER, not just the browser channels.
      //
      // Every other channel (postMessage, BroadcastChannel, localStorage) needs
      // the popup's own JS to run and reach us. In practice that kept failing —
      // the callback returned 200 and then nothing arrived — so the flow stalled
      // even though the account was already saved server-side. Asking the API
      // whether we are connected yet depends on none of that: if the connection
      // exists, we see it, whatever the popup did.
      const wasConnected = statusRef.current?.overall_status !== 'not_connected';
      const baselinePages = statusRef.current?.facebook?.pages ?? [];
      const baselinePageIds = baselinePages.map((p) => p.page_id).sort().join(',');
      // Newest connected_at we have seen so far; the callback rewrites it.
      const baselineConnectedAt = baselinePages.reduce((max, p) => {
        const t = p.connected_at ? new Date(p.connected_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);

      pollRef.current = setInterval(() => {
        void (async () => {
          if (handledRef.current) return;

          const fresh = await facebookOAuthService.getStatus(true).catch(() => null);
          if (!fresh || handledRef.current) return;

          const nowConnected = fresh.overall_status !== 'not_connected';
          const pages = fresh.facebook?.pages ?? [];

          // Reconnects start already-connected, so "is connected" alone proves
          // nothing new happened. Compare the set of page IDs instead of
          // timestamps: `?refresh=1` re-validates on every call, so
          // last_validated_at advances purely because we polled, which would
          // fire on the very first tick regardless of the popup.
          const ids = pages.map((p) => p.page_id).sort().join(',');
          const gainedPages = ids !== baselinePageIds;

          // A reconnect ends with the same pages it started with, so neither
          // signal above fires. `connected_at` is rewritten by the OAuth
          // callback (and by nothing else), which makes it the one field that
          // proves a new grant landed.
          const reconnected = pages.some((p) => {
            if (!p.connected_at) return false;
            return new Date(p.connected_at).getTime() > baselineConnectedAt;
          });

          if (nowConnected && (!wasConnected || gainedPages || reconnected)) {
            handledRef.current = true;
            cleanup();
            setStatus(fresh);
            statusRef.current = fresh;
            setPages([]);
            setStep('done');
            setNeedsManualRefresh(false);
            onConnectedRef.current?.([]);
            try { localStorage.removeItem('fb_oauth_result'); } catch { /* ignore */ }
          }
        })();
      }, 2000);

      // Secondary: the original browser-channel backstop, kept because it reacts
      // faster than the server poll when the popup does manage to talk to us.
      localPollRef.current = setInterval(() => {
        const stored = localStorage.getItem('fb_oauth_result');
        if (stored) {
          try {
            const data = JSON.parse(stored);
            localStorage.removeItem('fb_oauth_result');
            if (data?.type?.startsWith('FB_OAUTH_')) {
              processOAuthResult(data);
              return;
            }
          } catch { /* fall through to the closed-popup check */ }
        }

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
      // force=true — see refreshStatus(true) in processOAuthResult: an unforced
      // read is served from the backend's 6h validation window and would still
      // describe the connection as it was before this OAuth run.
      setStep('refreshing');
      await settleAfterConnect(allPages);
    }
  };

  const handlePickerSelect = (page: FacebookOAuthPage) => doSetupMessenger(page, pages);
  const handlePickerSkip   = async () => {
    setStep('refreshing');
    await settleAfterConnect(pages);
  };

  // ── Disconnect ────────────────────────────────────────────────────────────

  /**
   * Revokes Facebook, Instagram and Messenger together — they are granted on a
   * single consent screen, so unlinking one alone leaves a half-connected state.
   */
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await facebookOAuthService.disconnect();
      setConfirmDisconnect(false);
      setPages([]);
      setWarning('');
      setOAuthError(null);
      setStep('idle');
      await refreshStatus(true);
      onDisconnectedRef.current?.();
    } catch (err) {
      setOAuthError({
        title: 'Could not disconnect',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setDisconnecting(false);
    }
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
          disabled={isLoading || disconnecting}
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

        {/* Explicit success confirmation.
            Once connected the button reads "Reconnect Facebook" and a Disconnect
            button appears — which is the correct connected state, but it looks
            almost identical to the pre-click state, so a successful connect gave
            no visible acknowledgement and read as "nothing happened". This says
            plainly that it worked, and what was linked. */}
        {/* Divergence fallback — the connect succeeded but this page still reads
            as disconnected. Offer the reload explicitly instead of doing it
            silently, so the user knows why the page is about to jump. */}
        {needsManualRefresh && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-300">Connected — refresh to see it</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                Your Facebook account was connected, but this page is still showing the
                old status. Refresh to bring it up to date.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Refresh page
              </button>
            </div>
          </div>
        )}

        {step === 'done' && !oauthError && !needsManualRefresh && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-green-500/10 border border-green-500/20"
          >
            <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-green-400">Connected successfully</p>
              <p className="text-[11px] text-green-300/80 mt-0.5 leading-relaxed">
                {status?.facebook?.active_pages
                  ? `${status.facebook.active_pages} Facebook Page${status.facebook.active_pages > 1 ? 's' : ''} linked`
                  : 'Your Facebook account is linked'}
                {status?.instagram?.total ? ` · Instagram linked` : ''}
                {status?.messenger?.connected ? ` · Messenger linked` : ''}
                . The status below is live — no need to refresh the page.
              </p>
            </div>
          </motion.div>
        )}

        {/* Says out loud what one consent screen actually grants, so users don't
            go looking for separate Instagram / Messenger connect buttons. */}
        {overall === 'not_connected' && (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            One Facebook login connects your Facebook Pages, your Instagram Business
            account and your Messenger bot. They are granted together on Facebook's
            consent screen — there is nothing to connect separately.
          </p>
        )}

        {/* Disconnect — only meaningful once something is linked. Revokes
            Facebook, Instagram and Messenger together, matching how they were
            granted. Two-step so a stray click can't unlink everything. */}
        {overall !== 'not_connected' && !confirmDisconnect && (
          <button
            onClick={() => setConfirmDisconnect(true)}
            disabled={isLoading || disconnecting}
            title="Disconnect Facebook, Instagram and Messenger from SellAnto"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <TrashIcon className="w-4 h-4" />
            Disconnect
          </button>
        )}

        <AnimatePresence>
          {confirmDisconnect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl bg-red-500/10 border border-red-500/20 p-3"
            >
              <p className="text-xs font-semibold text-red-300">
                Disconnect Facebook, Instagram and Messenger?
              </p>
              <p className="text-[11px] text-red-300/80 mt-1 leading-relaxed">
                SellAnto will revoke the access tokens it stored for your Facebook Pages,
                Instagram Business account and Messenger bot, and will stop publishing to
                them. Scheduled posts for these accounts will not be published. Nothing
                already posted is deleted, and you can reconnect at any time.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white
                    hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                </button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  disabled={disconnecting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300
                    border border-white/10 hover:border-white/20 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <div key={ig.ig_account_id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* IG CDN URLs are signed and expire, so fall back to the
                            placeholder if the image fails to load. The source is
                            1080x1080, so we hand the browser a 2x intrinsic size and let
                            it downscale once — keeps a wordmark avatar legible at 40px. */}
                        {ig.profile_picture_url ? (
                          <img
                            src={ig.profile_picture_url}
                            alt={`${ig.username ?? ig.account_name} profile picture`}
                            title="Instagram profile picture"
                            referrerPolicy="no-referrer"
                            width={80}
                            height={80}
                            decoding="async"
                            className="w-10 h-10 rounded-full object-cover border border-slate-600 shrink-0 bg-slate-700 [image-rendering:auto]"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = 'none';
                              img.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] text-slate-400 shrink-0 ${
                            ig.profile_picture_url ? 'hidden' : ''
                          }`}
                        >
                          IG
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-xs text-slate-200 truncate"
                            title="Connected Instagram Business account"
                          >
                            {ig.username ? `@${ig.username}` : ig.account_name}
                          </div>
                          {(ig.followers_count != null || ig.media_count != null) && (
                            <div
                              className="text-[10px] text-slate-400 truncate"
                              title="Follower and post counts for this Instagram Business account"
                            >
                              {ig.followers_count != null &&
                                `${ig.followers_count.toLocaleString()} followers`}
                              {ig.followers_count != null && ig.media_count != null && ' · '}
                              {ig.media_count != null &&
                                `${ig.media_count.toLocaleString()} posts`}
                            </div>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={ig.status} label={ig.status_display} />
                    </div>
                  ))
                )}
              </StatusSection>

              {/* Messenger Bot — hidden when feature disabled */}
              {status.messenger_enabled !== false && (
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
              )}

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
