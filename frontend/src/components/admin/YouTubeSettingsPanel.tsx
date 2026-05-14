/**
 * YouTubeSettingsPanel (Admin only) — mirrors PinterestSettingsPanel
 */
import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon, ArrowPathIcon, LinkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { youtubeOAuthService } from '../../services/youtubeOAuthService';
import type { YouTubeAdminSettings } from '../../services/youtubeOAuthService';

export function YouTubeSettingsPanel() {
  const [settings, setSettings] = useState<YouTubeAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ youtube_client_id: '', youtube_client_secret: '', youtube_redirect_uri: '', frontend_url: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try { setSettings(await youtubeOAuthService.getAdminSettings()); }
    catch (err: any) {
      setError(err?.response?.status === 403 ? 'Permission denied.' : 'Failed to load YouTube settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setWarnings([]);
    const payload: Record<string, string> = {};
    if (form.youtube_client_id.trim()) payload.youtube_client_id = form.youtube_client_id.trim();
    if (form.youtube_client_secret.trim()) payload.youtube_client_secret = form.youtube_client_secret.trim();
    if (form.youtube_redirect_uri.trim()) payload.youtube_redirect_uri = form.youtube_redirect_uri.trim();
    if (form.frontend_url.trim()) payload.frontend_url = form.frontend_url.trim();

    if (!Object.keys(payload).length) { setError('No changes to save.'); setSaving(false); return; }

    try {
      const res = await youtubeOAuthService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ youtube_client_id: '', youtube_client_secret: '', youtube_redirect_uri: '', frontend_url: '' });
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
    { key: 'youtube_client_id' as const, label: 'Client ID', placeholder: s.settings.youtube_client_id.is_set ? '(already set)' : 'e.g. 123456789-abc.apps.googleusercontent.com', help: s.settings.youtube_client_id.description, isSecret: false },
    { key: 'youtube_client_secret' as const, label: 'Client Secret', placeholder: s.settings.youtube_client_secret.is_set ? s.settings.youtube_client_secret.value : 'Enter Client Secret', help: s.settings.youtube_client_secret.description, isSecret: true },
    { key: 'youtube_redirect_uri' as const, label: 'Redirect URI', placeholder: s.settings.youtube_redirect_uri.is_set ? s.settings.youtube_redirect_uri.value : 'https://yourdomain.com/api/v1/platforms/youtube/callback/', help: s.settings.youtube_redirect_uri.description, isSecret: false },
    { key: 'frontend_url' as const, label: 'Frontend URL', placeholder: s.settings.frontend_url.is_set ? s.settings.frontend_url.value : 'https://yourdomain.com', help: s.settings.frontend_url.description, isSecret: false },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF0000]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">YouTube OAuth Settings</h3>
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
          { label: 'Client ID', value: s.settings.youtube_client_id.value, set: s.settings.youtube_client_id.is_set },
          { label: 'Client Secret', value: s.settings.youtube_client_secret.value, set: s.settings.youtube_client_secret.is_set },
          { label: 'Redirect URI', value: s.settings.youtube_redirect_uri.value, set: s.settings.youtube_redirect_uri.is_set },
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
            <span className="px-1.5 py-0.5 rounded bg-[#FF0000]/10 text-[10px] text-[#FF0000] font-mono">youtube.upload</span>
            <span className="px-1.5 py-0.5 rounded bg-[#FF0000]/10 text-[10px] text-[#FF0000] font-mono">youtube.readonly</span>
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
                  className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#FF0000]/50 transition-colors font-mono" />
                {f.isSecret && <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
      {warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">{warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{w}</p></div>)}</div>}

      <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#FF0000] hover:bg-[#CC0000] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Saved!</span>
          : saving ? <span className="flex items-center justify-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</span>
          : 'Save YouTube Settings'}
      </button>

      <div className="p-3 rounded-xl bg-[#FF0000]/5 border border-[#FF0000]/10 space-y-2">
        <div className="flex items-center gap-2"><InformationCircleIcon className="w-4 h-4 text-[#FF0000]" /><p className="text-xs font-semibold text-[#FF0000]">Setup Instructions</p></div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Go to <strong className="text-slate-300">Google Cloud Console</strong> &rarr; APIs &amp; Services &rarr; Credentials</li>
          <li>Create an <strong className="text-slate-300">OAuth 2.0 Client ID</strong> (Web application type)</li>
          <li>Add your <strong className="text-slate-300">Redirect URI</strong> under "Authorized redirect URIs"</li>
          <li>Enable <strong className="text-slate-300">YouTube Data API v3</strong> in the Library section</li>
          <li>Configure the <strong className="text-slate-300">OAuth consent screen</strong> (External or Internal)</li>
          <li>Add required scopes: <code className="text-slate-300">youtube.upload</code> and <code className="text-slate-300">youtube.readonly</code></li>
        </ol>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#FF0000] hover:text-[#FF3333] transition-colors mt-1"><LinkIcon className="w-3 h-3" />Google Cloud Console</a>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <div className="flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-amber-400" /><p className="text-xs font-semibold text-amber-400">Important Notes</p></div>
        <ul className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">Quota</strong>: Default 10,000 units/day. Each video upload costs ~1,600 units (&asymp;6 uploads/day)</li>
          <li><strong className="text-amber-300">Testing mode</strong>: Tokens expire after 7 days. Add test users in consent screen, or verify your app for production</li>
          <li><strong className="text-amber-300">Verification</strong>: Apps using sensitive scopes (youtube.upload) require Google verification before public launch</li>
        </ul>
      </div>
    </div>
  );
}

export default YouTubeSettingsPanel;
