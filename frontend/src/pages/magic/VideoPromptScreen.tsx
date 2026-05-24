import { useState, useRef } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const VIDEO_STYLES = [
  { id: 'product_showcase', label: 'Product Showcase', emoji: '🛍️', desc: 'Highlight your product visually' },
  { id: 'brand_story', label: 'Brand Story', emoji: '✨', desc: 'Tell your brand journey' },
  { id: 'promotional', label: 'Promotional', emoji: '🎯', desc: 'Drive sales & conversions' },
  { id: 'educational', label: 'Educational', emoji: '📚', desc: 'Teach your audience something' },
  { id: 'lifestyle', label: 'Lifestyle', emoji: '🌟', desc: 'Show the vibe & culture' },
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', desc: 'Movie-quality visuals' },
];

// Fixed 8-second duration — the duration picker was removed in favour of a
// single, consistent video length. Backend default also = 8.
const VIDEO_DURATION = 8;

interface VideoPromptScreenProps {
  onGenerate: (prompt: string, style: string, duration: number, referenceImage?: File) => void;
  onBack: () => void;
  isLoading?: boolean;
  initialPrompt?: string;
}

export function VideoPromptScreen({ onGenerate, onBack, isLoading = false, initialPrompt = '' }: VideoPromptScreenProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState('product_showcase');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleRemoveImage = () => {
    setReferenceImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSubmit = prompt.trim().length >= 10 && !isLoading;


  return (
    <div
      className="min-h-screen flex flex-col p-10 pb-5"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Header */}
      <div className="w-full max-w-[620px] mx-auto mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[36px]">🎬</span>
          <div>
            <h1
              className="text-[26px] font-extrabold text-text-primary"
              style={{ letterSpacing: '-0.3px' }}
            >
              Describe your video
            </h1>
            <p className="text-[14px] text-text-secondary">
              Tell us what you want — AI will bring it to life
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-[620px] mx-auto w-full gap-7">
        {/* Prompt textarea + attachment */}
        <div>
          <label className="block text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            What's your video about?
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A stylish coffee shop with warm lighting, showing a barista crafting latte art while soft jazz plays in the background…"
              rows={4}
              className="w-full text-[15px] resize-none"
              style={{
                padding: '16px 18px',
                paddingBottom: '52px',
                borderRadius: 14,
                border: `2px solid ${prompt.trim().length >= 10 ? 'rgba(232,54,79,0.35)' : 'var(--border-color)'}`,
                background: 'rgba(255,255,255,0.04)',
                color: 'rgb(var(--c-text-primary))',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
            {/* Attachment bar inside textarea */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '0 0 12px 12px',
                background: 'rgba(0,0,0,0.15)',
              }}
            >
              {imagePreview ? (
                <div className="flex items-center gap-2 flex-1">
                  <img
                    src={imagePreview}
                    alt="reference"
                    className="w-8 h-8 rounded-[6px] object-cover"
                  />
                  <span className="text-[12px] text-text-secondary truncate flex-1">
                    {referenceImage?.name}
                  </span>
                  <button
                    onClick={handleRemoveImage}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-[5px]"
                    style={{ background: 'rgba(232,54,79,0.1)', color: 'rgb(var(--c-coral))' }}
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-80"
                  style={{ color: 'rgb(var(--c-text-muted))' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 10.5l3-3 2 2 3-3.5 2.5 3" />
                    <rect x="1" y="1" width="12" height="12" rx="2" />
                  </svg>
                  Add reference image (optional — for image-to-video)
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          </div>
          <p className="text-[12px] text-text-muted mt-1.5">
            {prompt.trim().length < 10
              ? `${10 - prompt.trim().length} more characters to go`
              : `${prompt.trim().length} characters`}
          </p>
        </div>

        {/* Style selector */}
        <div>
          <label className="block text-[13px] font-semibold text-text-secondary mb-3 uppercase tracking-wide">
            Video style
          </label>
          <div className="grid grid-cols-2 gap-3">
            {VIDEO_STYLES.map((s) => {
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="text-left flex items-start gap-3 transition-all duration-200"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: `2px solid ${active ? 'rgba(232,54,79,0.4)' : 'var(--border-color)'}`,
                    background: active ? 'rgba(232,54,79,0.08)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <span className="text-[22px] mt-0.5">{s.emoji}</span>
                  <div>
                    <p
                      className="text-[14px] font-bold"
                      style={{ color: active ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-primary))' }}
                    >
                      {s.label}
                    </p>
                    <p className="text-[12px] text-text-muted">{s.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={() => canSubmit && onGenerate(prompt.trim(), style, VIDEO_DURATION, referenceImage ?? undefined)}
          disabled={!canSubmit}
          className="w-full py-4 rounded-[16px] text-[16px] font-bold text-white transition-all duration-200"
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))'
              : 'rgba(255,255,255,0.08)',
            boxShadow: canSubmit ? 'var(--shadow-glow-coral)' : 'none',
            color: canSubmit ? 'white' : 'rgba(255,255,255,0.3)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
              Generating video…
            </span>
          ) : (
            '🎬 Generate Video →'
          )}
        </button>
      </div>

      {/* Back */}
      <div className="w-full max-w-[620px] mx-auto pt-4">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  );
}

export default VideoPromptScreen;
