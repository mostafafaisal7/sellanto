import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
  BeakerIcon,
  GlobeAltIcon,
  FireIcon,
  LightBulbIcon,
  PencilSquareIcon,
  PhotoIcon,
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  PencilIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChevronDownIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  XMarkIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { useOverflowStore } from '../store';
import strategyService from '../services/strategyService';
import captionService from '../services/captionService';
import { imageService } from '../services/imageService';
import postService from '../services/postService';
import api, { authFetch } from '../services/api';
import type { ContentIdea, TrendingTopic, PlatformType } from '../types';
import { PromptInfoButton } from '../components/ui/PromptInfoButton';
import { usePromptHistory } from '../hooks/usePromptHistory';
import { CopyOverlayModal } from '../components/ai-image/CopyOverlayModal';

// ─── Step indicator ────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Strategy', icon: BeakerIcon },
  { num: 2, label: 'Ideas', icon: LightBulbIcon },
  { num: 3, label: 'Captions', icon: PencilSquareIcon },
  { num: 4, label: 'Media', icon: PhotoIcon },
  { num: 5, label: 'Post', icon: SparklesIcon },
  { num: 6, label: 'Calendar', icon: CalendarDaysIcon },
];

const SUB_STEPS = ['Brand DNA', 'Pillars', 'Competitors', 'Trending'];

// ─── Types ────────────────────────────────────────────────
interface Pillar {
  id: number; name: string; description: string;
  target_percentage: number; color_code: string;
}
interface Competitor {
  id: number; platform: string; handle_or_url: string;
  last_crawled_at: string | null;
}
interface CaptionVariant {
  id: string; ideaId: number; text: string; selected: boolean;
}

// ─── Main Component ──────────────────────────────────────
export function OverflowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const overflow = useOverflowStore();

  const [brandId, setBrandIdLocal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fresh start on normal visit; skip reset if coming from Ideas Hub
  useEffect(() => {
    const fromIdeas = (location.state as any)?.fromIdeas === true;

    if (!fromIdeas) {
      // Normal entry — full reset and fresh start
      overflow.reset();
      localStorage.removeItem('overflow_selected_caption');
      localStorage.removeItem('overflow_caption_groups');
      localStorage.removeItem('overflow_has_upload');
    }

    const init = async () => {
      try {
        const res = await api.get('/brands/');
        const brands = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (brands.length > 0) {
          const primary = brands.find((b: any) => b.is_primary) || brands[0];
          setBrandIdLocal(primary.id);
          if (!fromIdeas) {
            overflow.setBrandId(primary.id);
          }
        }
      } catch { /* no brands */ }
      setLoading(false);
    };
    init();
  }, []);

  const handleSkip = async () => {
    await overflow.skip();
    navigate('/');
  };

  const goNext = () => {
    // Step 1 has 4 sub-steps — navigate through them first
    if (overflow.currentStep === 1 && overflow.subStep < 4) {
      overflow.setSubStep(overflow.subStep + 1);
      return;
    }
    const next = overflow.currentStep + 1;
    if (next <= 6) {
      overflow.setStep(next);
      overflow.setSubStep(1);
      overflow.saveToServer();
    }
  };

  const goPrev = () => {
    // Step 1 sub-step navigation
    if (overflow.currentStep === 1 && overflow.subStep > 1) {
      overflow.setSubStep(overflow.subStep - 1);
      return;
    }
    if (overflow.currentStep > 1) {
      overflow.setStep(overflow.currentStep - 1);
      // If going back to Step 1, go to last sub-step (Trending)
      if (overflow.currentStep - 1 === 1) {
        overflow.setSubStep(4);
      } else {
        overflow.setSubStep(1);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Get Started</h1>
          <p className="text-sm text-white mt-1">Follow these steps to set up your content pipeline</p>
        </div>
        <button onClick={handleSkip} className="text-sm text-text-muted hover:text-text-primary transition-colors">
          Skip & Go to Dashboard →
        </button>
      </div>

      {/* Step Indicator */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isActive = overflow.currentStep === step.num;
            const isDone = overflow.currentStep > step.num;
            return (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isDone ? 'bg-green-500/20 text-green-400' :
                    isActive ? 'bg-primary-500/20 text-primary-400 ring-2 ring-primary-500/50' :
                    'bg-white/5 text-text-muted'
                  }`}>
                    {isDone ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 ${isActive ? 'text-primary-400 font-medium' : 'text-text-muted'}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 ${isDone ? 'bg-green-500/40' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${overflow.currentStep}-${overflow.subStep}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {overflow.currentStep === 1 && <StrategyStep brandId={brandId} />}
          {overflow.currentStep === 2 && <IdeasStep brandId={brandId} />}
          {overflow.currentStep === 3 && <CaptionsStep />}
          {overflow.currentStep === 4 && <MediaStep />}
          {overflow.currentStep === 5 && <CreatePostStep brandId={brandId} />}
          {overflow.currentStep === 6 && <CalendarStep />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={goPrev}
          disabled={overflow.currentStep === 1 && overflow.subStep === 1}
          className="btn-secondary flex items-center gap-2 disabled:opacity-30"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Previous
        </button>
        {overflow.currentStep < 6 ? (
          <button
            onClick={goNext}
            disabled={overflow.currentStep === 4 && (
              overflow.selectedCaptions.length === 0 ||
              !overflow.selectedCaptions.every((c) => overflow.captionMediaMap[c.id]?.mediaUrl)
            )}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next Step <ArrowRightIcon className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => { overflow.complete(); navigate('/'); }}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircleIcon className="w-4 h-4" /> Complete Setup
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 1 — Strategy
// ═══════════════════════════════════════════════════════════
function StrategyStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  const subStep = overflow.subStep;

  return (
    <div className="space-y-4">
      {/* Sub-step tabs */}
      <div className="flex gap-2 flex-wrap">
        {SUB_STEPS.map((label, idx) => {
          const num = idx + 1;
          const completed =
            (num === 1 && overflow.dnaCompleted) ||
            (num === 2 && overflow.pillarsCompleted) ||
            (num === 3 && overflow.competitorsCompleted) ||
            (num === 4 && overflow.trendingCompleted);
          return (
            <button
              key={label}
              onClick={() => overflow.setSubStep(num)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                subStep === num
                  ? 'bg-primary-500/20 text-primary-400'
                  : completed
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10'
              }`}
            >
              {completed && <CheckCircleIcon className="w-3.5 h-3.5" />}
              {label}
            </button>
          );
        })}
      </div>

      {subStep === 1 && <DNASubStep brandId={brandId} />}
      {subStep === 2 && <PillarsSubStep brandId={brandId} />}
      {subStep === 3 && <CompetitorsSubStep brandId={brandId} />}
      {subStep === 4 && <TrendingSubStep brandId={brandId} />}
    </div>
  );
}

