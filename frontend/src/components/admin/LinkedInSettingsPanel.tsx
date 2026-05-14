/**
 * LinkedInSettingsPanel (Admin only)
 * =====================================
 * Two-section panel — one per LinkedIn app:
 *   Section 1: Personal App  (Sign In with LinkedIn + Share on LinkedIn)
 *   Section 2: Community App (Community Management API — company pages)
 *
 * Each section has its own fields, status badge, and save button.
 * The shared Frontend URL sits at the bottom.
 */

import { useState, useEffect, type ReactNode } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { linkedinOAuthService } from '../../services/linkedinOAuthService';
import type { LinkedInAdminSettings } from '../../services/linkedinOAuthService';

// ── Reusable credential section ────────────────────────────────────────────────

interface SectionProps {
  title:       string;
  subtitle:    string;
  icon:        ReactNode;
  accentColor: string;
  fields: {
    key:         string;
    label:       string;
    placeholder: string;
    isSecret?:   boolean;
    isUri?:      boolean;
  }[];
  isConfigured: boolean;
  missing:      string[];
  scopes:       string[];
  onSave:       (payload: Record<string, string>) => Promise<void>;
  saving:       boolean;
  saved:        boolean;
  error:        string;
  warnings:     string[];
  note:         string;
  redirectExample: string;
}

