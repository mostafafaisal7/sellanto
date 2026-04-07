import { useState, useRef, useEffect } from 'react';

interface URLInputScreenProps {
  onSubmit: (url: string, logoFile?: File) => void;
  onSkip: () => void;
}

export function URLInputScreen({ onSubmit, onSkip }: URLInputScreenProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLogoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoSelect(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isValidURL = (input: string): boolean => {
    try {
      const parsed = new URL(input.startsWith('http') ? input : `https://${input}`);
      // Must have a real domain with at least one dot (e.g. example.com)
      const host = parsed.hostname;
      if (!host.includes('.')) return false;
      // Domain parts must be non-empty and have valid TLD (min 2 chars)
      const parts = host.split('.');
      if (parts.some((p) => p.length === 0)) return false;
      if (parts[parts.length - 1].length < 2) return false;
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = () => {
    if (!url.trim() || loading) return;
    setError('');

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    if (!isValidURL(finalUrl)) {
      setError('Please enter a valid website URL (e.g. https://yourbusiness.com)');
      return;
    }

    setLoading(true);
    setShowMessage(true);
    // Brief UX transition so the user sees the analyzing state
    setTimeout(() => {
      onSubmit(finalUrl, logoFile || undefined);
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
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
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

      {/* Logo upload (optional) */}
      <div className="w-full max-w-[480px] mt-5 au3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogoSelect(file);
          }}
        />
        {logoPreview ? (
          <div
            className="flex items-center gap-4 p-4 rounded-[16px] transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(232,54,79,0.2)',
            }}
          >
            <img
              src={logoPreview}
              alt="Logo preview"
              className="w-12 h-12 rounded-[10px] object-contain"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-text-primary truncate">
                {logoFile?.name}
              </p>
              <p className="text-[12px] text-text-muted">
                {logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : ''}
              </p>
            </div>
            <button
              onClick={clearLogo}
              className="p-2 rounded-[10px] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleLogoDrop}
            disabled={loading}
            className="w-full flex items-center gap-3 p-4 rounded-[16px] text-left transition-all hover:border-[rgba(232,54,79,0.3)]"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.12)',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(232,54,79,0.08)' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="rgb(var(--c-coral))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4v12M4 10h12" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text-secondary">
                Brand Logo <span className="text-text-muted font-normal">(Optional)</span>
              </p>
              <p className="text-[12px] text-text-muted">
                Upload your logo to include it in generated images
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-3 text-[13px] font-medium" style={{ color: 'rgb(var(--c-coral))' }}>
          {error}
        </p>
      )}

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
