/**
 * InstagramContentPage — /instagram-content
 * ==========================================
 * Manage published Instagram content retrieved via the Instagram Graph API.
 * Demonstrates: instagram_basic (account profile + media read) and
 * instagram_manage_contents (delete).
 *
 * Features:
 *  - Show the connected account's profile: username, ID, picture, follower/post counts
 *  - View all published Instagram media (images, videos, carousels)
 *  - See per-post engagement: likes, comments, reach, impressions
 *  - Delete a published post or reel (instagram_manage_contents)
 *  - Filter by media type and date
 *
 * Backend endpoint needed:
 *   GET /api/v1/instagram/content/
 *     returns: { media: InstagramMedia[], cursor: string | null }
 *   DELETE /api/v1/instagram/content/<media_id>/delete/
 *     permanently deletes the media item from Instagram
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
  TrashIcon,
  ExclamationCircleIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Spinner, ConfirmModal, HelpButton } from '../components/ui';
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
}

/** instagram_basic — profile metadata for the connected IG Business account. */
interface InstagramProfile {
  id: string | null;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

const igContentService = {
  async getMedia(params?: { after?: string; media_type?: string }): Promise<{
    media: InstagramMedia[];
    next_cursor: string | null;
    profile: InstagramProfile | null;
  }> {
    const res = await api.get('/instagram/content/', { params });
    return res.data;
  },
  async deleteMedia(mediaId: string): Promise<void> {
    await api.delete(`/instagram/content/${mediaId}/delete/`);
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
  onDelete,
  archiving,
}: {
  item: InstagramMedia;
  viewMode: 'grid' | 'list';
  onDelete: () => void;
  archiving: boolean;
}) {
  const Icon = MEDIA_TYPE_ICON[item.media_type];
  const thumb = item.thumbnail_url || item.media_url;

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
          'bg-[#1A1A2E] border-white/8 hover:border-white/20'
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
          <button
            onClick={onDelete}
            disabled={archiving}
            title="Permanently delete this post from Instagram"
            aria-label="Delete this post from Instagram"
            className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // Grid mode
  return (
    <motion.div
      layout
      className={`rounded-xl overflow-hidden border group transition-all ${
        'border-white/8 hover:border-white/25'
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
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={archiving}
              title="Permanently delete this post from Instagram"
              aria-label="Delete this post from Instagram"
              className="p-2 rounded-lg bg-danger/40 text-white hover:bg-danger/60 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
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
  // Deleting is permanent and hits the real Instagram account, so it is
  // confirmed before anything is sent.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const fetchMedia = useCallback(async (cursor?: string) => {
    if (!cursor) { setLoading(true); setMedia([]); }
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await igContentService.getMedia({ after: cursor });
      setMedia((prev) => cursor ? [...prev, ...(res.media || [])] : (res.media || []));
      setNextCursor(res.next_cursor);
      // Profile only comes back on the first page; keep it across "Load more".
      if (res.profile) { setProfile(res.profile); setAvatarFailed(false); }
    } catch {
      setError('Could not load Instagram content. Make sure your Instagram Business account is connected.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const handleDelete = async (mediaId: string) => {
    setArchivingId(mediaId);
    setDeleteError(null);
    try {
      await igContentService.deleteMedia(mediaId);
      // The post no longer exists on Instagram, so it leaves the grid. It used
      // to be dimmed and left in place, which read as "archived, recoverable".
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setConfirmId(null);
    } catch (err: unknown) {
      // Previously the failure path was silent: a rejected delete still marked
      // the item archived, so a failure looked exactly like a success.
      let message = 'Could not delete this post from Instagram.';
      if (err && typeof err === 'object' && 'response' in err) {
        const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
        const detail = data?.error ?? data?.detail;
        if (typeof detail === 'string' && detail) message = detail;
      }
      setDeleteError(message);
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
  // No Total Reach tile: the media list endpoint never returns `reach`, so it
  // only ever rendered "—".

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
          <HelpButton
            title="Refresh"
            body={<>Reloads your <strong>latest Instagram posts</strong> and their like
              and comment counts.</>}
          />
        </div>
      </div>

      {/* Connected account profile — instagram_basic (username, ID, picture, counts) */}
      {profile && (profile.username || profile.profile_picture_url) && (
        <div
          className="flex items-center gap-4 bg-[#1A1A2E] border border-white/10 rounded-xl p-4"
          title="The Instagram Business account these posts belong to"
        >
          {profile.profile_picture_url && !avatarFailed ? (
            <img
              src={profile.profile_picture_url}
              alt={`${profile.username ?? 'Instagram'} profile picture`}
              title="Instagram profile picture"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              width={96}
              height={96}
              decoding="async"
              className="w-24 h-24 rounded-full object-cover border-2 border-coral/40 bg-[#12121F] shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#12121F] border-2 border-coral/40 flex items-center justify-center shrink-0">
              <PhotoIcon className="w-10 h-10 text-coral" />
            </div>
          )}

          <div className="min-w-0">
            <p className="text-lg font-semibold text-text-primary truncate">
              {profile.username ? `@${profile.username}` : 'Instagram Business account'}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-text-secondary">
              {profile.followers_count != null && (
                <span title="Followers of this Instagram Business account">
                  <strong className="text-text-primary">
                    {profile.followers_count.toLocaleString()}
                  </strong>{' '}
                  followers
                </span>
              )}
              {profile.media_count != null && (
                <span title="Total posts published by this account">
                  <strong className="text-text-primary">
                    {profile.media_count.toLocaleString()}
                  </strong>{' '}
                  posts
                </span>
              )}
              {profile.id && (
                <span className="text-text-muted" title="Instagram Business account ID">
                  ID: {profile.id}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permission banner */}
      <div className="flex items-start gap-3 bg-pink-500/10 border border-pink-500/20 rounded-xl p-4">
        <PhotoIcon className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-pink-300">instagram_basic · instagram_manage_contents active</p>
          <p className="text-xs text-pink-400/80 mt-0.5">
            SellAnto reads your Instagram Business account's published media — captions, thumbnails, publish dates and engagement counts — so you can review everything you have posted in one place, and remove content that no longer aligns with your strategy.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {deleteError && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-danger">Could not delete the post</p>
            <p className="text-xs text-danger/80 mt-0.5">{deleteError}</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {!loading && media.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Posts', value: media.length, icon: PhotoIcon, color: 'text-coral' },
            { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: HeartIcon, color: 'text-pink-400' },
            { label: 'Total Comments', value: totalComments.toLocaleString(), icon: ChatBubbleOvalLeftIcon, color: 'text-blue-400' },
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
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <TrashIcon className="w-4 h-4 text-danger" />
          Delete
          <HelpButton
            title="Delete post"
            body={<>The bin icon on a post <strong>deletes it from your Instagram
              account</strong>. SellAnto asks you to confirm first.</>}
            warning={<><strong>Cannot be undone</strong> — the post is deleted on Instagram,
              not just hidden here.</>}
          />
        </div>
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

      <ConfirmModal
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && handleDelete(confirmId)}
        title="Delete this Instagram post?"
        message="This permanently deletes the post from your Instagram account. It cannot be undone, and SellAnto cannot restore it."
        confirmText="Delete from Instagram"
        isLoading={!!archivingId}
      />

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
                    onDelete={() => setConfirmId(item.id)}
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
                    onDelete={() => setConfirmId(item.id)}
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