// --- Sub-step 1.1: Brand DNA ---
function DNASubStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dnaData, setDnaData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dnaInputs, setDnaInputs] = useState<Record<string, any>>({});
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string; type: 'text' | 'list' }>>([]);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'list'>('text');
  const [dnaUsedPrompt, setDnaUsedPrompt] = useState('');
  const [dnaRegenerating, setDnaRegenerating] = useState(false);
  const dnaHistory = usePromptHistory(brandId, 'brand_dna');

  // Brand Logo
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const BUILTIN_KEYS = new Set([
    'brand_name', 'tagline', 'industry', 'description', 'products_services',
    'target_audience', 'unique_selling_points', 'brand_voice', 'brand_values',
    'color_theme', 'content_themes', 'cta_style', 'social_platforms', 'keywords',
    'competitor_positioning', 'website_url',
  ]);

  const autoGenTriggered = useRef(false);
  useEffect(() => {
    if (!brandId) return;
    strategyService.getDNAStatus(brandId).then((res) => {
      if (res.brand_dna && Object.keys(res.brand_dna).length > 0) {
        setDnaData(res.brand_dna);
        if (res.website_url) setUrl(res.website_url);
        overflow.markDNAComplete();
        // Auto-generate if only structured DNA exists and website URL is available
        if (res.brand_dna_source === 'structured' && res.website_url && !autoGenTriggered.current) {
          autoGenTriggered.current = true;
          setLoading(true);
          strategyService.generateDNA(brandId, res.website_url).then((result) => {
            if (result.brand_dna) {
              setDnaData(result.brand_dna);
              overflow.markDNAComplete();
              if (result.used_prompt) setDnaUsedPrompt(result.used_prompt);
            }
          }).catch(() => {}).finally(() => setLoading(false));
        }
      }
    }).catch(() => {});
    // Fetch brand logo
    api.get(`/brands/${brandId}/`).then((res) => {
      if (res.data.logo) setBrandLogo(res.data.logo);
    }).catch(() => {});
  }, [brandId]);

  const handleGenerate = async () => {
    if (!brandId || !url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await strategyService.generateDNA(brandId, url.trim());
      if (result.brand_dna) {
        setDnaData(result.brand_dna);
        overflow.markDNAComplete();
        if (result.used_prompt) setDnaUsedPrompt(result.used_prompt);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate DNA.');
    }
    setLoading(false);
  };

  const handleDNARegenerate = async (editedPrompt: string) => {
    if (!brandId || !url.trim()) return;
    setDnaRegenerating(true);
    try {
      const result = await strategyService.generateDNA(brandId, url.trim(), editedPrompt);
      if (result.brand_dna) {
        setDnaData(result.brand_dna);
        if (result.used_prompt) setDnaUsedPrompt(result.used_prompt);
      }
    } catch { /* ignore */ }
    setDnaRegenerating(false);
  };

  const enterEditMode = () => {
    if (!dnaData) return;
    setDnaInputs({
      brand_name: dnaData.brand_name || '', tagline: dnaData.tagline || '',
      industry: dnaData.industry || '', description: dnaData.description || '',
      products_services: Array.isArray(dnaData.products_services) ? dnaData.products_services : [],
      target_audience: dnaData.target_audience || '',
      unique_selling_points: Array.isArray(dnaData.unique_selling_points) ? dnaData.unique_selling_points : [],
      brand_voice: dnaData.brand_voice || '',
      brand_values: Array.isArray(dnaData.brand_values) ? dnaData.brand_values : [],
      color_theme: Array.isArray(dnaData.color_theme) ? dnaData.color_theme : [],
      content_themes: Array.isArray(dnaData.content_themes) ? dnaData.content_themes : [],
      cta_style: dnaData.cta_style || '',
      social_platforms: Array.isArray(dnaData.social_platforms) ? dnaData.social_platforms : [],
      keywords: Array.isArray(dnaData.keywords) ? dnaData.keywords : [],
      competitor_positioning: dnaData.competitor_positioning || '',
      website_url: dnaData.website_url || '',
    });
    const extras: Array<{ key: string; value: string; type: 'text' | 'list' }> = [];
    Object.entries(dnaData).forEach(([key, val]) => {
      if (!BUILTIN_KEYS.has(key) && val !== null && val !== undefined && val !== '') {
        extras.push({ key, value: Array.isArray(val) ? val.join(', ') : String(val), type: Array.isArray(val) ? 'list' : 'text' });
      }
    });
    setCustomFields(extras);
    setEditMode(true);
  };

  const handleSave = async (useAi: boolean) => {
    if (!brandId) return;
    setSaving(true);
    setError(null);
    try {
      const merged = { ...dnaInputs };
      customFields.forEach((cf) => {
        if (cf.key.trim()) {
          merged[cf.key.trim()] = cf.type === 'list'
            ? cf.value.split(',').map((v: string) => v.trim()).filter(Boolean)
            : cf.value;
        }
      });
      const result = await strategyService.regenerateDNAFromInputs(brandId, { ...merged, use_ai: useAi });
      if (result.brand_dna) { setDnaData(result.brand_dna); }
      setEditMode(false);
      overflow.markDNAComplete();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save DNA.');
    }
    setSaving(false);
  };

  const setField = (f: string, v: string) => setDnaInputs((p) => ({ ...p, [f]: v }));
  const addChip = (f: string, v: string) => { if (!v.trim()) return; setDnaInputs((p) => ({ ...p, [f]: [...(p[f] || []), v.trim()] })); };
  const removeChip = (f: string, idx: number) => setDnaInputs((p) => ({ ...p, [f]: (p[f] || []).filter((_: string, i: number) => i !== idx) }));

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png') { alert('Please select a PNG file'); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUpload = async () => {
    if (!brandId || !logoFile) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const res = await api.patch(`/brands/${brandId}/`, formData);
      setBrandLogo(res.data.logo);
      // Also create UserLogo for AI Image page
      const logoFormData = new FormData();
      logoFormData.append('name', dnaData?.brand_name || 'Brand Logo');
      logoFormData.append('logo_file', logoFile);
      await authFetch('/api/v1/ai-image/logos/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: logoFormData,
      });
      setLogoFile(null);
      setLogoPreview(null);
    } catch (err) { console.error('Failed to upload logo:', err); }
    finally { setLogoUploading(false); }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview(null); }
  };

  return (
    <div className="space-y-4">
      {/* URL Input + Generate */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <BeakerIcon className="w-5 h-5 text-primary-400" />
          Brand DNA Generator
          <PromptInfoButton prompt={dnaUsedPrompt} label="Brand DNA Generation Prompt" onRegenerate={handleDNARegenerate} regenerating={dnaRegenerating} regenerateLabel="Regenerate DNA" promptHistory={dnaHistory.history} onLoadHistory={dnaHistory.load} historyLoading={dnaHistory.loading} />
        </h3>
        <p className="text-sm text-white mb-4">
          Enter your website URL and we'll analyze it to extract your brand's identity, tone, products, values, and more.
        </p>
        <div className="flex gap-3">
          <input type="url" className="input flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-website.com" />
          <button onClick={handleGenerate} disabled={loading || !url.trim()} className="btn-primary flex items-center gap-2 px-6">
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <SparklesIcon className="w-4 h-4" />}
            {loading ? 'Generating...' : dnaData ? 'Reanalyze' : 'Generate DNA'}
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {loading && (
        <div className="card p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-muted mt-3 text-sm">Analyzing your website with AI...</p>
          <p className="text-text-muted text-xs mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* === EDIT MODE === */}
      {editMode && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Brand Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { f: 'brand_name', l: 'Brand Name' }, { f: 'tagline', l: 'Tagline' },
                { f: 'industry', l: 'Industry' }, { f: 'brand_voice', l: 'Brand Voice' },
              ].map(({ f, l }) => (
                <div key={f}>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">{l}</label>
                  <input type="text" className="input w-full mt-1" value={dnaInputs[f] || ''} onChange={(e) => setField(f, e.target.value)} />
                </div>
              ))}
            </div>
            {[
              { f: 'description', l: 'Description', rows: 3 }, { f: 'target_audience', l: 'Target Audience', rows: 2 },
              { f: 'competitor_positioning', l: 'Competitor Positioning', rows: 2 },
            ].map(({ f, l, rows }) => (
              <div key={f} className="mt-4">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">{l}</label>
                <textarea className="input w-full mt-1" rows={rows} value={dnaInputs[f] || ''} onChange={(e) => setField(f, e.target.value)} />
              </div>
            ))}
            <div className="mt-4">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">CTA Style</label>
              <input type="text" className="input w-full mt-1" value={dnaInputs.cta_style || ''} onChange={(e) => setField('cta_style', e.target.value)} />
            </div>
          </div>

          {/* Chip fields */}
          {[
            { field: 'products_services', label: 'Products & Services' },
            { field: 'unique_selling_points', label: 'Unique Selling Points' },
            { field: 'brand_values', label: 'Brand Values' },
          ].map(({ field, label }) => (
            <div key={field} className="card p-6">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">{label}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(dnaInputs[field] || []).map((item: string, idx: number) => (
                  <span key={idx} className="bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full text-sm flex items-center gap-1.5">
                    {item}
                    <button onClick={() => removeChip(field, idx)} className="hover:text-red-400 text-xs ml-1">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" className="input flex-1" placeholder={`Add ${label.toLowerCase()}...`}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(field, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                />
                <button className="btn-secondary px-3" onClick={(e) => { const input = (e.currentTarget.previousElementSibling as HTMLInputElement); addChip(field, input.value); input.value = ''; }}>
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { field: 'content_themes', label: 'Content Themes' }, { field: 'keywords', label: 'Keywords' },
              { field: 'color_theme', label: 'Color Theme' }, { field: 'social_platforms', label: 'Social Platforms' },
            ].map(({ field, label }) => (
              <div key={field} className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">{label}</h4>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(dnaInputs[field] || []).map((item: string, idx: number) => (
                    <span key={idx} className="bg-dark-600 text-text-secondary px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      {item} <button onClick={() => removeChip(field, idx)} className="hover:text-red-400">&times;</button>
                    </span>
                  ))}
                </div>
                <input type="text" className="input w-full text-sm" placeholder={`Add ${label.toLowerCase()}, press Enter`}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(field, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                />
              </div>
            ))}
          </div>

          {/* Custom Fields */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Custom Fields
            </h3>
            {customFields.map((cf, idx) => (
              <div key={idx} className="flex items-start gap-3 mb-3 bg-dark-700/50 rounded-lg p-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" className="input text-sm flex-1" placeholder="Field name" value={cf.key}
                      onChange={(e) => { const u = [...customFields]; u[idx] = { ...cf, key: e.target.value }; setCustomFields(u); }} />
                    <select className="input text-xs w-24" value={cf.type}
                      onChange={(e) => { const u = [...customFields]; u[idx] = { ...cf, type: e.target.value as 'text' | 'list' }; setCustomFields(u); }}>
                      <option value="text">Text</option><option value="list">List</option>
                    </select>
                  </div>
                  {cf.type === 'text' ? (
                    <textarea className="input w-full text-sm" rows={2} placeholder="Value..." value={cf.value}
                      onChange={(e) => { const u = [...customFields]; u[idx] = { ...cf, value: e.target.value }; setCustomFields(u); }} />
                  ) : (
                    <input type="text" className="input w-full text-sm" placeholder="Comma-separated values" value={cf.value}
                      onChange={(e) => { const u = [...customFields]; u[idx] = { ...cf, value: e.target.value }; setCustomFields(u); }} />
                  )}
                </div>
                <button onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))} className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 mt-1">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input type="text" className="input flex-1 text-sm" placeholder="New field name..." value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newFieldKey.trim()) { e.preventDefault(); setCustomFields([...customFields, { key: newFieldKey.trim().replace(/\s+/g, '_').toLowerCase(), value: '', type: newFieldType }]); setNewFieldKey(''); } }}
              />
              <select className="input text-xs w-24" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as 'text' | 'list')}>
                <option value="text">Text</option><option value="list">List</option>
              </select>
              <button onClick={() => { if (newFieldKey.trim()) { setCustomFields([...customFields, { key: newFieldKey.trim().replace(/\s+/g, '_').toLowerCase(), value: '', type: newFieldType }]); setNewFieldKey(''); } }}
                className="btn-secondary px-3 flex items-center gap-1.5 text-sm"><PlusIcon className="w-4 h-4" /> Add</button>
            </div>
          </div>

          {/* Website URL */}
          <div className="card p-5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Website URL</label>
            <input type="url" className="input w-full mt-1" value={dnaInputs.website_url || ''} onChange={(e) => setField('website_url', e.target.value)} />
          </div>

          {/* Save Buttons */}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setEditMode(false)} className="btn-secondary px-6" disabled={saving}>Cancel</button>
            <button onClick={() => handleSave(false)} className="btn-primary px-6 flex items-center gap-2" disabled={saving}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <CheckCircleIcon className="w-4 h-4" />}
              Save DNA
            </button>
            <button onClick={() => handleSave(true)} className="btn-primary px-6 flex items-center gap-2 bg-gradient-to-r from-primary to-secondary" disabled={saving}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <SparklesIcon className="w-4 h-4" />}
              Save & Enhance with AI
            </button>
          </div>
        </motion.div>
      )}

      {/* === VIEW MODE === */}
      {dnaData && !loading && !editMode && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Edit Bar */}
          <div className="flex items-center justify-between bg-dark-700/50 border border-white/10 rounded-lg px-4 py-3">
            <p className="text-sm text-white">Click the edit icon or button to modify your Brand DNA</p>
            <button onClick={enterEditMode} className="btn-primary flex items-center gap-2 px-5 py-2">
              <PencilIcon className="w-4 h-4" /> Edit Brand DNA
            </button>
          </div>

          {/* Brand Identity Card */}
          <div className="card p-6 transition-all">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">Brand Identity <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-4 h-4" /></button></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dnaData.brand_name && (<div><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Brand Name</label><p className="text-sm mt-1">{dnaData.brand_name}</p></div>)}
              {dnaData.tagline && (<div><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Tagline</label><p className="text-sm mt-1 italic">"{dnaData.tagline}"</p></div>)}
              {dnaData.industry && (<div><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Industry</label><p className="text-sm mt-1">{dnaData.industry}</p></div>)}
              {dnaData.brand_voice && (<div><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Brand Voice</label><p className="text-sm mt-1">{dnaData.brand_voice}</p></div>)}
            </div>
            {dnaData.description && (<div className="mt-4 pt-4 border-t border-white/10"><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Description</label><p className="text-sm mt-1">{dnaData.description}</p></div>)}
            {dnaData.target_audience && (<div className="mt-4 pt-4 border-t border-white/10"><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Target Audience</label><p className="text-sm mt-1">{dnaData.target_audience}</p></div>)}
            {dnaData.competitor_positioning && (<div className="mt-4 pt-4 border-t border-white/10"><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Competitor Positioning</label><p className="text-sm mt-1">{dnaData.competitor_positioning}</p></div>)}
            {dnaData.cta_style && (<div className="mt-4 pt-4 border-t border-white/10"><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">CTA Style</label><p className="text-sm mt-1">{dnaData.cta_style}</p></div>)}
          </div>

          {/* Products & Services */}
          {Array.isArray(dnaData.products_services) && dnaData.products_services.length > 0 && (
            <div className="card p-6 transition-all">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">Products & Services <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h3>
              <div className="flex flex-wrap gap-2">{dnaData.products_services.map((item: string, idx: number) => (<span key={idx} className="bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full text-sm">{item}</span>))}</div>
            </div>
          )}

          {/* USP + Values + Content Themes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.isArray(dnaData.unique_selling_points) && dnaData.unique_selling_points.length > 0 && (
              <div className="card p-5 transition-all">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">USPs <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h4>
                <ul className="space-y-2">{dnaData.unique_selling_points.map((item: string, idx: number) => (<li key={idx} className="text-sm flex items-start gap-2"><span className="text-green-400 mt-0.5">&#10003;</span> {item}</li>))}</ul>
              </div>
            )}
            {Array.isArray(dnaData.brand_values) && dnaData.brand_values.length > 0 && (
              <div className="card p-5 transition-all">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">Brand Values <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h4>
                <ul className="space-y-2">{dnaData.brand_values.map((item: string, idx: number) => (<li key={idx} className="text-sm flex items-start gap-2"><span className="text-primary-400 mt-0.5">&#9679;</span> {item}</li>))}</ul>
              </div>
            )}
            {Array.isArray(dnaData.content_themes) && dnaData.content_themes.length > 0 && (
              <div className="card p-5 transition-all">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">Content Themes <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h4>
                <ul className="space-y-2">{dnaData.content_themes.map((item: string, idx: number) => (<li key={idx} className="text-sm flex items-start gap-2"><span className="text-yellow-400 mt-0.5">&#9733;</span> {item}</li>))}</ul>
              </div>
            )}
          </div>

          {/* Keywords + Colors + Social */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.isArray(dnaData.keywords) && dnaData.keywords.length > 0 && (<div className="card p-5 transition-all"><h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">Keywords <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h4><div className="flex flex-wrap gap-1.5">{dnaData.keywords.map((kw: string, idx: number) => (<span key={idx} className="bg-dark-600 text-text-secondary px-2 py-0.5 rounded text-xs">{kw}</span>))}</div></div>)}
            {Array.isArray(dnaData.color_theme) && dnaData.color_theme.length > 0 && (<div className="card p-5 transition-all"><h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">Color Theme <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h4><div className="flex flex-wrap gap-2">{dnaData.color_theme.map((c: string, idx: number) => (<span key={idx} className="flex items-center gap-1.5 text-sm"><span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c.toLowerCase() }} />{c}</span>))}</div></div>)}
            {Array.isArray(dnaData.social_platforms) && dnaData.social_platforms.length > 0 && (<div className="card p-5 transition-all"><h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary flex items-center justify-between">Social Platforms <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h4><div className="flex flex-wrap gap-2">{dnaData.social_platforms.map((p: string, idx: number) => (<span key={idx} className="badge badge-primary text-xs capitalize">{p}</span>))}</div></div>)}
          </div>

          {/* Custom Fields */}
          {(() => {
            const extras = Object.entries(dnaData).filter(([k]) => !BUILTIN_KEYS.has(k) && dnaData[k] != null && dnaData[k] !== '');
            if (!extras.length) return null;
            return (
              <div className="card p-6 transition-all">
                <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide text-text-secondary flex items-center justify-between">Custom Fields <button onClick={enterEditMode} className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-primary-400 transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extras.map(([key, val]) => (<div key={key}><label className="text-xs font-medium text-text-secondary uppercase tracking-wide">{key.replace(/_/g, ' ')}</label>
                    {Array.isArray(val) ? (<div className="flex flex-wrap gap-1.5 mt-1">{val.map((v: string, i: number) => (<span key={i} className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-xs">{v}</span>))}</div>) : (<p className="text-sm mt-1">{String(val)}</p>)}
                  </div>))}
                </div>
              </div>
            );
          })()}

          {/* Brand Logo */}
          <div className="card p-6 transition-all">
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide text-text-secondary flex items-center gap-2">
              <PhotoIcon className="w-4 h-4 text-amber-400" />
              Brand Logo
            </h3>
            <div className="flex items-center gap-5">
              {(logoPreview || brandLogo) ? (
                <div className="relative w-24 h-24 rounded-xl border-2 border-primary-500/30 bg-dark-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={logoPreview || brandLogo || ''} alt="Brand Logo" className="w-full h-full object-contain p-2" />
                  {logoPreview && (
                    <button onClick={handleRemoveLogo} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600">&times;</button>
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 bg-dark-800 flex items-center justify-center flex-shrink-0">
                  <PhotoIcon className="w-10 h-10 text-text-muted" />
                </div>
              )}
              <div className="flex-1">
                {brandLogo && !logoPreview && (
                  <p className="text-xs text-green-400 mb-2 flex items-center gap-1">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Uploaded — available in AI Image Generation
                  </p>
                )}
                {!brandLogo && !logoPreview && (
                  <p className="text-xs text-text-muted mb-2">Upload your brand logo (PNG) to use in AI Image Generation</p>
                )}
                <div className="flex items-center gap-2">
                  {!logoPreview && (
                    <label className="btn-secondary px-4 py-2 text-sm cursor-pointer inline-flex items-center gap-2">
                      <CloudArrowUpIcon className="w-4 h-4" />
                      {brandLogo ? 'Replace Logo' : 'Upload PNG'}
                      <input type="file" accept="image/png" className="hidden" onChange={handleLogoFileSelect} />
                    </label>
                  )}
                  {logoPreview && (
                    <button onClick={handleLogoUpload} disabled={logoUploading} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                      {logoUploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <CloudArrowUpIcon className="w-4 h-4" />}
                      {logoUploading ? 'Uploading...' : 'Upload Logo'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {dnaData.website_url && (
            <div className="text-center">
              <a href={dnaData.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-400 hover:underline">{dnaData.website_url}</a>
            </div>
          )}
        </motion.div>
      )}

      {!dnaData && !loading && (
        <div className="card p-12 text-center">
          <BeakerIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
          <p className="text-white">Enter your website URL above and click "Generate DNA"</p>
          <p className="text-xs text-white mt-1">AI will analyze your website and extract your brand's identity</p>
        </div>
      )}
    </div>
  );
}

// --- Sub-step 1.2: Pillars ---
function PillarsSubStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', target_percentage: 25, color_code: '#6366F1' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', target_percentage: 25, color_code: '#6366F1' });

  // AI generate state
  const [generating, setGenerating] = useState(false);
  const [focusAreas, setFocusAreas] = useState('');
  const [genCount, setGenCount] = useState(5);
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [pillarsUsedPrompt, setPillarsUsedPrompt] = useState('');
  const [pillarsRegenerating, setPillarsRegenerating] = useState(false);
  const pillarsHistory = usePromptHistory(brandId, 'pillars');

  const handlePillarsRegenerate = async (editedPrompt: string) => {
    if (!brandId) return;
    setPillarsRegenerating(true);
    try {
      const areas = focusAreas.split(',').map((a) => a.trim()).filter(Boolean);
      const genResult = await strategyService.generatePillars(brandId, genCount, areas, editedPrompt);
      if (genResult.used_prompt) setPillarsUsedPrompt(genResult.used_prompt);
      await load();
    } catch { /* ignore */ }
    setPillarsRegenerating(false);
  };

  const load = useCallback(async () => {
    if (!brandId) { setLoading(false); return; }
    try {
      const data = await strategyService.getPillars(brandId);
      setPillars(data);
      if (data.length > 0) overflow.markPillarsComplete();
    } catch { setPillars([]); }
    setLoading(false);
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await strategyService.createPillar({ ...(brandId ? { brand: brandId } : {}), ...form });
      setShowForm(false);
      setForm({ name: '', description: '', target_percentage: 25, color_code: '#6366F1' });
      load();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    try { await strategyService.deletePillar(id); load(); } catch { /* ignore */ }
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.name.trim()) return;
    try {
      await strategyService.updatePillar(editingId, editForm);
      setEditingId(null);
      load();
    } catch { /* ignore */ }
  };

  const handleAIGenerate = async () => {
    if (!brandId) return;
    setGenerating(true);
    try {
      const areas = focusAreas.split(',').map((a) => a.trim()).filter(Boolean);
      const genResult = await strategyService.generatePillars(brandId, genCount, areas);
      if (genResult.used_prompt) setPillarsUsedPrompt(genResult.used_prompt);
      setShowGenPanel(false);
      setFocusAreas('');
      await load();
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const totalPct = pillars.reduce((s, p) => s + p.target_percentage, 0);

  const handleRebalance = async () => {
    if (pillars.length === 0) return;
    const each = Math.floor(100 / pillars.length);
    const remainder = 100 - each * pillars.length;
    try {
      await Promise.all(pillars.map((p, idx) =>
        strategyService.updatePillar(p.id, { target_percentage: each + (idx === 0 ? remainder : 0) })
      ));
      await load();
    } catch { /* ignore */ }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-500" />
          Content Pillars
          <PromptInfoButton prompt={pillarsUsedPrompt} label="Content Pillars Generation Prompt" onRegenerate={handlePillarsRegenerate} regenerating={pillarsRegenerating} regenerateLabel="Regenerate Pillars" promptHistory={pillarsHistory.history} onLoadHistory={pillarsHistory.load} historyLoading={pillarsHistory.loading} />
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenPanel(!showGenPanel)} className="btn-primary text-sm flex items-center gap-1.5">
            {generating ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <SparklesIcon className="w-4 h-4" />}
            AI Generate
          </button>
          <button onClick={() => setShowForm(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <PlusIcon className="w-4 h-4" /> Add Manual
          </button>
        </div>
      </div>
      <p className="text-sm text-white">
        AI-generate pillars from your brand DNA, competitors & trends — or add them manually. You can edit each pillar after generation.
      </p>

      {/* Percentage indicator */}
      {pillars.length > 0 && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
          totalPct === 100 ? 'bg-green-500/10 border border-green-500/20' :
          totalPct > 100 ? 'bg-red-500/10 border border-red-500/20' :
          'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${totalPct === 100 ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-yellow-400'}`}>
              Total: {totalPct}%
            </span>
            <span className="text-xs text-text-muted">
              {totalPct === 100 ? 'Balanced' : totalPct > 100 ? `${totalPct - 100}% over` : `${100 - totalPct}% remaining`}
            </span>
          </div>
          {totalPct !== 100 && (
            <button onClick={handleRebalance} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 underline">
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Rebalance to 100%
            </button>
          )}
        </div>
      )}

      {/* AI Generate Panel */}
      {showGenPanel && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-purple-400">AI Pillar Generation</h4>
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-secondary whitespace-nowrap">Count: {genCount}</label>
            <input type="range" min="3" max="8" value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className="flex-1" />
          </div>
          <input type="text" className="input w-full text-sm" placeholder="Focus areas (optional, comma-separated, e.g. product showcase, education)" value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setShowGenPanel(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={handleAIGenerate} disabled={generating} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
              {generating ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <SparklesIcon className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate Pillars'}
            </button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" /></div>
      ) : pillars.length === 0 ? (
        <p className="text-sm text-white text-center py-6">No pillars yet. Use AI Generate or add manually.</p>
      ) : (
        <div className="space-y-2">
          {pillars.map((p) => (
            editingId === p.id ? (
              <div key={p.id} className="bg-dark-700/30 rounded-lg p-4 space-y-3">
                <input type="text" className="input w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <input type="text" className="input w-full" placeholder="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-secondary">Target: {editForm.target_percentage}%</label>
                  <input type="range" min="5" max="80" className="flex-1" value={editForm.target_percentage} onChange={(e) => setEditForm({ ...editForm, target_percentage: Number(e.target.value) })} />
                  <input type="color" className="w-8 h-8 rounded cursor-pointer" value={editForm.color_code} onChange={(e) => setEditForm({ ...editForm, color_code: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
                  <button onClick={handleUpdate} className="btn-primary flex-1 text-sm">Save</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="bg-dark-700/30 rounded-lg p-3 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color_code }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-white/70">{p.description || 'No description'} &middot; {p.target_percentage}%</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingId(p.id); setEditForm({ name: p.name, description: p.description || '', target_percentage: p.target_percentage, color_code: p.color_code }); }}
                    className="p-1.5 text-text-muted hover:text-primary-400 transition-colors">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-text-muted hover:text-red-400 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-dark-700/30 rounded-lg p-4 space-y-3">
          <input type="text" className="input w-full" placeholder="Pillar name (e.g. Educational)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="text" className="input w-full" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Target: {form.target_percentage}%</label>
            <input type="range" min="5" max="80" className="flex-1" value={form.target_percentage} onChange={(e) => setForm({ ...form, target_percentage: Number(e.target.value) })} />
            <input type="color" className="w-8 h-8 rounded cursor-pointer" value={form.color_code} onChange={(e) => setForm({ ...form, color_code: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={handleCreate} className="btn-primary flex-1 text-sm">Create</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-step 1.3: Competitors ---
interface CompetitorInsight {
  id: number; competitor: string; platform: string;
  hook_text: string; angle: string; format_type: string;
  engagement_score: number; recommendation?: string;
  based_on?: string; source_url?: string;
}

function CompetitorsSubStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [insights, setInsights] = useState<CompetitorInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform: 'twitter', handle_or_url: '' });
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [competitorUsedPrompts, setCompetitorUsedPrompts] = useState<Record<string, string>>({});
  const [competitorRegenerating, setCompetitorRegenerating] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ name: string; platform: string; handle_or_url: string; reason: string }>>([]);
  const [findingByAi, setFindingByAi] = useState(false);
  const competitorHistory = usePromptHistory(brandId, 'competitors');

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400 bg-green-400/10';
    if (score >= 5) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const load = useCallback(async () => {
    if (!brandId) { setLoading(false); return; }
    try {
      const data = await strategyService.getCompetitors(brandId);
      setCompetitors(data);
      if (data.length > 0) overflow.markCompetitorsComplete();
      // Load insights
      try {
        const insightsData = await strategyService.getInsights(brandId);
        setInsights(Array.isArray(insightsData) ? insightsData : []);
      } catch { setInsights([]); }
    } catch { setCompetitors([]); }
    setLoading(false);
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const handleFindByAi = async () => {
    if (!brandId) return;
    setFindingByAi(true);
    setAnalysisError(null);
    try {
      const result = await strategyService.suggestCompetitors(brandId, 5);
      setAiSuggestions(result.suggestions || []);
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.error || 'AI competitor search failed');
    }
    setFindingByAi(false);
  };

  const handleAdd = async () => {
    if (!form.handle_or_url.trim()) return;
    try {
      await strategyService.addCompetitor({ ...(brandId ? { brand: brandId } : {}), ...form });
      setShowForm(false);
      setForm({ platform: 'twitter', handle_or_url: '' });
      load();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    try { await strategyService.deleteCompetitor(id); load(); } catch { /* ignore */ }
  };

  const handleAnalyze = async (competitorId?: number) => {
    if (!brandId) return;
    setAnalysisError(null);
    if (competitorId) { setAnalyzingId(competitorId); } else { setAnalyzingAll(true); }
    try {
      const result = await strategyService.triggerCrawl(brandId, competitorId);
      if (result.insights) {
        setInsights((prev) => {
          const analyzed = new Set(result.insights.map((i: CompetitorInsight) => i.competitor));
          const kept = prev.filter((i) => !analyzed.has(i.competitor));
          return [...result.insights, ...kept];
        });
      }
      if (result.used_prompts) {
        const promptMap: Record<string, string> = {};
        result.used_prompts.forEach((p: { competitor: string; prompt: string }) => { promptMap[p.competitor] = p.prompt; });
        setCompetitorUsedPrompts((prev) => ({ ...prev, ...promptMap }));
      }
      overflow.markCompetitorsComplete();
      load();
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.error || 'Analysis failed. Check your API key.');
    }
    setAnalyzingId(null);
    setAnalyzingAll(false);
  };

  const handleCompetitorRegenerate = async (compHandle: string, compId: number, editedPrompt: string) => {
    if (!brandId) return;
    setCompetitorRegenerating((prev) => ({ ...prev, [compHandle]: true }));
    try {
      const result = await strategyService.triggerCrawl(brandId, compId, editedPrompt);
      if (result.insights) {
        setInsights((prev) => {
          const analyzed = new Set(result.insights.map((i: CompetitorInsight) => i.competitor));
          const kept = prev.filter((i) => !analyzed.has(i.competitor));
          return [...result.insights, ...kept];
        });
      }
      if (result.used_prompts) {
        const promptMap: Record<string, string> = {};
        result.used_prompts.forEach((p: { competitor: string; prompt: string }) => { promptMap[p.competitor] = p.prompt; });
        setCompetitorUsedPrompts((prev) => ({ ...prev, ...promptMap }));
      }
    } catch { /* ignore */ }
    setCompetitorRegenerating((prev) => ({ ...prev, [compHandle]: false }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-primary-400" />
            Competitors
          </h3>
          <div className="flex gap-2">
            {competitors.length > 0 && (
              <button onClick={() => handleAnalyze()} disabled={analyzingAll} className="btn-primary text-sm flex items-center gap-1.5">
                {analyzingAll ? <div className="animate-spin h-3.5 w-3.5 border-b-2 border-white rounded-full" /> : <SparklesIcon className="w-4 h-4" />}
                {analyzingAll ? 'Analyzing...' : 'Analyze All'}
              </button>
            )}
            <button onClick={handleFindByAi} disabled={findingByAi} className="btn-secondary text-sm flex items-center gap-1.5">
              {findingByAi ? <div className="animate-spin h-3.5 w-3.5 border-b-2 border-primary-400 rounded-full" /> : <SparklesIcon className="w-4 h-4" />}
              {findingByAi ? 'Finding...' : 'Find by AI'}
            </button>
            <button onClick={() => setShowForm(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4" /> Add Competitor
            </button>
          </div>
        </div>
        <p className="text-sm text-white">Add competitor profiles and get AI-powered strategic insights.</p>
      </div>

      {analysisError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{analysisError}</div>
      )}

      {/* AI-Suggested Competitors */}
      {aiSuggestions.length > 0 && (
        <div className="card p-4 border-primary-500/20">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-primary-400" />
            AI-Suggested Competitors
          </h4>
          <div className="grid gap-2">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-dark-800/50 rounded-lg p-3">
                <div className="min-w-0 flex-1 mr-3">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-text-muted ml-2">({s.platform})</span>
                  <p className="text-xs text-text-secondary mt-0.5 truncate">{s.reason}</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await strategyService.addCompetitor({ brand: brandId!, platform: s.platform, handle_or_url: s.handle_or_url });
                      setAiSuggestions(prev => prev.filter((_, j) => j !== i));
                      load();
                    } catch { /* ignore */ }
                  }}
                  className="btn-primary text-xs px-3 py-1 shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" /></div>
      ) : competitors.length === 0 ? (
        <div className="card p-12 text-center">
          <GlobeAltIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
          <p className="text-white">No competitors added yet</p>
          <p className="text-xs text-white mt-1">Add competitor profiles to get AI-powered strategic insights</p>
        </div>
      ) : (
        /* Full competitor cards with insights — like Strategy Hub */
        <div className="space-y-4">
          {competitors.map((comp) => {
            const compInsights = insights.filter((i) => i.competitor === comp.handle_or_url);
            const isAnalyzing = analyzingId === comp.id;
            return (
              <div key={comp.id} className="card overflow-hidden">
                {/* Competitor Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                      <GlobeAltIcon className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-primary text-xs capitalize">{comp.platform}</span>
                        <span className="font-medium text-sm">{comp.handle_or_url}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {compInsights.length} insights
                        {comp.last_crawled_at && ` · Last analyzed: ${new Date(comp.last_crawled_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAnalyze(comp.id)} disabled={isAnalyzing} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                      {isAnalyzing ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-400" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                      {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                    </button>
                    <button onClick={() => handleDelete(comp.id)} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Insights */}
                {compInsights.length > 0 && (
                  <div className="p-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <LightBulbIcon className="w-4 h-4 text-yellow-400" />
                      Strategic Insights
                      <PromptInfoButton prompt={competitorUsedPrompts[comp.handle_or_url] || ''} label={`Competitor Analysis Prompt — ${comp.handle_or_url}`} onRegenerate={(ep) => handleCompetitorRegenerate(comp.handle_or_url, comp.id, ep)} regenerating={competitorRegenerating[comp.handle_or_url] || false} regenerateLabel="Re-analyze" promptHistory={competitorHistory.history} onLoadHistory={competitorHistory.load} historyLoading={competitorHistory.loading} />
                    </h4>
                    <div className="space-y-3">
                      {compInsights.map((insight) => (
                        <div key={insight.id} className="bg-dark-700/30 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{insight.hook_text}</p>
                              {insight.angle && <p className="text-xs text-white mt-1">Angle: {insight.angle}</p>}
                              {insight.based_on && <p className="text-xs text-white mt-1 italic">Based on: {insight.based_on}</p>}
                              {insight.recommendation && <p className="text-xs text-primary-400 mt-1">Action: {insight.recommendation}</p>}
                              {(insight.source_url || insight.competitor) && (
                                <a href={insight.source_url || insight.competitor} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary-400/70 hover:text-primary-400 mt-2 transition-colors">
                                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                  {insight.source_url || insight.competitor}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="badge text-xs">{insight.format_type}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(insight.engagement_score)}`}>
                                {insight.engagement_score}/10
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {compInsights.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-white">No insights yet. Click "Analyze" to get AI-powered insights.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Competitor Form */}
      {showForm && (
        <div className="card p-6 space-y-3">
          <h4 className="text-sm font-semibold">Add Competitor</h4>
          <select className="input w-full" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option value="twitter">Twitter/X</option>
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="website">Website</option>
          </select>
          <input type="text" className="input w-full" placeholder={form.platform === 'website' ? 'https://example.com' : '@handle or profile URL'} value={form.handle_or_url} onChange={(e) => setForm({ ...form, handle_or_url: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={handleAdd} className="btn-primary flex-1 text-sm">Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-step 1.4: Trending ---
function TrendingSubStep({ brandId }: { brandId: number | null }) {
  const toggleTrendingTopic = useOverflowStore((s) => s.toggleTrendingTopic);
  const setSelectedTrendingTopics = useOverflowStore((s) => s.setSelectedTrendingTopics);
  const selectedTrendingTopics = useOverflowStore((s) => s.selectedTrendingTopics);
  const markTrendingComplete = useOverflowStore((s) => s.markTrendingComplete);
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Feedback state (topic_text -> true=liked, false=disliked, null=no feedback)
  const [feedback, setFeedback] = useState<Record<string, boolean | null>>({});

  // Custom topic input
  const [customTopic, setCustomTopic] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const trendingUsedPrompt = useOverflowStore((s) => s.trendingUsedPrompt);
  const [trendingRegenerating, setTrendingRegenerating] = useState(false);
  const trendingHistory = usePromptHistory(brandId, 'trending');

  const handleTrendingRegenerate = async (editedPrompt: string) => {
    if (!brandId) return;
    setTrendingRegenerating(true);
    try {
      const result = await strategyService.generateTrending(brandId, editedPrompt);
      const arr = result?.topics || [];
      setTopics(arr);
      if (result?.used_prompt) useOverflowStore.getState().setTrendingUsedPrompt(result.used_prompt);
    } catch { /* ignore */ }
    setTrendingRegenerating(false);
  };

  // Load cached trending data + existing feedback on mount
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    strategyService.getBrandTrending(brandId).then((data) => {
      if (cancelled) return;
      const arr = Array.isArray(data) ? data : data.topics || [];
      setTopics(arr);
      if (arr.length > 0) {
        markTrendingComplete();
      } else if (!autoTriggered) {
        setAutoTriggered(true);
        doGenerate(brandId);
      }
    }).catch(() => {
      if (!cancelled && !autoTriggered) {
        setAutoTriggered(true);
        doGenerate(brandId);
      }
    });
    // Load existing feedback
    strategyService.getTrendFeedback(brandId).then((data) => {
      if (cancelled) return;
      const fbMap: Record<string, boolean | null> = {};
      (data.feedback || data || []).forEach((f: { topic_text: string; is_accepted: boolean }) => {
        fbMap[f.topic_text] = f.is_accepted;
      });
      setFeedback(fbMap);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [brandId]);

  // Timer while loading
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const doGenerate = async (id: number) => {
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const result = await strategyService.generateTrending(id);
      const arr = result?.topics || [];
      setTopics(arr);
      if (result?.used_prompt) useOverflowStore.getState().setTrendingUsedPrompt(result.used_prompt);
      if (arr.length > 0) markTrendingComplete();
      else setError('No trending topics found. Try again.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Failed to generate trending topics.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!brandId) { setError('No brand selected. Please complete the Brand DNA step first.'); return; }
    doGenerate(brandId);
  };

  const handleFeedback = async (topicText: string, isAccepted: boolean, topicId?: number) => {
    if (!brandId) return;
    // Toggle: if already same feedback, remove it
    const current = feedback[topicText];
    const newVal = current === isAccepted ? null : isAccepted;
    setFeedback((prev) => ({ ...prev, [topicText]: newVal }));
    try {
      if (newVal !== null) {
        await strategyService.submitTrendFeedback(brandId, topicText, newVal, topicId);
      } else {
        // Re-submit opposite to "undo" (API uses update_or_create)
        await strategyService.submitTrendFeedback(brandId, topicText, !isAccepted, topicId);
        setFeedback((prev) => ({ ...prev, [topicText]: null }));
      }
    } catch { /* ignore */ }
  };

  const handleAddCustomTopic = async () => {
    if (!brandId || !customTopic.trim()) return;
    setAddingCustom(true);
    try {
      await strategyService.addManualTrend(brandId, customTopic.trim());
      // Reload topics
      const data = await strategyService.getBrandTrending(brandId);
      const arr = Array.isArray(data) ? data : data.topics || [];
      setTopics(arr);
      setCustomTopic('');
      markTrendingComplete();
    } catch { /* ignore */ }
    setAddingCustom(false);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FireIcon className="w-5 h-5 text-orange-400" />
          Trending Topics
          <PromptInfoButton prompt={trendingUsedPrompt} label="Trending Topics Generation Prompt" onRegenerate={handleTrendingRegenerate} regenerating={trendingRegenerating} regenerateLabel="Regenerate Topics" promptHistory={trendingHistory.history} onLoadHistory={trendingHistory.load} historyLoading={trendingHistory.loading} />
        </h3>
        <button onClick={handleGenerate} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
          {loading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowPathIcon className="w-4 h-4" />}
          {loading ? 'Analyzing...' : topics.length > 0 ? 'Refresh' : 'Generate'}
        </button>
      </div>
      <p className="text-sm text-white">
        Discover trending topics relevant to your brand. Like/dislike topics to teach AI your preferences — disliked topics won't appear in future generations. Add your own custom topics too.
      </p>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-10">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-primary-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
            <FireIcon className="absolute inset-0 m-auto w-6 h-6 text-orange-400 animate-pulse" />
          </div>
          <p className="text-sm text-text-secondary mt-4 font-medium">
            {elapsed < 5 ? 'Querying Google Trends...' : elapsed < 15 ? 'Analyzing trend relevance with AI...' : elapsed < 30 ? 'Almost done — ranking topics for your brand...' : 'Taking a bit longer than usual... hang tight!'}
          </p>
          <p className="text-xs text-text-muted mt-1">{elapsed}s elapsed</p>
        </div>
      )}

      {!loading && topics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted">{topics.length} trending topics found</p>
              <p className="text-xs text-primary-400/70 mt-0.5">Select topics for ideas &middot; Like/dislike to train AI</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { selectedTrendingTopics.length === topics.length ? setSelectedTrendingTopics([]) : setSelectedTrendingTopics(topics.map((t) => t.topic)); }}
                className="text-xs text-primary-400 hover:text-primary-300 underline">
                {selectedTrendingTopics.length === topics.length ? 'Deselect All' : 'Select All'}
              </button>
              <p className="text-xs text-primary-400 font-medium">{selectedTrendingTopics.length} selected</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {topics.map((t, idx) => {
              const isSelected = selectedTrendingTopics.includes(t.topic);
              const fb = feedback[t.topic];
              const isDisliked = fb === false;
              return (
                <div
                  key={t.id || idx}
                  className={`rounded-lg p-4 transition-all ${
                    isDisliked ? 'opacity-50 bg-red-500/5 border border-red-500/20' :
                    fb === true ? 'bg-green-500/5 border border-green-500/20' :
                    isSelected ? 'bg-primary-500/10 border border-primary-500/40 ring-1 ring-primary-500/20' :
                    t.category === 'seasonal' || t.category === 'cultural' ? 'bg-gradient-to-br from-orange-500/10 to-dark-700/30 border border-orange-500/10 hover:border-primary-500/30' :
                    'bg-dark-700/30 border border-transparent hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer transition-colors ${
                      isSelected ? 'border-primary-500 bg-primary-500' : 'border-white/20'
                    }`} onClick={() => toggleTrendingTopic(t.topic)}>
                      {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleTrendingTopic(t.topic)}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm font-medium ${isDisliked ? 'line-through text-text-muted' : ''}`}>{t.topic}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.category && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${
                              t.category === 'seasonal' ? 'bg-purple-500/20 text-purple-400' :
                              t.category === 'cultural' ? 'bg-pink-500/20 text-pink-400' :
                              t.category === 'viral' ? 'bg-cyan-500/20 text-cyan-400' :
                              t.category === 'evergreen' ? 'bg-green-500/20 text-green-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>{t.category}</span>
                          )}
                          {t.volume_score != null && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              t.volume_score >= 80 ? 'bg-red-500/20 text-red-400' : t.volume_score >= 50 ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>{t.volume_score >= 80 ? 'Hot' : t.volume_score >= 50 ? 'Rising' : 'Emerging'}</span>
                          )}
                        </div>
                      </div>
                      {t.relevance_explanation && <p className="text-xs text-white mt-1.5 leading-relaxed">{t.relevance_explanation}</p>}
                      {t.volume_score != null && (
                        <div className="mt-2"><div className="h-1 bg-dark-600 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${t.volume_score >= 80 ? 'bg-red-500' : t.volume_score >= 50 ? 'bg-orange-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(t.volume_score, 100)}%` }} /></div></div>
                      )}
                    </div>
                    {/* Feedback buttons */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleFeedback(t.topic, true, t.id); }}
                        className={`p-1.5 rounded transition-colors ${fb === true ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-green-400 hover:bg-green-500/10'}`}
                        title="Like — more like this">
                        <HandThumbUpIcon className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleFeedback(t.topic, false, t.id); }}
                        className={`p-1.5 rounded transition-colors ${fb === false ? 'bg-red-500/20 text-red-400' : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'}`}
                        title="Dislike — won't show again">
                        <HandThumbDownIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Custom Topic */}
      {!loading && (
        <div className="bg-dark-700/30 border border-white/10 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <PlusIcon className="w-4 h-4 text-primary-400" />
            Add Your Own Topic
          </h4>
          <div className="flex gap-2">
            <input type="text" className="input flex-1 text-sm" placeholder="Enter a topic you want to create content about..." value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTopic(); } }}
            />
            <button onClick={handleAddCustomTopic} disabled={addingCustom || !customTopic.trim()} className="btn-primary text-sm flex items-center gap-1.5 px-4">
              {addingCustom ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <PlusIcon className="w-4 h-4" />}
              Add
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">Custom topics will appear alongside AI-generated trends</p>
        </div>
      )}

      {!loading && topics.length === 0 && !error && (
        <div className="text-center py-8">
          <FireIcon className="w-10 h-10 text-text-muted/30 mx-auto" />
          <p className="text-sm text-text-muted mt-3">No trending topics yet.</p>
          <p className="text-xs text-text-muted mt-1">Click "Generate" to discover what's trending for your brand.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 2 — Ideas
// ═══════════════════════════════════════════════════════════
function IdeasStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  // Restore from store if already generated (survives back/forward navigation)
  const [ideas, setIdeas] = useState<ContentIdea[]>(() =>
    overflow.ideasData.length > 0
      ? overflow.ideasData.map((d) => ({ ...d, brand: 0, goal: '', language: '', persona: '', status: 'new' as const, batch_id: '', generation_run: 0, created_at: '', updated_at: '' }))
      : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ideasUsedPrompt = overflow.ideasUsedPrompt;
  const [ideasRegenerating, setIdeasRegenerating] = useState(false);
  const ideasHistory = usePromptHistory(brandId, 'ideas');

  const handleIdeasRegenerate = async (editedPrompt: string) => {
    if (!brandId) return;
    setIdeasRegenerating(true);
    try {
      const topics = overflow.selectedTrendingTopics;
      const count = topics.length > 0 ? topics.length : 3;
      const result = await strategyService.generateIdeas({
        brand_id: brandId,
        count,
        trending_topics: topics.length > 0 ? topics : undefined,
        override_prompt: editedPrompt,
      });
      const newIdeas = result.ideas || result || [];
      setIdeas(newIdeas);
      if (result.used_prompt) {
        useOverflowStore.getState().setIdeasUsedPrompt(result.used_prompt);
      }
      const mapped = newIdeas.map((i: ContentIdea) => ({
        id: i.id, title: i.title, hook: i.hook, angle: i.angle, platform: i.platform,
        content_format: i.content_format, engagement_tier: i.engagement_tier, pillar_name: i.pillar_name,
      }));
      useOverflowStore.getState().setIdeasData(mapped);
    } catch { /* ignore */ }
    setIdeasRegenerating(false);
  };

  const doGenerate = useCallback(async () => {
    if (!brandId) {
      setError('No brand selected. Go back and complete Brand DNA first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const topics = overflow.selectedTrendingTopics;
      const count = topics.length > 0 ? topics.length : 3;
      const result = await strategyService.generateIdeas({
        brand_id: brandId,
        count,
        trending_topics: topics.length > 0 ? topics : undefined,
      });
      const newIdeas = result.ideas || result || [];
      setIdeas(newIdeas);
      if (result.used_prompt) {
        useOverflowStore.getState().setIdeasUsedPrompt(result.used_prompt);
      }
      // Store idea data for CaptionsStep + auto-select all
      const mapped = newIdeas.map((i: ContentIdea) => ({
        id: i.id, title: i.title, hook: i.hook, angle: i.angle || '',
        platform: i.platform, content_format: i.content_format,
      }));
      useOverflowStore.getState().setIdeasData(mapped);
      useOverflowStore.getState().setIdeaSelection(newIdeas.map((i: ContentIdea) => i.id));
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to generate ideas.');
    }
    setLoading(false);
  }, [brandId, overflow.selectedTrendingTopics]);

  // Auto-generate on mount ONLY if no ideas exist yet
  useEffect(() => {
    if (brandId && ideas.length === 0 && overflow.ideasData.length === 0) {
      doGenerate();
    }
  }, [brandId]);

  const topics = overflow.selectedTrendingTopics;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LightBulbIcon className="w-5 h-5 text-yellow-400" />
            Content Ideas
            <PromptInfoButton prompt={ideasUsedPrompt} label="Content Ideas Generation Prompt" onRegenerate={handleIdeasRegenerate} regenerating={ideasRegenerating} regenerateLabel="Regenerate Ideas" promptHistory={ideasHistory.history} onLoadHistory={ideasHistory.load} historyLoading={ideasHistory.loading} />
          </h3>
          <button onClick={doGenerate} disabled={loading} className="btn-secondary text-sm flex items-center gap-2">
            {loading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowPathIcon className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
        <p className="text-sm text-white">
          1 idea per trending topic — auto-generated from your Brand DNA & market analysis.
        </p>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>

      {loading && (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
          <p className="text-sm text-text-muted mt-3">Analyzing trending topics & generating business ideas...</p>
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <div className="grid gap-4">
          {ideas.map((idea, idx) => {
            const topicName = topics[idx] || null;
            return (
              <div key={idea.id} className="card overflow-hidden">
                {/* Trending topic header */}
                {topicName && (
                  <div className="bg-orange-500/10 border-b border-orange-500/10 px-4 py-2 flex items-center gap-2">
                    <FireIcon className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-semibold text-orange-400">Trending Topic {idx + 1}:</span>
                    <span className="text-xs text-orange-300">{topicName}</span>
                  </div>
                )}
                {/* Idea summary */}
                <div className="p-4">
                  <h4 className="font-semibold text-sm">{idea.title}</h4>
                  <p className="text-xs text-white mt-1">{idea.hook}</p>
                  {idea.angle && <p className="text-xs text-white/70 mt-0.5 italic">Angle: {idea.angle}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="badge badge-primary text-[10px] capitalize">{idea.platform}</span>
                    <span className="text-[10px] text-text-muted bg-white/5 px-2 py-0.5 rounded">{idea.content_format}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 3 — Captions (auto-generate, grouped by trending topic)
// ═══════════════════════════════════════════════════════════
function CaptionsStep() {
  const overflow = useOverflowStore();
  // Restore saved captions from localStorage so back/forward doesn't re-generate
  const [captionGroups, setCaptionGroups] = useState<Record<number, CaptionVariant[]>>(() => {
    try {
      const saved = localStorage.getItem('overflow_caption_groups');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {};
  });
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  const [editingIdeaId, setEditingIdeaId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [captionUsedPrompts, setCaptionUsedPrompts] = useState<Record<string, string>>({});
  const [captionRegenerating, setCaptionRegenerating] = useState<Record<string, boolean>>({});

  const handleCaptionRegenerate = async (ideaId: string, editedPrompt: string) => {
    setCaptionRegenerating((prev) => ({ ...prev, [ideaId]: true }));
    try {
      const idea = overflow.ideasData.find((i) => i.id === Number(ideaId));
      const topic = idea ? `${idea.title}\n\nHook: ${idea.hook}\nAngle: ${idea.angle}` : 'an engaging social media post';
      const platform = idea?.platform || 'instagram';
      const variants: CaptionVariant[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await captionService.generate({
          topic, tone: 'enthusiastic', length: 'medium', platform: platform as any,
          include_hashtags: true, include_emojis: true, include_cta: true,
          override_prompt: i === 0 ? editedPrompt : undefined,
        });
        if (i === 0 && result.used_prompt) {
          const up = result.used_prompt; setCaptionUsedPrompts((prev) => ({ ...prev, [ideaId]: up }));
        }
        variants.push({ id: `${ideaId}-${i}`, ideaId: Number(ideaId), text: result.generated_caption || '', selected: i === 0 });
      }
      setCaptionGroups((prev) => ({ ...prev, [Number(ideaId)]: variants }));
    } catch { /* ignore */ }
    setCaptionRegenerating((prev) => ({ ...prev, [ideaId]: false }));
  };

  const getIdea = (ideaId: number) => overflow.ideasData.find((i) => i.id === ideaId);
  const topics = overflow.selectedTrendingTopics;

  // Generate 3 captions for a single idea
  const generateForIdea = async (ideaId: number, customInstructions?: string): Promise<CaptionVariant[]> => {
    const idea = getIdea(ideaId);
    const topic = idea
      ? `${idea.title}\n\nHook: ${idea.hook}\nAngle: ${idea.angle}`
      : 'an engaging social media post';
    const platform = idea?.platform || 'instagram';

    const variantApproaches = [
      'Lead with a QUESTION or CURIOSITY GAP hook that makes the reader stop scrolling.',
      'Lead with a BOLD STATEMENT or CONTRARIAN take that challenges conventional thinking.',
      'Lead with a MICRO-STORY or PERSONAL angle that creates emotional connection.',
    ];

    const variants: CaptionVariant[] = [];
    for (let i = 0; i < 3; i++) {
      const variantInstruction = `This is variant ${i + 1} of 3. ${variantApproaches[i]}
The caption must be immediately copy-paste-ready for ${platform}. Do NOT mention any idea number, internal ID, or the word "idea."
Output the caption ONLY — no labels, no preamble, no explanation.${customInstructions ? `\n\nAdditional instructions: ${customInstructions}` : ''}`;

      const result = await captionService.generate({
        topic,
        tone: 'enthusiastic',
        length: 'medium',
        platform: platform as any,
        include_hashtags: true,
        include_emojis: true,
        include_cta: true,
        custom_instructions: variantInstruction,
      });
      // Store used prompt from first variant
      if (i === 0 && result.used_prompt) {
        const up = result.used_prompt; setCaptionUsedPrompts((prev) => ({ ...prev, [String(ideaId)]: up }));
      }
      variants.push({
        id: `${ideaId}-${i}`,
        ideaId,
        text: result.generated_caption || '',
        selected: i === 0,
      });
    }
    return variants;
  };

  // Auto-generate captions for ALL ideas on mount
  useEffect(() => {
    if (autoTriggered || overflow.selectedIdeaIds.length === 0 || overflow.ideasData.length === 0) return;
    // Skip if captions already exist WITH actual text for all ideas
    const hasRealCaptions = (group: CaptionVariant[] | undefined) =>
      group && group.length > 0 && group.some((c) => c.text.trim().length > 0);
    const allDone = overflow.selectedIdeaIds.every((id) => hasRealCaptions(captionGroups[id]));
    if (allDone) return;

    setAutoTriggered(true);
    const ideaIds = overflow.selectedIdeaIds;
    setProgress({ done: 0, total: ideaIds.length });

    (async () => {
      for (let idx = 0; idx < ideaIds.length; idx++) {
        const ideaId = ideaIds[idx];
        if (hasRealCaptions(captionGroups[ideaId])) {
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue; // already has real captions with text
        }
        setGeneratingId(ideaId);
        try {
          const variants = await generateForIdea(ideaId);
          setCaptionGroups((prev) => ({ ...prev, [ideaId]: variants }));
        } catch (err: any) {
          setError(err?.response?.data?.error || err?.message || 'Failed to generate captions.');
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      setGeneratingId(null);
    })();
  }, [overflow.selectedIdeaIds, overflow.ideasData]);

  // Regenerate captions for one idea (with optional custom prompt)
  const handleRegenerate = async (ideaId: number, customInstructions?: string) => {
    setGeneratingId(ideaId);
    setError(null);
    try {
      const variants = await generateForIdea(ideaId, customInstructions || customPrompts[ideaId]);
      setCaptionGroups((prev) => ({ ...prev, [ideaId]: variants }));
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to regenerate captions.');
    }
    setGeneratingId(null);
  };

  // Open edit popup for an idea
  const openEdit = (ideaId: number) => {
    setEditText(customPrompts[ideaId] || '');
    setEditingIdeaId(ideaId);
  };

  // Save custom prompt and regenerate
  const saveEditAndRegenerate = () => {
    if (editingIdeaId === null) return;
    const trimmed = editText.trim();
    setCustomPrompts((prev) => ({ ...prev, [editingIdeaId]: trimmed }));
    setEditingIdeaId(null);
    handleRegenerate(editingIdeaId, trimmed);
  };

  const toggleCaption = (ideaId: number, captionId: string) => {
    setCaptionGroups((prev) => ({
      ...prev,
      [ideaId]: prev[ideaId]?.map((c) =>
        c.id === captionId ? { ...c, selected: !c.selected } : c
      ) || [],
    }));
  };

  // Persist caption groups to localStorage (survives back/forward navigation)
  useEffect(() => {
    const hasData = Object.values(captionGroups).some((g) => g.length > 0);
    if (hasData) {
      localStorage.setItem('overflow_caption_groups', JSON.stringify(captionGroups));
    }
    // Also save selected caption texts for CreatePostStep
    const allSelected: string[] = [];
    const selectedCaptionObjs: Array<{ id: string; ideaId: number; text: string }> = [];
    for (const group of Object.values(captionGroups)) {
      group.filter((c) => c.selected).forEach((c) => {
        allSelected.push(c.text);
        selectedCaptionObjs.push({ id: c.id, ideaId: c.ideaId, text: c.text });
      });
    }
    if (allSelected.length > 0) {
      localStorage.setItem('overflow_selected_caption', allSelected.join('\n\n---\n\n'));
    }
    // Push to store for MediaStep/CreatePostStep
    overflow.setSelectedCaptions(selectedCaptionObjs);
  }, [captionGroups]);

  if (overflow.selectedIdeaIds.length === 0) {
    return (
      <div className="card p-12 text-center">
        <PencilSquareIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
        <p className="text-white">No ideas found</p>
        <p className="text-xs text-text-muted mt-1">Go back to Step 2 to generate ideas first.</p>
      </div>
    );
  }

  const isAllDone = progress.total > 0 && progress.done >= progress.total;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <PencilSquareIcon className="w-5 h-5 text-purple-400" />
          AI Captions
        </h3>
        <p className="text-sm text-white">
          {isAllDone
            ? 'All captions generated! Select the ones you want to use, then click Next.'
            : 'Auto-generating 3 ready-to-post captions for each idea...'}
        </p>
        {/* Progress bar */}
        {progress.total > 0 && !isAllDone && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>Generating captions...</span>
              <span>{progress.done} / {progress.total} ideas done</span>
            </div>
            <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>

      {/* Grouped by trending topic */}
      {overflow.selectedIdeaIds.map((ideaId, idx) => {
        const idea = getIdea(ideaId);
        const topicName = topics[idx] || null;
        const captions = captionGroups[ideaId] || [];
        const isGenerating = generatingId === ideaId;

        return (
          <div key={ideaId} className="card overflow-hidden">
            {/* Trending topic header */}
            {topicName && (
              <div className="bg-orange-500/10 border-b border-orange-500/10 px-4 py-2.5 flex items-center gap-2">
                <FireIcon className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-orange-400">Trending Topic {idx + 1}:</span>
                <span className="text-sm text-orange-300">{topicName}</span>
              </div>
            )}

            {/* Idea summary */}
            <div className="px-4 pt-4 pb-2 border-b border-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <LightBulbIcon className="w-4 h-4 text-yellow-400 shrink-0" />
                    <h4 className="text-sm font-semibold">{idea?.title || 'Content Idea'}</h4>
                    <PromptInfoButton prompt={captionUsedPrompts[String(ideaId)] || ''} label="Caption Generation Prompt" onRegenerate={(ep) => handleCaptionRegenerate(String(ideaId), ep)} regenerating={captionRegenerating[String(ideaId)] || false} regenerateLabel="Regenerate Captions" />
                  </div>
                  {idea?.hook && <p className="text-xs text-white mt-1 ml-6">{idea.hook}</p>}
                  {idea?.angle && <p className="text-xs text-text-muted mt-0.5 ml-6 italic">{idea.angle}</p>}
                </div>
                {idea?.platform && (
                  <span className="badge badge-primary text-[10px] capitalize shrink-0">{idea.platform}</span>
                )}
              </div>
            </div>

            {/* Captions */}
            <div className="p-4 space-y-2">
              {isGenerating && captions.length === 0 && (
                <div className="flex items-center gap-3 py-4 justify-center">
                  <div className="animate-spin h-4 w-4 border-b-2 border-primary-400 rounded-full" />
                  <p className="text-xs text-text-muted">Generating 3 caption variants...</p>
                </div>
              )}

              {captions.map((caption, cIdx) => (
                <div
                  key={caption.id}
                  onClick={() => toggleCaption(ideaId, caption.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all text-sm ${
                    caption.selected
                      ? 'bg-primary-500/15 border-2 border-primary-500 ring-2 ring-primary-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                      : 'bg-dark-700/30 border-2 border-transparent hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      caption.selected ? 'border-primary-500 bg-primary-500' : 'border-white/25 bg-white/5'
                    }`}>
                      {caption.selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-muted font-medium">Caption {cIdx + 1}</span>
                        {caption.selected && (
                          <span className="text-[9px] font-bold text-primary-400 bg-primary-500/20 px-1.5 py-0.5 rounded">SELECTED</span>
                        )}
                      </div>
                      <p className="text-white whitespace-pre-wrap leading-relaxed mt-0.5">{caption.text}</p>
                    </div>
                  </div>
                </div>
              ))}

              {captions.length > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => handleRegenerate(ideaId)}
                    disabled={isGenerating}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                  >
                    <ArrowPathIcon className="w-3 h-3" />
                    {isGenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button
                    onClick={() => openEdit(ideaId)}
                    disabled={isGenerating}
                    className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                  >
                    <PencilSquareIcon className="w-3 h-3" />
                    Edit Prompt
                  </button>
                  {customPrompts[ideaId] && (
                    <span className="text-[10px] text-text-muted italic truncate max-w-[200px]">
                      Custom: {customPrompts[ideaId]}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Edit Prompt Popup */}
      {editingIdeaId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg mx-4 p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <PencilSquareIcon className="w-5 h-5 text-yellow-400" />
              Custom Caption Instructions
            </h3>
            <p className="text-xs text-white">
              Tell the AI how you want the captions — tone, style, specific words, CTA, etc. This will be sent as a custom prompt.
            </p>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              placeholder="e.g. Make it more casual and funny, add a discount code SAVE20, mention free shipping, use Bangla + English mix..."
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingIdeaId(null)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEditAndRegenerate}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <SparklesIcon className="w-4 h-4" />
                Regenerate with Instructions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 4 — Media (per-caption accordion)
// ═══════════════════════════════════════════════════════════
function MediaStep() {
  const overflow = useOverflowStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modes, setModes] = useState<Record<string, 'upload' | 'generate'>>({});
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [styles, setStyles] = useState<Record<string, string>>({});
  const [refiningMap, setRefiningMap] = useState<Record<string, boolean>>({});
  const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const [refinedPrompts, setRefinedPrompts] = useState<Record<string, string | null>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<Record<string, string[]>>({});
  const [refineUsedPrompts, setRefineUsedPrompts] = useState<Record<string, string>>({});
  const [imageUsedPrompts, setImageUsedPrompts] = useState<Record<string, string>>({});
  const [refineRegenerating, setRefineRegenerating] = useState<Record<string, boolean>>({});
  const [imageRegenerating, setImageRegenerating] = useState<Record<string, boolean>>({});
  const [providers, setProviders] = useState<Record<string, 'openai' | 'gemini' | 'both'>>({});
  const [bothResults, setBothResults] = useState<Record<string, { openai?: any; gemini?: any }>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copyOverlayOpen, setCopyOverlayOpen] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Brand logo state (mandatory)
  const [brandLogos, setBrandLogos] = useState<{ id: number; file: string; name: string }[]>([]);
  const [selectedBrandLogos, setSelectedBrandLogos] = useState<Record<string, number | null>>({});
  const [brandLogoPositions, setBrandLogoPositions] = useState<Record<string, string>>({});

  // With Copy state (per caption)
  const [withCopyMap, setWithCopyMap] = useState<Record<string, boolean>>({});
  const [copySuggestionsMap, setCopySuggestionsMap] = useState<Record<string, { text: string; style?: string }[]>>({});
  const [selectedCopyIdxMap, setSelectedCopyIdxMap] = useState<Record<string, number | null>>({});
  const [customCopyMap, setCustomCopyMap] = useState<Record<string, string>>({});
  const [useCustomCopyMap, setUseCustomCopyMap] = useState<Record<string, boolean>>({});
  const [loadingCopyMap, setLoadingCopyMap] = useState<Record<string, boolean>>({});
  const [dualResultsMap, setDualResultsMap] = useState<Record<string, { generation_id: number; image_url: string }[]>>({});

  const captions = overflow.selectedCaptions;

  // Load brand logos
  useEffect(() => {
    if (overflow.brandId) {
      imageService.getBrandLogos(overflow.brandId).then((logos) => {
        setBrandLogos(logos.map((l) => ({ id: l.id, file: l.file, name: l.name })));
      }).catch(() => {});
    }
  }, [overflow.brandId]);

  const fetchCopySuggestionsFor = async (captionId: string, captionText: string) => {
    setLoadingCopyMap((p) => ({ ...p, [captionId]: true }));
    try {
      const res = await imageService.generateCopySuggestions({
        brand_id: overflow.brandId || undefined,
        caption_text: captionText || 'marketing image',
        count: 5,
      });
      const suggestions = res.suggestions || [];
      setCopySuggestionsMap((p) => ({ ...p, [captionId]: suggestions }));
      if (suggestions.length > 0) setSelectedCopyIdxMap((p) => ({ ...p, [captionId]: 0 }));
    } catch { /* ignore */ }
    setLoadingCopyMap((p) => ({ ...p, [captionId]: false }));
  };

  const toMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    if (url.startsWith('/media/')) return url;
    return `/media/${url}`;
  };

  // Auto-expand first caption without media
  useEffect(() => {
    if (!expandedId && captions.length > 0) {
      const first = captions.find((c) => !overflow.captionMediaMap[c.id]?.mediaUrl);
      setExpandedId(first?.id || captions[0].id);
    }
  }, [captions]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(uploadPreviewUrls).forEach((urls) => {
        urls.forEach((url) => { if (url) URL.revokeObjectURL(url); });
      });
    };
  }, []);

  const getIdea = (ideaId: number) => overflow.ideasData.find((i) => i.id === ideaId);

  const gatherContext = (captionText: string) => {
    const bc = overflow.brandContext;
    return {
      brand_name: bc?.brand_name || '',
      industry: bc?.industry || '',
      description: bc?.description || '',
      target_audience: bc?.target_audience || '',
      ideas: overflow.ideasData.filter((i) => overflow.selectedIdeaIds.includes(i.id)).map((i) => `${i.title} (${i.angle})`),
      topics: overflow.selectedTrendingTopics.slice(0, 5),
      caption_snippet: captionText.substring(0, 200),
    };
  };

  const handleFileUpload = (captionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setUploadedFiles((p) => ({ ...p, [captionId]: [...(p[captionId] || []), ...newFiles] }));
    setUploadPreviewUrls((p) => ({ ...p, [captionId]: [...(p[captionId] || []), ...newUrls] }));
    // Clear refined prompt when new files are uploaded (context changed)
    setRefinedPrompts((p) => ({ ...p, [captionId]: null }));
    // Reset file input so same file can be re-selected
    e.target.value = '';
  };

  const handleRemoveMedia = (captionId: string) => {
    overflow.setCaptionMedia(captionId, null, null);
    (uploadPreviewUrls[captionId] || []).forEach((url) => URL.revokeObjectURL(url));
    setUploadedFiles((p) => ({ ...p, [captionId]: [] }));
    setUploadPreviewUrls((p) => ({ ...p, [captionId]: [] }));
    setRefinedPrompts((p) => ({ ...p, [captionId]: null }));
    setErrorMap((p) => ({ ...p, [captionId]: null }));
  };

  const handleRemoveUploadedFile = (captionId: string, fileIndex: number) => {
    const urls = uploadPreviewUrls[captionId] || [];
    if (urls[fileIndex]) URL.revokeObjectURL(urls[fileIndex]);
    setUploadedFiles((p) => ({ ...p, [captionId]: (p[captionId] || []).filter((_, i) => i !== fileIndex) }));
    setUploadPreviewUrls((p) => ({ ...p, [captionId]: (p[captionId] || []).filter((_, i) => i !== fileIndex) }));
    setRefinedPrompts((p) => ({ ...p, [captionId]: null }));
  };

  const handleModeSwitch = (captionId: string, newMode: 'upload' | 'generate') => {
    setModes((p) => ({ ...p, [captionId]: newMode }));
    setRefinedPrompts((p) => ({ ...p, [captionId]: null }));
    setErrorMap((p) => ({ ...p, [captionId]: null }));
    if (newMode === 'generate') {
      (uploadPreviewUrls[captionId] || []).forEach((url) => URL.revokeObjectURL(url));
      setUploadedFiles((p) => ({ ...p, [captionId]: [] }));
      setUploadPreviewUrls((p) => ({ ...p, [captionId]: [] }));
    }
  };

  // Step 1: Refine prompt only ("Generate Prompt" button)
  const handleRefinePrompt = async (captionId: string) => {
    const style = styles[captionId] || 'modern';
    const caption = captions.find((c) => c.id === captionId);
    const idea = caption ? getIdea(caption.ideaId) : null;

    // Auto-fill if prompt is empty
    let userPrompt = prompts[captionId]?.trim();
    if (!userPrompt) {
      const parts: string[] = [];
      if (idea) { parts.push(idea.title); if (idea.hook) parts.push(idea.hook); }
      if (overflow.selectedTrendingTopics.length > 0) parts.push(`themed around ${overflow.selectedTrendingTopics[0]}`);
      if (overflow.brandContext) parts.push(`for ${overflow.brandContext.brand_name}`);
      userPrompt = parts.join(' — ') || 'A professional social media image';
      setPrompts((p) => ({ ...p, [captionId]: userPrompt! }));
    }

    setRefiningMap((p) => ({ ...p, [captionId]: true }));
    setErrorMap((p) => ({ ...p, [captionId]: null }));

    try {
      const ctx = gatherContext(caption?.text || '');
      const refineResult = await imageService.refinePrompt({ ...ctx, user_prompt: userPrompt, style });
      setRefinedPrompts((p) => ({ ...p, [captionId]: refineResult.refined_prompt }));
      if (refineResult.used_prompt) { const up = refineResult.used_prompt; setRefineUsedPrompts((p) => ({ ...p, [captionId]: up })); }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to refine prompt.';
      setErrorMap((p) => ({ ...p, [captionId]: msg }));
    }
    setRefiningMap((p) => ({ ...p, [captionId]: false }));
  };

  // Step 2: Generate image from refined prompt ("Generate Image" button)
  const handleGenerateImage = async (captionId: string) => {
    const refined = refinedPrompts[captionId];
    if (!refined) return;
    const style = styles[captionId] || 'modern';
    const mode = modes[captionId] || 'generate';
    const provider = providers[captionId] || 'openai';

    setGeneratingMap((p) => ({ ...p, [captionId]: true }));
    setErrorMap((p) => ({ ...p, [captionId]: null }));
    setBothResults((p) => ({ ...p, [captionId]: {} }));

    const enhancedImagePrompt = `Create a professional social media content image based on this description: ${refined}\n\nRequirements:\n- Clean, brand-appropriate composition suitable for marketing\n- High visual quality with professional lighting\n- Clear focal point and intentional negative space\n- Style: ${style}\n- No text or watermarks in the image\n\nEnhance this prompt with specific details about composition, lighting direction, color palette, and depth of field to produce the highest quality result.`;

    const buildRequest = (prov: 'openai' | 'gemini') => {
      const req: any = { prompt: enhancedImagePrompt, style, enhance_prompt: true, provider: prov };
      const files = uploadedFiles[captionId] || [];
      if (mode === 'upload' && files.length > 0) {
        req.product_image = files[0];
        req.product_position = 'center';
        req.product_scale = 50;
      }
      // Brand logo (mandatory)
      const blId = selectedBrandLogos[captionId] || (brandLogos.length > 0 ? brandLogos[0].id : null);
      if (blId) {
        req.brand_logo_id = blId;
        req.logo_position = brandLogoPositions[captionId] || 'bottom_right';
      }
      // With Copy
      if (withCopyMap[captionId]) {
        req.with_copy = true;
        const activeCopy = useCustomCopyMap[captionId]
          ? customCopyMap[captionId]
          : (selectedCopyIdxMap[captionId] != null ? copySuggestionsMap[captionId]?.[selectedCopyIdxMap[captionId]!]?.text : '');
        if (activeCopy) req.copy_text = activeCopy;
      }
      return req;
    };

    try {
      if (provider === 'both') {
        const [openaiRes, geminiRes] = await Promise.allSettled([
          imageService.generate(buildRequest('openai')),
          imageService.generate(buildRequest('gemini')),
        ]);
        const results: { openai?: any; gemini?: any } = {};
        if (openaiRes.status === 'fulfilled') results.openai = openaiRes.value;
        if (geminiRes.status === 'fulfilled') results.gemini = geminiRes.value;
        setBothResults((p) => ({ ...p, [captionId]: results }));
        // Store prompt from whichever succeeded
        const anyResult = results.openai || results.gemini;
        if (anyResult) {
          const genPrompt = anyResult.enhanced_prompt || anyResult.revised_prompt || '';
          if (genPrompt) setImageUsedPrompts((p) => ({ ...p, [captionId]: genPrompt }));
        }
        if (!results.openai && !results.gemini) {
          const openaiErr = openaiRes.status === 'rejected' ? openaiRes.reason : null;
          const msg = openaiErr?.response?.data?.error || openaiErr?.message || 'Both providers failed to generate image.';
          setErrorMap((p) => ({ ...p, [captionId]: msg }));
        }
      } else {
        const result = await imageService.generate(buildRequest(provider));

        // Handle dual images for with_copy
        if (result.images && result.images.length > 1) {
          setDualResultsMap((p) => ({ ...p, [captionId]: result.images! }));
          // Don't auto-select — let user choose
        } else {
          const rawUrl = result.generated_image_with_logo || result.composited_image || result.generated_image || null;
          const imageUrl = toMediaUrl(rawUrl);
          overflow.setCaptionMedia(captionId, imageUrl, result.id || null);
          if (result.id) overflow.addMedia(result.id);
        }
        const genPrompt = result.enhanced_prompt || result.revised_prompt || '';
        if (genPrompt) setImageUsedPrompts((p) => ({ ...p, [captionId]: genPrompt }));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate image.';
      setErrorMap((p) => ({
        ...p,
        [captionId]: msg.toLowerCase().includes('safety') ? 'Prompt flagged by safety system. Try rephrasing.' : msg,
      }));
    }
    setGeneratingMap((p) => ({ ...p, [captionId]: false }));
  };

  // Regenerate refined prompt from edited prompt (PromptInfoButton callback)
  const handleRefineRegenerate = async (captionId: string, editedPrompt: string) => {
    const style = styles[captionId] || 'modern';
    const caption = captions.find((c) => c.id === captionId);
    setRefineRegenerating((p) => ({ ...p, [captionId]: true }));
    try {
      const ctx = gatherContext(caption?.text || '');
      const refineResult = await imageService.refinePrompt({ ...ctx, user_prompt: prompts[captionId] || '', style, override_prompt: editedPrompt });
      setRefinedPrompts((p) => ({ ...p, [captionId]: refineResult.refined_prompt }));
      if (refineResult.used_prompt) { const up = refineResult.used_prompt; setRefineUsedPrompts((p) => ({ ...p, [captionId]: up })); }
    } catch { /* keep existing prompt */ }
    setRefineRegenerating((p) => ({ ...p, [captionId]: false }));
  };

  // Regenerate image from edited prompt (PromptInfoButton callback)
  const handleImageRegenerate = async (captionId: string, editedPrompt: string) => {
    const style = styles[captionId] || 'modern';
    const mode = modes[captionId] || 'generate';
    const provider = providers[captionId] || 'openai';
    setImageRegenerating((p) => ({ ...p, [captionId]: true }));
    try {
      const buildReq = (prov: 'openai' | 'gemini') => {
        const req: any = { prompt: editedPrompt, style, enhance_prompt: true, provider: prov };
        const files = uploadedFiles[captionId] || [];
        if (mode === 'upload' && files.length > 0) { req.product_image = files[0]; req.product_position = 'center'; req.product_scale = 50; }
        return req;
      };
      if (provider === 'both') {
        const [openaiRes, geminiRes] = await Promise.allSettled([
          imageService.generate(buildReq('openai')),
          imageService.generate(buildReq('gemini')),
        ]);
        const results: { openai?: any; gemini?: any } = {};
        if (openaiRes.status === 'fulfilled') results.openai = openaiRes.value;
        if (geminiRes.status === 'fulfilled') results.gemini = geminiRes.value;
        setBothResults((p) => ({ ...p, [captionId]: results }));
        const anyResult = results.openai || results.gemini;
        if (anyResult) { const gp = anyResult.enhanced_prompt || anyResult.revised_prompt || ''; if (gp) setImageUsedPrompts((p) => ({ ...p, [captionId]: gp })); }
      } else {
        const result = await imageService.generate(buildReq(provider));
        const rawUrl = result.composited_image || result.generated_image || result.generated_image_with_logo || null;
        const imageUrl = toMediaUrl(rawUrl);
        overflow.setCaptionMedia(captionId, imageUrl, result.id || null);
        if (result.id) overflow.addMedia(result.id);
        const genPrompt = result.enhanced_prompt || result.revised_prompt || '';
        if (genPrompt) setImageUsedPrompts((p) => ({ ...p, [captionId]: genPrompt }));
      }
    } catch { /* keep existing image */ }
    setImageRegenerating((p) => ({ ...p, [captionId]: false }));
  };

  const doneCount = captions.filter((c) => overflow.captionMediaMap[c.id]?.mediaUrl).length;
  const STYLE_OPTIONS = [
    { value: 'modern', label: 'Modern' },
    { value: 'minimalist', label: 'Minimalist' },
    { value: 'vibrant', label: 'Vibrant' },
    { value: 'professional', label: 'Professional' },
    { value: 'artistic', label: 'Artistic' },
    { value: 'flat_design', label: 'Flat Design' },
  ];

  if (captions.length === 0) {
    return (
      <div className="card p-12 text-center">
        <PhotoIcon className="w-12 h-12 mx-auto text-text-muted mb-3" />
        <p className="text-sm text-white">No captions selected. Go back to the Captions step and select at least one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <PhotoIcon className="w-5 h-5 text-pink-400" />
          Media
        </h3>
        <p className="text-sm text-white">
          Generate or upload an image for each of your <span className="text-primary-400 font-medium">{captions.length}</span> selected caption{captions.length > 1 ? 's' : ''}.
          <span className="ml-2 text-green-400">{doneCount}/{captions.length} done</span>
        </p>
      </div>

      {/* Accordion per caption */}
      {captions.map((cap, idx) => {
        const isExpanded = expandedId === cap.id;
        const media = overflow.captionMediaMap[cap.id];
        const mediaUrl = toMediaUrl(media?.mediaUrl);
        const idea = getIdea(cap.ideaId);
        const mode = modes[cap.id] || 'generate';
        const isRefining = refiningMap[cap.id] || false;
        const isGenerating = generatingMap[cap.id] || false;
        const error = errorMap[cap.id] || null;
        const refined = refinedPrompts[cap.id] || null;
        const uploadPreviews = uploadPreviewUrls[cap.id] || [];
        const uploadFiles = uploadedFiles[cap.id] || [];
        const hasUploadedFiles = uploadFiles.length > 0;

        return (
          <div key={cap.id} className="card overflow-hidden">
            {/* Accordion Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : cap.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
            >
              {/* Thumbnail / status */}
              <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center border ${
                mediaUrl ? 'border-green-500/30' : 'border-white/10 bg-white/5'
              }`}>
                {mediaUrl ? (
                  <img src={mediaUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                ) : (
                  <PhotoIcon className="w-5 h-5 text-text-muted" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Post {idx + 1}</span>
                  {idea && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 truncate">{idea.title}</span>}
                  {mediaUrl ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">Needs media</span>
                  )}
                </div>
                <p className="text-xs text-white mt-0.5 truncate">{cap.text.substring(0, 80)}...</p>
              </div>

              <ChevronDownIcon className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Accordion Body */}
            {isExpanded && (
              <div className="border-t border-white/10 p-4 space-y-4">
                {/* Caption preview */}
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-text-muted mb-1 font-medium uppercase">Caption</p>
                  <p className="text-xs text-white line-clamp-4">{cap.text}</p>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleModeSwitch(cap.id, 'upload')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      mode === 'upload' ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50' : 'bg-white/5 text-text-muted hover:bg-white/10'
                    }`}
                  >
                    <ArrowUpTrayIcon className="w-3.5 h-3.5" /> Upload
                  </button>
                  <button
                    onClick={() => handleModeSwitch(cap.id, 'generate')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      mode === 'generate' ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50' : 'bg-white/5 text-text-muted hover:bg-white/10'
                    }`}
                  >
                    <SparklesIcon className="w-3.5 h-3.5" /> AI Generate
                  </button>
                </div>

                {/* Upload area (only in upload mode) */}
                {mode === 'upload' && (
                  <div>
                    <input
                      ref={(el) => { fileRefs.current[cap.id] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileUpload(cap.id, e)}
                      className="hidden"
                    />
                    {hasUploadedFiles ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-text-muted font-medium uppercase">
                            Uploaded Image{uploadFiles.length > 1 ? 's' : ''} ({uploadFiles.length})
                          </p>
                          <button onClick={() => fileRefs.current[cap.id]?.click()} className="text-[10px] text-primary-400 hover:text-primary-300 flex items-center gap-1">
                            <ArrowUpTrayIcon className="w-2.5 h-2.5" /> Add more
                          </button>
                        </div>
                        <div className={`grid gap-2 ${uploadPreviews.length === 1 ? 'grid-cols-1' : uploadPreviews.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {uploadPreviews.map((previewUrl, fileIdx) => (
                            <div key={fileIdx} className="relative group">
                              <img src={previewUrl} alt={`Upload ${fileIdx + 1}`} className={`rounded-lg w-full border border-white/10 object-cover ${uploadPreviews.length === 1 ? 'max-h-48 mx-auto' : 'h-28'}`} />
                              {fileIdx === 0 && uploadFiles.length > 1 && (
                                <span className="absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded bg-primary-500/80 text-white font-medium">Primary</span>
                              )}
                              <button
                                onClick={() => handleRemoveUploadedFile(cap.id, fileIdx)}
                                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-center text-text-muted">
                          {uploadFiles.length > 1 ? 'First image will be used as the primary product for compositing' : 'AI will generate a professional scene for this product'}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRefs.current[cap.id]?.click()}
                        className="flex flex-col items-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed border-white/15 hover:border-primary-500/40 transition-colors w-full"
                      >
                        <ArrowUpTrayIcon className="w-6 h-6 text-text-muted" />
                        <p className="text-xs text-text-muted">Upload product images</p>
                        <p className="text-[10px] text-text-muted/60">Single or multiple — AI will generate a scene and composite your product onto it</p>
                      </button>
                    )}
                  </div>
                )}

                {/* Shared AI pipeline (both modes) */}
                <div className="space-y-3">
                  {/* Prompt textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">
                        {mode === 'upload' ? 'Scene Description' : 'Image Description'}
                        <span className="text-text-muted font-normal ml-1">(optional)</span>
                      </label>
                      <button
                        onClick={() => {
                          const parts: string[] = [];
                          if (idea) { parts.push(idea.title); if (idea.hook) parts.push(idea.hook); }
                          if (overflow.selectedTrendingTopics.length > 0) parts.push(`themed around ${overflow.selectedTrendingTopics[0]}`);
                          if (overflow.brandContext) parts.push(`for ${overflow.brandContext.brand_name}`);
                          if (parts.length > 0) setPrompts((p) => ({ ...p, [cap.id]: parts.join(' — ') }));
                        }}
                        className="text-[10px] text-primary-400 hover:text-primary-300 flex items-center gap-1"
                      >
                        <SparklesIcon className="w-2.5 h-2.5" /> Auto-fill
                      </button>
                    </div>
                    <textarea
                      className="input w-full text-xs"
                      rows={2}
                      value={prompts[cap.id] || ''}
                      onChange={(e) => { setPrompts((p) => ({ ...p, [cap.id]: e.target.value })); setRefinedPrompts((p) => ({ ...p, [cap.id]: null })); }}
                      placeholder={mode === 'upload'
                        ? 'Describe the scene for your product (e.g., marble surface with soft lighting)...'
                        : (idea ? `${idea.title} — ${idea.hook}` : 'Describe the image...')}
                    />
                  </div>

                  {/* Style selector */}
                  <div>
                    <p className="text-[10px] text-text-muted font-medium uppercase mb-1.5">Image Style</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {STYLE_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => { setStyles((p) => ({ ...p, [cap.id]: s.value })); setRefinedPrompts((p) => ({ ...p, [cap.id]: null })); }}
                          className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                            (styles[cap.id] || 'modern') === s.value
                              ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                              : 'bg-white/5 text-text-muted hover:bg-white/10'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Provider selector */}
                  <div>
                    <p className="text-[10px] text-text-muted font-medium uppercase mb-1.5">AI Provider</p>
                    <div className="flex gap-1.5">
                      {([
                        { value: 'openai', label: 'OpenAI' },
                        { value: 'gemini', label: 'Gemini' },
                        { value: 'both', label: 'Both' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setProviders((p) => ({ ...p, [cap.id]: opt.value }))}
                          className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                            (providers[cap.id] || 'openai') === opt.value
                              ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                              : 'bg-white/5 text-text-muted hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brand Logo (Mandatory) */}
                  <div>
                    <p className="text-[10px] text-text-muted font-medium uppercase mb-1.5">Brand Logo *</p>
                    {brandLogos.length > 0 ? (
                      <>
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {brandLogos.map((bl) => (
                            <button
                              key={bl.id}
                              onClick={() => setSelectedBrandLogos((p) => ({ ...p, [cap.id]: bl.id }))}
                              className={`p-1.5 rounded-lg border-2 transition-all ${
                                (selectedBrandLogos[cap.id] || brandLogos[0]?.id) === bl.id
                                  ? 'border-amber-500 bg-amber-500/10'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              <img src={bl.file} alt={bl.name} className="w-8 h-8 object-contain" />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          {(['top_left', 'top_right', 'bottom_left', 'bottom_right'] as const).map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setBrandLogoPositions((p) => ({ ...p, [cap.id]: pos }))}
                              className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex-1 ${
                                (brandLogoPositions[cap.id] || 'bottom_right') === pos
                                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                                  : 'bg-white/5 text-text-muted hover:bg-white/10'
                              }`}
                            >
                              {pos.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-1.5">
                        No logos found. Upload logos in Strategy Hub → Brand DNA first.
                      </p>
                    )}
                  </div>

                  {/* With Copy Toggle */}
                  <div className="border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-text-muted font-medium uppercase flex items-center gap-1">
                        <PencilSquareIcon className="w-3 h-3" /> With Copy
                      </p>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={withCopyMap[cap.id] || false}
                          onChange={(e) => setWithCopyMap((p) => ({ ...p, [cap.id]: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-dark-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>
                    <AnimatePresence>
                      {withCopyMap[cap.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <div className="flex gap-1 bg-dark-700 rounded-lg p-0.5">
                            <button
                              onClick={() => setUseCustomCopyMap((p) => ({ ...p, [cap.id]: false }))}
                              className={`flex-1 text-[10px] py-1.5 rounded-md transition-colors ${!useCustomCopyMap[cap.id] ? 'bg-purple-500/20 text-purple-400' : 'text-text-muted'}`}
                            >
                              AI Suggestions
                            </button>
                            <button
                              onClick={() => setUseCustomCopyMap((p) => ({ ...p, [cap.id]: true }))}
                              className={`flex-1 text-[10px] py-1.5 rounded-md transition-colors ${useCustomCopyMap[cap.id] ? 'bg-purple-500/20 text-purple-400' : 'text-text-muted'}`}
                            >
                              Custom
                            </button>
                          </div>
                          {!useCustomCopyMap[cap.id] ? (
                            <div className="space-y-1.5">
                              <button
                                onClick={() => fetchCopySuggestionsFor(cap.id, cap.text)}
                                disabled={loadingCopyMap[cap.id]}
                                className="w-full py-1.5 px-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-[10px] text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {loadingCopyMap[cap.id] ? 'Generating...' : (copySuggestionsMap[cap.id]?.length ? 'Regenerate' : 'Generate Copy')}
                              </button>
                              {(copySuggestionsMap[cap.id] || []).map((s, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedCopyIdxMap((p) => ({ ...p, [cap.id]: idx }))}
                                  className={`w-full text-left p-2 rounded-lg border text-[11px] transition-all ${
                                    selectedCopyIdxMap[cap.id] === idx
                                      ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                                      : 'border-white/5 bg-dark-700 text-text-secondary hover:border-white/15'
                                  }`}
                                >
                                  {s.text}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <textarea
                              placeholder="Type your copy text..."
                              rows={2}
                              value={customCopyMap[cap.id] || ''}
                              onChange={(e) => setCustomCopyMap((p) => ({ ...p, [cap.id]: e.target.value }))}
                              className="input w-full text-[11px]"
                            />
                          )}
                          <p className="text-[9px] text-purple-400/60 text-center">2 variations will be generated (2x cost)</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* "Generate Prompt" button */}
                  <button
                    onClick={() => handleRefinePrompt(cap.id)}
                    disabled={isRefining || (mode === 'upload' && !hasUploadedFiles)}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {isRefining ? (
                      <div className="animate-spin h-3.5 w-3.5 border-b-2 border-white rounded-full" />
                    ) : (
                      <SparklesIcon className="w-3.5 h-3.5" />
                    )}
                    {isRefining ? 'Generating Prompt...' : refined ? 'Re-generate Prompt' : 'Generate Prompt'}
                  </button>

                  {/* Refined prompt box */}
                  {refined && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 space-y-1.5">
                      <p className="text-[10px] font-medium text-green-400 flex items-center gap-1">
                        <SparklesIcon className="w-2.5 h-2.5" /> Refined Prompt
                        <PromptInfoButton prompt={refineUsedPrompts[cap.id] || ''} label="Image Prompt Refinement Prompt" onRegenerate={(ep) => handleRefineRegenerate(cap.id, ep)} regenerating={refineRegenerating[cap.id] || false} regenerateLabel="Re-refine Prompt" />
                      </p>
                      <textarea
                        className="input w-full text-[11px]"
                        rows={3}
                        value={refined}
                        onChange={(e) => setRefinedPrompts((p) => ({ ...p, [cap.id]: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* "Generate Image" button (only shows after refined prompt exists) */}
                  {refined && (
                    <button
                      onClick={() => handleGenerateImage(cap.id)}
                      disabled={isGenerating}
                      className="btn-primary text-xs py-2.5 px-5 flex items-center gap-1.5 bg-gradient-to-r from-primary-500 to-pink-500 hover:from-primary-400 hover:to-pink-400"
                    >
                      {isGenerating ? (
                        <div className="animate-spin h-3.5 w-3.5 border-b-2 border-white rounded-full" />
                      ) : (
                        <PhotoIcon className="w-3.5 h-3.5" />
                      )}
                      {isGenerating ? 'Generating Image...' : media?.mediaId ? 'Re-generate Image' : 'Generate Image'}
                    </button>
                  )}

                  {/* Generated image result — single provider */}
                  {media?.mediaId && mediaUrl && (providers[cap.id] || 'openai') !== 'both' && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] font-medium text-green-400 uppercase flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Generated Result
                        <PromptInfoButton prompt={imageUsedPrompts[cap.id] || ''} label="Image Generation Prompt (Enhanced)" onRegenerate={(ep) => handleImageRegenerate(cap.id, ep)} regenerating={imageRegenerating[cap.id] || false} regenerateLabel="Regenerate Image" />
                      </p>
                      <div className="relative group cursor-pointer" onClick={() => setPreviewImage(mediaUrl)}>
                        <img src={mediaUrl} alt="" className="rounded-lg max-h-56 mx-auto border border-white/10" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <EyeIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-4">
                        <button onClick={() => setPreviewImage(mediaUrl)} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                          <EyeIcon className="w-3 h-3" /> View
                        </button>
                        <button onClick={() => setCopyOverlayOpen(cap.id)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                          <PencilSquareIcon className="w-3 h-3" /> Add Copy
                        </button>
                        <button onClick={() => handleRemoveMedia(cap.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                          <TrashIcon className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dual with_copy variations */}
                  {dualResultsMap[cap.id]?.length > 1 && !media?.mediaId && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] font-medium text-purple-400 uppercase flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Choose Variation
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {dualResultsMap[cap.id].map((img, i) => (
                          <div key={img.generation_id} className="rounded-lg border border-white/10 overflow-hidden">
                            <img src={img.image_url} alt={`Variation ${i + 1}`} className="w-full h-auto" />
                            <div className="p-2 bg-dark-700/80 flex items-center justify-between">
                              <span className="text-[10px] text-text-muted">Variation {i + 1}</span>
                              <button
                                onClick={() => {
                                  overflow.setCaptionMedia(cap.id, img.image_url, img.generation_id);
                                  overflow.addMedia(img.generation_id);
                                  setDualResultsMap((p) => ({ ...p, [cap.id]: [] }));
                                }}
                                className="text-[10px] px-2.5 py-1 bg-primary-500/20 text-primary-400 rounded-md hover:bg-primary-500/30 transition-colors"
                              >
                                Use this
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generated image result — both providers side-by-side */}
                  {(providers[cap.id] === 'both') && bothResults[cap.id] && (bothResults[cap.id].openai || bothResults[cap.id].gemini) && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] font-medium text-green-400 uppercase flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Compare &amp; Choose
                        <PromptInfoButton prompt={imageUsedPrompts[cap.id] || ''} label="Image Generation Prompt (Enhanced)" onRegenerate={(ep) => handleImageRegenerate(cap.id, ep)} regenerating={imageRegenerating[cap.id] || false} regenerateLabel="Regenerate Both" />
                      </p>
                      {media?.mediaId && mediaUrl && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5 text-center">
                          <p className="text-[10px] text-green-400 font-medium">Selected image ready for post</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        {(['openai', 'gemini'] as const).map((prov) => {
                          const provResult = bothResults[cap.id]?.[prov];
                          if (!provResult) return (
                            <div key={prov} className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
                              <p className="text-[10px] font-medium text-text-muted uppercase mb-1">{prov === 'openai' ? 'OpenAI' : 'Gemini'}</p>
                              <p className="text-[10px] text-red-400">Failed to generate</p>
                            </div>
                          );
                          const provUrl = toMediaUrl(provResult.composited_image || provResult.generated_image || provResult.generated_image_with_logo || null);
                          const isSelected = media?.mediaId === (provResult.id || null);
                          return (
                            <div key={prov} className={`rounded-lg border p-2 space-y-2 ${isSelected ? 'border-green-500/50 bg-green-500/5' : 'border-white/10'}`}>
                              <p className="text-[10px] font-medium text-text-muted uppercase text-center">{prov === 'openai' ? 'OpenAI' : 'Gemini'}</p>
                              {provUrl && (
                                <div className="relative group cursor-pointer" onClick={() => setPreviewImage(provUrl)}>
                                  <img src={provUrl} alt={prov} className="rounded-lg max-h-44 mx-auto border border-white/10" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                    <EyeIcon className="w-6 h-6 text-white" />
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-center gap-2">
                                {provUrl && (
                                  <button onClick={() => setPreviewImage(provUrl)} className="text-[10px] text-primary-400 hover:text-primary-300 flex items-center gap-0.5">
                                    <EyeIcon className="w-2.5 h-2.5" /> View
                                  </button>
                                )}
                                {isSelected ? (
                                  <span className="text-[10px] text-green-400 font-medium flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Selected</span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      overflow.setCaptionMedia(cap.id, provUrl, provResult.id || null);
                                      if (provResult.id) overflow.addMedia(provResult.id);
                                    }}
                                    className="text-[10px] px-3 py-1 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors font-medium"
                                  >
                                    Use this
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {media?.mediaId && (
                        <div className="flex items-center justify-center gap-4">
                          <button onClick={() => setCopyOverlayOpen(cap.id)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                            <PencilSquareIcon className="w-3 h-3" /> Add Copy
                          </button>
                          <button onClick={() => handleRemoveMedia(cap.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                            <TrashIcon className="w-3 h-3" /> Remove Selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error display */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Progress notice */}
      {doneCount < captions.length && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-yellow-400">{captions.length - doneCount} caption{captions.length - doneCount > 1 ? 's' : ''} still need media before you can proceed.</p>
        </div>
      )}

      {/* Copy Overlay Modal */}
      {copyOverlayOpen && (() => {
        const cap = captions.find(c => c.id === copyOverlayOpen);
        const media = overflow.captionMediaMap[copyOverlayOpen];
        const mediaUrl = toMediaUrl(media?.mediaUrl);
        return cap && mediaUrl && media?.mediaId ? (
          <CopyOverlayModal
            isOpen={true}
            onClose={() => setCopyOverlayOpen(null)}
            assetId={media.mediaId}
            captionText={cap.text}
            imageUrl={mediaUrl}
            brandId={overflow.brandId}
            onOverlayApplied={(newUrl) => {
              overflow.setCaptionMedia(copyOverlayOpen, newUrl, media.mediaId);
              setCopyOverlayOpen(null);
            }}
          />
        ) : null;
      })()}

      {/* Image preview lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 5 — Create Posts (multi-post accordion)
// ═══════════════════════════════════════════════════════════
function CreatePostStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  const captions = overflow.selectedCaptions;

  // Shared settings
  const [platforms, setPlatforms] = useState<PlatformType[]>(['instagram']);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledHour, setScheduledHour] = useState('10');
  const [scheduledMinute, setScheduledMinute] = useState('00');
  const [scheduledAmPm, setScheduledAmPm] = useState<'AM' | 'PM'>('AM');

  // Per-caption state
  const [postCaptions, setPostCaptions] = useState<Record<string, string>>({});
  const [createdPosts, setCreatedPosts] = useState<Record<string, number>>({});
  const [postLoading, setPostLoading] = useState<Record<string, boolean>>({});
  const [postErrors, setPostErrors] = useState<Record<string, string | null>>({});
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);

  // Init captions text + date
  useEffect(() => {
    const initial: Record<string, string> = {};
    captions.forEach((c) => { initial[c.id] = c.text; });
    setPostCaptions(initial);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    if (captions.length > 0) setExpandedPost(captions[0].id);
  }, []);

  const togglePlatform = (p: PlatformType) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const getScheduledISO = (): string => {
    if (!scheduledDate) return '';
    let hour = parseInt(scheduledHour, 10);
    const minute = parseInt(scheduledMinute, 10);
    if (scheduledAmPm === 'PM' && hour !== 12) hour += 12;
    if (scheduledAmPm === 'AM' && hour === 12) hour = 0;
    const dt = new Date(`${scheduledDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
    return dt.toISOString();
  };

  const toMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    if (url.startsWith('/media/')) return url;
    return `/media/${url}`;
  };

  const handleCreatePost = async (captionId: string) => {
    const captionText = postCaptions[captionId]?.trim();
    if (!captionText || platforms.length === 0 || !scheduledDate) {
      setPostErrors((p) => ({ ...p, [captionId]: 'Fill in caption, platforms, and schedule.' }));
      return;
    }
    setPostLoading((p) => ({ ...p, [captionId]: true }));
    setPostErrors((p) => ({ ...p, [captionId]: null }));

    try {
      const mediaFiles: File[] = [];
      const mediaUrl = toMediaUrl(overflow.captionMediaMap[captionId]?.mediaUrl);
      if (mediaUrl) {
        try {
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          const ext = mediaUrl.split('.').pop()?.split('?')[0] || 'png';
          mediaFiles.push(new File([blob], `generated-image.${ext}`, { type: blob.type || 'image/png' }));
        } catch { /* skip */ }
      }

      const post = await postService.create({
        caption: captionText,
        media_files: mediaFiles,
        platforms,
        scheduled_time: getScheduledISO(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(brandId ? { brand: brandId } : {}),
      });
      setCreatedPosts((p) => ({ ...p, [captionId]: post.id }));
    } catch (err: any) {
      setPostErrors((p) => ({ ...p, [captionId]: err?.response?.data?.error || err?.message || 'Failed to create post.' }));
    }
    setPostLoading((p) => ({ ...p, [captionId]: false }));
  };

  const handleCreateAll = async () => {
    setCreatingAll(true);
    for (const cap of captions) {
      if (createdPosts[cap.id]) continue;
      await handleCreatePost(cap.id);
    }
    setCreatingAll(false);
    overflow.saveToServer();
    localStorage.removeItem('overflow_selected_caption');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const createdCount = Object.keys(createdPosts).length;
  const allCreated = createdCount === captions.length;
  const getIdea = (ideaId: number) => overflow.ideasData.find((i) => i.id === ideaId);

  if (allCreated) {
    return (
      <div className="card p-12 text-center">
        <CheckCircleIcon className="w-16 h-16 mx-auto text-green-400 mb-4" />
        <h3 className="text-xl font-bold text-green-400">{captions.length} Post{captions.length > 1 ? 's' : ''} Created!</h3>
        <p className="text-sm text-white mt-2">All posts have been scheduled. Continue to see them on the Calendar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <SparklesIcon className="w-5 h-5 text-primary-400" />
          Create Posts
        </h3>
        <p className="text-sm text-white">
          Review and schedule <span className="text-primary-400 font-medium">{captions.length}</span> post{captions.length > 1 ? 's' : ''}.
          <span className="ml-2 text-green-400">{createdCount}/{captions.length} created</span>
        </p>
      </div>

      {/* Shared Settings */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Shared Settings (applies to all posts)</p>

        {/* Platforms */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Platforms</label>
          <div className="flex gap-2 flex-wrap">
            {(['instagram', 'facebook', 'twitter', 'linkedin'] as PlatformType[]).map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                  platforms.includes(p)
                    ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
              >
                {p === 'twitter' ? 'Twitter/X' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5" /> Schedule
          </label>
          <div className="grid grid-cols-4 gap-2">
            <input type="date" className="input text-xs" value={scheduledDate} min={todayStr} onChange={(e) => setScheduledDate(e.target.value)} />
            <select className="input text-xs" value={scheduledHour} onChange={(e) => setScheduledHour(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={String(h)}>{h}</option>)}
            </select>
            <select className="input text-xs" value={scheduledMinute} onChange={(e) => setScheduledMinute(e.target.value)}>
              {['00', '15', '30', '45'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="input text-xs" value={scheduledAmPm} onChange={(e) => setScheduledAmPm(e.target.value as 'AM' | 'PM')}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>

      {/* Per-caption accordion */}
      {captions.map((cap, idx) => {
        const isExpanded = expandedPost === cap.id;
        const isCreated = !!createdPosts[cap.id];
        const isLoading = postLoading[cap.id] || false;
        const error = postErrors[cap.id] || null;
        const media = overflow.captionMediaMap[cap.id];
        const mediaUrl = toMediaUrl(media?.mediaUrl);
        const idea = getIdea(cap.ideaId);

        return (
          <div key={cap.id} className={`card overflow-hidden ${isCreated ? 'ring-1 ring-green-500/30' : ''}`}>
            {/* Header */}
            <button
              onClick={() => setExpandedPost(isExpanded ? null : cap.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
            >
              {mediaUrl ? (
                <img src={mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10">
                  <PhotoIcon className="w-4 h-4 text-text-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Post {idx + 1}</span>
                  {idea && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 truncate">{idea.title}</span>}
                  {isCreated ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">Pending</span>
                  )}
                </div>
                <p className="text-xs text-white mt-0.5 truncate">{(postCaptions[cap.id] || cap.text).substring(0, 80)}...</p>
              </div>
              <ChevronDownIcon className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Body */}
            {isExpanded && (
              <div className="border-t border-white/10 p-4 space-y-4">
                {/* Editable caption */}
                <div>
                  <label className="text-xs font-medium mb-1 block">Caption</label>
                  <textarea
                    className="input w-full text-xs"
                    rows={4}
                    value={postCaptions[cap.id] || ''}
                    onChange={(e) => setPostCaptions((p) => ({ ...p, [cap.id]: e.target.value }))}
                    disabled={isCreated}
                  />
                  <p className="text-[10px] text-text-muted mt-0.5">{(postCaptions[cap.id] || '').length} characters</p>
                </div>

                {/* Media preview */}
                {mediaUrl && (
                  <div>
                    <label className="text-xs font-medium mb-1 block">Media</label>
                    <img src={mediaUrl} alt="" className="rounded-lg max-h-32 border border-white/10" />
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {!isCreated && (
                  <button
                    onClick={() => handleCreatePost(cap.id)}
                    disabled={isLoading || !(postCaptions[cap.id]?.trim()) || platforms.length === 0 || !scheduledDate}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {isLoading ? <div className="animate-spin h-3.5 w-3.5 border-b-2 border-white rounded-full" /> : <ArrowRightIcon className="w-3.5 h-3.5" />}
                    {isLoading ? 'Creating...' : 'Create This Post'}
                  </button>
                )}

                {isCreated && (
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4" /> Post created and scheduled!
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Create All button */}
      {!allCreated && (
        <button
          onClick={handleCreateAll}
          disabled={creatingAll || platforms.length === 0 || !scheduledDate}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
        >
          {creatingAll ? (
            <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
          ) : (
            <SparklesIcon className="w-4 h-4" />
          )}
          {creatingAll ? 'Creating all posts...' : `Create All ${captions.length - createdCount} Posts`}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 6 — Calendar
// ═══════════════════════════════════════════════════════════
function CalendarStep() {
  const overflow = useOverflowStore();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <CalendarDaysIcon className="w-5 h-5 text-blue-400" />
          Content Calendar
        </h3>
        <p className="text-sm text-white">Your post has been scheduled. You can view it on the full calendar.</p>
      </div>

      <div className="card p-12 text-center">
        {overflow.createdPostId ? (
          <>
            <CheckCircleIcon className="w-16 h-16 mx-auto text-green-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">All Set!</h3>
            <p className="text-sm text-white mb-6">Your content pipeline is ready. You've set up your strategy, generated ideas, written captions, and scheduled your first post.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/calendar')} className="btn-secondary">
                View Calendar
              </button>
              <button onClick={() => { overflow.complete(); navigate('/'); }} className="btn-primary flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4" /> Complete & Go to Dashboard
              </button>
            </div>
          </>
        ) : (
          <>
            <CalendarDaysIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Post Created Yet</h3>
            <p className="text-sm text-text-secondary mb-6">Go back to Step 5 to create and schedule your first post, or complete the setup now.</p>
            <button onClick={() => { overflow.complete(); navigate('/'); }} className="btn-primary flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4" /> Complete Setup
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default OverflowPage;
