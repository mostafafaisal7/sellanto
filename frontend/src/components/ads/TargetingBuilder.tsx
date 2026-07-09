/**
 * TargetingBuilder
 * ================
 * Reusable, controlled targeting editor. Emits a Meta-shaped targeting object:
 *   { geo_locations: { countries: [...] }, age_min, age_max, genders?,
 *     interests: [ids], placements: [...] }
 *
 * Fields: country (list + live geo search), age min/max, gender, live interest
 * search (adds chips), and placement checkboxes.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adsService, type GeoSearchResult, type TargetingSearchResult } from '../../services/adsService';

// The controlled value this component reads/emits.
export interface TargetingValue {
  geo_locations: { countries: string[] };
  age_min: number;
  age_max: number;
  /** Meta genders: 1 = male, 2 = female; omit/empty for all. */
  genders?: number[];
  /** Interest / behavior spec ids. */
  interests: string[];
  placements: string[];
}

// A picked interest — we keep the name for the chip label alongside its id.
interface InterestChip {
  id: string;
  name: string;
}

interface Props {
  value: TargetingValue;
  onChange: (next: TargetingValue) => void;
  adAccountId?: number;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'BD', name: 'Bangladesh' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
];

const PLACEMENTS: { key: string; label: string }[] = [
  { key: 'facebook:feed', label: 'Facebook Feed' },
  { key: 'instagram:feed', label: 'Instagram Feed' },
  { key: 'facebook:story', label: 'Facebook Stories' },
  { key: 'instagram:story', label: 'Instagram Stories' },
  { key: 'instagram:reels', label: 'Instagram Reels' },
  { key: 'facebook:marketplace', label: 'Marketplace' },
];

/** Build the default/empty targeting value (handy for callers). */
export function emptyTargeting(country = 'US'): TargetingValue {
  return {
    geo_locations: { countries: [country] },
    age_min: 18,
    age_max: 65,
    interests: [],
    placements: [],
  };
}

