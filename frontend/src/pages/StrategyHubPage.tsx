import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PlusIcon, TrashIcon, PencilIcon,
  ChartPieIcon, GlobeAltIcon, SparklesIcon,
  MagnifyingGlassIcon, LightBulbIcon,
  ArrowTopRightOnSquareIcon, BeakerIcon,
  CheckCircleIcon, FireIcon, ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import strategyService from '../services/strategyService';
import api from '../services/api';
import type { TrendingTopic, BrandDNAHistoryEntry } from '../types';

interface Pillar {
  id: number;
  brand: number;
  name: string;
  description: string;
  target_percentage: number;
  color_code: string;
  is_active: boolean;
  actual_percentage: number;
}

interface Competitor {
  id: number;
  brand: number;
  platform: string;
  handle_or_url: string;
  last_crawled_at: string | null;
  insights_count: number;
}

interface ComplianceData {
  brand_id: number;
  total_posts: number;
  pillars: Array<{
    pillar_id: number;
    pillar_name: string;
    color_code: string;
    target_percentage: number;
    actual_percentage: number;
    deviation: number;
    post_count: number;
    status: string;
  }>;
}

interface CompetitorInsight {
  id: number;
  competitor: string;
  platform: string;
  hook_text: string;
  angle: string;
  format_type: string;
  engagement_score: number;
  recommendation?: string;
  based_on?: string;
  source_url?: string;
  extracted_at?: string;
}

