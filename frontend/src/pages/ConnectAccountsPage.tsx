import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  BoltIcon,
  CpuChipIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal, ConfirmModal, Spinner, PlatformIcon, platformColors, platformNames } from '../components/ui';
import type { SocialAccount, PlatformType } from '../types';
import { authFetch } from '../services/api';
import { toast as showToast } from '../store/toastStore';

// PLATFORM CONSTANTS MAPPED FROM DJANGO TEMPLATE
const platformFeatures: Record<string, string[]> = {
  facebook: ['Page Posts', 'Stories', 'Reels', 'Photo Albums'],
  instagram: ['Feed Posts', 'Stories', 'Reels', 'Carousels'],
  twitter: ['Tweets', 'Threads', 'Media Posts', 'Polls'],
  linkedin: ['Posts', 'Articles', 'Documents', 'Carousels'],
  tiktok: ['Videos', 'Photo Mode', 'Duets'],
  pinterest: ['Pins', 'Idea Pins', 'Boards'],
  youtube: ['Video Upload', 'Shorts', 'Community Posts'],
  telegram: ['Messages', 'Channels', 'Groups'],
  snapchat: ['Stories', 'Spotlight', 'Ads Manager'],
  reddit: ['Text Posts', 'Link Sharing', 'Media Posts'],
  medium: ['Articles', 'Publications', 'Tags'],
  tumblr: ['Multi-format', 'Reblogs', 'Tags'],
  mastodon: ['Toots', 'Media', 'Privacy Options'],
  twitch: ['Stream Info', 'Announcements', 'Clips'],
  whatsapp: ['Auto-reply', 'Templates', 'Media Support'],
  messenger: ['RAG Support', 'PDF Knowledge', 'Custom Prompts'],
  email: ['Auto-Reply', 'Smart Routing', 'Templates'],
  slack: ['Slash Commands', 'Channels', 'Threads'],
  discord: ['Server Mgmt', 'Moderation', 'Reactions'],
};

const platformDescriptions: Record<string, string> = {
  facebook: 'Post to your Facebook Pages automatically with scheduled content and media.',
  twitter: 'Schedule tweets with images and videos to your X/Twitter account.',
  instagram: 'Post photos and videos to your Instagram Business account automatically.',
  linkedin: 'Share professional content to your LinkedIn profile or company page.',
  tiktok: 'Schedule and publish engaging short-form videos to TikTok for Business.',
  pinterest: 'Pin your creative content and reach millions of users looking for inspiration.',
  youtube: 'Upload and schedule videos, shorts, and community posts to your YouTube channel.',
  telegram: 'Broadcast updates and automate posts to your Telegram channels and groups.',
  snapchat: "Share Stories and Spotlight content with Snapchat's engaged audience.",
  reddit: 'Post to subreddits and engage with communities on the front page of the internet.',
  medium: 'Publish long-form articles and stories to your Medium publication.',
  tumblr: 'Share text, photos, quotes, links, and more to your Tumblr blog.',
  mastodon: 'Post to the decentralized social network and join the fediverse.',
  twitch: 'Update your stream title, category, and post announcements to your Twitch channel.',
};

const postingPlatforms: PlatformType[] = ['facebook', 'instagram', 'twitter', 'linkedin'];
const secondaryPlatforms: PlatformType[] = ['tiktok', 'youtube', 'pinterest', 'telegram'];
const roadmapPlatforms: PlatformType[] = ['snapchat', 'reddit', 'medium', 'tumblr', 'mastodon', 'twitch'];

const chatbotPlatforms = [
  { id: 'messenger', name: 'Facebook Messenger', icon: 'messenger', status: 'Available Now', desc: 'AI-powered chatbot for Facebook Messenger with RAG and custom knowledge base.', features: platformFeatures.messenger, canConnect: true },
  { id: 'whatsapp', name: 'WhatsApp Business', icon: 'whatsapp', status: 'Launch Q1 2025', desc: 'Connect WhatsApp Business API for intelligent customer support automation.', features: platformFeatures.whatsapp, canConnect: false },
  { id: 'instagram_dm', name: 'Instagram DM', icon: 'instagram', status: 'Launch Q1 2025', desc: 'Automated responses for Instagram Direct Messages with AI intelligence.', features: ['DM Automation', 'Story Replies'], canConnect: false },
  { id: 'telegram_bot', name: 'Telegram Bot', icon: 'telegram', status: 'Launch Q2 2025', desc: 'Deploy AI chatbot on Telegram for instant automated messaging and commands.', features: ['Bot Commands', 'Groups'], canConnect: false },
];

