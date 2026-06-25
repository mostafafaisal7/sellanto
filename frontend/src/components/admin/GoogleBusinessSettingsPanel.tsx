/**
 * GoogleBusinessSettingsPanel (Admin only) — mirrors YouTubeSettingsPanel.
 * Configures a SEPARATE Google OAuth client for Google Business Profile.
 */
import { useState, useEffect } from 'react';
import {
  CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon,
  InformationCircleIcon, ArrowPathIcon, LinkIcon, ExclamationTriangleIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { googleBusinessService } from '../../services/googleBusinessService';
import type { GBPAdminSettings } from '../../services/googleBusinessService';

const BLANK_FORM = {
  google_business_client_id: '',
  google_business_client_secret: '',
  google_business_redirect_uri: '',
  frontend_url: '',
};

export function GoogleBusinessSettingsPanel() {
  const [settings, setSettings] = useState<GBPAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try { setSettings(await googleBusinessService.getAdminSettings()); }
    catch (err: any) {
      setError(err?.response?.status === 403 ? 'Permission denied.' : 'Failed to load Google Business settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setWarnings([]);
    const payload: Record<string, string> = {};
    (Object.keys(BLANK_FORM) as (keyof typeof BLANK_FORM)[]).forEach((k) => {
      if (form[k].trim()) payload[k] = form[k].trim();
    });

    if (!Object.keys(payload).length) { setError('No changes to save.'); setSaving(false); return; }

    try {
      const res = await googleBusinessService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ ...BLANK_FORM });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err: any) {
      setError(googleBusinessService.readError(err, 'Failed to save.'));
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
    { key: 'google_business_client_id' as const, label: 'Client ID', placeholder: s.settings.google_business_client_id.is_set ? '(already set)' : 'e.g. 123456789-abc.apps.googleusercontent.com', help: s.settings.google_business_client_id.description, isSecret: false },
    { key: 'google_business_client_secret' as const, label: 'Client Secret', placeholder: s.settings.google_business_client_secret.is_set ? s.settings.google_business_client_secret.value : 'Enter Client Secret', help: s.settings.google_business_client_secret.description, isSecret: true },
    { key: 'google_business_redirect_uri' as const, label: 'Redirect URI', placeholder: s.settings.google_business_redirect_uri.is_set ? s.settings.google_business_redirect_uri.value : 'https://yourdomain.com/api/v1/platforms/google-business/callback/', help: s.settings.google_business_redirect_uri.description, isSecret: false },
    { key: 'frontend_url' as const, label: 'Frontend URL', placeholder: s.settings.frontend_url.is_set ? s.settings.frontend_url.value : 'https://yourdomain.com', help: s.settings.frontend_url.description, isSecret: false },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4285F4]/20 flex items-center justify-center">
            <BuildingStorefrontIcon className="w-5 h-5 text-[#4285F4]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Google Business Profile OAuth</h3>
            <p className="text-xs text-slate-400">Separate Google client · stored in DB · takes effect immediately</p>
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
          { label: 'Client ID', value: s.settings.google_business_client_id.value, set: s.settings.google_business_client_id.is_set },
          { label: 'Client Secret', value: s.settings.google_business_client_secret.value, set: s.settings.google_business_client_secret.is_set },
          { label: 'Redirect URI', value: s.settings.google_business_redirect_uri.value, set: s.settings.google_business_redirect_uri.is_set },
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

      {/* Scope display */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
        <InformationCircleIcon className="w-4 h-4 text-slate-500 shrink-0" />
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Required Scope</p>
          <span className="px-1.5 py-0.5 rounded bg-[#4285F4]/10 text-[10px] text-[#4285F4] font-mono">business.manage</span>
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
                  className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#4285F4]/50 transition-colors font-mono" />
                {f.isSecret && <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
      {warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">{warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{w}</p></div>)}</div>}

      <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#4285F4] hover:bg-[#3367D6] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Saved!</span>
          : saving ? <span className="flex items-center justify-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</span>
          : 'Save Google Business Settings'}
      </button>

      <div className="p-3 rounded-xl bg-[#4285F4]/5 border border-[#4285F4]/10 space-y-2">
        <div className="flex items-center gap-2"><InformationCircleIcon className="w-4 h-4 text-[#4285F4]" /><p className="text-xs font-semibold text-[#4285F4]">Setup Instructions</p></div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>In <strong className="text-slate-300">Google Cloud Console</strong> &rarr; APIs &amp; Services &rarr; Credentials, create a <strong className="text-slate-300">separate</strong> OAuth 2.0 Client ID (Web application)</li>
          <li>Add the <strong className="text-slate-300">Redirect URI</strong> above under "Authorized redirect URIs"</li>
          <li>Enable the <strong className="text-slate-300">Business Profile APIs</strong> (Account Management, Business Information) in the Library</li>
          <li>Add the scope <code className="text-slate-300">business.manage</code> on the OAuth consent screen</li>
          <li><strong className="text-amber-300">Request Business Profile API access</strong> via Google's access form (the API is gated until approved)</li>
          <li>Add test users on the consent screen while in Testing mode</li>
        </ol>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#4285F4] hover:text-[#5C9CFF] transition-colors mt-1"><LinkIcon className="w-3 h-3" />Google Cloud Console</a>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <div className="flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-amber-400" /><p className="text-xs font-semibold text-amber-400">Important Notes</p></div>
        <ul className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-disc">
          <li><strong className="text-amber-300">API access</strong>: The Business Profile API requires a one-time access request approved by Google before it returns live data.</li>
          <li><strong className="text-amber-300">Separate client</strong>: Use a different OAuth client from YouTube so the scopes stay isolated.</li>
          <li><strong className="text-amber-300">Token lifetime</strong>: Access tokens last 1 hour and auto-refresh via the stored refresh token.</li>
        </ul>
      </div>
    </div>
  );
}

export default GoogleBusinessSettingsPanel;
