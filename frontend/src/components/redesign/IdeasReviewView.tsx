import { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  ForwardIcon,
  CheckCircleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import strategyService from '../../services/strategyService';
import { useOverflowStore } from '../../store';
import type { ContentIdea } from '../../types';

const platformColors: Record<string, string> = {
  LinkedIn: '#0A66C2',
  Instagram: '#E1306C',
  Twitter: '#1DA1F2',
  Facebook: '#1877F2',
  TikTok: '#000000',
  linkedin: '#0A66C2',
  instagram: '#E1306C',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  tiktok: '#000000',
};

const platformEmojis: Record<string, string> = {
  LinkedIn: '💼',
  Instagram: '📸',
  Twitter: '🐦',
  Facebook: '📘',
  TikTok: '🎵',
  linkedin: '💼',
  instagram: '📸',
  twitter: '🐦',
  facebook: '📘',
  tiktok: '🎵',
};

interface IdeasReviewViewProps {
  brandId: number | null;
  onNext: () => void;
  onBack: () => void;
}

export function IdeasReviewView({ brandId, onNext, onBack }: IdeasReviewViewProps) {
  const overflow = useOverflowStore();

  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  // Load ideas on mount
  useEffect(() => {
    if (!brandId) return;
    // Check if overflow store already has ideas
    if (overflow.ideasData.length > 0) {
      // Restore from store
      const restored = overflow.ideasData.map((d) => ({
        id: d.id,
        brand: 0,
        title: d.title,
        hook: d.hook,
        angle: d.angle,
        platform: d.platform,
        goal: '',
        content_format: d.content_format,
        language: '',
        persona: '',
        status: 'new' as const,
        batch_id: '',
        generation_run: 0,
        created_at: '',
        updated_at: '',
      }));
      setIdeas(restored);
      // Restore approved ids
      setApprovedIds(new Set(overflow.selectedIdeaIds));
    } else {
      doGenerate();
    }
  }, [brandId]);

  const doGenerate = async () => {
    if (!brandId) { setError('No brand selected.'); return; }
    setLoading(true);
    setError(null);
    try {
      const topics = overflow.selectedTrendingTopics;
      const count = topics.length > 0 ? Math.max(topics.length, 5) : 5;
      const result = await strategyService.generateIdeas({
        brand_id: brandId,
        count,
        trending_topics: topics.length > 0 ? topics : undefined,
      });
      const newIdeas: ContentIdea[] = result.ideas || result || [];
      setIdeas(newIdeas);
      setApprovedIds(new Set());
      // Store for downstream steps
      const mapped = newIdeas.map((i) => ({
        id: i.id,
        title: i.title,
        hook: i.hook,
        angle: i.angle || '',
        platform: i.platform,
        content_format: i.content_format,
      }));
      overflow.setIdeasData(mapped);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to generate ideas.';
      setError(msg);
    }
    setLoading(false);
  };

  const handleRegenerate = async (ideaId: number) => {
    setRegeneratingId(ideaId);
    try {
      const result = await strategyService.regenerateIdea(ideaId);
      const newIdea = result.idea || result;
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? newIdea : i)));
      // Update store
      const mapped = ideas.map((i) => (i.id === ideaId ? newIdea : i)).map((i) => ({
        id: i.id, title: i.title, hook: i.hook, angle: i.angle || '',
        platform: i.platform, content_format: i.content_format,
      }));
      overflow.setIdeasData(mapped);
    } catch { /* handle error */ }
    setRegeneratingId(null);
  };

  const toggleApprove = (id: number) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approvedCount = approvedIds.size;

  const handleContinue = () => {
    // Sync to overflow store
    overflow.setIdeaSelection(Array.from(approvedIds));
    onNext();
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <LightBulbIcon className="w-5 h-5 text-coral" />
          <h2 className="text-[20px] font-bold text-text-primary">Content Ideas</h2>
        </div>
        <p className="text-[14px] text-text-secondary">
          Review, edit, or regenerate ideas. Approve at least 3 to continue to captions.
        </p>
      </div>

      {/* Status Bar */}
      <div
        className="rounded-[14px] p-3 px-4 flex items-center justify-between mb-3.5 animate-in-delay-1"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[15px] font-bold"
            style={{ color: approvedCount >= 3 ? 'rgb(var(--c-green))' : 'rgb(var(--c-amber))' }}
          >
            {approvedCount} approved
          </span>
          <span
            className="text-[13px] font-semibold px-3 py-1 rounded-lg"
            style={{
              background: approvedCount >= 3 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              color: approvedCount >= 3 ? 'rgb(var(--c-green))' : 'rgb(var(--c-amber))',
            }}
          >
            {approvedCount >= 3 ? '✓ Ready to continue!' : `Approve at least 3 (need ${3 - approvedCount} more)`}
          </span>
        </div>
        <button
          onClick={doGenerate}
          disabled={loading}
          className="btn-ghost text-[12px] flex items-center gap-1"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generating...' : 'Regenerate All'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-[12px] p-3 px-4 mb-4"
          style={{ background: 'rgba(232,54,79,0.08)', border: '1px solid rgba(232,54,79,0.2)' }}
        >
          <p className="text-[13px]" style={{ color: 'rgb(var(--c-coral))' }}>{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && ideas.length === 0 && (
        <div
          className="rounded-[14px] p-12 text-center mb-5"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'rgb(var(--c-coral))' }} />
          <p className="text-text-muted mt-3 text-[13px]">Generating ideas from your trending topics...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && !error && (
        <div
          className="rounded-[14px] p-12 text-center mb-5"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <LightBulbIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgb(var(--c-text-muted))' }} />
          <p className="text-text-secondary text-[14px] mb-1">No ideas generated yet</p>
          <p className="text-text-muted text-[12px]">Make sure you have trending topics selected, then click "Regenerate All".</p>
        </div>
      )}

      {/* Idea Cards */}
      {ideas.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-5">
          {ideas.map((idea, i) => {
            const isApproved = approvedIds.has(idea.id);
            const isRegenerating = regeneratingId === idea.id;
            const platform = capitalize(idea.platform);
            return (
              <div
                key={idea.id}
                className={`rounded-[14px] p-[18px] transition-all duration-200 hover-glow animate-in-delay-${Math.min(i + 2, 5)} flex gap-4`}
                style={{
                  background: isApproved ? 'rgba(16,185,129,0.03)' : 'rgb(var(--c-bg-card))',
                  border: `1px solid ${isApproved ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
                  borderLeft: isApproved ? '3px solid rgb(var(--c-green))' : undefined,
                  opacity: isRegenerating ? 0.5 : 1,
                }}
              >
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title + Approved Badge */}
                  <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                    <h4 className="text-[15px] font-semibold text-text-primary flex-1">{idea.title}</h4>
                    {isApproved && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bounce-in"
                        style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(var(--c-green))' }}
                      >
                        <CheckCircleIcon className="w-3 h-3" /> Approved
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-[13px] text-text-secondary leading-relaxed mb-2.5">{idea.hook}</p>

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{
                        background: `${platformColors[idea.platform] || '#666'}20`,
                        color: platformColors[idea.platform] || '#666',
                      }}
                    >
                      {platformEmojis[idea.platform] || '📱'} {platform}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(var(--c-text-muted))' }}
                    >
                      {idea.content_format}
                    </span>
                    {idea.pillar_name && (
                      <span className="text-[11px] text-text-muted hidden sm:inline">
                        from: {idea.pillar_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions - vertical column */}
                <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ minWidth: 100 }}>
                  {!isApproved ? (
                    <button
                      onClick={() => toggleApprove(idea.id)}
                      className="px-3 py-1.5 rounded-[10px] text-[12px] font-bold text-white flex items-center gap-1 justify-center"
                      style={{
                        background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                      }}
                    >
                      <CheckIcon className="w-3.5 h-3.5" /> Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleApprove(idea.id)}
                      className="btn-ghost text-[12px] text-text-muted justify-center"
                    >
                      Undo
                    </button>
                  )}
                  <button className="btn-ghost text-[12px] flex items-center gap-1 justify-center">
                    <PencilSquareIcon className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleRegenerate(idea.id)}
                    disabled={isRegenerating}
                    className="btn-ghost text-[12px] flex items-center gap-1 justify-center"
                  >
                    <ArrowPathIcon className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {isRegenerating ? '...' : 'Regen'}
                  </button>
                  <button className="btn-ghost text-[12px] flex items-center gap-1 text-text-muted justify-center">
                    <ForwardIcon className="w-3 h-3" /> Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-[14px]">
          <ArrowLeftIcon className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={handleContinue}
          disabled={approvedCount < 3}
          className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white flex items-center gap-2 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
            boxShadow: 'var(--shadow-glow-coral)',
            opacity: approvedCount < 3 ? 0.35 : 1,
          }}
        >
          Continue to Captions <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default IdeasReviewView;
