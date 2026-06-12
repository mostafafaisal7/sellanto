/**
 * CommentsPage — /comments
 * ========================
 * Unified comment inbox across all Facebook Pages and Instagram Business accounts.
 * Uses the existing PostCommentInbox component for per-post comment management.
 *
 * Permissions demonstrated: instagram_manage_comments, pages_read_engagement
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationCircleIcon,
  PhotoIcon,
  VideoCameraIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, Spinner, PlatformIcon } from '../components/ui';
import { PostCommentInbox } from '../components/PostCommentInbox';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PostWithComments {
  id: number;
  caption: string;
  platform: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  comment_count: number;
  unreplied_count: number;
  media_type: 'image' | 'video' | 'text';
  thumbnail_url: string | null;
}

// ── Post selector card ────────────────────────────────────────────────────────

function PostCard({
  post,
  selected,
  onSelect,
}: {
  post: PostWithComments;
  selected: boolean;
  onSelect: () => void;
}) {
  const MediaIcon = post.media_type === 'video' ? VideoCameraIcon
    : post.media_type === 'image' ? PhotoIcon
    : DocumentTextIcon;

  return (
    <motion.button
      whileHover={{ x: 2 }}
      onClick={onSelect}
      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
        selected
          ? 'bg-coral/8 border-coral/30'
          : 'bg-[#1A1A2E] border-white/8 hover:border-white/20'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail / icon */}
        <div className="w-10 h-10 rounded-lg bg-[#0E0E1A] border border-white/8 flex items-center justify-center shrink-0 overflow-hidden">
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <MediaIcon className="w-5 h-5 text-text-muted" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-primary line-clamp-2 leading-snug">
            {post.caption || '(no caption)'}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <PlatformIcon platform={post.platform as never} className="w-3 h-3" />
            <span className="text-[10px] text-text-muted capitalize">{post.platform}</span>
            {post.published_at && (
              <span className="text-[10px] text-text-muted">
                · {new Date(post.published_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Comment badge */}
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold text-text-primary">{post.comment_count}</span>
          <p className="text-[10px] text-text-muted">comments</p>
          {post.unreplied_count > 0 && (
            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-coral/20 text-coral font-medium">
              {post.unreplied_count} new
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CommentsPage() {
  const [posts, setPosts] = useState<PostWithComments[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/posts/', { params: { status: 'posted', with_comments: true } });
      const data = res.data;
      const postList: PostWithComments[] = (data.results || data || []).map((p: Record<string, unknown>) => ({
        id: p.id as number,
        caption: (p.caption as string) || '',
        platform: (p.platform as string) || 'facebook',
        status: (p.status as string) || 'posted',
        scheduled_at: (p.scheduled_at as string) || null,
        published_at: (p.published_at as string) || null,
        comment_count: (p.comment_count as number) || 0,
        unreplied_count: (p.unreplied_count as number) || 0,
        media_type: ((p.media_type as string) || 'text') as PostWithComments['media_type'],
        thumbnail_url: (p.thumbnail_url as string) || null,
      }));
      setPosts(postList);
    } catch {
      setError('Could not load posts. Make sure your Facebook/Instagram account is connected.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const platforms = ['all', ...Array.from(new Set(posts.map((p) => p.platform)))];

  const filteredPosts = posts.filter((p) => {
    const matchPlatform = platformFilter === 'all' || p.platform === platformFilter;
    const matchSearch = p.caption.toLowerCase().includes(search.toLowerCase());
    return matchPlatform && matchSearch;
  });

  const totalComments = posts.reduce((s, p) => s + p.comment_count, 0);
  const totalUnreplied = posts.reduce((s, p) => s + p.unreplied_count, 0);
  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-7 h-7 text-coral" />
            Comments Inbox
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            View and reply to comments across all Facebook Pages and Instagram Business accounts.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchPosts} className="flex items-center gap-2">
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Permission banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-300">
            instagram_manage_comments · pages_read_engagement active
          </p>
          <p className="text-xs text-blue-400/80 mt-0.5">
            SellAnto reads comments from your Facebook and Instagram posts and lets you reply with AI-generated or manual responses — keeping your audience engaged in one place.
          </p>
        </div>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Posts with Comments', value: posts.filter((p) => p.comment_count > 0).length },
            { label: 'Total Comments', value: totalComments },
            { label: 'Awaiting Reply', value: totalUnreplied, highlight: totalUnreplied > 0 },
          ].map((kpi) => (
            <Card key={kpi.label} className={`p-4 text-center ${kpi.highlight ? 'border-coral/30' : ''}`}>
              <p className={`text-2xl font-bold ${kpi.highlight ? 'text-coral' : 'text-text-primary'}`}>
                {kpi.value}
              </p>
              <p className="text-xs text-text-muted mt-0.5">{kpi.label}</p>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-8 h-8 text-coral" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Post selector */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider px-1">
              Published Posts
            </h2>

            {/* Search + filter */}
            <div className="space-y-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search posts…"
                  className="w-full pl-9 pr-4 py-2 bg-[#1A1A2E] border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-coral/50"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <FunnelIcon className="w-3.5 h-3.5 text-text-muted" />
                {platforms.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize transition-colors ${
                      platformFilter === p
                        ? 'bg-coral text-white'
                        : 'bg-[#1A1A2E] text-text-muted border border-white/10 hover:text-text-primary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {filteredPosts.length === 0 ? (
              <Card className="p-8 text-center">
                <DocumentTextIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-medium text-text-primary">No published posts yet</p>
                <p className="text-xs text-text-muted mt-1">
                  Posts published via SellAnto appear here with their comment feeds.
                </p>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    selected={selectedPostId === post.id}
                    onSelect={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Comment inbox */}
          <div className="lg:col-span-3">
            {selectedPostId ? (
              <div className="space-y-3">
                {selectedPost && (
                  <div className="flex items-center gap-2 px-1">
                    <PlatformIcon platform={selectedPost.platform as never} className="w-4 h-4" />
                    <p className="text-sm text-text-secondary line-clamp-1">{selectedPost.caption}</p>
                  </div>
                )}
                <PostCommentInbox postId={selectedPostId} />
              </div>
            ) : (
              <Card className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <ChatBubbleLeftRightIcon className="w-14 h-14 text-text-muted mb-4" />
                <p className="text-sm font-medium text-text-primary">Select a post</p>
                <p className="text-xs text-text-muted mt-1 max-w-xs">
                  Choose a post from the left to view and manage its comment thread with AI-powered reply suggestions.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
