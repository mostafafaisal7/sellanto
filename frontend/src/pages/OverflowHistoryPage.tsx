import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { postService } from '../services/postService';
import ConnectAccountModal from '../components/ConnectAccountModal';
import type { Post, PlatformType } from '../types';

const platformEmoji: Record<string, string> = {
  linkedin: '💼',
  instagram: '📸',
  facebook: '📘',
  twitter: '🐦',
  tiktok: '🎵',
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#94a3b8', bg: 'rgba(255,255,255,0.08)' },
  scheduled: { label: 'Scheduled', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  posted: { label: 'Posted', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  posting: { label: 'Posting', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(255,255,255,0.06)' },
  pending_approval: { label: 'Pending', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  changes_requested: { label: 'Changes', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// Post card component (similar to MagicHistoryPage)
function OverflowPostCard({
  post,
  onConnectError,
  onRefresh,
}: {
  post: Post;
  onConnectError: (msg: string) => void;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const isDraft = post.status === 'draft';
  const isScheduled = post.status === 'scheduled';
  const isPosted = post.status === 'posted';
  const isFinal = isPosted || isScheduled;

  const platforms: PlatformType[] = Array.isArray(post.platforms) ? post.platforms : [];

  const downloadImagesAsFiles = async (): Promise<File[]> => {
    if (!post.media_files || post.media_files.length === 0) return [];
    try {
      const files: File[] = [];
      for (const url of post.media_files) {
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = url.split('.').pop()?.split('?')[0] || 'png';
        files.push(new File([blob], `image-${files.length}.${ext}`, { type: blob.type || 'image/png' }));
      }
      return files;
    } catch {
      return [];
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPostError(null);
    try {
      const mediaFiles = await downloadImagesAsFiles();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      const scheduledTime = now.toISOString();

      await postService.create({
        caption: post.caption || '',
        media_files: mediaFiles,
        platforms: platforms,
        source: 'overflow',
        hook: post.hook,
        scheduled_time: scheduledTime,
        timezone,
      });

      // Delete the draft
      await postService.delete(post.id);
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to publish post.';
      if (msg.toLowerCase().includes('no connected account')) {
        onConnectError(msg);
      } else {
        setPostError(msg);
      }
    }
    setPublishing(false);
  };

  const handleScheduleConfirm = async () => {
    if (!schedDate || !schedTime) return;
    setScheduling(true);
    setPostError(null);
    try {
      const mediaFiles = await downloadImagesAsFiles();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const scheduledTime = new Date(`${schedDate}T${schedTime}`).toISOString();

      await postService.create({
        caption: post.caption || '',
        media_files: mediaFiles,
        platforms: platforms,
        source: 'overflow',
        hook: post.hook,
        scheduled_time: scheduledTime,
        timezone,
      });

      // Delete the draft
      await postService.delete(post.id);
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to schedule post.';
      if (msg.toLowerCase().includes('no connected account')) {
        onConnectError(msg);
      } else {
        setPostError(msg);
      }
    }
    setScheduling(false);
  };

  return (
    <div
      className="rounded-[16px] overflow-hidden mb-4 transition-all duration-200"
      style={{
        background: 'rgb(var(--c-bg-card))',
        border: `1px solid ${isFinal ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {platforms.map((plat) => (
            <span key={plat} className="text-[12px] text-text-secondary">
              {platformEmoji[plat] || '📱'} {plat.charAt(0).toUpperCase() + plat.slice(1)}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status || 'draft'} />
          {post.created_at && (
            <span className="text-[11px] text-text-muted">
              {format(new Date(post.created_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Images */}
        {post.media_files && post.media_files.length > 0 && (
          <div className="p-4">
            {post.media_files.length === 1 ? (
              <img
                src={post.media_files[0]}
                alt="Post"
                className="w-full h-[200px] object-cover rounded-[10px]"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {post.media_files.slice(0, 4).map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Media ${idx + 1}`}
                    className="w-full h-[100px] object-cover rounded-[8px]"
                  />
                ))}
                {post.media_files.length > 4 && (
                  <div
                    className="w-full h-[100px] rounded-[8px] flex items-center justify-center text-[13px] font-bold text-text-muted"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    +{post.media_files.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Caption */}
        <div className="p-4 flex flex-col">
          {post.hook && <h4 className="text-[14px] font-bold text-text-primary mb-2">{post.hook}</h4>}
          <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-line line-clamp-6">
            {post.caption || 'No caption'}
          </p>
        </div>
      </div>

      {/* Schedule picker */}
      {showScheduler && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(59,130,246,0.04)' }}
        >
          <input
            type="date"
            value={schedDate}
            onChange={(e) => setSchedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="text-[12px] px-3 py-2 rounded-[10px] focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
            }}
          />
          <input
            type="time"
            value={schedTime}
            onChange={(e) => setSchedTime(e.target.value)}
            className="text-[12px] px-3 py-2 rounded-[10px] focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
            }}
          />
          <button
            onClick={handleScheduleConfirm}
            disabled={!schedDate || !schedTime || scheduling}
            className="px-3 py-2 rounded-[10px] text-[12px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))',
              opacity: !schedDate || !schedTime || scheduling ? 0.5 : 1,
            }}
          >
            {scheduling ? 'Scheduling...' : 'Schedule'}
          </button>
          <button
            onClick={() => setShowScheduler(false)}
            className="text-[12px] font-semibold"
            style={{ color: 'rgb(var(--c-text-muted))' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error */}
      {postError && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}
        >
          <span className="text-[12px]">⚠️</span>
          <span className="text-[12px] text-red-400 flex-1">{postError}</span>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center justify-end gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        {isDraft ? (
          <>
            <button
              onClick={() => navigate(`/posts/${post.id}/edit`)}
              className="px-3 py-2 rounded-[10px] text-[12px] font-semibold"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-secondary))',
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => setShowScheduler(!showScheduler)}
              className="px-3 py-2 rounded-[10px] text-[12px] font-semibold"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-secondary))',
              }}
            >
              📅 Schedule
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 rounded-[10px] text-[12px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                opacity: publishing ? 0.6 : 1,
              }}
            >
              {publishing ? 'Posting...' : '🚀 Post Now'}
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate(`/posts/${post.id}/edit`)}
            className="px-3 py-2 rounded-[10px] text-[12px] font-semibold"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
            }}
          >
            View Details
          </button>
        )}
      </div>

      {isFinal && (
        <div className="px-4 py-3 text-[11px] text-text-muted" style={{ borderTop: '1px solid var(--border-color)' }}>
          {isScheduled && post.scheduled_time && `Scheduled for ${new Date(post.scheduled_time).toLocaleString()}`}
          {isPosted && post.posted_at && `Posted on ${new Date(post.posted_at).toLocaleString()}`}
        </div>
      )}
    </div>
  );
}

