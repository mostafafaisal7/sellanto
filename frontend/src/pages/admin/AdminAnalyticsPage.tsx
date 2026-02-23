import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { useAdminStore } from '../../store';

export function AdminAnalyticsPage() {
  const { analytics, analyticsLoading, fetchAnalytics } = useAdminStore();
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  if (analyticsLoading && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics) return null;

  const maxPostCount = Math.max(...(analytics.daily_posts.map(d => d.count)), 1);
  const maxCaptionCount = Math.max(...(analytics.daily_captions.map(d => d.count)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Platform usage and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-slate-500" />
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                days === d
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(analytics.platform_stats).map(([platform, count]) => {
          const colors: Record<string, string> = {
            facebook: 'from-blue-500 to-blue-600',
            instagram: 'from-pink-500 to-purple-600',
            twitter: 'from-sky-400 to-sky-500',
            linkedin: 'from-blue-600 to-blue-700',
          };
          return (
            <motion.div
              key={platform}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[platform] || 'from-slate-500 to-slate-600'} flex items-center justify-center mb-3`}>
                <ChartBarIcon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-white">{(count as number) || 0}</p>
              <p className="text-xs text-slate-400 capitalize">{platform} Posts</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Posts Chart */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-white">Daily Posts</h2>
          </div>
          <div className="p-5">
            {analytics.daily_posts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No data for this period</p>
            ) : (
              <div className="flex items-end gap-1 h-[200px]">
                {analytics.daily_posts.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-sm min-h-[2px] transition-all hover:from-amber-400 hover:to-amber-300"
                      style={{ height: `${(d.count / maxPostCount) * 100}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.date}: {d.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Captions Chart */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-white">Daily AI Captions</h2>
          </div>
          <div className="p-5">
            {analytics.daily_captions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No data for this period</p>
            ) : (
              <div className="flex items-end gap-1 h-[200px]">
                {analytics.daily_captions.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-sm min-h-[2px] transition-all hover:from-purple-400 hover:to-purple-300"
                      style={{ height: `${(d.count / maxCaptionCount) * 100}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.date}: {d.count} ({d.tokens.toLocaleString()} tokens)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-semibold text-white">Top Users by Token Usage</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Rank</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Posts</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Captions</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analytics.top_users.map((user, i) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-sm text-slate-500">#{i + 1}</td>
                  <td className="px-5 py-3 text-sm font-medium text-white">{user.username}</td>
                  <td className="px-5 py-3 text-sm text-slate-300">{user.posts}</td>
                  <td className="px-5 py-3 text-sm text-slate-300">{user.captions}</td>
                  <td className="px-5 py-3 text-sm text-amber-400 font-medium">{user.caption_tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;
