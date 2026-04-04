import { useState, useEffect } from 'react';
import api from '../../services/api';

interface CaptionRecord {
  id: number;
  input_text: string;
  generated_caption: string;
  generated_hashtags: string;
  tone: string;
  platform: string;
  tokens_used: number;
  processing_time: number;
  model_used: string;
  status: string;
  error_message: string;
  custom_instructions: string;
  created_at: string;
}

interface ImageRecord {
  id: number;
  title: string;
  prompt: string;
  enhanced_prompt: string;
  revised_prompt: string;
  generated_image: string | null;
  generated_image_with_logo: string | null;
  composited_image: string | null;
  provider: string;
  model_used: string;
  processing_time: number;
  status: string;
  error_message: string;
  style: string;
  size: string;
  quality: string;
  created_at: string;
}

interface IdeaRecord {
  id: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  content_format: string;
  goal: string;
  status: string;
  batch_id: string;
  source: string;
  trending_topic_ref: string;
  created_at: string;
}

interface TrendingRecord {
  id: number;
  topic: string;
  volume_score: number;
  relevance_explanation: string;
  platform: string;
  region: string;
  fetched_at: string;
}

interface PromptRecord {
  id: number;
  feature: string;
  prompt_text: string;
  created_at: string;
}

interface SessionStats {
  total_captions: number;
  total_images: number;
  total_ideas: number;
  total_trending: number;
  total_tokens: number;
  total_time: number;
}

interface Session {
  id: string;
  date: string;
  brand_name: string;
  website_url: string;
  dna: Record<string, unknown> | null;
  captions: CaptionRecord[];
  images: ImageRecord[];
  ideas: IdeaRecord[];
  trending_topics: TrendingRecord[];
  prompts: PromptRecord[];
  stats: SessionStats;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
    failed: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    processing: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
    pending: { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: c.bg, color: c.text }}>
      {status}
    </span>
  );
}

