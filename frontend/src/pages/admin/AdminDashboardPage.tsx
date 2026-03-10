import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UsersIcon,
  DocumentTextIcon,
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  ChatBubbleBottomCenterTextIcon,
  CurrencyDollarIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAdminStore } from '../../store';
import { diamondService } from '../../services/diamondService';

export function AdminDashboardPage() {
  const { dashboardStats, dashboardLoading, fetchDashboard, approveUser, rejectUser } = useAdminStore();
  const [diamondOverview, setDiamondOverview] = useState<{
    total_balance_in_circulation: number;
    total_diamonds_recharged: number;
    total_diamonds_spent: number;
    total_wallets: number;
  } | null>(null);

  useEffect(() => {
    fetchDashboard();
    diamondService.getDiamondOverview().then(setDiamondOverview).catch(() => {});
  }, [fetchDashboard]);

  const handleApprove = async (userId: number) => {
    await approveUser(userId);
    fetchDashboard();
  };

  const handleReject = async (userId: number) => {
    await rejectUser(userId);
    fetchDashboard();
  };

  if (dashboardLoading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const stats = dashboardStats;
  if (!stats) return null;

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: UsersIcon, color: 'from-blue-500 to-blue-600', subtext: `${stats.pending_users} pending` },
    { label: 'Total Posts', value: stats.total_posts, icon: DocumentTextIcon, color: 'from-green-500 to-green-600' },
    { label: 'AI Captions', value: stats.total_captions, icon: SparklesIcon, color: 'from-purple-500 to-purple-600' },
    { label: 'AI Images', value: stats.total_images, icon: PhotoIcon, color: 'from-pink-500 to-pink-600' },
    { label: 'AI Videos', value: stats.total_videos, icon: VideoCameraIcon, color: 'from-red-500 to-red-600' },
    { label: 'Social Accounts', value: stats.total_social_accounts, icon: LinkIcon, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Messenger Chats', value: stats.total_conversations, icon: ChatBubbleBottomCenterTextIcon, color: 'from-amber-500 to-amber-600' },
    { label: 'Est. Cost', value: `$${stats.estimated_cost}`, icon: CurrencyDollarIcon, color: 'from-emerald-500 to-emerald-600', subtext: `${stats.total_tokens.toLocaleString()} tokens` },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Overview of platform usage and statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            {stat.subtext && <p className="text-[10px] text-slate-500 mt-0.5">{stat.subtext}</p>}
          </motion.div>
        ))}
      </div>

      {/* Diamond Token Stats */}
      {diamondOverview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Diamonds in Circulation', value: diamondOverview.total_balance_in_circulation, color: 'text-cyan-400' },
            { label: 'Total Recharged', value: diamondOverview.total_diamonds_recharged, color: 'text-green-400' },
            { label: 'Total Spent', value: diamondOverview.total_diamonds_spent, color: 'text-amber-400' },
            { label: 'Active Wallets', value: diamondOverview.total_wallets, color: 'text-blue-400' },
          ].map((d) => (
            <div key={d.label} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg ${d.color}`}>◆</span>
              </div>
              <p className={`text-2xl font-bold ${d.color}`}>{d.value.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">{d.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-amber-400" />
              <h2 className="font-semibold text-white">Pending Approvals</h2>
            </div>
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              {stats.pending_users}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {stats.pending_approvals.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No pending approvals</div>
            ) : (
              stats.pending_approvals.map((user) => (
                <div key={user.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{user.username}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleApprove(user.id)}
                      className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                      title="Approve"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleReject(user.id)}
                      className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <XCircleIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-white">Top Users by Token Usage</h2>
          </div>
          <div className="divide-y divide-white/5">
            {stats.top_users.slice(0, 8).map((user, i) => (
              <Link
                key={user.id}
                to={`/admin-panel/users/${user.id}`}
                className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-5">#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{user.username}</p>
                    <p className="text-xs text-slate-400">{user.plan} plan</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{(user.caption_tokens || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">tokens</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Distribution + Recent Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-white">Plan Distribution</h2>
          </div>
          <div className="p-5 space-y-3">
            {stats.plan_distribution.map((pd) => {
              const percentage = stats.total_users > 0 ? Math.round((pd.count / stats.total_users) * 100) : 0;
              const colors: Record<string, string> = {
                free: 'bg-slate-500',
                starter: 'bg-green-500',
                pro: 'bg-amber-500',
                business: 'bg-blue-500',
                enterprise: 'bg-purple-500',
              };
              return (
                <div key={pd.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white capitalize">{pd.plan}</span>
                    <span className="text-xs text-slate-400">{pd.count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[pd.plan] || 'bg-slate-500'} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Posts */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-white">Recent Posts</h2>
          </div>
          <div className="divide-y divide-white/5">
            {stats.recent_posts.map((post) => (
              <div key={post.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-amber-400 font-medium">{post.username}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    post.status === 'posted' ? 'bg-green-500/10 text-green-400' :
                    post.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400' :
                    post.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {post.status}
                  </span>
                </div>
                <p className="text-sm text-slate-300 truncate">{post.caption || 'No caption'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{new Date(post.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
