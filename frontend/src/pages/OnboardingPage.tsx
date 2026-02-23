import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingOfficeIcon,
  SparklesIcon,
  LinkIcon,
  CpuChipIcon,
  BeakerIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import onboardingService from '../services/onboardingService';
import { platformService } from '../services/platformService';
import { useAuthStore } from '../store';
import type { OnboardingProgress, Workspace, Brand, SocialAccount } from '../types';

const STEPS = [
  { number: 1, title: 'Create Workspace', icon: BuildingOfficeIcon, description: 'Set up your workspace' },
  { number: 2, title: 'Brand Wizard', icon: SparklesIcon, description: 'Define your brand identity' },
  { number: 3, title: 'Connect Platforms', icon: LinkIcon, description: 'Link your social accounts' },
  { number: 4, title: 'AI & Automation', icon: CpuChipIcon, description: 'Configure AI settings' },
  { number: 5, title: 'Brand DNA', icon: BeakerIcon, description: 'Generate your brand DNA' },
  { number: 6, title: 'Launch Plan', icon: RocketLaunchIcon, description: 'Set up your posting plan' },
  { number: 7, title: 'All Set!', icon: CheckCircleIcon, description: "You're ready to go" },
];

// =============================================
// Step 1: Create Workspace
// =============================================
function WorkspaceStep({ onNext }: { onNext: (ws: Workspace) => void }) {
  const [name, setName] = useState('');
  const [tz, setTz] = useState('UTC');
  const [language, setLanguage] = useState('en');
  const [teamSize, setTeamSize] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const workspace = await onboardingService.createWorkspace({
        name,
        timezone: tz,
        default_language: language,
        ...(teamSize ? { team_size: Number(teamSize) } : {}),
      });
      onNext(workspace);
    } catch {
      setError('Failed to create workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Workspace Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Agency, Marketing Team"
          className="input w-full"
          required
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Timezone</label>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="input w-full">
            <option value="UTC">UTC</option>
            <option value="US/Eastern">US Eastern</option>
            <option value="US/Pacific">US Pacific</option>
            <option value="Europe/London">London</option>
            <option value="Asia/Tokyo">Tokyo</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Dhaka">Bangladesh (BST)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Default Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input w-full">
            <option value="en">English</option>
            <option value="bn">Bengali</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Team Size (optional)</label>
        <input
          type="number"
          min={1}
          max={1000}
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value ? Number(e.target.value) : '')}
          placeholder="e.g., 5"
          className="input w-full"
        />
      </div>
      <button type="submit" disabled={!name.trim() || loading} className="btn-primary w-full py-3">
        {loading ? 'Creating...' : 'Create Workspace & Continue'}
      </button>
    </form>
  );
}

