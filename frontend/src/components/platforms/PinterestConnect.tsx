/**
 * PinterestConnect — One-click OAuth connect (mirrors FacebookConnect/LinkedInConnect)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { pinterestOAuthService } from '../../services/pinterestOAuthService';
import type {
  PinterestOAuthAccount,
  PinterestConnectionStatus,
} from '../../services/pinterestOAuthService';

type Step = 'idle' | 'opening' | 'waiting' | 'refreshing' | 'done' | 'error';

interface Props {
  onConnected?: (account?: PinterestOAuthAccount) => void;
  buttonLabel?: string;
  compact?: boolean;
}

const OVERALL_CFG = {
  fully_connected:     { dot: 'bg-green-400',  label: 'Connected',          text: 'text-green-400',  ring: 'border-green-500/20 bg-green-500/5' },
  partially_connected: { dot: 'bg-amber-400',  label: 'Partially Connected', text: 'text-amber-400',  ring: 'border-amber-500/20 bg-amber-500/5' },
  needs_attention:     { dot: 'bg-red-400',    label: 'Needs Attention',     text: 'text-red-400',    ring: 'border-red-500/20 bg-red-500/5' },
  not_connected:       { dot: 'bg-slate-500',  label: 'Not Connected',       text: 'text-slate-400',  ring: 'border-white/5 bg-white/[0.02]' },
};

const STATUS_TEXT: Record<string, string> = {
  active: 'text-green-400', expired: 'text-red-400', invalid: 'text-red-400', disconnected: 'text-slate-400',
};

export function PinterestConnect({ onConnected, buttonLabel, compact = false }: Props) {
  const [step, setStep]             = useState<Step>('idle');
  const [oauthError, setOAuthError] = useState<{ title: string; detail: string } | null>(null);
  const [warning, setWarning]       = useState('');
  const [status, setStatus]         = useState<PinterestConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const popupRef   = useRef<Window | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  const refreshStatus = useCallback(async (forceRefresh = false) => {
    setStatusLoading(true);
    try {
      const data = await pinterestOAuthService.getStatus(forceRefresh);
      setStatus(data);
    } catch { /* silent */ } finally { setStatusLoading(false); }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const processOAuthResult = useCallback((data: any) => {
    if (handledRef.current) return;
    handledRef.current = true;
    cleanup();

    if (data.type === 'PIN_OAUTH_SUCCESS') {
      if (data.warning) setWarning(data.warning);
      setStep('refreshing');
      refreshStatus(true).then(() => {
        setStep('done');
        onConnected?.(data.account);
      });
    } else if (data.type === 'PIN_OAUTH_ERROR') {
      setOAuthError({ title: data.title || 'Connection Failed', detail: data.detail || 'Please try again.' });
      setStep('error');
    }
  }, [cleanup, refreshStatus, onConnected]);

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key !== 'pin_oauth_result' || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      localStorage.removeItem('pin_oauth_result');
      if (data?.type?.startsWith('PIN_OAUTH_')) processOAuthResult(data);
    } catch { /* ignore */ }
  }, [processOAuthResult]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin;
    if (event.origin !== apiBase && event.origin !== window.location.origin) return;
    if (!event.data?.type?.startsWith('PIN_OAUTH_')) return;
    processOAuthResult(event.data);
  }, [processOAuthResult]);

  const handleConnect = async () => {
    setOAuthError(null); setWarning(''); setStep('opening'); handledRef.current = false;
    localStorage.removeItem('pin_oauth_result');

    try {
      const { auth_url } = await pinterestOAuthService.initiate();
      const W = 650, H = 700;
      const left = window.screenX + Math.round((window.outerWidth - W) / 2);
      const top  = window.screenY + Math.round((window.outerHeight - H) / 2);

      popupRef.current = window.open(auth_url, 'pin_oauth', `width=${W},height=${H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`);
      if (!popupRef.current || popupRef.current.closed) {
        setOAuthError({ title: 'Popup Blocked', detail: 'Allow popups for this site, then try again.' });
        setStep('error'); return;
      }

      setStep('waiting');
      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          setTimeout(() => {
            const stored = localStorage.getItem('pin_oauth_result');
            if (stored) {
              try { const d = JSON.parse(stored); localStorage.removeItem('pin_oauth_result'); if (d?.type?.startsWith('PIN_OAUTH_')) processOAuthResult(d); return; } catch { /* */ }
            }
            cleanup();
            setStep((prev) => (prev === 'waiting' ? 'idle' : prev));
          }, 300);
        }
      }, 500);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to start Pinterest connection.';
      setOAuthError({ title: 'Connection Failed', detail: msg });
      setStep('error');
    }
  };

  const isLoading   = ['opening', 'waiting', 'refreshing'].includes(step);
  const overall     = status?.overall_status ?? 'not_connected';
  const cfg         = OVERALL_CFG[overall];
  const isConnected = overall !== 'not_connected';
  const effectiveLabel = buttonLabel ?? (isConnected ? 'Reconnect Pinterest' : 'Connect Pinterest');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <button onClick={handleConnect} disabled={isLoading}
          className={`relative flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-white transition-all duration-200 overflow-hidden
            ${isLoading ? 'bg-[#E60023]/60 cursor-wait' : 'bg-[#E60023] hover:bg-[#CC001F] hover:shadow-lg hover:shadow-[#E60023]/20 active:scale-[0.98]'}
            ${compact ? 'text-sm py-2 px-4' : 'text-base'}`}
        >
          {/* Pinterest icon */}
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/>
          </svg>

          {isLoading ? (
            <><ArrowPathIcon className="w-4 h-4 animate-spin" />
              {step === 'opening' && 'Opening Pinterest...'}
              {step === 'waiting' && 'Waiting for authorization...'}
              {step === 'refreshing' && 'Finishing setup...'}
            </>
          ) : effectiveLabel}
        </button>

        {step === 'done' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircleIcon className="w-4 h-4" /><span>Pinterest connected successfully!</span>
          </motion.div>
        )}

        {warning && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" /><span>{warning}</span>
          </motion.div>
        )}

        <AnimatePresence>
          {step === 'error' && oauthError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <XCircleIcon className="w-4 h-4" />{oauthError.title}
              </div>
              <p className="text-red-300/70 text-xs pl-6">{oauthError.detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Card */}
      {!statusLoading && status && status.overall_status !== 'not_connected' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`border rounded-xl p-4 space-y-3 ${cfg.ring}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
            </div>
            <button onClick={() => refreshStatus(true)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
              <ArrowPathIcon className="w-3 h-3" /> Refresh
            </button>
          </div>

          {status.accounts.map((acc) => (
            <div key={acc.account_id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#E60023]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/>
                </svg>
                <span className="text-slate-200">{acc.name}</span>
              </div>
              <span className={`text-xs font-medium ${STATUS_TEXT[acc.status] || 'text-slate-400'}`}>
                {acc.status_display}
              </span>
            </div>
          ))}

          {status.accounts.filter(a => a.error_message && a.status !== 'active').map(a => (
            <div key={`err-${a.account_id}`} className="text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-2">
              <span className="font-medium">{a.name}:</span> {a.error_message}
            </div>
          ))}

          {status.accounts[0]?.token_expires_at && (() => {
            const daysLeft = Math.ceil((new Date(status.accounts[0].token_expires_at!).getTime() - Date.now()) / (1000*60*60*24));
            if (daysLeft <= 0) return <div className="text-xs text-red-400 pt-1 border-t border-white/5">Token expired. Reconnect Pinterest.</div>;
            if (daysLeft <= 7) return <div className="text-xs text-amber-400 pt-1 border-t border-white/5">Token expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.</div>;
            return <div className="text-xs text-slate-500 pt-1 border-t border-white/5">Token expires: {new Date(status.accounts[0].token_expires_at!).toLocaleDateString()}</div>;
          })()}
        </motion.div>
      )}
    </div>
  );
}

export default PinterestConnect;
