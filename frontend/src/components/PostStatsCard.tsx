import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  UsersIcon,
  ChartBarIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface PostStats {
  impressions: number;
  reach: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
  snapshot_type: string;
}

interface Props {
  postId: number;
}

type SnapshotType = '24h' | '48h';

const PERFORMANCE_THRESHOLDS = {
  high: 5.0,
  medium: 2.0,
};

function getPerformanceColor(engagementRate: number): {
  dot: string;
  bg: string;
  text: string;
  label: string;
} {
  if (engagementRate >= PERFORMANCE_THRESHOLDS.high) {
    return {
      dot: 'bg-green-400',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      label: 'High',
    };
  }
  if (engagementRate >= PERFORMANCE_THRESHOLDS.medium) {
    return {
      dot: 'bg-yellow-400',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      label: 'Medium',
    };
  }
  return {
    dot: 'bg-red-400',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Low',
  };
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function PostStatsCard({ postId }: Props) {
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotType>('24h');

  useEffect(() => {
    loadStats();
  }, [postId, snapshot]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/posts/${postId}/stats/`, {
        params: { snapshot_type: snapshot },
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load post stats:', err);
      setError('Failed to load stats');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card p-4">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-dark-700" />
            <div className="h-4 bg-dark-700 rounded w-24" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 bg-dark-700 rounded w-12" />
                <div className="h-5 bg-dark-700 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadStats} className="btn-icon" title="Retry">
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const perf = getPerformanceColor(stats.engagement_rate);

  const metrics = [
    { icon: EyeIcon, label: 'Impressions', value: stats.impressions },
    { icon: UsersIcon, label: 'Reach', value: stats.reach },
    { icon: ChartBarIcon, label: 'Eng. Rate', value: stats.engagement_rate, suffix: '%', isRate: true },
    { icon: HeartIcon, label: 'Likes', value: stats.likes },
    { icon: ChatBubbleLeftIcon, label: 'Comments', value: stats.comments },
    { icon: ShareIcon, label: 'Shares', value: stats.shares },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="card p-4 space-y-3"
    >
      {/* Header with performance indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${perf.dot}`} />
          <span className={`text-xs font-medium ${perf.text}`}>{perf.label} Performance</span>
        </div>

        {/* Snapshot toggle */}
        <div className="flex items-center bg-dark-700 rounded-lg p-0.5">
          {(['24h', '48h'] as SnapshotType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSnapshot(type)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                snapshot === type
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Engagement rate highlight bar */}
      <div className={`${perf.bg} rounded-lg px-3 py-2 flex items-center justify-between`}>
        <span className="text-xs text-text-secondary">Engagement Rate</span>
        <span className={`text-sm font-bold ${perf.text}`}>
          {stats.engagement_rate.toFixed(2)}%
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(({ icon: Icon, label, value, suffix, isRate }) => (
          <div key={label} className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Icon className="w-3.5 h-3.5 text-text-muted" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              {isRate ? value.toFixed(2) : formatNumber(value)}
              {suffix || ''}
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default PostStatsCard;
