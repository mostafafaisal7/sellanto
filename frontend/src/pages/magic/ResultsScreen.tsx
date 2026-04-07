import { useState, useEffect, useRef } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore, type MagicPost } from '../../store/magicModeStore';
import { FeedbackModal } from '../../components/redesign/FeedbackModal';
import captionService from '../../services/captionService';
import imageService from '../../services/imageService';
import strategyService from '../../services/strategyService';
import { postService } from '../../services/postService';
import type { CaptionPlatform, CaptionTone, PlatformType } from '../../types';

const platformEmojiMap: Record<string, string> = {
  LinkedIn: '💼', Instagram: '📸', Facebook: '📘', 'Twitter / X': '🐦', TikTok: '🎵',
};

function PlatformCaptionEditor({ platform, caption, onSave, onFeedback, onDelete }: {
  platform: string;
  caption: string;
  onSave: (text: string) => void;
  onFeedback: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(caption);

  return (
    <div
      className="rounded-[12px] p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px]">{platformEmojiMap[platform] || '📱'}</span>
        <span className="text-[12px] font-bold text-text-secondary">{platform}</span>
        <button
          onClick={onDelete}
          className="ml-auto p-1 rounded-[6px] transition-colors hover:bg-white/5"
          title="Remove platform"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgb(239,68,68)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
          </svg>
        </button>
      </div>
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full text-[12px] leading-relaxed rounded-[8px] p-2 resize-none min-h-[100px] focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,54,79,0.2)', color: 'rgb(var(--c-text-primary))' }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { onSave(text); setEditing(false); }}
              className="px-3 py-1.5 rounded-[8px] text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}
            >
              Save
            </button>
            <button
              onClick={() => { setText(caption); setEditing(false); }}
              className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(var(--c-text-muted))' }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={`text-[12px] text-text-secondary leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-4'} mb-1`}>
            {caption}
          </p>
          {caption.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold mb-2"
              style={{ color: 'rgb(var(--c-coral))' }}
            >
              {expanded ? 'Show less' : 'See more...'}
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setText(caption); setEditing(true); }}
              className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={onFeedback}
              className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-primary))' }}
            >
              💬 Give feedback
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PostCard({ post, index, justUpdated, onApproveClick }: { post: MagicPost; index: number; justUpdated?: boolean; onApproveClick: (postId: number) => void }) {
  const { resetPostStatus, openFeedback, generatedPosts, setGeneratedPosts } = useMagicModeStore();
  const isApproved = post.status === 'approved';
  const isPublished = post.status === 'published';
  const isScheduled = post.status === 'scheduled';
  const isFinal = isPublished || isScheduled;
  const [publishing, setPublishing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editedText, setEditedText] = useState(post.caption);
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const platformEmoji: Record<string, string> = {
    LinkedIn: '💼', Instagram: '📸', Facebook: '📘', Twitter: '🐦', TikTok: '🎵',
  };

  // Helper: delete draft from localStorage map
  const deleteDraft = async () => {
    try {
      const draftMap = JSON.parse(localStorage.getItem('magic_draft_post_ids') || '{}');
      const entry = draftMap[post.id];
      const draftId = typeof entry === 'number' ? entry : entry?.draftId;
      if (draftId) {
        await postService.delete(draftId);
        delete draftMap[post.id];
        localStorage.setItem('magic_draft_post_ids', JSON.stringify(draftMap));
      }
    } catch { /* ignore */ }
  };

  // Helper: download image as File
  const downloadImageAsFile = async (): Promise<File[]> => {
    if (!post.imageUrl) return [];
    try {
      const res = await fetch(post.imageUrl);
      const blob = await res.blob();
      const ext = post.imageUrl.split('.').pop()?.split('?')[0] || 'png';
      return [new File([blob], `generated-image.${ext}`, { type: blob.type || 'image/png' })];
    } catch { return []; }
  };

  // Get platforms to publish to
  const publishPlatforms = post.approvedPlatforms?.length
    ? post.approvedPlatforms.map((p) => p.toLowerCase().replace(' / x', '').replace('twitter', 'twitter'))
    : [post.platform.toLowerCase()];

  const handleScheduleConfirm = async () => {
    if (!schedDate || !schedTime) return;
    setScheduling(true);
    try {
      const mediaFiles = await downloadImageAsFile();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const scheduledTime = new Date(`${schedDate}T${schedTime}`).toISOString();

      // Create posts for each platform (or one with multiple platforms)
      if (post.platformCaptions && Object.keys(post.platformCaptions).length > 1) {
        for (const [plat, caption] of Object.entries(post.platformCaptions)) {
          const platKey = plat.toLowerCase().replace(' / x', '').replace('twitter', 'twitter') as import('../../types').PlatformType;
          await postService.create({
            caption,
            media_files: mediaFiles,
            platforms: [platKey],
            source: 'magic',
            hook: post.title,
            scheduled_time: scheduledTime,
            timezone,
          });
        }
      } else {
        await postService.create({
          caption: post.caption,
          media_files: mediaFiles,
          platforms: publishPlatforms as import('../../types').PlatformType[],
          source: 'magic',
          hook: post.title,
          scheduled_time: scheduledTime,
          timezone,
        });
      }

      await deleteDraft();
      setGeneratedPosts(
        generatedPosts.map((p) =>
          p.id === post.id ? { ...p, status: 'scheduled' as const, scheduledTime: scheduledTime } : p
        )
      );
      setShowScheduler(false);
    } catch { /* silent */ }
    setScheduling(false);
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const result = await imageService.generate({
        prompt: `Create a professional social media image for: "${post.title}". ${post.imageStyle || ''}`,
        title: post.title,
        // provider: 'openai',  // OpenAI billing limit reached
        provider: 'gemini',
        style: 'modern',
        enhance_prompt: true,
      });
      const imgUrl = result.generated_image_with_logo || result.generated_image || result.composited_image;
      if (imgUrl) {
        setGeneratedPosts(
          generatedPosts.map((p) =>
            p.id === post.id ? { ...p, imageUrl: imgUrl } : p
          )
        );
      }
    } catch {
      // Silent fail — user can retry
    }
    setGeneratingImage(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const mediaFiles = await downloadImageAsFile();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Schedule 1 minute in the future = "publish now"
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      const scheduledTime = now.toISOString();

      if (post.platformCaptions && Object.keys(post.platformCaptions).length > 1) {
        for (const [plat, caption] of Object.entries(post.platformCaptions)) {
          const platKey = plat.toLowerCase().replace(' / x', '').replace('twitter', 'twitter') as import('../../types').PlatformType;
          await postService.create({
            caption,
            media_files: mediaFiles,
            platforms: [platKey],
            source: 'magic',
            hook: post.title,
            scheduled_time: scheduledTime,
            timezone,
          });
        }
      } else {
        await postService.create({
          caption: post.caption,
          media_files: mediaFiles,
          platforms: publishPlatforms as import('../../types').PlatformType[],
          source: 'magic',
          hook: post.title,
          scheduled_time: scheduledTime,
          timezone,
        });
      }

      await deleteDraft();
      setGeneratedPosts(
        generatedPosts.map((p) =>
          p.id === post.id ? { ...p, status: 'published' as const } : p
        )
      );
    } catch { /* silent */ }
    setPublishing(false);
  };

  return (
    <div
      className={`rounded-[20px] overflow-hidden transition-all duration-300 au${Math.min(index + 1, 5)}`}
      style={{
        background: 'rgb(var(--c-bg-card))',
        border: `1.5px solid ${justUpdated ? 'rgba(16,185,129,0.5)' : isFinal ? 'rgba(16,185,129,0.4)' : isApproved ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
        boxShadow: justUpdated ? '0 0 20px rgba(16,185,129,0.15)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-[13px] font-semibold text-text-secondary">Post {index + 1}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {post.approvedPlatforms && post.approvedPlatforms.length > 0
            ? post.approvedPlatforms.map((plat) => (
                <span
                  key={plat}
                  className="px-3 py-1 rounded-full text-[12px] font-semibold"
                  style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
                >
                  {platformEmojiMap[plat] || '📱'} {plat}
                </span>
              ))
            : (
              <span
                className="px-3 py-1 rounded-full text-[12px] font-semibold"
                style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
              >
                {platformEmoji[post.platform] || '📱'} {post.platform}
              </span>
            )
          }
          {isApproved && (
            <span
              className="px-3 py-1 rounded-full text-[12px] font-semibold pop"
              style={{ background: 'rgba(16,185,129,0.1)', color: 'rgb(var(--c-green))' }}
            >
              ✓ Approved
            </span>
          )}
          {isPublished && (
            <span
              className="px-3 py-1 rounded-full text-[12px] font-semibold pop"
              style={{ background: 'rgba(16,185,129,0.1)', color: 'rgb(var(--c-green))' }}
            >
              ✓ Published
            </span>
          )}
          {isScheduled && (
            <span
              className="px-3 py-1 rounded-full text-[12px] font-semibold pop"
              style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}
            >
              📅 Scheduled
            </span>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Image preview */}
        <div
          className="flex flex-col items-center justify-center p-8 min-h-[300px]"
          style={{
            background: post.imageUrl
              ? undefined
              : 'linear-gradient(135deg, #1a1a3e, #0d0d2a, #1e1e4a)',
            borderRight: '1px solid var(--border-color)',
          }}
        >
          {post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-full object-cover rounded-lg"
              style={{ maxHeight: 300 }}
            />
          ) : (
            <>
              {generatingImage ? (
                <>
                  <div
                    className="animate-spin rounded-full h-10 w-10 border-b-2 mb-4"
                    style={{ borderColor: 'rgb(var(--c-coral))' }}
                  />
                  <p className="text-[13px] text-text-muted">Generating image...</p>
                </>
              ) : (
                <>
                  <span className="text-[40px] opacity-60 mb-3">🎨</span>
                  <p className="text-[13px] text-text-muted mb-4 text-center max-w-[220px]">
                    {post.imageOverlay}
                  </p>
                  <button
                    onClick={handleGenerateImage}
                    className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-white transition-all duration-200"
                    style={{
                      background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                      boxShadow: '0 2px 10px rgba(232,54,79,0.3)',
                    }}
                  >
                    🖼️ Generate Image
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Caption */}
        <div className="p-6 flex flex-col">
          <h3 className="text-[16px] font-bold text-text-primary mb-3">{post.title}</h3>
          {post.platformCaptions && Object.keys(post.platformCaptions).length > 1 ? (
            /* Per-platform captions view */
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[320px] no-scrollbar">
              {Object.entries(post.platformCaptions).map(([plat, caption]) => (
                <PlatformCaptionEditor
                  key={plat}
                  platform={plat}
                  caption={caption}
                  onSave={(newCaption) => {
                    const updated = { ...post.platformCaptions, [plat]: newCaption };
                    setGeneratedPosts(
                      generatedPosts.map((p) =>
                        p.id === post.id ? { ...p, platformCaptions: updated } : p
                      )
                    );
                  }}
                  onFeedback={() => openFeedback(post.id)}
                  onDelete={() => {
                    const remaining = { ...post.platformCaptions };
                    delete remaining[plat];
                    const remainingPlatforms = (post.approvedPlatforms || []).filter((ap) => ap !== plat);
                    const entries = Object.entries(remaining);
                    if (entries.length <= 1) {
                      // Collapse to single-caption mode
                      setGeneratedPosts(
                        generatedPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                platformCaptions: undefined,
                                approvedPlatforms: remainingPlatforms.length > 0 ? remainingPlatforms : undefined,
                                caption: entries.length === 1 ? entries[0][1] : p.caption,
                              }
                            : p
                        )
                      );
                    } else {
                      setGeneratedPosts(
                        generatedPosts.map((p) =>
                          p.id === post.id
                            ? { ...p, platformCaptions: remaining, approvedPlatforms: remainingPlatforms }
                            : p
                        )
                      );
                    }
                  }}
                />
              ))}
            </div>
          ) : editingCaption ? (
            <div className="flex-1 flex flex-col">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="flex-1 text-[13px] text-text-primary leading-relaxed rounded-[10px] p-3 resize-none min-h-[180px] focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1.5px solid rgba(232,54,79,0.3)',
                  color: 'rgb(var(--c-text-primary))',
                }}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setGeneratedPosts(
                      generatedPosts.map((p) =>
                        p.id === post.id ? { ...p, caption: editedText } : p
                      )
                    );
                    setEditingCaption(false);
                  }}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditedText(post.caption); setEditingCaption(false); }}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgb(var(--c-text-secondary))' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 text-[13px] text-text-secondary leading-relaxed overflow-y-auto max-h-[220px] whitespace-pre-line no-scrollbar"
            >
              {post.caption}
            </div>
          )}
        </div>
      </div>

      {/* Inline schedule picker */}
      {showScheduler && (
        <div
          className="flex items-center gap-3 px-6 py-3"
          style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(59,130,246,0.04)' }}
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
            onClick={handleScheduleConfirm}
            disabled={!schedDate || !schedTime || scheduling}
            className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))',
              opacity: !schedDate || !schedTime || scheduling ? 0.5 : 1,
            }}
          >
            {scheduling ? 'Scheduling...' : 'Confirm'}
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

      {/* Actions */}
      <div
        className="flex items-center justify-end gap-3 px-6 py-3.5"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        {isFinal ? (
          <span
            className="px-4 py-2.5 rounded-[14px] text-[14px] font-bold"
            style={{
              background: isPublished ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
              color: isPublished ? 'rgb(var(--c-green))' : 'rgb(59,130,246)',
            }}
          >
            {isPublished ? '✓ Published' : `📅 Scheduled${post.scheduledTime ? ` — ${new Date(post.scheduledTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`}
          </span>
        ) : !isApproved ? (
          <>
            <button
              onClick={() => { setEditedText(post.caption); setEditingCaption(true); }}
              className="px-4 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-primary))',
              }}
            >
              ✏️ Edit caption
            </button>
            <button
              onClick={() => openFeedback(post.id)}
              className="px-4 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-primary))',
              }}
            >
              💬 Give feedback
            </button>
            <button
              onClick={() => onApproveClick(post.id)}
              className="px-5 py-2.5 rounded-[14px] text-[14px] font-bold text-white transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              ✓ Approve this post
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowScheduler(!showScheduler)}
              className="px-4 py-2.5 rounded-[14px] text-[14px] font-semibold text-text-secondary"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
              }}
            >
              {post.platformCaptions && Object.keys(post.platformCaptions).length > 1 ? '📅 Schedule All' : '📅 Schedule'}
            </button>
            <button
              onClick={() => resetPostStatus(post.id)}
              className="px-4 py-2.5 rounded-[14px] text-[14px] font-semibold text-text-secondary"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-5 py-2.5 rounded-[14px] text-[14px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
                opacity: publishing ? 0.6 : 1,
              }}
            >
              {publishing ? '...' : post.platformCaptions && Object.keys(post.platformCaptions).length > 1 ? '🚀 Publish All' : '🚀 Publish Now'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface ResultsScreenProps {
  onGenerateMore: () => void;
  onGoBack: () => void;
}

export function ResultsScreen({ onGenerateMore, onGoBack }: ResultsScreenProps) {
  const magicStore = useMagicModeStore();
  const { generatedPosts, feedbackModal, closeFeedback, resetPostStatus, setPostCount, postCount, setGeneratedPosts, approvePost, answers } = magicStore;
  const allApproved = generatedPosts.length > 0 && generatedPosts.every((p) => p.status === 'approved' || p.status === 'published' || p.status === 'scheduled');
  const approvedCount = generatedPosts.filter((p) => p.status !== 'ready').length;
  const [showMore, setShowMore] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null); // null or description text
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [justUpdatedId, setJustUpdatedId] = useState<number | null>(null);

  // Approve modal state
  const [approveModalPostId, setApproveModalPostId] = useState<number | null>(null);
  const selectedPlatforms: string[] = Array.isArray(answers.platforms) ? answers.platforms as string[] : [];

  const handleApproveClick = (postId: number) => {
    if (selectedPlatforms.length <= 1) {
      // Only one platform — skip modal, approve directly
      approvePost(postId);
    } else {
      setApproveModalPostId(postId);
    }
  };

  const handleApproveSameCaptions = () => {
    if (approveModalPostId === null) return;
    setGeneratedPosts(
      generatedPosts.map((p) =>
        p.id === approveModalPostId
          ? { ...p, status: 'approved' as const, approvedPlatforms: selectedPlatforms }
          : p
      )
    );
    setApproveModalPostId(null);
  };

  const handleApproveDifferentCaptions = async () => {
    if (approveModalPostId === null) return;
    const post = generatedPosts.find((p) => p.id === approveModalPostId);
    if (!post) return;

    setApproveModalPostId(null);
    setRegenerating('Generating captions for each platform...');

    // Tone mapping (same as handleFeedbackSubmit)
    const toneMap: Record<string, CaptionTone> = {
      'professional & authoritative': 'professional',
      'friendly & approachable': 'friendly',
      'bold & provocative': 'enthusiastic',
      'educational & helpful': 'formal',
      'fun & casual': 'casual',
    };
    const toneAnswer = answers.tone ? String(answers.tone).toLowerCase() : '';
    const captionTone: CaptionTone = toneMap[toneAnswer] || 'professional';

    // Platform-specific AI instructions for truly different captions
    const platformHints: Record<string, string> = {
      linkedin: 'Write for LinkedIn professionals. Use industry insights, thought leadership tone. Longer, detailed format. Focus on business value and professional growth.',
      instagram: 'Write for Instagram. Short, punchy, visual-first. Use line breaks, emojis naturally. Focus on storytelling and relatability. End with engagement question.',
      facebook: 'Write for Facebook. Conversational, community-driven. Medium length. Encourage comments and shares. Use a personal, friendly voice.',
      twitter: 'Write for Twitter/X. Ultra-concise, max 280 chars. Punchy, quotable. Use hooks and hot takes. Minimal hashtags.',
      tiktok: 'Write for TikTok. Gen-Z friendly, trendy, casual. Use viral hooks. Short and snappy. Reference trending formats.',
    };

    try {
      // Generate unique captions for each platform in parallel
      const results = await Promise.all(
        selectedPlatforms.map(async (plat) => {
          const platKey = plat.toLowerCase().replace(' / x', '') as CaptionPlatform;
          const result = await captionService.generate({
            topic: post.title,
            tone: captionTone,
            length: 'medium',
            platform: platKey,
            include_hashtags: true,
            include_emojis: true,
            include_cta: true,
            custom_instructions: platformHints[platKey] || `Write specifically for ${plat}. Tailor the tone, length, and style to what performs best on ${plat}.`,
          });
          return { plat, caption: result.generated_caption || post.caption };
        })
      );

      const platformCaptions: Record<string, string> = {};
      results.forEach(({ plat, caption }) => { platformCaptions[plat] = caption; });

      setGeneratedPosts(
        generatedPosts.map((p) =>
          p.id === approveModalPostId
            ? { ...p, status: 'approved' as const, approvedPlatforms: selectedPlatforms, platformCaptions }
            : p
        )
      );
    } catch {
      // Fallback: use same caption if generation fails
      const platformCaptions: Record<string, string> = {};
      selectedPlatforms.forEach((plat) => { platformCaptions[plat] = post.caption; });
      setGeneratedPosts(
        generatedPosts.map((p) =>
          p.id === approveModalPostId
            ? { ...p, status: 'approved' as const, approvedPlatforms: selectedPlatforms, platformCaptions }
            : p
        )
      );
      setRegenerateError('Failed to generate unique captions. Using same caption as fallback.');
    }
    setRegenerating(null);
  };

  useEffect(() => {
    if (allApproved) {
      const t = setTimeout(() => setShowMore(true), 600);
      return () => clearTimeout(t);
    }
    setShowMore(false);
  }, [allApproved]);

  // Clear error after 4 seconds
  useEffect(() => {
    if (regenerateError) {
      const t = setTimeout(() => setRegenerateError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [regenerateError]);

  // Clear success flash after 2 seconds
  useEffect(() => {
    if (justUpdatedId !== null) {
      const t = setTimeout(() => setJustUpdatedId(null), 2000);
      return () => clearTimeout(t);
    }
  }, [justUpdatedId]);

  // Auto-save all generated posts as drafts (and re-save when images change)
  const draftSaveInProgress = useRef(false);
  useEffect(() => {
    if (generatedPosts.length === 0 || draftSaveInProgress.current) return;
    draftSaveInProgress.current = true;

    // Format: { [postId]: { draftId, imageUrl } } — migrate from old number format
    const rawMap = JSON.parse(localStorage.getItem('magic_draft_post_ids') || '{}');
    const savedMap: Record<number, { draftId: number; imageUrl: string | null }> = {};
    for (const [k, v] of Object.entries(rawMap)) {
      if (typeof v === 'number') {
        savedMap[Number(k)] = { draftId: v, imageUrl: null };
      } else if (v && typeof v === 'object' && 'draftId' in (v as object)) {
        savedMap[Number(k)] = v as { draftId: number; imageUrl: string | null };
      }
    }

    // Needs save = not saved at all, OR imageUrl changed since last save
    const needsSave = generatedPosts.filter((p) => {
      const entry = savedMap[p.id];
      if (!entry) return true;
      if (p.imageUrl && p.imageUrl !== entry.imageUrl) return true;
      return false;
    });
    if (needsSave.length === 0) { draftSaveInProgress.current = false; return; }

    (async () => {
      for (const post of needsSave) {
        try {
          const mediaFiles: File[] = [];
          if (post.imageUrl) {
            try {
              const res = await fetch(post.imageUrl);
              const blob = await res.blob();
              const ext = post.imageUrl.split('.').pop()?.split('?')[0] || 'png';
              mediaFiles.push(new File([blob], `generated-image.${ext}`, { type: blob.type || 'image/png' }));
            } catch { /* skip media */ }
          }

          // If draft already exists (image changed), delete old one first
          const existing = savedMap[post.id];
          if (existing?.draftId) {
            try { await postService.delete(existing.draftId); } catch { /* ignore */ }
          }

          const draft = await postService.create({
            caption: post.caption,
            media_files: mediaFiles,
            platforms: [post.platform.toLowerCase() as PlatformType],
            source: 'magic',
            status: 'draft',
            hook: post.title,
          });
          savedMap[post.id] = { draftId: draft.id, imageUrl: post.imageUrl || null };
        } catch { /* silent */ }
      }
      localStorage.setItem('magic_draft_post_ids', JSON.stringify(savedMap));
      draftSaveInProgress.current = false;
    })();
  }, [generatedPosts]);

  // Go back — drafts are already auto-saved, just navigate
  const handleGoBackWithSave = () => {
    onGoBack();
  };

  const handleFeedbackSubmit = async (feedback: Record<string, string>) => {
    if (!feedbackModal) return;

    const post = generatedPosts.find((p) => p.id === feedbackModal.postId);
    if (!post) { closeFeedback(); return; }

    const isTopicFeedback = feedback.what === 'The overall topic';
    const isImageFeedback = feedback.what === 'The image style';

    const overlayLabel = isTopicFeedback
      ? `Regenerating entire post "${post.title}"...`
      : isImageFeedback
        ? `Regenerating image for "${post.title}"...`
        : `Regenerating caption for "${post.title}"...`;

    setRegenerating(overlayLabel);
    setRegenerateError(null);
    closeFeedback();

    // Build clean feedback text
    const feedbackText = feedback.custom
      || feedback.caption_fix
      || feedback.tone_fix
      || feedback.topic_fix
      || feedback.image_fix
      || Object.entries(feedback).filter(([k]) => k !== 'what').map(([, v]) => v).filter(Boolean).join('. ')
      || feedback.what
      || '';

    try {
      if (isTopicFeedback && post.ideaId) {
        // --- Full regeneration: new idea + new caption + new image ---
        // 1. Regenerate idea
        const newIdea = await strategyService.regenerateIdea(
          post.ideaId,
          `Generate a ${feedbackText} style post. Create a completely new topic and angle.`
        );

        // 2. Generate new caption for the new idea
        const toneMap: Record<string, CaptionTone> = {
          'professional & authoritative': 'professional',
          'friendly & approachable': 'friendly',
          'bold & provocative': 'enthusiastic',
          'educational & helpful': 'formal',
          'fun & casual': 'casual',
        };
        const toneAnswer = answers.tone ? String(answers.tone).toLowerCase() : '';
        const captionTone: CaptionTone = toneMap[toneAnswer] || 'professional';

        const captionResult = await captionService.generate({
          topic: newIdea.title + (newIdea.hook ? ': ' + newIdea.hook : ''),
          tone: captionTone,
          length: 'medium',
          platform: post.platform.toLowerCase() as CaptionPlatform,
          include_hashtags: true,
          include_emojis: true,
          include_cta: true,
        });

        // 3. Generate new image
        let newImageUrl = '';
        try {
          const imgResult = await imageService.generate({
            prompt: `Create a professional social media image for: "${newIdea.title}". ${newIdea.hook || newIdea.angle || ''}`,
            title: newIdea.title,
            // provider: 'openai',  // OpenAI billing limit reached
            provider: 'gemini',
            style: 'modern',
            enhance_prompt: true,
          });
          newImageUrl = imgResult.generated_image_with_logo || imgResult.generated_image || imgResult.composited_image || '';
        } catch {
          // Non-fatal — post will show without image
        }

        // 4. Update post with all new data
        setGeneratedPosts(
          generatedPosts.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  title: newIdea.title,
                  imageOverlay: newIdea.title,
                  imageStyle: newIdea.hook || newIdea.angle || '',
                  caption: captionResult.generated_caption || '',
                  captionId: captionResult.id,
                  ideaId: newIdea.id,
                  imageUrl: newImageUrl || p.imageUrl,
                  status: 'ready' as const,
                }
              : p
          )
        );
      } else if (isImageFeedback) {
        const imgResult = await imageService.generate({
          prompt: `Create a social media image for: "${post.title}". Style feedback: ${feedback.image_fix || feedbackText}`,
          title: post.title,
          // provider: 'openai',  // OpenAI billing limit reached
          provider: 'gemini',
          style: 'modern',
          enhance_prompt: true,
        });
        const imgUrl = imgResult.generated_image_with_logo || imgResult.generated_image || imgResult.composited_image;
        setGeneratedPosts(
          generatedPosts.map((p) =>
            p.id === post.id
              ? { ...p, imageUrl: imgUrl || p.imageUrl, status: 'ready' as const }
              : p
          )
        );
      } else {
        if (post.captionId) {
          const result = await captionService.regenerate(post.captionId, feedbackText);
          const newCaption = result.caption || '';
          setGeneratedPosts(
            generatedPosts.map((p) =>
              p.id === post.id
                ? { ...p, caption: newCaption, status: 'ready' as const, captionId: result.id || p.captionId }
                : p
            )
          );
        } else {
          const result = await captionService.generate({
            topic: post.title,
            tone: 'professional',
            length: 'medium',
            platform: post.platform.toLowerCase() as CaptionPlatform,
            include_hashtags: true,
            include_emojis: true,
            include_cta: true,
            custom_instructions: feedbackText,
          });
          const newCaption = result.generated_caption || '';
          setGeneratedPosts(
            generatedPosts.map((p) =>
              p.id === post.id
                ? { ...p, caption: newCaption, status: 'ready' as const, captionId: result.id }
                : p
            )
          );
        }
      }
      setJustUpdatedId(post.id);
    } catch {
      const label = isTopicFeedback ? 'post' : isImageFeedback ? 'image' : 'caption';
      setRegenerateError(`Failed to regenerate ${label}. Please try again.`);
      resetPostStatus(post.id);
    }
    setRegenerating(null);
  };

  // Overlay emoji/text based on regeneration type
  const overlayEmoji = regenerating?.includes('entire') ? '🔄' : regenerating?.includes('image') ? '🎨' : regenerating?.includes('platform') ? '📝' : '✍️';
  const overlayText = regenerating?.includes('entire') ? 'Regenerating post...' : regenerating?.includes('image') ? 'Regenerating image...' : regenerating?.includes('platform') ? 'Generating captions for each platform...' : 'Regenerating caption...';

  return (
    <div
      className="min-h-screen p-10 pb-[60px]"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      <div className="max-w-[720px] mx-auto">
        {/* Back to Questions button */}
        <div className="mb-6">
          <button
            onClick={handleGoBackWithSave}
            className="flex items-center gap-2 text-[13px] font-semibold transition-colors"
            style={{ color: 'rgb(var(--c-text-secondary))' }}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Questions
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-[52px] mb-3 pop">🎉</div>
          <h1 className="text-[32px] font-black text-text-primary mb-3 au1">
            Your posts are ready!
          </h1>
          <p className="text-[16px] text-text-secondary au2">
            {generatedPosts.length > 0
              ? `Here are ${generatedPosts.length} ready-to-publish posts. Review each one — approve it, or tell us what to change.`
              : 'No posts were generated. Try again with different settings.'}
          </p>
        </div>

        {/* Posts */}
        <div className="space-y-6">
          {generatedPosts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} justUpdated={justUpdatedId === post.id} onApproveClick={handleApproveClick} />
          ))}
        </div>

        {/* Regenerating overlay */}
        {regenerating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
            <div
              className="rounded-[24px] p-10 text-center max-w-[380px] scale-in"
              style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            >
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '3px solid rgba(232,54,79,0.15)', borderTopColor: 'rgb(var(--c-coral))' }} />
                <div className="absolute inset-2 rounded-full flex items-center justify-center text-[20px]">
                  {overlayEmoji}
                </div>
              </div>
              <p className="text-[15px] font-semibold text-text-primary mb-1">{overlayText}</p>
              <p className="text-[12px] text-text-muted">This may take a few seconds</p>
            </div>
          </div>
        )}

        {/* Error toast */}
        {regenerateError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pop">
            <div
              className="px-6 py-3.5 rounded-[16px] flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
            >
              <span className="text-[18px]">❌</span>
              <p className="text-[13px] font-semibold" style={{ color: '#ef4444' }}>{regenerateError}</p>
            </div>
          </div>
        )}

        {/* Review message when not all approved */}
        {!allApproved && approvedCount < generatedPosts.length && generatedPosts.length > 0 && (
          <p className="text-center text-[13px] text-text-muted mt-6 au">
            Review each post above — approve, edit, or give feedback.
          </p>
        )}

        {/* Generate More */}
        {showMore && (
          <div
            className="mt-10 p-6 rounded-[20px] text-center au"
            style={{
              background: 'rgba(232,54,79,0.05)',
              border: '1px solid rgba(232,54,79,0.2)',
            }}
          >
            <div className="text-[40px] mb-3">🚀</div>
            <h3 className="text-[22px] font-extrabold text-text-primary mb-2">Want more posts?</h3>
            <p className="text-[14px] text-text-secondary mb-6">
              Great choices! Since you liked these, you can now generate up to 10 posts at once.
            </p>
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="text-[13px] font-semibold text-text-secondary mr-2">How many?</span>
              {[3, 5, 7, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setPostCount(n)}
                  className="w-11 h-11 rounded-xl text-[15px] font-bold transition-all duration-200"
                  style={{
                    border: `2px solid ${postCount === n ? 'rgba(232,54,79,0.4)' : 'var(--border-color)'}`,
                    background: postCount === n ? 'rgba(232,54,79,0.1)' : 'transparent',
                    color: postCount === n ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-primary))',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={onGenerateMore}
              className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              ✨ Generate {postCount} more posts
            </button>
          </div>
        )}
      </div>

      {/* Approve Modal — same vs different captions per platform */}
      {approveModalPostId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div
            className="rounded-[24px] p-8 max-w-[440px] w-full mx-4 scale-in"
            style={{ background: 'rgb(var(--c-bg-elevated))', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="text-center mb-6">
              <div className="text-[40px] mb-3">📢</div>
              <h3 className="text-[20px] font-extrabold text-text-primary mb-2">How do you want to post?</h3>
              <p className="text-[14px] text-text-secondary">
                You selected {selectedPlatforms.length} platforms. Same caption everywhere, or customize per platform?
              </p>
            </div>

            {/* Platform badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {selectedPlatforms.map((plat) => (
                <span
                  key={plat}
                  className="px-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
                >
                  {plat}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleApproveSameCaptions}
                className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                  boxShadow: 'var(--shadow-glow-coral)',
                }}
              >
                Same caption for all platforms
              </button>
              <button
                onClick={handleApproveDifferentCaptions}
                className="w-full py-3.5 rounded-[14px] text-[15px] font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'rgb(var(--c-text-primary))',
                }}
              >
                Different caption per platform
              </button>
              <button
                onClick={() => setApproveModalPostId(null)}
                className="text-[13px] font-semibold mt-1"
                style={{ color: 'rgb(var(--c-text-muted))' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={!!feedbackModal}
        onClose={closeFeedback}
        onSubmit={handleFeedbackSubmit}
        postTitle={feedbackModal ? generatedPosts.find((p) => p.id === feedbackModal.postId)?.title : undefined}
        postPlatform={feedbackModal ? generatedPosts.find((p) => p.id === feedbackModal.postId)?.platform : undefined}
      />
    </div>
  );
}

export default ResultsScreen;
