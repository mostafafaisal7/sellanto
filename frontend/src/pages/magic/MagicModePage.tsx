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

// Question options in order (must match AIQuestionsScreen.tsx QUESTIONS array)
const QUESTION_OPTIONS = {
  industry: ['Digital Marketing Agency', 'E-commerce / Online Store', 'SaaS / Software Company', 'Local Service Business', 'Consulting / Freelancing', 'Other'],
  goal: ['Get more customers / leads', 'Build brand awareness', 'Drive website traffic', 'Establish thought leadership', 'Showcase products / services'],
  tone: ['Professional & Authoritative', 'Friendly & Approachable', 'Bold & Provocative', 'Educational & Helpful', 'Fun & Casual'],
  platforms: ['LinkedIn', 'Instagram', 'Facebook', 'Twitter / X', 'TikTok'],
  colors: ['Blue tones (trust, professional)', 'Red/Orange (energy, bold)', 'Green (growth, nature)', 'Purple (creative, premium)', 'Dark/Minimal (sleek, modern)', 'Use colors from my website'],
};

/**
 * Encode user answers to numerical indices for cache key
 * Example: { industry: ['E-commerce / Online Store', 'Local Service Business'] } → "24"
 * Example: { tone: ['Professional & Authoritative'] } → "1"
 */
function encodeAnswersToIndices(answers: Record<string, string | string[]>): Record<string, string> {
  const encoded: Record<string, string> = {};

  Object.keys(QUESTION_OPTIONS).forEach((questionId) => {
    const answer = answers[questionId];
    const options = QUESTION_OPTIONS[questionId as keyof typeof QUESTION_OPTIONS];

    if (!answer) {
      encoded[questionId] = '0'; // No selection
      return;
    }

    const selectedValues = Array.isArray(answer) ? answer : [answer];
    const indices: number[] = [];

    selectedValues.forEach((value) => {
      const index = options.indexOf(value);
      if (index !== -1) {
        indices.push(index + 1); // 1-based indexing
      }
    });

    // Sort and join (e.g., [1, 3, 2] → "123")
    encoded[questionId] = indices.sort((a, b) => a - b).join('');
    if (!encoded[questionId]) {
      encoded[questionId] = '0'; // Fallback if no valid indices
    }
  });

  return encoded;
}

/**
 * Save Magic Mode cache entry
 * Exported so ResultsScreen can call this after creating posts
 */
export async function saveMagicModeCache(answers: Record<string, string | string[]>, postIds: number[]) {
  const encoded = encodeAnswersToIndices(answers);
  const cacheKey = `${encoded.industry}/${encoded.goal}/${encoded.tone}/${encoded.platforms}/${encoded.colors}`;

  console.log('[MagicMode] Saving cache with key:', cacheKey, 'post IDs:', postIds);

  try {
    const { api } = await import('../../services');
    const response = await api.post(`/magic/posts/${cacheKey}/`, { post_ids: postIds });
    console.log('[MagicMode] Cache saved successfully:', response.data);
    return true;
  } catch (error) {
    console.error('[MagicMode] Failed to save cache:', error);
    return false;
  }
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
            brand_dna: primary.brand_dna || {},
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

    // Pre-fill URL and brand ID
    setUrl(existingBrand.website_url);
    setBrandId(existingBrand.id);

    setSkipInitialQuestions(false); // Let user see and confirm the questions
    setShowPopup(false);
    setScreen('questions'); // Go to questions screen with pre-filled data
  }, [existingBrand, setUrl, setAnswer, setSkipInitialQuestions, setBrandId, setScreen, store]);

  const handleStartFresh = useCallback(() => {
    store.reset(); // Clear all stored data
    setShowPopup(false);
    setScreen('url');
  }, [store, setScreen]);

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

  const handleQuestionsNext = useCallback(async () => {
    // Try to load cached posts based on current answer combination
    const encoded = encodeAnswersToIndices(store.answers);
    const cacheKey = `${encoded.industry}/${encoded.goal}/${encoded.tone}/${encoded.platforms}/${encoded.colors}`;

    console.log('[MagicMode] Looking up cached posts with key:', cacheKey);

    try {
      const { api } = await import('../../services');
      const response = await api.get(`/magic/posts/${cacheKey}/`);

      if (response.data && response.data.posts && response.data.posts.length > 0) {
        console.log('[MagicMode] Cache HIT - Loading', response.data.posts.length, 'existing posts');
        // Convert backend posts to MagicPost format
        const posts = response.data.posts.map((p: any) => ({
          id: p.id,
          title: p.title || 'Post',
          platform: Array.isArray(p.platforms) ? p.platforms[0] : JSON.parse(p.platforms || '["LinkedIn"]')[0],
          imageOverlay: p.image_overlay || '',
          imageStyle: p.image_style || '',
          caption: p.caption || '',
          imageUrl: Array.isArray(p.media_files) ? p.media_files[0] : JSON.parse(p.media_files || '[]')[0],
          status: p.status === 'draft' ? 'ready' : p.status,
          approvedPlatforms: p.status === 'approved' ? p.platforms : undefined,
        }));

        store.setGeneratedPosts(posts);
        store.setHasPreviousGeneration(true);
        setScreen('results');
      } else {
        console.log('[MagicMode] Cache MISS - Generating new posts');
        // No cached posts, need to generate
        setScreen('working');
      }
    } catch (error) {
      console.error('[MagicMode] Cache lookup failed:', error);
      // On error, generate new posts
      setScreen('working');
    }
  }, [store, setScreen]);

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
          onNext={handleQuestionsNext}
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
