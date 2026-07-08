/**
 * AudiencesPanel
 * ==============
 * List + create + delete saved audience presets for an ad account.
 * Backend: /ads/audiences/ (AdAudienceListCreateView / AdAudienceDetailView).
 *
 * These are reusable targeting presets. (Live Meta Custom/Lookalike audience
 * sync is a documented follow-up; saved presets are functional today.)
 */
import { useState, useEffect, useCallback } from 'react';
import { UserGroupIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { adsService, type AdAudience } from '../../services/adsService';

const COUNTRIES = ['US', 'BD', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR'];

export function AudiencesPanel({ adAccountId }: { adAccountId: number }) {
  const [audiences, setAudiences] = useState<AdAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('US');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adsService.listAudiences(adAccountId);
      setAudiences(r.audiences || []);
    } catch {
      setError('Could not load audiences.');
    } finally {
      setLoading(false);
    }
  }, [adAccountId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await adsService.createAudience({
        name: name.trim(),
        ad_account_id: adAccountId,
        audience_type: 'saved',
        config: {
          geo_locations: { countries: [country] },
          age_min: parseInt(ageMin, 10),
          age_max: parseInt(ageMax, 10),
        },
      });
      setName('');
      setShowForm(false);
      await load();
    } catch {
      setError('Could not save the audience.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: AdAudience) => {
    if (!window.confirm(`Delete audience "${a.name}"?`)) return;
    setError(null);
    try {
      await adsService.deleteAudience(a.id);
      setAudiences((prev) => prev.filter((x) => x.id !== a.id));
    } catch {
      setError('Could not delete the audience. It may already be gone — refresh.');
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-4 h-4 text-cyan-300" />
          <h4 className="text-sm font-bold text-text-primary">Saved audiences</h4>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200">
          <PlusIcon className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 text-red-300 text-xs">{error}</div>
      )}

      {showForm && (
        <div className="mb-3 p-3 rounded-lg bg-dark-900/60 border border-white/10 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Audience name"
            className="w-full bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none" />
          <div className="grid grid-cols-3 gap-2">
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none">
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="age min"
              className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none" />
            <input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="age max"
              className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none" />
          </div>
          <button onClick={create} disabled={saving || !name.trim()}
            className="w-full py-1.5 rounded-lg bg-purple-500/20 text-purple-200 text-xs font-semibold hover:bg-purple-500/30 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save audience'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : audiences.length === 0 ? (
        <p className="text-xs text-text-muted">No saved audiences yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {audiences.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-dark-900/60">
              <div className="min-w-0">
                <p className="text-text-primary font-semibold truncate">{a.name}</p>
                <p className="text-[10px] text-text-muted capitalize">{a.audience_type}</p>
              </div>
              <button onClick={() => remove(a)} className="text-red-400 hover:text-red-300 shrink-0">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AudiencesPanel;
