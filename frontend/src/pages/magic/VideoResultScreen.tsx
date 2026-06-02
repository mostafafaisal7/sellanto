import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore } from '../../store/magicModeStore';
import api from '../../services/api';
import { postService } from '../../services/postService';
import { captionService } from '../../services/captionService';
import hashtagService from '../../services/hashtagService';
import ConnectAccountModal from '../../components/ConnectAccountModal';
import type { PlatformType, CaptionPlatform, CaptionTone } from '../../types';

const platformEmojiMap: Record<string, string> = {
  LinkedIn: '💼', Instagram: '📸', Facebook: '📘', 'Twitter / X': '🐦', TikTok: '🎵',
};

// ---------- Local caption builder (post-ready fallback) ----------
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','for','of','to','in','on','at','by','with','from','as',
  'is','are','was','were','be','been','being','that','this','these','those','it','its','our','your',
  'professional','polished','video','clip','reel','create','make','generate','generated','produce','produced',
  'short','quick','simple','nice','good','great','beautiful','amazing','perfect',
  'helps','help','that','which','who','where','when','why','how','about',
  'will','can','should','would','could','may','might','must','shall','also',
  'business','company','brand','agency','service','services','product','products',
]);

const NICHE_PATTERNS: Array<[RegExp, string]> = [
  [/digital marketing|marketing agency|seo|social media manag|ads? campaign|ppc/i, 'digital marketing'],
  [/real estate|realtor|property|properties/i, 'real estate'],
  [/restaurant|cafe|food|chef|kitchen|menu|catering/i, 'food & beverage'],
  [/fitness|gym|trainer|workout|yoga|coach/i, 'fitness'],
  [/fashion|clothing|apparel|outfit|style/i, 'fashion'],
  [/beauty|skincare|salon|makeup|cosmetic/i, 'beauty'],
  [/saas|software|app|platform|tech|startup/i, 'tech'],
  [/ecommerce|e-commerce|store|shop|retail/i, 'ecommerce'],
  [/education|school|course|tutor|learning/i, 'education'],
  [/health|clinic|doctor|medical|wellness/i, 'health'],
  [/travel|tour|trip|vacation|destination/i, 'travel'],
  [/finance|banking|invest|crypto|trading/i, 'finance'],
];

function detectNiche(prompt: string): string {
  for (const [re, label] of NICHE_PATTERNS) {
    if (re.test(prompt)) return label;
  }
  return 'business';
}

function extractKeywords(prompt: string, max = 6): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  return Array.from(new Set(words)).slice(0, max);
}

function extractBenefit(prompt: string): string {
  // Try to capture "...that helps X..." / "...to X..."
  const m =
    prompt.match(/(?:helps?|enables?|allows?)\s+(?:you\s+|them\s+|customers?\s+to\s+)?([^.,;]+)/i) ||
    prompt.match(/\bto\s+([a-z][^.,;]{8,80})/i) ||
    prompt.match(/\bfor\s+([a-z][^.,;]{8,80})/i);
  if (m && m[1]) {
    return m[1]
      .trim()
      .replace(/\s+and\s+/gi, ' & ')
      .replace(/^(your|their|the|a|an)\s+/i, '')
      .toLowerCase();
  }
  return 'grow your brand and stand out';
}

