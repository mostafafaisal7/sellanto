import { useState, useEffect } from 'react';
import { KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { diamondService } from '../../services/diamondService';
import type { GlobalAPIKeysStatus } from '../../types';

export function GlobalAPIKeysPanel() {
  const [keys, setKeys] = useState<GlobalAPIKeysStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const data = await diamondService.getGlobalAPIKeys();
      setKeys(data);
    } catch {
      setError('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string> = {};
      if (openaiKey) payload.openai_api_key = openaiKey;
      if (geminiKey) payload.gemini_api_key = geminiKey;
      if (claudeKey) payload.claude_api_key = claudeKey;

      await diamondService.updateGlobalAPIKeys(payload);
      setOpenaiKey('');
      setGeminiKey('');
      setClaudeKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadKeys();
    } catch {
      setError('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse">
        <div className="h-5 bg-slate-700 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-700 rounded" />)}
        </div>
      </div>
    );
  }

  const providers = [
    { key: 'openai', label: 'OpenAI', value: openaiKey, setter: setOpenaiKey, placeholder: 'sk-...' },
    { key: 'gemini', label: 'Google Gemini', value: geminiKey, setter: setGeminiKey, placeholder: 'AIza...' },
    { key: 'claude', label: 'Claude (Anthropic)', value: claudeKey, setter: setClaudeKey, placeholder: 'sk-ant-...' },
  ] as const;

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <KeyIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Global API Keys</h3>
          <p className="text-xs text-slate-400">Set once, works for ALL users</p>
        </div>
      </div>

      <div className="space-y-4">
        {providers.map((p) => {
          const status = keys?.[p.key as keyof GlobalAPIKeysStatus];
          return (
            <div key={p.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-300">{p.label}</label>
                <span className="flex items-center gap-1 text-xs">
                  {status?.is_active ? (
                    <><CheckCircleIcon className="w-3.5 h-3.5 text-green-400" /> <span className="text-green-400">Active</span></>
                  ) : (
                    <><XCircleIcon className="w-3.5 h-3.5 text-slate-500" /> <span className="text-slate-500">Not set</span></>
                  )}
                </span>
              </div>
              <input
                type="password"
                value={p.value}
                onChange={(e) => p.setter(e.target.value)}
                placeholder={status?.masked_key || p.placeholder}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
          );
        })}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || (!openaiKey && !geminiKey && !claudeKey)}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save API Keys'}
        </button>
      </div>
    </div>
  );
}

export default GlobalAPIKeysPanel;
