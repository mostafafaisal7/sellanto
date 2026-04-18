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

// Helper function to format timezone with UTC offset
const formatTimezone = (timezone: string): string => {
  try {
    // Get current date to calculate offset
    const now = new Date();

    // Create a date formatter for the specific timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });

    // Get the formatted parts
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');

    if (offsetPart && offsetPart.value.includes('GMT')) {
      const offset = offsetPart.value.replace('GMT', 'UTC');
      return `${timezone} (${offset})`;
    }

    // Fallback: calculate offset manually
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000;
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const formattedOffset = `UTC${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    return `${timezone} (${formattedOffset})`;
  } catch {
    // If timezone is invalid or calculation fails, return as-is
    return timezone === 'UTC' ? 'UTC (UTC+00:00)' : timezone;
  }
};

const COUNTRY_OPTIONS = [
  { value: 'Global', label: 'Global' },
  // North America
  { value: 'United States', label: 'United States' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Mexico', label: 'Mexico' },
  // Europe
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Finland', label: 'Finland' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Czech Republic', label: 'Czech Republic' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Greece', label: 'Greece' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Romania', label: 'Romania' },
  { value: 'Hungary', label: 'Hungary' },
  // Asia Pacific
  { value: 'China', label: 'China' },
  { value: 'Japan', label: 'Japan' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'India', label: 'India' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Hong Kong', label: 'Hong Kong' },
  { value: 'Taiwan', label: 'Taiwan' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'Bangladesh', label: 'Bangladesh' },
  { value: 'Pakistan', label: 'Pakistan' },
  { value: 'Australia', label: 'Australia' },
  { value: 'New Zealand', label: 'New Zealand' },
  // Middle East
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'Israel', label: 'Israel' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Egypt', label: 'Egypt' },
  // South America
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Chile', label: 'Chile' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Peru', label: 'Peru' },
  // Africa
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Egypt', label: 'Egypt' },
  { value: 'Morocco', label: 'Morocco' },
  // Other regions
  { value: 'Russia', label: 'Russia' },
  { value: 'Ukraine', label: 'Ukraine' },
];

const INDUSTRY_OPTIONS = [
  { value: 'SaaS', label: 'SaaS' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'Digital Marketing', label: 'Digital Marketing' },
  { value: 'Agency', label: 'Agency' },
  { value: 'Consulting', label: 'Consulting' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Education', label: 'Education' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Food & Beverage', label: 'Food & Beverage' },
  { value: 'Travel & Hospitality', label: 'Travel & Hospitality' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Fashion & Beauty', label: 'Fashion & Beauty' },
  { value: 'Other', label: 'Other' },
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
function BrandWizardStep({
  onNext,
  initialBrand,
}: {
  onNext: (workspace: Workspace, brand: Brand) => void;
  initialBrand?: Brand | null;
  initialWorkspace?: Workspace | null;
}) {
  const [websiteUrl, setWebsiteUrl] = useState(initialBrand?.website_url?.replace(/^https?:\/\//, '') || '');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [customIndustries, setCustomIndustries] = useState<string[]>([]);
  const [newCustomIndustry, setNewCustomIndustry] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [customAudiences, setCustomAudiences] = useState<string[]>(initialBrand?.audiences || []);
  const [newCustomAudience, setNewCustomAudience] = useState('');
  const [error, setError] = useState('');

  const handleIndustryToggle = (value: string) => {
    if (value === 'Other') {
      // Toggle Other option
      if (selectedIndustries.includes('Other')) {
        setSelectedIndustries(selectedIndustries.filter((i) => i !== 'Other'));
        setCustomIndustries([]);
      } else {
        if (selectedIndustries.length + customIndustries.length < 3) {
          setSelectedIndustries([...selectedIndustries, 'Other']);
        }
      }
    } else {
      if (selectedIndustries.includes(value)) {
        setSelectedIndustries(selectedIndustries.filter((i) => i !== value));
      } else {
        const totalSelected = selectedIndustries.filter((i) => i !== 'Other').length + customIndustries.length;
        if (totalSelected < 3) {
          setSelectedIndustries([...selectedIndustries, value]);
        }
      }
    }
  };

  const addCustomIndustry = () => {
    if (newCustomIndustry.trim() && customIndustries.length < 3) {
      const totalSelected = selectedIndustries.filter((i) => i !== 'Other').length + customIndustries.length;
      if (totalSelected < 3) {
        setCustomIndustries([...customIndustries, newCustomIndustry.trim()]);
        setNewCustomIndustry('');
      }
    }
  };

  const removeCustomIndustry = (index: number) => {
    setCustomIndustries(customIndustries.filter((_, i) => i !== index));
  };

  const handleCountryToggle = (value: string) => {
    if (selectedCountries.includes(value)) {
      setSelectedCountries(selectedCountries.filter((c) => c !== value));
    } else {
      setSelectedCountries([...selectedCountries, value]);
    }
  };

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

    const totalIndustries = selectedIndustries.filter((i) => i !== 'Other').length + customIndustries.length;
    if (totalIndustries === 0) {
      setError('Please select at least one industry');
      return;
    }

    if (selectedCountries.length === 0) {
      setError('Please select at least one target region/country');
      return;
    }

    const totalAudiences = selectedAudiences.filter((a) => a !== 'Other').length + customAudiences.length;
    if (totalAudiences === 0) {
      setError('Please select at least one target audience');
      return;
    }

    // Just move to next step - DON'T SAVE YET
    // Data will be saved when user clicks "Get Started" in Step 2
    const normalizedUrl = normalizeUrl(websiteUrl);
    const brandName = extractDomainName(websiteUrl);
    const workspaceName = brandName || 'My Workspace';

    // Combine selected and custom values
    const allIndustries = [
      ...selectedIndustries.filter((i) => i !== 'Other'),
      ...customIndustries,
    ];
    const allAudiences = [
      ...selectedAudiences.filter((a) => a !== 'Other'),
      ...customAudiences,
    ];

    // For backward compatibility, join arrays as comma-separated strings
    const industryString = allIndustries.join(', ');
    const regionString = selectedCountries.join(', ');

    // Create temporary workspace and brand objects for preview
    const tempWorkspace: Workspace = {
      id: 0,
      name: workspaceName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      default_language: 'en',
      max_generations_per_day: 200,
      generations_today: 0,
      is_active: true,
      can_generate: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tempBrand: Brand = {
      id: 0,
      workspace: 0,
      brand_name: brandName,
      industry: industryString,
      target_region: regionString,
      website_url: normalizedUrl,
      social_links: {},
      voice_tone: 'professional',
      do_dont_rules: {},
      goals: [],
      audiences: allAudiences,
      brand_dna: {},
      brand_dna_source: '',
      is_primary: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Move to Step 2 with temporary data (not saved yet)
    onNext(tempWorkspace, tempBrand);
  };

  const totalIndustries = selectedIndustries.filter((i) => i !== 'Other').length + customIndustries.length;
  const canAddMoreIndustries = totalIndustries < 3;

  const totalAudiences = selectedAudiences.filter((a) => a !== 'Other').length + customAudiences.length;
  const canAddMoreAudiences = totalAudiences < 3;

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

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Industry <span className="text-red-400">*</span>{' '}
          <span className="text-xs text-text-muted">(Select up to 3)</span>
        </label>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {INDUSTRY_OPTIONS.map((opt) => {
            const isSelected = selectedIndustries.includes(opt.value);
            const isDisabled = !canAddMoreIndustries && !isSelected;

            return (
              <div key={opt.value}>
                <button
                  type="button"
                  onClick={() => !isDisabled && handleIndustryToggle(opt.value)}
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

                {/* Custom industry input for "Other" */}
                {opt.value === 'Other' && isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 ml-4 space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCustomIndustry}
                        onChange={(e) => setNewCustomIndustry(e.target.value)}
                        placeholder="Specify your industry..."
                        className="input flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomIndustry();
                          }
                        }}
                        disabled={customIndustries.length >= 3}
                      />
                      <button
                        type="button"
                        onClick={addCustomIndustry}
                        disabled={customIndustries.length >= 3 || !newCustomIndustry.trim()}
                        className="btn-secondary px-4 disabled:opacity-50"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {customIndustries.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {customIndustries.map((ind, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary"
                          >
                            {ind}
                            <button
                              type="button"
                              onClick={() => removeCustomIndustry(i)}
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

        {totalIndustries > 0 && (
          <p className="text-xs text-text-muted mt-2">
            {totalIndustries} of 3 industries selected
          </p>
        )}
      </div>

      {/* Target Regions/Countries */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Target Regions/Countries <span className="text-red-400">*</span>{' '}
          <span className="text-xs text-text-muted">(Select one or more)</span>
        </label>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {COUNTRY_OPTIONS.map((opt) => {
            const isSelected = selectedCountries.includes(opt.value);

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleCountryToggle(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'border-white/10 text-text-secondary hover:border-white/20 hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{opt.label}</span>
                  {isSelected && <CheckCircleIcon className="w-5 h-5" />}
                </div>
              </button>
            );
          })}
        </div>

        {selectedCountries.length > 0 && (
          <p className="text-xs text-text-muted mt-2">
            {selectedCountries.length} {selectedCountries.length === 1 ? 'region' : 'regions'} selected
          </p>
        )}
      </div>

      {/* Target Audiences */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Target Audiences <span className="text-xs text-text-muted">(Select up to 3)</span>
        </label>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const isSelected = selectedAudiences.includes(opt.value);
            const isDisabled = !canAddMoreAudiences && !isSelected;

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

        {totalAudiences > 0 && (
          <p className="text-xs text-text-muted mt-2">
            {totalAudiences} of 3 audiences selected
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!websiteUrl.trim() || totalIndustries === 0 || selectedCountries.length === 0 || totalAudiences === 0}
        className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
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
  onBack,
}: {
  workspace: Workspace;
  brand: Brand;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>('brand');
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    await onFinish();
    // Don't set saving to false - we're navigating away
  };

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
                  <p className="text-text-primary">{formatTimezone(workspace.timezone)}</p>
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

      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="btn-secondary flex-1 py-3" disabled={saving}>
          Back
        </button>
        <button
          onClick={handleFinish}
          className="btn-primary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving}
        >
          {saving ? 'Saving your setup...' : 'Get Started'}
        </button>
      </div>
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
    if (!workspace || !brand) return;

    try {
      // If workspace and brand don't have IDs, they haven't been saved yet
      if (workspace.id === 0 && brand.id === 0) {
        // Create workspace
        const savedWorkspace = await onboardingService.createWorkspace({
          name: workspace.name,
          timezone: workspace.timezone,
          default_language: workspace.default_language,
        });

        // Create brand
        const savedBrand = await onboardingService.createBrand({
          brand_name: brand.brand_name,
          industry: brand.industry,
          target_region: brand.target_region,
          website_url: brand.website_url,
          workspace: savedWorkspace.id,
          voice_tone: brand.voice_tone,
          audiences: brand.audiences,
          goals: brand.goals,
        } as unknown as Partial<Brand>);

        // Update local state with saved data
        setWorkspace(savedWorkspace);
        setBrand(savedBrand);

        // Mark steps as complete
        await onboardingService.completeStep(1);
        await onboardingService.completeStep(2);
      } else {
        // Data already exists (user came back), just mark step 2 complete
        await onboardingService.completeStep(2);
      }

      await fetchUser();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
      // Show error to user
      alert('Failed to complete setup. Please try again.');
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BrandWizardStep
            initialBrand={brand}
            initialWorkspace={workspace}
            onNext={(ws, br) => {
              setWorkspace(ws);
              setBrand(br);
              setCurrentStep(2);
            }}
          />
        );
      case 2:
        return workspace && brand ? (
          <AllSetStep workspace={workspace} brand={brand} onFinish={handleFinish} onBack={handleBack} />
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
