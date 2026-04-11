import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeUrl, isValidUrl, extractDomainName } from '../utils/url';
import {
  SparklesIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import onboardingService from '../services/onboardingService';
import { useAuthStore } from '../store';
import type { Workspace, Brand } from '../types';

const STEPS = [
  { number: 1, title: 'Brand Wizard', icon: SparklesIcon, description: 'Define your brand identity' },
  { number: 2, title: 'All Set!', icon: CheckCircleIcon, description: "You're ready to go" },
];

const REGION_OPTIONS = [
  { value: 'Global', label: 'Global' },
  { value: 'North America', label: 'North America' },
  { value: 'South America', label: 'South America' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Asia', label: 'Asia' },
  { value: 'South Asia', label: 'South Asia' },
  { value: 'Southeast Asia', label: 'Southeast Asia' },
  { value: 'Middle East', label: 'Middle East' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Australia & Oceania', label: 'Australia & Oceania' },
];

const AUDIENCE_OPTIONS = [
  { value: 'Small Business Owners', label: 'Small Business Owners' },
  { value: 'Entrepreneurs', label: 'Entrepreneurs' },
  { value: 'Marketing Professionals', label: 'Marketing Professionals' },
  { value: 'E-commerce Sellers', label: 'E-commerce Sellers' },
  { value: 'Content Creators', label: 'Content Creators' },
  { value: 'Freelancers', label: 'Freelancers' },
  { value: 'Startups', label: 'Startups' },
  { value: 'Corporate Teams', label: 'Corporate Teams' },
  { value: 'Agency Clients', label: 'Agency Clients' },
  { value: 'Consumers (B2C)', label: 'Consumers (B2C)' },
  { value: 'Young Professionals (25-35)', label: 'Young Professionals (25-35)' },
  { value: 'Middle-Aged Professionals (35-50)', label: 'Middle-Aged Professionals (35-50)' },
  { value: 'Students & Recent Graduates', label: 'Students & Recent Graduates' },
  { value: 'Tech Enthusiasts', label: 'Tech Enthusiasts' },
  { value: 'Other', label: 'Other (specify below)' },
];

// =============================================
// Step 1: Brand Wizard
// =============================================
function BrandWizardStep({ onNext }: { onNext: (workspace: Workspace, brand: Brand) => void }) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [region, setRegion] = useState('Global');
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [customAudiences, setCustomAudiences] = useState<string[]>([]);
  const [newCustomAudience, setNewCustomAudience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAudienceToggle = (value: string) => {
    if (value === 'Other') {
      // Toggle Other option
      if (selectedAudiences.includes('Other')) {
        setSelectedAudiences(selectedAudiences.filter((a) => a !== 'Other'));
        setCustomAudiences([]);
      } else {
        if (selectedAudiences.length + customAudiences.length < 3) {
          setSelectedAudiences([...selectedAudiences, 'Other']);
        }
      }
    } else {
      if (selectedAudiences.includes(value)) {
        setSelectedAudiences(selectedAudiences.filter((a) => a !== value));
      } else {
        const totalSelected = selectedAudiences.filter((a) => a !== 'Other').length + customAudiences.length;
        if (totalSelected < 3) {
          setSelectedAudiences([...selectedAudiences, value]);
        }
      }
    }
  };

  const addCustomAudience = () => {
    if (newCustomAudience.trim() && customAudiences.length < 3) {
      const totalSelected = selectedAudiences.filter((a) => a !== 'Other').length + customAudiences.length;
      if (totalSelected < 3) {
        setCustomAudiences([...customAudiences, newCustomAudience.trim()]);
        setNewCustomAudience('');
      }
    }
  };

  const removeCustomAudience = (index: number) => {
    setCustomAudiences(customAudiences.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!websiteUrl.trim()) {
      setError('Website URL is required');
      return;
    }

    if (!isValidUrl(websiteUrl)) {
      setError('Please enter a valid website URL (e.g., example.com)');
      return;
    }

    const totalAudiences = selectedAudiences.filter((a) => a !== 'Other').length + customAudiences.length;
    if (totalAudiences === 0) {
      setError('Please select at least one target audience');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedUrl = normalizeUrl(websiteUrl);
      const brandName = extractDomainName(websiteUrl);
      const workspaceName = brandName || 'My Workspace';

      // Create workspace first (auto-generated from brand)
      const workspace = await onboardingService.createWorkspace({
        name: workspaceName,
        timezone: 'UTC',
        default_language: 'en',
      });

      // Combine selected and custom audiences
      const allAudiences = [
        ...selectedAudiences.filter((a) => a !== 'Other'),
        ...customAudiences,
      ];

      // Create brand
      const brand = await onboardingService.createBrand({
        brand_name: brandName,
        industry: brandName,
        target_region: region,
        website_url: normalizedUrl,
        workspace: workspace.id,
        voice_tone: 'professional',
        audiences: allAudiences,
        goals: [],
      } as unknown as Partial<Brand>);

      // Mark step 1 as complete
      await onboardingService.completeStep(1);

      onNext(workspace, brand);
    } catch (err) {
      setError('Failed to create brand. Please try again.');
      setLoading(false);
    }
  };

  const totalSelected = selectedAudiences.filter((a) => a !== 'Other').length + customAudiences.length;
  const canAddMore = totalSelected < 3;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Website URL */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Website URL <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="e.g., yourbrand.com"
          className="input w-full"
          required
        />
        <p className="text-xs text-text-muted mt-1">
          We'll use this to automatically set up your brand name and workspace
        </p>
      </div>

      {/* Region */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Target Region</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="input w-full">
          {REGION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Target Audiences */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Target Audiences <span className="text-xs text-text-muted">(Select up to 3)</span>
        </label>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const isSelected = selectedAudiences.includes(opt.value);
            const isDisabled = !canAddMore && !isSelected;

            return (
              <div key={opt.value}>
                <button
                  type="button"
                  onClick={() => !isDisabled && handleAudienceToggle(opt.value)}
                  disabled={isDisabled}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-primary/20 border-primary text-primary'
                      : isDisabled
                      ? 'border-white/5 text-text-muted opacity-50 cursor-not-allowed'
                      : 'border-white/10 text-text-secondary hover:border-white/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{opt.label}</span>
                    {isSelected && <CheckCircleIcon className="w-5 h-5" />}
                  </div>
                </button>

                {/* Custom audience input for "Other" */}
                {opt.value === 'Other' && isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 ml-4 space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCustomAudience}
                        onChange={(e) => setNewCustomAudience(e.target.value)}
                        placeholder="Specify your target audience..."
                        className="input flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomAudience();
                          }
                        }}
                        disabled={customAudiences.length >= 3}
                      />
                      <button
                        type="button"
                        onClick={addCustomAudience}
                        disabled={customAudiences.length >= 3 || !newCustomAudience.trim()}
                        className="btn-secondary px-4 disabled:opacity-50"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {customAudiences.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {customAudiences.map((aud, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary"
                          >
                            {aud}
                            <button
                              type="button"
                              onClick={() => removeCustomAudience(i)}
                              className="hover:text-red-400 transition-colors"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {totalSelected > 0 && (
          <p className="text-xs text-text-muted mt-2">
            {totalSelected} of 3 audiences selected
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!websiteUrl.trim() || totalSelected === 0 || loading}
        className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Setting up your brand...' : 'Continue'}
      </button>
    </form>
  );
}

// =============================================
// Step 2: All Set - Summary with Accordions
// =============================================
function AllSetStep({
  workspace,
  brand,
  onFinish,
}: {
  workspace: Workspace;
  brand: Brand;
  onFinish: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>('brand');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-text-primary mb-2">You're All Set!</h3>
        <p className="text-text-secondary">
          Your workspace and brand have been created. Review your setup below.
        </p>
      </div>

      {/* Brand Details Accordion */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('brand')}
          className="w-full px-5 py-4 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold text-text-primary">Brand Details</span>
          </div>
          {expandedSection === 'brand' ? (
            <ChevronUpIcon className="w-5 h-5 text-text-muted" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-text-muted" />
          )}
        </button>
        <AnimatePresence>
          {expandedSection === 'brand' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 py-4 space-y-3 bg-dark-700/30">
                <div>
                  <p className="text-xs text-text-muted mb-1">Brand Name</p>
                  <p className="text-text-primary font-medium">{brand.brand_name}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Industry</p>
                  <p className="text-text-primary">{brand.industry}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Website</p>
                  <a
                    href={brand.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {brand.website_url?.replace(/^https?:\/\//, '')}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Target Region</p>
                  <div className="flex items-center gap-2">
                    <GlobeAltIcon className="w-4 h-4 text-text-muted" />
                    <p className="text-text-primary">{brand.target_region}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Voice Tone</p>
                  <p className="text-text-primary capitalize">{brand.voice_tone || 'Professional'}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Target Audiences Accordion */}
      {brand.audiences && brand.audiences.length > 0 && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('audiences')}
            className="w-full px-5 py-4 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserGroupIcon className="w-5 h-5 text-secondary" />
              <span className="font-semibold text-text-primary">Target Audiences</span>
            </div>
            {expandedSection === 'audiences' ? (
              <ChevronUpIcon className="w-5 h-5 text-text-muted" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-text-muted" />
            )}
          </button>
          <AnimatePresence>
            {expandedSection === 'audiences' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 bg-dark-700/30">
                  <div className="flex flex-wrap gap-2">
                    {brand.audiences.map((aud, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-secondary"
                      >
                        {aud}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Workspace Info Accordion */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('workspace')}
          className="w-full px-5 py-4 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-3">
            <BuildingOfficeIcon className="w-5 h-5 text-info" />
            <span className="font-semibold text-text-primary">Workspace</span>
          </div>
          {expandedSection === 'workspace' ? (
            <ChevronUpIcon className="w-5 h-5 text-text-muted" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-text-muted" />
          )}
        </button>
        <AnimatePresence>
          {expandedSection === 'workspace' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 py-4 space-y-3 bg-dark-700/30">
                <div>
                  <p className="text-xs text-text-muted mb-1">Name</p>
                  <p className="text-text-primary font-medium">{workspace.name}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Timezone</p>
                  <p className="text-text-primary">{workspace.timezone}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Language</p>
                  <p className="text-text-primary uppercase">{workspace.default_language}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button onClick={onFinish} className="btn-primary w-full py-3 mt-8">
        Get Started
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
      if (p.is_completed) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setCurrentStep(p.current_step);

      // Load existing workspace/brand if step 1 already completed
      if (p.completed_steps.includes(1)) {
        try {
          const [workspaces, brands] = await Promise.all([
            onboardingService.getWorkspaces(),
            onboardingService.getBrands(),
          ]);
          if (workspaces.length > 0) setWorkspace(workspaces[0]);
          if (brands.length > 0) setBrand(brands[0]);
          if (workspaces.length > 0 && brands.length > 0) {
            setCurrentStep(2);
          }
        } catch {
          /* ok */
        }
      }
    } catch {
      // No progress yet, start from step 1
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      await onboardingService.completeStep(2);
      await fetchUser();
    } catch {
      /* ok */
    }
    navigate('/dashboard', { replace: true });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BrandWizardStep
            onNext={(ws, br) => {
              setWorkspace(ws);
              setBrand(br);
              setCurrentStep(2);
            }}
          />
        );
      case 2:
        return workspace && brand ? (
          <AllSetStep workspace={workspace} brand={brand} onFinish={handleFinish} />
        ) : null;
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
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold gradient-text">Sellanto Setup</h1>
          <span className="text-sm text-text-muted">Step {currentStep} of 2</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-3">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex-1">
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
              {idx < STEPS.length - 1 && <div className="w-3" />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className={`flex items-center gap-2 transition-all ${
                  step.number < currentStep
                    ? 'text-green-400'
                    : step.number === currentStep
                    ? 'text-primary'
                    : 'text-text-muted'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                    step.number < currentStep
                      ? 'bg-green-500/20'
                      : step.number === currentStep
                      ? 'bg-primary/20 ring-2 ring-primary/30'
                      : 'bg-dark-600'
                  }`}
                >
                  {step.number < currentStep ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className="text-sm font-medium hidden md:inline">{step.title}</span>
              </div>
            ))}
          </div>
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
                  <h2 className="text-xl font-bold text-text-primary">
                    {STEPS[currentStep - 1]?.title}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {STEPS[currentStep - 1]?.description}
                  </p>
                </div>
              </div>
              {renderStep()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default OnboardingPage;
