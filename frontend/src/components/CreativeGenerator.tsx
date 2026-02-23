import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  PhotoIcon,
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  DocumentTextIcon,
  SwatchIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface Asset {
  id: number;
  url: string;
  thumbnail_url?: string;
  alt_text: string;
  width: number;
  height: number;
  file_type: string;
  created_at: string;
}

interface BrandTemplate {
  id: number;
  name: string;
  preview_url?: string;
  description: string;
}

interface Props {
  postId: number;
  onAssetGenerated?: () => void;
}

type StylePreset = 'realistic' | 'illustration' | 'minimal' | 'abstract';

const STYLE_PRESETS: {
  id: StylePreset;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    id: 'realistic',
    label: 'Realistic',
    description: 'Photorealistic style',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'illustration',
    label: 'Illustration',
    description: 'Digital illustration',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean & simple',
    color: 'from-gray-400 to-gray-600',
  },
  {
    id: 'abstract',
    label: 'Abstract',
    description: 'Artistic & creative',
    color: 'from-orange-500 to-red-500',
  },
];

export function CreativeGenerator({ postId, onAssetGenerated }: Props) {
  // Generate state
  const [selectedStyle, setSelectedStyle] = useState<StylePreset>('realistic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Assets state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  // Asset actions state
  const [generatingAlt, setGeneratingAlt] = useState<number | null>(null);
  const [resizingAsset, setResizingAsset] = useState<number | null>(null);
  const [resizeTarget, setResizeTarget] = useState<{
    width: number;
    height: number;
  }>({ width: 1080, height: 1080 });

  // Template state
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<{
    assetId: number;
    templateId: number;
  } | null>(null);
  const [selectedAssetForTemplate, setSelectedAssetForTemplate] = useState<
    number | null
  >(null);

  // Preview state
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  useEffect(() => {
    loadAssets();
  }, [postId]);

  const loadAssets = async () => {
    setLoadingAssets(true);
    setAssetsError(null);
    try {
      const res = await api.get(`/posts/${postId}/assets/`);
      setAssets(Array.isArray(res.data) ? res.data : res.data.assets || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setAssetsError('Failed to load assets');
    }
    setLoadingAssets(false);
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get('/brand-templates/');
      setTemplates(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
    setLoadingTemplates(false);
  };

  const handleGenerateFromCaption = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const payload: Record<string, unknown> = {
        post_id: postId,
        style: selectedStyle,
      };
      if (customPrompt.trim()) {
        payload.prompt = customPrompt.trim();
      }
      await api.post('/ai-image/generate/', payload);
      await loadAssets();
      onAssetGenerated?.();
    } catch (err: any) {
      console.error('Failed to generate image:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        'Failed to generate image. Please try again.';
      setGenerateError(msg);
    }
    setGenerating(false);
  };

  const handleGenerateAltText = async (assetId: number) => {
    setGeneratingAlt(assetId);
    try {
      const res = await api.post(`/assets/${assetId}/alt-text/`);
      setAssets(
        assets.map((a) =>
          a.id === assetId ? { ...a, alt_text: res.data.alt_text } : a
        )
      );
    } catch (err) {
      console.error('Failed to generate alt text:', err);
    }
    setGeneratingAlt(null);
  };

  const handleResize = async (assetId: number) => {
    setResizingAsset(assetId);
    try {
      await api.post(`/assets/${assetId}/resize/`, {
        width: resizeTarget.width,
        height: resizeTarget.height,
      });
      await loadAssets();
      onAssetGenerated?.();
    } catch (err) {
      console.error('Failed to resize asset:', err);
    }
    setResizingAsset(null);
  };

  const handleApplyTemplate = async (
    assetId: number,
    templateId: number
  ) => {
    setApplyingTemplate({ assetId, templateId });
    try {
      await api.post(`/assets/${assetId}/apply-template/`, {
        template_id: templateId,
      });
      await loadAssets();
      onAssetGenerated?.();
      setShowTemplates(false);
      setSelectedAssetForTemplate(null);
    } catch (err) {
      console.error('Failed to apply template:', err);
    }
    setApplyingTemplate(null);
  };

  const RESIZE_PRESETS = [
    { label: 'Square', width: 1080, height: 1080 },
    { label: 'Portrait', width: 1080, height: 1350 },
    { label: 'Story', width: 1080, height: 1920 },
    { label: 'Landscape', width: 1200, height: 628 },
    { label: 'Twitter', width: 1600, height: 900 },
    { label: 'LinkedIn', width: 1200, height: 627 },
  ];

  return (
    <div className="space-y-5">
      {/* Generate Section */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <SparklesIcon className="w-4 h-4 text-primary-400" />
          <h4 className="text-sm font-semibold text-text-primary">
            Generate Creative
          </h4>
        </div>

        {/* Style Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {STYLE_PRESETS.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                selectedStyle === style.id
                  ? 'border-primary-500 bg-primary-500/5'
                  : 'border-white/10 bg-dark-700/50 hover:border-white/20'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-br ${style.color} mb-2`}
              />
              <p className="text-xs font-medium text-text-primary">
                {style.label}
              </p>
              <p className="text-[10px] text-text-muted">{style.description}</p>
              {selectedStyle === style.id && (
                <motion.div
                  layoutId="style-check"
                  className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center"
                >
                  <CheckIcon className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </button>
          ))}
        </div>

        {/* Custom Prompt */}
        <div className="mb-3">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Optional: Add a custom prompt or leave blank to auto-generate from caption..."
            rows={2}
            className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Generate Error */}
        <AnimatePresence>
          {generateError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-red-400">{generateError}</p>
                </div>
                <button
                  onClick={() => setGenerateError(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate Button */}
        <button
          onClick={handleGenerateFromCaption}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              Generate from Caption
            </>
          )}
        </button>
      </motion.div>

      {/* Asset List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PhotoIcon className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-text-primary">
              Assets
            </h4>
            <span className="text-xs text-text-muted">
              ({assets.length})
            </span>
          </div>
          <button
            onClick={loadAssets}
            className="p-1 rounded hover:bg-white/5 text-text-secondary transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon
              className={`w-3.5 h-3.5 ${loadingAssets ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {loadingAssets ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mb-2" />
            <p className="text-xs text-text-secondary">Loading assets...</p>
          </div>
        ) : assetsError ? (
          <div className="flex flex-col items-center justify-center py-8">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 mb-2" />
            <p className="text-xs text-red-400">{assetsError}</p>
            <button
              onClick={loadAssets}
              className="mt-2 text-xs text-primary-400 hover:text-primary-300"
            >
              Try again
            </button>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 bg-dark-700/30 rounded-lg border border-dashed border-white/10">
            <PhotoIcon className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-xs text-text-secondary">
              No creative assets yet
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">
              Generate from caption or upload media
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {assets.map((asset, idx) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-dark-700/50 border border-white/10 rounded-lg overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative overflow-hidden bg-dark-700">
                  <img
                    src={asset.thumbnail_url || asset.url}
                    alt={asset.alt_text || 'Asset'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewAsset(asset)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <EyeIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {/* Dimensions badge */}
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/80">
                    {asset.width}x{asset.height}
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[10px] text-text-secondary truncate">
                    {asset.alt_text || 'No alt text'}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <button
                      onClick={() => handleGenerateAltText(asset.id)}
                      disabled={generatingAlt === asset.id}
                      className="text-[10px] flex items-center gap-0.5 px-1.5 py-1 rounded bg-dark-700 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                      title="Generate Alt Text"
                    >
                      {generatingAlt === asset.id ? (
                        <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-text-secondary" />
                      ) : (
                        <DocumentTextIcon className="w-2.5 h-2.5" />
                      )}
                      Alt
                    </button>
                    <button
                      onClick={() => {
                        if (resizingAsset === asset.id) {
                          setResizingAsset(null);
                        } else {
                          setResizingAsset(asset.id);
                        }
                      }}
                      className={`text-[10px] flex items-center gap-0.5 px-1.5 py-1 rounded transition-colors ${
                        resizingAsset === asset.id
                          ? 'bg-primary-500/10 text-primary-400'
                          : 'bg-dark-700 text-text-secondary hover:text-text-primary'
                      }`}
                      title="Resize"
                    >
                      <ArrowsPointingOutIcon className="w-2.5 h-2.5" />
                      Resize
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAssetForTemplate(asset.id);
                        setShowTemplates(true);
                        if (templates.length === 0) loadTemplates();
                      }}
                      className="text-[10px] flex items-center gap-0.5 px-1.5 py-1 rounded bg-dark-700 text-text-secondary hover:text-text-primary transition-colors"
                      title="Apply Template"
                    >
                      <SwatchIcon className="w-2.5 h-2.5" />
                      Template
                    </button>
                  </div>

                  {/* Resize panel */}
                  <AnimatePresence>
                    {resizingAsset === asset.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <div className="bg-dark-700/50 rounded-lg p-2 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {RESIZE_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                onClick={() =>
                                  setResizeTarget({
                                    width: preset.width,
                                    height: preset.height,
                                  })
                                }
                                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                                  resizeTarget.width === preset.width &&
                                  resizeTarget.height === preset.height
                                    ? 'bg-primary-500/20 text-primary-400'
                                    : 'bg-dark-700 text-text-muted hover:text-text-secondary'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={resizeTarget.width}
                              onChange={(e) =>
                                setResizeTarget({
                                  ...resizeTarget,
                                  width: Number(e.target.value),
                                })
                              }
                              className="w-16 bg-dark-800 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                            <XMarkIcon className="w-2.5 h-2.5 text-text-muted" />
                            <input
                              type="number"
                              value={resizeTarget.height}
                              onChange={(e) =>
                                setResizeTarget({
                                  ...resizeTarget,
                                  height: Number(e.target.value),
                                })
                              }
                              className="w-16 bg-dark-800 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                            <button
                              onClick={() => handleResize(asset.id)}
                              disabled={resizingAsset === asset.id && generating}
                              className="ml-auto text-[10px] px-2 py-0.5 rounded bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Template Overlay */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowTemplates(false);
              setSelectedAssetForTemplate(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-800 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <SwatchIcon className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-text-primary">
                    Brand Templates
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowTemplates(false);
                    setSelectedAssetForTemplate(null);
                  }}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Templates list */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {loadingTemplates ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mb-2" />
                    <p className="text-xs text-text-secondary">
                      Loading templates...
                    </p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <SwatchIcon className="w-8 h-8 text-text-muted mb-2" />
                    <p className="text-sm text-text-secondary">
                      No brand templates available
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Create templates in your brand settings
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {templates.map((template) => {
                      const isApplying =
                        applyingTemplate?.assetId ===
                          selectedAssetForTemplate &&
                        applyingTemplate?.templateId === template.id;
                      return (
                        <motion.button
                          key={template.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (selectedAssetForTemplate) {
                              handleApplyTemplate(
                                selectedAssetForTemplate,
                                template.id
                              );
                            }
                          }}
                          disabled={isApplying}
                          className="text-left bg-dark-700/50 border border-white/10 rounded-lg overflow-hidden hover:border-primary-500/50 transition-all disabled:opacity-50"
                        >
                          {template.preview_url ? (
                            <div className="aspect-video bg-dark-700 overflow-hidden">
                              <img
                                src={template.preview_url}
                                alt={template.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video bg-dark-700 flex items-center justify-center">
                              <SwatchIcon className="w-8 h-8 text-text-muted" />
                            </div>
                          )}
                          <div className="p-2.5">
                            <p className="text-xs font-medium text-text-primary truncate">
                              {template.name}
                            </p>
                            {template.description && (
                              <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">
                                {template.description}
                              </p>
                            )}
                            {isApplying && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary-400" />
                                <span className="text-[10px] text-primary-400">
                                  Applying...
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewAsset(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-3xl max-h-[85vh] mx-4"
            >
              <button
                onClick={() => setPreviewAsset(null)}
                className="absolute -top-10 right-0 p-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-text-secondary" />
              </button>
              <img
                src={previewAsset.url}
                alt={previewAsset.alt_text || 'Asset preview'}
                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  {previewAsset.width}x{previewAsset.height} &middot;{' '}
                  {previewAsset.file_type}
                </p>
                {previewAsset.alt_text && (
                  <p className="text-xs text-text-muted italic max-w-xs truncate">
                    {previewAsset.alt_text}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CreativeGenerator;
