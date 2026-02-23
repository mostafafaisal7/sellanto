import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@heroicons/react/24/outline';
import { useOverflowStore } from '../store';
import strategyService from '../services/strategyService';
import captionService from '../services/captionService';
import { imageService } from '../services/imageService';
import postService from '../services/postService';
import api from '../services/api';
import type { ContentIdea, TrendingTopic, PlatformType } from '../types';

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
  const overflow = useOverflowStore();

  const [brandId, setBrandIdLocal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fresh start on every visit — reset store, then load brand
  useEffect(() => {
    overflow.reset();
    localStorage.removeItem('overflow_selected_caption');
    localStorage.removeItem('overflow_caption_groups');
    localStorage.removeItem('overflow_has_upload');
    const init = async () => {
      try {
        const res = await api.get('/brands/');
        const brands = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (brands.length > 0) {
          const primary = brands.find((b: any) => b.is_primary) || brands[0];
          setBrandIdLocal(primary.id);
          overflow.setBrandId(primary.id);
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
          <p className="text-sm text-text-secondary mt-1">Follow these steps to set up your content pipeline</p>
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
            disabled={overflow.currentStep === 4 && !overflow.generatedMediaUrl}
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

  useEffect(() => {
    if (!brandId) return;
    strategyService.getDNAStatus(brandId).then((res) => {
      if (res.brand_dna && Object.keys(res.brand_dna).length > 0) {
        setDnaData(res.brand_dna);
        if (res.website_url) setUrl(res.website_url);
        overflow.markDNAComplete();
      }
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
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate DNA.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* URL Input + Generate */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <BeakerIcon className="w-5 h-5 text-primary-400" />
          Brand DNA Generator
        </h3>
        <p className="text-sm text-text-secondary mb-4">
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

      {/* Loading state */}
      {loading && (
        <div className="card p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-muted mt-3 text-sm">Analyzing your website with AI...</p>
          <p className="text-text-muted text-xs mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Full DNA Results — same depth as StrategyHub */}
      {dnaData && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Brand Identity Card */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Brand Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dnaData.brand_name && (
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Brand Name</label>
                  <p className="text-sm mt-1">{dnaData.brand_name}</p>
                </div>
              )}
              {dnaData.tagline && (
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Tagline</label>
                  <p className="text-sm mt-1 italic">"{dnaData.tagline}"</p>
                </div>
              )}
              {dnaData.industry && (
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Industry</label>
                  <p className="text-sm mt-1">{dnaData.industry}</p>
                </div>
              )}
              {dnaData.brand_voice && (
                <div>
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Brand Voice</label>
                  <p className="text-sm mt-1">{dnaData.brand_voice}</p>
                </div>
              )}
            </div>
            {dnaData.description && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Description</label>
                <p className="text-sm mt-1">{dnaData.description}</p>
              </div>
            )}
            {dnaData.target_audience && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Target Audience</label>
                <p className="text-sm mt-1">{dnaData.target_audience}</p>
              </div>
            )}
            {dnaData.competitor_positioning && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Competitor Positioning</label>
                <p className="text-sm mt-1">{dnaData.competitor_positioning}</p>
              </div>
            )}
            {dnaData.cta_style && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">CTA Style</label>
                <p className="text-sm mt-1">{dnaData.cta_style}</p>
              </div>
            )}
          </div>

          {/* Products & Services */}
          {dnaData.products_services && dnaData.products_services.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Products & Services</h3>
              <div className="flex flex-wrap gap-2">
                {dnaData.products_services.map((item: string, idx: number) => (
                  <span key={idx} className="bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full text-sm">{item}</span>
                ))}
              </div>
            </div>
          )}

          {/* USP + Values + Content Themes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dnaData.unique_selling_points && dnaData.unique_selling_points.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Unique Selling Points</h4>
                <ul className="space-y-2">
                  {dnaData.unique_selling_points.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">&#10003;</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dnaData.brand_values && dnaData.brand_values.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Brand Values</h4>
                <ul className="space-y-2">
                  {dnaData.brand_values.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-primary-400 mt-0.5">&#9679;</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dnaData.content_themes && dnaData.content_themes.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Content Themes</h4>
                <ul className="space-y-2">
                  {dnaData.content_themes.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-yellow-400 mt-0.5">&#9733;</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Keywords + Colors + Social */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dnaData.keywords && dnaData.keywords.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Keywords</h4>
                <div className="flex flex-wrap gap-1.5">
                  {dnaData.keywords.map((kw: string, idx: number) => (
                    <span key={idx} className="bg-dark-600 text-text-secondary px-2 py-0.5 rounded text-xs">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {dnaData.color_theme && dnaData.color_theme.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Color Theme</h4>
                <div className="flex flex-wrap gap-2">
                  {dnaData.color_theme.map((color: string, idx: number) => (
                    <span key={idx} className="flex items-center gap-1.5 text-sm">
                      <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: color.toLowerCase() }} />
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {dnaData.social_platforms && dnaData.social_platforms.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-text-secondary">Social Platforms</h4>
                <div className="flex flex-wrap gap-2">
                  {dnaData.social_platforms.map((p: string, idx: number) => (
                    <span key={idx} className="badge badge-primary text-xs capitalize">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Website Link */}
          {dnaData.website_url && (
            <div className="text-center">
              <a href={dnaData.website_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary-400 hover:underline">
                {dnaData.website_url}
              </a>
            </div>
          )}
        </motion.div>
      )}

      {/* Empty State */}
      {!dnaData && !loading && (
        <div className="card p-12 text-center">
          <BeakerIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary">Enter your website URL above and click "Generate DNA"</p>
          <p className="text-xs text-text-secondary mt-1">AI will analyze your website and extract your brand's identity</p>
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

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-500" />
          Content Pillars
        </h3>
        <button onClick={() => setShowForm(true)} className="btn-secondary text-sm flex items-center gap-1.5">
          <PlusIcon className="w-4 h-4" /> Add Pillar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" /></div>
      ) : pillars.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-6">No pillars yet. Add at least one content pillar.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {pillars.map((p) => (
            <div key={p.id} className="bg-dark-700/30 rounded-lg p-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color_code }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-text-muted">{p.target_percentage}%</p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="p-1 text-text-muted hover:text-red-400">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
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
      overflow.markCompetitorsComplete();
      load();
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.error || 'Analysis failed. Check your API key.');
    }
    setAnalyzingId(null);
    setAnalyzingAll(false);
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
            <button onClick={() => setShowForm(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4" /> Add Competitor
            </button>
          </div>
        </div>
        <p className="text-sm text-text-secondary">Add competitor profiles and get AI-powered strategic insights.</p>
      </div>

      {analysisError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{analysisError}</div>
      )}

      {loading ? (
        <div className="card p-12 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto" /></div>
      ) : competitors.length === 0 ? (
        <div className="card p-12 text-center">
          <GlobeAltIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary">No competitors added yet</p>
          <p className="text-xs text-text-secondary mt-1">Add competitor profiles to get AI-powered strategic insights</p>
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
                    </h4>
                    <div className="space-y-3">
                      {compInsights.map((insight) => (
                        <div key={insight.id} className="bg-dark-700/30 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{insight.hook_text}</p>
                              {insight.angle && <p className="text-xs text-text-secondary mt-1">Angle: {insight.angle}</p>}
                              {insight.based_on && <p className="text-xs text-text-secondary mt-1 italic">Based on: {insight.based_on}</p>}
                              {insight.recommendation && <p className="text-xs text-primary-400 mt-1">Action: {insight.recommendation}</p>}
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
                    <p className="text-sm text-text-secondary">No insights yet. Click "Analyze" to get AI-powered insights.</p>
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

  // Load cached trending data on mount
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
      if (arr.length > 0) markTrendingComplete();
      else setError('No trending topics found. Try again.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to generate trending topics.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!brandId) {
      setError('No brand selected. Please complete the Brand DNA step first.');
      return;
    }
    doGenerate(brandId);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FireIcon className="w-5 h-5 text-orange-400" />
          Trending Topics
        </h3>
        <button onClick={handleGenerate} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
          {loading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowPathIcon className="w-4 h-4" />}
          {loading ? 'Analyzing...' : topics.length > 0 ? 'Refresh' : 'Generate'}
        </button>
      </div>
      <p className="text-sm text-text-secondary">
        Discover Google Trends topics relevant to your brand — powered by real-time data & AI analysis.
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
            {elapsed < 5
              ? 'Querying Google Trends...'
              : elapsed < 15
              ? 'Analyzing trend relevance with AI...'
              : elapsed < 30
              ? 'Almost done — ranking topics for your brand...'
              : 'Taking a bit longer than usual... hang tight!'}
          </p>
          <p className="text-xs text-text-muted mt-1">{elapsed}s elapsed</p>
        </div>
      )}

      {!loading && topics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted">{topics.length} trending topics found</p>
              <p className="text-xs text-primary-400/70 mt-0.5">Click topics to select them for idea generation</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (selectedTrendingTopics.length === topics.length) {
                    setSelectedTrendingTopics([]);
                  } else {
                    setSelectedTrendingTopics(topics.map((t) => t.topic));
                  }
                }}
                className="text-xs text-primary-400 hover:text-primary-300 underline"
              >
                {selectedTrendingTopics.length === topics.length ? 'Deselect All' : 'Select All'}
              </button>
              <p className="text-xs text-primary-400 font-medium">
                {selectedTrendingTopics.length} selected
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {topics.map((t, idx) => {
              const isSelected = selectedTrendingTopics.includes(t.topic);
              return (
                <div
                  key={t.id || idx}
                  onClick={() => toggleTrendingTopic(t.topic)}
                  className={`rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary-500/10 border border-primary-500/40 ring-1 ring-primary-500/20'
                      : t.category === 'seasonal' || t.category === 'cultural'
                      ? 'bg-gradient-to-br from-orange-500/10 to-dark-700/30 border border-orange-500/10 hover:border-primary-500/30'
                      : 'bg-dark-700/30 border border-transparent hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      isSelected ? 'border-primary-500 bg-primary-500' : 'border-white/20'
                    }`}>
                      {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{t.topic}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.category && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${
                              t.category === 'seasonal' ? 'bg-purple-500/20 text-purple-400' :
                              t.category === 'cultural' ? 'bg-pink-500/20 text-pink-400' :
                              t.category === 'viral' ? 'bg-cyan-500/20 text-cyan-400' :
                              t.category === 'evergreen' ? 'bg-green-500/20 text-green-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {t.category}
                            </span>
                          )}
                          {t.volume_score != null && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              t.volume_score >= 80 ? 'bg-red-500/20 text-red-400' :
                              t.volume_score >= 50 ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {t.volume_score >= 80 ? 'Hot' : t.volume_score >= 50 ? 'Rising' : 'Emerging'}
                            </span>
                          )}
                        </div>
                      </div>
                      {t.relevance_explanation && (
                        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{t.relevance_explanation}</p>
                      )}
                      {t.volume_score != null && (
                        <div className="mt-2">
                          <div className="h-1 bg-dark-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                t.volume_score >= 80 ? 'bg-red-500' : t.volume_score >= 50 ? 'bg-orange-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.min(t.volume_score, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
      // Store idea data for CaptionsStep + auto-select all
      const mapped = newIdeas.map((i: ContentIdea) => ({
        id: i.id, title: i.title, hook: i.hook, angle: i.angle || '',
        platform: i.platform, content_format: i.content_format,
      }));
      overflow.setIdeasData(mapped);
      overflow.setIdeaSelection(newIdeas.map((i: ContentIdea) => i.id));
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
          </h3>
          <button onClick={doGenerate} disabled={loading} className="btn-secondary text-sm flex items-center gap-2">
            {loading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowPathIcon className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
        <p className="text-sm text-text-secondary">
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
                  <p className="text-xs text-text-secondary mt-1">{idea.hook}</p>
                  {idea.angle && <p className="text-xs text-text-muted mt-0.5 italic">Angle: {idea.angle}</p>}
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

  const getIdea = (ideaId: number) => overflow.ideasData.find((i) => i.id === ideaId);
  const topics = overflow.selectedTrendingTopics;

  // Generate 3 captions for a single idea
  const generateForIdea = async (ideaId: number, customInstructions?: string): Promise<CaptionVariant[]> => {
    const idea = getIdea(ideaId);
    const topic = idea
      ? `${idea.title}\n\nHook: ${idea.hook}\nAngle: ${idea.angle}`
      : 'an engaging social media post';
    const platform = idea?.platform || 'instagram';

    const baseInstructions = `Write a ready-to-post social media caption for ${platform}. The caption must be engaging, scroll-stopping, and ready to copy-paste and post directly. Do NOT mention any idea number, internal ID, or the word "idea". Do NOT include any reference numbers. Variant {VAR} of 3 — each must use a completely different creative angle.`;
    const extraInstructions = customInstructions
      ? `\n\nUSER INSTRUCTIONS (must follow): ${customInstructions}`
      : '';

    const variants: CaptionVariant[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await captionService.generate({
        topic,
        tone: 'enthusiastic',
        length: 'medium',
        platform: platform as any,
        include_hashtags: true,
        include_emojis: true,
        include_cta: true,
        custom_instructions: baseInstructions.replace('{VAR}', String(i + 1)) + extraInstructions,
      });
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
    // Skip if captions already exist for all ideas
    const allDone = overflow.selectedIdeaIds.every((id) => captionGroups[id]?.length > 0);
    if (allDone) return;

    setAutoTriggered(true);
    const ideaIds = overflow.selectedIdeaIds;
    setProgress({ done: 0, total: ideaIds.length });

    (async () => {
      for (let idx = 0; idx < ideaIds.length; idx++) {
        const ideaId = ideaIds[idx];
        if (captionGroups[ideaId]?.length > 0) {
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue; // already has captions
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
    for (const group of Object.values(captionGroups)) {
      group.filter((c) => c.selected).forEach((c) => allSelected.push(c.text));
    }
    if (allSelected.length > 0) {
      localStorage.setItem('overflow_selected_caption', allSelected.join('\n\n---\n\n'));
    }
  }, [captionGroups]);

  if (overflow.selectedIdeaIds.length === 0) {
    return (
      <div className="card p-12 text-center">
        <PencilSquareIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
        <p className="text-text-secondary">No ideas found</p>
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
        <p className="text-sm text-text-secondary">
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
                  </div>
                  {idea?.hook && <p className="text-xs text-text-secondary mt-1 ml-6">{idea.hook}</p>}
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
                      <p className="text-text-secondary whitespace-pre-wrap leading-relaxed mt-0.5">{caption.text}</p>
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
            <p className="text-xs text-text-secondary">
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
// STEP 4 — Media
// ═══════════════════════════════════════════════════════════
function MediaStep() {
  const overflow = useOverflowStore();
  const [mode, setMode] = useState<'upload' | 'generate'>('upload');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(overflow.generatedMediaUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<'instagram' | 'facebook' | 'twitter' | 'linkedin'>('instagram');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    if (url.startsWith('/media/')) return url;
    return `/media/${url}`;
  };

  const currentImage = uploadPreview || toMediaUrl(generatedImage);

  // Get caption for preview
  const getPreviewCaption = () => {
    const saved = localStorage.getItem('overflow_selected_caption');
    if (saved) return saved.split('\n\n---\n\n')[0]?.substring(0, 200) || '';
    return 'Your caption will appear here...';
  };

  const getIdeaSuggestion = () => {
    const idea = overflow.ideasData.find((i) => overflow.selectedIdeaIds.includes(i.id));
    return idea ? `${idea.title} — ${idea.hook}` : '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setUploadPreview(previewUrl);
      overflow.setGeneratedMediaUrl(previewUrl);
    }
  };

  const removeMedia = () => {
    setUploadedFile(null);
    setUploadPreview(null);
    setGeneratedImage(null);
    overflow.setGeneratedMediaUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (uploadedFile) localStorage.setItem('overflow_has_upload', 'true');
  }, [uploadedFile]);

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const safePrompt = `Professional social media content image: ${prompt.trim()}. Clean, brand-appropriate, high quality, suitable for marketing.`;
      const result = await imageService.generate({ prompt: safePrompt, style, enhance_prompt: true });
      const rawUrl = result.generated_image || result.generated_image_with_logo || null;
      const imageUrl = toMediaUrl(rawUrl);
      setGeneratedImage(imageUrl);
      if (imageUrl) overflow.setGeneratedMediaUrl(imageUrl);
      if (result.id) overflow.addMedia(result.id);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate image.';
      if (msg.toLowerCase().includes('safety')) {
        setError('The prompt was flagged by the safety system. Try rephrasing.');
      } else {
        setError(msg);
      }
    }
    setLoading(false);
  };

  // Platform preview mockup
  const PlatformPreview = ({ imgSrc }: { imgSrc: string }) => {
    const captionText = getPreviewCaption();

    if (previewPlatform === 'instagram') {
      return (
        <div className="bg-black rounded-xl overflow-hidden border border-white/10 max-w-sm mx-auto">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500" />
            <div>
              <p className="text-xs font-semibold text-white">your_brand</p>
              <p className="text-[10px] text-gray-400">Sponsored</p>
            </div>
          </div>
          <img src={imgSrc} alt="Preview" className="w-full aspect-square object-cover" />
          <div className="px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            </div>
            <p className="text-[11px] text-white leading-relaxed line-clamp-3"><span className="font-semibold">your_brand</span> {captionText}</p>
          </div>
        </div>
      );
    }

    if (previewPlatform === 'facebook') {
      return (
        <div className="bg-[#242526] rounded-xl overflow-hidden border border-white/10 max-w-sm mx-auto">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">B</div>
            <div>
              <p className="text-xs font-semibold text-white">Your Brand</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">Just now · <GlobeAltIcon className="w-2.5 h-2.5" /></p>
            </div>
          </div>
          <p className="text-xs text-gray-200 px-3 pb-2 line-clamp-3">{captionText}</p>
          <img src={imgSrc} alt="Preview" className="w-full aspect-[1.91/1] object-cover" />
          <div className="flex items-center justify-around py-2 border-t border-white/10">
            <span className="text-xs text-gray-400 flex items-center gap-1">👍 Like</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">💬 Comment</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">↗ Share</span>
          </div>
        </div>
      );
    }

    if (previewPlatform === 'twitter') {
      return (
        <div className="bg-black rounded-xl overflow-hidden border border-white/10 max-w-sm mx-auto p-3">
          <div className="flex gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gray-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">Your Brand</span>
                <span className="text-[10px] text-gray-500">@yourbrand · 1m</span>
              </div>
              <p className="text-xs text-gray-200 mt-1 line-clamp-3">{captionText}</p>
              <img src={imgSrc} alt="Preview" className="w-full aspect-video object-cover rounded-xl mt-2 border border-white/10" />
              <div className="flex items-center justify-between mt-2 text-gray-500">
                <span className="text-[10px]">💬 12</span>
                <span className="text-[10px]">🔁 8</span>
                <span className="text-[10px]">❤ 42</span>
                <span className="text-[10px]">📊 1.2K</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // LinkedIn
    return (
      <div className="bg-[#1B1F23] rounded-xl overflow-hidden border border-white/10 max-w-sm mx-auto">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">B</div>
          <div>
            <p className="text-xs font-semibold text-white">Your Brand</p>
            <p className="text-[10px] text-gray-400">1,234 followers · 1h</p>
          </div>
        </div>
        <p className="text-xs text-gray-200 px-3 pb-2 line-clamp-3">{captionText}</p>
        <img src={imgSrc} alt="Preview" className="w-full aspect-[1.91/1] object-cover" />
        <div className="flex items-center justify-around py-2 border-t border-white/10">
          <span className="text-xs text-gray-400">👍 Like</span>
          <span className="text-xs text-gray-400">💬 Comment</span>
          <span className="text-xs text-gray-400">🔁 Repost</span>
          <span className="text-xs text-gray-400">📩 Send</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <PhotoIcon className="w-5 h-5 text-pink-400" />
          Media
        </h3>
        <p className="text-sm text-text-secondary">Upload your own media or generate an AI image for your post.</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'upload' ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50' : 'bg-white/5 text-text-muted hover:bg-white/10'
          }`}
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          Upload Media
        </button>
        <button
          onClick={() => setMode('generate')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'generate' ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50' : 'bg-white/5 text-text-muted hover:bg-white/10'
          }`}
        >
          <SparklesIcon className="w-4 h-4" />
          AI Generate
        </button>
      </div>

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div className="card p-6 space-y-4">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
          {uploadPreview ? (
            <div className="space-y-3">
              <img src={uploadPreview} alt="Upload" className="rounded-lg max-h-64 mx-auto border border-white/10" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">{uploadedFile?.name}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                    <ArrowPathIcon className="w-3 h-3" /> Replace
                  </button>
                  <button onClick={removeMedia} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                    <TrashIcon className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 px-6 py-10 rounded-lg border-2 border-dashed border-white/15 hover:border-primary-500/40 transition-colors w-full"
            >
              <ArrowUpTrayIcon className="w-8 h-8 text-text-muted" />
              <div className="text-center">
                <p className="text-sm font-medium text-text-secondary">Click to upload image or video</p>
                <p className="text-xs text-text-muted mt-1">JPG, PNG, GIF, MP4, MOV — max 50MB</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Generate Mode */}
      {mode === 'generate' && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Image Description</label>
            <textarea
              className="input w-full"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getIdeaSuggestion() || 'Describe the image you want to generate...'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Style</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'modern', label: 'Modern' },
                { value: 'minimalist', label: 'Minimalist' },
                { value: 'vibrant', label: 'Vibrant' },
                { value: 'professional', label: 'Professional' },
                { value: 'artistic', label: 'Artistic' },
                { value: 'flat_design', label: 'Flat Design' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    style === s.value
                      ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                      : 'bg-white/5 text-text-muted hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleGenerateImage} disabled={loading || !prompt.trim()} className="btn-primary flex items-center gap-2">
              {loading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <SparklesIcon className="w-4 h-4" />}
              {loading ? 'Generating...' : generatedImage ? 'Re-generate' : 'Generate Image'}
            </button>
            {generatedImage && (
              <button onClick={removeMedia} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <TrashIcon className="w-3 h-3" /> Remove
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Social Media Platform Preview */}
      {currentImage && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <GlobeAltIcon className="w-4 h-4 text-primary-400" />
              Platform Preview
            </h4>
            <div className="flex gap-1.5">
              {(['instagram', 'facebook', 'twitter', 'linkedin'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreviewPlatform(p)}
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${
                    previewPlatform === p
                      ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/50'
                      : 'bg-white/5 text-text-muted hover:bg-white/10'
                  }`}
                >
                  {p === 'twitter' ? 'X / Twitter' : p}
                </button>
              ))}
            </div>
          </div>
          <PlatformPreview imgSrc={currentImage} />
        </div>
      )}

      {/* Requirement notice */}
      {!currentImage && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-yellow-400">Please upload media or generate an AI image before proceeding.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP 5 — Create Post
// ═══════════════════════════════════════════════════════════
function CreatePostStep({ brandId }: { brandId: number | null }) {
  const overflow = useOverflowStore();
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<PlatformType[]>(['instagram']);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledHour, setScheduledHour] = useState('10');
  const [scheduledMinute, setScheduledMinute] = useState('00');
  const [scheduledAmPm, setScheduledAmPm] = useState<'AM' | 'PM'>('AM');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved caption from captions step
  useEffect(() => {
    const saved = localStorage.getItem('overflow_selected_caption');
    if (saved) setCaption(saved);
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const togglePlatform = (p: PlatformType) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
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

  const handleCreate = async () => {
    if (!caption.trim() || platforms.length === 0 || !scheduledDate) {
      setError('Please fill in caption, select platforms, and set a schedule time.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // If a generated image exists, fetch it as a File to attach
      const mediaFiles: File[] = [];
      const mediaUrl = overflow.generatedMediaUrl;
      if (mediaUrl) {
        try {
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          const ext = mediaUrl.split('.').pop()?.split('?')[0] || 'png';
          mediaFiles.push(new File([blob], `generated-image.${ext}`, { type: blob.type || 'image/png' }));
        } catch { /* skip if fetch fails */ }
      }

      const post = await postService.create({
        caption,
        media_files: mediaFiles,
        platforms,
        scheduled_time: getScheduledISO(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(brandId ? { brand: brandId } : {}),
      });
      overflow.setCreatedPost(post.id);
      overflow.saveToServer();
      setSuccess(true);
      localStorage.removeItem('overflow_selected_caption');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create post.');
    }
    setLoading(false);
  };

  // Minimum date = today
  const todayStr = new Date().toISOString().split('T')[0];

  if (success) {
    return (
      <div className="card p-12 text-center">
        <CheckCircleIcon className="w-16 h-16 mx-auto text-green-400 mb-4" />
        <h3 className="text-xl font-bold text-green-400">Post Created!</h3>
        <p className="text-sm text-text-secondary mt-2">Your post has been scheduled. Continue to see it on the Calendar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <SparklesIcon className="w-5 h-5 text-primary-400" />
          Create Post
        </h3>
        <p className="text-sm text-text-secondary">Review your caption, pick platforms, and schedule.</p>
      </div>

      <div className="card p-6 space-y-5">
        {/* Caption */}
        <div>
          <label className="block text-sm font-medium mb-1">Caption</label>
          <textarea
            className="input w-full"
            rows={6}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Your post caption..."
          />
          <p className="text-xs text-text-muted mt-1">{caption.length} characters</p>
        </div>

        {/* Media preview */}
        {overflow.generatedMediaUrl && (
          <div>
            <label className="block text-sm font-medium mb-2">Attached Media</label>
            <img src={overflow.generatedMediaUrl} alt="Post media" className="rounded-lg max-h-40 border border-white/10" />
          </div>
        )}

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium mb-2">Platforms</label>
          <div className="flex gap-2 flex-wrap">
            {(['instagram', 'facebook', 'twitter', 'linkedin'] as PlatformType[]).map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
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

        {/* Schedule Date & Time */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            Schedule Date & Time
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Date */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-text-muted mb-1 block">Date</label>
              <input
                type="date"
                className="input w-full"
                value={scheduledDate}
                min={todayStr}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            {/* Hour */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">Hour</label>
              <select className="input w-full" value={scheduledHour} onChange={(e) => setScheduledHour(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={String(h)}>{h}</option>
                ))}
              </select>
            </div>
            {/* Minute */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">Minute</label>
              <select className="input w-full" value={scheduledMinute} onChange={(e) => setScheduledMinute(e.target.value)}>
                {['00', '15', '30', '45'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {/* AM/PM */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">AM/PM</label>
              <select className="input w-full" value={scheduledAmPm} onChange={(e) => setScheduledAmPm(e.target.value as 'AM' | 'PM')}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          {scheduledDate && (
            <p className="text-xs text-text-muted mt-2">
              Scheduled for: {new Date(`${scheduledDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {scheduledHour}:{scheduledMinute} {scheduledAmPm}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !caption.trim() || platforms.length === 0 || !scheduledDate}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
        >
          {loading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <ArrowRightIcon className="w-5 h-5" />}
          {loading ? 'Creating Post...' : 'Create & Schedule Post'}
        </button>
      </div>
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
        <p className="text-sm text-text-secondary">Your post has been scheduled. You can view it on the full calendar.</p>
      </div>

      <div className="card p-12 text-center">
        {overflow.createdPostId ? (
          <>
            <CheckCircleIcon className="w-16 h-16 mx-auto text-green-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">All Set!</h3>
            <p className="text-sm text-text-secondary mb-6">Your content pipeline is ready. You've set up your strategy, generated ideas, written captions, and scheduled your first post.</p>
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
