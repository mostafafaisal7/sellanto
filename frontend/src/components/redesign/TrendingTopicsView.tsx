import { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  FireIcon,
} from '@heroicons/react/24/outline';
import strategyService from '../../services/strategyService';
import { useOverflowStore } from '../../store';
import type { TrendingTopic } from '../../types';

const heatConfig = {
  hot: { emoji: '🔥', label: 'Hot', color: 'rgb(var(--c-coral))' },
  rising: { emoji: '📈', label: 'Rising', color: 'rgb(var(--c-amber))' },
  emerging: { emoji: '🌱', label: 'New', color: 'rgb(var(--c-blue))' },
};

function getHeat(topic: TrendingTopic): 'hot' | 'rising' | 'emerging' {
  if (topic.volume_score >= 80) return 'hot';
  if (topic.volume_score >= 50) return 'rising';
  return 'emerging';
}

interface TrendingTopicsViewProps {
  brandId: number | null;
  onNext: () => void;
  onBack: () => void;
}

export function TrendingTopicsView({ brandId, onNext, onBack }: TrendingTopicsViewProps) {
  const overflow = useOverflowStore();

  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualTopic, setManualTopic] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  // Load topics on mount
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;

    // Try loading cached trending first
    strategyService.getBrandTrending(brandId).then((data) => {
      if (cancelled) return;
      const arr = Array.isArray(data) ? data : data.topics || [];
      if (arr.length > 0) {
        setTopics(arr);
        overflow.markTrendingComplete();
      } else {
        doGenerate(brandId);
      }
    }).catch(() => {
      if (!cancelled) doGenerate(brandId);
    });

    return () => { cancelled = true; };
  }, [brandId]);

  const doGenerate = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await strategyService.generateTrending(id);
      const arr = result?.topics || [];
      setTopics(arr);
      if (arr.length > 0) overflow.markTrendingComplete();
      else setError('No trending topics found. Try again or add your own.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to generate trending topics.';
      setError(msg);
    }
    setLoading(false);
  };

  const toggleTopic = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(topics.map((t) => t.id)));
  };

  const addManual = async () => {
    if (!brandId || !manualTopic.trim()) return;
    setAddingCustom(true);
    try {
      const result = await strategyService.addManualTrend(brandId, manualTopic.trim());
      setTopics((prev) => [...prev, result]);
      setManualTopic('');
    } catch { /* handle error */ }
    setAddingCustom(false);
  };

  const handleContinue = () => {
    // Sync selected topic texts to overflow store
    const selectedTopicTexts = topics
      .filter((t) => selected.has(t.id))
      .map((t) => t.topic);
    overflow.setSelectedTrendingTopics(selectedTopicTexts);
    onNext();
  };

  return (
    <div className="animate-in">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <FireIcon className="w-5 h-5 text-coral" />
        <h2 className="text-[20px] font-bold text-text-primary">Trending Topics</h2>
        <span className="help-tip">ℹ What's this?</span>
      </div>

      {/* Selection bar */}
      <div
        className="rounded-[14px] p-2.5 px-4 flex items-center gap-4 mb-4"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        <div className="flex-1">
          <span className="text-[14px] font-bold text-text-primary">{selected.size} selected</span>
          <span className="text-[13px] text-text-secondary ml-2">· min 3, max 10 recommended</span>
          <div className="progress-bar-track mt-2" style={{ height: 4 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min((selected.size / 10) * 100, 100)}%` }}
            />
          </div>
        </div>
        <button onClick={selectAll} disabled={topics.length === 0} className="btn-ghost text-[13px] flex items-center gap-1.5">
          Select All
        </button>
        <button
          onClick={() => brandId && doGenerate(brandId)}
          disabled={loading}
          className="btn-ghost text-[13px] flex items-center gap-1.5"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generating...' : 'Refresh Topics'}
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
      {loading && topics.length === 0 && (
        <div
          className="rounded-[14px] p-12 text-center mb-4"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'rgb(var(--c-coral))' }} />
          <p className="text-text-muted mt-3 text-[13px]">Scanning trending topics in your industry...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && topics.length === 0 && !error && (
        <div
          className="rounded-[14px] p-12 text-center mb-4"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <FireIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgb(var(--c-text-muted))' }} />
          <p className="text-text-secondary text-[14px] mb-1">No trending topics yet</p>
          <p className="text-text-muted text-[12px]">Click "Refresh Topics" to generate, or add your own below.</p>
        </div>
      )}

      {/* Topics grid */}
      {topics.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {topics.map((topic, i) => {
            const isSelected = selected.has(topic.id);
            const heat = heatConfig[getHeat(topic)];
            return (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className={`text-left rounded-[14px] p-4 transition-all duration-200 hover-lift animate-in-delay-${Math.min(i + 1, 5)} relative`}
                style={{
                  background: 'rgb(var(--c-bg-card))',
                  border: `1px solid ${isSelected ? 'rgba(232,54,79,0.3)' : 'var(--border-color)'}`,
                  borderLeft: isSelected ? '3px solid rgb(var(--c-coral))' : undefined,
                }}
              >
                {/* Checkbox */}
                <div
                  className="absolute top-3 right-3 flex items-center justify-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `2px solid ${isSelected ? 'rgb(var(--c-coral))' : 'rgba(255,255,255,0.15)'}`,
                    background: isSelected ? 'rgb(var(--c-coral))' : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div className="flex items-start gap-2 mb-2 pr-7">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: `${heat.color}20`, color: heat.color }}
                  >
                    {heat.emoji} {heat.label}
                  </span>
                </div>
                <h4 className="text-[13.5px] font-semibold text-text-primary mb-1 pr-7">{topic.topic}</h4>
                <p className="text-[12px] text-text-muted">{topic.relevance_explanation || ''}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Manual add */}
      <div
        className="rounded-[14px] p-3.5 mb-6"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        <h4 className="text-[13px] font-bold text-text-primary mb-3">Add your own topic</h4>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={manualTopic}
            onChange={(e) => setManualTopic(e.target.value)}
            placeholder="Type a topic..."
            className="input-field flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addManual()}
          />
          <button
            onClick={addManual}
            disabled={addingCustom || !manualTopic.trim()}
            className="btn-secondary py-2 px-4 text-[13px] flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" /> {addingCustom ? 'Adding...' : 'Add'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['SEO tips 2026', 'Content marketing ROI', 'Social media trends'].map((s) => (
            <button
              key={s}
              onClick={() => setManualTopic(s)}
              className="chip text-[12px]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-[14px]">
          <ArrowLeftIcon className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={handleContinue}
          disabled={selected.size < 3}
          className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white transition-opacity"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
            boxShadow: 'var(--shadow-glow-coral)',
            opacity: selected.size < 3 ? 0.35 : 1,
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

export default TrendingTopicsView;
