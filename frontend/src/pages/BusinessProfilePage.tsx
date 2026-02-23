import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BuildingOfficeIcon,
  SparklesIcon,
  PlusIcon,
  GlobeAltIcon,
  ClockIcon,
  LanguageIcon,
  UserGroupIcon,
  BeakerIcon,
  RocketLaunchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import onboardingService from '../services/onboardingService';
import { platformService } from '../services/platformService';
import type { Workspace, Brand, LaunchPlan, SocialAccount } from '../types';

export function BusinessProfilePage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [launchPlans, setLaunchPlans] = useState<Record<number, LaunchPlan>>({});
  const [loading, setLoading] = useState(true);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [collapsedBrand, setCollapsedBrand] = useState<number | null>(null);

  // Workspace form
  const [wsName, setWsName] = useState('');
  const [wsTz, setWsTz] = useState('UTC');
  const [wsLang, setWsLang] = useState('en');
  const [wsTeamSize, setWsTeamSize] = useState<number | ''>('');
  const [wsSubmitting, setWsSubmitting] = useState(false);

  // Brand form
  const [brandForm, setBrandForm] = useState({
    brand_name: '',
    industry: '',
    target_region: '',
    website_url: '',
    voice_tone: 'professional',
  });
  const [brandGoals, setBrandGoals] = useState<string[]>([]);
  const [brandAudiences, setBrandAudiences] = useState<string[]>([]);
  const [newAudience, setNewAudience] = useState('');
  const [brandSubmitting, setBrandSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ws, br, accounts] = await Promise.all([
        onboardingService.getWorkspaces(),
        onboardingService.getBrands(),
        platformService.list().catch(() => [] as SocialAccount[]),
      ]);
      setWorkspaces(ws);
      setBrands(br);
      setConnectedAccounts(accounts);

      const plans: Record<number, LaunchPlan> = {};
      for (const brand of br) {
        try {
          const plan = await onboardingService.getLaunchPlan(brand.id);
          plans[brand.id] = plan;
        } catch { /* no plan yet */ }
      }
      setLaunchPlans(plans);
    } catch { /* ok */ }
    setLoading(false);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setWsSubmitting(true);
    try {
      await onboardingService.createWorkspace({
        name: wsName,
        timezone: wsTz,
        default_language: wsLang,
        ...(wsTeamSize ? { team_size: Number(wsTeamSize) } : {}),
      });
      setWsName('');
      setWsTz('UTC');
      setWsLang('en');
      setWsTeamSize('');
      setShowWorkspaceForm(false);
      loadData();
    } catch {
      alert('Failed to create workspace');
    } finally {
      setWsSubmitting(false);
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaces.length === 0) {
      alert('Create a workspace first');
      return;
    }
    setBrandSubmitting(true);
    try {
      await onboardingService.createBrand({
        ...brandForm,
        workspace: workspaces[0].id,
        goals: brandGoals,
        audiences: brandAudiences,
      } as unknown as Partial<Brand>);
      setBrandForm({ brand_name: '', industry: '', target_region: '', website_url: '', voice_tone: 'professional' });
      setBrandGoals([]);
      setBrandAudiences([]);
      setShowBrandForm(false);
      loadData();
    } catch {
      alert('Failed to create brand');
    } finally {
      setBrandSubmitting(false);
    }
  };

  const addAudience = () => {
    if (newAudience.trim() && brandAudiences.length < 5) {
      setBrandAudiences([...brandAudiences, newAudience.trim()]);
      setNewAudience('');
    }
  };

  const goalOptions = [
    { value: 'leads', label: 'Lead Generation' },
    { value: 'growth', label: 'Audience Growth' },
    { value: 'authority', label: 'Thought Leadership' },
    { value: 'sales', label: 'Direct Sales' },
    { value: 'awareness', label: 'Brand Awareness' },
    { value: 'community', label: 'Community Building' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const platformColors: Record<string, string> = {
    facebook: '#1877F2', instagram: '#E4405F', twitter: '#1DA1F2',
    linkedin: '#0A66C2', telegram: '#0088CC', tiktok: '#000000',
    youtube: '#FF0000', pinterest: '#BD081C',
  };

  const needsSetup = workspaces.length === 0 || brands.length === 0;

  // ============================================================
  // SETUP WIZARD (shown when workspace or brand is missing)
  // ============================================================
  if (needsSetup) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Complete Your Business Profile</h1>
          <p className="text-text-secondary mt-1">Set up your workspace and brand to get started</p>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${workspaces.length > 0 ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-primary/10 border-primary/20 text-primary'}`}>
            <BuildingOfficeIcon className="w-5 h-5" />
            <span className="text-sm font-medium">1. Workspace</span>
            {workspaces.length > 0 && <span className="text-xs">Done</span>}
          </div>
          <div className="h-px flex-1 bg-white/10" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${brands.length > 0 ? 'bg-green-500/10 border-green-500/20 text-green-400' : workspaces.length > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-dark-600 border-white/5 text-text-muted'}`}>
            <SparklesIcon className="w-5 h-5" />
            <span className="text-sm font-medium">2. Brand</span>
            {brands.length > 0 && <span className="text-xs">Done</span>}
          </div>
        </div>

        {/* Step 1: Create Workspace */}
        {workspaces.length === 0 ? (
          <div className="card p-6 space-y-5 border-2 border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <BuildingOfficeIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Create Your Workspace</h2>
                <p className="text-sm text-text-secondary">A workspace organizes your brands and content</p>
              </div>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Workspace Name *</label>
                <input type="text" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="e.g., My Agency, Marketing Team" className="input w-full" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Timezone</label>
                  <select value={wsTz} onChange={(e) => setWsTz(e.target.value)} className="input w-full">
                    <option value="UTC">UTC</option>
                    <option value="US/Eastern">US Eastern</option>
                    <option value="US/Pacific">US Pacific</option>
                    <option value="Europe/London">London</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Dhaka">Bangladesh (BST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Language</label>
                  <select value={wsLang} onChange={(e) => setWsLang(e.target.value)} className="input w-full">
                    <option value="en">English</option>
                    <option value="bn">Bengali</option>
                    <option value="es">Spanish</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Team Size</label>
                  <input type="number" min={1} max={1000} value={wsTeamSize} onChange={(e) => setWsTeamSize(e.target.value ? Number(e.target.value) : '')} placeholder="Optional" className="input w-full" />
                </div>
              </div>
              <button type="submit" disabled={!wsName.trim() || wsSubmitting} className="btn-primary w-full py-3">
                {wsSubmitting ? 'Creating...' : 'Create Workspace'}
              </button>
            </form>
          </div>
        ) : (
          /* Workspace exists, show summary */
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <BuildingOfficeIcon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">{workspaces[0].name}</h3>
                  <p className="text-xs text-text-muted">{workspaces[0].timezone} | {workspaces[0].default_language.toUpperCase()}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Active</span>
            </div>
          </div>
        )}

        {/* Step 2: Create Brand (only show after workspace exists) */}
        {workspaces.length > 0 && brands.length === 0 && (
          <div className="card p-6 space-y-5 border-2 border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Create Your Brand</h2>
                <p className="text-sm text-text-secondary">Define your brand identity for AI-powered content</p>
              </div>
            </div>

            <form onSubmit={handleCreateBrand} className="space-y-5">
              {/* Basic Info */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Basic Info</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Brand Name *</label>
                  <input type="text" value={brandForm.brand_name} onChange={(e) => setBrandForm({ ...brandForm, brand_name: e.target.value })} placeholder="Your brand name" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Industry *</label>
                  <input type="text" value={brandForm.industry} onChange={(e) => setBrandForm({ ...brandForm, industry: e.target.value })} placeholder="e.g., Technology, Fashion" className="input w-full" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Target Region *</label>
                  <input type="text" value={brandForm.target_region} onChange={(e) => setBrandForm({ ...brandForm, target_region: e.target.value })} placeholder="e.g., Global, South Asia" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Website URL</label>
                  <input type="url" value={brandForm.website_url} onChange={(e) => setBrandForm({ ...brandForm, website_url: e.target.value })} placeholder="https://yourbrand.com" className="input w-full" />
                </div>
              </div>

              {/* Voice & Tone */}
              <div className="border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Voice & Tone</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Brand Voice</label>
                <select value={brandForm.voice_tone} onChange={(e) => setBrandForm({ ...brandForm, voice_tone: e.target.value })} className="input w-full">
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="friendly">Friendly</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="humorous">Humorous</option>
                  <option value="inspirational">Inspirational</option>
                </select>
              </div>

              {/* Goals */}
              <div className="border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Goals</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {goalOptions.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setBrandGoals(brandGoals.includes(g.value) ? brandGoals.filter((x) => x !== g.value) : [...brandGoals, g.value])}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all ${brandGoals.includes(g.value) ? 'bg-primary/20 border-primary text-primary' : 'border-white/10 text-text-secondary hover:border-white/20'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Audiences */}
              <div className="border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Target Audiences</h3>
              </div>
              <div>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={newAudience} onChange={(e) => setNewAudience(e.target.value)} placeholder="e.g., Small business owners aged 25-45" className="input flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAudience(); } }}
                    disabled={brandAudiences.length >= 5}
                  />
                  <button type="button" onClick={addAudience} disabled={brandAudiences.length >= 5 || !newAudience.trim()} className="btn-secondary px-4">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
                {brandAudiences.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {brandAudiences.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
                        {a}
                        <button type="button" onClick={() => setBrandAudiences(brandAudiences.filter((_, j) => j !== i))} className="hover:text-red-400 transition-colors text-xs">x</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={!brandForm.brand_name || !brandForm.industry || !brandForm.target_region || brandSubmitting} className="btn-primary w-full py-3">
                {brandSubmitting ? 'Creating Brand...' : 'Create Brand'}
              </button>
            </form>
          </div>
        )}

        {/* Redirect to onboarding option */}
        <div className="text-center">
          <p className="text-text-muted text-sm mb-2">Or complete the full guided setup</p>
          <button onClick={() => navigate('/onboarding')} className="btn-secondary px-6">
            <ArrowPathIcon className="w-4 h-4 inline mr-2" />
            Go to Full Setup Wizard
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // FULL PROFILE VIEW (shown when workspace + brand exist)
  // ============================================================
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Business Profile</h1>
        <p className="text-text-secondary mt-1">Manage your workspaces, brands, and launch plans</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-primary">{workspaces.length}</p>
          <p className="text-sm text-text-muted mt-1">Workspaces</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-secondary">{brands.length}</p>
          <p className="text-sm text-text-muted mt-1">Brands</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{connectedAccounts.length}</p>
          <p className="text-sm text-text-muted mt-1">Connected Platforms</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-info">{Object.keys(launchPlans).length}</p>
          <p className="text-sm text-text-muted mt-1">Launch Plans</p>
        </div>
      </div>

      {/* Connected Platforms */}
      {connectedAccounts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <GlobeAltIcon className="w-5 h-5 text-green-400" /> Connected Platforms
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {connectedAccounts.map((acc) => (
              <div key={acc.id} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: platformColors[acc.platform] || '#666' }}>
                  {acc.platform[0].toUpperCase()}{acc.platform[1]?.toUpperCase() || ''}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{acc.account_name}</p>
                  <p className="text-xs text-text-muted capitalize">{acc.platform}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Workspaces */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-primary" /> Workspaces
          </h2>
          <button onClick={() => setShowWorkspaceForm(!showWorkspaceForm)} className="btn-secondary flex items-center gap-2 text-sm">
            <PlusIcon className="w-4 h-4" /> New Workspace
          </button>
        </div>

        {showWorkspaceForm && (
          <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleCreateWorkspace} className="card p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Workspace name" className="input" required />
              <select value={wsTz} onChange={(e) => setWsTz(e.target.value)} className="input">
                <option value="UTC">UTC</option>
                <option value="Asia/Kolkata">IST</option>
                <option value="Asia/Dhaka">BST</option>
                <option value="US/Eastern">US Eastern</option>
                <option value="US/Pacific">US Pacific</option>
                <option value="Europe/London">London</option>
              </select>
              <select value={wsLang} onChange={(e) => setWsLang(e.target.value)} className="input">
                <option value="en">English</option>
                <option value="bn">Bengali</option>
                <option value="es">Spanish</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary px-6">Create</button>
              <button type="button" onClick={() => setShowWorkspaceForm(false)} className="btn-secondary px-4">Cancel</button>
            </div>
          </motion.form>
        )}

        <div className="grid gap-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-text-primary text-lg">{ws.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ws.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {ws.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-right text-xs text-text-muted">
                  Created {new Date(ws.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-text-muted" />
                  <div>
                    <p className="text-xs text-text-muted">Timezone</p>
                    <p className="text-sm text-text-primary">{ws.timezone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LanguageIcon className="w-4 h-4 text-text-muted" />
                  <div>
                    <p className="text-xs text-text-muted">Language</p>
                    <p className="text-sm text-text-primary uppercase">{ws.default_language}</p>
                  </div>
                </div>
                {ws.team_size && (
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="w-4 h-4 text-text-muted" />
                    <div>
                      <p className="text-xs text-text-muted">Team Size</p>
                      <p className="text-sm text-text-primary">{ws.team_size}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-text-muted" />
                  <div>
                    <p className="text-xs text-text-muted">Generations Today</p>
                    <p className="text-sm text-text-primary">{ws.generations_today} / {ws.max_generations_per_day}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brands */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" /> Brands
          </h2>
          <button onClick={() => setShowBrandForm(!showBrandForm)} className="btn-secondary flex items-center gap-2 text-sm">
            <PlusIcon className="w-4 h-4" /> New Brand
          </button>
        </div>

        {showBrandForm && (
          <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleCreateBrand} className="card p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" value={brandForm.brand_name} onChange={(e) => setBrandForm({ ...brandForm, brand_name: e.target.value })} placeholder="Brand name" className="input" required />
              <input type="text" value={brandForm.industry} onChange={(e) => setBrandForm({ ...brandForm, industry: e.target.value })} placeholder="Industry" className="input" required />
              <input type="text" value={brandForm.target_region} onChange={(e) => setBrandForm({ ...brandForm, target_region: e.target.value })} placeholder="Target region" className="input" required />
              <input type="url" value={brandForm.website_url} onChange={(e) => setBrandForm({ ...brandForm, website_url: e.target.value })} placeholder="Website URL" className="input" />
            </div>
            <select value={brandForm.voice_tone} onChange={(e) => setBrandForm({ ...brandForm, voice_tone: e.target.value })} className="input w-full md:w-48">
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
              <option value="enthusiastic">Enthusiastic</option>
              <option value="humorous">Humorous</option>
              <option value="inspirational">Inspirational</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary px-6">Create Brand</button>
              <button type="button" onClick={() => setShowBrandForm(false)} className="btn-secondary px-4">Cancel</button>
            </div>
          </motion.form>
        )}

        <div className="grid gap-4">
          {brands.map((brand) => {
            const isExpanded = collapsedBrand !== brand.id;
            const plan = launchPlans[brand.id];

            return (
              <div key={brand.id} className="card overflow-hidden">
                {/* Brand header */}
                <div className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setCollapsedBrand(isExpanded ? brand.id : null)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-text-primary text-lg">{brand.brand_name}</h3>
                        {brand.is_primary && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Primary</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-dark-500 text-text-muted capitalize">{brand.voice_tone}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                        <span className="flex items-center gap-1"><SparklesIcon className="w-3.5 h-3.5" /> {brand.industry}</span>
                        <span className="flex items-center gap-1"><GlobeAltIcon className="w-3.5 h-3.5" /> {brand.target_region}</span>
                        {brand.website_url && (
                          <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            {brand.website_url.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </div>
                    <button className="text-text-muted p-1">
                      {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t border-white/5">
                    <div className="p-5 space-y-5">
                      {/* Goals */}
                      {brand.goals && brand.goals.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Goals</h4>
                          <div className="flex flex-wrap gap-2">
                            {brand.goals.map((g) => (
                              <span key={g} className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary capitalize">{g}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Audiences */}
                      {brand.audiences && brand.audiences.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Target Audiences</h4>
                          <div className="flex flex-wrap gap-2">
                            {brand.audiences.map((a, i) => (
                              <span key={i} className="px-3 py-1 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Do/Don't Rules */}
                      {brand.do_dont_rules && (Object.keys(brand.do_dont_rules).length > 0) && (
                        <div>
                          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Do / Don't Rules</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(brand.do_dont_rules as Record<string, string[]>).do && (brand.do_dont_rules as Record<string, string[]>).do.length > 0 && (
                              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                                <p className="text-xs font-semibold text-green-400 mb-2">DO</p>
                                <ul className="space-y-1">
                                  {(brand.do_dont_rules as Record<string, string[]>).do.map((rule: string, i: number) => (
                                    <li key={i} className="text-sm text-text-secondary">+ {rule}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(brand.do_dont_rules as Record<string, string[]>).dont && (brand.do_dont_rules as Record<string, string[]>).dont.length > 0 && (
                              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                <p className="text-xs font-semibold text-red-400 mb-2">DON'T</p>
                                <ul className="space-y-1">
                                  {(brand.do_dont_rules as Record<string, string[]>).dont.map((rule: string, i: number) => (
                                    <li key={i} className="text-sm text-text-secondary">- {rule}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Brand DNA */}
                      <div>
                        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                          <BeakerIcon className="w-4 h-4" /> Brand DNA
                        </h4>
                        {brand.brand_dna && Object.keys(brand.brand_dna).length > 0 ? (
                          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                            <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                              <span className="w-2 h-2 rounded-full bg-green-400" /> Generated
                              {brand.brand_dna_generated_at && <span className="text-text-muted ml-1">on {new Date(brand.brand_dna_generated_at).toLocaleDateString()}</span>}
                            </div>
                            <p className="text-xs text-text-muted">Source: {brand.brand_dna_source || 'onboarding'}</p>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                            <p className="text-sm text-yellow-400">Not generated yet</p>
                          </div>
                        )}
                      </div>

                      {/* Launch Plan */}
                      <div>
                        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                          <RocketLaunchIcon className="w-4 h-4" /> Launch Plan
                        </h4>
                        {plan ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="p-3 rounded-lg border border-white/5 bg-dark-700/50">
                              <p className="text-xs text-text-muted">Posts per Week</p>
                              <p className="text-xl font-bold text-primary">{plan.post_frequency}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-white/5 bg-dark-700/50">
                              <p className="text-xs text-text-muted">Approval Required</p>
                              <p className="text-sm font-semibold text-text-primary">{plan.approval_required ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-white/5 bg-dark-700/50 md:col-span-1 col-span-2">
                              <p className="text-xs text-text-muted mb-1">Formats</p>
                              <div className="flex flex-wrap gap-1">
                                {plan.formats_allowed.map((f) => (
                                  <span key={f} className="px-2 py-0.5 rounded bg-dark-500 text-xs text-text-secondary capitalize">{f}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-dark-700/50 border border-white/5">
                            <p className="text-sm text-text-muted">No launch plan configured yet.</p>
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-text-muted">
                        <span>Created {new Date(brand.created_at).toLocaleDateString()}</span>
                        <span>Last updated {new Date(brand.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default BusinessProfilePage;