// =============================================
// Step 2: Brand Wizard
// =============================================
function BrandStep({ workspaceId, onNext }: { workspaceId: number; onNext: (brand: Brand) => void }) {
  const [form, setForm] = useState({
    brand_name: '',
    industry: '',
    target_region: '',
    website_url: '',
    voice_tone: 'professional',
  });
  const [doDontRules, setDoDontRules] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [newAudience, setNewAudience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goalOptions = [
    { value: 'leads', label: 'Lead Generation' },
    { value: 'growth', label: 'Audience Growth' },
    { value: 'authority', label: 'Thought Leadership' },
    { value: 'sales', label: 'Direct Sales' },
    { value: 'awareness', label: 'Brand Awareness' },
    { value: 'community', label: 'Community Building' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const doRules: string[] = [];
      const dontRules: string[] = [];
      if (doDontRules.trim()) {
        doDontRules.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.toLowerCase().startsWith("don't") || trimmed.toLowerCase().startsWith('dont') || trimmed.toLowerCase().startsWith('never') || trimmed.toLowerCase().startsWith('avoid')) {
            dontRules.push(trimmed);
          } else if (trimmed) {
            doRules.push(trimmed);
          }
        });
      }

      const brand = await onboardingService.createBrand({
        ...form,
        workspace: workspaceId,
        goals,
        audiences,
        do_dont_rules: { do: doRules, dont: dontRules },
      } as unknown as Partial<Brand>);
      onNext(brand);
    } catch {
      setError('Failed to create brand. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addAudience = () => {
    if (newAudience.trim() && audiences.length < 5) {
      setAudiences([...audiences, newAudience.trim()]);
      setNewAudience('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Section A: Basic Info */}
      <div className="space-y-1 mb-2">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Basic Info</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Brand Name *</label>
          <input type="text" value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} placeholder="Your brand or business name" className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Industry *</label>
          <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g., Technology, Fashion, Food" className="input w-full" required />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Target Region *</label>
          <input type="text" value={form.target_region} onChange={(e) => setForm({ ...form, target_region: e.target.value })} placeholder="e.g., Global, South Asia, US" className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Website URL</label>
          <input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://yourbrand.com" className="input w-full" />
        </div>
      </div>

      {/* Section B: Voice & Tone */}
      <div className="border-t border-white/5 pt-5 mt-5">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Voice & Tone</h3>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Brand Voice</label>
        <select value={form.voice_tone} onChange={(e) => setForm({ ...form, voice_tone: e.target.value })} className="input w-full">
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="friendly">Friendly</option>
          <option value="enthusiastic">Enthusiastic</option>
          <option value="humorous">Humorous</option>
          <option value="inspirational">Inspirational</option>
          <option value="formal">Formal</option>
          <option value="conversational">Conversational</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Do / Don't Rules (optional)</label>
        <textarea
          value={doDontRules}
          onChange={(e) => setDoDontRules(e.target.value)}
          placeholder={"Always use inclusive language\nKeep it short and direct\nDon't use slang\nNever discuss competitors"}
          rows={4}
          className="input w-full resize-none"
        />
        <p className="text-xs text-text-muted mt-1">One rule per line. Lines starting with "Don't", "Never", or "Avoid" will be categorized as Don'ts.</p>
      </div>

      {/* Section C: Goals */}
      <div className="border-t border-white/5 pt-5 mt-5">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Goals</h3>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">What are your social media goals?</label>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoals(goals.includes(g.value) ? goals.filter((x) => x !== g.value) : [...goals, g.value])}
              className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                goals.includes(g.value) ? 'bg-primary/20 border-primary text-primary shadow-glow-primary' : 'border-white/10 text-text-secondary hover:border-white/20'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section D: Audiences */}
      <div className="border-t border-white/5 pt-5 mt-5">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Target Audiences</h3>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Who is your target audience? (up to 5)</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newAudience}
            onChange={(e) => setNewAudience(e.target.value)}
            placeholder="e.g., Small business owners aged 25-45"
            className="input flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAudience(); } }}
            disabled={audiences.length >= 5}
          />
          <button type="button" onClick={addAudience} disabled={audiences.length >= 5 || !newAudience.trim()} className="btn-secondary px-4">
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {audiences.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
              {a}
              <button type="button" onClick={() => setAudiences(audiences.filter((_, j) => j !== i))} className="hover:text-red-400 transition-colors">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <button type="submit" disabled={!form.brand_name || !form.industry || !form.target_region || loading} className="btn-primary w-full py-3 mt-4">
        {loading ? 'Creating Brand...' : 'Create Brand & Continue'}
      </button>
    </form>
  );
}

