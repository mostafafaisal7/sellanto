import { useState, useEffect, useRef } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  GlobeAltIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import strategyService from '../../services/strategyService';
import { useOverflowStore } from '../../store';
import api from '../../services/api';

type AnalysisState = 'idle' | 'loading' | 'success' | 'partial' | 'failed';

const stateConfig: Record<'success' | 'partial' | 'failed', { icon: typeof CheckCircleIcon; color: string; bgColor: string; borderColor: string; label: string; message: string }> = {
  success: {
    icon: CheckCircleIcon,
    color: 'rgb(var(--c-green))',
    bgColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.2)',
    label: 'Analysis Complete',
    message: 'We successfully analyzed your brand. Review the details below.',
  },
  partial: {
    icon: ExclamationTriangleIcon,
    color: 'rgb(var(--c-amber))',
    bgColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.2)',
    label: 'Partial Analysis',
    message: 'We found some information but some fields need your review.',
  },
  failed: {
    icon: XCircleIcon,
    color: 'rgb(var(--c-coral))',
    bgColor: 'rgba(232,54,79,0.08)',
    borderColor: 'rgba(232,54,79,0.2)',
    label: 'Analysis Failed',
    message: "We couldn't read your website. Please fill in the details manually.",
  },
};

interface BrandDNAViewProps {
  brandId: number | null;
  onNext: () => void;
  onBack: () => void;
  activeSubTab: number;
  onSubTabChange: (tab: number) => void;
}

