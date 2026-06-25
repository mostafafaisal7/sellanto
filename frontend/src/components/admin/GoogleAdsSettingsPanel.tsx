/**
 * GoogleAdsSettingsPanel (Admin only).
 * Configures a SEPARATE Google OAuth client + Developer Token for Google Ads.
 */
import { useState, useEffect } from 'react';
import {
  CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon,
  InformationCircleIcon, ArrowPathIcon, LinkIcon, ExclamationTriangleIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import { googleAdsService } from '../../services/googleAdsService';
import type { GAdsAdminSettings } from '../../services/googleAdsService';

const BLANK_FORM = {
  google_ads_developer_token: '',
  google_ads_client_id: '',
  google_ads_client_secret: '',
  google_ads_redirect_uri: '',
  google_ads_login_customer_id: '',
  frontend_url: '',
};

type FormKey = keyof typeof BLANK_FORM;

const FIELD_META: { key: FormKey; label: string; isSecret: boolean }[] = [
  { key: 'google_ads_developer_token', label: 'Developer Token', isSecret: true },
  { key: 'google_ads_client_id', label: 'OAuth Client ID', isSecret: false },
  { key: 'google_ads_client_secret', label: 'OAuth Client Secret', isSecret: true },
  { key: 'google_ads_redirect_uri', label: 'Redirect URI', isSecret: false },
  { key: 'google_ads_login_customer_id', label: 'Manager (MCC) ID — optional', isSecret: false },
  { key: 'frontend_url', label: 'Frontend URL', isSecret: false },
];

export function GoogleAdsSettingsPanel() {
  const [settings, setSettings] = useState<GAdsAdminSettings | null>(null);
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
    try { setSettings(await googleAdsService.getAdminSettings()); }
    catch (err: any) {
      setError(err?.response?.status === 403 ? 'Permission denied.' : 'Failed to load Google Ads settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setWarnings([]);
    const payload: Record<string, string> = {};
    (Object.keys(BLANK_FORM) as FormKey[]).forEach((k) => {
      if (form[k].trim()) payload[k] = form[k].trim();
    });
    if (!Object.keys(payload).length) { setError('No changes to save.'); setSaving(false); return; }
    try {
      const res = await googleAdsService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ ...BLANK_FORM });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err: any) {
      setError(googleAdsService.readError(err, 'Failed to save.'));
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse space-y-4">
      <div className="h-5 bg-slate-700 rounded w-2/5" />
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="space-y-1.5"><div className="h-3 bg-slate-700 rounded w-1/4" /><div className="h-9 bg-slate-700 rounded" /></div>)}
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

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1a73e8]/20 flex items-center justify-center">
            <MegaphoneIcon className="w-5 h-5 text-[#1a73e8]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Google Ads API</h3>
            <p className="text-xs text-slate-400">Separate OAuth client + Developer Token · stored in DB</p>
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

      <div>
        <p className="text-xs text-slate-400 mb-3">Update fields below. Leave blank to keep existing.</p>
        <div className="space-y-3">
          {FIELD_META.map((f) => {
            const current = s.settings[f.key];
            return (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-300 mb-1">{f.label}</label>
                <div className="relative">
                  <input
                    type={f.isSecret && !showSecret ? 'password' : 'text'}
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={current?.is_set ? (f.isSecret ? current.value : current.value || '(already set)') : ''}
                    className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#1a73e8]/50 transition-colors font-mono"
                  />
                  {f.isSecret && <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>}
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5">{current?.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
      {warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">{warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{w}</p></div>)}</div>}

      <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Saved!</span>
          : saving ? <span className="flex items-center justify-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</span>
          : 'Save Google Ads Settings'}
      </button>

      <div className="p-3 rounded-xl bg-[#1a73e8]/5 border border-[#1a73e8]/10 space-y-2">
        <div className="flex items-center gap-2"><InformationCircleIcon className="w-4 h-4 text-[#1a73e8]" /><p className="text-xs font-semibold text-[#1a73e8]">Setup Instructions</p></div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li>Create a <strong className="text-slate-300">Google Ads Manager (MCC)</strong> account, then apply for a <strong className="text-slate-300">Developer Token</strong> in Tools &rarr; API Center</li>
          <li>In <strong className="text-slate-300">Google Cloud Console</strong>, create a <strong className="text-slate-300">separate</strong> OAuth 2.0 Client ID (Web application)</li>
          <li>Add the <strong className="text-slate-300">Redirect URI</strong> above under "Authorized redirect URIs"</li>
          <li>Add the scope <code className="text-slate-300">adwords</code> on the OAuth consent screen</li>
          <li>Set the <strong className="text-slate-300">Manager (MCC) ID</strong> only if client accounts sit under a manager</li>
        </ol>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#1a73e8] hover:text-[#5C9CFF] transition-colors mt-1"><LinkIcon className="w-3 h-3" />Google Cloud Console</a>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
        <div className="flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-amber-400" /><p className="text-xs font-semibold text-amber-400">Testing &amp; Live</p></div>
        <ul className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-disc">
          <li>A fresh Developer Token has <strong className="text-amber-300">Test access</strong> — it works only against Google Ads <strong className="text-slate-300">test accounts</strong> (no real ads, no spend).</li>
          <li>Use <strong className="text-amber-300">Dry run</strong> when creating a campaign to validate the request with Google without creating anything.</li>
          <li>Real, live, spending campaigns require <strong className="text-amber-300">Basic access</strong> approval + a billed ad account.</li>
        </ul>
      </div>
    </div>
  );
}

export default GoogleAdsSettingsPanel;
