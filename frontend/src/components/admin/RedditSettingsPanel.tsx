/**
 * RedditSettingsPanel (Admin only) — mirrors YouTubeSettingsPanel
 */
import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon, ArrowPathIcon, LinkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { redditOAuthService } from '../../services/redditOAuthService';
import type { RedditAdminSettings } from '../../services/redditOAuthService';

export function RedditSettingsPanel() {
  const [settings, setSettings] = useState<RedditAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ reddit_client_id: '', reddit_client_secret: '', reddit_redirect_uri: '', frontend_url: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try { setSettings(await redditOAuthService.getAdminSettings()); }
    catch (err: any) {
      setError(err?.response?.status === 403 ? 'Permission denied.' : 'Failed to load Reddit settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setWarnings([]);
    const payload: Record<string, string> = {};
    if (form.reddit_client_id.trim()) payload.reddit_client_id = form.reddit_client_id.trim();
    if (form.reddit_client_secret.trim()) payload.reddit_client_secret = form.reddit_client_secret.trim();
    if (form.reddit_redirect_uri.trim()) payload.reddit_redirect_uri = form.reddit_redirect_uri.trim();
    if (form.frontend_url.trim()) payload.frontend_url = form.frontend_url.trim();

    if (!Object.keys(payload).length) { setError('No changes to save.'); setSaving(false); return; }

    try {
      const res = await redditOAuthService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ reddit_client_id: '', reddit_client_secret: '', reddit_redirect_uri: '', frontend_url: '' });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.details?.join(', ') || err?.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse space-y-4">
      <div className="h-5 bg-slate-700 rounded w-2/5" />
      {[1,2,3,4].map(i => <div key={i} className="space-y-1.5"><div className="h-3 bg-slate-700 rounded w-1/4" /><div className="h-9 bg-slate-700 rounded" /></div>)}
    </div>
  );

  if (!settings) return (
    <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
      <div className="flex items-center gap-2"><XCircleIcon className="w-5 h-5 text-red-400" /><p className="text-sm font-semibold text-red-400">Failed to load</p></div>
      <p className="text-xs text-slate-400">{error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1.5"><ArrowPathIcon className="w-3.5 h-3.5" /> Retry</button>
    </div>
  );

  const s = settings;
  const fields = [
    { key: 'reddit_client_id' as const, label: 'Client ID', placeholder: s.settings.reddit_client_id.is_set ? '(already set)' : 'e.g. AbCdEfGhIjKlMn', help: s.settings.reddit_client_id.description, isSecret: false },
    { key: 'reddit_client_secret' as const, label: 'Client Secret', placeholder: s.settings.reddit_client_secret.is_set ? s.settings.reddit_client_secret.value : 'Enter Client Secret', help: s.settings.reddit_client_secret.description, isSecret: true },
    { key: 'reddit_redirect_uri' as const, label: 'Redirect URI', placeholder: s.settings.reddit_redirect_uri.is_set ? s.settings.reddit_redirect_uri.value : 'https://yourdomain.com/api/v1/platforms/reddit/callback/', help: s.settings.reddit_redirect_uri.description, isSecret: false },
    { key: 'frontend_url' as const, label: 'Frontend URL', placeholder: s.settings.frontend_url.is_set ? s.settings.frontend_url.value : 'https://yourdomain.com', help: s.settings.frontend_url.description, isSecret: false },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF4500]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#FF4500]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Reddit OAuth Settings</h3>
            <p className="text-xs text-slate-400">Stored in DB — takes effect immediately</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.is_configured ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {s.is_configured ? <><CheckCircleIcon className="w-3.5 h-3.5" /> Configured</> : <><XCircleIcon className="w-3.5 h-3.5" /> Not Configured</>}
        </div>
      </div>

      {s.missing.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div><p className="text-xs font-semibold text-amber-400">Missing:</p><p className="text-xs text-amber-300 mt-0.5">{s.missing.join(', ')}</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Client ID', value: s.settings.reddit_client_id.value, set: s.settings.reddit_client_id.is_set },
          { label: 'Client Secret', value: s.settings.reddit_client_secret.value, set: s.settings.reddit_client_secret.is_set },
          { label: 'Redirect URI', value: s.settings.reddit_redirect_uri.value, set: s.settings.reddit_redirect_uri.is_set },
          { label: 'Frontend URL', value: s.settings.frontend_url.value, set: s.settings.frontend_url.is_set },
        ].map(item => (
          <div key={item.label} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</span>
              {item.set ? <CheckCircleIcon className="w-3 h-3 text-green-400" /> : <XCircleIcon className="w-3 h-3 text-slate-600" />}
            </div>
            <p className="text-xs text-slate-300 truncate font-mono">{item.set ? item.value || '—' : <span className="text-slate-600">Not set</span>}</p>
          </div>
        ))}
      </div>

      {/* Scopes display */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
        <InformationCircleIcon className="w-4 h-4 text-slate-500 shrink-0" />
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Required Scopes</p>
          <div className="flex gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-[#FF4500]/10 text-[10px] text-[#FF4500] font-mono">identity</span>
            <span className="px-1.5 py-0.5 rounded bg-[#FF4500]/10 text-[10px] text-[#FF4500] font-mono">read</span>
            <span className="px-1.5 py-0.5 rounded bg-[#FF4500]/10 text-[10px] text-[#FF4500] font-mono">submit</span>
            <span className="px-1.5 py-0.5 rounded bg-[#FF4500]/10 text-[10px] text-[#FF4500] font-mono">mysubreddits</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5" />

      <div>
        <p className="text-xs text-slate-400 mb-3">Update fields below. Leave blank to keep existing.</p>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-300 mb-1">{f.label}</label>
              <div className="relative">
                <input type={f.isSecret && !showSecret ? 'password' : 'text'} value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#FF4500]/50 transition-colors font-mono" />
                {f.isSecret && <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
      {warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">{warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{w}</p></div>)}</div>}

      <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#FF4500] hover:bg-[#CC3700] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Saved!</span>
          : saving ? <span className="flex items-center justify-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</span>
          : 'Save Reddit Settings'}
      </button>

      <div className="p-3 rounded-xl bg-[#FF4500]/5 border border-[#FF4500]/10 space-y-2">
        <div className="flex items-center gap-2"><InformationCircleIcon className="w-4 h-4 text-[#FF4500]" /><p className="text-xs font-semibold text-[#FF4500]">Setup Instructions</p></div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Go to <strong className="text-slate-300">reddit.com/prefs/apps</strong> &rarr; Create App</li>
          <li>Select <strong className="text-slate-300">"web app"</strong> type</li>
          <li>Set your <strong className="text-slate-300">Redirect URI</strong> to match the value configured above</li>
          <li>Copy <strong className="text-slate-300">client_id</strong> (shown under the app name) and <strong className="text-slate-300">client_secret</strong></li>
        </ol>
        <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#FF4500] hover:text-[#FF6A33] transition-colors mt-1"><LinkIcon className="w-3 h-3" />Reddit App Preferences</a>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <div className="flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-amber-400" /><p className="text-xs font-semibold text-amber-400">Important Notes</p></div>
        <ul className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Rate limit</strong>: 60 requests/minute per OAuth client</li>
          <li><strong className="text-amber-300">Access tokens</strong>: Expire every 1 hour (auto-refresh via refresh_token)</li>
          <li><strong className="text-amber-300">Refresh tokens</strong>: Use <code className="text-amber-300">duration=permanent</code> in auth to get a refresh_token for long-lived access</li>
        </ul>
      </div>
    </div>
  );
}

export default RedditSettingsPanel;
