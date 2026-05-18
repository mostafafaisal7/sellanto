import { useState, useEffect, useRef } from 'react';
import { api } from '../services';

const VIDEO_STYLES = [
  { id: 'realistic', label: 'Realistic', emoji: '📷' },
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬' },
  { id: 'product_showcase', label: 'Product', emoji: '🛍️' },
  { id: 'brand_story', label: 'Brand Story', emoji: '✨' },
  { id: 'promotional', label: 'Promo', emoji: '🎯' },
  { id: 'educational', label: 'Educational', emoji: '📚' },
  { id: 'lifestyle', label: 'Lifestyle', emoji: '🌟' },
  { id: 'artistic', label: 'Artistic', emoji: '🎨' },
];

const DURATIONS = [5, 8, 15];

interface HistoryItem {
  id: number;
  title: string;
  prompt: string;
  style: string;
  duration: number;
  status: string;
  video_url: string | null;
  created_at: string;
}

type GenStatus = 'idle' | 'loading' | 'done' | 'error';

export function VideoAIPage() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [duration, setDuration] = useState(8);
  const [status, setStatus] = useState<GenStatus>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Read pre-fill from URL params (from magic mode VideoPromptScreen redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultUrl = params.get('result');
    const titleParam = params.get('title');
    if (resultUrl) {
      setVideoUrl(decodeURIComponent(resultUrl));
      setStatus('done');
    }
    if (titleParam) {
      setPrompt(decodeURIComponent(titleParam));
    }
  }, []);

  // Load history
  useEffect(() => {
    api.get('/video/history/')
      .then((res) => setHistory(res.data.results || []))
      .catch(() => {});
  }, [status]);

  const canGenerate = prompt.trim().length >= 10 && status !== 'loading';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('loading');
    setError('');
    setVideoUrl(null);

    try {
      const res = await api.post('/video/generate/', { prompt: prompt.trim(), style, duration });
      const { generation_id } = res.data;
      if (!generation_id) throw new Error('Failed to start video generation.');

      // Poll until done (async backend to avoid Cloudflare 504)
      const deadline = Date.now() + 10 * 60 * 1000;
      let done = false;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await api.get(`/video/status/${generation_id}/`);
        const d = statusRes.data;
        if (d.status === 'completed' && d.video_url) {
          setVideoUrl(d.video_url);
          setStatus('done');
          setTimeout(() => videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
          done = true;
          break;
        }
        if (d.status === 'failed') {
          throw new Error(d.error || 'Generation failed. Please try again.');
        }
      }
      if (!done) throw new Error('Video generation timed out. Please try again.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Page header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-center gap-3"
        style={{
          background: 'rgba(var(--c-bg-primary-rgb, 18,18,18), 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <span className="text-[28px]">🎬</span>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-primary" style={{ letterSpacing: '-0.3px' }}>
            Video AI
          </h1>
          <p className="text-[12px] text-text-muted">Generate videos with Google Gemini / Veo</p>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Generator card */}
        <div
          className="rounded-[20px] p-6"
          style={{
            background: 'rgb(var(--c-bg-elevated))',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Prompt */}
          <label className="block text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Describe your video
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A modern coffee shop at golden hour, barista crafting latte art, cinematic close-ups, warm ambient lighting…"
            rows={4}
            className="w-full text-[15px] resize-none mb-5"
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: `1.5px solid ${prompt.trim().length >= 10 ? 'rgba(232,54,79,0.3)' : 'var(--border-color)'}`,
              background: 'rgba(255,255,255,0.04)',
              color: 'rgb(var(--c-text-primary))',
              outline: 'none',
            }}
          />

          {/* Style */}
          <label className="block text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Style
          </label>
          <div className="flex flex-wrap gap-2 mb-5">
            {VIDEO_STYLES.map((s) => {
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                  style={{
                    border: `1.5px solid ${active ? 'rgba(232,54,79,0.5)' : 'var(--border-color)'}`,
                    background: active ? 'rgba(232,54,79,0.1)' : 'rgba(255,255,255,0.03)',
                    color: active ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-secondary))',
                  }}
                >
                  <span>{s.emoji}</span> {s.label}
                </button>
              );
            })}
          </div>

          {/* Duration */}
          <label className="block text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Duration
          </label>
          <div className="flex gap-3 mb-6">
            {DURATIONS.map((d) => {
              const active = duration === d;
              return (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="px-5 py-2.5 rounded-[10px] text-[14px] font-bold transition-all"
                  style={{
                    border: `1.5px solid ${active ? 'rgba(232,54,79,0.5)' : 'var(--border-color)'}`,
                    background: active ? 'rgba(232,54,79,0.1)' : 'rgba(255,255,255,0.03)',
                    color: active ? 'rgb(var(--c-coral))' : 'rgb(var(--c-text-secondary))',
                  }}
                >
                  {d}s
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-[10px] px-4 py-3 mb-4 text-[13px]"
              style={{ background: 'rgba(232,54,79,0.08)', border: '1px solid rgba(232,54,79,0.2)', color: 'rgb(var(--c-coral))' }}
            >
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
            style={{
              background: canGenerate
                ? 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))'
                : 'rgba(255,255,255,0.07)',
              boxShadow: canGenerate ? 'var(--shadow-glow-coral)' : 'none',
              color: canGenerate ? 'white' : 'rgba(255,255,255,0.25)',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
            }}
          >
            {status === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                />
                Generating… this may take 1–3 minutes
              </span>
            ) : (
              '🎬 Generate Video'
            )}
          </button>
        </div>

        {/* Result */}
        {status === 'done' && videoUrl && (
          <div
            ref={videoRef as any}
            className="rounded-[20px] p-5"
            style={{
              background: 'rgb(var(--c-bg-elevated))',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-bold text-text-primary">Generated Video</h2>
              <a
                href={videoUrl}
                download
                className="px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))' }}
              >
                ⬇ Download
              </a>
            </div>
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              className="w-full rounded-[12px]"
              style={{ maxHeight: 480 }}
            />
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Recent Generations</h2>
            <div className="flex flex-col gap-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 rounded-[14px]"
                  style={{
                    background: 'rgb(var(--c-bg-elevated))',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    className="w-10 h-10 flex-shrink-0 rounded-[10px] flex items-center justify-center text-[18px]"
                    style={{ background: 'rgba(232,54,79,0.08)' }}
                  >
                    {item.status === 'completed' ? '🎬' : item.status === 'failed' ? '❌' : '⏳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-primary truncate">{item.title}</p>
                    <p className="text-[12px] text-text-muted">{item.style} · {item.duration}s · {item.status}</p>
                  </div>
                  {item.video_url && (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-[8px]"
                      style={{ background: 'rgba(232,54,79,0.1)', color: 'rgb(var(--c-coral))' }}
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoAIPage;
