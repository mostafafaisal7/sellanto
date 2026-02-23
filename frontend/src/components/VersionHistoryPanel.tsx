import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  ArrowUturnLeftIcon,
  PhotoIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface AssetVersion {
  id: number;
  version_number: number;
  image_url: string | null;
  thumbnail_url: string | null;
  prompt_used: string;
  created_at: string;
  is_current: boolean;
  width?: number;
  height?: number;
  file_size?: number;
}

interface Props {
  assetId: number;
  onRestore?: (versionId: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionHistoryPanel({ assetId, onRestore }: Props) {
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [restoredId, setRestoredId] = useState<number | null>(null);

  useEffect(() => {
    loadVersions();
  }, [assetId]);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/assets/${assetId}/versions/`);
      setVersions(res.data);
    } catch (err) {
      console.error('Failed to load versions:', err);
      setError('Failed to load version history');
    }
    setLoading(false);
  };

  const handleRestore = async (version: AssetVersion) => {
    setRestoringId(version.id);
    try {
      await api.post(`/assets/${assetId}/versions/${version.id}/restore/`);
      setRestoredId(version.id);
      onRestore?.(version.id);
      // Reload versions to reflect current status change
      await loadVersions();
      setTimeout(() => setRestoredId(null), 3000);
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
    setRestoringId(null);
  };

  if (loading) {
    return (
      <div className="card p-5">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-dark-700 rounded" />
            <div className="h-5 bg-dark-700 rounded w-32" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-dark-700 rounded-full" />
                {i < 2 && <div className="w-0.5 h-16 bg-dark-700 mt-1" />}
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-20 bg-dark-700 rounded-lg" />
                <div className="h-3 bg-dark-700 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-center space-y-3">
          <ExclamationTriangleIcon className="w-8 h-8 text-yellow-400 mx-auto" />
          <p className="text-sm text-text-secondary">{error}</p>
          <button onClick={loadVersions} className="btn-secondary text-sm">
            <ArrowPathIcon className="w-4 h-4 mr-1.5 inline" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-primary-400" />
          Version History
        </h3>
        <span className="text-xs text-text-muted">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8">
          <ClockIcon className="w-10 h-10 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">No version history available</p>
          <p className="text-xs text-text-muted mt-1">
            Versions are created when you generate or modify assets
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline */}
          {versions.map((version, index) => {
            const isLast = index === versions.length - 1;
            const isRestoring = restoringId === version.id;
            const wasRestored = restoredId === version.id;

            return (
              <motion.div
                key={version.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-4"
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center flex-shrink-0">
                  {/* Version badge */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      version.is_current
                        ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                        : 'bg-dark-700 border-white/10 text-text-secondary'
                    }`}
                  >
                    {version.version_number}
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className="w-0.5 flex-1 min-h-[24px] bg-white/5 mt-1" />
                  )}
                </div>

                {/* Version content */}
                <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <div
                    className={`bg-dark-700/50 rounded-lg p-3 border transition-colors ${
                      version.is_current
                        ? 'border-primary-500/30'
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Version header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          Version {version.version_number}
                        </span>
                        {version.is_current && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-400">
                            Current
                          </span>
                        )}
                        {wasRestored && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1"
                          >
                            <CheckCircleIcon className="w-3 h-3" />
                            Restored
                          </motion.span>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail */}
                    <div className="flex gap-3">
                      <div className="w-20 h-20 rounded-md overflow-hidden bg-dark-800 border border-white/5 flex-shrink-0">
                        {version.thumbnail_url || version.image_url ? (
                          <img
                            src={version.thumbnail_url || version.image_url || ''}
                            alt={`Version ${version.version_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PhotoIcon className="w-6 h-6 text-text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Prompt used */}
                        {version.prompt_used && (
                          <p className="text-xs text-text-secondary line-clamp-2 mb-1.5">
                            {version.prompt_used}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                          <span className="text-[10px] text-text-muted" title={formatDateTime(version.created_at)}>
                            {timeAgo(version.created_at)}
                          </span>
                          {version.width && version.height && (
                            <span className="text-[10px] text-text-muted font-mono">
                              {version.width}x{version.height}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Restore button */}
                    {!version.is_current && (
                      <button
                        onClick={() => handleRestore(version)}
                        disabled={isRestoring}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-dark-800 text-text-secondary hover:text-text-primary hover:bg-dark-700 border border-white/5 transition-colors disabled:opacity-50"
                      >
                        {isRestoring ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-text-secondary" />
                        ) : (
                          <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                        )}
                        {isRestoring ? 'Restoring...' : 'Restore this version'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VersionHistoryPanel;
