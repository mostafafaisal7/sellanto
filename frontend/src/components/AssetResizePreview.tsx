import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface PlatformVariant {
  id: number;
  platform: string;
  label: string;
  width: number;
  height: number;
  image_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_size?: number;
  created_at: string;
}

interface Props {
  assetId: number;
}

const PLATFORM_DIMENSIONS: Record<string, { label: string; color: string }> = {
  'instagram_feed': { label: 'Instagram Feed', color: 'text-pink-400' },
  'instagram_story': { label: 'Instagram Story', color: 'text-pink-400' },
  'linkedin': { label: 'LinkedIn', color: 'text-blue-500' },
  'twitter': { label: 'Twitter / X', color: 'text-blue-400' },
  'facebook_feed': { label: 'Facebook Feed', color: 'text-blue-600' },
  'facebook_story': { label: 'Facebook Story', color: 'text-blue-600' },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function getAspectRatioStyle(width: number, height: number): React.CSSProperties {
  const maxPreviewHeight = 180;
  const maxPreviewWidth = 200;
  const ratio = width / height;

  let displayWidth: number;
  let displayHeight: number;

  if (ratio >= 1) {
    displayWidth = Math.min(maxPreviewWidth, maxPreviewHeight * ratio);
    displayHeight = displayWidth / ratio;
  } else {
    displayHeight = Math.min(maxPreviewHeight, maxPreviewWidth / ratio);
    displayWidth = displayHeight * ratio;
  }

  return {
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
  };
}

export function AssetResizePreview({ assetId }: Props) {
  const [variants, setVariants] = useState<PlatformVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  useEffect(() => {
    loadVariants();
  }, [assetId]);

  const loadVariants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/assets/${assetId}/versions/`);
      setVariants(res.data);
    } catch (err) {
      console.error('Failed to load asset variants:', err);
      setError('Failed to load resized variants');
    }
    setLoading(false);
  };

  const handleGenerateResize = async () => {
    setGenerating(true);
    setGenerateSuccess(false);
    try {
      await api.post(`/assets/${assetId}/resize/`);
      setGenerateSuccess(true);
      // Reload variants after a short delay to allow processing
      setTimeout(() => {
        loadVariants();
        setGenerateSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to generate resized variants:', err);
      setError('Failed to generate resized variants');
    }
    setGenerating(false);
  };

  const handleDownload = async (variant: PlatformVariant) => {
    if (!variant.image_url) return;
    try {
      const link = document.createElement('a');
      link.href = variant.image_url;
      link.download = `${variant.platform}_${variant.width}x${variant.height}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 bg-dark-700 rounded w-40" />
            <div className="h-8 bg-dark-700 rounded w-32" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-32 bg-dark-700 rounded-lg" />
                <div className="h-3 bg-dark-700 rounded w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && variants.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center space-y-3">
          <ExclamationTriangleIcon className="w-8 h-8 text-yellow-400 mx-auto" />
          <p className="text-sm text-text-secondary">{error}</p>
          <button onClick={loadVariants} className="btn-secondary text-sm">
            <ArrowPathIcon className="w-4 h-4 mr-1.5 inline" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <PhotoIcon className="w-5 h-5 text-primary-400" />
            Platform Variants
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {variants.length} variant{variants.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={handleGenerateResize}
          disabled={generating}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {generating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : generateSuccess ? (
            <CheckCircleIcon className="w-4 h-4" />
          ) : (
            <SparklesIcon className="w-4 h-4" />
          )}
          {generating ? 'Generating...' : generateSuccess ? 'Generated!' : 'Generate Resized'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Variants grid */}
      {variants.length === 0 ? (
        <div className="text-center py-8">
          <PhotoIcon className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No resized variants yet</p>
          <p className="text-xs text-text-muted mt-1">
            Click "Generate Resized" to create platform-specific versions
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {variants.map((variant, index) => {
            const platformInfo = PLATFORM_DIMENSIONS[variant.platform] || {
              label: variant.label || variant.platform,
              color: 'text-text-secondary',
            };
            const aspectStyle = getAspectRatioStyle(variant.width, variant.height);

            return (
              <motion.div
                key={variant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-dark-700/50 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors group"
              >
                {/* Preview area */}
                <div className="flex items-center justify-center mb-3 min-h-[120px]">
                  {variant.status === 'completed' && variant.image_url ? (
                    <div
                      className="rounded-md overflow-hidden border border-white/10 bg-dark-800"
                      style={aspectStyle}
                    >
                      <img
                        src={variant.image_url}
                        alt={`${platformInfo.label} variant`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : variant.status === 'processing' ? (
                    <div
                      className="rounded-md border border-white/10 bg-dark-800 flex items-center justify-center"
                      style={aspectStyle}
                    >
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto mb-1" />
                        <span className="text-[10px] text-text-muted">Processing</span>
                      </div>
                    </div>
                  ) : variant.status === 'failed' ? (
                    <div
                      className="rounded-md border border-red-500/20 bg-red-500/5 flex items-center justify-center"
                      style={aspectStyle}
                    >
                      <div className="text-center">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mx-auto mb-1" />
                        <span className="text-[10px] text-red-400">Failed</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-md border border-dashed border-white/10 bg-dark-800 flex items-center justify-center"
                      style={aspectStyle}
                    >
                      <PhotoIcon className="w-6 h-6 text-text-muted" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <p className={`text-xs font-medium ${platformInfo.color}`}>
                    {platformInfo.label}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted font-mono">
                      {variant.width} x {variant.height}
                    </span>
                    {variant.file_size && (
                      <span className="text-[10px] text-text-muted">
                        {formatFileSize(variant.file_size)}
                      </span>
                    )}
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        variant.status === 'completed'
                          ? 'bg-green-400'
                          : variant.status === 'processing'
                          ? 'bg-yellow-400 animate-pulse'
                          : variant.status === 'failed'
                          ? 'bg-red-400'
                          : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-[10px] text-text-muted capitalize">{variant.status}</span>
                  </div>
                </div>

                {/* Download button */}
                {variant.status === 'completed' && variant.image_url && (
                  <button
                    onClick={() => handleDownload(variant)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-dark-800 text-text-secondary hover:text-text-primary hover:bg-dark-700 border border-white/5 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Download
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AssetResizePreview;
