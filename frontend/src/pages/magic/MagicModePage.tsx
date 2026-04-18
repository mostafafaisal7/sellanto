import { useCallback, useEffect, useState } from 'react';
import { useMagicModeStore } from '../../store/magicModeStore';
import { useAuthStore } from '../../store';
import { URLInputScreen } from './URLInputScreen';
import { AIQuestionsScreen } from './AIQuestionsScreen';
import { ProductUploadScreen } from './ProductUploadScreen';
import { AIWorkingScreen } from './AIWorkingScreen';
import { ResultsScreen } from './ResultsScreen';
import { onboardingService } from '../../services';
import { lookupCachedPosts } from './cacheUtils';

interface ExistingBrand {
  id: number;
  brand_name: string;
  website_url: string;
  industry: string;
  brand_dna?: {
    brand_voice?: string;
    target_audience?: string;
    social_platforms?: string[];
    [key: string]: any;
  };
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

// Map brand voice to tone option
function mapBrandVoiceToTone(brandVoice: string): string {
  const lower = (brandVoice || '').toLowerCase();
  if (lower.includes('professional') || lower.includes('formal') || lower.includes('authoritative'))
    return 'Professional & Authoritative';
  if (lower.includes('friendly') || lower.includes('approachable') || lower.includes('warm'))
    return 'Friendly & Approachable';
  if (lower.includes('bold') || lower.includes('provocative') || lower.includes('edgy'))
    return 'Bold & Provocative';
  if (lower.includes('educational') || lower.includes('helpful') || lower.includes('informative'))
    return 'Educational & Helpful';
  if (lower.includes('fun') || lower.includes('casual') || lower.includes('playful'))
    return 'Fun & Casual';
  return 'Professional & Authoritative'; // Default
}

// Extract platforms from social_platforms or target_audience
function extractPlatforms(brand: ExistingBrand): string[] {
  const platforms: string[] = [];
  const dna = brand.brand_dna;

  if (dna?.social_platforms && Array.isArray(dna.social_platforms)) {
    const platformMap: Record<string, string> = {
      'linkedin': 'LinkedIn',
      'instagram': 'Instagram',
      'facebook': 'Facebook',
      'twitter': 'Twitter / X',
      'tiktok': 'TikTok',
    };

    dna.social_platforms.forEach((p: string) => {
      const lower = p.toLowerCase();
      Object.entries(platformMap).forEach(([key, value]) => {
        if (lower.includes(key) && !platforms.includes(value)) {
          platforms.push(value);
        }
      });
    });
  }

  // Default to LinkedIn if no platforms found
  return platforms.length > 0 ? platforms : ['LinkedIn'];
}

// ✅ OLD FUNCTIONS REMOVED - Now using unified cacheUtils.ts
// - Deleted: QUESTION_OPTIONS (moved to cacheUtils.ts as MAGIC_QUESTION_OPTIONS)
// - Deleted: encodeAnswersToIndices() (replaced by buildMagicCacheKey)
// - Deleted: saveMagicModeCache() (no longer needed - cache saved in AIWorkingScreen)

export function MagicModePage() {
  const store = useMagicModeStore();
  const { screen, setScreen, setUrl, setLogoFile, setAnswer, setBrandId, setSkipInitialQuestions } = store;

  const [existingBrand, setExistingBrand] = useState<ExistingBrand | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showResumeWarning, setShowResumeWarning] = useState(false);
  const [checked, setChecked] = useState(false);

