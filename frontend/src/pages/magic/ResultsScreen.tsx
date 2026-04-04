import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMagicModeStore, type MagicPost } from '../../store/magicModeStore';
import { FeedbackModal } from '../../components/redesign/FeedbackModal';
import captionService from '../../services/captionService';
import imageService from '../../services/imageService';
import strategyService from '../../services/strategyService';
import { postService } from '../../services/postService';
import type { CaptionPlatform, CaptionTone, PlatformType } from '../../types';

function PostCard({ post, index, justUpdated }: { post: MagicPost; index: number; justUpdated?: boolean }) {
  const { approvePost, resetPostStatus, openFeedback, generatedPosts, setGeneratedPosts } = useMagicModeStore();
  const navigate = useNavigate();
  const isApproved = post.status === 'approved';
  const [publishing, setPublishing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  const platformEmoji: Record<string, string> = {
    LinkedIn: '💼', Instagram: '📸', Facebook: '📘', Twitter: '🐦', TikTok: '🎵',
  };

  const handleSchedule = async () => {
    // Delete draft before navigating to schedule
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

    navigate('/posts/create', {
      state: {
        caption: post.caption,
        platform: post.platform.toLowerCase(),
        title: post.title,
        imageUrl: post.imageUrl,
      },
    });
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
      // Delete draft before navigating to publish
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

      navigate('/posts/create', {
        state: {
          caption: post.caption,
          platform: post.platform.toLowerCase(),
          title: post.title,
          imageUrl: post.imageUrl,
          publishNow: true,
        },
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className={`rounded-[20px] overflow-hidden transition-all duration-300 au${Math.min(index + 1, 5)}`}
      style={{
        background: 'rgb(var(--c-bg-card))',
        border: `1.5px solid ${justUpdated ? 'rgba(16,185,129,0.5)' : isApproved ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
        boxShadow: justUpdated ? '0 0 20px rgba(16,185,129,0.15)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-[13px] font-semibold text-text-secondary">Post {index + 1}</span>
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-[12px] font-semibold"
            style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}
          >
            {platformEmoji[post.platform] || '📱'} {post.platform}
          </span>
          {isApproved && (
            <span
              className="px-3 py-1 rounded-full text-[12px] font-semibold pop"
              style={{ background: 'rgba(16,185,129,0.1)', color: 'rgb(var(--c-green))' }}
            >
              ✓ Approved
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
          <div
            className="flex-1 text-[13px] text-text-secondary leading-relaxed overflow-y-auto max-h-[220px] whitespace-pre-line no-scrollbar"
          >
            {post.caption}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-end gap-3 px-6 py-3.5"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        {!isApproved ? (
          <>
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
              onClick={() => approvePost(post.id)}
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
              onClick={handleSchedule}
              className="px-4 py-2.5 rounded-[14px] text-[14px] font-semibold text-text-secondary"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
              }}
            >
              📅 Schedule
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
              {publishing ? '...' : '🚀 Publish Now'}
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
  const { generatedPosts, feedbackModal, closeFeedback, resetPostStatus, setPostCount, postCount, setGeneratedPosts, answers } = magicStore;
  const allApproved = generatedPosts.length > 0 && generatedPosts.every((p) => p.status === 'approved');
  const approvedCount = generatedPosts.filter((p) => p.status === 'approved').length;
  const [showMore, setShowMore] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null); // null or description text
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [justUpdatedId, setJustUpdatedId] = useState<number | null>(null);

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
  const overlayEmoji = regenerating?.includes('entire') ? '🔄' : regenerating?.includes('image') ? '🎨' : '✍️';
  const overlayText = regenerating?.includes('entire') ? 'Regenerating post...' : regenerating?.includes('image') ? 'Regenerating image...' : 'Regenerating caption...';

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
            <PostCard key={post.id} post={post} index={i} justUpdated={justUpdatedId === post.id} />
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
