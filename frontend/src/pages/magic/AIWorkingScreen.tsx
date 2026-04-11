import { useState, useEffect, useRef } from 'react';
import { useMagicModeStore, type MagicPost, type MagicCaptionData } from '../../store/magicModeStore';
import api from '../../services/api';
import strategyService from '../../services/strategyService';
import captionService from '../../services/captionService';
import imageService from '../../services/imageService';
import type { ContentIdea, CaptionTone, CaptionPlatform } from '../../types';

const STEPS = [
  { emoji: '🌐', label: 'Reading your website', desc: 'Understanding your brand identity...', estimatedMs: 3000 },
  { emoji: '🧠', label: 'Building your brand profile', desc: 'Analyzing tone, audience, and services...', estimatedMs: 8000 },
  { emoji: '📈', label: 'Finding trending topics', desc: "Scanning what's hot in your industry...", estimatedMs: 8000 },
  { emoji: '💡', label: 'Generating content ideas', desc: 'Crafting ideas that match your brand...', estimatedMs: 10000 },
  { emoji: '✍️', label: 'Writing captions', desc: 'Creating engaging text for each post...', estimatedMs: 15000 },
  { emoji: '🎨', label: 'Designing images', desc: 'Building visuals for each post...', estimatedMs: 20000 },
  { emoji: '✅', label: 'Final polish', desc: 'Making sure everything looks perfect...', estimatedMs: 1000 },
];

interface AIWorkingScreenProps {
  onComplete: () => void;
  onStop?: () => void;
}