  // ✅ FIX: Check for resume flag on mount (survives page refresh via localStorage)
  // This replaces the old pipelineCompleted check which was lost on page refresh
  useEffect(() => {
    if (checked) return;

    // Check in-memory store first (for in-session navigation)
    if (store.pipelineCompleted && store.generatedPosts.length > 0 && store.screen !== 'results') {
      console.log('[MagicMode] ✅ In-session posts found - showing resume warning');
      setShowResumeWarning(true);
      setChecked(true);
      return;
    }

    // Check localStorage flag (for page refresh / cross-session)
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) {
        setChecked(true);
        return;
      }

      const resumeFlagKey = `magic_has_posts_${userId}`;
      const hasPostsFlag = localStorage.getItem(resumeFlagKey);

      // ✅ Only show resume popup if NOT already on results screen
      // If user just generated and is on results, don't interrupt with popup
      if (hasPostsFlag === 'true' && store.screen !== 'results') {
        console.log('[MagicMode] ✅ Resume flag found - showing resume warning');
        setShowResumeWarning(true);
      } else if (hasPostsFlag === 'true' && store.screen === 'results') {
        console.log('[MagicMode] ℹ️ Resume flag exists but already on results screen - skipping popup');
      }
    } catch (error) {
      console.error('[MagicMode] Failed to check localStorage resume flag:', error);
    }

