/**
 * MessengerWebhooksPanel (Admin only)
 * =====================================
 * Section A — Connected Messenger pages: shows Webhook URL + Verify Token to copy.
 * Section B — All Facebook accounts: admin can force-setup Messenger for any account
 *             even if the OAuth flow didn't complete it automatically.
 */

import { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { facebookOAuthService } from '../../services/facebookOAuthService';
import type { MessengerWebhookConnection, FacebookAccountRow } from '../../services/facebookOAuthService';

export function MessengerWebhooksPanel() {
  const [connections, setConnections] = useState<MessengerWebhookConnection[]>([]);
  const [fbAccounts,  setFbAccounts]  = useState<FacebookAccountRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [copied,      setCopied]      = useState('');
  const [setupLoading,  setSetupLoading]  = useState<number | null>(null);
  const [setupResult,   setSetupResult]   = useState<Record<number, { ok: boolean; msg: string }>>({});
  const [testLoading,   setTestLoading]   = useState<number | null>(null);
  const [testResult,    setTestResult]    = useState<Record<number, any>>({});
  const [subLoading,    setSubLoading]    = useState<number | null>(null);
  const [subResult,     setSubResult]     = useState<Record<number, any>>({});

  const load = async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const [webhooks, accounts] = await Promise.all([
        facebookOAuthService.getMessengerWebhooks(),
        facebookOAuthService.getFacebookAccounts(forceRefresh),
      ]);
      setConnections(webhooks.connections);
      setFbAccounts(accounts.accounts);
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSetup = async (accountId: number) => {
    setSetupLoading(accountId);
    setSetupResult(prev => ({ ...prev, [accountId]: { ok: false, msg: '' } }));
    try {
      const res = await facebookOAuthService.adminSetupMessenger(accountId);
      setSetupResult(prev => ({
        ...prev,
        [accountId]: {
          ok: true,
          msg: res.warning
            ? `Setup done (webhook not auto-subscribed: ${res.warning})`
            : `Messenger setup complete for "${res.page_name}". Webhook verified: ${res.webhook_verified ? 'Yes' : 'No — copy URL below'}.`,
        },
      }));
      await load(true); // refresh both sections with re-validation
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Setup failed. Please try again.';
      setSetupResult(prev => ({ ...prev, [accountId]: { ok: false, msg } }));
    } finally {
      setSetupLoading(null);
    }
  };

  const handleCheckSub = async (connectionId: number, resubscribe = false) => {
    setSubLoading(connectionId);
    try {
      const res = await facebookOAuthService.adminCheckSubscription(connectionId, resubscribe);
      setSubResult(prev => ({ ...prev, [connectionId]: res }));
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Check failed.';
      setSubResult(prev => ({ ...prev, [connectionId]: { error: msg } }));
    } finally {
      setSubLoading(null);
    }
  };

  const handleTest = async (connectionId: number) => {
    setTestLoading(connectionId);
    try {
      const res = await facebookOAuthService.adminTestWebhook(connectionId);
      setTestResult(prev => ({ ...prev, [connectionId]: res }));
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Test failed.';
      setTestResult(prev => ({ ...prev, [connectionId]: { error: msg } }));
    } finally {
      setTestLoading(null);
      // Refresh list so conversation counts update
      await load(false);
    }
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copy(text, id)}
      className="ml-1.5 p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
      title="Copy"
    >
      {copied === id
        ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" />
        : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
    </button>
  );

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse space-y-3">
        <div className="h-4 bg-slate-700 rounded w-1/3" />
        {[1, 2].map(i => <div key={i} className="h-16 bg-slate-700 rounded" />)}
      </div>
    );
  }

  // Accounts that do NOT have a messenger connection yet
  const unsetAccounts = fbAccounts.filter(a => !a.has_messenger && a.has_token);

  return (
    <div className="space-y-6">

      {/* ── Section A: Connected Messenger pages ─────────────────────────── */}
      <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8l3.13 3.259L19.752 8l-6.559 6.963z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Messenger Webhook Setup</h3>
              <p className="text-xs text-slate-400">Copy these values into Meta Developer Console</p>
            </div>
          </div>
          <button onClick={() => load(true)} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Re-validate and refresh">
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>

        {/* How to use */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <InformationCircleIcon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-blue-400">How to add webhook in Meta Console</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Go to your Facebook App → <strong className="text-slate-300">Messenger → Settings</strong></li>
              <li>Scroll to <strong className="text-slate-300">Webhooks</strong> → click <strong className="text-slate-300">Add Callback URL</strong></li>
              <li>Paste the <strong className="text-slate-300">Webhook URL</strong> and <strong className="text-slate-300">Verify Token</strong> below</li>
              <li>Subscribe to: <strong className="text-slate-300">messages, messaging_postbacks, messaging_optins</strong></li>
            </ol>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <XCircleIcon className="w-4 h-4 text-red-400" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {connections.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-500">No Messenger connections set up yet.</p>
            <p className="text-xs text-slate-600 mt-1">Use the "Setup Messenger" section below to create one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((c) => (
              <div key={c.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.page_name}</p>
                    <p className="text-xs text-slate-500">
                      User: <span className="text-slate-400">{c.username}</span>
                      {' · '}Page ID: <span className="font-mono text-slate-400">{c.page_id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      c.is_webhook_verified
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {c.is_webhook_verified
                        ? <><CheckCircleIcon className="w-3 h-3" /> Verified</>
                        : <><XCircleIcon className="w-3 h-3" /> Not Verified</>}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      c.is_active
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                    }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Callback URL (Webhook URL)</p>
                  <div className="flex items-center gap-1 p-2 rounded-lg bg-slate-900 border border-white/5">
                    <p className="text-xs font-mono text-slate-300 break-all flex-1">{c.webhook_url}</p>
                    <CopyBtn text={c.webhook_url} id={`url-${c.id}`} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Verify Token</p>
                  <div className="flex items-center gap-1 p-2 rounded-lg bg-slate-900 border border-white/5">
                    <p className="text-xs font-mono text-slate-300 break-all flex-1">{c.verify_token}</p>
                    <CopyBtn text={c.verify_token} id={`token-${c.id}`} />
                  </div>
                </div>

                {c.connected_at && (
                  <p className="text-[10px] text-slate-600">Connected: {new Date(c.connected_at).toLocaleString()}</p>
                )}

                {/* Subscription check */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleCheckSub(c.id)}
                      disabled={subLoading === c.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
                    >
                      {subLoading === c.id
                        ? <><ArrowPathIcon className="w-3 h-3 animate-spin" /> Checking...</>
                        : '🔍 Check Facebook Subscription'}
                    </button>
                    {subResult[c.id] && !subResult[c.id].is_subscribed && (
                      <button
                        onClick={() => handleCheckSub(c.id, true)}
                        disabled={subLoading === c.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white transition-colors"
                      >
                        ⚡ Fix Subscription
                      </button>
                    )}
                  </div>

                  {subResult[c.id] && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs space-y-1.5 ${
                      subResult[c.id].error ? 'bg-red-500/5 border border-red-500/10' :
                      subResult[c.id].is_subscribed ? 'bg-green-500/5 border border-green-500/10' :
                      'bg-amber-500/5 border border-amber-500/10'
                    }`}>
                      {subResult[c.id].error ? (
                        <p className="text-red-400">{subResult[c.id].error}</p>
                      ) : (
                        <>
                          {/* App mode — most important */}
                          {subResult[c.id].app_mode && (
                            <div className={`p-2 rounded ${subResult[c.id].app_mode.is_live ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                              <p className={`font-semibold ${subResult[c.id].app_mode.is_live ? 'text-green-400' : 'text-red-400'}`}>
                                App Mode: {subResult[c.id].app_mode.is_live ? '🟢 LIVE' : '🔴 DEVELOPMENT'}
                              </p>
                              {!subResult[c.id].app_mode.is_live && (
                                <p className="text-red-300 mt-0.5">{subResult[c.id].app_mode.note}</p>
                              )}
                            </div>
                          )}
                          {/* Subscription fields */}
                          <p className={subResult[c.id].is_subscribed ? 'text-green-400' : 'text-amber-400'}>
                            {subResult[c.id].is_subscribed ? '✅ Page subscribed to all required fields' : '⚠️ Page subscription incomplete'}
                          </p>
                          {subResult[c.id].subscribed_fields?.length > 0 && (
                            <p className="text-slate-500">Fields: {subResult[c.id].subscribed_fields.join(', ')}</p>
                          )}
                          {subResult[c.id].missing_fields?.length > 0 && (
                            <p className="text-amber-400">Missing: {subResult[c.id].missing_fields.join(', ')}</p>
                          )}
                          {/* Re-subscribe result */}
                          {subResult[c.id].resubscribe_result?.attempted && (
                            <p className={subResult[c.id].resubscribe_result.success ? 'text-green-400' : 'text-red-400'}>
                              {subResult[c.id].resubscribe_result.success ? '✅ Re-subscribed successfully!' : `❌ Re-subscribe failed: ${subResult[c.id].resubscribe_result.error || 'unknown'}`}
                            </p>
                          )}
                          {/* Final diagnosis */}
                          <p className="text-slate-400 border-t border-white/5 pt-1">{subResult[c.id].diagnosis}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Test connection button */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleTest(c.id)}
                    disabled={testLoading === c.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
                  >
                    {testLoading === c.id
                      ? <><ArrowPathIcon className="w-3 h-3 animate-spin" /> Testing...</>
                      : '🧪 Test Full Pipeline'}
                  </button>

                  {testResult[c.id] && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs space-y-1 ${
                      testResult[c.id].error ? 'bg-red-500/5 border border-red-500/10' :
                      testResult[c.id].conversations?.new_conversation ? 'bg-green-500/5 border border-green-500/10' :
                      'bg-amber-500/5 border border-amber-500/10'
                    }`}>
                      {testResult[c.id].error ? (
                        <p className="text-red-400">{testResult[c.id].error}</p>
                      ) : (
                        <>
                          <p className={testResult[c.id].conversations?.new_conversation ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'}>
                            {testResult[c.id].conversations?.new_conversation ? '✅ Conversation created!' : '⚠️ No conversation created'}
                          </p>
                          <p className="text-slate-400">{testResult[c.id].diagnosis}</p>
                          <p className="text-slate-500">
                            Has AI Config: <span className={testResult[c.id].connection?.has_ai_config ? 'text-green-400' : 'text-red-400'}>
                              {testResult[c.id].connection?.has_ai_config ? 'Yes' : 'No — user needs to configure AI in Messenger Bot settings'}
                            </span>
                          </p>
                          <p className="text-slate-500">
                            Total conversations: {testResult[c.id].conversations?.after_test}
                          </p>
                          {testResult[c.id].conversations?.recent?.length > 0 && (
                            <div className="mt-1">
                              <p className="text-slate-500 font-medium">Recent conversations:</p>
                              {testResult[c.id].conversations.recent.map((conv: any) => (
                                <p key={conv.id} className="text-slate-600 font-mono text-[10px]">
                                  #{conv.id} · {conv.sender_name || conv.sender_id} · {conv.message_count} msgs
                                </p>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section B: Facebook accounts needing Messenger setup ─────────── */}
      <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Cog6ToothIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Manual Messenger Setup</h3>
            <p className="text-xs text-slate-400">
              If a user connected Facebook but Messenger wasn't set up automatically, use this to fix it.
            </p>
          </div>
        </div>

        {fbAccounts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No Facebook accounts connected yet.</p>
        ) : unsetAccounts.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
            <CheckCircleIcon className="w-4 h-4 text-green-400" />
            <p className="text-xs text-green-400">All Facebook accounts have Messenger set up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unsetAccounts.map((a) => (
              <div key={a.account_id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                <div>
                  <p className="text-sm font-medium text-white">{a.page_name}</p>
                  <p className="text-xs text-slate-500">
                    User: <span className="text-slate-400">{a.username}</span>
                    {' · '}
                    <span className={`font-medium ${
                      a.status === 'active' ? 'text-green-400' :
                      a.status === 'invalid' ? 'text-red-400' : 'text-amber-400'
                    }`}>{a.status}</span>
                    {a.last_validated_at && (
                      <span className="text-slate-600 ml-1">
                        · validated {new Date(a.last_validated_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                  {/* Show result message */}
                  {setupResult[a.account_id] && (
                    <div className={`flex items-start gap-1.5 mt-1.5 p-2 rounded-lg text-xs ${
                      setupResult[a.account_id].ok
                        ? 'bg-green-500/5 text-green-400'
                        : 'bg-red-500/5 text-red-400'
                    }`}>
                      {setupResult[a.account_id].ok
                        ? <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        : <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                      <span>{setupResult[a.account_id].msg}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSetup(a.account_id)}
                  disabled={setupLoading === a.account_id}
                  className="ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  {setupLoading === a.account_id
                    ? <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Setting up...</>
                    : <><Cog6ToothIcon className="w-3.5 h-3.5" /> Setup Messenger</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* All accounts summary */}
        {fbAccounts.length > 0 && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-slate-600">
              Total Facebook accounts: {fbAccounts.length} · With Messenger: {fbAccounts.filter(a => a.has_messenger).length} · Without: {unsetAccounts.length}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default MessengerWebhooksPanel;