export function AIWorkingScreen({ onComplete, onStop }: AIWorkingScreenProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const cancelledRef = useRef(false);
  const stepStartRef = useRef(Date.now());
  const rafRef = useRef<number>(0);
  const store = useMagicModeStore();

  // Animate step elapsed time
  useEffect(() => {
    stepStartRef.current = Date.now();
    setStepElapsed(0);

    const tick = () => {
      setStepElapsed(Date.now() - stepStartRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  useEffect(() => {
    cancelledRef.current = false;
    runPipeline();
    return () => { cancelledRef.current = true; };
  }, []);

  const runPipeline = async () => {
    try {
      // Step 0: Get or create brand
      setStep(0);
      let brandId: number = 0;

      // Always fetch current user's brands to ensure brandId is valid for this user
      const res = await api.get('/brands/');
      const brands = Array.isArray(res.data) ? res.data : res.data.results || [];

      if (brands.length > 0) {
        // If stored brandId exists and belongs to current user, use it
        const storedBrandId = store.brandId;
        const storedBrand = storedBrandId ? brands.find((b: { id: number }) => b.id === storedBrandId) : null;

        if (storedBrand) {
          brandId = storedBrand.id;
        } else {
          // Stored brandId invalid/stale - use user's primary brand or first brand
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          brandId = primary.id;
        }
        store.setBrandId(brandId);
      } else {
        // No brands exist - create one
        // Use custom industry if "Other" was selected, otherwise use selected option
        const customIndustry = store.customAnswers?.industry_other;
        const industryValue = customIndustry ||
          (store.answers.industry ? String(store.answers.industry) : 'My Brand');

        const brandRes = await api.post('/brands/', {
          brand_name: industryValue,
          industry: industryValue,
          target_region: store.answers.region ? String(store.answers.region) : 'Global',
          website_url: store.websiteUrl || '',
          is_primary: true,
        });
        brandId = brandRes.data.id;
        store.setBrandId(brandId);
      }
      if (cancelledRef.current) return;

      // Upload logo if provided (non-blocking — best effort)
      let brandLogoId: number | null = null;
      if (store.logoFile) {
        try {
          // 1. PATCH brand with logo
          const logoForm = new FormData();
          logoForm.append('logo', store.logoFile);
          await api.patch(`/brands/${brandId}/`, logoForm);

          // 2. Create BrandAsset for image generation
          const assetForm = new FormData();
          assetForm.append('brand', String(brandId));
          assetForm.append('file', store.logoFile);
          assetForm.append('asset_type', 'logo');
          assetForm.append('name', 'Brand Logo');
          const assetRes = await api.post('/brand-assets/', assetForm);
          brandLogoId = assetRes.data?.id || null;
        } catch {
          // Non-fatal — continue without logo
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
        store.setTrendingTopics(trendingTopics);
      } catch {
        // Non-fatal — continue without trending
      }
      if (cancelledRef.current) return;

      // Step 3: Generate content ideas
      setStep(3);
      const count = store.postCount || 2;
      const ideasResult = await strategyService.generateIdeas({
        brand_id: brandId,
        count,
        trending_topics: trendingTopics.length > 0 ? trendingTopics : undefined,
      });
      const ideas: ContentIdea[] = ideasResult.ideas || ideasResult || [];
      store.setIdeasData(
        ideas.map((i) => ({
          id: i.id,
          title: i.title,
          hook: i.hook || '',
          angle: i.angle || '',
          platform: i.platform || '',
          content_format: i.content_format || '',
        }))
      );
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
      const captionsAccum: MagicCaptionData[] = [];
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
          captionsAccum.push({
            captionId: caption.id,
            ideaId: idea.id,
            text: caption.generated_caption || '',
            platform: captionPlatform,
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
      store.setCaptionsData(captionsAccum);
      if (cancelledRef.current) return;

      // Step 5: Generate images for each post
      setStep(5);
      for (let i = 0; i < posts.length; i++) {
        if (cancelledRef.current) return;
        try {
          const post = posts[i];
          const imgReq: Parameters<typeof imageService.generate>[0] = {
            prompt: `Create a professional social media image for: "${post.title}". ${post.imageStyle}`,
            title: post.title,
            provider: 'gemini',
            style: 'modern',
            enhance_prompt: true,
          };
          if (brandLogoId) {
            imgReq.brand_logo_id = brandLogoId;
            imgReq.logo_position = 'bottom_right';
          }
          const imgResult = await imageService.generate(imgReq);
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
      store.setPipelineCompleted(true);

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

  const handleStopConfirm = () => {
    cancelledRef.current = true;
    setShowStopConfirm(false);
    onStop?.();
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  // Compute mini progress for each step
  const getStepProgress = (i: number): number => {
    if (i < step) return 100;
    if (i > step) return 0;
    // Active step: fill based on elapsed time, cap at 95%
    const est = STEPS[i].estimatedMs;
    return Math.min(95, (stepElapsed / est) * 100);
  };

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

      <div className="relative z-10 flex flex-col items-center max-w-[520px] w-full">
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
            {/* Thinking dots */}
            <div className="flex items-center gap-2 mb-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: 'rgb(var(--c-coral))',
                    animation: 'pulseDot 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>

            {/* Current step label */}
            <h2 className="text-[22px] font-extrabold text-text-primary text-center mb-1 pop" key={`label-${step}`}>
              {current.label}
            </h2>
            <p className="text-[14px] text-text-secondary text-center mb-6 pop" key={`desc-${step}`}>
              {current.desc}
            </p>

            {/* Terminal-style step log */}
            <div
              className="w-full rounded-[16px] p-4 mb-6"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="space-y-1">
                {STEPS.map((s, i) => {
                  const isDone = i < step;
                  const isActive = i === step;
                  const sp = getStepProgress(i);

                  return (
                    <div key={s.label}>
                      <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg" style={{
                        background: isActive ? 'rgba(232,54,79,0.06)' : 'transparent',
                      }}>
                        {/* Status indicator */}
                        <div className="w-5 text-center flex-shrink-0">
                          {isDone ? (
                            <span className="text-[13px]" style={{ color: 'rgb(var(--c-green))' }}>✓</span>
                          ) : isActive ? (
                            <div
                              className="w-2.5 h-2.5 mx-auto rounded-full"
                              style={{
                                background: 'rgb(var(--c-coral))',
                                animation: 'pulseDot 1.4s ease-in-out infinite',
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-text-muted">○</span>
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className="text-[13px] flex-1"
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                            fontWeight: isDone || isActive ? 500 : 400,
                            color: isDone
                              ? 'rgb(var(--c-green))'
                              : isActive
                                ? 'rgb(var(--c-text-primary))'
                                : 'rgba(var(--c-text-muted), 0.5)',
                          }}
                        >
                          {'> '}{s.label}
                        </span>

                        {/* Time estimate for active step */}
                        {isActive && (
                          <span className="text-[11px] text-text-muted tabular-nums">
                            ~{Math.max(1, Math.ceil((s.estimatedMs - stepElapsed) / 1000))}s
                          </span>
                        )}
                      </div>

                      {/* Sub-description for active step */}
                      {isActive && (
                        <div className="pl-10 pb-1">
                          <span
                            className="text-[12px] slide-up"
                            style={{
                              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                              color: 'rgb(var(--c-text-muted))',
                            }}
                          >
                            {s.desc}
                          </span>
                        </div>
                      )}

                      {/* Mini progress bar for active step */}
                      {isActive && (
                        <div
                          className="mx-2 mb-1 overflow-hidden"
                          style={{
                            height: 2,
                            borderRadius: 1,
                            background: 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${sp}%`,
                              borderRadius: 1,
                              background: 'linear-gradient(90deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                              transition: 'width 0.5s linear',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main progress bar */}
            <div className="w-full mb-6">
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
              <div className="flex justify-between mt-2">
                <span className="text-[12px] text-text-muted">
                  Step {step + 1} of {STEPS.length}
                </span>
                <span className="text-[12px] font-semibold" style={{ color: 'rgb(var(--c-coral))' }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            {/* Stop button */}
            {onStop && (
              <button
                onClick={() => setShowStopConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgb(var(--c-text-secondary))',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="2" y="2" width="8" height="8" rx="1.5" />
                </svg>
                Stop Generating
              </button>
            )}
          </>
        )}
      </div>

      {/* Stop confirmation popup */}
      {showStopConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-[400px] rounded-[20px] p-7 scale-in"
            style={{
              background: 'rgb(var(--c-bg-elevated))',
              border: '1px solid var(--border-color)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="text-center mb-5">
              <div className="text-[44px] mb-3">⚠️</div>
              <h3 className="text-[20px] font-extrabold text-text-primary mb-2">
                Stop generating?
              </h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Your progress will be lost and you'll need to start over.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStopConfirm}
                className="flex-1 py-3 rounded-[12px] text-[14px] font-bold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                }}
              >
                Yes, stop
              </button>
              <button
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 py-3 rounded-[12px] text-[14px] font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'rgb(var(--c-text-secondary))',
                }}
              >
                No, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIWorkingScreen;
