import { useState, useRef, useEffect } from 'react';

interface URLInputScreenProps {
  onSubmit: (url: string) => void;
  onSkip: () => void;
}

export function URLInputScreen({ onSubmit, onSkip }: URLInputScreenProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setShowMessage(true);
    // Brief UX transition so the user sees the analyzing state
    setTimeout(() => {
      onSubmit(url.trim());
    }, 400);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-10"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Floating emoji */}
      <div className="text-[56px] mb-6 animate-float au">🌐</div>

      <h1 className="text-[32px] font-black text-text-primary text-center mb-3 au1">
        What's your website?
      </h1>
      <p className="text-[16px] text-text-secondary text-center max-w-[520px] mb-8 leading-relaxed au2">
        Paste your website URL below. Our AI will visit it, understand your brand, style, and what you do — then create content that sounds like you.
      </p>

      {/* Input */}
      <div className="relative w-full max-w-[480px] au3">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourbusiness.com"
          disabled={loading}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full text-[17px] transition-all duration-200"
          style={{
            padding: '18px 140px 18px 22px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.04)',
            border: `2px solid ${url.trim() ? 'rgba(232,54,79,0.3)' : 'var(--border-color)'}`,
            color: 'rgb(var(--c-text-primary))',
            opacity: loading ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!url.trim() || loading}
          className="absolute right-[6px] top-[6px] bottom-[6px] px-5 rounded-[14px] text-[15px] font-bold text-white transition-all duration-200 flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
            opacity: !url.trim() ? 0.4 : 1,
          }}
        >
          {loading ? (
            <>
              <div
                className="w-4 h-4 rounded-full border-2 border-white/30 animate-spin"
                style={{ borderTopColor: 'white' }}
              />
              Analyzing...
            </>
          ) : (
            'Analyze →'
          )}
        </button>
      </div>

      {/* Loading message */}
      {showMessage && (
        <div className="mt-6 pop">
          <p className="text-[14px] text-text-secondary">
            🔍 Reading your website and learning about your brand...
          </p>
        </div>
      )}

      {/* Skip option */}
      <button
        onClick={onSkip}
        className="mt-8 text-[13px] transition-colors au4"
        style={{ color: 'rgb(var(--c-coral))', fontWeight: 600, cursor: 'pointer' }}
      >
        Don't have a website? No problem — answer questions instead
      </button>
    </div>
  );
}

export default URLInputScreen;
