import { useEffect } from 'react';
import { useDiamondStore } from '../../store/diamondStore';

export function DiamondUsageChart() {
  const { usage, usageLoading, fetchUsage } = useDiamondStore();

  useEffect(() => {
    fetchUsage(30);
  }, [fetchUsage]);

  if (usageLoading && !usage) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-4 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-dark-600 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!usage) return null;

  const byFeature = usage.by_feature || [];
  const maxSpent = Math.max(...byFeature.map((f) => f.diamonds_spent), 1);

  const featureLabels: Record<string, string> = {
    caption: 'Caption',
    caption_regenerate: 'Caption Regen',
    brand_dna: 'Brand DNA',
    strategy_ideas: 'Strategy',
    hashtag_generation: 'Hashtags',
    image: 'Image',
    video: 'Video',
    voice: 'Voice',
    support_chat: 'Support Chat',
    messenger_reply: 'Messenger',
    trending_topics: 'Trending',
    competitor_analysis: 'Competitor',
    pillar_generation: 'Pillars',
    refine_prompt: 'Prompt Refine',
  };

  const featureColors: Record<string, string> = {
    caption: 'bg-blue-500',
    image: 'bg-purple-500',
    video: 'bg-pink-500',
    voice: 'bg-amber-500',
    brand_dna: 'bg-emerald-500',
    strategy_ideas: 'bg-cyan-500',
    hashtag_generation: 'bg-indigo-500',
    support_chat: 'bg-green-500',
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">Diamond Usage (30 days)</h3>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Today: ◆ {(usage.total_spent_today ?? 0).toLocaleString()}</span>
          <span className="text-white/10">|</span>
          <span>Month: ◆ {(usage.total_spent_this_month ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {byFeature.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">No usage yet</p>
      ) : (
        <div className="space-y-3">
          {byFeature.map((f) => {
            const pct = (f.diamonds_spent / maxSpent) * 100;
            const color = featureColors[f.feature] || 'bg-gray-500';
            return (
              <div key={f.feature}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-secondary">
                    {featureLabels[f.feature] || f.feature}
                    <span className="text-text-muted ml-1">({f.count}x)</span>
                  </span>
                  <span className="text-text-primary font-medium">◆ {f.diamonds_spent.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DiamondUsageChart;
