/**
 * AdsPage — /ads
 * ==============
 * Full Ads & Campaigns dashboard.
 * Demonstrates: ads_management, ads_read, pages_manage_ads, Marketing API Access Tier
 *
 * Features:
 *  - List all Meta ad campaigns with status, budget, spend
 *  - Campaign insights chart (impressions, clicks, spend over time)
 *  - Pause / Resume campaign controls
 *  - Entry points to Boost Post and Run Video Ad flows
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MegaphoneIcon,
  RocketLaunchIcon,
  FilmIcon,
  ArrowPathIcon,
  ChartBarIcon,
  PauseIcon,
  PlayIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  CursorArrowRaysIcon,
  EyeIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button, Card, Spinner } from '../components/ui';
import { adsService, type AdCampaign, type AdAccount } from '../services/adsService';
import { BoostPostModal } from '../components/ads/BoostPostModal';
import { RunVideoAdModal } from '../components/ads/RunVideoAdModal';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active:          { label: 'Active',          color: 'text-green-400',  bg: 'bg-green-500/15',  icon: CheckCircleIcon },
  paused:          { label: 'Paused',           color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: PauseIcon },
  draft:           { label: 'Draft',            color: 'text-blue-400',   bg: 'bg-blue-500/15',   icon: ClockIcon },
  pending_review:  { label: 'In Review',        color: 'text-purple-400', bg: 'bg-purple-500/15', icon: ClockIcon },
  completed:       { label: 'Completed',        color: 'text-text-muted', bg: 'bg-gray-500/15',   icon: CheckCircleIcon },
  disapproved:     { label: 'Disapproved',      color: 'text-red-400',    bg: 'bg-red-500/15',    icon: ExclamationCircleIcon },
  failed:          { label: 'Failed',           color: 'text-red-400',    bg: 'bg-red-500/15',    icon: ExclamationCircleIcon },
  archived:        { label: 'Archived',         color: 'text-text-muted', bg: 'bg-gray-500/15',   icon: ClockIcon },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Insights chart ────────────────────────────────────────────────────────────

interface InsightPoint {
  date: string;
  impressions: number;
  clicks: number;
  spend_minor: number;
}

function CampaignInsightsPanel({ campaignId }: { campaignId: number }) {
  const [data, setData] = useState<InsightPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'last_7d' | 'last_14d' | 'last_30d'>('last_7d');

  useEffect(() => {
    setLoading(true);
    adsService.getCampaignInsights(campaignId, period)
      .then((res) => setData(res.insights || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [campaignId, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="w-5 h-5 text-coral" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="py-10 text-center">
        <ChartBarIcon className="w-10 h-10 text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-muted">No insights data for this period.</p>
      </div>
    );
  }

  const totalImpressions = data.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = data.reduce((s, d) => s + d.clicks, 0);
  const totalSpend = data.reduce((s, d) => s + d.spend_minor, 0) / 100;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">Performance</p>
        <div className="flex items-center gap-1 bg-[#1A1A2E] border border-white/10 rounded-lg p-1">
          {(['last_7d', 'last_14d', 'last_30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                period === p ? 'bg-coral text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {p === 'last_7d' ? '7d' : p === 'last_14d' ? '14d' : '30d'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Impressions', value: totalImpressions.toLocaleString(), icon: EyeIcon, color: 'text-blue-400' },
          { label: 'Clicks', value: totalClicks.toLocaleString(), icon: CursorArrowRaysIcon, color: 'text-green-400' },
          { label: 'Spend', value: `$${totalSpend.toFixed(2)}`, icon: BanknotesIcon, color: 'text-coral' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#1A1A2E] rounded-xl p-3 text-center">
            <kpi.icon className={`w-4 h-4 ${kpi.color} mx-auto mb-1`} />
            <p className="text-lg font-bold text-text-primary">{kpi.value}</p>
            <p className="text-[10px] text-text-muted">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8364F" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E8364F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#16162A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#F1F1F6', fontSize: 11 }}
              itemStyle={{ color: '#9CA3AF', fontSize: 11 }}
            />
            <Area type="monotone" dataKey="impressions" stroke="#3B82F6" strokeWidth={2} fill="url(#impGrad)" name="Impressions" />
            <Area type="monotone" dataKey="clicks" stroke="#E8364F" strokeWidth={2} fill="url(#clkGrad)" name="Clicks" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Campaign row ──────────────────────────────────────────────────────────────

function CampaignRow({
  campaign,
  selected,
  onSelect,
  onPause,
  onResume,
  actionLoading,
}: {
  campaign: AdCampaign;
  selected: boolean;
  onSelect: () => void;
  onPause: () => void;
  onResume: () => void;
  actionLoading: boolean;
}) {
  const spendUsd = (campaign.spend_to_date_minor / 100).toFixed(2);
  const budgetUsd = (campaign.daily_budget_minor / 100).toFixed(2);

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        selected
          ? 'bg-coral/8 border-coral/30'
          : 'bg-[#1A1A2E] border-white/8 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">{campaign.name}</p>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-xs text-text-muted mt-1 capitalize">{campaign.objective?.replace(/_/g, ' ')}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-coral">${spendUsd}</p>
          <p className="text-[10px] text-text-muted">${budgetUsd}/day budget</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {campaign.start_date && (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {new Date(campaign.start_date).toLocaleDateString()}
            </span>
          )}
          {campaign.external_campaign_id && (
            <span className="font-mono text-[10px]">#{campaign.external_campaign_id.slice(-8)}</span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {campaign.status === 'active' && (
            <button
              disabled={actionLoading}
              onClick={onPause}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 text-xs transition-colors disabled:opacity-50"
            >
              <PauseIcon className="w-3.5 h-3.5" />
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              disabled={actionLoading}
              onClick={onResume}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs transition-colors disabled:opacity-50"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              Resume
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AdsPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<AdCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [videoAdOpen, setVideoAdOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accData, campData] = await Promise.all([
        adsService.listAdAccounts(),
        adsService.listCampaigns(),
      ]);
      setAccounts(accData.accounts || []);
      setCampaigns(campData.campaigns || []);
    } catch {
      setError('Could not load ads data. Make sure your Meta Ad Account is connected.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePause = async (id: number) => {
    setActionLoading(id);
    try {
      const updated = await adsService.pauseCampaign(id);
      setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
      if (selectedCampaign?.id === id) setSelectedCampaign(updated);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: number) => {
    setActionLoading(id);
    try {
      const updated = await adsService.resumeCampaign(id);
      setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)));
      if (selectedCampaign?.id === id) setSelectedCampaign(updated);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = statusFilter === 'all'
    ? campaigns
    : campaigns.filter((c) => c.status === statusFilter);

  const totalSpend = campaigns.reduce((s, c) => s + c.spend_to_date_minor, 0) / 100;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <MegaphoneIcon className="w-7 h-7 text-coral" />
            Ads & Campaigns
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage your Meta ad campaigns, track performance, and boost posts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData} className="flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setBoostOpen(true)} className="flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Boost Post
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setVideoAdOpen(true)} className="flex items-center gap-2">
            <FilmIcon className="w-4 h-4" />
            Video Ad
          </Button>
        </div>
      </div>

      {/* Permission info */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <MegaphoneIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-300">ads_management · ads_read · pages_manage_ads active</p>
          <p className="text-xs text-blue-400/80 mt-0.5">
            SellAnto manages your Meta ad campaigns, reads performance insights, and allows boosting organic posts directly from your content schedule.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Summary KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Ad Accounts', value: accounts.length, icon: MegaphoneIcon, color: 'text-coral' },
            { label: 'Total Campaigns', value: campaigns.length, icon: ChartBarIcon, color: 'text-purple-400' },
            { label: 'Active Campaigns', value: activeCampaigns, icon: RocketLaunchIcon, color: 'text-green-400' },
            { label: 'Total Spend', value: `$${totalSpend.toFixed(2)}`, icon: BanknotesIcon, color: 'text-blue-400' },
          ].map((kpi) => (
            <Card key={kpi.label} className="p-4">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{kpi.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-8 h-8 text-coral" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Campaigns ({filtered.length})
              </h2>
              <div className="flex items-center gap-1 bg-[#1A1A2E] border border-white/10 rounded-lg p-1">
                {['all', 'active', 'paused', 'completed'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-0.5 rounded text-xs font-medium capitalize transition-colors ${
                      statusFilter === s ? 'bg-coral text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <Card className="p-10 text-center">
                <MegaphoneIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-medium text-text-primary">No campaigns yet</p>
                <p className="text-xs text-text-muted mt-1">
                  Boost a post or run a video ad to create your first campaign.
                </p>
                <Button variant="primary" size="sm" className="mt-4" onClick={() => setBoostOpen(true)}>
                  <RocketLaunchIcon className="w-4 h-4 mr-2" />
                  Boost a Post
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    selected={selectedCampaign?.id === campaign.id}
                    onSelect={() => setSelectedCampaign(selectedCampaign?.id === campaign.id ? null : campaign)}
                    onPause={() => handlePause(campaign.id)}
                    onResume={() => handleResume(campaign.id)}
                    actionLoading={actionLoading === campaign.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Insights panel */}
          <div>
            <AnimatePresence mode="wait">
              {selectedCampaign ? (
                <motion.div
                  key={selectedCampaign.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="sticky top-4"
                >
                  <Card className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{selectedCampaign.name}</h3>
                        <StatusBadge status={selectedCampaign.status} />
                      </div>
                      <button
                        onClick={() => setSelectedCampaign(null)}
                        className="text-text-muted hover:text-text-primary text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <CampaignInsightsPanel campaignId={selectedCampaign.id} />
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full"
                >
                  <Card className="p-12 text-center h-full flex flex-col items-center justify-center">
                    <ChartBarIcon className="w-12 h-12 text-text-muted mb-4" />
                    <p className="text-sm font-medium text-text-primary">Select a campaign</p>
                    <p className="text-xs text-text-muted mt-1">Click any campaign to view its performance insights.</p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="p-5 cursor-pointer hover:border-coral/30 transition-colors group"
          onClick={() => setBoostOpen(true)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-coral/15 rounded-xl flex items-center justify-center group-hover:bg-coral/25 transition-colors">
              <RocketLaunchIcon className="w-5 h-5 text-coral" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Boost a Post</p>
              <p className="text-xs text-text-muted">Turn any published post into a paid ad</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Select a published Facebook or Instagram post, set your budget and targeting, and SellAnto will launch the campaign through the Marketing API.
          </p>
        </Card>
        <Card
          className="p-5 cursor-pointer hover:border-coral/30 transition-colors group"
          onClick={() => setVideoAdOpen(true)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500/15 rounded-xl flex items-center justify-center group-hover:bg-purple-500/25 transition-colors">
              <FilmIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Run a Video Ad</p>
              <p className="text-xs text-text-muted">Upload a video and launch as a paid campaign</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Upload a video directly, write your caption, set budget and audience targeting. SellAnto publishes it to your Page and creates the ad campaign simultaneously.
          </p>
        </Card>
      </div>

      <BoostPostModal isOpen={boostOpen} onClose={() => setBoostOpen(false)} />
      <RunVideoAdModal isOpen={videoAdOpen} onClose={() => setVideoAdOpen(false)} />
    </div>
  );
}
