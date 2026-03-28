import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { OnboardingStepper } from '../components/redesign/OnboardingStepper';
import { BrandDNAView } from '../components/redesign/BrandDNAView';
import { TrendingTopicsView } from '../components/redesign/TrendingTopicsView';
import { IdeasReviewView } from '../components/redesign/IdeasReviewView';
import { MediaGenerationView } from '../components/redesign/MediaGenerationView';
import { useOverflowStore } from '../store';
import api from '../services/api';

const stepRoutes = ['/setup/brand-dna', '/setup/trending', '/setup/ideas', '/setup/media'];

const brandDnaTabs = ['Brand DNA', 'Pillars', 'Competitors', 'Trending'];

export function SetupFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const overflow = useOverflowStore();

  const [brandId, setBrandId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState(0);

  const currentStepIndex = stepRoutes.findIndex((r) => location.pathname.startsWith(r));
  const currentStep = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isBrandDna = location.pathname.startsWith('/setup/brand-dna');

  // Load brand on mount
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/brands/');
        const brands = Array.isArray(res.data) ? res.data : res.data.results || [];
        if (brands.length > 0) {
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          setBrandId(primary.id);
          overflow.setBrandId(primary.id);
        }
      } catch { /* no brands yet */ }
      setLoading(false);
    };
    init();
  }, []);

  // Derive completed steps from overflow store
  const completedSteps = [
    ...(overflow.dnaCompleted ? [0] : []),
    ...(overflow.trendingCompleted ? [1] : []),
    ...(overflow.selectedIdeaIds.length > 0 ? [2] : []),
    ...(overflow.generatedMediaIds.length > 0 ? [3] : []),
  ];

  const handleNext = () => {
    overflow.saveToServer();
    const nextIndex = currentStep + 1;
    if (nextIndex < stepRoutes.length) {
      navigate(stepRoutes[nextIndex]);
    } else {
      navigate('/getting-started');
    }
  };

  const handleBack = () => {
    const prevIndex = currentStep - 1;
    if (prevIndex >= 0) {
      navigate(stepRoutes[prevIndex]);
    } else {
      navigate('/getting-started');
    }
  };

  const handleStepClick = (step: number) => {
    if (step < stepRoutes.length) {
      navigate(stepRoutes[step]);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[920px] mx-auto flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'rgb(var(--c-coral))' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5 animate-in">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'rgb(var(--c-coral))' }}>
            Get Started
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">
            Follow each step to set up your content strategy.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn-ghost text-[13px] text-text-muted"
        >
          Skip & Go to Dashboard
        </button>
      </div>

      <OnboardingStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Sub-tabs for brand-dna route */}
      {isBrandDna && (
        <div className="flex gap-1 mb-4 animate-in-delay-1">
          {brandDnaTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(i)}
              className={`tab-btn ${i === activeSubTab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <Routes>
        <Route
          path="brand-dna"
          element={
            <BrandDNAView
              brandId={brandId}
              onNext={handleNext}
              onBack={handleBack}
              activeSubTab={activeSubTab}
              onSubTabChange={setActiveSubTab}
            />
          }
        />
        <Route
          path="trending"
          element={<TrendingTopicsView brandId={brandId} onNext={handleNext} onBack={handleBack} />}
        />
        <Route
          path="ideas"
          element={<IdeasReviewView brandId={brandId} onNext={handleNext} onBack={handleBack} />}
        />
        <Route
          path="media"
          element={<MediaGenerationView brandId={brandId} onNext={handleNext} onBack={handleBack} />}
        />
      </Routes>
    </div>
  );
}

export default SetupFlowPage;
