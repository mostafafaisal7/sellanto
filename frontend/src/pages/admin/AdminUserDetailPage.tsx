import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  KeyIcon,
  DocumentTextIcon,
  LinkIcon,
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  ChatBubbleBottomCenterTextIcon,
  Cog6ToothIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { useAdminStore } from '../../store';
import { DiamondRechargeForm } from '../../components/admin/DiamondRechargeForm';
import { PromptOverrideEditor } from '../../components/admin/PromptOverrideEditor';
import { PromptAuditTimeline } from '../../components/admin/PromptAuditTimeline';
import { adminPromptService } from '../../services';
import type { PromptDescriptor, PromptType, ExecutionRecord } from '../../services/adminPromptService';

type TabType =
  | 'overview'
  | 'posts'
  | 'accounts'
  | 'captions'
  | 'images'
  | 'videos'
  | 'messenger'
  | 'api'
  | 'prompts';

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || '0');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tabData, setTabData] = useState<Record<string, unknown> | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  // API Settings form
  const [adminManaged, setAdminManaged] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [planForm, setPlanForm] = useState({ plan: 'free', max_posts: 30, max_accounts: 3 });
  const [savingAPI, setSavingAPI] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Magic Prompts tab state
  const [prompts, setPrompts] = useState<PromptDescriptor[] | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [auditPrompt, setAuditPrompt] = useState<{ type: PromptType; name: string } | null>(null);

  // Execution history state
  const [execHistory, setExecHistory] = useState<ExecutionRecord[] | null>(null);
  const [execHistoryTotal, setExecHistoryTotal] = useState(0);
  const [execHistoryPage, setExecHistoryPage] = useState(1);
  const [execHistoryLoading, setExecHistoryLoading] = useState(false);
  const [execHistoryFilter, setExecHistoryFilter] = useState<string>('');
  const [expandedExec, setExpandedExec] = useState<number | null>(null);

  const {
    userDetail, userDetailLoading, fetchUserDetail,
    approveUser, rejectUser, updatePlan,
    apiSettings, apiSettingsLoading, fetchAPISettings, updateAPISettings,
    fetchUserPosts, fetchUserAccounts, fetchUserCaptions, fetchUserImages, fetchUserVideos, fetchUserMessenger,
    startImpersonation,
  } = useAdminStore();

  useEffect(() => {
    if (userId) {
      fetchUserDetail(userId);
      fetchAPISettings(userId);
    }
  }, [userId, fetchUserDetail, fetchAPISettings]);

  useEffect(() => {
    if (apiSettings) {
      setAdminManaged(apiSettings.admin_managed);
    }
  }, [apiSettings]);

  useEffect(() => {
    if (userDetail?.profile) {
      const p = userDetail.profile as Record<string, unknown>;
      setPlanForm({
        plan: (p.subscription_plan as string) || 'free',
        max_posts: (p.max_posts_per_month as number) || 30,
        max_accounts: (p.max_social_accounts as number) || 3,
      });
    }
  }, [userDetail]);

  const loadTabData = async (tab: TabType) => {
    if (tab === 'overview' || tab === 'api') return;
    setTabLoading(true);
    try {
      const fetchers: Record<string, (id: number) => Promise<unknown>> = {
        posts: fetchUserPosts,
        accounts: fetchUserAccounts,
        captions: fetchUserCaptions,
        images: fetchUserImages,
        videos: fetchUserVideos,
        messenger: fetchUserMessenger,
      };
      const data = await fetchers[tab](userId);
      setTabData(data as Record<string, unknown>);
    } catch {
      setTabData(null);
    }
    setTabLoading(false);
  };

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, userId]);

  useEffect(() => {
    if (activeTab !== 'prompts' || !userId) return;
    let cancelled = false;
    setPromptsLoading(true);
    setPromptsError(null);
    adminPromptService
      .list(userId)
      .then((res) => {
        if (!cancelled) setPrompts(res.prompts);
      })
      .catch((err) => {
        if (!cancelled)
          setPromptsError(err instanceof Error ? err.message : 'Failed to load prompts');
      })
      .finally(() => {
        if (!cancelled) setPromptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, userId]);

  useEffect(() => {
    if (activeTab !== 'prompts' || !userId) return;
    let cancelled = false;
    setExecHistoryLoading(true);
    adminPromptService
      .executionHistory(userId, {
        prompt_type: execHistoryFilter ? (execHistoryFilter as PromptType) : undefined,
        page: execHistoryPage,
        page_size: 20,
      })
      .then((res) => {
        if (!cancelled) {
          setExecHistory(res.executions);
          setExecHistoryTotal(res.total);
        }
      })
      .catch(() => { if (!cancelled) setExecHistory([]); })
      .finally(() => { if (!cancelled) setExecHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, userId, execHistoryPage, execHistoryFilter]);

  const handleApprove = async () => {
    await approveUser(userId);
    fetchUserDetail(userId);
  };

  const handleReject = async () => {
    await rejectUser(userId);
    fetchUserDetail(userId);
  };

  const handleSavePlan = async () => {
    setSavingPlan(true);
    await updatePlan(userId, planForm.plan, planForm.max_posts, planForm.max_accounts);
    fetchUserDetail(userId);
    setSavingPlan(false);
  };

  const handleSaveAPI = async () => {
    setSavingAPI(true);
    await updateAPISettings(userId, {
      admin_managed: adminManaged,
      openai_key: openaiKey,
      gemini_key: geminiKey,
    });
    fetchAPISettings(userId);
    setOpenaiKey('');
    setGeminiKey('');
    setSavingAPI(false);
  };

  const handleImpersonate = () => {
    if (!userDetail) return;
    startImpersonation(userDetail.user.id, {
      id: userDetail.user.id,
      username: userDetail.user.username,
      email: userDetail.user.email,
    });
    window.location.href = '/dashboard';
  };

  if (userDetailLoading && !userDetail) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!userDetail) return null;
  const { user, profile, stats, tokens } = userDetail;
  const isApproved = (profile as Record<string, unknown>).is_approved;

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: Cog6ToothIcon },
    { id: 'posts', label: 'Posts', icon: DocumentTextIcon },
    { id: 'accounts', label: 'Accounts', icon: LinkIcon },
    { id: 'captions', label: 'Captions', icon: SparklesIcon },
    { id: 'images', label: 'Images', icon: PhotoIcon },
    { id: 'videos', label: 'Videos', icon: VideoCameraIcon },
    { id: 'messenger', label: 'Messenger', icon: ChatBubbleBottomCenterTextIcon },
    { id: 'api', label: 'API Settings', icon: KeyIcon },
    { id: 'prompts', label: 'Magic Prompts', icon: CommandLineIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link to="/admin-panel/users" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Users
      </Link>

      {/* User Header */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-xl">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{user.username}</h1>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                  isApproved ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {isApproved ? 'Approved' : 'Pending'}
                </span>
              </div>
              <p className="text-sm text-slate-400">{user.email}</p>
              <p className="text-xs text-slate-500 mt-0.5">Joined {new Date(user.date_joined).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isApproved ? (
              <button onClick={handleApprove} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5">
                <CheckCircleIcon className="w-4 h-4" /> Approve
              </button>
            ) : (
              <button onClick={handleReject} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5">
                <XCircleIcon className="w-4 h-4" /> Reject
              </button>
            )}
            <button onClick={handleImpersonate} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5">
              <UserGroupIcon className="w-4 h-4" /> Impersonate
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
      >
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Posts', value: stats.posts },
                { label: 'Accounts', value: stats.accounts },
                { label: 'Captions', value: stats.captions },
                { label: 'Images', value: stats.images },
                { label: 'Videos', value: stats.videos },
                { label: 'Conversations', value: stats.conversations },
                { label: 'Messages', value: stats.messages },
                { label: 'Total Tokens', value: tokens.total.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Plan Management */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Plan Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Plan</label>
                  <select
                    value={planForm.plan}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, plan: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-700 text-white text-sm rounded-xl border border-white/10 focus:outline-none focus:border-amber-500/30"
                  >
                    <option value="free" className="bg-dark-800 text-white">Free</option>
                    <option value="starter" className="bg-dark-800 text-white">Starter</option>
                    <option value="pro" className="bg-dark-800 text-white">Pro</option>
                    <option value="business" className="bg-dark-800 text-white">Business</option>
                    <option value="enterprise" className="bg-dark-800 text-white">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Max Posts/Month</label>
                  <input
                    type="number"
                    value={planForm.max_posts}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, max_posts: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 text-white text-sm rounded-xl border border-white/10 focus:outline-none focus:border-amber-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Max Accounts</label>
                  <input
                    type="number"
                    value={planForm.max_accounts}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, max_accounts: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 text-white text-sm rounded-xl border border-white/10 focus:outline-none focus:border-amber-500/30"
                  />
                </div>
              </div>
              <button
                onClick={handleSavePlan}
                disabled={savingPlan}
                className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {savingPlan ? 'Saving...' : 'Update Plan'}
              </button>
            </div>

            {/* Diamond Recharge */}
            <DiamondRechargeForm
              userId={userId}
              username={userDetail?.user?.username || 'User'}
              onRecharged={() => fetchUserDetail(userId)}
            />

            {/* Token Usage */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Token Usage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-lg font-bold text-white">{tokens.caption.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Caption Tokens</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-lg font-bold text-white">{tokens.messenger.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Messenger Tokens</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-lg font-bold text-white">{tokens.total.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Total Tokens</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-lg font-bold text-emerald-400">${tokens.cost}</p>
                  <p className="text-xs text-slate-400">Estimated Cost</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="p-6 space-y-6">
            <h3 className="text-sm font-semibold text-white">API Key Management</h3>

            {apiSettingsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : apiSettings && (
              <>
                {/* Current Keys Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Caption (OpenAI)', data: apiSettings.caption },
                    { label: 'Image (Gemini)', data: apiSettings.image },
                    { label: 'Video (Gemini)', data: apiSettings.video },
                    { label: 'Messenger', data: apiSettings.messenger },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                      <p className="text-sm text-white font-mono">
                        {item.data?.has_key ? (item.data.key_preview || 'Key set') : <span className="text-slate-500">No key</span>}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Admin Mode Toggle */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminManaged}
                      onChange={(e) => setAdminManaged(e.target.checked)}
                      className="rounded border-slate-600 text-amber-500 focus:ring-amber-500/20"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">Admin Managed Mode</p>
                      <p className="text-xs text-slate-400">When enabled, admin provides API keys and user cannot change them</p>
                    </div>
                  </label>
                </div>

                {/* Admin Keys */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">OpenAI API Key</label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder={apiSettings.admin_openai ? 'Key already set (enter new to update)' : 'Enter OpenAI API key...'}
                      className="w-full px-3 py-2 bg-white/5 text-white text-sm rounded-xl border border-white/10 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Gemini API Key</label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={apiSettings.admin_gemini ? 'Key already set (enter new to update)' : 'Enter Gemini API key...'}
                      className="w-full px-3 py-2 bg-white/5 text-white text-sm rounded-xl border border-white/10 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveAPI}
                  disabled={savingAPI}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {savingAPI ? 'Saving...' : 'Save API Settings'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Magic Prompts Tab */}
        {activeTab === 'prompts' && (
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Magic Mode prompt overrides</h3>
              <p className="text-xs text-slate-400 mt-1">
                Edit the prompts powering Magic Mode for this user. Each override is
                logged. Leave a card untouched to keep the system default. If a runtime
                error occurs (missing variable, malformed template), the resolver falls
                back to the default automatically.
              </p>
            </div>

            {promptsLoading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              </div>
            )}

            {promptsError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {promptsError}
              </div>
            )}

            {prompts && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {prompts.map((p) => (
                  <PromptOverrideEditor
                    key={p.type}
                    userId={userId}
                    prompt={p}
                    onSaved={(updated) =>
                      setPrompts((prev) =>
                        prev
                          ? prev.map((x) => (x.type === updated.type ? updated : x))
                          : prev,
                      )
                    }
                    onOpenAudit={(promptType) => {
                      const found = prompts.find((x) => x.type === promptType);
                      setAuditPrompt({
                        type: promptType,
                        name: found?.display_name || promptType,
                      });
                    }}
                  />
                ))}
              </div>
            )}

            <PromptAuditTimeline
              open={auditPrompt !== null}
              userId={userId}
              promptType={auditPrompt?.type ?? null}
              promptDisplayName={auditPrompt?.name ?? ''}
              onClose={() => setAuditPrompt(null)}
            />

            {/* ── Execution history ── */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-white">Execution history</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Every AI call made for this user — prompt sent + response received.
                    {execHistoryTotal > 0 && ` (${execHistoryTotal} total)`}
                  </p>
                </div>
                <select
                  value={execHistoryFilter}
                  onChange={(e) => { setExecHistoryFilter(e.target.value); setExecHistoryPage(1); }}
                  className="px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08] text-text-primary rounded-lg focus:outline-none"
                >
                  <option value="">All prompt types</option>
                  {[
                    ['idea_system', 'Ideas — System'], ['idea_user', 'Ideas — User'],
                    ['idea_regenerate', 'Ideas — Regenerate'],
                    ['caption_system', 'Caption — System'], ['caption_user', 'Caption — User'],
                    ['caption_regenerate', 'Caption — Regenerate'], ['caption_adapt', 'Caption — Adapt'],
                    ['image_refiner', 'Image — Refiner'], ['image_product_bg', 'Image — Product BG'],
                    ['image_product_smart', 'Image — Smart BG'], ['video_prompt', 'Video — Prompt'],
                    ['brand_dna', 'Brand DNA — Reg'], ['brand_dna_website', 'Brand DNA — Website'],
                    ['brand_dna_manual', 'Brand DNA — Manual'],
                    ['trending_filter', 'Trending — Filter'],
                    ['competitor_analyze', 'Competitor — Analyze'], ['competitor_suggest', 'Competitor — Suggest'],
                    ['pillars_generate', 'Pillars — Generate'], ['support_chat', 'Support — Chat'],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {execHistoryLoading && (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
              )}

              {!execHistoryLoading && execHistory !== null && execHistory.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-6">No executions recorded yet.</p>
              )}

              {!execHistoryLoading && execHistory && execHistory.length > 0 && (
                <div className="space-y-2">
                  {execHistory.map((ex) => (
                    <div
                      key={ex.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedExec(expandedExec === ex.id ? null : ex.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ex.success ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-[11px] font-mono text-text-muted w-32 flex-shrink-0 truncate">
                          {ex.prompt_type}
                        </span>
                        {ex.was_override && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-coral/15 text-coral border border-coral/20 flex-shrink-0">
                            Custom
                          </span>
                        )}
                        <span className="text-[11px] text-text-muted flex-shrink-0 ml-auto">
                          {ex.model_used || '—'}
                        </span>
                        <span className="text-[11px] text-text-muted flex-shrink-0 w-16 text-right">
                          {ex.tokens_in > 0 ? `${ex.tokens_in.toLocaleString()} tk` : '—'}
                        </span>
                        <span className="text-[11px] text-text-muted flex-shrink-0 w-36 text-right">
                          {new Date(ex.created_at).toLocaleString()}
                        </span>
                      </button>

                      {expandedExec === ex.id && (
                        <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
                          {ex.brand_name && (
                            <div className="text-[10px] text-text-muted">
                              Brand: <span className="text-text-secondary">{ex.brand_name}</span>
                            </div>
                          )}
                          {ex.error_message && (
                            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                              {ex.error_message}
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                              Prompt sent
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-secondary bg-bg-primary/60 border border-white/[0.06] rounded-lg p-3 max-h-48 overflow-y-auto">
                              {ex.prompt_sent}
                            </pre>
                          </div>
                          {ex.response_received && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                                AI response
                              </div>
                              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-secondary bg-bg-primary/60 border border-white/[0.06] rounded-lg p-3 max-h-48 overflow-y-auto">
                                {ex.response_received}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {execHistoryTotal > 20 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    disabled={execHistoryPage === 1}
                    onClick={() => setExecHistoryPage((p) => p - 1)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-text-secondary hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-text-muted">
                    Page {execHistoryPage} of {Math.ceil(execHistoryTotal / 20)}
                  </span>
                  <button
                    type="button"
                    disabled={execHistoryPage >= Math.ceil(execHistoryTotal / 20)}
                    onClick={() => setExecHistoryPage((p) => p + 1)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-text-secondary hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Tabs (posts, accounts, captions, images, videos, messenger) */}
        {['posts', 'accounts', 'captions', 'images', 'videos', 'messenger'].includes(activeTab) && (
          <div className="p-6">
            {tabLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : tabData ? (
              <DataTable tab={activeTab} data={tabData} />
            ) : (
              <p className="text-center text-sm text-slate-500 py-8">No data available</p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function DataTable({ tab, data }: { tab: string; data: Record<string, unknown> }) {
  if (tab === 'posts') {
    const posts = (data as { posts: Array<Record<string, unknown>> }).posts || [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-400 mb-3">{posts.length} posts</p>
        {posts.length === 0 ? <p className="text-sm text-slate-500">No posts</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Caption</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Status</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Platforms</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {posts.map((p) => (
                  <tr key={p.id as number}>
                    <td className="px-3 py-2 text-sm text-white max-w-[300px] truncate">{(p.caption as string) || '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={p.status as string} /></td>
                    <td className="px-3 py-2 text-xs text-slate-400">{p.platforms as string}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{p.created_at ? new Date(p.created_at as string).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'accounts') {
    const accounts = (data as { accounts: Array<Record<string, unknown>> }).accounts || [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-400 mb-3">{accounts.length} accounts</p>
        {accounts.map((a) => (
          <div key={a.id as number} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <p className="text-sm font-medium text-white capitalize">{a.platform as string}</p>
              <p className="text-xs text-slate-400">{a.account_name as string}</p>
            </div>
            <StatusBadge status={a.is_active ? 'active' : 'inactive'} />
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'captions') {
    const captions = (data as { captions: Array<Record<string, unknown>>; stats: Record<string, unknown> }).captions || [];
    const captionStats = (data as { stats: Record<string, number> }).stats;
    return (
      <div className="space-y-3">
        {captionStats && (
          <div className="flex gap-4 mb-4">
            <span className="text-xs text-slate-400">Total: {captionStats.total}</span>
            <span className="text-xs text-slate-400">Tokens: {captionStats.tokens?.toLocaleString()}</span>
            <span className="text-xs text-slate-400">Cost: ${captionStats.cost}</span>
          </div>
        )}
        {captions.slice(0, 20).map((c) => (
          <div key={c.id as number} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-400">{c.platform as string}</span>
              <span className="text-xs text-slate-500">{c.tokens_used as number} tokens</span>
            </div>
            <p className="text-sm text-white truncate">{(c.generated_caption as string)?.slice(0, 100) || '—'}</p>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'images') {
    const images = (data as { images: Array<Record<string, unknown>> }).images || [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-400 mb-3">{images.length} images</p>
        {images.slice(0, 20).map((img) => (
          <div key={img.id as number} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-sm font-medium text-white">{img.title as string}</p>
            <p className="text-xs text-slate-400 mt-0.5">{img.style as string} - {img.size as string}</p>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'videos') {
    const videos = (data as { videos: Array<Record<string, unknown>> }).videos || [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-400 mb-3">{videos.length} videos</p>
        {videos.slice(0, 20).map((v) => (
          <div key={v.id as number} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-sm font-medium text-white">{v.title as string}</p>
            <p className="text-xs text-slate-400 mt-0.5">{v.style as string} - {v.duration as number}s</p>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'messenger') {
    const connections = (data as { connections: Array<Record<string, unknown>> }).connections || [];
    const conversations = (data as { conversations: Array<Record<string, unknown>> }).conversations || [];
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Connections ({connections.length})</h4>
          {connections.map((c) => (
            <div key={c.id as number} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-2">
              <p className="text-sm font-medium text-white">{c.page_name as string}</p>
              <p className="text-xs text-slate-400">{c.is_active ? 'Active' : 'Inactive'}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Conversations ({conversations.length})</h4>
          {conversations.slice(0, 15).map((cv) => (
            <div key={cv.id as number} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-2 flex justify-between">
              <div>
                <p className="text-sm font-medium text-white">{cv.sender_name as string || 'Unknown'}</p>
                <p className="text-xs text-slate-400">{cv.message_count as number} messages</p>
              </div>
              <p className="text-xs text-slate-500">{(cv.total_tokens as number)?.toLocaleString()} tokens</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <p className="text-sm text-slate-500">No data</p>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    posted: 'bg-green-500/10 text-green-400',
    active: 'bg-green-500/10 text-green-400',
    completed: 'bg-green-500/10 text-green-400',
    scheduled: 'bg-blue-500/10 text-blue-400',
    pending: 'bg-amber-500/10 text-amber-400',
    draft: 'bg-slate-500/10 text-slate-400',
    failed: 'bg-red-500/10 text-red-400',
    inactive: 'bg-slate-500/10 text-slate-400',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${colors[status] || 'bg-slate-500/10 text-slate-400'}`}>
      {status}
    </span>
  );
}

export default AdminUserDetailPage;
