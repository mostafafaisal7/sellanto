import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrashIcon,
  PencilIcon,
  SparklesIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { postService } from '../services/postService';
import type { Post, PlatformType } from '../types';

const platformEmoji: Record<string, string> = {
  linkedin: '💼', instagram: '📸', facebook: '📘', twitter: '🐦', tiktok: '🎵',
};

const sourceConfig = {
  magic: { label: 'Magic Link', color: 'rgb(232,54,79)', bg: 'rgba(232,54,79,0.1)' },
  overflow: { label: 'Overflow', color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.1)' },
  manual: { label: 'Manual', color: 'rgb(var(--c-text-muted))', bg: 'rgba(255,255,255,0.06)' },
};

export function DraftPostsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const result = await postService.list({ status: 'draft', page_size: 100 });
      setDrafts(result.results || []);
    } catch {
      // Silent
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await postService.delete(id);
      setDrafts(drafts.filter((d) => d.id !== id));
    } catch {
      // Silent
    }
    setDeletingId(null);
  };

  const handleEdit = (id: number) => {
    navigate(`/posts/${id}/edit`);
  };

  const handleResume = (source: string) => {
    if (source === 'magic') {
      navigate('/magic');
    } else if (source === 'overflow') {
      navigate('/overflow');
    }
  };

  const filtered = drafts.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.caption?.toLowerCase().includes(q) ||
      d.hook?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-black text-text-primary mb-2">Draft Posts</h1>
        <p className="text-[15px] text-text-secondary">
          Posts saved from Magic Link and Overflow that haven't been published yet.
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
            placeholder="Search drafts..."
            className="flex-1 bg-transparent text-[14px] text-text-primary focus:outline-none placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(['magic', 'overflow', 'manual'] as const).map((src) => {
          const count = drafts.filter((d) => (d.source || 'manual') === src).length;
          const cfg = sourceConfig[src];
          return (
            <div
              key={src}
              className="rounded-[14px] p-4 text-center"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}
            >
              <p className="text-[24px] font-black" style={{ color: cfg.color }}>{count}</p>
              <p className="text-[12px] font-semibold text-text-secondary">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin mb-4"
            style={{ borderColor: 'rgba(232,54,79,0.2)', borderTopColor: 'rgb(var(--c-coral))' }}
          />
          <p className="text-[14px] text-text-muted">Loading drafts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[48px] mb-4 opacity-50">📝</div>
          <h3 className="text-[18px] font-bold text-text-primary mb-2">No drafts yet</h3>
          <p className="text-[14px] text-text-secondary max-w-[300px] mx-auto">
            {searchQuery
              ? 'No drafts match your search.'
              : 'Unapproved posts from Magic Link and incomplete Overflow posts will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((draft) => {
            const src = (draft.source || 'manual') as keyof typeof sourceConfig;
            const cfg = sourceConfig[src];
            const platforms: PlatformType[] = Array.isArray(draft.platforms) ? draft.platforms : [];
            const title = draft.hook || draft.caption?.slice(0, 60) || 'Untitled Draft';

            return (
              <div
                key={draft.id}
                className="rounded-[16px] overflow-hidden transition-all duration-200"
                style={{
                  background: 'rgb(var(--c-bg-card))',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="p-5">
                  {/* Top row: source badge + platform + date */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {src === 'magic' && '✨ '}{cfg.label}
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
                      {draft.created_at ? format(new Date(draft.created_at), 'MMM d, yyyy') : ''}
                    </span>
                  </div>

                  {/* Media preview */}
                  {draft.media_files && draft.media_files.length > 0 && (
                    <div className="flex gap-2 mb-3">
                      {draft.media_files.slice(0, 3).map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className="w-16 h-16 rounded-[10px] object-cover"
                          style={{ border: '1px solid var(--border-color)' }}
                        />
                      ))}
                      {draft.media_files.length > 3 && (
                        <div
                          className="w-16 h-16 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-text-muted"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}
                        >
                          +{draft.media_files.length - 3}
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
                    {draft.caption || 'No caption'}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(draft.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                      style={{
                        background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                        color: 'white',
                      }}
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    {src !== 'manual' && (
                      <button
                        onClick={() => handleResume(src)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-color)',
                          color: 'rgb(var(--c-text-primary))',
                        }}
                      >
                        {src === 'magic' ? <SparklesIcon className="w-3.5 h-3.5" /> : <ArrowPathIcon className="w-3.5 h-3.5" />}
                        Resume in {cfg.label}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(draft.id)}
                      disabled={deletingId === draft.id}
                      className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                      style={{
                        color: 'rgb(239,68,68)',
                        opacity: deletingId === draft.id ? 0.5 : 1,
                      }}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      {deletingId === draft.id ? '...' : 'Delete'}
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

export default DraftPostsPage;
