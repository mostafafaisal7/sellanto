import { useCallback, useEffect, useState } from 'react';
import { useMagicModeStore } from '../../store/magicModeStore';
import { URLInputScreen } from './URLInputScreen';
import { AIQuestionsScreen } from './AIQuestionsScreen';
import { AIWorkingScreen } from './AIWorkingScreen';
import { ResultsScreen } from './ResultsScreen';
import { onboardingService } from '../../services';

interface ExistingBrand {
  id: number;
  brand_name: string;
  website_url: string;
  industry: string;
}

// Map stored brand industry to the closest AIQuestionsScreen option
function mapIndustryToOption(industry: string): string {
  const lower = (industry || '').toLowerCase();
  if (lower.includes('marketing') || lower.includes('agency')) return 'Digital Marketing Agency';
  if (lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('store') || lower.includes('shop') || lower.includes('retail'))
    return 'E-commerce / Online Store';
  if (lower.includes('saas') || lower.includes('software') || lower.includes('tech'))
    return 'SaaS / Software Company';
  if (lower.includes('local') || lower.includes('service') || lower.includes('plumbing') || lower.includes('cleaning'))
    return 'Local Service Business';
  if (lower.includes('consult') || lower.includes('freelanc') || lower.includes('coach'))
    return 'Consulting / Freelancing';
  return 'Other';
}

