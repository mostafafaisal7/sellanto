import { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  CheckIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { imageService } from '../../services/imageService';
import { useOverflowStore } from '../../store';
import { useDiamondStore } from '../../store/diamondStore';

interface PostItem {
  title: string;
  caption: string;
  done: boolean;
  ideaId: number;
  captionId: string | null;
  imageUrl?: string;
}

interface MediaGenerationViewProps {
  brandId: number | null;
  onNext: () => void;
  onBack: () => void;
}

const STYLES = ['Modern', 'Romantic', 'Vibrant', 'Artistic', 'Minimal', 'Flat Design'];

const PROVIDERS = [
  { name: 'OpenAI', cost: 50, recommended: true },
  { name: 'Gemini', cost: 40, recommended: false },
];

const WIZARD_STEPS = [
  { label: 'Choose Source', icon: ArrowUpTrayIcon },
  { label: 'Visual Direction', icon: SparklesIcon },
  { label: 'Text Overlay', icon: PencilSquareIcon },
  { label: 'Generate & Review', icon: SparklesIcon },
];

export function MediaGenerationView({ brandId: _brandId, onNext, onBack }: MediaGenerationViewProps) {
  const overflow = useOverflowStore();
  const diamond = useDiamondStore();

  const [activePost, setActivePost] = useState(0);
  const [wizardStep, setWizardStep] = useState(0);
  const [mediaSource, setMediaSource] = useState<'upload' | 'ai' | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('Modern');
  const [selectedProvider, setSelectedProvider] = useState('OpenAI');
  const [textOverlay, setTextOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [imageDesc, setImageDesc] = useState('');
  const [genState, setGenState] = useState<'idle' | 'generating' | 'done'>('idle');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);

  // Build posts from overflow store data
  useEffect(() => {
    const overflowPosts: PostItem[] = overflow.selectedCaptions.length > 0
      ? overflow.selectedCaptions.map((c) => {
          const idea = overflow.ideasData.find((i) => i.id === c.ideaId);
          const existingMedia = overflow.captionMediaMap[c.id];
          return {
            title: idea?.title || 'Untitled',
            caption: c.text,
            done: !!existingMedia?.mediaUrl,
            ideaId: c.ideaId,
            captionId: c.id,
            imageUrl: existingMedia?.mediaUrl || undefined,
          };
        })
      : overflow.ideasData
          .filter((i) => overflow.selectedIdeaIds.includes(i.id))
          .map((i) => ({
            title: i.title,
            caption: i.hook || '',
            done: false,
            ideaId: i.id,
            captionId: null,
          }));

    if (overflowPosts.length > 0) {
      setPosts(overflowPosts);
    }
  }, [overflow.selectedCaptions, overflow.ideasData, overflow.selectedIdeaIds]);

  // Load diamond balance and costs
  useEffect(() => {
    diamond.fetchWallet();
    diamond.fetchCosts();
  }, []);

  const doneCount = posts.filter((p) => p.done).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageCost = (diamond.costs as any)?.costs?.image_generation || (diamond.costs as any)?.image || 50;

  const handleGenerate = async () => {
    setGenState('generating');
    setGenError(null);
    try {
      // Check diamond balance
      if (diamond.wallet && diamond.wallet.balance < imageCost) {
        diamond.openInsufficientModal(imageCost, diamond.wallet.balance, 'image_generation');
        setGenState('idle');
        return;
      }

      const post = posts[activePost];
      const provider = selectedProvider.toLowerCase() as 'openai' | 'gemini';
      const prompt = imageDesc || `Create a ${selectedStyle.toLowerCase()} style image for: "${post.title}"`;

      const result = await imageService.generate({
        prompt,
        title: post.title,
        provider,
        style: selectedStyle.toLowerCase().replace(' ', '_'),
        enhance_prompt: true,
        ...(textOverlay && overlayText ? { with_copy: true, copy_text: overlayText } : {}),
      });

      const imgUrl = result.generated_image_with_logo || result.generated_image || result.composited_image;
      setGeneratedImageUrl(imgUrl || null);
      setGenerationId(result.id);
      setGenState('done');

      // Refresh diamond balance
      diamond.fetchWallet();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Image generation failed.';
      setGenError(msg);
      setGenState('idle');
    }
  };

  const acceptImage = () => {
    const post = posts[activePost];
    if (post.captionId && generatedImageUrl) {
      overflow.setCaptionMedia(post.captionId, generatedImageUrl, generationId);
    }
    if (generationId) {
      overflow.addMedia(generationId);
    }
    setPosts((prev) => prev.map((p, i) => (i === activePost ? { ...p, done: true, imageUrl: generatedImageUrl || undefined } : p)));
    if (activePost < posts.length - 1) {
      setTimeout(() => {
        setActivePost(activePost + 1);
        setWizardStep(0);
        setMediaSource(null);
        setGenState('idle');
        setGeneratedImageUrl(null);
        setGenerationId(null);
      }, 500);
    }
  };

  const switchPost = (i: number) => {
    setActivePost(i);
    setWizardStep(0);
    setMediaSource(null);
    setGenState('idle');
    setGeneratedImageUrl(null);
    setGenerationId(null);
  };

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="animate-in">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <PhotoIcon className="w-5 h-5 text-coral" />
            <h2 className="text-[20px] font-bold text-text-primary">Media</h2>
          </div>
        </div>
        <div
          className="rounded-[14px] p-12 text-center mb-5"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <PhotoIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgb(var(--c-text-muted))' }} />
          <p className="text-text-secondary text-[14px] mb-1">No posts to generate media for</p>
          <p className="text-text-muted text-[12px]">Go back and approve some ideas first.</p>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-[14px]">
            <ArrowLeftIcon className="w-4 h-4" /> Previous
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <PhotoIcon className="w-5 h-5 text-coral" />
          <h2 className="text-[20px] font-bold text-text-primary">Media</h2>
        </div>
        <p className="text-[14px] text-text-secondary">
          Generate or upload an image for each post. Complete all {posts.length} to proceed.
        </p>
      </div>

      {/* Post Selector */}
      <div className="flex gap-2 mb-4 animate-in-delay-1">
        {posts.map((post, i) => (
          <button
            key={i}
            onClick={() => switchPost(i)}
            className={`chip flex-1 justify-center py-2.5 px-3 ${activePost === i ? 'active' : ''}`}
          >
            {post.done ? (
              <CheckCircleIcon className="w-3.5 h-3.5 text-green" />
            ) : (
              <span
                className="w-3.5 h-3.5 rounded-full inline-block"
                style={{ border: '2px solid rgba(255,255,255,0.15)' }}
              />
            )}
            <span className="text-[12px]">Post {i + 1}</span>
          </button>
        ))}
      </div>

      {/* Active Post Title */}
      <div
        className="rounded-[14px] p-3 px-4 mb-3.5 animate-in-delay-2"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div className="text-[14px] font-semibold text-text-primary">{posts[activePost].title}</div>
        <div className="text-[12.5px] text-text-muted mt-1">{posts[activePost].caption}</div>
      </div>

      {/* Mini-Wizard Step Indicators */}
      <div className="flex gap-1 mb-3.5 px-1 animate-in-delay-2">
        {WIZARD_STEPS.map((step, i) => (
          <button
            key={i}
            onClick={() => i <= wizardStep + 1 && setWizardStep(i)}
            className="flex-1 text-center py-2.5 rounded-[10px] transition-all duration-200"
            style={{
              background: wizardStep === i ? 'rgba(232,54,79,0.1)' : 'transparent',
              opacity: i > wizardStep + 1 ? 0.3 : 1,
              cursor: i <= wizardStep + 1 ? 'pointer' : 'default',
            }}
          >
            <div
              className="w-6 h-6 rounded-lg mx-auto mb-1 flex items-center justify-center text-[11px] font-extrabold"
              style={{
                background: i < wizardStep ? 'rgba(16,185,129,0.12)' : wizardStep === i ? 'rgba(232,54,79,0.15)' : 'rgba(255,255,255,0.04)',
                color: i < wizardStep ? 'rgb(var(--c-green))' : wizardStep === i ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-muted))',
              }}
            >
              {i < wizardStep ? '✓' : i + 1}
            </div>
            <span
              className="text-[11px]"
              style={{
                fontWeight: wizardStep === i ? 700 : 500,
                color: wizardStep === i ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-muted))',
              }}
            >
              {step.label}
            </span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div
        key={`step-${wizardStep}-${activePost}`}
        className="rounded-[14px] p-6 mb-5 min-h-[200px] slide-up"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* STEP 0: Source */}
        {wizardStep === 0 && (
          <div>
            <h3 className="text-[18px] font-bold text-text-primary mb-1.5">How do you want to add an image?</h3>
            <p className="text-[14px] text-text-muted mb-5">Pick one — you can always change your mind.</p>
            <div className="grid grid-cols-2 gap-3.5">
              {[
                { id: 'upload' as const, title: 'Upload Image', desc: 'Upload a photo or graphic from your computer', badge: null, nextStep: 3 },
                { id: 'ai' as const, title: 'AI Generate', desc: "We'll design a professional image for you", badge: `~${imageCost} 💎`, nextStep: 1 },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setMediaSource(opt.id); setWizardStep(opt.nextStep); }}
                  className="rounded-[14px] p-6 text-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: mediaSource === opt.id ? 'rgba(232,54,79,0.04)' : 'rgb(var(--c-bg-elevated))',
                    border: `1px solid ${mediaSource === opt.id ? 'rgba(232,54,79,0.4)' : 'var(--border-color)'}`,
                  }}
                >
                  <div className="w-12 h-12 rounded-[14px] mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(232,54,79,0.1)' }}>
                    {opt.id === 'upload' ? <ArrowUpTrayIcon className="w-5 h-5 text-coral" /> : <SparklesIcon className="w-5 h-5 text-coral" />}
                  </div>
                  <div className="text-[16px] font-bold text-text-primary mb-1">{opt.title}</div>
                  <div className="text-[13px] text-text-muted">{opt.desc}</div>
                  {opt.badge && (
                    <div className="mt-2.5">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: 'rgb(var(--c-amber))' }}>
                        {opt.badge}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-[13px] font-semibold text-text-secondary mb-1.5 block">Image Description (optional)</label>
              <textarea
                value={imageDesc}
                onChange={(e) => setImageDesc(e.target.value)}
                placeholder="Describe what you want the image to look like..."
                rows={2}
                className="input-field w-full resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 1: Visual Direction */}
        {wizardStep === 1 && (
          <div>
            <h3 className="text-[18px] font-bold text-text-primary mb-1.5">What style should your image be?</h3>
            <p className="text-[14px] text-text-muted mb-5">Pick a visual vibe. Don't worry, you can try different ones later.</p>
            <div className="mb-5">
              <label className="text-[14px] font-bold text-text-primary mb-2.5 block">Image style</label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setSelectedStyle(s)} className={`chip py-2.5 px-5 text-[14px] ${selectedStyle === s ? 'active' : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <label className="text-[14px] font-bold text-text-primary mb-2.5 block">AI engine</label>
              <div className="grid grid-cols-2 gap-2.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setSelectedProvider(p.name)}
                    className="rounded-[14px] p-4 text-center cursor-pointer transition-all duration-200"
                    style={{
                      background: selectedProvider === p.name ? 'rgba(232,54,79,0.04)' : 'rgb(var(--c-bg-elevated))',
                      border: `1px solid ${selectedProvider === p.name ? 'rgba(232,54,79,0.4)' : 'var(--border-color)'}`,
                    }}
                  >
                    <div className="text-[15px] font-bold text-text-primary">
                      {p.name}
                      {p.recommended && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(var(--c-blue))' }}>
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-text-muted mt-1">{p.cost} diamonds per image 💎</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setWizardStep(0)} className="btn-ghost flex items-center gap-1.5 text-[13px]">
                <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
              </button>
              <button onClick={() => setWizardStep(2)} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-white flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}>
                Next step <ArrowRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Text Overlay */}
        {wizardStep === 2 && (
          <div>
            <h3 className="text-[18px] font-bold text-text-primary mb-1.5">Want text on the image?</h3>
            <p className="text-[14px] text-text-muted mb-5">This adds marketing text directly onto the picture. Totally optional!</p>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[14px] font-semibold text-text-primary">Add text overlay</span>
              <button onClick={() => setTextOverlay(!textOverlay)} className="relative transition-all duration-200" style={{ width: 44, height: 24, borderRadius: 12, background: textOverlay ? 'rgb(var(--c-coral))' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-[2px] w-5 h-5 rounded-full bg-white transition-all duration-200" style={{ left: textOverlay ? 22 : 2 }} />
              </button>
            </div>
            {textOverlay && (
              <div className="pop mb-4">
                <label className="text-[14px] font-bold text-text-primary mb-2 block">What text?</label>
                <input type="text" value={overlayText} onChange={(e) => setOverlayText(e.target.value)} placeholder="Type your overlay text..." className="input-field w-full" />
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setWizardStep(1)} className="btn-ghost flex items-center gap-1.5 text-[13px]">
                <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
              </button>
              <button onClick={() => setWizardStep(3)} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-white flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}>
                Create my image <ArrowRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Generate & Review / Upload */}
        {wizardStep === 3 && (
          <div>
            {mediaSource === 'upload' ? (
              <div className="text-center py-6">
                <h3 className="text-[18px] font-bold text-text-primary mb-2">Upload your image</h3>
                <div className="w-[200px] h-[180px] mx-auto my-5 rounded-[18px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:border-text-muted" style={{ border: '2px dashed rgba(255,255,255,0.15)' }}>
                  <span className="text-[36px]">📁</span>
                  <span className="text-[14px] text-text-muted">Click to choose a file</span>
                  <span className="text-[12px] text-text-muted">PNG or JPG, up to 10MB</span>
                </div>
              </div>
            ) : (
              <>
                {/* Idle */}
                {genState === 'idle' && (
                  <div className="text-center">
                    <h3 className="text-[18px] font-bold text-text-primary mb-2">Ready to create!</h3>
                    <p className="text-[14px] text-text-muted mb-1.5">
                      Style: <strong className="text-text-primary">{selectedStyle}</strong> · Engine: <strong className="text-text-primary">{selectedProvider}</strong>
                      {textOverlay ? ' · With text overlay' : ''}
                    </p>
                    <div className="rounded-[12px] p-3 px-4 mx-auto max-w-[400px] mb-4 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">AI PROMPT PREVIEW</p>
                      <p className="text-[12px] text-text-secondary leading-relaxed">
                        Create a {selectedStyle.toLowerCase()} style image for: "{posts[activePost].title}".
                        {imageDesc && ` Additional: ${imageDesc}`}
                        {textOverlay && overlayText ? ` Include text: "${overlayText}"` : ''}
                      </p>
                    </div>
                    {genError && (
                      <div className="rounded-[10px] p-2.5 px-3 mb-3 max-w-[400px] mx-auto" style={{ background: 'rgba(232,54,79,0.08)', border: '1px solid rgba(232,54,79,0.2)' }}>
                        <p className="text-[12px]" style={{ color: 'rgb(var(--c-coral))' }}>{genError}</p>
                      </div>
                    )}
                    <button onClick={handleGenerate} className="px-8 py-4 rounded-[14px] text-[16px] font-bold text-white flex items-center gap-2 mx-auto" style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))', boxShadow: 'var(--shadow-glow-coral)' }}>
                      ✨ Create my image
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        ~{imageCost} 💎
                      </span>
                    </button>
                    <div className="mt-3">
                      <button onClick={() => setWizardStep(1)} className="btn-ghost text-[12px]">← Change settings</button>
                    </div>
                  </div>
                )}

                {/* Generating */}
                {genState === 'generating' && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-[14px] mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(232,54,79,0.1)', animation: 'pulse 1.5s ease-in-out infinite' }}>
                      <SparklesIcon className="w-5 h-5 text-coral" />
                    </div>
                    <div className="text-[17px] font-bold text-text-primary mb-1.5">Creating your image...</div>
                    <div className="text-[14px] text-text-muted mb-4">This usually takes about 10-20 seconds</div>
                    <div className="progress-bar-track max-w-[280px] mx-auto">
                      <div className="h-full rounded-full w-full" style={{ background: 'linear-gradient(90deg, rgb(var(--c-coral)), rgb(var(--c-purple)), rgb(var(--c-coral)))', backgroundSize: '400px 0', animation: 'shimmer 1.5s linear infinite' }} />
                    </div>
                  </div>
                )}

                {/* Done */}
                {genState === 'done' && (
                  <div className="pop text-center">
                    <div className="text-[48px] mb-2">🎉</div>
                    <h3 className="text-[20px] font-extrabold mb-1" style={{ color: 'rgb(var(--c-green))' }}>Image created!</h3>
                    <div className="w-full h-[180px] rounded-[16px] my-4 flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #1A1A2E, #2A1A3E, #1A2A3E)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {generatedImageUrl ? (
                        <img
                          src={generatedImageUrl.startsWith('http') ? generatedImageUrl : `/media/${generatedImageUrl}`}
                          alt="Generated"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[14px] text-text-muted">(image preview)</span>
                      )}
                    </div>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <button onClick={acceptImage} className="px-4 py-2 rounded-[10px] text-[13px] font-bold text-white flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}>
                        <CheckIcon className="w-3.5 h-3.5" /> Looks great, use it!
                      </button>
                      <button onClick={() => { setGenState('idle'); handleGenerate(); }} className="btn-secondary py-2 px-4 text-[13px] flex items-center gap-1.5">
                        <ArrowPathIcon className="w-3.5 h-3.5" /> Try again
                      </button>
                      <button onClick={() => { setWizardStep(1); setGenState('idle'); }} className="btn-secondary py-2 px-4 text-[13px] flex items-center gap-1.5">
                        <PencilSquareIcon className="w-3.5 h-3.5" /> Change style
                      </button>
                      <button onClick={() => { setMediaSource('upload'); setGenState('idle'); }} className="btn-secondary py-2 px-4 text-[13px] flex items-center gap-1.5">
                        <ArrowUpTrayIcon className="w-3.5 h-3.5" /> Upload my own instead
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Post Progress */}
      <div className="rounded-[14px] p-3 px-4 mb-5" style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-muted">Images done: {doneCount} of {posts.length}</span>
          <div className="flex gap-1.5">
            {posts.map((p, i) => (
              <div key={i} className="w-6 h-1 rounded-full transition-all duration-300" style={{ background: p.done ? 'rgb(var(--c-green))' : 'rgba(255,255,255,0.08)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-[14px]">
          <ArrowLeftIcon className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={onNext}
          disabled={doneCount < posts.length}
          className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white flex items-center gap-2 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
            boxShadow: 'var(--shadow-glow-coral)',
            opacity: doneCount < posts.length ? 0.35 : 1,
          }}
        >
          Continue to Post <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default MediaGenerationView;
