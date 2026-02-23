import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LightBulbIcon, ArrowPathIcon, CalendarDaysIcon,
  FunnelIcon, SparklesIcon, FireIcon, CheckCircleIcon,
  TrashIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline';
import strategyService from '../services/strategyService';
import api from '../services/api';

interface Idea {
  id: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  goal: string;
  content_format: string;
  pillar_name: string;
  engagement_tier: string;
  source: string;
  status: string;
}

interface TrendingTopic {
  id: number;
  platform: string;
  topic: string;
  volume_score: number;
  region: string;
}

export function IdeasHubPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);

  // Filters
  const [platform, setPlatform] = useState('all');
  const [count, setCount] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await api.get('/brands/');
        const brands = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (brands.length > 0) {
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          setBrandId(primary.id);
        }
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      }
    };
    fetchBrand();
    loadTrending();
  }, []);

  // Load existing ideas when brandId is set
  useEffect(() => {
    if (brandId) loadExistingIdeas();
  }, [brandId]);

  const loadExistingIdeas = async () => {
    if (!brandId) return;
    try {
      const res = await api.get('/content-ideas/', { params: { brand: brandId } });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      // Map DB fields to component interface
      const mapped: Idea[] = data.map((item: any) => ({
        id: item.id,
        title: item.title || '',
        hook: item.hook || '',
        angle: item.angle || '',
        platform: item.platform || '',
        goal: item.goal || '',
        content_format: item.content_format || '',
        pillar_name: item.pillar_name || '',
        engagement_tier: item.engagement_tier || '',
        source: item.source || '',
        status: item.status || 'new',
      }));
      setIdeas(mapped);
    } catch (err) {
      console.error('Failed to load existing ideas:', err);
    }
  };

  const loadTrending = async () => {
    try {
      const data = await strategyService.getTrending();
      setTrending(data);
    } catch (err) {
      console.error('Failed to load trending:', err);
    }
  };

  const handleGenerate = async () => {
    if (!brandId) {
      setError('No brand found. Please set up your brand first.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await strategyService.generateIdeas({
        brand_id: brandId,
        platform: platform !== 'all' ? platform : undefined,
        count,
      });
      if (result.ideas) {
        setIdeas(prev => [...result.ideas, ...prev]);
        setSuccess(`${result.ideas.length} new ideas generated!`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to generate ideas. Please try again.';
      setError(msg);
      console.error('Failed to generate ideas:', err);
    }
    setLoading(false);
  };

  const handleAddToCalendar = async (ideaId: number, editAfter = false) => {
    try {
      const result = await strategyService.addIdeaToCalendar(ideaId);
      setIdeas(ideas.map(i => i.id === ideaId ? { ...i, status: 'used' } : i));
      if (editAfter && result.post_id) {
        navigate(`/posts/${result.post_id}/edit`);
      } else {
        setSuccess(`Idea added to calendar as draft (Post #${result.post_id})`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to add to calendar.';
      setError(msg);
      console.error('Failed to add to calendar:', err);
    }
  };

  const handleRegenerate = async (ideaId: number) => {
    if (!brandId) return;
    setRegeneratingId(ideaId);
    setError(null);
    try {
      const oldIdea = ideas.find(i => i.id === ideaId);
      const result = await strategyService.generateIdeas({
        brand_id: brandId,
        platform: oldIdea?.platform?.toLowerCase() || undefined,
        count: 1,
      });
      if (result.ideas && result.ideas.length > 0) {
        const newIdea = result.ideas[0];
        setIdeas(ideas.map(i => i.id === ideaId ? { ...newIdea } : i));
        // Delete old idea from DB
        try { await api.delete(`/content-ideas/${ideaId}/`); } catch {}
        setSuccess('Idea regenerated!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to regenerate idea.';
      setError(msg);
    }
    setRegeneratingId(null);
  };

  const handleDeleteIdea = async (ideaId: number) => {
    try {
      await api.delete(`/content-ideas/${ideaId}/`);
      setIdeas(ideas.filter(i => i.id !== ideaId));
    } catch (err) {
      console.error('Failed to delete idea:', err);
    }
  };

  const tierColors: Record<string, string> = {
    high: 'text-green-400 bg-green-400/10',
    mid: 'text-yellow-400 bg-yellow-400/10',
    low: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ideas Hub</h1>
          <p className="text-text-secondary mt-1">Generate and manage content ideas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2">
            <FunnelIcon className="w-4 h-4" /> Filters
          </button>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <SparklesIcon className="w-4 h-4" />
            )}
            {loading ? 'Generating...' : 'Generate Ideas'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="card p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Platform</label>
              <select className="input w-full text-sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="all">All Platforms</option>
                <option value="twitter">Twitter/X</option>
                <option value="linkedin">LinkedIn</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Count</label>
              <select className="input w-full text-sm" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                <option value={10}>10 Ideas</option>
                <option value={20}>20 Ideas</option>
                <option value={50}>50 Ideas</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Success message */}
      {success && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400 flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5" />
          {success}
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Generated Ideas */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LightBulbIcon className="w-5 h-5 text-yellow-400" />
            AI-Generated Ideas
            {ideas.length > 0 && <span className="text-sm text-text-secondary font-normal">({ideas.length})</span>}
          </h2>

          {ideas.length === 0 ? (
            <div className="card p-12 text-center">
              <SparklesIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
              <p className="text-text-secondary">Click "Generate Ideas" to get started</p>
              <p className="text-xs text-text-secondary mt-1">Ideas are generated based on your brand DNA and content pillars</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ideas.map((idea, idx) => (
                <motion.div key={idea.id || idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                  className={`card p-4 ${idea.status === 'used' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {idea.platform && <span className="badge badge-primary text-xs">{idea.platform}</span>}
                        {idea.content_format && <span className="badge text-xs">{idea.content_format}</span>}
                        {idea.pillar_name && <span className="text-xs text-text-secondary">· {idea.pillar_name}</span>}
                        {idea.engagement_tier && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${tierColors[idea.engagement_tier] || ''}`}>
                            {idea.engagement_tier}
                          </span>
                        )}
                        {idea.status === 'used' && (
                          <span className="text-xs px-2 py-0.5 rounded-full text-green-400 bg-green-400/10 flex items-center gap-1">
                            <CheckCircleIcon className="w-3 h-3" /> In Calendar
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium">{idea.title}</h4>
                      {idea.hook && <p className="text-sm text-primary-400 mt-1">Hook: {idea.hook}</p>}
                      {idea.angle && <p className="text-xs text-text-secondary mt-1">Angle: {idea.angle}</p>}
                      {idea.goal && <p className="text-xs text-text-secondary mt-0.5">Goal: {idea.goal}</p>}
                    </div>
                    <div className="flex gap-1 ml-3">
                      {idea.status !== 'used' && (
                        <>
                          <button onClick={() => handleAddToCalendar(idea.id, true)} className="btn-icon p-1.5 hover:text-green-400" title="Add to Calendar & Edit">
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleAddToCalendar(idea.id)} className="btn-icon p-1.5 hover:text-blue-400" title="Add to Calendar">
                            <CalendarDaysIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleRegenerate(idea.id)}
                        disabled={regeneratingId === idea.id}
                        className="btn-icon p-1.5 hover:text-primary-400"
                        title="Regenerate"
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${regeneratingId === idea.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => handleDeleteIdea(idea.id)} className="btn-icon p-1.5 hover:text-red-400" title="Delete">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Trending Topics Sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FireIcon className="w-5 h-5 text-orange-400" />
            Trending Topics
          </h2>

          {trending.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-text-secondary">No trending topics available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trending.map((topic) => (
                <div key={topic.id} className="card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{topic.topic}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="badge text-xs">{topic.platform}</span>
                        <span className="text-xs text-text-secondary">{topic.region}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary-400">{Math.round(topic.volume_score)}</span>
                      <p className="text-xs text-text-secondary">score</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IdeasHubPage;
