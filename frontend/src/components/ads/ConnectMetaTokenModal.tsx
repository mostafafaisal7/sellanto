/**
 * ConnectMetaTokenModal
 * =====================
 * Manually connect a Meta ad account by pasting a User access token
 * (e.g. from Graph API Explorer). Fallback to the automatic FB-OAuth
 * discovery — useful for testing / sandbox accounts.
 *
 * Calls adsService.connectMeta → POST /ads/accounts/connect-meta/.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, KeyIcon } from '@heroicons/react/24/outline';
import { adsService } from '../../services/adsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConnectMetaTokenModal({ isOpen, onClose, onSuccess }: Props) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const submit = async () => {
    if (!token.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await adsService.connectMeta(token.trim());
      const n = res.count ?? res.connected?.length ?? 0;
      setResult({ type: 'success', message: `Connected ${n} ad account${n === 1 ? '' : 's'}.` });
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setResult({ type: 'error', message: e?.response?.data?.error || 'Failed to connect. Check the token and its ads permissions.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-[#12121f] border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-purple-300" />
            <h2 className="text-base font-bold text-text-primary">Connect ad account by token</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <XMarkIcon className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-text-muted leading-relaxed">
            Paste a Meta <span className="text-text-secondary font-semibold">User access token</span> that has
            <code className="mx-1 px-1 rounded bg-dark-900 text-warning">ads_read</code>/
            <code className="mx-1 px-1 rounded bg-dark-900 text-warning">ads_management</code>.
            Ad accounts on the token are discovered and connected. Normally accounts connect automatically via
            Connect Facebook — use this for testing or sandbox accounts.
          </p>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={4}
            placeholder="EAAG..."
            className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-4 py-3 text-text-primary text-xs font-mono outline-none resize-none"
          />

          {result && (
            <div className={`p-3 rounded-xl text-xs ${result.type === 'success' ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
              {result.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-sm font-semibold disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={!token.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ConnectMetaTokenModal;