export function OverflowHistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectModalError, setConnectModalError] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const result = await postService.list({ source: 'overflow', page_size: 100 });
      setPosts(result.results || []);
    } catch {
      // Silent
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const filtered = posts.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.caption?.toLowerCase().includes(q) || p.hook?.toLowerCase().includes(q);
  });

  const draftCount = posts.filter((p) => p.status === 'draft').length;
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;
  const postedCount = posts.filter((p) => p.status === 'posted').length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[20px]"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))' }}
          >
            🔄
          </div>
          <h1 className="text-[28px] font-black text-text-primary">Overflow History</h1>
        </div>
        <p className="text-[14px] text-text-secondary ml-[52px]">
          Review your Overflow posts — draft, publish, or schedule them here.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-[14px]"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1.5px solid var(--border-color)',
          }}
        >
          <MagnifyingGlassIcon className="w-5 h-5 text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search overflow posts..."
            className="flex-1 bg-transparent text-[14px] text-text-primary focus:outline-none placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* Stats */}
      {!loading && posts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total', value: posts.length, emoji: '📊' },
            { label: 'Drafts', value: draftCount, emoji: '📝' },
            { label: 'Scheduled', value: scheduledCount, emoji: '📅' },
            { label: 'Posted', value: postedCount, emoji: '✅' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-[16px] text-center"
              style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
            >
              <div className="text-[20px] mb-1">{stat.emoji}</div>
              <div className="text-[22px] font-black text-text-primary">{stat.value}</div>
              <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3"
              style={{ borderColor: 'rgb(var(--c-coral))' }}
            />
            <p className="text-[14px] text-text-muted">Loading overflow history...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-[48px] mb-3">🔄</div>
          <h3 className="text-[20px] font-bold text-text-primary mb-2">No overflow posts yet</h3>
          <p className="text-[14px] text-text-secondary">
            {searchQuery
              ? 'No posts match your search.'
              : 'Posts created through the Overflow workflow will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => (
            <OverflowPostCard
              key={post.id}
              post={post}
              onConnectError={setConnectModalError}
              onRefresh={fetchPosts}
            />
          ))}
        </div>
      )}

      {/* Connect account modal */}
      <ConnectAccountModal
        open={!!connectModalError}
        message={connectModalError || 'Please connect your account first.'}
        onClose={() => setConnectModalError(null)}
      />
    </div>
  );
}

export default OverflowHistoryPage;
