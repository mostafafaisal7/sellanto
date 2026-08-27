/**
 * FacebookSettingsPanel (Admin only)
 * =====================================
 * Lets the admin set Facebook App credentials from the UI.
 * Stored in SiteConfiguration DB table — no .env or server restart needed.
 * Changes take effect immediately for all users.
 */

import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { facebookOAuthService } from '../../services/facebookOAuthService';
import type { FacebookAdminSettings } from '../../services/facebookOAuthService';

export function FacebookSettingsPanel() {
  const [settings, setSettings]     = useState<FacebookAdminSettings | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');
  const [warnings, setWarnings]     = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);

  // Form state — only filled when admin wants to change a value
  const [form, setForm] = useState({
    facebook_app_id:       '',
    facebook_app_secret:   '',
    facebook_redirect_uri: '',
    frontend_url:          '',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await facebookOAuthService.getAdminSettings();
      setSettings(data);
    } catch {
      setError('Failed to load Facebook settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setWarnings([]);

    // Only send fields that the admin actually typed something in
    const payload: Record<string, string> = {};
    if (form.facebook_app_id.trim())       payload.facebook_app_id       = form.facebook_app_id.trim();
    if (form.facebook_app_secret.trim())   payload.facebook_app_secret   = form.facebook_app_secret.trim();
    if (form.facebook_redirect_uri.trim()) payload.facebook_redirect_uri = form.facebook_redirect_uri.trim();
    if (form.frontend_url.trim())          payload.frontend_url          = form.frontend_url.trim();

    if (!Object.keys(payload).length) {
      setError('No changes to save. Fill in at least one field.');
      setSaving(false);
      return;
    }

    try {
      const res = await facebookOAuthService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setForm({ facebook_app_id: '', facebook_app_secret: '', facebook_redirect_uri: '', frontend_url: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load(); // refresh displayed values
    } catch (err: any) {
      const msg = err?.response?.data?.details?.join(', ') || err?.response?.data?.error || 'Failed to save.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse space-y-4">
        <div className="h-5 bg-slate-700 rounded w-2/5" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 bg-slate-700 rounded w-1/4" />
            <div className="h-9 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
        <div className="flex items-center gap-2">
          <XCircleIcon className="w-5 h-5 text-red-400" />
          <p className="text-sm font-semibold text-red-400">Failed to load Facebook settings</p>
        </div>
        <p className="text-xs text-slate-400">{error || 'Could not connect to the server. Make sure the backend is running.'}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center gap-1.5"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const s = settings;

  const fields = [
    {
      key:         'facebook_app_id' as const,
      label:       'App ID',
      placeholder: s.settings.facebook_app_id.is_set ? '(already set — enter to change)' : '1234567890',
      type:        'text',
      help:        s.settings.facebook_app_id.description,
      isSecret:    false,
    },
    {
      key:         'facebook_app_secret' as const,
      label:       'App Secret',
      placeholder: s.settings.facebook_app_secret.is_set
        ? s.settings.facebook_app_secret.value   // shows masked value like ••••••abc123
        : 'Enter App Secret',
      type:        'password',
      help:        s.settings.facebook_app_secret.description,
      isSecret:    true,
    },
    {
      key:         'facebook_redirect_uri' as const,
      label:       'OAuth Redirect URI',
      placeholder: s.settings.facebook_redirect_uri.is_set
        ? s.settings.facebook_redirect_uri.value
        : 'https://yourdomain.com/api/v1/platforms/facebook/callback/',
      type:        'text',
      help:        s.settings.facebook_redirect_uri.description,
      isSecret:    false,
    },
    {
      key:         'frontend_url' as const,
      label:       'Frontend URL',
      placeholder: s.settings.frontend_url.is_set
        ? s.settings.frontend_url.value
        : 'https://yourdomain.com',
      type:        'text',
      help:        s.settings.frontend_url.description,
      isSecret:    false,
    },
  ];

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Facebook OAuth Settings</h3>
            <p className="text-xs text-slate-400">Stored in DB — takes effect immediately</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
          s.is_configured
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {s.is_configured
            ? <><CheckCircleIcon className="w-3.5 h-3.5" /> Configured</>
            : <><XCircleIcon className="w-3.5 h-3.5" /> Not Configured</>
          }
        </div>
      </div>

      {/* Missing warning */}
      {s.missing.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <InformationCircleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Missing required fields:</p>
            <p className="text-xs text-amber-300 mt-0.5">{s.missing.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Messenger Feature Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <div>
          <p className="text-sm font-semibold text-white">Messenger Bot Feature</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {s.messenger_feature_enabled
              ? 'Enabled — users can access Messenger Bot, AI auto-replies are active'
              : 'Disabled — all Messenger features are completely turned off'}
          </p>
        </div>
        <button
          onClick={async () => {
            setError('');
            try {
              const token = localStorage.getItem('access_token');
              const res = await fetch('/api/v1/admin/facebook-settings/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  messenger_feature_enabled: !s.messenger_feature_enabled,
                }),
              });
              if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
              }
              await load();
            } catch (err) {
              setError(
                err instanceof Error
                  ? `Failed to toggle Messenger feature: ${err.message}`
                  : 'Failed to toggle Messenger feature.'
              );
            }
          }}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            s.messenger_feature_enabled ? 'bg-green-500' : 'bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
              s.messenger_feature_enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Instagram Comment Hiding Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <div>
          <p className="text-sm font-semibold text-white">Hide Instagram Comments</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {s.instagram_comment_hide_enabled
              ? 'Enabled — users can hide comments on their Instagram posts'
              : 'Disabled — the Hide button is removed. Unhiding still works, so no comment stays stuck hidden'}
          </p>
        </div>
        <button
          onClick={async () => {
            setError('');
            try {
              const token = localStorage.getItem('access_token');
              const res = await fetch('/api/v1/admin/facebook-settings/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  instagram_comment_hide_enabled: !s.instagram_comment_hide_enabled,
                }),
              });
              if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
              }
              await load();
            } catch (err) {
              setError(
                err instanceof Error
                  ? `Failed to toggle Instagram comment hiding: ${err.message}`
                  : 'Failed to toggle Instagram comment hiding.'
              );
            }
          }}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            s.instagram_comment_hide_enabled ? 'bg-green-500' : 'bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
              s.instagram_comment_hide_enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Current values display */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'App ID',       value: s.settings.facebook_app_id.value,       set: s.settings.facebook_app_id.is_set },
          { label: 'App Secret',   value: s.settings.facebook_app_secret.value,   set: s.settings.facebook_app_secret.is_set },
          { label: 'Redirect URI', value: s.settings.facebook_redirect_uri.value, set: s.settings.facebook_redirect_uri.is_set },
          { label: 'Frontend URL', value: s.settings.frontend_url.value,          set: s.settings.frontend_url.is_set },
        ].map((item) => (
          <div key={item.label} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</span>
              {item.set
                ? <CheckCircleIcon className="w-3 h-3 text-green-400" />
                : <XCircleIcon className="w-3 h-3 text-slate-600" />
              }
            </div>
            <p className="text-xs text-slate-300 truncate font-mono">
              {item.set ? item.value || '—' : <span className="text-slate-600">Not set</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Update form */}
      <div>
        <p className="text-xs text-slate-400 mb-3">
          Update fields below. Leave blank to keep existing values.
        </p>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-300 mb-1">{f.label}</label>
              <div className="relative">
                <input
                  type={f.isSecret && !showSecret ? 'password' : 'text'}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 pr-9 bg-slate-800 border border-white/10 rounded-lg text-white text-sm
                    placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
                />
                {f.isSecret && (
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Warnings from save */}
      {warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">⚠ {w}</p>
          ))}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all
          bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
      >
        {saved ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-4 h-4" /> Saved!
          </span>
        ) : saving ? (
          <span className="flex items-center justify-center gap-2">
            <ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...
          </span>
        ) : (
          'Save Facebook Settings'
        )}
      </button>

      {/* Help box */}
      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
        <div className="flex items-center gap-2">
          <InformationCircleIcon className="w-4 h-4 text-blue-400" />
          <p className="text-xs font-semibold text-blue-400">Where to find these values</p>
        </div>
        <ul className="text-[11px] text-slate-400 space-y-1 ml-5 list-disc">
          <li><strong className="text-slate-300">App ID &amp; Secret:</strong> {s.help.where_to_find}</li>
          <li><strong className="text-slate-300">Redirect URI:</strong> {s.help.redirect_uri_note}</li>
          <li><strong className="text-slate-300">Frontend URL:</strong> {s.help.frontend_url_note}</li>
        </ul>
        <a
          href="https://developers.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors mt-1"
        >
          <LinkIcon className="w-3 h-3" />
          Open Meta Developer Console
        </a>
      </div>
    </div>
  );
}

export default FacebookSettingsPanel;