export function StrategyHubPage() {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [insights, setInsights] = useState<CompetitorInsight[]>([]);
  const [activeTab, setActiveTab] = useState<'pillars' | 'competitors' | 'dna' | 'trending'>('pillars');
  const [loading, setLoading] = useState(true);
  const [brandId, setBrandId] = useState<number | null>(null);

  // Competitor analysis
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Brand DNA
  const [dnaUrl, setDnaUrl] = useState('');
  const [dnaLoading, setDnaLoading] = useState(false);
  const [dnaError, setDnaError] = useState<string | null>(null);
  const [dnaData, setDnaData] = useState<Record<string, any> | null>(null);
  const [dnaGeneratedAt, setDnaGeneratedAt] = useState<string | null>(null);

  // Trending
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // DNA History
  const [dnaHistory, setDnaHistory] = useState<BrandDNAHistoryEntry[]>([]);
  const [showDnaHistory, setShowDnaHistory] = useState(false);

  // Pillar form
  const [showPillarForm, setShowPillarForm] = useState(false);
  const [pillarForm, setPillarForm] = useState({ name: '', description: '', target_percentage: 25, color_code: '#6366F1' });
  const [editingPillar, setEditingPillar] = useState<number | null>(null);

  // Competitor form
  const [showCompForm, setShowCompForm] = useState(false);
  const [compForm, setCompForm] = useState({ platform: 'twitter', handle_or_url: '' });

  // Fetch user's primary brand on mount
  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await api.get('/brands/');
        const brands = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (brands.length > 0) {
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          setBrandId(primary.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch brands:', err);
        setLoading(false);
      }
    };
    fetchBrand();
  }, []);

  useEffect(() => {
    if (brandId) loadData();
  }, [brandId]);

  const loadData = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const [pillarData, compData, complianceData] = await Promise.all([
        strategyService.getPillars(brandId),
        strategyService.getCompetitors(brandId),
        strategyService.getPillarCompliance(brandId).catch(() => null),
      ]);
      setPillars(pillarData);
      setCompetitors(compData);
      setCompliance(complianceData);

      // Load existing insights
      try {
        const insightsData = await strategyService.getInsights(brandId);
        setInsights(Array.isArray(insightsData) ? insightsData : []);
      } catch { setInsights([]); }

      // Load existing DNA
      try {
        const dnaStatus = await strategyService.getDNAStatus(brandId);
        if (dnaStatus.brand_dna && Object.keys(dnaStatus.brand_dna).length > 0) {
          setDnaData(dnaStatus.brand_dna);
          setDnaGeneratedAt(dnaStatus.brand_dna_generated_at);
          if (dnaStatus.website_url) setDnaUrl(dnaStatus.website_url);
        }
      } catch { /* no DNA yet */ }

      // Load cached trending
      try {
        const tData = await strategyService.getBrandTrending(brandId);
        setTrendingTopics(Array.isArray(tData) ? tData : tData.topics || []);
      } catch { setTrendingTopics([]); }
    } catch (err) {
      console.error('Failed to load strategy data:', err);
    }
    setLoading(false);
  };

  const handleCreatePillar = async () => {
    try {
      if (editingPillar) {
        await strategyService.updatePillar(editingPillar, pillarForm);
      } else {
        const result = await strategyService.createPillar({ ...(brandId ? { brand: brandId } : {}), ...pillarForm });
        if (!brandId && result.brand) {
          setBrandId(result.brand);
        }
      }
      setShowPillarForm(false);
      setPillarForm({ name: '', description: '', target_percentage: 25, color_code: '#6366F1' });
      setEditingPillar(null);
      loadData();
    } catch (err) {
      console.error('Failed to save pillar:', err);
    }
  };

  const handleDeletePillar = async (id: number) => {
    if (!confirm('Delete this pillar?')) return;
    try {
      await strategyService.deletePillar(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete pillar:', err);
    }
  };

  const handleAddCompetitor = async () => {
    try {
      await strategyService.addCompetitor({ ...(brandId ? { brand: brandId } : {}), ...compForm });
      setShowCompForm(false);
      setCompForm({ platform: 'twitter', handle_or_url: '' });
      loadData();
    } catch (err) {
      console.error('Failed to add competitor:', err);
    }
  };

  const handleAnalyzeCompetitor = async (competitorId?: number) => {
    if (!brandId) return;
    setAnalysisError(null);
    if (competitorId) {
      setAnalyzingId(competitorId);
    } else {
      setAnalyzingAll(true);
    }
    try {
      const result = await strategyService.triggerCrawl(brandId, competitorId);
      if (result.insights) {
        setInsights(prev => {
          // Replace insights for analyzed competitors
          const analyzedCompetitors = new Set(result.insights.map((i: CompetitorInsight) => i.competitor));
          const kept = prev.filter(i => !analyzedCompetitors.has(i.competitor));
          return [...result.insights, ...kept];
        });
      }
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Analysis failed. Check your API key.';
      setAnalysisError(msg);
    }
    setAnalyzingId(null);
    setAnalyzingAll(false);
  };

  const handleGenerateDNA = async () => {
    if (!brandId || !dnaUrl.trim()) return;
    setDnaLoading(true);
    setDnaError(null);
    try {
      const result = await strategyService.generateDNA(brandId, dnaUrl.trim());
      if (result.brand_dna) {
        setDnaData(result.brand_dna);
        setDnaGeneratedAt(result.generated_at);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to generate Brand DNA. Check your API key.';
      setDnaError(msg);
    }
    setDnaLoading(false);
  };

  const handleGenerateTrending = async () => {
    if (!brandId) {
      setTrendingError('No brand selected. Please create a brand first.');
      return;
    }
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const result = await strategyService.generateTrending(brandId);
      const topics = result?.topics || [];
      setTrendingTopics(topics);
      if (topics.length === 0) {
        setTrendingError('No trending topics found. Try again.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to generate trending topics.';
      setTrendingError(msg);
    } finally {
      setTrendingLoading(false);
    }
  };

  const handleLoadDNAHistory = async () => {
    if (!brandId) return;
    try {
      const data = await strategyService.getDNAHistory(brandId);
      setDnaHistory(Array.isArray(data) ? data : data.history || []);
      setShowDnaHistory(true);
    } catch { setDnaHistory([]); setShowDnaHistory(true); }
  };

  const handleRestoreDNA = async (historyId: number) => {
    if (!brandId) return;
    try {
      const result = await strategyService.restoreDNA(brandId, historyId);
      if (result.brand_dna) {
        setDnaData(result.brand_dna);
        setDnaGeneratedAt(result.restored_at || new Date().toISOString());
      }
      setShowDnaHistory(false);
    } catch { /* ignore */ }
  };

  const totalPercentage = pillars.reduce((sum, p) => sum + p.target_percentage, 0);

  const statusColors: Record<string, string> = {
    on_track: 'text-green-400',
    over: 'text-yellow-400',
    under: 'text-red-400',
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400 bg-green-400/10';
    if (score >= 5) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const getCompetitorUrl = (handleOrUrl: string, platform: string): string => {
    // Already a full URL
    if (handleOrUrl.startsWith('http://') || handleOrUrl.startsWith('https://')) return handleOrUrl;
    // Build URL from handle + platform
    const handle = handleOrUrl.replace(/^@/, '');
    switch (platform) {
      case 'twitter': return `https://x.com/${handle}`;
      case 'facebook': return `https://facebook.com/${handle}`;
      case 'instagram': return `https://instagram.com/${handle}`;
      case 'linkedin': return `https://linkedin.com/in/${handle}`;
      case 'website': return `https://${handleOrUrl}`;
      default: return `https://${handleOrUrl}`;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Strategy Hub</h1>
          <p className="text-text-secondary mt-1">Manage content pillars and competitor analysis</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(['pillars', 'competitors', 'dna', 'trending'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'pillars' ? 'Content Pillars' : tab === 'competitors' ? 'Competitors' : tab === 'dna' ? 'Generate DNA' : 'Trending Topics'}
          </button>
        ))}
      </div>

      {activeTab === 'pillars' && (
        <div className="space-y-6">
          {/* Pillar Distribution Chart */}
          {compliance && compliance.pillars.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl p-6 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <ChartPieIcon className="w-5 h-5 text-primary-400" />
                  Pillar Distribution
                </h3>
                <span className="text-xs text-gray-400">
                  {compliance.total_posts} total post{compliance.total_posts !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-5">
                {compliance.pillars.map((p) => {
                  const isWarning = p.actual_percentage < p.target_percentage * 0.7;
                  const actualBarColor = isWarning ? 'bg-amber-500' : 'bg-indigo-500';
                  const maxPercentage = Math.max(
                    ...compliance!.pillars.map((cp) => Math.max(cp.target_percentage, cp.actual_percentage)),
                    1
                  );
                  return (
                    <div key={p.pillar_id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color_code }} />
                          <span className="text-sm font-medium text-gray-200">{p.pillar_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400">Target: {p.target_percentage}%</span>
                          <span className={isWarning ? 'text-amber-400 font-medium' : 'text-indigo-400 font-medium'}>
                            Actual: {p.actual_percentage}%
                          </span>
                        </div>
                      </div>
                      {/* Target bar */}
                      <div className="relative h-3 mb-1">
                        <div className="absolute inset-0 bg-gray-700/50 rounded-full" />
                        <div
                          className="absolute inset-y-0 left-0 bg-slate-500/60 rounded-full transition-all duration-500"
                          style={{ width: `${(p.target_percentage / maxPercentage) * 100}%` }}
                        />
                      </div>
                      {/* Actual bar */}
                      <div className="relative h-3">
                        <div className="absolute inset-0 bg-gray-700/50 rounded-full" />
                        <div
                          className={`absolute inset-y-0 left-0 ${actualBarColor} rounded-full transition-all duration-500`}
                          style={{ width: `${(p.actual_percentage / maxPercentage) * 100}%` }}
                        />
                      </div>
                      {isWarning && (
                        <p className="text-xs text-amber-400 mt-1">Below target threshold</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-6 mt-5 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-2 rounded-sm bg-slate-500/60" />
                  <span>Target</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-2 rounded-sm bg-indigo-500" />
                  <span>Actual</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-2 rounded-sm bg-amber-500" />
                  <span>Below 70% of target</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Compliance Overview */}
          {compliance && compliance.pillars.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChartPieIcon className="w-5 h-5 text-primary-400" />
                Pillar Compliance
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {compliance.pillars.map((p) => (
                  <div key={p.pillar_id} className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full border-4 flex items-center justify-center mb-2"
                      style={{ borderColor: p.color_code }}>
                      <span className="text-lg font-bold">{p.actual_percentage}%</span>
                    </div>
                    <p className="text-sm font-medium">{p.pillar_name}</p>
                    <p className={`text-xs ${statusColors[p.status] || 'text-text-secondary'}`}>
                      Target: {p.target_percentage}% ({p.deviation > 0 ? '+' : ''}{p.deviation}%)
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Percentage Bar */}
          <div className="card p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Distribution</span>
              <span className={totalPercentage === 100 ? 'text-green-400' : 'text-yellow-400'}>
                {totalPercentage}% / 100%
              </span>
            </div>
            <div className="h-4 bg-dark-700 rounded-full overflow-hidden flex">
              {pillars.map((p) => (
                <div
                  key={p.id}
                  className="h-full transition-all duration-300"
                  style={{ width: `${p.target_percentage}%`, backgroundColor: p.color_code }}
                  title={`${p.name}: ${p.target_percentage}%`}
                />
              ))}
            </div>
          </div>

          {/* Pillar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pillars.map((pillar) => (
              <motion.div key={pillar.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pillar.color_code }} />
                    <h4 className="font-semibold">{pillar.name}</h4>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingPillar(pillar.id); setPillarForm({ name: pillar.name, description: pillar.description, target_percentage: pillar.target_percentage, color_code: pillar.color_code }); setShowPillarForm(true); }} className="btn-icon p-1">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePillar(pillar.id)} className="btn-icon p-1 text-red-400">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {pillar.description && <p className="text-sm text-text-secondary mb-3">{pillar.description}</p>}
                <div className="flex items-center justify-between text-sm">
                  <span>Target: {pillar.target_percentage}%</span>
                  <span className="text-text-secondary">Actual: {pillar.actual_percentage}%</span>
                </div>
                <div className="mt-2 h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pillar.actual_percentage, 100)}%`, backgroundColor: pillar.color_code }} />
                </div>
              </motion.div>
            ))}

            {/* Add Pillar Card */}
            <button onClick={() => { setEditingPillar(null); setPillarForm({ name: '', description: '', target_percentage: 25, color_code: '#6366F1' }); setShowPillarForm(true); }} className="card p-4 border-2 border-dashed border-white/10 hover:border-primary-500/50 transition-colors flex flex-col items-center justify-center gap-2 min-h-[150px]">
              <PlusIcon className="w-8 h-8 text-text-secondary" />
              <span className="text-sm text-text-secondary">Add Pillar</span>
            </button>
          </div>

          {/* Pillar Form Modal */}
          {showPillarForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPillarForm(false)}>
              <div className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">{editingPillar ? 'Edit Pillar' : 'New Content Pillar'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input type="text" className="input w-full" value={pillarForm.name} onChange={(e) => setPillarForm({ ...pillarForm, name: e.target.value })} placeholder="e.g. Educational, Promotional" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea className="input w-full" rows={2} value={pillarForm.description} onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target Percentage: {pillarForm.target_percentage}%</label>
                    <input type="range" min="5" max="80" className="w-full" value={pillarForm.target_percentage} onChange={(e) => setPillarForm({ ...pillarForm, target_percentage: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Color</label>
                    <input type="color" value={pillarForm.color_code} onChange={(e) => setPillarForm({ ...pillarForm, color_code: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowPillarForm(false)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleCreatePillar} className="btn-primary flex-1">{editingPillar ? 'Update' : 'Create'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'competitors' && (
        <div className="space-y-6">
          {/* Actions Bar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {competitors.length > 0 && (
                <button
                  onClick={() => handleAnalyzeCompetitor()}
                  disabled={analyzingAll}
                  className="btn-primary flex items-center gap-2"
                >
                  {analyzingAll ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                  {analyzingAll ? 'Analyzing...' : 'Analyze All Competitors'}
                </button>
              )}
            </div>
            <button onClick={() => setShowCompForm(true)} className="btn-secondary flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Add Competitor
            </button>
          </div>

          {/* Error */}
          {analysisError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {analysisError}
            </div>
          )}

          {competitors.length === 0 ? (
            <div className="card p-12 text-center">
              <GlobeAltIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
              <p className="text-text-secondary">No competitors added yet</p>
              <p className="text-xs text-text-secondary mt-1">Add competitor profiles to get AI-powered strategic insights</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Competitor Cards */}
              {competitors.map((comp) => {
                const compInsights = insights.filter(i => i.competitor === comp.handle_or_url);
                const isAnalyzing = analyzingId === comp.id;

                return (
                  <motion.div key={comp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
                    {/* Competitor Header */}
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                          <GlobeAltIcon className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="badge badge-primary text-xs capitalize">{comp.platform}</span>
                            <a href={getCompetitorUrl(comp.handle_or_url, comp.platform)} target="_blank" rel="noopener noreferrer"
                              className="font-medium text-sm text-primary-400 hover:underline flex items-center gap-1">
                              {comp.handle_or_url}
                              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {compInsights.length} insights
                            {comp.last_crawled_at && ` · Last analyzed: ${new Date(comp.last_crawled_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAnalyzeCompetitor(comp.id)}
                          disabled={isAnalyzing}
                          className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                        >
                          {isAnalyzing ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-400" />
                          ) : (
                            <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                          )}
                          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                        </button>
                        <button
                          onClick={async () => { if (confirm('Delete this competitor?')) { await strategyService.deleteCompetitor(comp.id); loadData(); }}}
                          className="btn-icon p-1.5 text-red-400 hover:bg-red-400/10"
                        >
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
                                  {insight.angle && (
                                    <p className="text-xs text-text-secondary mt-1">Angle: {insight.angle}</p>
                                  )}
                                  {insight.based_on && (
                                    <p className="text-xs text-text-secondary mt-1 italic">Based on: {insight.based_on}</p>
                                  )}
                                  {insight.recommendation && (
                                    <p className="text-xs text-primary-400 mt-1">Action: {insight.recommendation}</p>
                                  )}
                                  <a href={insight.source_url || getCompetitorUrl(insight.competitor, insight.platform)} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary-400/70 hover:text-primary-400 mt-2 transition-colors">
                                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                    {insight.source_url || insight.competitor}
                                  </a>
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

                    {/* No insights yet */}
                    {compInsights.length === 0 && (
                      <div className="p-6 text-center">
                        <p className="text-sm text-text-secondary">No insights yet. Click "Analyze" to get AI-powered insights.</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Add Competitor Modal */}
          {showCompForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCompForm(false)}>
              <div className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">Add Competitor</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Platform</label>
                    <select className="input w-full" value={compForm.platform} onChange={(e) => setCompForm({ ...compForm, platform: e.target.value })}>
                      <option value="twitter">Twitter/X</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="website">Website</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Handle or URL</label>
                    <input type="text" className="input w-full" value={compForm.handle_or_url} onChange={(e) => setCompForm({ ...compForm, handle_or_url: e.target.value })} placeholder={compForm.platform === 'website' ? 'https://example.com' : '@handle or profile URL'} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowCompForm(false)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleAddCompetitor} className="btn-primary flex-1">Add</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dna' && (
        <div className="space-y-6">
          {/* URL Input + Generate Button */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BeakerIcon className="w-5 h-5 text-primary-400" />
              Brand DNA Generator
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Enter your website URL and we'll analyze it to extract your brand's identity, tone, products, values, and more.
            </p>
            <div className="flex gap-3">
              <input
                type="url"
                className="input flex-1"
                value={dnaUrl}
                onChange={(e) => setDnaUrl(e.target.value)}
                placeholder="https://your-website.com"
              />
              <button
                onClick={handleGenerateDNA}
                disabled={dnaLoading || !dnaUrl.trim()}
                className="btn-primary flex items-center gap-2 px-6"
              >
                {dnaLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <SparklesIcon className="w-4 h-4" />
                )}
                {dnaLoading ? 'Generating...' : dnaData ? 'Reanalyze' : 'Generate DNA'}
              </button>
            </div>
            {dnaGeneratedAt && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-text-secondary flex items-center gap-1">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" />
                  Last generated: {new Date(dnaGeneratedAt).toLocaleString()}
                </p>
                <button onClick={handleLoadDNAHistory} className="text-xs text-primary-400 hover:underline flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  DNA History
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {dnaError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {dnaError}
            </div>
          )}

          {/* DNA Results */}
          {dnaData && (
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

              {/* Products/Services */}
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

              {/* USP + Values + Keywords Row */}
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
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    {dnaData.website_url}
                  </a>
                </div>
              )}
            </motion.div>
          )}

          {/* Empty State */}
          {!dnaData && !dnaLoading && (
            <div className="card p-12 text-center">
              <BeakerIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
              <p className="text-text-secondary">Enter your website URL above and click "Generate DNA"</p>
              <p className="text-xs text-text-secondary mt-1">AI will analyze your website and extract your brand's identity</p>
            </div>
          )}
        </div>
      )}

      {/* ===== TRENDING TAB ===== */}
      {activeTab === 'trending' && (
        <div className="space-y-6">
          {/* Generate Button */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FireIcon className="w-5 h-5 text-orange-400" />
                  Trending Topics
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Discover trending topics relevant to your brand using Google Trends + AI analysis
                </p>
              </div>
              <button
                onClick={handleGenerateTrending}
                disabled={trendingLoading}
                className="btn-primary flex items-center gap-2"
              >
                {trendingLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <ArrowPathIcon className="w-4 h-4" />
                )}
                {trendingLoading ? 'Analyzing Trends...' : 'Generate Trending'}
              </button>
            </div>
            {!dnaData && (
              <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
                Tip: Generate your Brand DNA first for more relevant trending results.
              </p>
            )}
          </div>

          {trendingError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {trendingError}
            </div>
          )}

          {/* Loading */}
          {trendingLoading && (
            <div className="card p-12 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-muted mt-3 text-sm">Fetching Google Trends & analyzing with AI...</p>
              <p className="text-text-muted text-xs mt-1">This may take 15-30 seconds</p>
            </div>
          )}

          {/* Topic Cards */}
          {!trendingLoading && trendingTopics.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">{trendingTopics.length} trending topics found</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {trendingTopics.map((topic, idx) => (
                  <motion.div
                    key={topic.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`card p-4 hover:border-white/10 transition-colors ${
                      topic.category === 'seasonal' || topic.category === 'cultural'
                        ? 'border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-orange-400 text-xs font-bold">#{idx + 1}</span>
                        <h4 className="font-semibold text-sm text-text-primary truncate">{topic.topic}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {topic.category && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${
                            topic.category === 'seasonal' ? 'bg-purple-500/20 text-purple-400' :
                            topic.category === 'cultural' ? 'bg-pink-500/20 text-pink-400' :
                            topic.category === 'viral' ? 'bg-cyan-500/20 text-cyan-400' :
                            topic.category === 'evergreen' ? 'bg-green-500/20 text-green-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {topic.category}
                          </span>
                        )}
                        {topic.volume_score != null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            topic.volume_score >= 80 ? 'bg-red-500/20 text-red-400' :
                            topic.volume_score >= 50 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {topic.volume_score >= 80 ? 'Hot' : topic.volume_score >= 50 ? 'Rising' : 'Emerging'}
                          </span>
                        )}
                      </div>
                    </div>
                    {topic.relevance_explanation && (
                      <p className="text-xs text-text-secondary mb-3">{topic.relevance_explanation}</p>
                    )}
                    {topic.volume_score != null && (
                      <div className="mb-3">
                        <div className="h-1 bg-dark-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              topic.volume_score >= 80 ? 'bg-red-500' : topic.volume_score >= 50 ? 'bg-orange-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(topic.volume_score, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!trendingLoading && trendingTopics.length === 0 && !trendingError && (
            <div className="card p-12 text-center">
              <FireIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
              <p className="text-text-secondary">No trending topics yet</p>
              <p className="text-xs text-text-secondary mt-1">Click "Generate Trending" to discover what's trending for your brand</p>
            </div>
          )}
        </div>
      )}

      {/* ===== DNA HISTORY MODAL ===== */}
      {showDnaHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDnaHistory(false)}>
          <div className="card p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-primary-400" />
              DNA Generation History
            </h3>
            {dnaHistory.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">No history found.</p>
            ) : (
              <div className="space-y-3">
                {dnaHistory.map((entry) => (
                  <div key={entry.id} className={`rounded-lg p-3 border ${entry.is_active ? 'border-primary-500/50 bg-primary-500/5' : 'border-white/5 bg-dark-700/30'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {entry.dna_data?.brand_name || 'Brand DNA'}
                          {entry.is_active && <span className="ml-2 text-xs text-primary-400">(Active)</span>}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {entry.source || 'website'} &middot; {new Date(entry.generated_at).toLocaleString()}
                        </p>
                        {entry.website_url && (
                          <p className="text-xs text-text-muted mt-0.5 truncate">{entry.website_url}</p>
                        )}
                      </div>
                      {!entry.is_active && (
                        <button onClick={() => handleRestoreDNA(entry.id)} className="btn-secondary text-xs px-3 py-1.5">
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowDnaHistory(false)} className="btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StrategyHubPage;
