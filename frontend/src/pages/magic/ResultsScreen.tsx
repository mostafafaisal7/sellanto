import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMagicModeStore, type MagicPost } from '../../store/magicModeStore';
import { FeedbackModal } from '../../components/redesign/FeedbackModal';
import captionService from '../../services/captionService';
import imageService from '../../services/imageService';
import type { CaptionPlatform } from '../../types';

function PostCard({ post, index }: { post: MagicPost; index: number }) {
  const { approvePost, resetPostStatus, openFeedback, generatedPosts, setGeneratedPosts } = useMagicModeStore();
  const navigate = useNavigate();
  const isApproved = post.status === 'approved';
  const [publishing, setPublishing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  const platformEmoji: Record<string, string> = {
    LinkedIn: '💼', Instagram: '📸', Facebook: '📘', Twitter: '🐦', TikTok: '🎵',
  };

  const handleSchedule = () => {
    // Navigate to calendar with post data pre-filled
    navigate('/posts/create', {
      state: {
        caption: post.caption,
        platform: post.platform.toLowerCase(),
        title: post.title,
      },
    });
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const result = await imageService.generate({
        prompt: `Create a professional social media image for: "${post.title}". ${post.imageStyle || ''}`,
        title: post.title,
        provider: 'openai',
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
      // Navigate to create post page with data for immediate publishing
      navigate('/posts/create', {
        state: {
          caption: post.caption,
          platform: post.platform.toLowerCase(),
          title: post.title,
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
        border: `1px solid ${isApproved ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
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
}

export function ResultsScreen({ onGenerateMore }: ResultsScreenProps) {
  const { generatedPosts, feedbackModal, closeFeedback, resetPostStatus, setPostCount, postCount, setGeneratedPosts } = useMagicModeStore();
  const allApproved = generatedPosts.length > 0 && generatedPosts.every((p) => p.status === 'approved');
  const approvedCount = generatedPosts.filter((p) => p.status === 'approved').length;
  const [showMore, setShowMore] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (allApproved) {
      const t = setTimeout(() => setShowMore(true), 600);
      return () => clearTimeout(t);
    }
    setShowMore(false);
  }, [allApproved]);

  const handleFeedbackSubmit = async (feedback: Record<string, string>) => {
    if (!feedbackModal) return;

    const post = generatedPosts.find((p) => p.id === feedbackModal.postId);
    if (!post) { closeFeedback(); return; }

    setRegenerating(true);
    const isImageFeedback = feedback.what === 'The image style';

    // Build clean feedback text — use the specific follow-up answer, not the category label
    const feedbackText = feedback.custom
      || feedback.caption_fix
      || feedback.tone_fix
      || feedback.topic_fix
      || feedback.image_fix
      || Object.entries(feedback).filter(([k]) => k !== 'what').map(([, v]) => v).filter(Boolean).join('. ')
      || feedback.what
      || '';

    try {
      if (isImageFeedback) {
        // Regenerate image based on feedback
        const imgResult = await imageService.generate({
          prompt: `Create a social media image for: "${post.title}". Style feedback: ${feedback.image_fix || feedbackText}`,
          title: post.title,
          provider: 'openai',
          style: 'modern',
          enhance_prompt: true,
        });
        const imgUrl = imgResult.generated_image_with_logo || imgResult.generated_image || imgResult.composited_image;
        setGeneratedPosts(
          generatedPosts.map((p) =>
            p.id === feedbackModal.postId
              ? { ...p, imageUrl: imgUrl || p.imageUrl, status: 'ready' as const }
              : p
          )
        );
      } else {
        // Regenerate caption based on feedback
        if (post.captionId) {
          // Use regenerate endpoint — returns { success, caption, hashtags, id }
          const result = await captionService.regenerate(post.captionId, feedbackText);
          const newCaption = result.caption || '';
          setGeneratedPosts(
            generatedPosts.map((p) =>
              p.id === feedbackModal.postId
                ? { ...p, caption: newCaption, status: 'ready' as const, captionId: result.id || p.captionId }
                : p
            )
          );
        } else {
          // No captionId — generate fresh with feedback as custom_instructions
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
              p.id === feedbackModal.postId
                ? { ...p, caption: newCaption, status: 'ready' as const, captionId: result.id }
                : p
            )
          );
        }
      }
    } catch {
      resetPostStatus(feedbackModal.postId);
    }
    setRegenerating(false);
    closeFeedback();
  };

  return (
    <div
      className="min-h-screen p-10 pb-[60px]"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      <div className="max-w-[720px] mx-auto">
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
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>

        {/* Regenerating overlay */}
        {regenerating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div
              className="rounded-[20px] p-8 text-center"
              style={{ background: 'rgb(var(--c-bg-card))' }}
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: 'rgb(var(--c-coral))' }} />
              <p className="text-text-secondary text-[14px]">Regenerating post...</p>
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
      />
    </div>
  );
}

export default ResultsScreen;
