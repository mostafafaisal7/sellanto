import { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui';
import {
  adminStripeService,
  type StripeAdminConfigResponse,
  type StripeAdminField,
  type StripeTestConnectionResponse,
} from '../../services/adminStripeService';

/** Group fields into UI sections so the page reads cleanly. */
const SECTIONS: { title: string; description: string; keys: string[] }[] = [
  {
    title: 'API keys',
    description:
      'Test mode uses pk_test_/sk_test_; live mode uses pk_live_/sk_live_. Get these from Stripe Dashboard → Developers → API keys.',
    keys: ['publishable_key', 'secret_key', 'webhook_secret'],
  },
  {
    title: 'Plan Price IDs',
    description:
      'Create a Product per tier in Stripe with one recurring Price per billing cycle. Paste the Price ID (price_…) here.',
    keys: [
      'price_pro_monthly',
      'price_pro_yearly',
      'price_business_monthly',
      'price_business_yearly',
    ],
  },
  {
    title: 'Pricing',
    description: 'Controls the diamond rate for flexible top-ups on the Buy Diamonds page.',
    keys: ['diamonds_per_dollar'],
  },
];

const KEY_LABELS: Record<string, string> = {
  publishable_key:         'Publishable Key',
  secret_key:              'Secret Key',
  webhook_secret:          'Webhook Signing Secret',
  price_pro_monthly:       'Pro · Monthly',
  price_pro_yearly:        'Pro · Yearly',
  price_business_monthly:  'Business · Monthly',
  price_business_yearly:   'Business · Yearly',
  diamonds_per_dollar:     'Diamonds per USD',
};

export function AdminStripeSettingsPage() {
  const [config, setConfig] = useState<StripeAdminConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<StripeTestConnectionResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminStripeService.get();
      setConfig(data);
      setEdits({});
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!Object.keys(edits).length) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await adminStripeService.save(edits);
      setConfig((prev) =>
        prev ? { ...prev, fields: res.fields, status: { ...prev.status, fully_configured: res.fully_configured } } : prev,
      );
      setEdits({});
      const summary =
        res.updated.length > 0 ? `Saved ${res.updated.length} field(s).` : 'No changes.';
      setSuccess(summary);
      // Refresh to pull computed status flags too.
      await load();
    } catch (err) {
      const e = err as {
        response?: { data?: { error?: string; details?: string[]; detail?: string } };
        message?: string;
      };
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.message ||
        'Save failed';
      const details = e?.response?.data?.details?.join('; ');
      setError(details ? `${msg} — ${details}` : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminStripeService.testConnection();
      setTestResult(res);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setTestResult({ ok: false, error: e?.response?.data?.error || e?.message || 'Request failed' });
    } finally {
      setTesting(false);
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Loading Stripe settings…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-16 text-center text-sm text-coral">
        {error || 'Could not load Stripe settings.'}
      </div>
    );
  }

  const byKey: Record<string, StripeAdminField> = {};
  config.fields.forEach((f) => {
    byKey[f.key] = f;
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Stripe Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your Stripe API keys and Price IDs without touching env files or
          restarting the server. Values saved here override anything set in env.
        </p>
      </div>

      {/* Status bar */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusPill label="API keys" ok={config.status.keys_ready} />
        <StatusPill label="Plan prices" ok={config.status.plan_prices_ready} />
        <ModePill mode={config.status.mode} />
      </div>

      {/* Editable sections */}
      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className="rounded-xl border border-white/10 bg-white/[0.02]"
        >
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-bold text-white">{section.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{section.description}</p>
          </div>
          <div className="p-4 space-y-3">
            {section.keys.map((key) => {
              const f = byKey[key];
              if (!f) return null;
              return (
                <FieldRow
                  key={key}
                  field={f}
                  label={KEY_LABELS[key] || key}
                  pending={edits[key]}
                  onChange={(v) => setEdits((e) => ({ ...e, [key]: v }))}
                  reveal={reveal[key]}
                  onToggleReveal={() =>
                    setReveal((r) => ({ ...r, [key]: !r[key] }))
                  }
                />
              );
            })}
          </div>
        </section>
      ))}

      {/* Webhook info */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-white">Webhook setup</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Register this URL in Stripe Dashboard → Developers → Webhooks, subscribe
            to the listed events, then paste the signing secret into "Webhook
            Signing Secret" above.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 flex items-center gap-2">
          <code className="flex-1 text-xs text-slate-200 break-all">
            {config.webhook.url}
          </code>
          <button
            onClick={() => copy(config.webhook.url, 'wh_url')}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Copy"
          >
            {copied === 'wh_url' ? (
              <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-2">Events to subscribe:</p>
          <div className="flex flex-wrap gap-1.5">
            {config.webhook.events_to_subscribe.map((e) => (
              <span
                key={e}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 text-slate-300"
              >
                {e}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">{config.webhook.note}</p>
      </section>

      {/* Help */}
      <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-4 flex items-start gap-3">
        <ShieldCheckIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p>
            Find your keys at{' '}
            <a
              href={config.help.dashboard_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 underline hover:text-blue-300"
            >
              {config.help.dashboard_url}
            </a>
          </p>
          <p>{config.help.mode_note}</p>
        </div>
      </div>

      {/* Errors / success */}
      {error && (
        <div className="rounded-lg bg-coral/10 border border-coral/20 px-4 py-3 text-sm text-coral flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-300 flex items-start gap-2">
          <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Test connection result */}
      {testResult && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
          testResult.ok
            ? 'bg-green-500/10 border border-green-500/20 text-green-300'
            : 'bg-coral/10 border border-coral/20 text-coral'
        }`}>
          {testResult.ok
            ? <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <XCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          }
          <span>
            {testResult.ok
              ? `Connected — ${testResult.business_name || testResult.account_id} (${testResult.mode} mode)`
              : `Auth failed: ${testResult.error}`
            }
          </span>
        </div>
      )}

      {/* Save button */}
      <div className="sticky bottom-0 -mx-2 px-2 py-3 bg-bg-page/95 backdrop-blur border-t border-white/5 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {Object.keys(edits).length === 0
            ? 'No pending changes'
            : `${Object.keys(edits).length} pending change(s)`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={testing}
            onClick={handleTestConnection}
            isLoading={testing}
          >
            Test connection
          </Button>
          <Button
            variant="secondary"
            disabled={!Object.keys(edits).length || saving}
            onClick={() => setEdits({})}
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            isLoading={saving}
            disabled={!Object.keys(edits).length}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────

  function FieldRow({
    field,
    label,
    pending,
    onChange,
    reveal,
    onToggleReveal,
  }: {
    field: StripeAdminField;
    label: string;
    pending: string | undefined;
    onChange: (v: string) => void;
    reveal: boolean | undefined;
    onToggleReveal: () => void;
  }) {
    const editing = pending !== undefined;
    const displayValue = editing ? pending : field.value;
    const inputType = field.is_secret && !reveal && !editing ? 'password' : 'text';

    return (
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3 items-start">
        <div className="md:pt-2">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{field.description}</p>
        </div>
        <div className="flex-1">
          <input
            type={inputType}
            value={displayValue}
            placeholder={`Set ${label}`}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-black/30 border border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-coral/40 focus:ring-1 focus:ring-coral/20 font-mono"
          />
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
            {field.source === 'db' && (
              <span className="text-green-400">● Saved in database</span>
            )}
            {field.source === 'env' && (
              <span className="text-amber">● From {field.env_var} env var</span>
            )}
            {!field.source && (
              <span className="text-coral">● Not set</span>
            )}
            {editing && (
              <span className="text-blue-400">● Unsaved change</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {field.is_secret && (
            <button
              onClick={onToggleReveal}
              className="p-2 rounded hover:bg-white/10 transition-colors"
              title={reveal ? 'Hide' : 'Show'}
            >
              {reveal ? (
                <EyeSlashIcon className="w-4 h-4 text-slate-400" />
              ) : (
                <EyeIcon className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  }
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircleIcon className="w-4 h-4 text-green-400" />
      ) : (
        <XCircleIcon className="w-4 h-4 text-coral" />
      )}
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm font-semibold ${ok ? 'text-green-300' : 'text-coral'}`}>
          {ok ? 'Ready' : 'Incomplete'}
        </p>
      </div>
    </div>
  );
}

function ModePill({ mode }: { mode: 'test' | 'live' | 'unknown' }) {
  const color =
    mode === 'live' ? 'text-amber' : mode === 'test' ? 'text-blue-400' : 'text-slate-500';
  return (
    <div>
      <p className="text-xs text-slate-400">Mode</p>
      <p className={`text-sm font-semibold uppercase ${color}`}>{mode}</p>
    </div>
  );
}

export default AdminStripeSettingsPage;