function ExpandableText({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] font-semibold transition-colors"
        style={{ color: 'rgb(var(--c-coral))' }}
      >
        {open ? `Hide ${label} ▲` : `View ${label} ▼`}
      </button>
      {open && (
        <pre
          className="mt-1.5 p-3 rounded-[10px] text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto no-scrollbar"
          style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'ideas' | 'captions' | 'images' | 'trending' | 'dna' | 'prompts'>('captions');
  const { stats } = session;

  const tabs = [
    { key: 'captions' as const, label: 'Captions', count: stats.total_captions, emoji: '✍️' },
    { key: 'ideas' as const, label: 'Ideas', count: stats.total_ideas, emoji: '💡' },
    { key: 'images' as const, label: 'Images', count: stats.total_images, emoji: '🎨' },
    { key: 'trending' as const, label: 'Trending', count: stats.total_trending, emoji: '🔥' },
    { key: 'dna' as const, label: 'DNA', count: session.dna ? 1 : 0, emoji: '🧬' },
    { key: 'prompts' as const, label: 'Prompts', count: session.prompts.length, emoji: '📜' },
  ].filter((t) => t.count > 0);

  return (
    <div
      className="rounded-[20px] overflow-hidden transition-all duration-300"
      style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center text-[20px] flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(232,54,79,0.15), rgba(232,54,79,0.05))' }}
        >
          ✨
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-text-primary">
            {formatDate(session.date)}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {session.brand_name && (
              <span className="text-[12px] text-text-muted">🏢 {session.brand_name}</span>
            )}
            <span className="text-[12px] text-text-muted">✍️ {stats.total_captions} captions</span>
            {stats.total_images > 0 && (
              <span className="text-[12px] text-text-muted">🎨 {stats.total_images} images</span>
            )}
            {stats.total_ideas > 0 && (
              <span className="text-[12px] text-text-muted">💡 {stats.total_ideas} ideas</span>
            )}
            <span className="text-[12px] text-text-muted">⚡ {stats.total_tokens.toLocaleString()} tokens</span>
            <span className="text-[12px] text-text-muted">⏱ {stats.total_time}s</span>
          </div>
        </div>
        <span className="text-[16px] text-text-muted transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
          {/* Tabs */}
          <div className="flex gap-1 px-5 py-3 overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid var(--border-color)' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-3.5 py-2 rounded-[10px] text-[12px] font-semibold whitespace-nowrap transition-all"
                style={{
                  background: activeTab === tab.key ? 'rgba(232,54,79,0.1)' : 'transparent',
                  color: activeTab === tab.key ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-secondary))',
                  border: activeTab === tab.key ? '1px solid rgba(232,54,79,0.2)' : '1px solid transparent',
                }}
              >
                {tab.emoji} {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
            {/* Captions tab */}
            {activeTab === 'captions' && session.captions.map((c) => (
              <div key={c.id} className="p-4 rounded-[14px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-[13px] font-semibold text-text-primary flex-1">{c.input_text || 'Caption'}</p>
                  <StatusBadge status={c.status} />
                </div>
                {c.generated_caption && (
                  <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-line mb-2">{c.generated_caption}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {c.platform && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{c.platform}</span>}
                  {c.tone && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>{c.tone}</span>}
                  {c.model_used && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>{c.model_used}</span>}
                  <span className="text-[10px] text-text-muted">⚡ {c.tokens_used} tokens</span>
                  <span className="text-[10px] text-text-muted">⏱ {c.processing_time?.toFixed(1)}s</span>
                </div>
                {c.custom_instructions && <ExpandableText label="Custom Instructions" text={c.custom_instructions} />}
                {c.generated_hashtags && <p className="text-[11px] text-text-muted mt-2">{c.generated_hashtags}</p>}
                {c.error_message && <p className="text-[11px] mt-2" style={{ color: '#ef4444' }}>{c.error_message}</p>}
              </div>
            ))}

            {/* Ideas tab */}
            {activeTab === 'ideas' && session.ideas.map((idea) => (
              <div key={idea.id} className="p-4 rounded-[14px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[13px] font-semibold text-text-primary mb-1">{idea.title}</p>
                {idea.hook && <p className="text-[12px] text-text-secondary mb-2">{idea.hook}</p>}
                <div className="flex flex-wrap gap-2">
                  {idea.platform && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{idea.platform}</span>}
                  {idea.content_format && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{idea.content_format}</span>}
                  {idea.source && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>{idea.source}</span>}
                  <StatusBadge status={idea.status} />
                </div>
                {idea.trending_topic_ref && <p className="text-[11px] text-text-muted mt-2">Trending: {idea.trending_topic_ref}</p>}
              </div>
            ))}

            {/* Images tab */}
            {activeTab === 'images' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {session.images.map((img) => {
                  const imgUrl = img.generated_image_with_logo || img.generated_image || img.composited_image;
                  return (
                    <div key={img.id} className="rounded-[14px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {imgUrl && (
                        <img src={imgUrl} alt={img.title} className="w-full h-[180px] object-cover" />
                      )}
                      <div className="p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-[12px] font-semibold text-text-primary flex-1">{img.title || 'Image'}</p>
                          <StatusBadge status={img.status} />
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {img.provider && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>{img.provider}</span>}
                          {img.style && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>{img.style}</span>}
                          <span className="text-[10px] text-text-muted">⏱ {img.processing_time?.toFixed(1)}s</span>
                        </div>
                        <ExpandableText label="Prompt" text={img.prompt} />
                        {img.enhanced_prompt && <ExpandableText label="Enhanced Prompt" text={img.enhanced_prompt} />}
                        {img.error_message && <p className="text-[11px] mt-2" style={{ color: '#ef4444' }}>{img.error_message}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Trending tab */}
            {activeTab === 'trending' && session.trending_topics.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-4 rounded-[14px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">{t.topic}</p>
                  {t.relevance_explanation && <p className="text-[12px] text-text-secondary mt-1">{t.relevance_explanation}</p>}
                  <div className="flex gap-2 mt-1.5">
                    {t.platform && <span className="text-[10px] text-text-muted">{t.platform}</span>}
                    {t.region && <span className="text-[10px] text-text-muted">{t.region}</span>}
                  </div>
                </div>
                <div className="text-center flex-shrink-0">
                  <div className="text-[18px] font-black" style={{ color: t.volume_score >= 80 ? '#ef4444' : t.volume_score >= 50 ? '#f59e0b' : '#3b82f6' }}>
                    {t.volume_score}
                  </div>
                  <span className="text-[10px] text-text-muted">score</span>
                </div>
              </div>
            ))}

            {/* DNA tab */}
            {activeTab === 'dna' && session.dna && (() => {
              const dnaObj = session.dna.dna_data;
              const entries = dnaObj && typeof dnaObj === 'object' && !Array.isArray(dnaObj)
                ? Object.entries(dnaObj as Record<string, string | string[]>)
                : [];
              return (
                <div className="p-4 rounded-[14px] space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[16px]">🧬</span>
                    <p className="text-[14px] font-bold text-text-primary">Brand DNA Analysis</p>
                    {session.website_url && <span className="text-[11px] text-text-muted ml-auto">{session.website_url}</span>}
                  </div>
                  {entries.length > 0 && (
                    <div className="space-y-2">
                      {entries.map(([key, val]) => (
                        <div key={key} className="flex gap-3">
                          <span className="text-[11px] font-semibold text-text-muted min-w-[120px] uppercase tracking-wide">{key.replace(/_/g, ' ')}</span>
                          <span className="text-[12px] text-text-secondary flex-1">
                            {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Prompts tab */}
            {activeTab === 'prompts' && session.prompts.map((p) => (
              <div key={p.id} className="p-4 rounded-[14px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(232,54,79,0.1)', color: 'rgb(var(--c-coral))' }}>
                    {p.feature}
                  </span>
                  <span className="text-[10px] text-text-muted ml-auto">{new Date(p.created_at).toLocaleTimeString()}</span>
                </div>
                <pre className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto no-scrollbar">
                  {p.prompt_text}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MagicHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/magic/history/')
      .then((res) => {
        setSessions(res.data.sessions || []);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load history');
      })
      .finally(() => setLoading(false));
  }, []);

  // Summary stats
  const totalSessions = sessions.length;
  const totalCaptions = sessions.reduce((s, sess) => s + sess.stats.total_captions, 0);
  const totalImages = sessions.reduce((s, sess) => s + sess.stats.total_images, 0);
  const totalTokens = sessions.reduce((s, sess) => s + sess.stats.total_tokens, 0);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[20px]"
            style={{ background: 'linear-gradient(135deg, rgba(232,54,79,0.15), rgba(232,54,79,0.05))' }}
          >
            ✨
          </div>
          <h1 className="text-[28px] font-black text-text-primary">Magic Mode History</h1>
        </div>
        <p className="text-[14px] text-text-secondary ml-[52px]">
          Full audit trail of every Magic Mode session — ideas, captions, images, prompts, and AI details.
        </p>
      </div>

      {/* Summary stats */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Sessions', value: totalSessions, emoji: '🚀' },
            { label: 'Captions', value: totalCaptions, emoji: '✍️' },
            { label: 'Images', value: totalImages, emoji: '🎨' },
            { label: 'Tokens Used', value: totalTokens.toLocaleString(), emoji: '⚡' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-[16px] text-center"
              style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
            >
              <div className="text-[20px] mb-1">{stat.emoji}</div>
              <div className="text-[22px] font-black text-text-primary">{stat.value}</div>
              <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: 'rgb(var(--c-coral))' }} />
            <p className="text-[14px] text-text-muted">Loading history...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <div className="text-[40px] mb-3">⚠️</div>
          <p className="text-[14px] text-text-secondary">{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-[48px] mb-3">🪄</div>
          <h3 className="text-[20px] font-bold text-text-primary mb-2">No Magic Mode sessions yet</h3>
          <p className="text-[14px] text-text-secondary">Use Magic Mode to generate posts and they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MagicHistoryPage;