export function MagicModePage() {
  const store = useMagicModeStore();
  const { screen, setScreen, setUrl, setLogoFile, setAnswer, setBrandId, setSkipInitialQuestions } = store;

  const [existingBrand, setExistingBrand] = useState<ExistingBrand | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showResumeWarning, setShowResumeWarning] = useState(false);
  const [checked, setChecked] = useState(false);

  // Show resume warning if pipeline was completed and there are unfinished posts
  useEffect(() => {
    if (store.pipelineCompleted && store.generatedPosts.length > 0 && store.screen !== 'results') {
      setShowResumeWarning(true);
      setChecked(true);
    }
  }, []);

  // On mount, check for existing brand with DNA
  useEffect(() => {
    if (checked) return;
    let cancelled = false;

    (async () => {
      try {
        const brands = await onboardingService.getBrands();
        if (cancelled) return;
        // Find primary brand with DNA, or any brand with DNA
        const withDna = brands.filter(
          (b) => b.brand_dna && typeof b.brand_dna === 'object' && Object.keys(b.brand_dna).length > 0
        );
        const primary = withDna.find((b) => b.is_primary) || withDna[0];
        if (primary) {
          setExistingBrand({
            id: primary.id,
            brand_name: primary.brand_name,
            website_url: primary.website_url || '',
            industry: primary.industry,
          });
          // Only show popup if we're on the initial screen (not mid-flow or returning from results)
          if (store.screen === 'url' || store.screen === 'mode') {
            setShowPopup(true);
          }
        }
      } catch {
        // No brands found or API error — proceed with normal flow
      }
      if (!cancelled) setChecked(true);
    })();

    return () => { cancelled = true; };
  }, [checked, store.screen]);

  const handleUsePrevious = useCallback(() => {
    if (!existingBrand) return;
    setUrl(existingBrand.website_url);
    setAnswer('industry', mapIndustryToOption(existingBrand.industry));
    setSkipInitialQuestions(true);
    setBrandId(existingBrand.id);
    setShowPopup(false);
    setScreen('questions');
  }, [existingBrand, setUrl, setAnswer, setSkipInitialQuestions, setBrandId, setScreen]);

  const handleStartFresh = useCallback(() => {
    setSkipInitialQuestions(false);
    setShowPopup(false);
    setScreen('url');
  }, [setSkipInitialQuestions, setScreen]);

  const handleURLSubmit = useCallback((url: string, logoFile?: File) => {
    setUrl(url);
    if (logoFile) setLogoFile(logoFile);
    setScreen('questions');
  }, [setUrl, setLogoFile, setScreen]);

  const handleURLSkip = useCallback(() => {
    setUrl('');
    setScreen('questions');
  }, [setUrl, setScreen]);

  const handleQuestionsComplete = useCallback((answers: Record<string, string | string[]>) => {
    Object.entries(answers).forEach(([key, val]) => setAnswer(key, val));
    setScreen('working');
  }, [setAnswer, setScreen]);

  const handleQuestionsBack = useCallback(() => {
    if (store.skipInitialQuestions && existingBrand) {
      // Go back to popup instead of URL screen
      setShowPopup(true);
    } else {
      setScreen('url');
    }
  }, [store.skipInitialQuestions, existingBrand, setScreen]);

  const handleWorkingComplete = useCallback(() => {
    setScreen('results');
  }, [setScreen]);

  const handleWorkingStop = useCallback(() => {
    useMagicModeStore.getState().setGeneratedPosts([]);
    setScreen('questions');
  }, [setScreen]);

  const handleGoBack = useCallback(() => {
    useMagicModeStore.getState().setGeneratedPosts([]);
    setScreen('questions');
  }, [setScreen]);

  const handleGenerateMore = useCallback(() => {
    useMagicModeStore.getState().setGeneratedPosts([]);
    setScreen('working');
  }, [setScreen]);

  // Show resume warning for unfinished posts
  if (showResumeWarning && store.generatedPosts.length > 0) {
    const unfinished = store.generatedPosts.filter((p) => p.status !== 'published' && p.status !== 'scheduled').length;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'rgb(var(--c-bg-primary))' }}
      >
        <div
          className="w-full max-w-[460px] rounded-[24px] p-8 scale-in"
          style={{
            background: 'rgb(var(--c-bg-elevated))',
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-center mb-6">
            <div className="text-[48px] mb-3">📝</div>
            <h2 className="text-[24px] font-extrabold text-text-primary mb-2">
              Unfinished posts found
            </h2>
            <p className="text-[15px] text-text-secondary">
              You have {unfinished} unfinished post{unfinished !== 1 ? 's' : ''} from your last session.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setShowResumeWarning(false); setScreen('results'); }}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              Resume where I left off
            </button>
            <button
              onClick={() => { setShowResumeWarning(false); store.reset(); setScreen('url'); }}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-semibold transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-secondary))',
              }}
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show returning-user popup
  if (showPopup && existingBrand) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'rgb(var(--c-bg-primary))' }}
      >
        <div
          className="w-full max-w-[460px] rounded-[24px] p-8 scale-in"
          style={{
            background: 'rgb(var(--c-bg-elevated))',
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-center mb-6">
            <div className="text-[48px] mb-3">✨</div>
            <h2 className="text-[24px] font-extrabold text-text-primary mb-2">
              Welcome back!
            </h2>
            <p className="text-[15px] text-text-secondary">
              We found your previous brand profile
            </p>
          </div>

          {/* Brand card */}
          <div
            className="flex items-center gap-4 p-4 rounded-[16px] mb-6"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] flex-shrink-0"
              style={{ background: 'rgba(232,54,79,0.1)' }}
            >
              🏢
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-text-primary truncate">
                {existingBrand.brand_name}
              </p>
              {existingBrand.website_url && (
                <p className="text-[13px] text-text-muted truncate">
                  {existingBrand.website_url.replace(/^https?:\/\//, '')}
                </p>
              )}
            </div>
          </div>

          <p className="text-[14px] text-text-secondary text-center mb-6">
            Do you want to use your last Brand-DNA and business descriptions?
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleUsePrevious}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              Yes, use previous data
            </button>
            <button
              onClick={handleStartFresh}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-semibold transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'rgb(var(--c-text-secondary))',
              }}
            >
              No, start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  switch (screen) {
    case 'url':
      return <URLInputScreen onSubmit={handleURLSubmit} onSkip={handleURLSkip} />;
    case 'questions':
      return (
        <AIQuestionsScreen
          onComplete={handleQuestionsComplete}
          onBack={handleQuestionsBack}
          skipIndustry={store.skipInitialQuestions}
        />
      );
    case 'working':
      return <AIWorkingScreen onComplete={handleWorkingComplete} onStop={handleWorkingStop} />;
    case 'results':
      return <ResultsScreen onGenerateMore={handleGenerateMore} onGoBack={handleGoBack} />;
    default:
      return <URLInputScreen onSubmit={handleURLSubmit} onSkip={handleURLSkip} />;
  }
}

export default MagicModePage;
