/**
 * TikTokSettingsPanel (Admin only) — mirrors YouTubeSettingsPanel
 */
import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon, ArrowPathIcon, LinkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { tiktokOAuthService } from '../../services/tiktokOAuthService';
import type { TikTokAdminSettings } from '../../services/tiktokOAuthService';

export function TikTokSettingsPanel() {
  const [settings, setSettings] = useState<TikTokAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ tiktok_client_key: '', tiktok_client_secret: '', tiktok_redirect_uri: '', frontend_url: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try { setSettings(await tiktokOAuthService.getAdminSettings()); }
    catch (err: any) {
      setError(err?.response?.status === 403 ? 'Permission denied.' : 'Failed to load TikTok settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setWarnings([]);
    const payload: Record<string, string> = {};
    if (form.tiktok_client_key.trim()) payload.tiktok_client_key = form.tiktok_client_key.trim();
    if (form.tiktok_client_secret.trim()) payload.tiktok_client_secret = form.tiktok_client_secret.trim();
    if (form.tiktok_redirect_uri.trim()) payload.tiktok_redirect_uri = form.tiktok_redirect_uri.trim();
    if (form.frontend_url.trim()) payload.frontend_url = form.frontend_url.trim();

    if (!Object.keys(payload).length) { setError('No changes to save.'); setSaving(false); return; }

    try {
      const res = await tiktokOAuthService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ tiktok_client_key: '', tiktok_client_secret: '', tiktok_redirect_uri: '', frontend_url: '' });
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
    { key: 'tiktok_client_key' as const, label: 'Client Key', placeholder: s.settings.tiktok_client_key.is_set ? '(already set)' : 'e.g. aw1234567890abcdef', help: s.settings.tiktok_client_key.description, isSecret: false },
    { key: 'tiktok_client_secret' as const, label: 'Client Secret', placeholder: s.settings.tiktok_client_secret.is_set ? s.settings.tiktok_client_secret.value : 'Enter Client Secret', help: s.settings.tiktok_client_secret.description, isSecret: true },
    { key: 'tiktok_redirect_uri' as const, label: 'Redirect URI', placeholder: s.settings.tiktok_redirect_uri.is_set ? s.settings.tiktok_redirect_uri.value : 'https://yourdomain.com/api/v1/platforms/tiktok/callback/', help: s.settings.tiktok_redirect_uri.description, isSecret: false },
    { key: 'frontend_url' as const, label: 'Frontend URL', placeholder: s.settings.frontend_url.is_set ? s.settings.frontend_url.value : 'https://yourdomain.com', help: s.settings.frontend_url.description, isSecret: false },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FE2C55]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#FE2C55]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">TikTok OAuth Settings</h3>
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
          { label: 'Client Key', value: s.settings.tiktok_client_key.value, set: s.settings.tiktok_client_key.is_set },
          { label: 'Client Secret', value: s.settings.tiktok_client_secret.value, set: s.settings.tiktok_client_secret.is_set },
          { label: 'Redirect URI', value: s.settings.tiktok_redirect_uri.value, set: s.settings.tiktok_redirect_uri.is_set },
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
            <span className="px-1.5 py-0.5 rounded bg-[#FE2C55]/10 text-[10px] text-[#FE2C55] font-mono">user.info.basic</span>
            <span className="px-1.5 py-0.5 rounded bg-[#FE2C55]/10 text-[10px] text-[#FE2C55] font-mono">video.publish</span>
            <span className="px-1.5 py-0.5 rounded bg-[#FE2C55]/10 text-[10px] text-[#FE2C55] font-mono">video.upload</span>
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
                  className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#FE2C55]/50 transition-colors font-mono" />
                {f.isSecret && <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
      {warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">{warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{w}</p></div>)}</div>}

      <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#FE2C55] hover:bg-[#E91E4A] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Saved!</span>
          : saving ? <span className="flex items-center justify-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</span>
          : 'Save TikTok Settings'}
      </button>

      <div className="p-3 rounded-xl bg-[#FE2C55]/5 border border-[#FE2C55]/10 space-y-2">
        <div className="flex items-center gap-2"><InformationCircleIcon className="w-4 h-4 text-[#FE2C55]" /><p className="text-xs font-semibold text-[#FE2C55]">Setup Instructions</p></div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Go to <strong className="text-slate-300">TikTok Developer Portal</strong> &rarr; Manage Apps</li>
          <li>Create a new app or select an existing one</li>
          <li>Under <strong className="text-slate-300">"Configure"</strong> &rarr; add your redirect URI</li>
          <li>Copy <strong className="text-slate-300">Client Key</strong> and <strong className="text-slate-300">Client Secret</strong> into the form above</li>
        </ol>
        <a href="https://developers.tiktok.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#FE2C55] hover:text-[#FF6680] transition-colors mt-1"><LinkIcon className="w-3 h-3" />TikTok Developer Portal</a>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <div className="flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-amber-400" /><p className="text-xs font-semibold text-amber-400">Important Notes</p></div>
        <ul className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Access tokens</strong>: Expire every 24 hours (auto-refresh via refresh_token)</li>
          <li><strong className="text-amber-300">Refresh tokens</strong>: Last 365 days — after expiry, user must re-authorize</li>
          <li><strong className="text-amber-300">Before app audit</strong>: All posts are SELF_ONLY (private). Submit your app for review to enable public posting</li>
          <li><strong className="text-amber-300">Test users</strong>: Add test users during development via the Developer Portal to allow authorization before app approval</li>
        </ul>
      </div>
    </div>
  );
}

export default TikTokSettingsPanel;
