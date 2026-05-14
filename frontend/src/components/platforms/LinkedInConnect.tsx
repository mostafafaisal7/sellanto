/**
 * LinkedInConnect
 * ================
 * Two independent OAuth flows in one component:
 *   - Personal LinkedIn (Sign In with LinkedIn + Share on LinkedIn)
 *   - Company Pages     (Community Management API)
 *
 * Each has its own popup, localStorage key, and message type so they
 * never interfere with each other.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XCircleIcon,
  BuildingOffice2Icon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { linkedinOAuthService } from '../../services/linkedinOAuthService';
import type {
  LinkedInOAuthAccount,
  LinkedInConnectionStatus,
} from '../../services/linkedinOAuthService';

// ── Types ──────────────────────────────────────────────────────────────────────

type FlowStep = 'idle' | 'opening' | 'waiting' | 'refreshing' | 'done' | 'error';

interface OAuthError { title: string; detail: string; }

interface Props {
  onConnected?: (accounts: LinkedInOAuthAccount[]) => void;
  compact?: boolean;
}

// ── Status config ─────────────────────────────────────────────────────────────

const OVERALL_CFG = {
  fully_connected:     { dot: 'bg-green-400',  label: 'Fully Connected',     text: 'text-green-400',  ring: 'border-green-500/20 bg-green-500/5' },
  partially_connected: { dot: 'bg-amber-400',  label: 'Partially Connected', text: 'text-amber-400',  ring: 'border-amber-500/20 bg-amber-500/5' },
  needs_attention:     { dot: 'bg-red-400',    label: 'Needs Attention',      text: 'text-red-400',    ring: 'border-red-500/20 bg-red-500/5' },
  not_connected:       { dot: 'bg-slate-500',  label: 'Not Connected',        text: 'text-slate-400',  ring: 'border-white/5 bg-white/[0.02]' },
};

const STATUS_TEXT: Record<string, string> = {
  active: 'text-green-400', expired: 'text-red-400',
  invalid: 'text-red-400',  disconnected: 'text-slate-400',
};

// ── LinkedIn SVG icon ─────────────────────────────────────────────────────────

const LiIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// ── useOAuthPopup hook — reusable for both flows ──────────────────────────────

function useOAuthPopup(opts: {
  lsKey: string;
  successType: string;
  errorType: string;
  initiateRequest: () => Promise<{ auth_url: string }>;
  onSuccess: (accounts: LinkedInOAuthAccount[]) => void;
}) {
  const [step, setStep]         = useState<FlowStep>('idle');
  const [error, setError]       = useState<OAuthError | null>(null);
  const [warning, setWarning]   = useState('');
  const popupRef   = useRef<Window | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const processResult = useCallback((data: any) => {
    if (handledRef.current) return;
    handledRef.current = true;
    cleanup();

    if (data.type === opts.successType) {
      const received: LinkedInOAuthAccount[] = data.accounts || [];
      if (data.warning) setWarning(data.warning);
      if (!received.length) {
        setError({ title: 'No Account Connected', detail: 'Please try again.' });
        setStep('error');
        return;
      }
      setStep('refreshing');
      opts.onSuccess(received);
    } else if (data.type === opts.errorType) {
      setError({ title: data.title || 'Connection Failed', detail: data.detail || 'Please try again.' });
      setStep('error');
    }
  }, [cleanup, opts]);

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== opts.lsKey || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem(opts.lsKey);
      if (data?.type?.startsWith('LI_')) processResult(data);
    } catch { /* ignore */ }
  }, [opts.lsKey, processResult]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin;
    if (event.origin !== apiBase && event.origin !== window.location.origin) return;
    if (!event.data?.type?.startsWith('LI_')) return;
    processResult(event.data);
  }, [processResult]);

  const connect = useCallback(async () => {
    setError(null);
    setWarning('');
    setStep('opening');
    handledRef.current = false;
    localStorage.removeItem(opts.lsKey);

    try {
      const { auth_url } = await opts.initiateRequest();
      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth  - W) / 2);
      const top  = window.screenY + Math.round((window.outerHeight - H) / 2);

      popupRef.current = window.open(
        auth_url, `li_oauth_${opts.lsKey}`,
        `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      if (!popupRef.current || popupRef.current.closed) {
        setError({ title: 'Popup Blocked', detail: 'Allow popups for this site, then try again.' });
        setStep('error');
        return;
      }

      setStep('waiting');
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          setTimeout(() => {
            const stored = localStorage.getItem(opts.lsKey);
            if (stored) {
              try {
                const data = JSON.parse(stored);
                localStorage.removeItem(opts.lsKey);
                if (data?.type?.startsWith('LI_')) { processResult(data); return; }
              } catch { /* ignore */ }
            }
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('storage', handleStorage);
            cleanup();
            setStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          }, 300);
        }
      }, 500);

    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to start connection.';
      const isMissing = err?.response?.data?.config_missing;
      setError({
        title:  isMissing ? 'Not Configured' : 'Connection Failed',
        detail: isMissing
          ? 'This LinkedIn app has not been configured yet. Ask the admin to set it up in Admin Panel → LinkedIn Settings.'
          : msg,
      });
      setStep('error');
    }
  }, [opts, handleMessage, handleStorage, processResult, cleanup]);

  return { step, setStep, error, warning, connect };
}

// ── Main component ────────────────────────────────────────────────────────────

export function LinkedInConnect({ onConnected, compact = false }: Props) {
  const [status, setStatus]           = useState<LinkedInConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const refreshStatus = useCallback(async (force = false) => {
    setStatusLoading(true);
    try {
      const data = await linkedinOAuthService.getStatus(force);
      setStatus(data);
    } catch { /* silent */ }
    finally { setStatusLoading(false); }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // ── Personal flow ──────────────────────────────────────────────────────────
  const personal = useOAuthPopup({
    lsKey:           'li_oauth_result',
    successType:     'LI_OAUTH_SUCCESS',
    errorType:       'LI_OAUTH_ERROR',
    initiateRequest: () => linkedinOAuthService.initiate(),
    onSuccess: (accounts) => {
      refreshStatus(true).then(() => {
        personal.setStep('done');
        onConnected?.(accounts);
      });
    },
  });

  // ── Community flow ─────────────────────────────────────────────────────────
  const community = useOAuthPopup({
    lsKey:           'li_community_oauth_result',
    successType:     'LI_COMMUNITY_SUCCESS',
    errorType:       'LI_COMMUNITY_ERROR',
    initiateRequest: () => linkedinOAuthService.inititateCommunity(),
    onSuccess: (accounts) => {
      refreshStatus(true).then(() => {
        community.setStep('done');
        onConnected?.(accounts);
      });
    },
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const overall    = status?.overall_status ?? 'not_connected';
  const cfg        = OVERALL_CFG[overall];
  const isConnected = overall !== 'not_connected';

  const personalLoading  = ['opening', 'waiting', 'refreshing'].includes(personal.step);
  const communityLoading = ['opening', 'waiting', 'refreshing'].includes(community.step);

  return (
    <div className="space-y-4">

      {/* ── Two connect buttons ─────────────────────────────────────────────── */}
      <div className={`flex gap-3 ${compact ? 'flex-col' : 'flex-col sm:flex-row'}`}>

        {/* Personal */}
        <button
          onClick={personal.connect}
          disabled={personalLoading}
          className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold
            text-white transition-all duration-200
            ${personalLoading
              ? 'bg-[#0077B5]/60 cursor-wait'
              : 'bg-[#0077B5] hover:bg-[#006195] hover:shadow-lg hover:shadow-[#0077B5]/20 active:scale-[0.98]'
            } ${compact ? 'text-sm py-2 px-4' : 'text-sm'}`}
        >
          <LiIcon />
          <UserCircleIcon className="w-4 h-4 opacity-70" />
          {personalLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {personal.step === 'opening' ? 'Opening...' : personal.step === 'waiting' ? 'Waiting...' : 'Finishing...'}
            </>
          ) : (
            status?.personal ? 'Reconnect Personal' : 'Connect Personal'
          )}
        </button>

        {/* Company Page */}
        <button
          onClick={community.connect}
          disabled={communityLoading}
          className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold
            text-white transition-all duration-200
            ${communityLoading
              ? 'bg-[#004471]/60 cursor-wait'
              : 'bg-[#004471] hover:bg-[#003358] hover:shadow-lg hover:shadow-[#004471]/20 active:scale-[0.98]'
            } ${compact ? 'text-sm py-2 px-4' : 'text-sm'}`}
        >
          <LiIcon />
          <BuildingOffice2Icon className="w-4 h-4 opacity-70" />
          {communityLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {community.step === 'opening' ? 'Opening...' : community.step === 'waiting' ? 'Waiting...' : 'Finishing...'}
            </>
          ) : (
            status?.organizations?.length ? 'Reconnect Company Page' : 'Connect Company Page'
          )}
        </button>
      </div>

      {/* ── Success / warning / error toasts ────────────────────────────────── */}
      <AnimatePresence>
        {personal.step === 'done' && (
          <motion.div key="p-done" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircleIcon className="w-4 h-4" />
            Personal LinkedIn connected!
          </motion.div>
        )}
        {community.step === 'done' && (
          <motion.div key="c-done" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircleIcon className="w-4 h-4" />
            Company Page connected!
          </motion.div>
        )}
        {personal.warning && (
          <motion.div key="p-warn" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            {personal.warning}
          </motion.div>
        )}
        {personal.step === 'error' && personal.error && (
          <motion.div key="p-err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <XCircleIcon className="w-4 h-4" /> {personal.error.title}
            </div>
            <p className="text-red-300/70 text-xs pl-6">{personal.error.detail}</p>
          </motion.div>
        )}
        {community.step === 'error' && community.error && (
          <motion.div key="c-err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <XCircleIcon className="w-4 h-4" /> {community.error.title}
            </div>
            <p className="text-red-300/70 text-xs pl-6">{community.error.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status card ─────────────────────────────────────────────────────── */}
      {!statusLoading && status && isConnected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`border rounded-xl p-4 space-y-3 ${cfg.ring}`}>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
            </div>
            <button
              onClick={() => refreshStatus(true)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowPathIcon className="w-3 h-3" /> Refresh
            </button>
          </div>

          {/* Personal profile row */}
          {status.personal && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <UserCircleIcon className="w-4 h-4 text-[#0077B5]" />
                <span className="text-slate-200">{status.personal.name}</span>
                <span className="text-xs text-slate-500">Personal</span>
              </div>
              <span className={`text-xs font-medium ${STATUS_TEXT[status.personal.status] || 'text-slate-400'}`}>
                {status.personal.status_display}
              </span>
            </div>
          )}

          {/* Company Page rows */}
          {status.organizations.map((org) => (
            <div key={org.account_id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <BuildingOffice2Icon className="w-4 h-4 text-[#004471]" />
                <span className="text-slate-200">{org.name}</span>
                <span className="text-xs text-slate-500">Company Page</span>
              </div>
              <span className={`text-xs font-medium ${STATUS_TEXT[org.status] || 'text-slate-400'}`}>
                {org.status_display}
              </span>
            </div>
          ))}

          {/* Error messages */}
          {status.accounts
            .filter((a) => a.error_message && a.status !== 'active')
            .map((a) => (
              <div key={`err-${a.account_id}`} className="text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-2">
                <span className="font-medium">{a.name}:</span> {a.error_message}
              </div>
            ))
          }

          {/* Token expiry warning (personal) */}
          {status.personal?.token_expires_at && (() => {
            const daysLeft = Math.ceil(
              (new Date(status.personal!.token_expires_at!).getTime() - Date.now()) / 86400000
            );
            if (daysLeft <= 0) return (
              <div className="text-xs text-red-400 pt-1 border-t border-white/5">
                Personal token expired. Click "Reconnect Personal" to fix.
              </div>
            );
            if (daysLeft <= 7) return (
              <div className="text-xs text-amber-400 pt-1 border-t border-white/5">
                Personal token expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}. Reconnect soon.
              </div>
            );
            return (
              <div className="text-xs text-slate-500 pt-1 border-t border-white/5">
                Personal token expires: {new Date(status.personal!.token_expires_at!).toLocaleDateString()}
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}

export default LinkedInConnect;
