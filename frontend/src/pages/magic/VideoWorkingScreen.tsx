import { useState, useEffect, useRef } from 'react';
import { useMagicModeStore } from '../../store/magicModeStore';
import api from '../../services/api';
import strategyService from '../../services/strategyService';
import visualPromptService from '../../services/visualPromptService';

const VIDEO_STEPS = [
  { emoji: '🌐', label: 'Reading brand profile',    desc: 'Loading your brand voice and context...', estimatedMs: 3000 },
  { emoji: '🧠', label: 'Building brand DNA',        desc: 'Analyzing tone, audience, and identity...', estimatedMs: 8000 },
  { emoji: '📈', label: 'Finding trending topics',   desc: "Scanning what's hot in your industry...", estimatedMs: 8000 },
  { emoji: '💡', label: 'Crafting video concept',    desc: 'Generating creative direction for your video...', estimatedMs: 10000 },
  { emoji: '🎬', label: 'Generating video',          desc: 'AI is rendering your video (1–3 min)...', estimatedMs: 150000 },
  { emoji: '✅', label: 'Final polish',              desc: 'Your video is almost ready...', estimatedMs: 1000 },
];

interface VideoWorkingScreenProps {
  onComplete: () => void;
  onStop?: () => void;
}

export function VideoWorkingScreen({ onComplete, onStop }: VideoWorkingScreenProps) {
  const store = useMagicModeStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const cancelledRef = useRef(false);
  const stepStartRef = useRef(Date.now());
  const rafRef = useRef<number>(0);

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
      const pending = store.videoPending;
      if (!pending) {
        setError('No video prompt found. Please go back and try again.');
        return;
      }

      // Step 0: Get or create brand
      setStep(0);
      let brandId: number = 0;

      const res = await api.get('/brands/');
      const brands = Array.isArray(res.data) ? res.data : (res.data.results || []);

      if (brands.length > 0) {
        const storedBrandId = store.brandId;
        const storedBrand = storedBrandId ? brands.find((b: { id: number }) => b.id === storedBrandId) : null;
        if (storedBrand) {
          brandId = storedBrand.id;
        } else {
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          brandId = primary.id;
        }
        store.setBrandId(brandId);
      } else {
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

      // Step 1: Generate BrandDNA if not exists
      setStep(1);
      if (store.websiteUrl && !store.skipDNAGeneration) {
        try {
          const brandDetail = await api.get(`/brands/${brandId}/`);
          const existingDNA = brandDetail.data?.brand_dna;
          const hasDNA = existingDNA && typeof existingDNA === 'object' && Object.keys(existingDNA).length > 0;
          if (!hasDNA) {
            await strategyService.generateDNA(brandId, store.websiteUrl);
          }
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

      // Step 3: Generate video concept idea (1 idea for creative direction)
      setStep(3);
      let videoConceptHint = '';
      let videoCopyTitle = '';
      let firstIdea: { title?: string; hook?: string; angle?: string } | null = null;
      try {
        const ideasResult = await strategyService.generateIdeas({
          brand_id: brandId,
          count: 1,
          trending_topics: trendingTopics.length > 0 ? trendingTopics : undefined,
        });
        const ideas = ideasResult.ideas || ideasResult || [];
        if (ideas.length > 0) {
          const idea = ideas[0];
          videoConceptHint = idea.hook || idea.angle || idea.title || '';
          videoCopyTitle = idea.title || videoConceptHint;
          firstIdea = { title: idea.title, hook: idea.hook, angle: idea.angle };
        }
      } catch {
        // Non-fatal — video will still generate without the hint
      }
      if (cancelledRef.current) return;

      // Step 4: Generate video via Veo API
      setStep(4);
      let basePrompt = pending.prompt;
      
      // 🆕 NEW: If product image is provided, instruct AI to generate an empty background
      if (pending.referenceImage) {
        basePrompt = `Professional empty photography studio background for: ${pending.prompt}. IMPORTANT: Keep the center of the video completely empty as a product will be placed there. Do NOT generate the product itself.`;
      }

      const enhancedPrompt = videoConceptHint
        ? `${basePrompt} — Creative direction: ${videoConceptHint}`
        : basePrompt;

      // 🆕 Ask the backend to synthesise brand DNA + idea + trending into a
      // rich video prompt. User's typed seed (`pending.prompt`) remains the
      // primary subject; brand voice and creative angle are layered on top.
      // Falls back to `enhancedPrompt` if the LLM call fails.
      const richVideoPrompt = await visualPromptService.buildVideoPrompt({
        brand_id: brandId,
        user_prompt: pending.prompt,
        idea: firstIdea,
        trending_topics: trendingTopics,
        has_reference_image: !!pending.referenceImage,
      });
      const promptToSend = richVideoPrompt || enhancedPrompt;

      // Copy/text-overlay toggle from the `include_copy` magic-mode question.
      const copyAnswer = store.answers.include_copy;
      const wantsCopy =
        (Array.isArray(copyAnswer) ? copyAnswer[0] : copyAnswer || '')
          .toString()
          .toLowerCase()
          .startsWith('yes');
      const copyTextForVideo = videoCopyTitle || pending.prompt.slice(0, 80);

      const formData = new FormData();
      formData.append('prompt', promptToSend);
      formData.append('style', pending.style);
      formData.append('duration', String(pending.duration));
      formData.append('brand_id', String(brandId));
      formData.append('with_copy', String(wantsCopy));
      if (wantsCopy && copyTextForVideo) formData.append('copy_text', copyTextForVideo);
      if (pending.referenceImage) formData.append('reference_image', pending.referenceImage);

      const response = await api.post('/video/generate/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (cancelledRef.current) return;

      const { generation_id } = response.data;
      if (!generation_id) throw new Error('Failed to start video generation.');

      // Poll for completion (Cloudflare times out sync requests; backend runs async)
      type PollData = { status: string; video_url?: string; error?: string; enhanced_prompt?: string };
      const pollDeadline = Date.now() + 10 * 60 * 1000;
      let pollData: PollData = { status: 'processing' };
      while (Date.now() < pollDeadline) {
        if (cancelledRef.current) return;
        await new Promise((r) => setTimeout(r, 5000));
        if (cancelledRef.current) return;
        const statusRes = await api.get(`/video/status/${generation_id}/`);
        pollData = statusRes.data as PollData;
        if (pollData.status === 'completed' && pollData.video_url) break;
        if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Video generation failed. Please try again.');
        }
      }

      if (pollData.status !== 'completed' || !pollData.video_url) {
        throw new Error('Video generation timed out. Please try again.');
      }

      store.setVideoResult({
        videoUrl: pollData.video_url,
        generationId: generation_id,
        prompt: pending.prompt,
        style: pending.style,
      });

      // Step 5: Final polish
      setStep(5);
      await new Promise((r) => setTimeout(r, 800));
      if (cancelledRef.current) return;

      onComplete();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        'Something went wrong. Please try again.';
      setError(msg);
    }
  };

  const handleRetry = () => {
    setError(null);
    setStep(0);
    runPipeline();
  };

  const progress = ((step + 1) / VIDEO_STEPS.length) * 100;
  const current = VIDEO_STEPS[step];

  const getStepProgress = (i: number): number => {
    if (i < step) return 100;
    if (i > step) return 0;
    return Math.min(95, (stepElapsed / VIDEO_STEPS[i].estimatedMs) * 100);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-10 relative"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(232,54,79,0.05), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(59,130,246,0.05), transparent 60%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-[520px] w-full">
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

            <h2 className="text-[22px] font-extrabold text-text-primary text-center mb-1 pop" key={`label-${step}`}>
              {current.label}
            </h2>
            <p className="text-[14px] text-text-secondary text-center mb-6 pop" key={`desc-${step}`}>
              {current.desc}
            </p>

            <div
              className="w-full rounded-[16px] p-4 mb-6"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="space-y-1">
                {VIDEO_STEPS.map((s, i) => {
                  const isDone = i < step;
                  const isActive = i === step;
                  const sp = getStepProgress(i);

                  return (
                    <div key={s.label}>
                      <div
                        className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
                        style={{ background: isActive ? 'rgba(232,54,79,0.06)' : 'transparent' }}
                      >
                        <div className="w-5 text-center flex-shrink-0">
                          {isDone ? (
                            <span className="text-[13px]" style={{ color: 'rgb(var(--c-green))' }}>✓</span>
                          ) : isActive ? (
                            <div
                              className="w-2.5 h-2.5 mx-auto rounded-full"
                              style={{ background: 'rgb(var(--c-coral))', animation: 'pulseDot 1.4s ease-in-out infinite' }}
                            />
                          ) : (
                            <span className="text-[12px] text-text-muted">○</span>
                          )}
                        </div>
                        <span
                          className="text-[13px] flex-1"
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
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
                        {isActive && (
                          <span className="text-[11px] text-text-muted tabular-nums">
                            ~{Math.max(1, Math.ceil((s.estimatedMs - stepElapsed) / 1000))}s
                          </span>
                        )}
                      </div>

                      {isActive && (
                        <div className="pl-10 pb-1">
                          <span
                            className="text-[12px] slide-up"
                            style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", color: 'rgb(var(--c-text-muted))' }}
                          >
                            {s.desc}
                          </span>
                        </div>
                      )}

                      {isActive && (
                        <div
                          className="mx-2 mb-1 overflow-hidden"
                          style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }}
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

            <div className="w-full mb-6">
              <div
                className="w-full overflow-hidden"
                style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}
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
                <span className="text-[12px] text-text-muted">Step {step + 1} of {VIDEO_STEPS.length}</span>
                <span className="text-[12px] font-semibold" style={{ color: 'rgb(var(--c-coral))' }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

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
              <h3 className="text-[20px] font-extrabold text-text-primary mb-2">Stop generating?</h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Your video progress will be lost.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { cancelledRef.current = true; setShowStopConfirm(false); onStop?.(); }}
                className="flex-1 py-3 rounded-[12px] text-[14px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}
              >
                Yes, stop
              </button>
              <button
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 py-3 rounded-[12px] text-[14px] font-semibold"
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

export default VideoWorkingScreen;
