import { useState, useEffect, useRef } from 'react';
import { useMagicModeStore, type MagicPost } from '../../store/magicModeStore';
import api from '../../services/api';
import strategyService from '../../services/strategyService';
import captionService from '../../services/captionService';
import imageService from '../../services/imageService';
import type { ContentIdea, CaptionTone, CaptionPlatform } from '../../types';

const STEPS = [
  { emoji: '🌐', label: 'Reading your website', desc: 'Understanding your brand identity...' },
  { emoji: '🧠', label: 'Building your brand profile', desc: 'Analyzing tone, audience, and services...' },
  { emoji: '📈', label: 'Finding trending topics', desc: "Scanning what's hot in your industry..." },
  { emoji: '💡', label: 'Generating content ideas', desc: 'Crafting ideas that match your brand...' },
  { emoji: '✍️', label: 'Writing captions', desc: 'Creating engaging text for each post...' },
  { emoji: '🎨', label: 'Designing images', desc: 'Building visuals for each post...' },
  { emoji: '✅', label: 'Final polish', desc: 'Making sure everything looks perfect...' },
];

interface AIWorkingScreenProps {
  onComplete: () => void;
}

export function AIWorkingScreen({ onComplete }: AIWorkingScreenProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const store = useMagicModeStore();

  useEffect(() => {
    cancelledRef.current = false;
    runPipeline();
    return () => { cancelledRef.current = true; };
  }, []);

  const runPipeline = async () => {
    try {
      // Step 0: Get or create brand
      setStep(0);
      let brandId: number = store.brandId || 0;
      if (!brandId) {
        const res = await api.get('/brands/');
        const brands = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (brands.length > 0) {
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          brandId = primary.id;
          store.setBrandId(brandId);
        } else {
          // Create a brand from answers
          const brandRes = await api.post('/brands/', {
            brand_name: store.answers.industry ? String(store.answers.industry) : 'My Brand',
            industry: store.answers.industry ? String(store.answers.industry) : '',
            website_url: store.websiteUrl || '',
            is_primary: true,
          });
          brandId = brandRes.data.id;
          store.setBrandId(brandId);
        }
      }
      if (cancelledRef.current) return;

      // Step 1: Generate DNA (if URL provided)
      setStep(1);
      if (store.websiteUrl) {
        try {
          await strategyService.generateDNA(brandId, store.websiteUrl);
        } catch {
          // Non-fatal — continue without DNA
        }
      }
      if (cancelledRef.current) return;

      // Step 2: Generate trending topics
      setStep(2);
      let trendingTopics: string[] = [];
      try {
        const trendResult = await strategyService.generateTrending(brandId);
        const topics = trendResult.topics || trendResult || [];
        trendingTopics = topics.slice(0, 5).map((t: { topic: string }) => t.topic);
      } catch {
        // Non-fatal — continue without trending
      }
      if (cancelledRef.current) return;

      // Step 3: Generate content ideas
      setStep(3);
      const count = store.postCount || 3;
      const ideasResult = await strategyService.generateIdeas({
        brand_id: brandId,
        count,
        trending_topics: trendingTopics.length > 0 ? trendingTopics : undefined,
      });
      const ideas: ContentIdea[] = ideasResult.ideas || ideasResult || [];
      if (cancelledRef.current) return;

      // Step 4: Generate captions for each idea
      setStep(4);
      const toneMap: Record<string, CaptionTone> = {
        'professional & authoritative': 'professional',
        'friendly & approachable': 'friendly',
        'bold & provocative': 'enthusiastic',
        'educational & helpful': 'formal',
        'fun & casual': 'casual',
      };
      const toneAnswer = store.answers.tone ? String(store.answers.tone).toLowerCase() : '';
      const captionTone: CaptionTone = toneMap[toneAnswer] || 'professional';
      // Build user-selected platforms list — enforce these instead of backend's idea.platform
      const rawPlatforms = store.answers.platforms;
      const userPlatforms: CaptionPlatform[] = Array.isArray(rawPlatforms) && rawPlatforms.length > 0
        ? rawPlatforms.map((p: string) => p.replace(' / X', '').toLowerCase() as CaptionPlatform)
        : [];

      const posts: MagicPost[] = [];
      const slicedIdeas = ideas.slice(0, count);
      for (let idx = 0; idx < slicedIdeas.length; idx++) {
        const idea = slicedIdeas[idx];
        if (cancelledRef.current) return;

        // Use user's selected platform(s) via round-robin; fall back to idea.platform or 'linkedin'
        const captionPlatform: CaptionPlatform = userPlatforms.length > 0
          ? userPlatforms[idx % userPlatforms.length]
          : (idea.platform?.toLowerCase() as CaptionPlatform) || 'linkedin';
        const displayPlatform = captionPlatform.charAt(0).toUpperCase() + captionPlatform.slice(1);

        try {
          const caption = await captionService.generate({
            topic: idea.title + (idea.hook ? ': ' + idea.hook : ''),
            tone: captionTone,
            length: 'medium',
            platform: captionPlatform,
            include_hashtags: true,
            include_emojis: true,
            include_cta: true,
          });

          posts.push({
            id: idea.id,
            title: idea.title,
            platform: displayPlatform,
            imageOverlay: idea.title,
            imageStyle: idea.hook || idea.angle || '',
            caption: caption.generated_caption || '',
            status: 'ready' as const,
            captionId: caption.id,
            ideaId: idea.id,
          });
        } catch {
          // Skip failed caption generation, still include the idea
          posts.push({
            id: idea.id,
            title: idea.title,
            platform: displayPlatform,
            imageOverlay: idea.title,
            imageStyle: idea.hook || idea.angle || '',
            caption: idea.hook || 'Caption could not be generated. Click "Give feedback" to retry.',
            status: 'ready' as const,
            ideaId: idea.id,
          });
        }
      }
      if (cancelledRef.current) return;

      // Step 5: Generate images for each post
      setStep(5);
      for (let i = 0; i < posts.length; i++) {
        if (cancelledRef.current) return;
        try {
          const post = posts[i];
          const imgResult = await imageService.generate({
            prompt: `Create a professional social media image for: "${post.title}". ${post.imageStyle}`,
            title: post.title,
            provider: 'openai',
            style: 'modern',
            enhance_prompt: true,
          });
          const imgUrl = imgResult.generated_image_with_logo || imgResult.generated_image || imgResult.composited_image;
          if (imgUrl) {
            posts[i] = { ...post, imageUrl: imgUrl };
          }
        } catch {
          // Non-fatal — post will show placeholder with generate button
        }
      }
      if (cancelledRef.current) return;

      // Step 6: Finalize
      setStep(6);
      store.setGeneratedPosts(posts);

      // Brief pause so user sees the final step
      await new Promise((r) => setTimeout(r, 800));
      if (cancelledRef.current) return;

      onComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || 'Something went wrong. Please try again.';
      setError(msg);
    }
  };

  const handleRetry = () => {
    setError(null);
    setStep(0);
    runPipeline();
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-10 relative"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Ambient bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(232,54,79,0.05), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(59,130,246,0.05), transparent 60%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-[500px] w-full">
        {/* Error state */}
        {error ? (
          <>
            <div className="text-[64px] mb-4">❌</div>
            <h2 className="text-[24px] font-extrabold text-text-primary text-center mb-2">
              Something went wrong
            </h2>
            <p className="text-[14px] text-text-secondary text-center mb-6 max-w-[400px]">
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              Try Again
            </button>
          </>
        ) : (
          <>
            {/* Current step emoji */}
            <div className="text-[64px] mb-4 pop" key={`emoji-${step}`}>
              {current.emoji}
            </div>

            {/* Label */}
            <h2 className="text-[24px] font-extrabold text-text-primary text-center mb-2 pop" key={`label-${step}`}>
              {current.label}
            </h2>
            <p className="text-[15px] text-text-secondary text-center mb-8 pop" key={`desc-${step}`}>
              {current.desc}
            </p>

            {/* Progress bar */}
            <div className="max-w-[360px] mx-auto w-full mb-6">
              <div
                className="w-full overflow-hidden"
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, rgb(var(--c-coral)), rgb(var(--c-purple)), rgb(var(--c-blue)))',
                    backgroundSize: '300% 100%',
                    animation: 'gradientShift 3s ease-in-out infinite',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Step list */}
            <div className="max-w-[340px] mx-auto w-full space-y-1.5">
              {STEPS.map((s, i) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 px-3 py-2 rounded-[10px] transition-all duration-300"
                  style={{
                    background: i === step ? 'rgba(232,54,79,0.08)' : 'transparent',
                  }}
                >
                  {/* Icon */}
                  <div className="w-6 text-center flex-shrink-0">
                    {i < step ? (
                      <span className="text-[14px]" style={{ color: 'rgb(var(--c-green))' }}>✅</span>
                    ) : i === step ? (
                      <div
                        className="w-[14px] h-[14px] mx-auto rounded-full border-2"
                        style={{
                          borderColor: 'rgba(232,54,79,0.5)',
                          borderTopColor: 'rgb(var(--c-coral))',
                          animation: 'spin 0.7s linear infinite',
                        }}
                      />
                    ) : (
                      <span className="text-[14px] text-text-muted">○</span>
                    )}
                  </div>
                  <span
                    className="text-[13px] transition-colors duration-200"
                    style={{
                      fontWeight: i <= step ? 600 : 400,
                      color: i < step ? 'rgb(var(--c-green))' : i === step ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-muted))',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AIWorkingScreen;
