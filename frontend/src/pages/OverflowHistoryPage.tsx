import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { postService } from '../services/postService';
import type { Post, PlatformType } from '../types';

const platformEmoji: Record<string, string> = {
  linkedin: '💼', instagram: '📸', facebook: '📘', twitter: '🐦', tiktok: '🎵',
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'rgb(234,179,8)', bg: 'rgba(234,179,8,0.1)' },
  scheduled: { label: 'Scheduled', color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.1)' },
  posted: { label: 'Posted', color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.1)' },
  failed: { label: 'Failed', color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.1)' },
  posting: { label: 'Posting', color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.1)' },
  cancelled: { label: 'Cancelled', color: 'rgb(var(--c-text-muted))', bg: 'rgba(255,255,255,0.06)' },
  pending_approval: { label: 'Pending', color: 'rgb(251,146,60)', bg: 'rgba(251,146,60,0.1)' },
  approved: { label: 'Approved', color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'Rejected', color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.1)' },
  changes_requested: { label: 'Changes', color: 'rgb(251,146,60)', bg: 'rgba(251,146,60,0.1)' },
};

export function OverflowHistoryPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await postService.delete(id);
      setPosts(posts.filter((p) => p.id !== id));
    } catch {
      // Silent
    }
    setDeletingId(null);
  };

  const handleEdit = (id: number) => {
    navigate(`/posts/${id}/edit`);
  };

  const filtered = posts.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.caption?.toLowerCase().includes(q) ||
      p.hook?.toLowerCase().includes(q)
    );
  });

  const draftCount = posts.filter((p) => p.status === 'draft').length;
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;
  const postedCount = posts.filter((p) => p.status === 'posted').length;

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-black text-text-primary mb-2">Overflow History</h1>
        <p className="text-[15px] text-text-secondary">
          All posts created through the Overflow workflow.
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
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', count: posts.length, color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.1)' },
          { label: 'Drafts', count: draftCount, color: 'rgb(234,179,8)', bg: 'rgba(234,179,8,0.1)' },
          { label: 'Scheduled', count: scheduledCount, color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.1)' },
          { label: 'Published', count: postedCount, color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.1)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[14px] p-4 text-center"
            style={{ background: stat.bg, border: `1px solid ${stat.color}30` }}
          >
            <p className="text-[24px] font-black" style={{ color: stat.color }}>{stat.count}</p>
            <p className="text-[12px] font-semibold text-text-secondary">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin mb-4"
            style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: 'rgb(59,130,246)' }}
          />
          <p className="text-[14px] text-text-muted">Loading overflow history...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[48px] mb-4 opacity-50">🔄</div>
          <h3 className="text-[18px] font-bold text-text-primary mb-2">No overflow posts yet</h3>
          <p className="text-[14px] text-text-secondary max-w-[300px] mx-auto">
            {searchQuery
              ? 'No posts match your search.'
              : 'Posts created through the Overflow workflow will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const status = post.status || 'draft';
            const sCfg = statusConfig[status] || statusConfig.draft;
            const platforms: PlatformType[] = Array.isArray(post.platforms) ? post.platforms : [];
            const title = post.hook || post.caption?.slice(0, 60) || 'Untitled Post';

            return (
              <div
                key={post.id}
                className="rounded-[16px] overflow-hidden transition-all duration-200"
                style={{
                  background: 'rgb(var(--c-bg-card))',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="p-5">
                  {/* Top row: status badge + platforms + date */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{ background: sCfg.bg, color: sCfg.color }}
                    >
                      {sCfg.label}
                    </span>
                    {platforms.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
                      >
                        {platformEmoji[p] || '📱'} {p.charAt(0).toUpperCase() + p.slice(1)}
                      </span>
                    ))}
                    <span className="ml-auto text-[11px] text-text-muted">
                      {post.created_at ? format(new Date(post.created_at), 'MMM d, yyyy') : ''}
                    </span>
                  </div>

                  {/* Media preview */}
                  {post.media_files && post.media_files.length > 0 && (
                    <div className="flex gap-2 mb-3">
                      {post.media_files.slice(0, 3).map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className="w-16 h-16 rounded-[10px] object-cover"
                          style={{ border: '1px solid var(--border-color)' }}
                        />
                      ))}
                      {post.media_files.length > 3 && (
                        <div
                          className="w-16 h-16 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-text-muted"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}
                        >
                          +{post.media_files.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-[15px] font-bold text-text-primary mb-2 line-clamp-1">
                    {title}
                  </h3>

                  {/* Caption preview */}
                  <p className="text-[13px] text-text-secondary line-clamp-2 leading-relaxed mb-4">
                    {post.caption || 'No caption'}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(post.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                      style={{
                        background: 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))',
                        color: 'white',
                      }}
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deletingId === post.id}
                      className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                      style={{
                        color: 'rgb(239,68,68)',
                        opacity: deletingId === post.id ? 0.5 : 1,
                      }}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      {deletingId === post.id ? '...' : 'Delete'}
                    </button>
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

export default OverflowHistoryPage;