function CredentialSection({
  title, subtitle, icon, accentColor, fields, isConfigured, missing,
  scopes, onSave, saving, saved, error, warnings, note, redirectExample,
}: SectionProps) {
  const [form, setForm]           = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState(false);

  const handleSave = async () => {
    const payload: Record<string, string> = {};
    for (const f of fields) {
      const val = (form[f.key] || '').trim();
      if (!val) continue;
      if (f.isUri && !val.match(/^https?:\/\//)) continue; // validated below
      payload[f.key] = val;
    }
    if (!Object.keys(payload).length) return;
    await onSave(payload);
    setForm({});
  };

  return (
    <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center`}
            style={{ background: `${accentColor}20` }}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
          isConfigured
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {isConfigured
            ? <><CheckCircleIcon className="w-3 h-3" /> Ready</>
            : <><XCircleIcon className="w-3 h-3" /> Not configured</>
          }
        </span>
      </div>

      {/* Missing warning */}
      {missing.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300">Missing: {missing.join(', ')}</p>
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-300 mb-1">{f.label}</label>
            <div className="relative">
              <input
                type={f.isSecret && !showSecrets ? 'password' : 'text'}
                value={form[f.key] || ''}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 pr-8 bg-slate-800 border border-white/10 rounded-lg text-white text-sm
                  placeholder-slate-600 focus:outline-none focus:border-[#0077B5]/50 transition-colors font-mono"
              />
              {f.isSecret && (
                <button type="button" onClick={() => setShowSecrets((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  {showSecrets ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Redirect URI hint */}
      <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
        <p className="text-[10px] text-slate-500">
          Redirect URI to set in LinkedIn portal: <span className="text-slate-300 font-mono">{redirectExample}</span>
        </p>
      </div>

      {/* Required scopes */}
      <div>
        <p className="text-[10px] text-slate-500 mb-1.5">Required OAuth scopes:</p>
        <div className="flex flex-wrap gap-1">
          {scopes.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-mono text-green-400">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Note */}
      <p className="text-[10px] text-slate-500 leading-relaxed">{note}</p>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <XCircleIcon className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 rounded-lg text-sm font-semibold transition-all
          bg-[#0077B5] hover:bg-[#006195] disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {saved ? (
          <span className="flex items-center justify-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4" /> Saved!
          </span>
        ) : saving ? (
          <span className="flex items-center justify-center gap-1.5">
            <ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...
          </span>
        ) : (
          `Save ${title}`
        )}
      </button>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function LinkedInSettingsPanel() {
  const [settings, setSettings] = useState<LinkedInAdminSettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  // Per-section save state
  const [pSaving, setPSaving]     = useState(false);
  const [pSaved, setPSaved]       = useState(false);
  const [pError, setPError]       = useState('');
  const [pWarnings, setPWarnings] = useState<string[]>([]);

  const [cSaving, setCSaving]     = useState(false);
  const [cSaved, setCSaved]       = useState(false);
  const [cError, setCError]       = useState('');
  const [cWarnings, setCWarnings] = useState<string[]>([]);

  const [sharedForm, setSharedForm]       = useState({ frontend_url: '' });
  const [sharedSaving, setSharedSaving]   = useState(false);
  const [sharedSaved, setSharedSaved]     = useState(false);
  const [sharedError, setSharedError]     = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await linkedinOAuthService.getAdminSettings();
      setSettings(data);
    } catch (err: any) {
      setLoadError(
        err?.response?.status === 403 ? 'Permission denied.' :
        err?.response?.status === 401 ? 'Session expired. Please log in again.' :
        'Failed to load LinkedIn settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveSection = async (
    payload: Record<string, string>,
    setSaving: (v: boolean) => void,
    setSaved:  (v: boolean) => void,
    setError:  (v: string) => void,
    setWarnings: (v: string[]) => void,
  ) => {
    setSaving(true);
    setError('');
    setWarnings([]);
    try {
      const res = await linkedinOAuthService.saveAdminSettings(payload);
      if (res.warnings?.length) setWarnings(res.warnings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err: any) {
      setError(
        err?.response?.data?.details?.join(', ') ||
        err?.response?.data?.error ||
        'Failed to save. Please check your input.'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveShared = async () => {
    const val = sharedForm.frontend_url.trim();
    if (!val) { setSharedError('Enter a frontend URL.'); return; }
    if (!val.match(/^https?:\/\//)) { setSharedError('Must start with http:// or https://'); return; }
    setSharedSaving(true);
    setSharedError('');
    try {
      await linkedinOAuthService.saveAdminSettings({ frontend_url: val });
      setSharedForm({ frontend_url: '' });
      setSharedSaved(true);
      setTimeout(() => setSharedSaved(false), 3000);
      await load();
    } catch (err: any) {
      setSharedError(err?.response?.data?.error || 'Failed to save.');
    } finally {
      setSharedSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="p-5 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
            <div className="h-4 bg-slate-700 rounded w-2/5" />
            {[1, 2, 3].map((j) => <div key={j} className="h-9 bg-slate-700 rounded" />)}
          </div>
        ))}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
        <div className="flex items-center gap-2">
          <XCircleIcon className="w-5 h-5 text-red-400" />
          <p className="text-sm font-semibold text-red-400">Failed to load settings</p>
        </div>
        <p className="text-xs text-slate-400">{loadError}</p>
        <button onClick={load}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1.5">
          <ArrowPathIcon className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const { personal, community, shared } = settings;

  const makePersonalFields = () => [
    {
      key: 'linkedin_client_id',
      label: 'Client ID',
      placeholder: personal.settings.linkedin_client_id.is_set ? '(set — enter to change)' : 'e.g. 86abc1234def56',
    },
    {
      key: 'linkedin_client_secret',
      label: 'Client Secret',
      placeholder: personal.settings.linkedin_client_secret.is_set
        ? personal.settings.linkedin_client_secret.value
        : 'Enter Client Secret',
      isSecret: true,
    },
    {
      key: 'linkedin_redirect_uri',
      label: 'OAuth Redirect URI',
      placeholder: personal.settings.linkedin_redirect_uri.is_set
        ? personal.settings.linkedin_redirect_uri.value
        : 'https://yourdomain.com/api/v1/platforms/linkedin/callback/',
      isUri: true,
    },
  ];

  const makeCommunityFields = () => [
    {
      key: 'linkedin_community_client_id',
      label: 'Client ID',
      placeholder: community.settings.linkedin_community_client_id.is_set ? '(set — enter to change)' : 'e.g. 86abc1234def56',
    },
    {
      key: 'linkedin_community_client_secret',
      label: 'Client Secret',
      placeholder: community.settings.linkedin_community_client_secret.is_set
        ? community.settings.linkedin_community_client_secret.value
        : 'Enter Client Secret',
      isSecret: true,
    },
    {
      key: 'linkedin_community_redirect_uri',
      label: 'OAuth Redirect URI',
      placeholder: community.settings.linkedin_community_redirect_uri.is_set
        ? community.settings.linkedin_community_redirect_uri.value
        : 'https://yourdomain.com/api/v1/platforms/linkedin/community/callback/',
      isUri: true,
    },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0077B5]/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-[#0077B5]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">LinkedIn OAuth Settings</h3>
          <p className="text-xs text-slate-400">Two separate LinkedIn apps — Personal + Community</p>
        </div>
      </div>

      {/* App 1 — Personal */}
      <CredentialSection
        title="Personal App"
        subtitle="Sign In with LinkedIn + Share on LinkedIn"
        icon={<UserCircleIcon className="w-5 h-5 text-[#0077B5]" />}
        accentColor="#0077B5"
        fields={makePersonalFields()}
        isConfigured={personal.is_configured}
        missing={personal.missing}
        scopes={['openid', 'profile', 'email', 'w_member_social']}
        redirectExample="…/api/v1/platforms/linkedin/callback/"
        note={settings.help.personal_note}
        onSave={(p) => saveSection(p, setPSaving, setPSaved, setPError, setPWarnings)}
        saving={pSaving}
        saved={pSaved}
        error={pError}
        warnings={pWarnings}
      />

      {/* App 2 — Community */}
      <CredentialSection
        title="Community App"
        subtitle="Community Management API — Company Pages"
        icon={<BuildingOffice2Icon className="w-5 h-5 text-[#004471]" />}
        accentColor="#004471"
        fields={makeCommunityFields()}
        isConfigured={community.is_configured}
        missing={community.missing}
        scopes={['r_organization_social', 'w_organization_social']}
        redirectExample="…/api/v1/platforms/linkedin/community/callback/"
        note={settings.help.community_note}
        onSave={(p) => saveSection(p, setCSaving, setCSaved, setCError, setCWarnings)}
        saving={cSaving}
        saved={cSaved}
        error={cError}
        warnings={cWarnings}
      />

      {/* Shared — Frontend URL */}
      <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
        <div className="flex items-center gap-2">
          <InformationCircleIcon className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-white">Shared Settings</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Frontend URL</label>
          <div className="flex items-center gap-2 mb-1">
            {shared.frontend_url.is_set
              ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              : <XCircleIcon className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            }
            <span className="text-xs text-slate-400 font-mono truncate">
              {shared.frontend_url.is_set ? shared.frontend_url.value : 'Not set'}
            </span>
          </div>
          <input
            type="text"
            value={sharedForm.frontend_url}
            onChange={(e) => setSharedForm({ frontend_url: e.target.value })}
            placeholder={shared.frontend_url.is_set ? '(set — enter to change)' : 'https://yourdomain.com'}
            className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm
              placeholder-slate-600 focus:outline-none focus:border-[#0077B5]/50 transition-colors font-mono"
          />
          <p className="text-[10px] text-slate-600 mt-0.5">{settings.help.frontend_url_note}</p>
        </div>

        {sharedError && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircleIcon className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{sharedError}</p>
          </div>
        )}

        <button onClick={saveShared} disabled={sharedSaving}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-slate-700 hover:bg-slate-600
            disabled:opacity-50 text-white transition-colors">
          {sharedSaved ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircleIcon className="w-4 h-4" /> Saved!
            </span>
          ) : sharedSaving ? (
            <span className="flex items-center justify-center gap-1.5">
              <ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...
            </span>
          ) : 'Save Frontend URL'}
        </button>
      </div>

      {/* Setup guide */}
      <div className="p-4 rounded-xl bg-[#0077B5]/5 border border-[#0077B5]/10 space-y-2">
        <div className="flex items-center gap-2">
          <InformationCircleIcon className="w-4 h-4 text-[#0077B5]" />
          <p className="text-xs font-semibold text-[#0077B5]">Setup Guide</p>
        </div>
        <ol className="text-[11px] text-slate-400 space-y-1.5 ml-5 list-decimal">
          <li><strong className="text-slate-300">App 1 (Personal):</strong> Create LinkedIn app → add <em>Sign In with LinkedIn</em> + <em>Share on LinkedIn</em> products → copy credentials above</li>
          <li><strong className="text-slate-300">App 2 (Community):</strong> Create a <em>second</em> LinkedIn app → add <em>Community Management API</em> product ONLY → copy credentials above</li>
          <li>Both redirect URIs must match exactly what you enter in each app's Auth tab</li>
          <li>Community Management API requires LinkedIn review (may take days)</li>
        </ol>
        <div className="flex items-center gap-4 pt-2 border-t border-[#0077B5]/10">
          <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#0077B5] hover:text-[#0099E0] transition-colors">
            <LinkIcon className="w-3 h-3" /> Developer Portal
          </a>
          <a href="https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#0077B5] hover:text-[#0099E0] transition-colors">
            <LinkIcon className="w-3 h-3" /> Community API Docs
          </a>
        </div>
      </div>
    </div>
  );
}

export default LinkedInSettingsPanel;