export function TargetingBuilder({ value, onChange, adAccountId }: Props) {
  // Interest chips carry names for display; value.interests stays id-only.
  const [interestChips, setInterestChips] = useState<InterestChip[]>([]);

  // Interest search
  const [interestQuery, setInterestQuery] = useState('');
  const [interestResults, setInterestResults] = useState<TargetingSearchResult[]>([]);
  const [interestLoading, setInterestLoading] = useState(false);

  // Geo search
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoSearchResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const patch = useCallback(
    (changes: Partial<TargetingValue>) => onChange({ ...value, ...changes }),
    [onChange, value],
  );

  // ── Interest search (debounced) ──────────────────────────────────────────
  const interestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (interestTimer.current) clearTimeout(interestTimer.current);
    const q = interestQuery.trim();
    if (q.length < 2) { setInterestResults([]); return; }
    interestTimer.current = setTimeout(() => {
      setInterestLoading(true);
      adsService
        .searchTargeting({ q, type: 'interest', ad_account_id: adAccountId })
        .then((r) => setInterestResults(r.results || []))
        .catch(() => setInterestResults([]))
        .finally(() => setInterestLoading(false));
    }, 350);
    return () => { if (interestTimer.current) clearTimeout(interestTimer.current); };
  }, [interestQuery, adAccountId]);

  // ── Geo search (debounced) ───────────────────────────────────────────────
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    const q = geoQuery.trim();
    if (q.length < 2) { setGeoResults([]); return; }
    geoTimer.current = setTimeout(() => {
      setGeoLoading(true);
      adsService
        .searchGeo({ q, ad_account_id: adAccountId })
        .then((r) => setGeoResults(r.results || []))
        .catch(() => setGeoResults([]))
        .finally(() => setGeoLoading(false));
    }, 350);
    return () => { if (geoTimer.current) clearTimeout(geoTimer.current); };
  }, [geoQuery, adAccountId]);

  const gender: 'all' | 'male' | 'female' =
    value.genders?.includes(1) && !value.genders?.includes(2)
      ? 'male'
      : value.genders?.includes(2) && !value.genders?.includes(1)
      ? 'female'
      : 'all';

  const setGender = (g: 'all' | 'male' | 'female') => {
    if (g === 'male') patch({ genders: [1] });
    else if (g === 'female') patch({ genders: [2] });
    else {
      const next = { ...value };
      delete next.genders;
      onChange(next);
    }
  };

  const countries = value.geo_locations?.countries ?? [];

  const addCountry = (code: string) => {
    if (!code || countries.includes(code)) return;
    patch({ geo_locations: { countries: [...countries, code] } });
  };
  const removeCountry = (code: string) => {
    patch({ geo_locations: { countries: countries.filter((c) => c !== code) } });
  };

  const addInterest = (r: TargetingSearchResult) => {
    if (value.interests.includes(r.id)) return;
    setInterestChips((prev) => [...prev, { id: r.id, name: r.name }]);
    patch({ interests: [...value.interests, r.id] });
    setInterestQuery('');
    setInterestResults([]);
  };
  const removeInterest = (id: string) => {
    setInterestChips((prev) => prev.filter((c) => c.id !== id));
    patch({ interests: value.interests.filter((x) => x !== id) });
  };

  const togglePlacement = (key: string) => {
    const has = value.placements.includes(key);
    patch({ placements: has ? value.placements.filter((p) => p !== key) : [...value.placements, key] });
  };

  const inputCls =
    'w-full bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none';

  return (
    <div className="space-y-4">
      {/* Countries */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Countries</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {countries.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px]">
              {COUNTRIES.find((x) => x.code === c)?.name || c}
              <button type="button" onClick={() => removeCountry(c)} className="hover:text-white">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
          {countries.length === 0 && <span className="text-[11px] text-text-muted">No countries selected.</span>}
        </div>
        <select
          value=""
          onChange={(e) => { addCountry(e.target.value); }}
          className={inputCls}
        >
          <option value="">+ Add a country…</option>
          {COUNTRIES.filter((c) => !countries.includes(c.code)).map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>

        {/* Geo search */}
        <div className="relative mt-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={geoQuery}
            onChange={(e) => setGeoQuery(e.target.value)}
            placeholder="Search a country/region to add…"
            className={`${inputCls} pl-9`}
          />
          {geoLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">…</span>}
        </div>
        {geoResults.length > 0 && (
          <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-dark-900/80 divide-y divide-white/5">
            {geoResults.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => { if (g.country_code) addCountry(g.country_code); setGeoQuery(''); setGeoResults([]); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5"
                >
                  {g.name} <span className="text-text-muted">· {g.type}{g.country_code ? ` · ${g.country_code}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Age + gender */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Age min</label>
          <input
            type="number" min={13} max={65} value={value.age_min}
            onChange={(e) => patch({ age_min: parseInt(e.target.value || '13', 10) })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Age max</label>
          <input
            type="number" min={13} max={65} value={value.age_max}
            onChange={(e) => patch({ age_max: parseInt(e.target.value || '65', 10) })}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Gender</label>
        <div className="grid grid-cols-3 gap-2">
          {(['all', 'male', 'female'] as const).map((g) => (
            <button
              key={g} type="button" onClick={() => setGender(g)}
              className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                gender === g
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                  : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Interests</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {interestChips.map((chip) => (
            <span key={chip.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-[11px]">
              {chip.name}
              <button type="button" onClick={() => removeInterest(chip.id)} className="hover:text-white">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={interestQuery}
            onChange={(e) => setInterestQuery(e.target.value)}
            placeholder="Search interests (e.g. fitness, cooking)…"
            className={`${inputCls} pl-9`}
          />
          {interestLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">…</span>}
        </div>
        {interestResults.length > 0 && (
          <ul className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-dark-900/80 divide-y divide-white/5">
            {interestResults.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => addInterest(r)}
                  disabled={value.interests.includes(r.id)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40 flex items-center justify-between gap-2"
                >
                  <span className="text-text-secondary truncate">
                    {r.name}
                    {r.path && r.path.length > 0 && (
                      <span className="text-text-muted"> · {r.path.join(' › ')}</span>
                    )}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {r.audience_size ? `${r.audience_size.toLocaleString()} people` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Placements */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
          Placements <span className="text-text-muted font-normal">(leave all unchecked for automatic)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PLACEMENTS.map((p) => {
            const checked = value.placements.includes(p.key);
            return (
              <button
                key={p.key} type="button" onClick={() => togglePlacement(p.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  checked
                    ? 'bg-purple-500/15 text-purple-200 border border-purple-500/40'
                    : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  checked ? 'bg-purple-500 border-purple-500 text-white' : 'border-white/20'
                }`}>
                  {checked ? '✓' : ''}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TargetingBuilder;
