/**
 * MediaPicker
 * ===========
 * Reusable ad-creative media picker with three tabs:
 *   1. "Previously generated" — grid from adsService.listMediaLibrary(kind).
 *   2. "Generate new"         — AI image (generateAdImage) / video (generateAdVideo).
 *   3. "Upload"               — file upload (uploadAdImage) with a progress bar.
 *
 * Controlled: emits onChange({ type, url }) when a media is chosen; a "Remove"
 * clears the selection. Self-contained, no page wiring. Errors are shown inline.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  PhotoIcon,
  SparklesIcon,
  ArrowUpTrayIcon,
  PlayIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { adsService, type MediaItem } from '../../services/adsService';
import { extractApiError } from '../../utils/extractApiError';

export interface MediaSelection {
  type: 'image' | 'video';
  url: string;
}

type MediaKind = 'image' | 'video' | 'both';
type Tab = 'library' | 'generate' | 'upload';

interface Props {
  value: MediaSelection | null;
  onChange: (next: MediaSelection | null) => void;
  /** Which media kinds are allowed. Defaults to 'image'. */
  kind?: MediaKind;
  /**
   * Accepted for API symmetry with the rest of the ads UI. The library /
   * generate / upload endpoints are account-agnostic today, so it's currently
   * unused — kept in the signature so callers don't need to change if the
   * backend later scopes media to an account.
   */
  adAccountId?: number;
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif';
const VIDEO_ACCEPT = 'video/mp4,video/quicktime';