export function BrandDNAView({ brandId, onNext, onBack }: BrandDNAViewProps) {
  const overflow = useOverflowStore();

  // DNA state
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dnaData, setDnaData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Logo state
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load existing DNA on mount
  useEffect(() => {
    if (!brandId) return;
    strategyService.getDNAStatus(brandId).then((res) => {
      if (res.brand_dna && Object.keys(res.brand_dna).length > 0) {
        setDnaData(res.brand_dna);
        // Check completeness
        const hasName = !!res.brand_dna.brand_name;
        const hasIndustry = !!res.brand_dna.industry;
        const hasDesc = !!res.brand_dna.description;
        if (hasName && hasIndustry && hasDesc) {
          setAnalysisState('success');
        } else {
          setAnalysisState('partial');
        }
        if (res.website_url) setWebsiteUrl(res.website_url);
        overflow.markDNAComplete();
      }
    }).catch(() => {});
    // Load brand logo
    api.get(`/brands/${brandId}/`).then((res) => {
      if (res.data.logo) setBrandLogo(res.data.logo);
    }).catch(() => {});
  }, [brandId]);

  // Generate DNA from website
  const handleGenerate = async () => {
    if (!brandId || !websiteUrl.trim()) return;
    setAnalysisState('loading');
    setError(null);
    try {
      const result = await strategyService.generateDNA(brandId, websiteUrl.trim());
      if (result.brand_dna) {
        setDnaData(result.brand_dna);
        const hasName = !!result.brand_dna.brand_name;
        const hasIndustry = !!result.brand_dna.industry;
        const hasDesc = !!result.brand_dna.description;
        if (hasName && hasIndustry && hasDesc) {
          setAnalysisState('success');
        } else {
          setAnalysisState('partial');
        }
        overflow.markDNAComplete();
        overflow.setBrandContext({
          brand_name: result.brand_dna.brand_name || '',
          industry: result.brand_dna.industry || '',
          target_audience: result.brand_dna.target_audience || '',
          description: result.brand_dna.description || '',
        });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to generate DNA.';
      setError(msg);
      setAnalysisState('failed');
    }
  };

  // Reanalyze
  const handleReanalyze = () => {
    handleGenerate();
  };

  // Logo upload
  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUpload = async () => {
    if (!brandId || !logoFile) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const res = await api.patch(`/brands/${brandId}/`, formData);
      setBrandLogo(res.data.logo);
      // Also create BrandAsset for media step
      const assetForm = new FormData();
      assetForm.append('brand', String(brandId));
      assetForm.append('file', logoFile);
      assetForm.append('asset_type', 'logo');
      assetForm.append('name', dnaData?.brand_name || 'Brand Logo');
      await api.post('/brand-assets/', assetForm).catch(() => {});
      setLogoFile(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    } catch { /* handle error */ }
    setLogoUploading(false);
  };

  // Derive display data from dnaData
  const brandData = dnaData ? {
    name: dnaData.brand_name || '',
    industry: dnaData.industry || '',
    voice: dnaData.brand_voice || '',
    cta: dnaData.cta_style || '',
    description: dnaData.description || '',
    audience: dnaData.target_audience || '',
    products: Array.isArray(dnaData.products_services) ? dnaData.products_services : [],
    themes: Array.isArray(dnaData.content_themes) ? dnaData.content_themes : [],
    keywords: Array.isArray(dnaData.keywords) ? dnaData.keywords : [],
  } : null;

  const bannerState = analysisState === 'loading' || analysisState === 'idle' ? null : analysisState;
  const config = bannerState ? stateConfig[bannerState] : null;
  const StateIcon = config?.icon;

  return (
    <div className="animate-in">
      {/* Title */}
      <div className="flex items-center gap-2 mb-6">
        <GlobeAltIcon className="w-5 h-5 text-coral" />
        <h2 className="text-[20px] font-bold text-text-primary">Brand DNA</h2>
        <span className="help-tip">ℹ What's this?</span>
      </div>

      {/* Website URL Input */}
      <div
        className="rounded-[14px] p-5 mb-4"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3 className="text-[14px] font-bold text-text-primary mb-3">Website URL</h3>
        <p className="text-[12px] text-text-secondary mb-3">
          Enter your website URL and we'll analyze it to build your brand profile automatically.
        </p>
        <div className="flex gap-3">
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://your-website.com"
            className="input-field flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={analysisState === 'loading' || !websiteUrl.trim()}
            className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-white flex items-center gap-2 transition-opacity"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
              opacity: (!websiteUrl.trim() || analysisState === 'loading') ? 0.4 : 1,
            }}
          >
            {analysisState === 'loading' ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                Analyzing...
              </>
            ) : dnaData ? 'Reanalyze' : 'Generate DNA'}
          </button>
        </div>
        {error && <p className="text-[13px] mt-2" style={{ color: 'rgb(var(--c-coral))' }}>{error}</p>}
      </div>

      {/* Loading state */}
      {analysisState === 'loading' && !dnaData && (
        <div
          className="rounded-[14px] p-12 text-center mb-4"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'rgb(var(--c-coral))' }} />
          <p className="text-text-muted mt-3 text-[13px]">Analyzing your website with AI...</p>
          <p className="text-text-muted mt-1 text-[11px]">This may take 30-60 seconds</p>
        </div>
      )}

      {/* Status banner */}
      {config && StateIcon && (
        <div
          className="rounded-[12px] p-3 px-4 flex items-center gap-3 mb-6"
          style={{
            background: config.bgColor,
            border: `1px solid ${config.borderColor}`,
          }}
        >
          <StateIcon className="w-6 h-6 flex-shrink-0" style={{ color: config.color }} />
          <div className="flex-1">
            <h3 className="text-[14px] font-bold" style={{ color: config.color }}>{config.label}</h3>
            <p className="text-[12px] text-text-secondary mt-0.5">{config.message}</p>
          </div>
          {bannerState !== 'success' && (
            <button onClick={handleReanalyze} className="btn-ghost text-[13px] flex items-center gap-1.5">
              <ArrowPathIcon className="w-4 h-4" /> Reanalyze
            </button>
          )}
        </div>
      )}

      {/* Brand Identity */}
      {brandData && bannerState !== 'failed' && (
        <div
          className="rounded-[14px] p-5 mb-4 hover-glow"
          style={{
            background: 'rgb(var(--c-bg-card))',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-text-primary">Brand Identity</h3>
            <button className="btn-ghost text-[12px] flex items-center gap-1">
              <PencilSquareIcon className="w-3.5 h-3.5" /> Edit Brand Identity
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: 'Brand Name', value: brandData.name },
              { label: 'Industry', value: brandData.industry },
              { label: 'Brand Voice', value: brandData.voice },
              { label: 'CTA Style', value: brandData.cta },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">{field.label}</p>
                <p className="text-[14px] font-semibold text-text-primary">{field.value || '—'}</p>
              </div>
            ))}
          </div>
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Description</p>
            <p className="text-[13px] text-text-secondary leading-relaxed">{brandData.description || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Target Audience</p>
            <p className="text-[13px] text-text-secondary leading-relaxed">{brandData.audience || '—'}</p>
          </div>
        </div>
      )}

      {/* Tags */}
      {brandData && bannerState !== 'failed' && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { title: 'Products & Services', items: brandData.products, color: 'purple' },
            { title: 'Content Themes', items: brandData.themes, color: 'coral' },
            { title: 'Keywords', items: brandData.keywords, color: 'blue' },
          ].map((section) => {
            const colorMap: Record<string, { bg: string; text: string }> = {
              purple: { bg: 'rgba(139,92,246,0.12)', text: 'rgb(var(--c-purple))' },
              coral: { bg: 'rgba(232,54,79,0.12)', text: 'rgb(var(--c-coral))' },
              blue: { bg: 'rgba(59,130,246,0.12)', text: 'rgb(var(--c-blue))' },
            };
            const colors = colorMap[section.color];
            return (
              <div
                key={section.title}
                className="rounded-[14px] p-4 hover-glow"
                style={{
                  background: 'rgb(var(--c-bg-card))',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[12px] font-semibold text-text-secondary">{section.title}</h4>
                  <button className="text-text-muted hover:text-text-secondary transition-colors">
                    <PencilSquareIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {section.items.length > 0 ? section.items.map((item: string) => (
                    <span
                      key={item}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {item}
                    </span>
                  )) : (
                    <span className="text-[11px] text-text-muted">No data yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state — no DNA yet */}
      {!dnaData && analysisState !== 'loading' && (
        <div
          className="rounded-[14px] p-12 text-center mb-4"
          style={{ background: 'rgb(var(--c-bg-card))', border: '1px solid var(--border-color)' }}
        >
          <GlobeAltIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgb(var(--c-text-muted))' }} />
          <p className="text-text-secondary text-[14px] mb-1">No brand DNA generated yet</p>
          <p className="text-text-muted text-[12px]">Enter your website URL above and click "Generate DNA" to get started.</p>
        </div>
      )}

      {/* Logo upload */}
      <div
        className="rounded-[14px] p-5 mb-6 flex items-center gap-5"
        style={{
          background: 'rgb(var(--c-bg-card))',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          className="w-16 h-16 rounded-[12px] flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            border: brandLogo || logoPreview ? 'none' : '2px dashed var(--border-color-hover)',
            background: brandLogo || logoPreview ? 'transparent' : 'rgba(255,255,255,0.02)',
          }}
        >
          {logoPreview ? (
            <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
          ) : brandLogo ? (
            <img src={brandLogo.startsWith('http') ? brandLogo : `/media/${brandLogo}`} alt="Brand logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-text-muted text-[24px]">📷</span>
          )}
        </div>
        <div className="flex-1">
          <h4 className="text-[14px] font-bold text-text-primary mb-1">Brand Logo</h4>
          <p className="text-[12px] text-text-secondary">
            {brandLogo ? 'Logo uploaded. You can replace it.' : 'Upload your logo for AI-generated images'}
          </p>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={handleLogoFileSelect}
        />
        {logoFile ? (
          <div className="flex gap-2">
            <button
              onClick={handleLogoUpload}
              disabled={logoUploading}
              className="btn-primary text-[13px] py-2 px-4"
            >
              {logoUploading ? 'Uploading...' : 'Save'}
            </button>
            <button
              onClick={() => { setLogoFile(null); if (logoPreview) URL.revokeObjectURL(logoPreview); setLogoPreview(null); }}
              className="btn-ghost text-[13px] py-2 px-3"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => logoInputRef.current?.click()}
            className="btn-secondary text-[13px] py-2 px-4"
          >
            {brandLogo ? 'Replace Logo' : 'Upload Logo'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-[14px]">
          <ArrowLeftIcon className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={onNext}
          disabled={!dnaData}
          className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white transition-opacity"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
            boxShadow: 'var(--shadow-glow-coral)',
            opacity: !dnaData ? 0.35 : 1,
          }}
        >
          Continue to Pillars →
        </button>
      </div>
    </div>
  );
}

export default BrandDNAView;
