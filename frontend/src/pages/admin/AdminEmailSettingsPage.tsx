import { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui';
import { api } from '../../services/api';

interface EmailSettings {
  email_host: string;
  email_port: string;
  email_use_tls: string;
  email_host_user: string;
  email_host_password: string;
  email_default_from: string;
  email_admin_notification: string;
}

const FIELD_META: {
  key: keyof EmailSettings;
  label: string;
  description: string;
  secret?: boolean;
  placeholder?: string;
}[] = [
  {
    key: 'email_host',
    label: 'SMTP Host',
    description: 'Gmail users: smtp.gmail.com',
    placeholder: 'smtp.gmail.com',
  },
  {
    key: 'email_port',
    label: 'SMTP Port',
    description: 'Gmail with TLS: 587  |  SSL: 465',
    placeholder: '587',
  },
  {
    key: 'email_use_tls',
    label: 'Use TLS',
    description: 'True or False',
    placeholder: 'True',
  },
  {
    key: 'email_host_user',
    label: 'Gmail Address',
    description: 'The Gmail account used to send emails',
    placeholder: 'yourname@gmail.com',
  },
  {
    key: 'email_host_password',
    label: 'App Password',
    description: 'Generate at: Google Account → Security → 2-Step Verification → App Passwords',
    secret: true,
    placeholder: 'xxxx xxxx xxxx xxxx',
  },
  {
    key: 'email_default_from',
    label: 'From Address',
    description: 'Shown to email recipients as the sender name',
    placeholder: 'Sellanto <yourname@gmail.com>',
  },
  {
    key: 'email_admin_notification',
    label: 'Admin Notification Email',
    description: 'Receives refund requests and system alerts',
    placeholder: 'admin@example.com',
  },
];

const EMPTY: EmailSettings = {
  email_host: '',
  email_port: '',
  email_use_tls: '',
  email_host_user: '',
  email_host_password: '',
  email_default_from: '',
  email_admin_notification: '',
};

export function AdminEmailSettingsPage() {
  const [saved, setSaved] = useState<EmailSettings>(EMPTY);
  const [edits, setEdits] = useState<Partial<EmailSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; sent_to?: string; error?: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/email-settings/');
      setSaved(data);
      setEdits({});
    } catch {
      setError('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const current = (key: keyof EmailSettings) =>
    key in edits ? (edits[key] ?? '') : (saved[key] ?? '');

  const handleChange = (key: keyof EmailSettings, value: string) =>
    setEdits((e) => ({ ...e, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/admin/email-settings/update/', edits);
      setSuccess('Email settings saved successfully.');
      await load();
    } catch {
      setError('Failed to save settings. Check the values and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post(
        '/admin/email-settings/test/',
        testRecipient ? { test_recipient: testRecipient } : {},
      );
      setTestResult(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setTestResult({ ok: false, error: e?.response?.data?.error || e?.message || 'Request failed' });
    } finally {
      setTesting(false);
    }
  };

  const pendingCount = Object.keys(edits).length;

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">Loading email settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Email Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure Gmail SMTP credentials here — no need to edit <code className="text-xs bg-white/5 px-1 py-0.5 rounded">.env</code> or restart the server.
          Changes take effect immediately for all outgoing emails.
        </p>
      </div>

      {/* How-to banner */}
      <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-4 text-xs text-slate-300 space-y-1">
        <p className="font-semibold text-blue-300 mb-1">Gmail setup in 3 steps</p>
        <p>1. Enable <strong>2-Step Verification</strong> on your Google Account.</p>
        <p>2. Go to Google Account → Security → 2-Step Verification → <strong>App Passwords</strong>.</p>
        <p>3. Create an app password for "Mail", paste the 16-character code below.</p>
      </div>

      {/* Fields */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-bold text-white">SMTP Configuration</h2>
        </div>
        <div className="p-4 space-y-5">
          {FIELD_META.map(({ key, label, description, secret, placeholder }) => {
            const val = current(key);
            const isEdited = key in edits;
            const isPassword = secret;
            const inputType = isPassword && !reveal ? 'password' : 'text';

            return (
              <div key={key} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-start">
                <div className="md:pt-2">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
                </div>
                <div>
                  <div className="flex gap-2 items-center">
                    <input
                      type={inputType}
                      value={val}
                      placeholder={placeholder}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="flex-1 px-3 py-2 text-sm rounded-lg bg-black/30 border border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-coral/40 focus:ring-1 focus:ring-coral/20 font-mono"
                    />
                    {isPassword && (
                      <button
                        onClick={() => setReveal((r) => !r)}
                        className="p-2 rounded hover:bg-white/10 transition-colors"
                        title={reveal ? 'Hide' : 'Show'}
                      >
                        {reveal
                          ? <EyeSlashIcon className="w-4 h-4 text-slate-400" />
                          : <EyeIcon className="w-4 h-4 text-slate-400" />}
                      </button>
                    )}
                  </div>
                  {isEdited && (
                    <p className="text-[10px] text-blue-400 mt-1">● Unsaved change</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Test email */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-bold text-white">Send Test Email</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verify your SMTP settings work by sending a test email. Save your settings first.
          </p>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start">
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder={saved.email_host_user || 'recipient@example.com'}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-black/30 border border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-coral/40 focus:ring-1 focus:ring-coral/20"
          />
          <Button
            variant="secondary"
            onClick={handleTest}
            isLoading={testing}
            disabled={testing}
          >
            <PaperAirplaneIcon className="w-4 h-4 mr-1.5" />
            Send test
          </Button>
        </div>

        {testResult && (
          <div className={`mx-4 mb-4 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
            testResult.ok
              ? 'bg-green-500/10 border border-green-500/20 text-green-300'
              : 'bg-coral/10 border border-coral/20 text-coral'
          }`}>
            {testResult.ok
              ? <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <XCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>
              {testResult.ok
                ? `Test email sent to ${testResult.sent_to}`
                : `Failed: ${testResult.error}`}
            </span>
          </div>
        )}
      </section>

      {/* Error / success */}
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

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-2 px-2 py-3 bg-bg-page/95 backdrop-blur border-t border-white/5 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {pendingCount === 0 ? 'No pending changes' : `${pendingCount} pending change(s)`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={pendingCount === 0 || saving}
            onClick={() => setEdits({})}
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            isLoading={saving}
            disabled={pendingCount === 0}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AdminEmailSettingsPage;