// =============================================
// Step 3: Connect Platforms
// =============================================
function ConnectPlatformsStep({ onNext }: { onNext: () => void }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [connectError, setConnectError] = useState('');

  // Simple connect form state
  const [platform, setPlatform] = useState('facebook');
  const [accountName, setAccountName] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const platformConfigs: Record<string, { label: string; color: string; fields: { key: string; label: string; placeholder: string }[] }> = {
    facebook: {
      label: 'Facebook',
      color: '#1877F2',
      fields: [
        { key: 'facebook_page_id', label: 'Page ID', placeholder: 'Your Facebook Page ID' },
        { key: 'facebook_access_token', label: 'Access Token', placeholder: 'Page Access Token' },
      ],
    },
    instagram: {
      label: 'Instagram',
      color: '#E4405F',
      fields: [
        { key: 'instagram_business_account_id', label: 'Business Account ID', placeholder: 'Instagram Business Account ID' },
        { key: 'instagram_access_token', label: 'Access Token', placeholder: 'Instagram Access Token' },
      ],
    },
    twitter: {
      label: 'Twitter/X',
      color: '#1DA1F2',
      fields: [
        { key: 'twitter_api_key', label: 'API Key', placeholder: 'API Key' },
        { key: 'twitter_api_secret', label: 'API Secret', placeholder: 'API Secret' },
        { key: 'twitter_access_token', label: 'Access Token', placeholder: 'Access Token' },
        { key: 'twitter_access_token_secret', label: 'Access Token Secret', placeholder: 'Access Token Secret' },
      ],
    },
    linkedin: {
      label: 'LinkedIn',
      color: '#0A66C2',
      fields: [
        { key: 'linkedin_person_urn', label: 'Person URN', placeholder: 'urn:li:person:xxxxx' },
        { key: 'linkedin_access_token', label: 'Access Token', placeholder: 'LinkedIn Access Token' },
      ],
    },
    telegram: {
      label: 'Telegram',
      color: '#0088CC',
      fields: [
        { key: 'telegram_bot_token', label: 'Bot Token', placeholder: 'Bot Token from @BotFather' },
        { key: 'telegram_channel_id', label: 'Channel ID', placeholder: '@channel_username or -100xxx' },
      ],
    },
  };

  const loadAccounts = useCallback(async () => {
    try {
      const list = await platformService.list();
      setAccounts(list);
    } catch { /* ok */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setConnectError('');
    try {
      await platformService.connect({
        platform: platform as SocialAccount['platform'],
        account_name: accountName,
        ...credentials,
      });
      setShowForm(false);
      setAccountName('');
      setCredentials({});
      await loadAccounts();
    } catch {
      setConnectError('Failed to connect account. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (id: number) => {
    try {
      await platformService.disconnect(id);
      await loadAccounts();
    } catch { /* ok */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-text-secondary text-center">
        Connect at least one social media account to continue. You can add more later.
      </p>

      {/* Connected accounts list */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text-secondary">Connected Accounts ({accounts.length})</h4>
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-dark-700/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: platformConfigs[acc.platform]?.color || '#666' }}>
                  {acc.platform[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{acc.account_name}</p>
                  <p className="text-xs text-text-muted capitalize">{acc.platform}</p>
                </div>
              </div>
              <button onClick={() => handleDisconnect(acc.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connect new account */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-lg border-2 border-dashed border-white/10 hover:border-primary/30 text-text-secondary hover:text-primary transition-all flex items-center justify-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Connect New Account
        </button>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleConnect}
          className="p-4 rounded-lg border border-white/10 bg-dark-700/50 space-y-4"
        >
          {connectError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
              {connectError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Platform</label>
              <select value={platform} onChange={(e) => { setPlatform(e.target.value); setCredentials({}); }} className="input w-full text-sm">
                {Object.entries(platformConfigs).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Account Name</label>
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Display name" className="input w-full text-sm" required />
            </div>
          </div>
          {platformConfigs[platform]?.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-text-secondary mb-1">{field.label}</label>
              <input
                type="text"
                value={credentials[field.key] || ''}
                onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="input w-full text-sm"
                required
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary px-6 text-sm">
              {submitting ? 'Connecting...' : 'Connect'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setConnectError(''); }} className="btn-secondary px-4 text-sm">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {/* Continue button */}
      <button
        onClick={onNext}
        disabled={accounts.length === 0}
        className={`w-full py-3 rounded-lg font-medium transition-all ${
          accounts.length > 0
            ? 'btn-primary'
            : 'bg-dark-600 text-text-muted cursor-not-allowed'
        }`}
      >
        {accounts.length === 0 ? 'Connect at least 1 account to continue' : `Continue with ${accounts.length} account${accounts.length > 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// =============================================
// Step 4: AI & Automation Setup (Informational)
// =============================================
function AISetupStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <p className="text-text-secondary text-center">
        Sellanto includes powerful AI tools. You can configure them anytime from their settings pages.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: 'AI Caption Generator', desc: 'Generate engaging captions with OpenAI GPT models', icon: '1' },
          { title: 'AI Image Generator', desc: 'Create stunning images with Gemini or DALL-E', icon: '2' },
          { title: 'AI Video Generator', desc: 'Generate videos with Google Gemini', icon: '3' },
          { title: 'Messenger Bot', desc: 'Automate Facebook Messenger with RAG AI', icon: '4' },
        ].map((tool) => (
          <div key={tool.title} className="card p-4 border border-white/5 hover:border-primary/20 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{tool.icon}</span>
              </div>
              <div>
                <h4 className="font-semibold text-text-primary text-sm">{tool.title}</h4>
                <p className="text-xs text-text-secondary mt-0.5">{tool.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted text-center">
        API keys can be configured from each tool's settings page anytime after setup.
      </p>
      <button onClick={onNext} className="btn-primary w-full py-3">
        Continue
      </button>
    </div>
  );
}

// =============================================
// Step 5: Brand DNA
// =============================================
function BrandDNAStep({ brand, onNext }: { brand: Brand | null; onNext: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!brand) return;
    setGenerating(true);
    setError('');
    try {
      const brandDna = {
        voice: brand.voice_tone || 'professional',
        industry: brand.industry,
        region: brand.target_region,
        goals: brand.goals || [],
        audiences: brand.audiences || [],
        generated_at: new Date().toISOString(),
        version: 1,
      };
      await onboardingService.updateBrand(brand.id, { brand_dna: brandDna } as unknown as Partial<Brand>);
      setGenerated(true);
    } catch {
      setError('Failed to generate Brand DNA. You can do this later from Business Profile.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
          <BeakerIcon className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Brand DNA Generation</h3>
        <p className="text-text-secondary text-sm">
          Brand DNA helps AI tools create content that matches your brand voice, goals, and audience.
        </p>
      </div>

      {brand && (
        <div className="rounded-lg border border-white/10 bg-dark-700/50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Brand Summary</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-text-muted">Name:</span>
              <span className="text-text-primary ml-2">{brand.brand_name}</span>
            </div>
            <div>
              <span className="text-text-muted">Industry:</span>
              <span className="text-text-primary ml-2">{brand.industry}</span>
            </div>
            <div>
              <span className="text-text-muted">Region:</span>
              <span className="text-text-primary ml-2">{brand.target_region}</span>
            </div>
            <div>
              <span className="text-text-muted">Voice:</span>
              <span className="text-text-primary ml-2 capitalize">{brand.voice_tone}</span>
            </div>
          </div>
          {brand.goals && brand.goals.length > 0 && (
            <div>
              <span className="text-text-muted text-sm">Goals:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {brand.goals.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs capitalize">{g}</span>
                ))}
              </div>
            </div>
          )}
          {brand.audiences && brand.audiences.length > 0 && (
            <div>
              <span className="text-text-muted text-sm">Audiences:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {brand.audiences.map((a, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-xs">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {generated ? (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
            <CheckCircleIcon className="w-5 h-5" />
            <span className="font-medium">Brand DNA generated successfully!</span>
          </div>
          <button onClick={onNext} className="btn-primary w-full py-3">
            Continue
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          {brand && (
            <button onClick={handleGenerate} disabled={generating} className="btn-primary flex-1 py-3">
              {generating ? 'Generating...' : 'Generate Brand DNA'}
            </button>
          )}
          <button onClick={onNext} className="btn-secondary flex-1 py-3">
            {brand ? 'Skip for Now' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================
// Step 6: Launch Plan
// =============================================
function LaunchPlanStep({ brandId, onNext }: { brandId: number | null; onNext: () => void }) {
  const [frequency, setFrequency] = useState(3);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [formats, setFormats] = useState<string[]>(['text', 'image']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatOptions = [
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
    { value: 'thread', label: 'Thread' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) {
      onNext();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onboardingService.createLaunchPlan({
        brand: brandId,
        post_frequency: frequency,
        formats_allowed: formats,
        approval_required: approvalRequired,
      });
      onNext();
    } catch {
      setError('Failed to save launch plan. Continuing anyway...');
      setTimeout(onNext, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Posts per Week</label>
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={14} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} className="flex-1 accent-primary" />
          <span className="text-2xl font-bold text-primary w-12 text-center">{frequency}</span>
        </div>
        <p className="text-xs text-text-muted mt-1">How many posts would you like to publish per week?</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Content Formats</label>
        <div className="flex flex-wrap gap-2">
          {formatOptions.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormats(formats.includes(f.value) ? formats.filter((x) => x !== f.value) : [...formats, f.value])}
              className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                formats.includes(f.value) ? 'bg-primary/20 border-primary text-primary' : 'border-white/10 text-text-secondary hover:border-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between p-4 rounded-lg border border-white/10">
        <div>
          <h4 className="font-medium text-text-primary">Require Approval</h4>
          <p className="text-sm text-text-secondary">Posts need approval before scheduling</p>
        </div>
        <button
          type="button"
          onClick={() => setApprovalRequired(!approvalRequired)}
          className={`w-12 h-6 rounded-full transition-colors relative ${approvalRequired ? 'bg-primary' : 'bg-dark-600'}`}
        >
          <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${approvalRequired ? 'left-6' : 'left-0.5'}`} />
        </button>
      </div>
      <button type="submit" disabled={loading || formats.length === 0} className="btn-primary w-full py-3">
        {loading ? 'Saving...' : 'Save Launch Plan & Continue'}
      </button>
    </form>
  );
}

// =============================================
// Step 7: Complete
// =============================================
function CompleteStep({ completedSteps, onFinish }: { completedSteps: number[]; onFinish: () => void }) {
  const stepChecklist = STEPS.slice(0, 6).map((s) => ({
    ...s,
    done: completedSteps.includes(s.number),
  }));

  return (
    <div className="space-y-6 text-center">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mx-auto">
        <CheckCircleIcon className="w-14 h-14 text-green-400" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-text-primary mb-2">You're All Set!</h3>
        <p className="text-text-secondary">
          Your workspace and brand are configured. Start creating amazing content!
        </p>
      </div>

      <div className="text-left space-y-2">
        {stepChecklist.map((step) => (
          <div key={step.number} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-white/5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500/20 text-green-400' : 'bg-dark-600 text-text-muted'}`}>
              {step.done ? <CheckCircleIcon className="w-4 h-4" /> : <span className="text-xs">{step.number}</span>}
            </div>
            <span className={`text-sm ${step.done ? 'text-text-primary' : 'text-text-muted'}`}>{step.title}</span>
          </div>
        ))}
      </div>

      <button onClick={onFinish} className="btn-primary w-full py-3 text-lg">
        Go to Dashboard
      </button>
    </div>
  );
}

// =============================================
// Main OnboardingPage
// =============================================
export function OnboardingPage() {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const p = await onboardingService.getProgress();
      setProgress(p);
      setCurrentStep(p.current_step);
      if (p.is_completed) {
        navigate('/', { replace: true });
        return;
      }
      // Load existing workspace/brand if steps already done
      if (p.completed_steps.includes(1)) {
        try {
          const workspaces = await onboardingService.getWorkspaces();
          if (workspaces.length > 0) setWorkspace(workspaces[0]);
        } catch { /* ok */ }
      }
      if (p.completed_steps.includes(2)) {
        try {
          const brands = await onboardingService.getBrands();
          if (brands.length > 0) setBrand(brands[0]);
        } catch { /* ok */ }
      }
    } catch {
      // No progress yet, start from 1
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepNumber: number) => {
    try {
      const updated = await onboardingService.completeStep(stepNumber);
      setProgress(updated);
      if (stepNumber < 7) {
        setCurrentStep(stepNumber + 1);
      }
    } catch {
      // Move to next step even if API fails
      if (stepNumber < 7) {
        setCurrentStep(stepNumber + 1);
      }
    }
  };

  const handleFinish = async () => {
    try {
      await onboardingService.completeStep(7);
      await fetchUser();
    } catch { /* ok */ }
    navigate('/', { replace: true });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WorkspaceStep
            onNext={(ws) => {
              setWorkspace(ws);
              completeStep(1);
            }}
          />
        );
      case 2:
        return (
          <BrandStep
            workspaceId={workspace?.id || 0}
            onNext={(b) => {
              setBrand(b);
              completeStep(2);
            }}
          />
        );
      case 3:
        return <ConnectPlatformsStep onNext={() => completeStep(3)} />;
      case 4:
        return <AISetupStep onNext={() => completeStep(4)} />;
      case 5:
        return <BrandDNAStep brand={brand} onNext={() => completeStep(5)} />;
      case 6:
        return <LaunchPlanStep brandId={brand?.id || null} onNext={() => completeStep(6)} />;
      case 7:
        return <CompleteStep completedSteps={progress?.completed_steps || [1, 2, 3, 4, 5, 6]} onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header - No skip button */}
      <div className="border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold gradient-text">Sellanto Setup</h1>
          <span className="text-sm text-text-muted">
            Step {currentStep} of 7
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((step) => (
            <div key={step.number} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step.number < currentStep
                    ? 'bg-green-500'
                    : step.number === currentStep
                    ? 'bg-primary'
                    : 'bg-dark-600'
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step.number < currentStep
                    ? 'bg-green-500/20 text-green-400'
                    : step.number === currentStep
                    ? 'bg-primary/20 text-primary ring-2 ring-primary/30'
                    : 'bg-dark-600 text-text-muted'
                }`}
              >
                {step.number < currentStep ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : (
                  step.number
                )}
              </div>
            ))}
          </div>
          <span className="text-sm text-text-secondary">
            {STEPS[currentStep - 1]?.title}
          </span>
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                {(() => {
                  const StepIcon = STEPS[currentStep - 1]?.icon;
                  return StepIcon ? (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <StepIcon className="w-6 h-6 text-primary" />
                    </div>
                  ) : null;
                })()}
                <div>
                  <h2 className="text-xl font-bold text-text-primary">{STEPS[currentStep - 1]?.title}</h2>
                  <p className="text-sm text-text-secondary">{STEPS[currentStep - 1]?.description}</p>
                </div>
              </div>
              {renderStep()}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Back button (for steps 2-6 only) */}
        {currentStep > 1 && currentStep < 7 && (
          <div className="mt-4">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Previous Step
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingPage;