const automationPlatforms = [
  { id: 'email', name: 'Email Automation', icon: 'email', status: 'Launch Q2 2025', desc: 'AI-powered email responses and customer support automation with smart routing.', features: platformFeatures.email },
  { id: 'slack', name: 'Slack Bot', icon: 'slack', status: 'Launch Q2 2025', desc: 'AI assistant for Slack workspaces with channel integration and slash commands.', features: platformFeatures.slack },
  { id: 'discord', name: 'Discord Bot', icon: 'discord', status: 'Launch Q2 2025', desc: 'Intelligent Discord bot with server management and automated moderation.', features: platformFeatures.discord },
];

const platformFieldLabels: Record<string, Record<string, { label: string; help: string; type: 'text' | 'textarea' }>> = {
  facebook: {
    facebook_page_id: { label: 'Facebook Page ID', help: 'Your Facebook Page ID (numeric)', type: 'text' },
    facebook_access_token: { label: 'Page Access Token', help: 'Long-lived Page Access Token from Graph API Explorer', type: 'textarea' },
  },
  messenger: {
    facebook_page_id: { label: 'Facebook Page ID', help: 'Your Facebook Page ID (numeric)', type: 'text' },
    facebook_access_token: { label: 'Page Access Token', help: 'Long-lived Page Access Token from Graph API Explorer', type: 'textarea' },
  },
  twitter: {
    twitter_api_key: { label: 'API Key (Consumer Key)', help: 'xxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
    twitter_api_secret: { label: 'API Secret (Consumer Secret)', help: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
    twitter_access_token: { label: 'Access Token', help: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
    twitter_access_token_secret: { label: 'Access Token Secret', help: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
  },
  instagram: {
    instagram_business_account_id: { label: 'Instagram Business Account ID', help: 'Your Instagram Business Account ID (numeric)', type: 'text' },
    instagram_access_token: { label: 'Access Token', help: 'Facebook Page Access Token (same as above)', type: 'textarea' },
  },
  linkedin: {
    linkedin_access_token: { label: 'Access Token', help: 'LinkedIn OAuth 2.0 Access Token', type: 'textarea' },
    linkedin_person_urn: { label: 'Person URN', help: "Your LinkedIn Person URN (from /v2/userinfo API 'sub' field)", type: 'text' },
  },
  telegram: {
    telegram_bot_token: { label: 'Bot Token', help: 'Your Telegram Bot Token from @BotFather', type: 'textarea' },
    telegram_channel_id: { label: 'Channel/Group ID', help: 'Your Telegram Channel or Group ID (e.g., -100xxxxxxxxxx)', type: 'text' },
  },
  tiktok: {
    tiktok_access_token: { label: 'Access Token', help: 'TikTok for Business API Access Token', type: 'textarea' },
  },
  youtube: {
    youtube_channel_id: { label: 'Channel ID', help: 'Your YouTube Channel ID', type: 'text' },
    youtube_access_token: { label: 'Access Token', help: 'Google OAuth 2.0 Access Token with YouTube Scopes', type: 'textarea' },
  },
  pinterest: {
    pinterest_access_token: { label: 'Access Token', help: 'Pinterest API Access Token', type: 'textarea' },
    pinterest_board_id: { label: 'Board ID', help: 'Target Pinterest Board ID', type: 'text' },
  }
};

export default function ConnectAccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [stats, setStats] = useState<{ connected_accounts: number, max_social_accounts: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualFormData, setManualFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [disconnectAccount, setDisconnectAccount] = useState<SocialAccount | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isValidating, setIsValidating] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [accountsRes, statsRes] = await Promise.all([
        authFetch('/api/v1/platforms/', { headers }),
        authFetch('/api/v1/dashboard/stats/', { headers })
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.results || data || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConnect = (p: PlatformType) => {
    setSelectedPlatform(p);
    setManualFormData({});
    setManualError(null);
    setShowManualForm(true);
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform) return;
    setIsSubmitting(true);
    setManualError(null);

    try {
      const response = await authFetch('/api/v1/platforms-detail/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ platform: selectedPlatform, ...manualFormData }),
      });

      if (response.ok) {
        setShowManualForm(false);
        await fetchData();
        showToast.success('Platform connected!');
      } else {
        const err = await response.json();
        setManualError(Object.values(err).flat().join(', ') || 'Connection failed. Please check your credentials.');
      }
    } catch (error) {
      setManualError('Server connection error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectAccount) return;
    setIsDisconnecting(true);
    try {
      const resp = await authFetch(`/api/v1/platforms/${disconnectAccount.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (resp.ok) {
        setDisconnectAccount(null);
        await fetchData();
        showToast.success('Platform disconnected.');
      }
    } catch (error) {
      console.error('Disconnect failed');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleValidate = async (id: number) => {
    setIsValidating(id);
    try {
      const response = await authFetch(`/api/v1/platforms-detail/${id}/validate_credentials/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        },
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        await fetchData();
        setToast({ message: 'Credentials validated successfully!', type: 'success' });
      } else {
        setToast({ message: `Validation failed: ${data.error || data.message || 'Unknown error'}`, type: 'error' });
        await fetchData();
      }
    } catch (error) {
      console.error('Validation error:', error);
      setToast({ message: 'Failed to validate credentials. Please check your connection.', type: 'error' });
    } finally {
      setIsValidating(null);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const connectedPlatforms = accounts.map(a => a.platform);

  const renderSectionHeader = (icon: string, title: string, subtitle: string) => (
    <div className="flex flex-col gap-2 mb-8">
      <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full w-fit">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-outfit">Module Matrix</span>
      </div>
      <h2 className="text-2xl font-black text-text-primary tracking-tight font-outfit">{title}</h2>
      <p className="text-text-secondary text-sm max-w-2xl">{subtitle}</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 p-4 lg:p-0">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-2xl bg-dark-800 border border-white/10 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 blur-[100px] rounded-full -mr-40 -mt-40" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-primary via-secondary to-accent p-[2px]">
              <div className="w-full h-full rounded-[10px] bg-dark-900 flex items-center justify-center">
                <BoltIcon className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Connect Platforms</h1>
              <p className="text-text-secondary text-sm">Link your social media accounts to start posting</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {stats && (
              <div className={clsx(
                "px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2",
                stats.connected_accounts >= stats.max_social_accounts
                  ? "bg-danger/10 border-danger/30 text-danger"
                  : "bg-primary/10 border-primary/30 text-primary"
              )}>
                <div className={clsx("w-2 h-2 rounded-full", stats.connected_accounts >= stats.max_social_accounts ? "bg-danger" : "bg-primary animate-pulse")} />
                {stats.connected_accounts} / {stats.max_social_accounts} connected
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/20">
              <ShieldCheckIcon className="w-5 h-5 text-success" />
              <span className="text-xs font-bold text-success">Secure</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* PRIMARY POSTING ENGINES */}
      <section>
        {renderSectionHeader("⚡", "Priority Publishing Engines", "High-throughput API pipelines for your primary social broadcasting channels.")}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {postingPlatforms.map(p => {
            const isConnected = connectedPlatforms.includes(p);
            return (
              <motion.div
                key={p}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                  "group relative overflow-hidden rounded-2xl p-5 border transition-all flex flex-col",
                  isConnected
                    ? "border-success/40 bg-success/5"
                    : "border-white/10 hover:border-primary/50 bg-dark-800/60"
                )}
              >
                {/* Help Icon */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleConnect(p); }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-primary/20 flex items-center justify-center transition-colors z-10"
                  title="How to connect"
                >
                  <QuestionMarkCircleIcon className="w-4 h-4 text-text-muted hover:text-primary" />
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110", platformColors[p]?.bg)}>
                    <PlatformIcon platform={p} className="text-white" size="md" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-text-primary">{platformNames[p]}</h3>
                    {isConnected && (
                      <span className="text-[10px] text-success font-bold uppercase">Connected</span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-text-secondary leading-relaxed mb-3 line-clamp-2">{platformDescriptions[p]}</p>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {platformFeatures[p]?.slice(0, 2).map(f => (
                    <span key={f} className="px-2 py-1 bg-dark-900/60 rounded-lg text-[9px] font-semibold text-text-muted border border-white/5">{f}</span>
                  ))}
                </div>

                <button
                  onClick={() => handleConnect(p)}
                  className={clsx(
                    "mt-auto w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                    isConnected
                      ? "bg-success/10 text-success border border-success/20 hover:bg-success/20"
                      : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                  )}
                >
                  {isConnected ? <CheckCircleIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                  {isConnected ? 'Manage' : 'Connect'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECONDARY & ROADMAP ENGINES */}
      <section>
        {renderSectionHeader("🛸", "Advanced Transmission Nodes", "Expanding your reach with secondary platform support and upcoming integrations.")}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {secondaryPlatforms.map(p => {
            const isConnected = connectedPlatforms.includes(p);
            return (
              <motion.div
                key={p}
                whileHover={{ y: -6, scale: 1.02 }}
                className={clsx(
                  "group relative p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3",
                  isConnected ? "border-success/30 bg-success/5" : "border-white/10 bg-dark-800/50 hover:border-secondary/40"
                )}
              >
                {/* Help Icon */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleConnect(p); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/5 hover:bg-primary/20 flex items-center justify-center transition-colors z-10"
                  title="How to connect"
                >
                  <QuestionMarkCircleIcon className="w-3.5 h-3.5 text-text-muted hover:text-primary" />
                </button>

                <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", isConnected ? platformColors[p]?.bg : "bg-dark-700")}>
                  <PlatformIcon platform={p} className={isConnected ? "text-white" : "text-text-muted"} size="md" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-text-primary truncate">{platformNames[p]}</h4>
                  <p className="text-[10px] text-text-muted">{isConnected ? 'Connected' : 'Not connected'}</p>
                </div>
                <button
                  onClick={() => handleConnect(p)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                    isConnected ? "bg-success/10 text-success" : "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  {isConnected ? 'Edit' : 'Add'}
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* ROADMAP GRID - Coming Soon */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
          {roadmapPlatforms.map(p => (
            <div key={p} className="p-3 rounded-xl bg-dark-900/40 border border-dashed border-white/5 opacity-50 grayscale flex flex-col items-center text-center group hover:grayscale-0 hover:opacity-80 transition-all">
              <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <PlatformIcon platform={p} className="text-text-muted" size="sm" />
              </div>
              <span className="text-[10px] font-bold text-text-muted">{platformNames[p] || p}</span>
              <span className="text-[8px] text-text-muted/50 mt-1">Coming Soon</span>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-dark-600" />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI CHATBOTS & AUTOMATION */}
      <section>
        {renderSectionHeader("🧠", "AI Chatbots", "Deploy intelligent AI agents to automate real-time communication.")}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {chatbotPlatforms.map(bot => (
            <motion.div
              key={bot.id}
              whileHover={bot.canConnect ? { y: -6 } : {}}
              onClick={() => bot.canConnect && handleConnect(bot.id as any)}
              className={clsx(
                "group relative p-4 rounded-xl bg-dark-800 border overflow-hidden transition-all",
                bot.canConnect ? "border-white/10 hover:border-warning/50 cursor-pointer" : "border-white/5 opacity-50"
              )}
            >
              <div className="absolute top-2 right-2">
                <span className={clsx(
                  "px-2 py-0.5 text-[8px] font-bold rounded-full",
                  bot.canConnect ? "bg-success/20 text-success" : "bg-dark-700 text-text-muted"
                )}>
                  {bot.canConnect ? 'Live' : 'Soon'}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-dark-700/50 flex items-center justify-center border border-white/5">
                  <PlatformIcon platform={bot.icon as any} size="md" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{bot.name}</h3>
                  <p className="text-[10px] text-text-muted">{bot.status}</p>
                </div>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed mb-3 line-clamp-2">{bot.desc}</p>
              <div className="flex flex-wrap gap-1">
                {bot.features.slice(0, 2).map(f => (
                  <span key={f} className="text-[8px] font-semibold text-text-muted px-2 py-0.5 rounded bg-white/5">{f}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* AUTOMATION TOOLS */}
      <section>
        {renderSectionHeader("⚡", "Other Automations", "Connect your ecosystem to AI-powered tools.")}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
          {automationPlatforms.map(p => (
            <div key={p.id} className="p-4 rounded-xl bg-dark-700/10 border border-white/5 flex items-center gap-3 hover:bg-dark-700/20 transition-colors opacity-60">
              <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center border border-white/10">
                <PlatformIcon platform={p.icon as any} className="text-text-muted" size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-text-primary truncate">{p.name}</h4>
                <p className="text-[10px] text-text-muted">{p.status}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIVE CONNECTIONS HUD */}
      <section className="pt-12 border-t border-white/10 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-black text-text-primary tracking-tighter uppercase font-outfit">Active Node Swarm</h2>
            <p className="text-text-secondary text-sm mt-2">Currently broadcasting via {accounts.length} authenticated API gateways.</p>
          </div>
          <div className="px-5 py-2.5 bg-dark-800 rounded-xl border border-primary/20 text-xs font-black text-primary flex items-center gap-3 shadow-[0_0_20px_rgba(var(--color-primary),0.08)]">
            <div className="w-2.5 h-2.5 bg-primary rounded-full animate-ping" />
            <span className="tracking-[0.2em]">SWARM_STRENGTH: {accounts.length}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-20"><Spinner size="lg" /></div>
        ) : accounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-16 text-center rounded-2xl bg-dark-800/20 border-2 border-dashed border-white/5 group hover:border-primary/20 transition-all duration-1000"
          >
            <div className="w-20 h-20 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative">
              <CpuChipIcon className="w-10 h-10 text-text-muted/20 group-hover:text-primary transition-all duration-500" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/0 group-hover:border-primary/20 group-hover:scale-125 transition-all duration-700" />
            </div>
            <p className="text-text-secondary text-lg font-black tracking-tighter">System awaiting directives. Zero active nodes.</p>
            <p className="text-text-muted text-sm mt-3 font-medium">Initialize a platform module above to establish your first API bridge.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {accounts.map(account => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-xl bg-dark-800 border border-white/8 hover:border-primary/30 transition-all shadow-md overflow-hidden"
                >
                  {/* Top accent line */}
                  <div className={clsx("h-1 w-full", platformColors[account.platform]?.bg || 'bg-primary')} />

                  <div className="p-5">
                    {/* Row 1: Platform icon + account info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={clsx("w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0", platformColors[account.platform]?.bg)}>
                        <PlatformIcon platform={account.platform} className="text-white" size="sm" />
                      </div>
                      <div className="flex-1 min-w-0 mr-2">
                        <h4 className="font-semibold text-text-primary text-sm leading-tight truncate">{account.account_name || 'Unnamed Account'}</h4>
                        <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
                          {account.platform}
                        </p>
                      </div>
                      <span className={clsx(
                        "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide flex-shrink-0",
                        account.status === 'active' ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      )}>
                        {account.status}
                      </span>
                    </div>

                    {/* Row 2: Action buttons */}
                    <div className="flex items-center gap-2 mb-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 rounded-lg h-9 text-[10px] font-semibold uppercase tracking-wide"
                        onClick={() => handleValidate(account.id)}
                        isLoading={isValidating === account.id}
                      >
                        Validate Node
                      </Button>
                      <button
                        className="w-9 h-9 rounded-lg bg-danger/8 hover:bg-danger/20 flex items-center justify-center transition-colors border border-transparent hover:border-danger/20 flex-shrink-0"
                        onClick={() => setDisconnectAccount(account)}
                      >
                        <TrashIcon className="w-4 h-4 text-danger/40 hover:text-danger" />
                      </button>
                    </div>

                    {/* Row 3: Sync info */}
                    <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-white/5 pt-3">
                      <span className="flex items-center gap-1.5">
                        <ArrowPathIcon className="w-3 h-3" />
                        Last Sync: {account.last_validated_at ? new Date(account.last_validated_at).toLocaleDateString() : 'Pending...'}
                      </span>
                      {account.is_validated && (
                        <span className="flex items-center gap-1 text-success font-medium">
                          <ShieldCheckIcon className="w-3 h-3" />
                          Trusted
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* CREDENTIAL AUTHORIZATION PROTOCOL MODAL */}
      <Modal
        isOpen={showManualForm}
        onClose={() => setShowManualForm(false)}
        title={`Authorize Node: ${selectedPlatform ? (platformNames[selectedPlatform] || selectedPlatform) : 'Social Endpoint'}`}
        size="lg"
      >
        <form onSubmit={handleSubmitManual} className="space-y-10 py-6">
          {manualError && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-7 bg-danger/10 border-2 border-danger/30 rounded-[2.5rem] text-danger text-sm flex items-start gap-5 font-bold shadow-2xl shadow-danger/5">
              <XCircleIcon className="w-8 h-8 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-lg tracking-tighter">AUTHENTICATION FAILURE</p>
                <p className="text-xs opacity-80 font-mono font-normal leading-relaxed">{manualError}</p>
              </div>
            </motion.div>
          )}

          <div className="p-10 bg-primary/5 border-2 border-primary/20 rounded-[3.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:rotate-12 transition-transform duration-700"><BoltIcon className="w-32 h-32" /></div>
            <h5 className="flex items-center gap-4 text-primary font-black uppercase tracking-[0.3em] text-[11px] mb-8">
              <InformationCircleIcon className="w-6 h-6" />
              INTELLIGENCE EXTRACTION PROTOCOL
            </h5>
            <ul className="text-xs text-text-secondary space-y-6 font-medium leading-relaxed">
              {['facebook', 'messenger'].includes(selectedPlatform || '') && (
                <>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">01</span>
                    <span>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold hover:text-text-primary transition-colors">Meta Developers</a> → Create or select your app → Add "Facebook Login" product.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">02</span>
                    <span>Open <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold hover:text-text-primary transition-colors">Graph API Explorer</a> → Select your app → Click "Get User Access Token" → Check permissions: <code className="bg-dark-900 border border-white/10 px-2 py-0.5 rounded-lg text-warning font-mono text-[10px]">pages_manage_posts</code>, <code className="bg-dark-900 border border-white/10 px-2 py-0.5 rounded-lg text-warning font-mono text-[10px]">pages_read_engagement</code>, <code className="bg-dark-900 border border-white/10 px-2 py-0.5 rounded-lg text-warning font-mono text-[10px]">pages_show_list</code></span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">03</span>
                    <span><strong className="text-text-primary">Get Page ID:</strong> In Graph API Explorer, type <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">/me/accounts</code> and click Submit. Copy the <code className="text-success">id</code> of your page.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">04</span>
                    <span><strong className="text-text-primary">Get Page Access Token:</strong> From the same response, copy the <code className="text-success">access_token</code> for your page. For long-lived token, use <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold">Access Token Debugger</a> → Extend Token.</span>
                  </li>
                </>
              )}
              {selectedPlatform === 'instagram' && (
                <>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">01</span>
                    <span><strong className="text-text-primary">Requirements:</strong> You need an <span className="text-warning">Instagram Business/Creator Account</span> connected to a <span className="text-warning">Facebook Page</span>. Go to Instagram Settings → Account → Switch to Professional Account.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">02</span>
                    <span>Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold hover:text-text-primary transition-colors">Graph API Explorer</a> → Select your app → Get User Access Token with permissions: <code className="bg-dark-900 border border-white/10 px-2 py-0.5 rounded-lg text-warning font-mono text-[10px]">instagram_basic</code>, <code className="bg-dark-900 border border-white/10 px-2 py-0.5 rounded-lg text-warning font-mono text-[10px]">instagram_content_publish</code>, <code className="bg-dark-900 border border-white/10 px-2 py-0.5 rounded-lg text-warning font-mono text-[10px]">pages_show_list</code></span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">03</span>
                    <span><strong className="text-text-primary">Get Instagram Business ID:</strong> In Graph API Explorer, query: <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">/me/accounts?fields=instagram_business_account</code> → Copy the <code className="text-success">instagram_business_account.id</code></span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">04</span>
                    <span><strong className="text-text-primary">Access Token:</strong> Use the same Facebook Page Access Token from step 2. Extend it using <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold">Access Token Debugger</a> for long-lived token.</span>
                  </li>
                </>
              )}
              {selectedPlatform === 'twitter' && (
                <>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">01</span>
                    <span>Go to <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold hover:text-text-primary transition-colors">X Developer Portal</a> → Create a project and app (Free tier works).</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">02</span>
                    <span>In your app settings → User Authentication Settings → Set App Permissions to <span className="text-text-primary font-bold">Read and Write</span> → Save.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">03</span>
                    <span>Go to "Keys and Tokens" tab → Generate <strong className="text-text-primary">API Key & Secret</strong> (Consumer Keys) and <strong className="text-text-primary">Access Token & Secret</strong>.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">04</span>
                    <span><strong className="text-warning">Important:</strong> If you regenerate keys, you must update them here. Keep your secrets safe!</span>
                  </li>
                </>
              )}
              {selectedPlatform === 'linkedin' && (
                <>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">01</span>
                    <span>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold hover:text-text-primary transition-colors">LinkedIn Developers</a> → Create an app → Verify your company page.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">02</span>
                    <span>In Products tab → Request access to <span className="text-warning">Share on LinkedIn</span> and <span className="text-warning">Sign In with LinkedIn using OpenID Connect</span>.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">03</span>
                    <span><strong className="text-text-primary">Get Access Token:</strong> Use OAuth 2.0 flow or <a href="https://www.linkedin.com/developers/tools/oauth/token-generator" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold">LinkedIn Token Generator</a> with scopes: <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">w_member_social</code>, <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">openid</code>, <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">profile</code></span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">04</span>
                    <span><strong className="text-text-primary">Get Person URN:</strong> Call <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">GET /v2/userinfo</code> with your token. The <code className="text-success">sub</code> field is your Person URN (e.g., <code className="text-success">urn:li:person:ABC123</code>).</span>
                  </li>
                </>
              )}
              {selectedPlatform === 'telegram' && (
                <>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">01</span>
                    <span>Open Telegram and message <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold hover:text-text-primary transition-colors">@BotFather</a> → Send <code className="bg-dark-900 px-2 py-0.5 rounded text-warning font-mono">/newbot</code> → Follow prompts to create your bot.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">02</span>
                    <span><strong className="text-text-primary">Bot Token:</strong> BotFather will give you a token like <code className="text-success">123456789:ABCdefGHIjklMNOpqrsTUVwxyz</code>. Copy this.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">03</span>
                    <span>Add your bot to your channel/group as <strong className="text-text-primary">Administrator</strong> with "Post Messages" permission.</span>
                  </li>
                  <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">04</span>
                    <span><strong className="text-text-primary">Get Channel ID:</strong> Message <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="text-primary underline font-extrabold">@getmyid_bot</a> in your channel, or forward a message from your channel to it. Channel IDs start with <code className="text-success">-100</code>.</span>
                  </li>
                </>
              )}
              {!['facebook', 'messenger', 'twitter', 'instagram', 'linkedin', 'telegram'].includes(selectedPlatform || '') && (
                <li className="flex gap-4"><span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">00</span><span>Consult the official API documentation for <strong>{selectedPlatform}</strong> to extract the required synchronization sequences.</span></li>
              )}
            </ul>

            {/* Quick Links Section */}
            <div className="mt-8 p-6 bg-dark-900/50 rounded-2xl border border-white/5">
              <h6 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-4">Quick Reference Links</h6>
              <div className="flex flex-wrap gap-3">
                {['facebook', 'messenger', 'instagram'].includes(selectedPlatform || '') && (
                  <>
                    <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#1877F2]/10 text-[#1877F2] rounded-xl text-xs font-bold hover:bg-[#1877F2]/20 transition-colors">Graph API Explorer</a>
                    <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#1877F2]/10 text-[#1877F2] rounded-xl text-xs font-bold hover:bg-[#1877F2]/20 transition-colors">Token Debugger</a>
                    <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#1877F2]/10 text-[#1877F2] rounded-xl text-xs font-bold hover:bg-[#1877F2]/20 transition-colors">My Apps</a>
                  </>
                )}
                {selectedPlatform === 'twitter' && (
                  <>
                    <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">X Developer Portal</a>
                    <a href="https://developer.twitter.com/en/docs/twitter-api" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">API Docs</a>
                  </>
                )}
                {selectedPlatform === 'linkedin' && (
                  <>
                    <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#0A66C2]/10 text-[#0A66C2] rounded-xl text-xs font-bold hover:bg-[#0A66C2]/20 transition-colors">LinkedIn Apps</a>
                    <a href="https://www.linkedin.com/developers/tools/oauth/token-generator" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#0A66C2]/10 text-[#0A66C2] rounded-xl text-xs font-bold hover:bg-[#0A66C2]/20 transition-colors">Token Generator</a>
                  </>
                )}
                {selectedPlatform === 'telegram' && (
                  <>
                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#0088cc]/10 text-[#0088cc] rounded-xl text-xs font-bold hover:bg-[#0088cc]/20 transition-colors">@BotFather</a>
                    <a href="https://t.me/getmyid_bot" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#0088cc]/10 text-[#0088cc] rounded-xl text-xs font-bold hover:bg-[#0088cc]/20 transition-colors">@getmyid_bot</a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {selectedPlatform && platformFieldLabels[selectedPlatform] ? (
              Object.entries(platformFieldLabels[selectedPlatform]).map(([key, config]) => (
                <div key={key}>
                  <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.4em] mb-4 pl-3 flex justify-between">
                    {config.label}
                    <span className="text-primary/40 font-mono tracking-tighter">NODE_INPUT_{key.toUpperCase()}</span>
                  </label>
                  {config.type === 'textarea' ? (
                    <textarea required value={manualFormData[key] || ''} onChange={e => setManualFormData({ ...manualFormData, [key]: e.target.value })} rows={4} className="w-full bg-dark-900/50 border-2 border-white/5 rounded-[2rem] px-8 py-6 text-text-primary font-mono text-sm focus:border-primary/50 transition-all focus:ring-4 focus:ring-primary/5 shadow-inner" placeholder={config.help} />
                  ) : (
                    <input type="text" required value={manualFormData[key] || ''} onChange={e => setManualFormData({ ...manualFormData, [key]: e.target.value })} className="w-full bg-dark-900/50 border-2 border-white/5 rounded-[2rem] px-8 py-6 text-text-primary font-mono text-sm focus:border-primary/50 transition-all focus:ring-4 focus:ring-primary/5 shadow-inner" placeholder={config.help} />
                  )}
                </div>
              ))
            ) : (
              <div className="p-20 text-center bg-dark-900/40 rounded-[3rem] border-2 border-dashed border-white/10">
                <CpuChipIcon className="w-16 h-16 text-text-muted/10 mx-auto mb-6" />
                <p className="text-text-muted font-bold tracking-tighter uppercase">Protocol fields not yet mapped for this node.</p>
              </div>
            )}
          </div>

          <div className="flex gap-6 pt-10">
            <Button variant="secondary" fullWidth className="h-20 rounded-3xl font-black uppercase tracking-[0.3em] border-2 border-white/5 hover:bg-dark-700" onClick={() => setShowManualForm(false)} type="button">Discard Node</Button>
            <Button type="submit" fullWidth className="h-20 rounded-3xl font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(var(--color-primary),0.2)]" isLoading={isSubmitting} disabled={!selectedPlatform || !platformFieldLabels[selectedPlatform]}>Establish Link</Button>
          </div>
        </form>
      </Modal>

      {/* CONNECTION SEVERANCE AUTHENTICATION */}
      <ConfirmModal
        isOpen={!!disconnectAccount}
        onClose={() => setDisconnectAccount(null)}
        onConfirm={handleDisconnect}
        title="Sever Operational Link?"
        message={`Are you absolutely certain you wish to terminate the API bridge for ${disconnectAccount ? (platformNames[disconnectAccount.platform] || disconnectAccount.platform) : 'this node'}? All automated directives assigned to this endpoint will be aborted permanently.`}
        confirmText="Confirm Severance"
        variant="danger"
        isLoading={isDisconnecting}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={clsx(
              "fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border",
              toast.type === 'success'
                ? "bg-success/10 border-success/30 text-success"
                : "bg-danger/10 border-danger/30 text-danger"
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircleIcon className="w-6 h-6" />
            ) : (
              <XCircleIcon className="w-6 h-6" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
