/**
 * PinterestSettingsPanel (Admin only) — mirrors FacebookSettingsPanel/LinkedInSettingsPanel
 */
import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon, ArrowPathIcon, LinkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { pinterestOAuthService } from '../../services/pinterestOAuthService';
import type { PinterestAdminSettings } from '../../services/pinterestOAuthService';

export function PinterestSettingsPanel() {
  const [settings, setSettings] = useState<PinterestAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ pinterest_client_id: '', pinterest_client_secret: '', pinterest_redirect_uri: '', frontend_url: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try { setSettings(await pinterestOAuthService.getAdminSettings()); }
    catch (err: any) {
      setError(err?.response?.status === 403 ? 'Permission denied.' : 'Failed to load Pinterest settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setWarnings([]);
    const payload: Record<string, string> = {};
    if (form.pinterest_client_id.trim()) payload.pinterest_client_id = form.pinterest_client_id.trim();
    if (form.pinterest_client_secret.trim()) payload.pinterest_client_secret = form.pinterest_client_secret.trim();
    if (form.pinterest_redirect_uri.trim()) payload.pinterest_redirect_uri = form.pinterest_redirect_uri.trim();
    if (form.frontend_url.trim()) payload.frontend_url = form.frontend_url.trim();

    if (!Object.keys(payload).length) { setError('No changes to save.'); setSaving(false); return; }

    try {
      const res = await pinterestOAuthService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ pinterest_client_id: '', pinterest_client_secret: '', pinterest_redirect_uri: '', frontend_url: '' });
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
    { key: 'pinterest_client_id' as const, label: 'App ID', placeholder: s.settings.pinterest_client_id.is_set ? '(already set)' : 'e.g. 1234567890', help: s.settings.pinterest_client_id.description, isSecret: false },
    { key: 'pinterest_client_secret' as const, label: 'App Secret', placeholder: s.settings.pinterest_client_secret.is_set ? s.settings.pinterest_client_secret.value : 'Enter App Secret', help: s.settings.pinterest_client_secret.description, isSecret: true },
    { key: 'pinterest_redirect_uri' as const, label: 'Redirect URI', placeholder: s.settings.pinterest_redirect_uri.is_set ? s.settings.pinterest_redirect_uri.value : 'https://yourdomain.com/api/v1/platforms/pinterest/callback/', help: s.settings.pinterest_redirect_uri.description, isSecret: false },
    { key: 'frontend_url' as const, label: 'Frontend URL', placeholder: s.settings.frontend_url.is_set ? s.settings.frontend_url.value : 'https://yourdomain.com', help: s.settings.frontend_url.description, isSecret: false },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E60023]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#E60023]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Pinterest OAuth Settings</h3>
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
          { label: 'App ID', value: s.settings.pinterest_client_id.value, set: s.settings.pinterest_client_id.is_set },
          { label: 'App Secret', value: s.settings.pinterest_client_secret.value, set: s.settings.pinterest_client_secret.is_set },
          { label: 'Redirect URI', value: s.settings.pinterest_redirect_uri.value, set: s.settings.pinterest_redirect_uri.is_set },
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
                  className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#E60023]/50 transition-colors font-mono" />
                {f.isSecret && <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
      {warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">{warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{w}</p></div>)}</div>}

      <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#E60023] hover:bg-[#CC001F] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Saved!</span>
          : saving ? <span className="flex items-center justify-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</span>
          : 'Save Pinterest Settings'}
      </button>

      <div className="p-3 rounded-xl bg-[#E60023]/5 border border-[#E60023]/10 space-y-2">
        <div className="flex items-center gap-2"><InformationCircleIcon className="w-4 h-4 text-[#E60023]" /><p className="text-xs font-semibold text-[#E60023]">Setup Instructions</p></div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Go to <strong className="text-slate-300">Pinterest Developer Portal</strong> and create an app</li>
          <li>Copy your <strong className="text-slate-300">App ID</strong> and <strong className="text-slate-300">App Secret</strong></li>
          <li>Add your <strong className="text-slate-300">Redirect URI</strong> to the app settings</li>
          <li>Your app starts in <strong className="text-slate-300">Trial mode</strong> (pins only visible to you, 1000 calls/day)</li>
          <li>Submit a <strong className="text-slate-300">demo video</strong> for Standard (production) access</li>
        </ol>
        <a href="https://developers.pinterest.com/apps/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#E60023] hover:text-[#FF1A3D] transition-colors mt-1"><LinkIcon className="w-3 h-3" />Pinterest Developer Portal</a>
      </div>
    </div>
  );
}

export default PinterestSettingsPanel;
