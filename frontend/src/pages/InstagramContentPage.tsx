/**
 * InstagramContentPage — /instagram-content
 * ==========================================
 * Manage published Instagram content retrieved via the Instagram Graph API.
 * Demonstrates: instagram_manage_contents permission.
 *
 * Features:
 *  - View all published Instagram media (images, videos, carousels)
 *  - See per-post engagement: likes, comments, reach, impressions
 *  - Archive / hide media (using IG manage_contents permission)
 *  - Filter by media type and date
 *
 * Backend endpoint needed:
 *   GET /api/v1/instagram/content/
 *     returns: { media: InstagramMedia[], cursor: string | null }
 *   POST /api/v1/instagram/content/<media_id>/archive/
 *     archives/hides the media item
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  VideoCameraIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  ChatBubbleOvalLeftIcon,
  EyeIcon,
  ArchiveBoxIcon,
  ExclamationCircleIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Spinner } from '../components/ui';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

interface InstagramMedia {
  id: string;
  media_type: MediaType;
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  reach?: number;
  impressions?: number;
  is_archived: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

const igContentService = {
  async getMedia(params?: { after?: string; media_type?: string }): Promise<{
    media: InstagramMedia[];
    next_cursor: string | null;
  }> {
    const res = await api.get('/instagram/content/', { params });
    return res.data;
  },
  async archiveMedia(mediaId: string): Promise<void> {
    await api.post(`/instagram/content/${mediaId}/archive/`);
  },
};

// ── Media card ────────────────────────────────────────────────────────────────

const MEDIA_TYPE_ICON: Record<MediaType, React.ElementType> = {
  IMAGE: PhotoIcon,
  VIDEO: VideoCameraIcon,
  CAROUSEL_ALBUM: ViewColumnsIcon,
};

function MediaCard({
  item,
  viewMode,
  onArchive,
  archiving,
}: {
  item: InstagramMedia;
  viewMode: 'grid' | 'list';
  onArchive: () => void;
  archiving: boolean;
}) {
  const Icon = MEDIA_TYPE_ICON[item.media_type];
  const thumb = item.thumbnail_url || item.media_url;

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
          item.is_archived ? 'opacity-40 bg-[#1A1A2E] border-white/5' : 'bg-[#1A1A2E] border-white/8 hover:border-white/20'
        }`}
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#0E0E1A] border border-white/8 shrink-0">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon className="w-6 h-6 text-text-muted" />
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary line-clamp-2 leading-snug">
            {item.caption || '(no caption)'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-text-muted bg-[#0E0E1A] px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Icon className="w-3 h-3" />
              {item.media_type.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-text-muted">
              {new Date(item.timestamp).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 shrink-0 text-sm">
          <div className="text-center">
            <p className="font-bold text-text-primary">{item.like_count.toLocaleString()}</p>
            <p className="text-[10px] text-text-muted flex items-center gap-0.5"><HeartIcon className="w-3 h-3" /> Likes</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-text-primary">{item.comments_count.toLocaleString()}</p>
            <p className="text-[10px] text-text-muted flex items-center gap-0.5"><ChatBubbleOvalLeftIcon className="w-3 h-3" /> Comments</p>
          </div>
          {item.reach !== undefined && (
            <div className="text-center hidden sm:block">
              <p className="font-bold text-text-primary">{item.reach.toLocaleString()}</p>
              <p className="text-[10px] text-text-muted flex items-center gap-0.5"><EyeIcon className="w-3 h-3" /> Reach</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a href={item.permalink} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-lg bg-[#0E0E1A] text-text-muted hover:text-text-primary transition-colors"
          >
            <ShareIcon className="w-4 h-4" />
          </a>
          {!item.is_archived && (
            <button
              onClick={onArchive}
              disabled={archiving}
              className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
            >
              <ArchiveBoxIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Grid mode
  return (
    <motion.div
      layout
      className={`rounded-xl overflow-hidden border group transition-all ${
        item.is_archived ? 'opacity-40 border-white/5' : 'border-white/8 hover:border-white/25'
      }`}
    >
      <div className="relative aspect-square bg-[#0E0E1A]">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-10 h-10 text-text-muted" />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-4 text-white text-sm">
            <span className="flex items-center gap-1"><HeartIcon className="w-4 h-4" />{item.like_count}</span>
            <span className="flex items-center gap-1"><ChatBubbleOvalLeftIcon className="w-4 h-4" />{item.comments_count}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={item.permalink} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ShareIcon className="w-4 h-4" />
            </a>
            {!item.is_archived && (
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(); }}
                disabled={archiving}
                className="p-2 rounded-lg bg-yellow-500/30 text-yellow-300 hover:bg-yellow-500/50 transition-colors"
              >
                <ArchiveBoxIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white flex items-center gap-0.5">
            <Icon className="w-2.5 h-2.5" />
            {item.media_type === 'CAROUSEL_ALBUM' ? 'ALBUM' : item.media_type}
          </span>
        </div>
      </div>
      <div className="p-2.5 bg-[#1A1A2E]">
        <p className="text-xs text-text-secondary line-clamp-1">{item.caption || '(no caption)'}</p>
        <p className="text-[10px] text-text-muted mt-0.5">{new Date(item.timestamp).toLocaleDateString()}</p>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function InstagramContentPage() {
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchMedia = useCallback(async (cursor?: string) => {
    if (!cursor) { setLoading(true); setMedia([]); }
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await igContentService.getMedia({ after: cursor });
      setMedia((prev) => cursor ? [...prev, ...(res.media || [])] : (res.media || []));
      setNextCursor(res.next_cursor);
    } catch {
      setError('Could not load Instagram content. Make sure your Instagram Business account is connected.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const handleArchive = async (mediaId: string) => {
    setArchivingId(mediaId);
    try {
      await igContentService.archiveMedia(mediaId);
      setMedia((prev) => prev.map((m) => m.id === mediaId ? { ...m, is_archived: true } : m));
    } finally {
      setArchivingId(null);
    }
  };

  const filtered = media.filter((m) => {
    const matchType = typeFilter === 'all' || m.media_type === typeFilter;
    const matchSearch = m.caption.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalLikes = media.reduce((s, m) => s + m.like_count, 0);
  const totalComments = media.reduce((s, m) => s + m.comments_count, 0);
  const totalReach = media.reduce((s, m) => s + (m.reach ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <PhotoIcon className="w-7 h-7 text-coral" />
            Instagram Content
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            View and manage all media published to your Instagram Business account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border transition-colors ${viewMode === 'grid' ? 'bg-coral/15 border-coral/30 text-coral' : 'bg-[#1A1A2E] border-white/10 text-text-muted hover:text-text-primary'}`}
          >
            <Squares2X2Icon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg border transition-colors ${viewMode === 'list' ? 'bg-coral/15 border-coral/30 text-coral' : 'bg-[#1A1A2E] border-white/10 text-text-muted hover:text-text-primary'}`}
          >
            <ViewColumnsIcon className="w-4 h-4" />
          </button>
          <Button variant="secondary" size="sm" onClick={() => fetchMedia()} className="flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Permission banner */}
      <div className="flex items-start gap-3 bg-pink-500/10 border border-pink-500/20 rounded-xl p-4">
        <PhotoIcon className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-pink-300">instagram_manage_contents active</p>
          <p className="text-xs text-pink-400/80 mt-0.5">
            SellAnto retrieves your published Instagram media, lets you view performance metrics per post, and can archive content that no longer aligns with your strategy.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* KPIs */}
      {!loading && media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Posts', value: media.length, icon: PhotoIcon, color: 'text-coral' },
            { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: HeartIcon, color: 'text-pink-400' },
            { label: 'Total Comments', value: totalComments.toLocaleString(), icon: ChatBubbleOvalLeftIcon, color: 'text-blue-400' },
            { label: 'Total Reach', value: totalReach > 0 ? totalReach.toLocaleString() : '—', icon: EyeIcon, color: 'text-green-400' },
          ].map((kpi) => (
            <Card key={kpi.label} className="p-4">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-xl font-bold text-text-primary">{kpi.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{kpi.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Search + type filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search captions…"
            className="w-full pl-9 pr-4 py-2 bg-[#1A1A2E] border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-coral/50"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#1A1A2E] border border-white/10 rounded-lg p-1">
          {['all', 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-coral text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t === 'all' ? 'All' : t === 'CAROUSEL_ALBUM' ? 'Albums' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Media grid/list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-8 h-8 text-coral" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <PhotoIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-sm font-medium text-text-primary">No Instagram content yet</p>
          <p className="text-xs text-text-muted mt-1">
            Posts published to your Instagram Business account via SellAnto or directly will appear here.
          </p>
        </Card>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
              >
                {filtered.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    viewMode="grid"
                    onArchive={() => handleArchive(item.id)}
                    archiving={archivingId === item.id}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {filtered.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    viewMode="list"
                    onArchive={() => handleArchive(item.id)}
                    archiving={archivingId === item.id}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchMedia(nextCursor)}
                disabled={loadingMore}
                className="flex items-center gap-2"
              >
                {loadingMore ? <Spinner className="w-4 h-4" /> : <ArrowPathIcon className="w-4 h-4" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