    setChecked(true);
  }, []);

  // ✅ WATCH: Update resume warning when posts are generated during session
  useEffect(() => {
    if (!checked) return;

    if (store.pipelineCompleted && store.generatedPosts.length > 0 && store.screen !== 'results' && !showResumeWarning) {
      console.log('[MagicMode] ✅ Posts completed during session - enabling resume warning');
      setShowResumeWarning(true);

      // Set localStorage flag for next page load
      try {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          localStorage.setItem(`magic_has_posts_${userId}`, 'true');
        }
      } catch (error) {
        console.error('[MagicMode] Failed to set localStorage resume flag:', error);
      }
    }
  }, [store.pipelineCompleted, store.generatedPosts.length, store.screen, checked]);

  // On mount, check for existing brand with DNA
  useEffect(() => {
    if (checked) return;
    let cancelled = false;

    (async () => {
      try {
        const brands = await onboardingService.getBrands();
        if (cancelled) return;

        // Find brands with DNA (preferred for popup flow)
        const withDna = brands.filter(
          (b) => b.brand_dna && typeof b.brand_dna === 'object' && Object.keys(b.brand_dna).length > 0
        );

        // Fallback: if no DNA brands, use any brand with website (for URL pre-fill)
        const anyBrand = brands.find((b) => b.website_url);

        // Priority: Primary with DNA > Any with DNA > Any with website
        const targetBrand = withDna.find((b) => b.is_primary) || withDna[0] || anyBrand;

        if (targetBrand) {
          setExistingBrand({
            id: targetBrand.id,
            brand_name: targetBrand.brand_name,
            website_url: targetBrand.website_url || '',
            industry: targetBrand.industry,
            brand_dna: targetBrand.brand_dna || {},
          });

          // Only show popup if brand has DNA data to pre-fill questions
          const hasDna = withDna.length > 0;
          if (hasDna && (store.screen === 'url' || store.screen === 'mode')) {
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

  const handleStartFresh = useCallback(() => {
    store.reset(); // Clear all stored data
    setExistingBrand(null); // Clear existing brand data
    setShowPopup(false);
    setScreen('url');
  }, [store, setScreen]);

  const handleUsePrevious = useCallback(() => {
    if (!existingBrand) return;

    // 🔒 SECURITY: Defensive check - verify current user owns this brand
    // This should never happen if backend is correct, but adds defense-in-depth
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      console.error('[MagicMode] Security: No current user found');
      handleStartFresh();
      return;
    }

    // Backend should already filter brands by user, but double-check for safety
    // Note: existingBrand doesn't have userId field, but it came from user-filtered API
    // so this is just a sanity check that we have a valid user session
    console.log(`[MagicMode] Using brand from user ${currentUser.id}: ${existingBrand.brand_name}`);

    // Build pre-filled answers object
    const prefilledAnswers: Record<string, string | string[]> = {
      industry: mapIndustryToOption(existingBrand.industry),
      tone: existingBrand.brand_dna?.brand_voice
        ? mapBrandVoiceToTone(existingBrand.brand_dna.brand_voice)
        : 'Professional & Authoritative',
      platforms: extractPlatforms(existingBrand),
      goal: 'Build brand awareness',
      colors: ['Use colors from my website'], // Default to website colors
    };

    // Set all answers
    Object.entries(prefilledAnswers).forEach(([key, val]) => setAnswer(key, val));

    // Store as "original answers" for change detection
    store.setOriginalAnswers(prefilledAnswers);

    // Store original custom answers (currently empty, will be populated if user selects "Other")
    store.setOriginalCustomAnswers(store.customAnswers || {});

    // Pre-fill URL and brand ID
    setUrl(existingBrand.website_url);
    setBrandId(existingBrand.id);

    setSkipInitialQuestions(false); // Let user see and confirm the questions
    setShowPopup(false);
    setScreen('questions'); // Go to questions screen with pre-filled data
  }, [existingBrand, setUrl, setAnswer, setSkipInitialQuestions, setBrandId, setScreen, store, handleStartFresh]);

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
    // Reset product upload flag after completing all questions
    store.setReturningFromProductUpload(false);
    setScreen('working');
  }, [setAnswer, setScreen, store]);

  const handleQuestionsNext = useCallback(async () => {
    // Get user ID from auth store
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.error('[MagicMode] Cannot lookup cache: No user ID available');
      setScreen('working');
      return;
    }

    // ✅ Use unified cache lookup function
    const cachedPosts = await lookupCachedPosts(store.answers, store.customAnswers || {}, userId);

    if (cachedPosts.length > 0) {
      console.log('[MagicMode] Cache HIT - Loading cached posts');

      store.setGeneratedPosts(cachedPosts as any);
      store.setHasPreviousGeneration(true);

      // 🔍 CRITICAL FIX: Store current answers as "original" for change detection
      // When user goes back and changes answers, we'll detect and show "Generate Posts" instead
      store.setOriginalAnswers(store.answers);
      store.setOriginalCustomAnswers(store.customAnswers || {});

      setScreen('results');
    } else {
      console.log('[MagicMode] Cache MISS - Generating new posts');
      setScreen('working');
    }
  }, [store, setScreen]);

  const handleProductUpload = useCallback(() => {
    // Mark that we're entering product upload flow
    store.setReturningFromProductUpload(true);
    setScreen('product_upload');
  }, [setScreen, store]);

  const handleProductUploadNext = useCallback(() => {
    // After product upload, continue to remaining questions (platforms & colors)
    // Keep returningFromProductUpload=true so AIQuestionsScreen starts at Q5
    setScreen('questions');
  }, [setScreen]);

  const handleProductUploadBack = useCallback(() => {
    // Go back to questions screen (will resume at product_mode question)
    // Reset flag so it starts from product_mode question, not platforms
    store.setReturningFromProductUpload(false);
    setScreen('questions');
  }, [setScreen, store]);

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

  const handleResumeFromFlag = useCallback(async () => {
    // Load recent magic posts from backend
    try {
      const { api } = await import('../../services');
      const response = await api.get('/magic/history/');

      // Extract posts from history (limited to recent 10)
      const posts = (response.data?.sessions?.[0]?.posts || []).slice(0, 10);

      if (posts.length > 0) {
        console.log('[MagicMode] ✅ Loaded', posts.length, 'posts from history for resume');

        // Convert to MagicPost format
        const magicPosts = posts.map((p: any) => {
          const platforms = typeof p.platforms_list === 'string'
            ? JSON.parse(p.platforms_list || '["LinkedIn"]')
            : (p.platforms_list || ['LinkedIn']);
          const mediaFiles = p.media_urls || [];

          return {
            id: p.id,
            title: p.caption ? (p.caption.substring(0, 50) + (p.caption.length > 50 ? '...' : '')) : 'Post',
            platform: platforms[0] || 'LinkedIn',
            imageOverlay: '',
            imageStyle: '',
            caption: p.caption || '',
            imageUrl: mediaFiles[0] || undefined,
            status: p.status === 'draft' ? 'ready' : p.status,
            approvedPlatforms: p.status === 'approved' ? platforms : undefined,
          };
        });

        store.setGeneratedPosts(magicPosts as any);
        store.setPipelineCompleted(true);
        setShowResumeWarning(false);
        setScreen('results');
      } else {
        console.log('[MagicMode] ⚠️ No posts found in history - clearing resume flag');
        // Clear localStorage flag if no posts found
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          localStorage.removeItem(`magic_has_posts_${userId}`);
        }
        setShowResumeWarning(false);
        store.reset();
        setScreen('url');
      }
    } catch (error) {
      console.error('[MagicMode] Failed to load posts for resume:', error);
      setShowResumeWarning(false);
      store.reset();
      setScreen('url');
    }
  }, [store, setScreen]);

  // Show resume warning for unfinished posts
  // ✅ FIX: Changed condition to allow showing even when store.generatedPosts is empty
  // (happens on page refresh - posts will be loaded when user clicks Resume)
  if (showResumeWarning) {
    const unfinished = store.generatedPosts.length > 0
      ? store.generatedPosts.filter((p) => p.status !== 'published' && p.status !== 'scheduled').length
      : 0;

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
              {store.generatedPosts.length > 0 ? 'Unfinished posts found' : 'Previous session found'}
            </h2>
            <p className="text-[15px] text-text-secondary">
              {store.generatedPosts.length > 0
                ? `You have ${unfinished} unfinished post${unfinished !== 1 ? 's' : ''} from your last session.`
                : 'You have posts from a previous Magic Mode session.'
              }
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                if (store.generatedPosts.length > 0) {
                  // Posts already loaded - go to results
                  setShowResumeWarning(false);
                  setScreen('results');
                } else {
                  // Posts not loaded - fetch from backend first
                  handleResumeFromFlag();
                }
              }}
              className="w-full py-3.5 rounded-[14px] text-[15px] font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              Resume where I left off
            </button>
            <button
              onClick={() => {
                setShowResumeWarning(false);
                // Clear localStorage flag
                const userId = useAuthStore.getState().user?.id;
                if (userId) {
                  localStorage.removeItem(`magic_has_posts_${userId}`);
                }
                store.reset();
                setScreen('url');
              }}
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

  // Show loading while checking for existing brand (prevents empty URL field flash)
  if (!checked && screen === 'url') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'rgb(var(--c-bg-primary))' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full border-4 animate-spin"
            style={{
              borderColor: 'rgba(232,54,79,0.2)',
              borderTopColor: 'rgb(232,54,79)',
            }}
          />
          <p className="text-[14px] text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  switch (screen) {
    case 'url':
      return <URLInputScreen onSubmit={handleURLSubmit} onSkip={handleURLSkip} initialUrl={existingBrand?.website_url} />;
    case 'questions':
      return (
        <AIQuestionsScreen
          onComplete={handleQuestionsComplete}
          onNext={handleQuestionsNext}
          onBack={handleQuestionsBack}
          onProductUpload={handleProductUpload}
          skipIndustry={store.skipInitialQuestions}
          startAtQuestion={store.returningFromProductUpload ? 4 : undefined}
        />
      );
    case 'product_upload':
      return <ProductUploadScreen onNext={handleProductUploadNext} onBack={handleProductUploadBack} />;
    case 'working':
      return <AIWorkingScreen onComplete={handleWorkingComplete} onStop={handleWorkingStop} />;
    case 'results':
      return <ResultsScreen onGenerateMore={handleGenerateMore} onGoBack={handleGoBack} />;
    default:
      return <URLInputScreen onSubmit={handleURLSubmit} onSkip={handleURLSkip} initialUrl={existingBrand?.website_url} />;
  }
}

export default MagicModePage;
