import { useState, useEffect } from 'react';
import api from '../../services/api';
import { postService } from '../../services/postService';
import { captionService } from '../../services/captionService';
import ConnectAccountModal from '../../components/ConnectAccountModal';
import type { CaptionPlatform, CaptionTone } from '../../types';

interface PostRecord {
  id: number;
  caption: string;
  hook: string;
  status: string;
  platforms_list: string[];
  media_urls: string[];
  scheduled_time: string | null;
  posted_at: string | null;
  created_at: string;
}

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

interface VideoRecord {
  id: number;
  title: string;
  prompt: string;
  style: string;
  duration: number;
  aspect_ratio: string;
  generated_video: string | null;
  generated_video_with_logo: string | null;
  thumbnail: string | null;
  status: string;
  error_message: string;
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
  total_videos: number;
  total_ideas: number;
  total_trending: number;
  total_posts: number;
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
  videos: VideoRecord[];
  ideas: IdeaRecord[];
  trending_topics: TrendingRecord[];
  prompts: PromptRecord[];
  posts: PostRecord[];
  stats: SessionStats;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8' },
    scheduled: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
    posted: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
    failed: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    completed: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
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

const isMaybeVideo = (url?: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0];
  return cleanUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || url.includes('video');
};

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

// Post card for history (simpler than ResultsScreen version)
function HistoryPostCard({
  post,
  session,
  onConnectError,
}: {
  post: PostRecord;
  session: Session;
  onConnectError: (msg: string) => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedDate, setSchedDate] = useState(() => {
    if (post.scheduled_time) {
      const d = new Date(post.scheduled_time);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '';
  });
  const [schedTime, setSchedTime] = useState(() => {
    if (post.scheduled_time) {
      const d = new Date(post.scheduled_time);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return '';
  });
  const [scheduling, setScheduling] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState(post.caption);
  const [captionLive, setCaptionLive] = useState(post.caption);
  const [savingCaption, setSavingCaption] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const isDraft = post.status === 'draft';
  const isScheduled = post.status === 'scheduled';
  const isPosted = post.status === 'posted';
  const isFinal = isPosted || isScheduled;
  const canEditCaption = isDraft || (isScheduled && !!post.scheduled_time && new Date(post.scheduled_time).getTime() > Date.now());

  // A scheduled post whose time has already passed is locked (in queue / being processed)
  const scheduledTimePassed =
    isScheduled && !!post.scheduled_time && new Date(post.scheduled_time).getTime() <= Date.now();
  const canEditSchedule = isScheduled && !scheduledTimePassed;

  const platformEmoji: Record<string, string> = {
    linkedin: '💼',
    instagram: '📸',
    facebook: '📘',
    twitter: '🐦',
    tiktok: '🎵',
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPostError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      const scheduledTime = now.toISOString();

      await postService.update(post.id, {
        status: 'scheduled',
        scheduled_time: scheduledTime,
        timezone,
      });

      window.location.reload();
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

  const handleSaveCaption = async () => {
    if (!draftCaption.trim() || draftCaption === captionLive) {
      setEditingCaption(false);
      return;
    }
    setSavingCaption(true);
    setPostError(null);
    try {
      await postService.update(post.id, { caption: draftCaption });
      setCaptionLive(draftCaption);
      setEditingCaption(false);
    } catch (err: any) {
      setPostError(err?.response?.data?.error || err?.message || 'Failed to save caption.');
    }
    setSavingCaption(false);
  };

  const handleRegenerateAI = async () => {
    setRegenerating(true);
    setPostError(null);
    try {
      // Build rich context from session: brand DNA, hook, prompts, related ideas
      const dnaData = (session.dna as any)?.dna_data;
      const dnaEntries = dnaData && typeof dnaData === 'object'
        ? Object.entries(dnaData as Record<string, unknown>)
            .filter(([, v]) => v && (typeof v === 'string' || Array.isArray(v)))
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as unknown[]).join(', ') : v}`)
            .join('\n')
        : '';

      const ideaContext = session.ideas
        .filter((i) => i.hook || i.angle)
        .slice(0, 3)
        .map((i) => `- ${i.title || ''}: ${i.hook || ''} (${i.angle || ''})`)
        .join('\n');

      const videoContext = session.videos
        .slice(0, 2)
        .map((v) => `- ${v.title || ''}: ${v.prompt || ''}`)
        .join('\n');

      const platformMap: Record<string, CaptionPlatform> = {
        linkedin: 'linkedin', instagram: 'instagram', facebook: 'facebook',
        twitter: 'twitter', tiktok: 'tiktok', youtube: 'youtube', pinterest: 'pinterest',
      };
      const firstPlat = (post.platforms_list[0] || 'general').toLowerCase();
      const captionPlatform: CaptionPlatform = platformMap[firstPlat] || 'general';

      const customParts: string[] = [];
      if (session.brand_name) customParts.push(`Brand: ${session.brand_name}`);
      if (session.website_url) customParts.push(`Website: ${session.website_url}`);
      if (dnaEntries) customParts.push(`Brand DNA:\n${dnaEntries}`);
      if (post.hook) customParts.push(`Original hook: ${post.hook}`);
      if (videoContext) customParts.push(`Related videos:\n${videoContext}`);
      if (ideaContext) customParts.push(`Related ideas:\n${ideaContext}`);
      customParts.push(
        `Write a fresh, on-brand social caption for ${captionPlatform}. Strong hook, scannable, native to the platform. Do NOT describe the video — write a real social post.`,
      );

      const tone: CaptionTone = 'enthusiastic';
      const topic = post.hook || captionLive.slice(0, 200) || session.brand_name || 'social media post';

      const result = await captionService.generate({
        topic,
        tone,
        length: 'medium',
        platform: captionPlatform,
        include_hashtags: true,
        include_emojis: true,
        include_cta: true,
        custom_instructions: customParts.join('\n\n'),
      });

      const generated = (result.generated_caption || '').trim();
      const hashtags = (result.generated_hashtags || '').trim();
      const newCaption = generated && hashtags && !generated.includes('#')
        ? `${generated}\n\n${hashtags}`
        : generated || captionLive;

      setDraftCaption(newCaption);
      setEditingCaption(true);
    } catch (err: any) {
      setPostError(err?.response?.data?.error || err?.message || 'Failed to regenerate caption.');
    }
    setRegenerating(false);
  };

  const handleScheduleConfirm = async () => {
    if (!schedDate || !schedTime) return;
    setScheduling(true);
    setPostError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const scheduledTime = new Date(`${schedDate}T${schedTime}`).toISOString();

      await postService.update(post.id, {
        status: 'scheduled',
        scheduled_time: scheduledTime,
        timezone,
      });

      window.location.reload();
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
      className="rounded-[16px] overflow-hidden mb-3"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${isFinal ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          {post.platforms_list.map((plat) => (
            <span key={plat} className="text-[12px]">
              {platformEmoji[plat] || '📱'} {plat}
            </span>
          ))}
        </div>
        <StatusBadge status={post.status} />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Media */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className="p-4">
            {isMaybeVideo(post.media_urls[0]) ? (
              <video
                src={post.media_urls[0]}
                className="w-full h-[200px] object-cover rounded-[10px]"
                controls
                muted
                playsInline
              />
            ) : (
              <img src={post.media_urls[0]} alt="Post" className="w-full h-[200px] object-cover rounded-[10px]" />
            )}
          </div>
        )}

        {/* Caption */}
        <div className="p-4 flex flex-col">
          {post.hook && (
            <h4 className="text-[14px] font-bold text-text-primary mb-2">{post.hook}</h4>
          )}

          {editingCaption ? (
            <>
              <textarea
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                rows={8}
                className="w-full text-[12px] leading-relaxed p-3 rounded-[10px] focus:outline-none resize-y"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgb(var(--c-text-primary))',
                }}
              />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button
                  onClick={handleSaveCaption}
                  disabled={savingCaption || regenerating}
                  className="px-3 py-1.5 rounded-[8px] text-[11px] font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                    opacity: savingCaption || regenerating ? 0.6 : 1,
                  }}
                >
                  {savingCaption ? 'Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleRegenerateAI}
                  disabled={regenerating || savingCaption}
                  className="px-3 py-1.5 rounded-[8px] text-[11px] font-bold"
                  style={{
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.35)',
                    color: '#a855f7',
                    opacity: regenerating || savingCaption ? 0.6 : 1,
                  }}
                >
                  {regenerating ? '✨ Generating...' : '✨ Regenerate with AI'}
                </button>
                <button
                  onClick={() => {
                    setDraftCaption(captionLive);
                    setEditingCaption(false);
                  }}
                  disabled={savingCaption || regenerating}
                  className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold"
                  style={{ color: 'rgb(var(--c-text-muted))' }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-line line-clamp-6">
                {captionLive}
              </p>
              {canEditCaption && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      setDraftCaption(captionLive);
                      setEditingCaption(true);
                    }}
                    className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-color)',
                      color: 'rgb(var(--c-text-secondary))',
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={handleRegenerateAI}
                    disabled={regenerating}
                    className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold"
                    style={{
                      background: 'rgba(168,85,247,0.12)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      color: '#a855f7',
                      opacity: regenerating ? 0.6 : 1,
                    }}
                  >
                    {regenerating ? '✨ Generating...' : '✨ AI Caption'}
                  </button>
                </div>
              )}
            </>
          )}
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
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
          />
          <input
            type="time"
            value={schedTime}
            onChange={(e) => setSchedTime(e.target.value)}
            className="text-[12px] px-3 py-2 rounded-[10px] focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
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
        className="flex items-center justify-between gap-2 px-4 py-3 flex-wrap"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        <div className="text-[11px] text-text-muted">
          {isScheduled && post.scheduled_time && (
            <>📅 Scheduled for {new Date(post.scheduled_time).toLocaleString()}</>
          )}
          {isPosted && post.posted_at && (
            <>✅ Posted on {new Date(post.posted_at).toLocaleString()}</>
          )}
          {!isScheduled && !isPosted && <>📝 Draft</>}
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <>
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
          )}

          {canEditSchedule && (
            <button
              onClick={() => setShowScheduler(!showScheduler)}
              className="px-4 py-2 rounded-[10px] text-[12px] font-bold"
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.35)',
                color: '#3b82f6',
              }}
            >
              ✏️ Edit Scheduling
            </button>
          )}

          {scheduledTimePassed && (
            <button
              disabled
              className="px-4 py-2 rounded-[10px] text-[12px] font-bold cursor-not-allowed"
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.35)',
                color: '#3b82f6',
              }}
            >
              ⏳ Scheduled
            </button>
          )}

          {isPosted && (
            <button
              disabled
              className="px-4 py-2 rounded-[10px] text-[12px] font-bold text-white cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgb(16,185,129), rgb(5,150,105))',
              }}
            >
              ✅ Already Posted
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Technical details card (existing SessionCard functionality)
function TechnicalDetailsCard({ session }: { session: Session }) {
  const [activeTab, setActiveTab] = useState<'ideas' | 'captions' | 'images' | 'videos' | 'trending' | 'dna' | 'prompts'>(
    session.stats.total_videos > 0 ? 'videos' : 'captions'
  );
  const { stats } = session;

  const tabs = [
    { key: 'videos' as const, label: 'Videos', count: stats.total_videos, emoji: '🎬' },
    { key: 'captions' as const, label: 'Captions', count: stats.total_captions, emoji: '✍️' },
    { key: 'ideas' as const, label: 'Ideas', count: stats.total_ideas, emoji: '💡' },
    { key: 'images' as const, label: 'Images', count: stats.total_images, emoji: '🎨' },
    { key: 'trending' as const, label: 'Trending', count: stats.total_trending, emoji: '🔥' },
    { key: 'dna' as const, label: 'DNA', count: session.dna ? 1 : 0, emoji: '🧬' },
    { key: 'prompts' as const, label: 'Prompts', count: session.prompts.length, emoji: '📜' },
  ].filter((t) => t.count > 0);

  return (
    <div
      className="rounded-[16px] overflow-hidden mt-3"
      style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
    >
      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-3 py-2 rounded-[10px] text-[11px] font-semibold whitespace-nowrap transition-all"
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
      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto no-scrollbar">
        {/* Captions tab */}
        {activeTab === 'captions' && session.captions.map((c) => (
          <div key={c.id} className="p-3 rounded-[12px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[12px] font-semibold text-text-primary flex-1">{c.input_text || 'Caption'}</p>
              <StatusBadge status={c.status} />
            </div>
            {c.generated_caption && (
              <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-line mb-2">{c.generated_caption}</p>
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
          <div key={idea.id} className="p-3 rounded-[12px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[12px] font-semibold text-text-primary mb-1">{idea.title}</p>
            {idea.hook && <p className="text-[11px] text-text-secondary mb-2">{idea.hook}</p>}
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
                <div key={img.id} className="rounded-[12px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {imgUrl && (
                    <img src={imgUrl} alt={img.title} className="w-full h-[150px] object-cover" />
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[11px] font-semibold text-text-primary flex-1">{img.title || 'Image'}</p>
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

        {/* Videos tab */}
        {activeTab === 'videos' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {session.videos.map((vid) => {
              const vidUrl = vid.generated_video_with_logo || vid.generated_video;
              return (
                <div key={vid.id} className="rounded-[12px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {vidUrl ? (
                    <video src={vidUrl} className="w-full h-[150px] object-cover" muted playsInline onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                  ) : vid.thumbnail ? (
                    <img src={vid.thumbnail} alt={vid.title} className="w-full h-[150px] object-cover" />
                  ) : null}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[11px] font-semibold text-text-primary flex-1">{vid.title || 'Video'}</p>
                      <StatusBadge status={vid.status} />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {vid.style && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>{vid.style}</span>}
                      {vid.duration && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{vid.duration}s</span>}
                    </div>
                    <ExpandableText label="Prompt" text={vid.prompt} />
                    {vid.error_message && <p className="text-[11px] mt-2" style={{ color: '#ef4444' }}>{vid.error_message}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trending tab */}
        {activeTab === 'trending' && session.trending_topics.map((t) => (
          <div key={t.id} className="flex items-center gap-4 p-3 rounded-[12px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-text-primary">{t.topic}</p>
              {t.relevance_explanation && <p className="text-[11px] text-text-secondary mt-1">{t.relevance_explanation}</p>}
              <div className="flex gap-2 mt-1">
                {t.platform && <span className="text-[10px] text-text-muted">{t.platform}</span>}
                {t.region && <span className="text-[10px] text-text-muted">{t.region}</span>}
              </div>
            </div>
            <div className="text-center flex-shrink-0">
              <div className="text-[16px] font-black" style={{ color: t.volume_score >= 80 ? '#ef4444' : t.volume_score >= 50 ? '#f59e0b' : '#3b82f6' }}>
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
            <div className="p-3 rounded-[12px] space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[14px]">🧬</span>
                <p className="text-[13px] font-bold text-text-primary">Brand DNA Analysis</p>
                {session.website_url && <span className="text-[10px] text-text-muted ml-auto">{session.website_url}</span>}
              </div>
              {entries.length > 0 && (
                <div className="space-y-2">
                  {entries.map(([key, val]) => (
                    <div key={key} className="flex gap-3">
                      <span className="text-[10px] font-semibold text-text-muted min-w-[100px] uppercase tracking-wide">{key.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-text-secondary flex-1">
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
          <div key={p.id} className="p-3 rounded-[12px]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(232,54,79,0.1)', color: 'rgb(var(--c-coral))' }}>
                {p.feature}
              </span>
              <span className="text-[10px] text-text-muted ml-auto">{new Date(p.created_at).toLocaleTimeString()}</span>
            </div>
            <pre className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto no-scrollbar">
              {p.prompt_text}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main session card with posts first, then optional technical details
function SessionCard({ session }: { session: Session }) {
  const [showDetails, setShowDetails] = useState(false);
  const [connectModalError, setConnectModalError] = useState<string | null>(null);
  const { stats } = session;

  const hasTechnicalData = stats.total_captions > 0 || stats.total_images > 0 || stats.total_videos > 0 || stats.total_ideas > 0 || stats.total_trending > 0 || session.dna || session.prompts.length > 0;

  return (
    <div
      className="rounded-[20px] overflow-hidden transition-all duration-300"
      style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-text-primary">
            {formatDate(session.date)}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {session.brand_name && (
              <span className="text-[11px] text-text-muted">🏢 {session.brand_name}</span>
            )}
            {stats.total_posts > 0 && (
              <span className="text-[11px] text-text-muted">📝 {stats.total_posts} posts</span>
            )}
            {stats.total_captions > 0 && (
              <span className="text-[11px] text-text-muted">✍️ {stats.total_captions} captions</span>
            )}
            {stats.total_images > 0 && (
              <span className="text-[11px] text-text-muted">🎨 {stats.total_images} images</span>
            )}
            {stats.total_videos > 0 && (
              <span className="text-[11px] text-text-muted">🎬 {stats.total_videos} videos</span>
            )}
            {stats.total_ideas > 0 && (
              <span className="text-[11px] text-text-muted">💡 {stats.total_ideas} ideas</span>
            )}
          </div>
        </div>
        {hasTechnicalData && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-2 rounded-[10px] text-[12px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
            }}
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
        )}
      </div>

      {/* Posts */}
      {session.posts.length > 0 && (
        <div className="px-6 py-4">
          {session.posts.map((post) => (
            <HistoryPostCard key={post.id} post={post} session={session} onConnectError={setConnectModalError} />
          ))}
        </div>
      )}

      {/* Technical details (expandable) */}
      {showDetails && hasTechnicalData && (
        <div className="px-6 pb-4">
          <TechnicalDetailsCard session={session} />
        </div>
      )}

      {/* No posts message */}
      {session.posts.length === 0 && (
        <div className="px-6 py-6 text-center">
          <p className="text-[12px] text-text-muted">No posts found in this session</p>
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
  const totalPosts = sessions.reduce((s, sess) => s + sess.stats.total_posts, 0);
  const totalImages = sessions.reduce((s, sess) => s + sess.stats.total_images, 0);
  const totalVideos = sessions.reduce((s, sess) => s + sess.stats.total_videos, 0);

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
          Review your Magic Mode posts — draft, publish, or schedule them here.
        </p>
      </div>

      {/* Summary stats */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Sessions', value: totalSessions, emoji: '🚀' },
            { label: 'Posts', value: totalPosts, emoji: '📝' },
            { label: 'Images', value: totalImages, emoji: '🎨' },
            { label: 'Videos', value: totalVideos, emoji: '🎬' },
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
