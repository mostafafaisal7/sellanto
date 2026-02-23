import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  TrophyIcon,
  ArrowTrendingDownIcon,
  LightBulbIcon,
  BeakerIcon,
  ClockIcon,
  SparklesIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  FireIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface PostSummary {
  id: number;
  title: string;
  platform: string;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
}

interface ABTestResult {
  test_name: string;
  variant_a: { label: string; metric: number; description: string };
  variant_b: { label: string; metric: number; description: string };
  winner: 'A' | 'B' | 'tie';
  confidence: number;
}

interface PillarPerformance {
  pillar_name: string;
  pillar_color: string;
  post_count: number;
  avg_engagement: number;
}

interface BestTime {
  day: string;
  hour: string;
  score: number;
}

interface WeeklyReport {
  id: number;
  period_start: string;
  period_end: string;
  winners: PostSummary[];
  losers: PostSummary[];
  best_hooks: string[];
  best_times: BestTime[];
  pillar_performance: PillarPerformance[];
  ab_test_results: ABTestResult[];
  recommendations: string[];
  test_plan: string[];
}

interface Props {
  brandId: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'text-blue-400',
  linkedin: 'text-blue-500',
  facebook: 'text-indigo-400',
  instagram: 'text-pink-400',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEngagement(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export function WeeklyReportView({ brandId }: Props) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [brandId]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/brands/${brandId}/weekly-report/`);
      setReports(Array.isArray(res.data) ? res.data : [res.data]);
    } catch (err) {
      console.error('Failed to load weekly report:', err);
      setError('Failed to load weekly report');
    }
    setLoading(false);
  };

  const report = reports[selectedIndex];

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-dark-800 border border-white/10 rounded-xl p-8"
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-3" />
          <p className="text-sm text-text-secondary">
            Generating your weekly report...
          </p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-dark-800 border border-white/10 rounded-xl p-8"
      >
        <div className="flex flex-col items-center justify-center py-8">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={loadReports}
            className="mt-3 text-xs text-primary-400 hover:text-primary-300"
          >
            Try again
          </button>
        </div>
      </motion.div>
    );
  }

  if (!report) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-dark-800 border border-white/10 rounded-xl p-8"
      >
        <div className="flex flex-col items-center justify-center py-8">
          <ChartBarIcon className="w-8 h-8 text-text-muted mb-2" />
          <p className="text-sm text-text-secondary">
            No weekly reports available yet
          </p>
          <p className="text-xs text-text-muted mt-1">
            Reports are generated once you have enough posting data
          </p>
        </div>
      </motion.div>
    );
  }

  const maxPillarEngagement = Math.max(
    ...report.pillar_performance.map((p) => p.avg_engagement),
    0.01
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800 border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                Weekly Performance Report
              </h3>
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <CalendarDaysIcon className="w-3.5 h-3.5" />
                {formatDate(report.period_start)} &mdash;{' '}
                {formatDate(report.period_end)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reports.length > 1 && (
              <select
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
                className="text-xs bg-dark-700 border border-white/10 rounded-lg px-2 py-1.5 text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {reports.map((r, idx) => (
                  <option key={r.id || idx} value={idx}>
                    {formatDate(r.period_start)} - {formatDate(r.period_end)}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={loadReports}
              className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Section 1: Winners & Losers */}
        <div>
          <button
            onClick={() => toggleSection('winners')}
            className="flex items-center justify-between w-full mb-3"
          >
            <div className="flex items-center gap-2">
              <TrophyIcon className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                Winners & Losers
              </h4>
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 text-text-muted transition-transform ${
                expandedSection === 'winners' ? 'rotate-180' : ''
              }`}
            />
          </button>
          <AnimatePresence>
            {expandedSection !== 'winners' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Winners */}
                  <div>
                    <p className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                      <TrophyIcon className="w-3 h-3" /> Top Performers
                    </p>
                    <div className="space-y-2">
                      {(report.winners || []).slice(0, 3).map((post, idx) => (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-3 p-2.5 bg-green-500/5 border border-green-500/10 rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] font-bold text-green-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary truncate">
                              {post.title}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              <span className={PLATFORM_COLORS[post.platform] || 'text-text-muted'}>
                                {post.platform}
                              </span>
                              {' '}&middot; {post.likes} likes &middot;{' '}
                              {post.comments} comments
                            </p>
                          </div>
                          <span className="text-xs font-mono text-green-400">
                            {formatEngagement(post.engagement_rate)}
                          </span>
                        </motion.div>
                      ))}
                      {(!report.winners || report.winners.length === 0) && (
                        <p className="text-xs text-text-muted py-2">No data</p>
                      )}
                    </div>
                  </div>

                  {/* Losers */}
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                      <ArrowTrendingDownIcon className="w-3 h-3" /> Underperformers
                    </p>
                    <div className="space-y-2">
                      {(report.losers || []).slice(0, 3).map((post, idx) => (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-3 p-2.5 bg-red-500/5 border border-red-500/10 rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] font-bold text-red-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary truncate">
                              {post.title}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              <span className={PLATFORM_COLORS[post.platform] || 'text-text-muted'}>
                                {post.platform}
                              </span>
                              {' '}&middot; {post.likes} likes &middot;{' '}
                              {post.comments} comments
                            </p>
                          </div>
                          <span className="text-xs font-mono text-red-400">
                            {formatEngagement(post.engagement_rate)}
                          </span>
                        </motion.div>
                      ))}
                      {(!report.losers || report.losers.length === 0) && (
                        <p className="text-xs text-text-muted py-2">No data</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 2: Best Hooks */}
        {report.best_hooks && report.best_hooks.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <FireIcon className="w-4 h-4 text-orange-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                Best Hooks
              </h4>
            </div>
            <div className="space-y-2">
              {report.best_hooks.map((hook, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-2.5 p-3 bg-dark-700/50 rounded-lg"
                >
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-orange-400">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed italic">
                    &ldquo;{hook}&rdquo;
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Best Times */}
        {report.best_times && report.best_times.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ClockIcon className="w-4 h-4 text-green-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                Best Posting Times
              </h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {report.best_times.map((time, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-2 p-2.5 bg-green-500/5 border border-green-500/10 rounded-lg"
                >
                  <ClockIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      {time.day}
                    </p>
                    <p className="text-[10px] text-text-muted">{time.hour}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-[10px] font-mono text-green-400">
                      {(time.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Pillar Performance */}
        {report.pillar_performance && report.pillar_performance.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ChartBarIcon className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                Content Pillar Performance
              </h4>
            </div>
            <div className="space-y-3">
              {report.pillar_performance.map((pillar, idx) => {
                const barWidth =
                  maxPillarEngagement > 0
                    ? (pillar.avg_engagement / maxPillarEngagement) * 100
                    : 0;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: pillar.pillar_color || '#8B5CF6',
                          }}
                        />
                        <span className="text-xs font-medium text-text-primary">
                          {pillar.pillar_name}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          ({pillar.post_count} posts)
                        </span>
                      </div>
                      <span className="text-xs font-mono text-text-secondary">
                        {formatEngagement(pillar.avg_engagement)}
                      </span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{
                          duration: 0.6,
                          delay: idx * 0.1,
                          ease: 'easeOut',
                        }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: pillar.pillar_color || '#8B5CF6',
                        }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 5: A/B Test Results */}
        {report.ab_test_results && report.ab_test_results.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BeakerIcon className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                A/B Test Results
              </h4>
            </div>
            <div className="space-y-3">
              {report.ab_test_results.map((test, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-dark-700/50 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-text-primary">
                      {test.test_name}
                    </p>
                    <span className="text-[10px] text-text-muted">
                      {(test.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Variant A */}
                    <div
                      className={`p-2.5 rounded-lg border ${
                        test.winner === 'A'
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-dark-700/30 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            test.winner === 'A'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-dark-700 text-text-muted'
                          }`}
                        >
                          A
                        </span>
                        {test.winner === 'A' && (
                          <TrophyIcon className="w-3 h-3 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">
                        {test.variant_a.label}
                      </p>
                      <p className="text-sm font-mono font-bold text-text-primary mt-1">
                        {typeof test.variant_a.metric === 'number'
                          ? formatEngagement(test.variant_a.metric)
                          : test.variant_a.metric}
                      </p>
                      {test.variant_a.description && (
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {test.variant_a.description}
                        </p>
                      )}
                    </div>
                    {/* Variant B */}
                    <div
                      className={`p-2.5 rounded-lg border ${
                        test.winner === 'B'
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-dark-700/30 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            test.winner === 'B'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-dark-700 text-text-muted'
                          }`}
                        >
                          B
                        </span>
                        {test.winner === 'B' && (
                          <TrophyIcon className="w-3 h-3 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">
                        {test.variant_b.label}
                      </p>
                      <p className="text-sm font-mono font-bold text-text-primary mt-1">
                        {typeof test.variant_b.metric === 'number'
                          ? formatEngagement(test.variant_b.metric)
                          : test.variant_b.metric}
                      </p>
                      {test.variant_b.description && (
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {test.variant_b.description}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Recommendations */}
        {report.recommendations && report.recommendations.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <LightBulbIcon className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                AI Recommendations
              </h4>
            </div>
            <div className="space-y-2">
              {report.recommendations.map((rec, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-2.5 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg"
                >
                  <SparklesIcon className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {rec}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Section 7: Test Plan */}
        {report.test_plan && report.test_plan.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <DocumentTextIcon className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-semibold text-text-primary">
                Next Week Test Plan
              </h4>
            </div>
            <div className="space-y-2">
              {report.test_plan.map((idea, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-2.5 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-indigo-400">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {idea}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default WeeklyReportView;
