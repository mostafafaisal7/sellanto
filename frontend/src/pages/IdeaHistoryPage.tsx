import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  TrashIcon,
  CalendarDaysIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import strategyService from '../services/strategyService';
import type { IdeaHistoryItem } from '../types';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  saved: 'bg-green-500/20 text-green-400',
  skipped: 'bg-gray-500/20 text-gray-400',
  drafted: 'bg-purple-500/20 text-purple-400',
  scheduled: 'bg-amber-500/20 text-amber-400',
  used: 'bg-emerald-500/20 text-emerald-400',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  facebook: '#1877F2',
  instagram: '#E4405F',
};

export function IdeaHistoryPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<IdeaHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (platformFilter) params.platform = platformFilter;
      const data = await strategyService.getIdeaHistory(params);
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadIdeas(); }, [statusFilter, platformFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadIdeas();
  };

  const handleAddToCalendar = async (ideaId: number) => {
    try {
      const result = await strategyService.addIdeaToCalendar(ideaId);
      navigate(`/posts/${result.post_id}/edit`);
    } catch { /* ignore */ }
  };

  const handleDelete = async (ideaId: number) => {
    try {
      const api = (await import('../services/api')).default;
      await api.delete(`/content-ideas/${ideaId}/`);
      setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <LightBulbIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Idea History</h1>
            <p className="text-sm text-text-secondary">Browse and reuse your previously generated ideas</p>
          </div>
        </div>
        <span className="text-sm text-text-muted">{ideas.length} ideas</span>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ideas..."
              className="input pl-9 w-full h-9 text-sm"
            />
          </form>

          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-9 text-sm min-w-[120px]"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="saved">Saved</option>
              <option value="drafted">Drafted</option>
              <option value="scheduled">Scheduled</option>
              <option value="skipped">Skipped</option>
            </select>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="input h-9 text-sm min-w-[120px]"
            >
              <option value="">All Platforms</option>
              <option value="twitter">Twitter/X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-muted mt-3 text-sm">Loading ideas...</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="card p-12 text-center">
          <LightBulbIcon className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No ideas found</p>
          <p className="text-text-muted text-sm mt-1">Generate ideas from the Ideas Hub to see them here</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {ideas.map((idea) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Platform color bar */}
                <div
                  className="w-1 h-16 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: PLATFORM_COLORS[idea.platform] || '#6366F1' }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-text-primary truncate">{idea.title}</h3>
                      <p className="text-sm text-text-secondary mt-1 line-clamp-2">{idea.hook}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAddToCalendar(idea.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Add to Calendar"
                      >
                        <CalendarDaysIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(idea.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${STATUS_COLORS[idea.status] || STATUS_COLORS.new}`}>
                      {idea.status}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-text-muted capitalize">
                      {idea.platform}
                    </span>
                    {idea.pillar_name && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-400">
                        {idea.pillar_name}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-text-muted capitalize">
                      {idea.content_format}
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">
                      {new Date(idea.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IdeaHistoryPage;