function buildHashtags(prompt: string, niche: string, platform: string): string {
  const kw = extractKeywords(prompt, 5);
  const nicheTag = niche.replace(/[^a-z]/gi, '');
  const camelTags = kw.map(
    (w) => '#' + w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
  const generic: Record<string, string[]> = {
    instagram: ['#Reels', '#SmallBusiness', '#Entrepreneur', '#ContentCreator'],
    linkedin: ['#Business', '#Growth', '#Leadership', '#Strategy'],
    facebook: ['#Community', '#GrowYourBusiness', '#SmallBusiness'],
    twitter: ['#GrowthHacking', '#Marketing'],
    tiktok: ['#fyp', '#foryou', '#smallbusiness', '#viral'],
    general: ['#Business', '#Growth', '#Marketing'],
  };
  const extras = generic[platform] || generic.general;
  const nicheTagFormatted = nicheTag ? '#' + nicheTag.charAt(0).toUpperCase() + nicheTag.slice(1) : '';
  const all = [nicheTagFormatted, ...camelTags, ...extras].filter(Boolean);
  return Array.from(new Set(all)).slice(0, 8).join(' ');
}

function buildLocalCaption(prompt: string, platform: string): string {
  if (!prompt) return '';
  const niche = detectNiche(prompt);
  const benefit = extractBenefit(prompt);
  const tags = buildHashtags(prompt, niche, platform);

  if (platform === 'twitter') {
    return `🚀 Want to ${benefit}?\n\nStop guessing. Start growing.\nWe help ${niche} brands turn attention into action.\n\n${tags}`;
  }

  if (platform === 'linkedin') {
    return [
      `Most ${niche} brands focus on the wrong thing.`,
      ``,
      `They chase tactics. They miss the system.`,
      ``,
      `The real lever for growth → consistently helping the right people ${benefit}.`,
      `That's what separates brands that scale from brands that stall.`,
      ``,
      `If that's the kind of growth you're after, let's talk. 💬`,
      ``,
      tags,
    ].join('\n');
  }

  if (platform === 'tiktok') {
    return [
      `POV: you finally found the team that helps you ${benefit} 🤝`,
      ``,
      `No more guessing. No more wasted budget.`,
      `Just real growth, on repeat. 📈`,
      ``,
      `💬 Comment "READY" and we'll DM you the details!`,
      ``,
      tags,
    ].join('\n');
  }

  if (platform === 'facebook') {
    return [
      `✨ Looking to ${benefit}?`,
      ``,
      `We work with ambitious ${niche} brands every day — turning attention into action through strategy, story, and content that actually converts.`,
      ``,
      `No fluff. No vanity metrics. Just results that move the needle. 📈`,
      ``,
      `👉 Send us a message to get started — we'd love to hear about your goals.`,
      ``,
      tags,
    ].join('\n');
  }

  // Instagram / general default
  return [
    `✨ Ready to ${benefit}?`,
    ``,
    `We help ambitious ${niche} brands turn attention into action — through strategy, story, and content that actually converts.`,
    ``,
    `No fluff. No vanity metrics. Just results that move the needle. 📈`,
    ``,
    `👉 DM us "READY" or tap the link in bio to get started.`,
    ``,
    tags,
  ].join('\n');
}
// ---------- end caption builder ----------

interface VideoResultScreenProps {
  onBack: () => void;
  onGenerateAnother: () => void;
}

export function VideoResultScreen({ onBack, onGenerateAnother }: VideoResultScreenProps) {
  const navigate = useNavigate();
  const { videoResult, answers, setVideoResult } = useMagicModeStore();

  const videoUrl = videoResult?.videoUrl ?? '';
  const prompt = videoResult?.prompt ?? '';
  // Rich context the video was generated from — used so the caption matches the
  // video (brand voice + creative idea + trending), not just the raw seed prompt.
  const videoPrompt = videoResult?.videoPrompt || prompt;
  const brandId = videoResult?.brandId ?? null;
  const videoIdea = videoResult?.idea ?? null;
  const videoTrending = videoResult?.trendingTopics ?? [];

  const selectedPlatforms: string[] = Array.isArray(answers.platforms)
    ? (answers.platforms as string[])
    : answers.platforms ? [answers.platforms as string] : ['LinkedIn'];

  const [caption, setCaption] = useState('');
  const [captionGenerating, setCaptionGenerating] = useState(true);
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const captionGeneratedRef = useRef(false);

  // Auto-generate a proper social-media caption based on the video prompt
  useEffect(() => {
    if (captionGeneratedRef.current || !prompt) return;
    captionGeneratedRef.current = true;

    const toneMap: Record<string, CaptionTone> = {
      'professional & authoritative': 'professional',
      'friendly & approachable': 'friendly',
      'bold & provocative': 'enthusiastic',
      'educational & helpful': 'formal',
      'fun & casual': 'casual',
    };
    const toneAnswer = answers.tone ? String(answers.tone).toLowerCase() : '';
    const captionTone: CaptionTone = toneMap[toneAnswer] || 'enthusiastic';

    const platformHints: Record<string, string> = {
      linkedin: 'Write for LinkedIn professionals. Industry insight + thought leadership tone. Longer, detailed format focused on business value.',
      instagram: 'Write for Instagram. Short, punchy, visual-first. Use line breaks, natural emojis, storytelling. End with an engagement question.',
      facebook: 'Write for Facebook. Conversational, community-driven, medium length. Encourage comments and shares.',
      twitter: 'Write for Twitter/X. Ultra-concise (under 280 chars), punchy, quotable. Minimal hashtags.',
      tiktok: 'Write for TikTok. Gen-Z friendly, trendy, casual. Viral hooks, short and snappy.',
    };

    const firstPlat = (selectedPlatforms[0] || 'general')
      .toLowerCase()
      .replace(' / x', '') as CaptionPlatform;

    const customInstructions = `This caption is for a short video. ${platformHints[firstPlat] || ''} Open with a strong hook, keep it scannable, and write it as a real social post (not a description of the video). Do not start with phrases like "A professional video..." or "This video shows...".`;

    const localCaption = buildLocalCaption(prompt, firstPlat);

    (async () => {
      try {
        const result = await captionService.generate({
          // Use the rich video prompt (brand + idea + trending synthesised) as the
          // topic, plus the explicit brand/idea/trending context, so the caption
          // reflects the actual video and the brand voice.
          topic: videoPrompt,
          tone: captionTone,
          length: 'medium',
          platform: firstPlat,
          include_hashtags: true,
          include_emojis: true,
          include_cta: true,
          custom_instructions: customInstructions,
          brand_id: brandId && brandId > 0 ? brandId : undefined,
          idea: videoIdea || undefined,
          trending_topics: videoTrending,
          video_prompt: videoPrompt,
        });
        const generated = (result.generated_caption || '').trim();
        const hashtags = (result.generated_hashtags || '').trim();

        // Use the AI caption unless it's effectively empty. The previous
        // "looksDescriptive" regex + 60-char floor was discarding good,
        // brand-aware captions and falling back to a generic local template
        // built from the raw seed prompt — which is exactly why captions
        // didn't match the video. Only fall back on a real empty result.
        let finalCaption: string;
        if (generated && generated.length >= 15) {
          finalCaption = hashtags && !generated.includes('#')
            ? `${generated}\n\n${hashtags}`
            : generated;
        } else {
          finalCaption = localCaption;
        }

        setCaption(finalCaption);
        setDraftCaption(finalCaption);
      } catch (err) {
        console.warn('[VideoResultScreen] AI caption failed, using local builder:', err);
        setCaption(localCaption);
        setDraftCaption(localCaption);
      } finally {
        setCaptionGenerating(false);
      }
    })();
  }, [prompt, answers.tone, selectedPlatforms]);

  const [status, setStatus] = useState<'idle' | 'posting' | 'scheduling' | 'done'>('idle');
  const [postError, setPostError] = useState<string | null>(null);
  const [connectModalError, setConnectModalError] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [finalStatus, setFinalStatus] = useState<'published' | 'scheduled' | null>(null);
  const [draftPostId, setDraftPostId] = useState<number | null>(null);
  const draftCreationStartedRef = useRef(false);

  // Video feedback → regeneration. We save the comment on the original
  // VideoGeneration and start a new one whose prompt includes the feedback.
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [regenGenId, setRegenGenId] = useState<number | null>(null);
  const [regenStatus, setRegenStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [regenJustCompleted, setRegenJustCompleted] = useState(false);

  const publishPlatforms = selectedPlatforms.map(
    (p) => p.toLowerCase().replace(' / x', '') as PlatformType
  );

  // Auto-save the generated video as a draft Post as soon as caption + video are ready.
  // This guarantees the user sees it in Magic History even if they navigate away
  // without explicitly publishing or scheduling.
  useEffect(() => {
    if (draftCreationStartedRef.current) return;
    if (!videoUrl || !caption || captionGenerating) return;
    draftCreationStartedRef.current = true;

    (async () => {
      try {
        // Attach the generated video by reference (it's already saved server-side)
        // instead of re-fetching it in the browser — that fetch silently failed
        // for cross-origin video URLs, so the draft was never created and the
        // video never showed up in Draft Posts or Magic History.
        const draft = await postService.create({
          caption,
          video_generation_id: videoResult?.generationId,
          platforms: publishPlatforms,
          source: 'magic',
          status: 'draft',
          hook: prompt.slice(0, 60),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setDraftPostId(draft.id);
      } catch (err) {
        console.warn('[VideoResultScreen] Auto-draft creation failed:', err);
        draftCreationStartedRef.current = false;
      }
    })();
  }, [videoUrl, caption, captionGenerating]);

  // Keep the draft caption in sync if the user edits it after auto-save.
  useEffect(() => {
    if (!draftPostId || !caption) return;
    const t = setTimeout(() => {
      postService.update(draftPostId, { caption }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [caption, draftPostId]);

  // Auto-generate hashtags as the last step, based on the video + caption.
  // Runs once per draft, after the draft post + caption are both ready.
  const hashtagsGeneratedRef = useRef(false);
  useEffect(() => {
    if (hashtagsGeneratedRef.current) return;
    if (!draftPostId || !caption || captionGenerating) return;
    hashtagsGeneratedRef.current = true;

    const platform = (publishPlatforms[0] || 'instagram').toLowerCase();
    hashtagService
      .generateHashtags(draftPostId, { platform, topic: prompt.slice(0, 120) })
      .catch((err) => {
        console.warn('[VideoResultScreen] Hashtag generation failed:', err);
        hashtagsGeneratedRef.current = false;
      });
  }, [draftPostId, caption, captionGenerating, publishPlatforms, prompt]);

  // Submit user feedback on the current video and kick off a regeneration.
  const handleSubmitFeedback = async () => {
    const originalGenId = videoResult?.generationId;
    const trimmed = feedbackText.trim();
    if (!originalGenId || !trimmed || feedbackSubmitting || regenStatus === 'processing') return;

    setFeedbackSubmitting(true);
    setFeedbackError(null);
    try {
      const res = await api.post(`/video/${originalGenId}/feedback/`, {
        feedback: trimmed,
      });
      setRegenGenId(res.data.generation_id);
      setRegenStatus('processing');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setFeedbackError(e?.response?.data?.error || e?.message || 'Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Poll the regeneration job. Mirrors the loop shape used in VideoWorkingScreen.
  useEffect(() => {
    if (!regenGenId || regenStatus !== 'processing') return;
    let cancelled = false;
    const deadline = Date.now() + 10 * 60 * 1000;

    (async () => {
      while (!cancelled && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        if (cancelled) return;
        try {
          const r = await api.get(`/video/status/${regenGenId}/`);
          const data = r.data as { status: string; video_url?: string; error?: string };
          if (data.status === 'completed' && data.video_url) {
            // Swap the player's source and reset the feedback box.
            setVideoResult({
              videoUrl: data.video_url,
              generationId: regenGenId,
              prompt: videoResult?.prompt ?? '',
              style: videoResult?.style ?? '',
            });
            setRegenStatus('completed');
            setRegenJustCompleted(true);
            setFeedbackText('');
            // Re-create the post draft so the new video is what gets posted.
            draftCreationStartedRef.current = false;
            setDraftPostId(null);
            return;
          }
          if (data.status === 'failed') {
            setRegenStatus('failed');
            setFeedbackError(data.error || 'Regeneration failed');
            return;
          }
        } catch {
          // transient network error — keep polling until deadline
        }
      }
      if (!cancelled) {
        setRegenStatus('failed');
        setFeedbackError('Regeneration timed out');
      }
    })();

    return () => { cancelled = true; };
  }, [regenGenId, regenStatus, setVideoResult, videoResult?.prompt, videoResult?.style]);

  const handlePost = async () => {
    setStatus('posting');
    setPostError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      const scheduledTime = now.toISOString();

      if (draftPostId) {
        await postService.update(draftPostId, {
          caption,
          status: 'scheduled',
          scheduled_time: scheduledTime,
          timezone,
        });
      } else {
        const created = await postService.create({
          caption,
          video_generation_id: videoResult?.generationId,
          platforms: publishPlatforms,
          source: 'magic',
          hook: prompt.slice(0, 60),
          scheduled_time: scheduledTime,
          timezone,
        });
        setDraftPostId(created.id);
      }
      setFinalStatus('published');
      setStatus('done');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to post.';
      if (msg.toLowerCase().includes('no connected account')) {
        setConnectModalError(msg);
      } else {
        setPostError(msg);
      }
      setStatus('idle');
    }
  };

  const handleSchedule = async () => {
    if (!schedDate || !schedTime) return;
    setStatus('scheduling');
    setPostError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const scheduledTime = new Date(`${schedDate}T${schedTime}`).toISOString();

      if (draftPostId) {
        await postService.update(draftPostId, {
          caption,
          status: 'scheduled',
          scheduled_time: scheduledTime,
          timezone,
        });
      } else {
        const created = await postService.create({
          caption,
          video_generation_id: videoResult?.generationId,
          platforms: publishPlatforms,
          source: 'magic',
          hook: prompt.slice(0, 60),
          scheduled_time: scheduledTime,
          timezone,
        });
        setDraftPostId(created.id);
      }
      setFinalStatus('scheduled');
      setStatus('done');
      setShowScheduler(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to schedule.';
      if (msg.toLowerCase().includes('no connected account')) {
        setConnectModalError(msg);
      } else {
        setPostError(msg);
      }
      setStatus('idle');
    }
  };

  if (status === 'done' && finalStatus) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'rgb(var(--c-bg-primary))' }}
      >
        <div
          className="w-full max-w-[480px] rounded-[24px] p-8 text-center scale-in"
          style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
        >
          <div className="text-[52px] mb-4">{finalStatus === 'published' ? '🚀' : '📅'}</div>
          <h2 className="text-[26px] font-extrabold text-text-primary mb-2">
            {finalStatus === 'published' ? 'Video posted!' : 'Video scheduled!'}
          </h2>
          <p className="text-[15px] text-text-secondary mb-8">
            {finalStatus === 'published'
              ? 'Your video is on its way to your platforms.'
              : `Scheduled for ${new Date(`${schedDate}T${schedTime}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onGenerateAnother}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))', boxShadow: 'var(--shadow-glow-coral)' }}
            >
              🎬 Generate another video
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col p-10 pb-5"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Header */}
      <div className="w-full max-w-[680px] mx-auto mb-6">
        <div className="flex items-center gap-3">
          <span className="text-[36px]">🎬</span>
          <div>
            <h1 className="text-[26px] font-extrabold text-text-primary" style={{ letterSpacing: '-0.3px' }}>
              Your video is ready!
            </h1>
            <p className="text-[14px] text-text-secondary">Review, edit caption, then post or schedule.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-[680px] mx-auto w-full gap-5">
        {/* Video player */}
        <div
          className="rounded-[18px] overflow-hidden"
          style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)' }}
        >
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full"
            style={{ maxHeight: 420, background: '#000' }}
          />
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[13px] text-text-muted truncate max-w-[70%]">{prompt}</p>
            <a
              href={videoUrl}
              download="generated-video.mp4"
              className="text-[13px] font-semibold px-3 py-1.5 rounded-[8px]"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
            >
              ⬇ Download
            </a>
          </div>
        </div>

        {/* Platforms */}
        <div>
          <p className="text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">Posting to</p>
          <div className="flex flex-wrap gap-2">
            {selectedPlatforms.map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 rounded-full text-[13px] font-semibold"
                style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
              >
                {platformEmojiMap[p] || '📱'} {p}
              </span>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide">Caption</p>
            {!editingCaption && !captionGenerating && (
              <button
                onClick={() => { setDraftCaption(caption); setEditingCaption(true); }}
                className="text-[12px] font-semibold px-3 py-1 rounded-[8px]"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {editingCaption ? (
            <div>
              <textarea
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                rows={4}
                className="w-full text-[14px] resize-none"
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: '1.5px solid rgba(232,54,79,0.3)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgb(var(--c-text-primary))',
                  outline: 'none',
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setCaption(draftCaption); setEditingCaption(false); }}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCaption(false)}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-[12px] px-4 py-3 text-[14px] text-text-secondary leading-relaxed whitespace-pre-line"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}
            >
              {captionGenerating ? (
                <span className="flex items-center gap-2 text-text-muted">
                  <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'rgb(var(--c-coral))' }} />
                  Crafting the perfect caption…
                </span>
              ) : caption}
            </div>
          )}
        </div>

        {/* Error */}
        {postError && (
          <div
            className="rounded-[10px] px-4 py-3 text-[13px]"
            style={{ background: 'rgba(232,54,79,0.08)', border: '1px solid rgba(232,54,79,0.2)', color: 'rgb(var(--c-coral))' }}
          >
            {postError}
          </div>
        )}

        {/* Video feedback → regeneration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide">
              Want to improve this video?
            </p>
            {regenJustCompleted && (
              <button
                onClick={() => setRegenJustCompleted(false)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)' }}
              >
                ✓ Updated based on your feedback
              </button>
            )}
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="What should we change? e.g. 'Slower pacing, more cinematic.' (Regenerating costs 800 diamonds.)"
            rows={2}
            disabled={feedbackSubmitting || regenStatus === 'processing' || captionGenerating}
            className="w-full text-[13px] resize-none"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgb(var(--c-text-primary))',
              outline: 'none',
              opacity: regenStatus === 'processing' ? 0.5 : 1,
            }}
          />
          <div className="flex items-center justify-between mt-2 gap-3">
            <p className="text-[12px] text-text-muted flex-1">
              {regenStatus === 'processing'
                ? 'Regenerating with your feedback… (1–3 min)'
                : regenStatus === 'failed' && feedbackError
                  ? feedbackError
                  : 'Feedback is saved to this video and used to generate an improved version.'}
            </p>
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || feedbackSubmitting || regenStatus === 'processing' || captionGenerating}
              className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                opacity: !feedbackText.trim() || feedbackSubmitting || regenStatus === 'processing' ? 0.5 : 1,
              }}
            >
              {feedbackSubmitting
                ? 'Submitting…'
                : regenStatus === 'processing'
                  ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                      Regenerating…
                    </span>
                  )
                  : '🔁 Regenerate with feedback'}
            </button>
          </div>
        </div>

        {/* Scheduler */}
        {showScheduler && (
          <div
            className="rounded-[14px] px-5 py-4 flex flex-wrap items-center gap-3"
            style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}
          >
            <input
              type="date"
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-[13px] px-3 py-2 rounded-[10px] focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
            />
            <input
              type="time"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
              className="text-[13px] px-3 py-2 rounded-[10px] focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
            />
            <button
              onClick={handleSchedule}
              disabled={!schedDate || !schedTime || status === 'scheduling'}
              className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))',
                opacity: !schedDate || !schedTime || status === 'scheduling' ? 0.5 : 1,
              }}
            >
              {status === 'scheduling' ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
            <button
              onClick={() => setShowScheduler(false)}
              className="text-[13px] font-semibold"
              style={{ color: 'rgb(var(--c-text-muted))' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            disabled={status === 'posting' || status === 'scheduling' || captionGenerating}
            className="flex-1 py-3.5 rounded-[14px] text-[15px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'rgb(var(--c-text-primary))',
              opacity: captionGenerating ? 0.5 : 1,
            }}
          >
            📅 Schedule
          </button>
          <button
            onClick={handlePost}
            disabled={status === 'posting' || status === 'scheduling' || captionGenerating}
            className="flex-1 py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
              boxShadow: 'var(--shadow-glow-coral)',
              opacity: status === 'posting' || captionGenerating ? 0.7 : 1,
            }}
          >
            {status === 'posting' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                Posting…
              </span>
            ) : '🚀 Post Now'}
          </button>
        </div>

        <button
          onClick={onGenerateAnother}
          className="text-[13px] font-semibold text-center py-2"
          style={{ color: 'rgb(var(--c-coral))' }}
        >
          + Generate another video
        </button>
      </div>

      {/* Back */}
      <div className="w-full max-w-[680px] mx-auto pt-4">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>

      <ConnectAccountModal
        open={!!connectModalError}
        message={connectModalError || ''}
        onClose={() => setConnectModalError(null)}
      />
    </div>
  );
}

export default VideoResultScreen;
