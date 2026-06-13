/**
 * DiscoverPage — /discover
 * ========================
 * Instagram Public Content Access — search and explore public Instagram content.
 * Demonstrates: Instagram Public Content Access permission.
 *
 * Features:
 *  - Search public hashtags and browse top/recent media
 *  - Look up public Instagram Business profiles
 *  - Save inspiration / bookmark content for strategy
 *
 * Backend endpoints needed:
 *   GET /api/v1/instagram/discover/hashtag/?tag=<hashtag>
 *     returns: { hashtag: { id, name, media_count }, top_media: PublicMedia[], recent_media: PublicMedia[] }
 *   GET /api/v1/instagram/discover/profile/?username=<username>
 *     returns: { profile: PublicProfile, recent_media: PublicMedia[] }
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HashtagIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  HeartIcon,
  ChatBubbleOvalLeftIcon,
  BookmarkIcon,
  ShareIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  ClockIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { Button, Card, Spinner } from '../components/ui';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  like_count: number;
  comments_count: number;
  timestamp: string;
  owner_username?: string;
}

interface HashtagResult {
  hashtag: { id: string; name: string; media_count: number };
  top_media: PublicMedia[];
  recent_media: PublicMedia[];
}

interface PublicProfile {
  id: string;
  username: string;
  name: string;
  biography: string;
  followers_count: number;
  media_count: number;
  profile_picture_url?: string;
  website?: string;
}

interface ProfileResult {
  profile: PublicProfile;
  recent_media: PublicMedia[];
}

// ── Service ───────────────────────────────────────────────────────────────────

const discoverService = {
  async searchHashtag(tag: string): Promise<HashtagResult> {
    const res = await api.get('/instagram/discover/hashtag/', { params: { tag: tag.replace(/^#/, '') } });
    return res.data;
  },
  async searchProfile(username: string): Promise<ProfileResult> {
    const res = await api.get('/instagram/discover/profile/', { params: { username: username.replace(/^@/, '') } });
    return res.data;
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PublicMediaCard({ item, onSave, saved }: { item: PublicMedia; onSave: () => void; saved: boolean }) {
  const thumb = item.thumbnail_url || item.media_url;

  return (
    <div className="rounded-xl overflow-hidden border border-white/8 group hover:border-white/20 transition-all bg-[#1A1A2E]">
      <div className="relative aspect-square bg-[#0E0E1A]">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.media_type === 'VIDEO'
              ? <VideoCameraIcon className="w-8 h-8 text-text-muted" />
              : <PhotoIcon className="w-8 h-8 text-text-muted" />
            }
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <a href={item.permalink} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <ShareIcon className="w-4 h-4" />
          </a>
          <button
            onClick={onSave}
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            {saved ? <BookmarkSolidIcon className="w-4 h-4 text-yellow-400" /> : <BookmarkIcon className="w-4 h-4" />}
          </button>
        </div>
        {item.media_type === 'VIDEO' && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-[9px] text-white flex items-center gap-0.5">
            <VideoCameraIcon className="w-2.5 h-2.5" /> VIDEO
          </div>
        )}
      </div>
      <div className="p-2.5">
        {item.owner_username && (
          <p className="text-[10px] text-coral mb-1">@{item.owner_username}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-0.5"><HeartIcon className="w-3 h-3" />{item.like_count.toLocaleString()}</span>
          <span className="flex items-center gap-0.5"><ChatBubbleOvalLeftIcon className="w-3 h-3" />{item.comments_count.toLocaleString()}</span>
          <span className="flex items-center gap-0.5 ml-auto"><ClockIcon className="w-3 h-3" />{new Date(item.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type SearchMode = 'hashtag' | 'profile';

export function DiscoverPage() {
  const [mode, setMode] = useState<SearchMode>('hashtag');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hashtagResult, setHashtagResult] = useState<HashtagResult | null>(null);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [mediaTab, setMediaTab] = useState<'top' | 'recent'>('top');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setHashtagResult(null);
    setProfileResult(null);
    try {
      if (mode === 'hashtag') {
        const res = await discoverService.searchHashtag(query.trim());
        setHashtagResult(res);
      } else {
        const res = await discoverService.searchProfile(query.trim());
        setProfileResult(res);
      }
    } catch {
      setError(`Could not find ${mode === 'hashtag' ? 'hashtag' : 'profile'}. Make sure your Instagram Business account is connected with Public Content Access.`);
    } finally {
      setLoading(false);
    }
  }, [query, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const displayMedia = hashtagResult
    ? (mediaTab === 'top' ? hashtagResult.top_media : hashtagResult.recent_media)
    : profileResult?.recent_media ?? [];

  // Trending hashtag suggestions
  const suggestions = ['#marketing', '#business', '#entrepreneur', '#socialmedia', '#branding', '#digital', '#content', '#growth'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <SparklesIcon className="w-7 h-7 text-coral" />
          Discover
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Explore public Instagram content — search hashtags and profiles for competitive research and inspiration.
        </p>
      </div>

      {/* Permission banner */}
      <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
        <HashtagIcon className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-purple-300">Instagram Public Content Access active</p>
          <p className="text-xs text-purple-400/80 mt-0.5">
            SellAnto uses Instagram Public Content Access to search public hashtags and business profiles, enabling competitive research and content inspiration directly within your workflow.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <Card className="p-5 space-y-4">
        {/* Mode selector */}
        <div className="flex items-center gap-1 bg-[#0E0E1A] border border-white/10 rounded-lg p-1 w-fit">
          {([['hashtag', HashtagIcon, 'Hashtag'], ['profile', UserCircleIcon, 'Profile']] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setQuery(''); setHashtagResult(null); setProfileResult(null); setError(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-coral text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">
              {mode === 'hashtag' ? '#' : '@'}
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'hashtag' ? 'Enter hashtag (e.g. marketing)' : 'Enter username (e.g. sellanto)'}
              className="w-full pl-7 pr-4 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-coral/50"
            />
          </div>
          <Button variant="primary" onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Spinner className="w-4 h-4" /> : <MagnifyingGlassIcon className="w-4 h-4" />}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>

        {/* Quick hashtag suggestions */}
        {mode === 'hashtag' && !hashtagResult && !loading && (
          <div>
            <p className="text-xs text-text-muted mb-2">Popular suggestions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setQuery(tag.replace('#', '')); }}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#0E0E1A] border border-white/10 text-text-secondary hover:text-coral hover:border-coral/30 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center py-16"
          >
            <Spinner className="w-8 h-8 text-coral" />
          </motion.div>
        )}

        {/* Hashtag results */}
        {hashtagResult && !loading && (
          <motion.div key="hashtag" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Hashtag info */}
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-coral/15 rounded-xl flex items-center justify-center">
                  <HashtagIcon className="w-5 h-5 text-coral" />
                </div>
                <div>
                  <p className="text-base font-bold text-text-primary">#{hashtagResult.hashtag.name}</p>
                  <p className="text-xs text-text-muted">{hashtagResult.hashtag.media_count.toLocaleString()} posts</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <ChartBarIcon className="w-3.5 h-3.5" />
                  {hashtagResult.top_media.length} top · {hashtagResult.recent_media.length} recent
                </span>
              </div>
            </Card>

            {/* Tab selector */}
            <div className="flex items-center gap-1 bg-[#1A1A2E] border border-white/10 rounded-lg p-1 w-fit">
              {(['top', 'recent'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMediaTab(t)}
                  className={`px-3 py-1 rounded text-sm font-medium capitalize transition-colors ${
                    mediaTab === t ? 'bg-coral text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t === 'top' ? '⭐ Top Posts' : '🕐 Recent Posts'}
                </button>
              ))}
            </div>

            {/* Media grid */}
            {displayMedia.length === 0 ? (
              <Card className="p-10 text-center">
                <PhotoIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">No media found for this hashtag.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {displayMedia.map((item) => (
                  <PublicMediaCard
                    key={item.id}
                    item={item}
                    onSave={() => toggleSave(item.id)}
                    saved={savedIds.has(item.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Profile results */}
        {profileResult && !loading && (
          <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Profile card */}
            <Card className="p-5">
              <div className="flex items-start gap-4">
                {profileResult.profile.profile_picture_url ? (
                  <img
                    src={profileResult.profile.profile_picture_url}
                    alt={profileResult.profile.username}
                    className="w-16 h-16 rounded-full object-cover border border-white/15"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-coral/20 flex items-center justify-center">
                    <UserCircleIcon className="w-8 h-8 text-coral" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-text-primary">{profileResult.profile.name}</p>
                  <p className="text-sm text-coral">@{profileResult.profile.username}</p>
                  {profileResult.profile.biography && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">{profileResult.profile.biography}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-text-primary">{profileResult.profile.followers_count.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-text-primary">{profileResult.profile.media_count.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">Posts</p>
                    </div>
                    {profileResult.profile.website && (
                      <a href={profileResult.profile.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-coral hover:underline truncate max-w-[120px]"
                      >
                        {profileResult.profile.website}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Recent media */}
            {profileResult.recent_media.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  Recent Posts
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {profileResult.recent_media.map((item) => (
                    <PublicMediaCard
                      key={item.id}
                      item={item}
                      onSave={() => toggleSave(item.id)}
                      saved={savedIds.has(item.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved items counter */}
      {savedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-coral text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium cursor-pointer hover:bg-coral/90 transition-colors"
          onClick={() => setSavedIds(new Set())}
        >
          <BookmarkSolidIcon className="w-4 h-4" />
          {savedIds.size} saved · Clear
        </motion.div>
      )}
    </div>
  );
}
