/**
 * AdAccountsStatus
 * ================
 * Displays the user's connected Meta Ad Accounts.
 *
 * Auto-populated by the FB OAuth callback (see platforms/oauth_views.py
 * → _auto_discover_ad_accounts). After clicking "Connect Facebook" and
 * approving ads scopes, ad accounts appear here.
 *
 * Empty state means either OAuth not run yet, ads scopes were denied,
 * or the user has no Meta ad accounts on their Business Manager.
 */
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MegaphoneIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  RocketLaunchIcon,
  FilmIcon,
} from '@heroicons/react/24/outline';
import { adsService, type AdAccount } from '../../services/adsService';
import { BoostPostModal } from '../ads/BoostPostModal';
import { RunVideoAdModal } from '../ads/RunVideoAdModal';

interface Props {
  /** External trigger to refetch — bump this number after FB OAuth completes. */
  refreshKey?: number;
}

export function AdAccountsStatus({ refreshKey = 0 }: Props) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [videoAdModalOpen, setVideoAdModalOpen] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adsService.listAdAccounts();
      setAccounts(data.accounts || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load ad accounts.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, refreshKey]);

  return (
    <section className="rounded-2xl border border-white/10 bg-dark-800/60 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
            <MegaphoneIcon className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Meta Ad Accounts</h3>
            <p className="text-[11px] text-text-muted">
              Auto-discovered from your Facebook connection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
              accounts.length > 0
                ? 'bg-success/15 text-success'
                : 'bg-white/5 text-text-muted'
            }`}
          >
            {accounts.length} connected
          </span>
          <button
            onClick={fetchAccounts}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <ArrowPathIcon
              className={`w-4 h-4 text-text-muted ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Permission banner */}
      <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-4">
        <CheckCircleIcon className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-purple-300">ads_management &amp; ads_read active</p>
          <p className="text-[10px] text-purple-400/80 mt-0.5">
            SellAnto reads your ad performance and manages campaigns on your connected Meta ad accounts. Sandbox (test) accounts are labelled below.
          </p>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <ExclamationCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : isLoading && accounts.length === 0 ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-dark-900/40 border border-dashed border-white/10">
          <p className="text-sm text-text-secondary font-medium">
            No ad accounts connected yet
          </p>
          <p className="text-[11px] text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Click <span className="text-primary font-semibold">Connect Facebook</span> above
            and approve the <code className="text-warning bg-dark-900 px-1.5 py-0.5 rounded">ads_management</code>{' '}
            permission. Your Meta Business Suite ad accounts will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {accounts.map((acc) => (
              <motion.li
                key={acc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-dark-900/40 border border-white/5 hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircleIcon className="w-4 h-4 text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate flex items-center gap-2">
                      <span className="truncate">{acc.name || `Ad Account ${acc.external_id}`}</span>
                      {acc.is_sandbox ? (
                        <span
                          className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold uppercase tracking-wide"
                          title="Meta sandbox ad account — test only, no real spend or delivery"
                        >
                          Sandbox
                        </span>
                      ) : acc.account_status != null ? (
                        <span
                          className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold uppercase tracking-wide"
                          title="Live ad account — real campaigns spend real money"
                        >
                          Live
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-text-muted font-mono truncate">
                      act_{acc.external_id}
                      {acc.currency_code && ` · ${acc.currency_code}`}
                      {acc.timezone_name && ` · ${acc.timezone_name}`}
                    </p>
                    {acc.business_id && (
                      <p className="text-[10px] text-text-muted/70 truncate flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold uppercase">BM</span>
                        {acc.business_name || `Business ${acc.business_id}`}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${
                    acc.is_active ? 'text-success' : 'text-text-muted'
                  }`}
                >
                  {acc.is_active ? 'Active' : 'Inactive'}
                </span>
              </motion.li>
            ))}
          </ul>

          {/* Two CTAs — only shown when at least one ad account is connected */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setVideoAdModalOpen(true)}
              className="py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <FilmIcon className="w-4 h-4" />
              Run Video Ad
            </button>
            <button
              onClick={() => setBoostModalOpen(true)}
              className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
            >
              <RocketLaunchIcon className="w-4 h-4" />
              Boost an Existing Post
            </button>
          </div>
        </>
      )}

      {/* Boost existing post modal */}
      <BoostPostModal
        isOpen={boostModalOpen}
        onClose={() => setBoostModalOpen(false)}
        onSuccess={() => {
          // Optional: bump local state, show toast, refresh campaigns list
        }}
      />

      {/* Run video ad modal (Path A — publish + boost in one click) */}
      <RunVideoAdModal
        isOpen={videoAdModalOpen}
        onClose={() => setVideoAdModalOpen(false)}
        onSuccess={fetchAccounts}
      />
    </section>
  );
}

export default AdAccountsStatus;