export function MediaPicker({ value, onChange, kind = 'image', adAccountId }: Props) {
  void adAccountId; // reserved for future account-scoped media (see Props)
  const allowsImage = kind === 'image' || kind === 'both';
  const allowsVideo = kind === 'video' || kind === 'both';
  // Library kind param: 'all' only when both are allowed.
  const libraryKind: 'image' | 'video' | 'all' = kind === 'both' ? 'all' : kind;

  const [tab, setTab] = useState<Tab>('library');

  // ── Library ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<MediaItem[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    setLibError(null);
    try {
      const r = await adsService.listMediaLibrary(libraryKind);
      setItems(r.items || []);
    } catch (err: unknown) {
      setLibError(extractApiError(err).message);
      setItems([]);
    } finally {
      setLibLoading(false);
    }
  }, [libraryKind]);

  useEffect(() => {
    if (tab === 'library') loadLibrary();
  }, [tab, loadLibrary]);

  // ── Generate ─────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [genKind, setGenKind] = useState<'image' | 'video'>(allowsImage ? 'image' : 'video');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<MediaSelection | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      if (genKind === 'video') {
        const r = await adsService.generateAdVideo(prompt.trim(), { brandId: undefined });
        if (!r.video_url) throw new Error('No video was returned.');
        const sel: MediaSelection = { type: 'video', url: r.video_url };
        setGenResult(sel);
        onChange(sel);
      } else {
        const r = await adsService.generateAdImage(prompt.trim());
        if (!r.image_url) throw new Error('No image was returned.');
        const sel: MediaSelection = { type: 'image', url: r.image_url };
        setGenResult(sel);
        onChange(sel);
      }
    } catch (err: unknown) {
      setGenError(extractApiError(err).message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      // Only image upload is supported by the backend endpoint today.
      const r = await adsService.uploadAdImage(file, (p) => setUploadProgress(p));
      if (!r.image_url) throw new Error('Upload did not return a URL.');
      onChange({ type: 'image', url: r.image_url });
    } catch (err: unknown) {
      setUploadError(extractApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const isSelected = (url: string) => value?.url === url;

  const tabs: { key: Tab; label: string; icon: typeof PhotoIcon }[] = [
    { key: 'library', label: 'Previously generated', icon: PhotoIcon },
    { key: 'generate', label: 'Generate new', icon: SparklesIcon },
    { key: 'upload', label: 'Upload', icon: ArrowUpTrayIcon },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-3">
      {/* Selected preview */}
      {value && (
        <div className="mb-3 flex items-center gap-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black/40 shrink-0">
            {value.type === 'video' ? (
              <>
                <video src={value.url} className="w-full h-full object-cover" muted />
                <span className="absolute inset-0 flex items-center justify-center">
                  <PlayIcon className="w-5 h-5 text-white/90" />
                </span>
              </>
            ) : (
              <img src={value.url} alt="Selected media" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-green-300 flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> {value.type === 'video' ? 'Video' : 'Image'} selected
            </p>
            <p className="text-[10px] text-text-muted truncate">{value.url}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-text-secondary text-[11px] font-semibold"
          >
            <XMarkIcon className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              tab === t.key
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Library tab ── */}
      {tab === 'library' && (
        <div>
          {libError && (
            <div className="mb-2 p-2 rounded-lg bg-red-500/10 text-red-300 text-xs flex items-center justify-between gap-2">
              <span>{libError}</span>
              <button type="button" onClick={() => setLibError(null)} className="hover:text-white shrink-0">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {libLoading ? (
            <p className="py-6 text-center text-xs text-text-muted">Loading media…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">
              No media yet. Generate or upload one instead.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ type: m.kind, url: m.url })}
                  title={m.label}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                    isSelected(m.url)
                      ? 'border-purple-500 ring-2 ring-purple-500/40'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={m.thumbnail || m.url}
                    alt={m.label}
                    className="w-full h-full object-cover"
                  />
                  {m.kind === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <PlayIcon className="w-6 h-6 text-white/90" />
                    </span>
                  )}
                  {isSelected(m.url) && (
                    <span className="absolute top-1 right-1">
                      <CheckCircleIcon className="w-4 h-4 text-purple-300 drop-shadow" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Generate tab ── */}
      {tab === 'generate' && (
        <div className="space-y-2">
          {allowsImage && allowsVideo && (
            <div className="grid grid-cols-2 gap-2">
              {(['image', 'video'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setGenKind(k)}
                  className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    genKind === k
                      ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                      : 'bg-dark-900/60 text-text-muted border border-white/10 hover:border-white/20'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder={`Describe the ${genKind} you want (e.g. cozy candle on a wooden table, warm light)…`}
            className="w-full bg-dark-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none resize-none"
          />
          <button
            type="button"
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-semibold disabled:opacity-50"
          >
            <SparklesIcon className="w-4 h-4" />
            {generating ? 'Generating…' : `Generate ${genKind}`}
          </button>
          <p className="text-[10px] text-text-muted">Uses Diamond credits. The result is selected automatically.</p>

          {genError && (
            <div className="p-2 rounded-lg bg-red-500/10 text-red-300 text-xs flex items-center justify-between gap-2">
              <span>{genError}</span>
              <button type="button" onClick={() => setGenError(null)} className="hover:text-white shrink-0">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {genResult && (
            <div className="relative w-full max-h-48 rounded-lg overflow-hidden bg-black/40">
              {genResult.type === 'video' ? (
                <video src={genResult.url} className="w-full max-h-48 object-contain" controls muted />
              ) : (
                <img src={genResult.url} alt="Generated media" className="w-full max-h-48 object-contain" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Upload tab ── */}
      {tab === 'upload' && (
        <div className="space-y-2">
          <label
            className={`flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border border-dashed border-white/20 cursor-pointer hover:border-white/40 ${
              uploading ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <ArrowUpTrayIcon className="w-6 h-6 text-text-muted" />
            <span className="text-xs text-text-secondary font-semibold">Choose a file to upload</span>
            <span className="text-[10px] text-text-muted">
              {allowsVideo ? 'Images (PNG/JPG/GIF) or video (MP4/MOV)' : 'PNG, JPG or GIF up to 10 MB'}
            </span>
            <input
              type="file"
              accept={allowsVideo ? `${IMAGE_ACCEPT},${VIDEO_ACCEPT}` : IMAGE_ACCEPT}
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = '';
              }}
            />
          </label>
          {allowsVideo && (
            <p className="text-[10px] text-amber-400/90">
              Note: direct video upload isn’t supported here yet — pick a video from “Previously generated”.
            </p>
          )}

          {uploading && (
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {uploadError && (
            <div className="p-2 rounded-lg bg-red-500/10 text-red-300 text-xs flex items-center justify-between gap-2">
              <span>{uploadError}</span>
              <button type="button" onClick={() => setUploadError(null)} className="hover:text-white shrink-0">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MediaPicker;
