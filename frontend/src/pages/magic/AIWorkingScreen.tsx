import { useState, useEffect, useRef } from 'react';
import { useMagicModeStore, type MagicPost, type MagicCaptionData } from '../../store/magicModeStore';
import { useAuthStore } from '../../store';
import api from '../../services/api';
import strategyService from '../../services/strategyService';
import captionService from '../../services/captionService';
import imageService from '../../services/imageService';
import hashtagService from '../../services/hashtagService';
import visualPromptService from '../../services/visualPromptService';
import type { ContentIdea, CaptionTone, CaptionPlatform } from '../../types';
import { buildMagicCacheKey } from './cacheUtils';

const STEPS = [
  { emoji: '🌐', label: 'Reading your website', desc: 'Understanding your brand identity...', estimatedMs: 3000 },
  { emoji: '🧠', label: 'Building your brand profile', desc: 'Analyzing tone, audience, and services...', estimatedMs: 8000 },
  { emoji: '📈', label: 'Finding trending topics', desc: "Scanning what's hot in your industry...", estimatedMs: 8000 },
  { emoji: '💡', label: 'Generating content ideas', desc: 'Crafting ideas that match your brand...', estimatedMs: 10000 },
  { emoji: '✍️', label: 'Writing captions', desc: 'Creating engaging text for each post...', estimatedMs: 15000 },
  { emoji: '🎨', label: 'Designing images', desc: 'Building visuals for each post...', estimatedMs: 20000 },
  { emoji: '#️⃣', label: 'Generating hashtags', desc: 'Picking hashtags based on the image and caption...', estimatedMs: 8000 },
  { emoji: '✅', label: 'Final polish', desc: 'Making sure everything looks perfect...', estimatedMs: 1000 },
];

interface AIWorkingScreenProps{
  onComplete: () => void;
  onStop?: () => void;
}

export function AIWorkingScreen({ onComplete, onStop }: AIWorkingScreenProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const cancelledRef = useRef(false);
  const stepStartRef = useRef(Date.now());
  const rafRef = useRef<number>(0);
  const store = useMagicModeStore();

  // Animate step elapsed time
  useEffect(() => {
    stepStartRef.current = Date.now();
    setStepElapsed(0);

    const tick = () => {
      setStepElapsed(Date.now() - stepStartRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  useEffect(() => {
    cancelledRef.current = false;
    runPipeline();
    return () => { cancelledRef.current = true; };
  }, []);

  const runPipeline = async () => {
    try {
      // 🔄 Clear previous generation flag - we're generating fresh posts
      store.setHasPreviousGeneration(false);

      // Step 0: Get or create brand
      setStep(0);
      let brandId: number = 0;

      // Always fetch current user's brands to ensure brandId is valid for this user
      const res = await api.get('/brands/');
      const brands = Array.isArray(res.data) ? res.data : res.data.results || [];

      if (brands.length > 0) {
        // If stored brandId exists and belongs to current user, use it
        const storedBrandId = store.brandId;
        const storedBrand = storedBrandId ? brands.find((b: { id: number }) => b.id === storedBrandId) : null;

        if (storedBrand) {
          brandId = storedBrand.id;
        } else {
          // Stored brandId invalid/stale - use user's primary brand or first brand
          const primary = brands.find((b: { is_primary: boolean }) => b.is_primary) || brands[0];
          brandId = primary.id;
        }
        store.setBrandId(brandId);
      } else {
        // No brands exist - create one
        // Use custom industry if "Other" was selected, otherwise use selected option
        const customIndustry = store.customAnswers?.industry_other;
        const industryValue = customIndustry ||
          (store.answers.industry ? String(store.answers.industry) : 'My Brand');

        const brandRes = await api.post('/brands/', {
          brand_name: industryValue,
          industry: industryValue,
          target_region: store.answers.region ? String(store.answers.region) : 'Global',
          website_url: store.websiteUrl || '',
          is_primary: true,
        });
        brandId = brandRes.data.id;
        store.setBrandId(brandId);
      }
      if (cancelledRef.current) return;

      // Upload logo if provided (non-blocking — best effort)
      let brandLogoId: number | null = null;
      if (store.logoFile) {
        try {
          // 1. PATCH brand with logo
          const logoForm = new FormData();
          logoForm.append('logo', store.logoFile);
          await api.patch(`/brands/${brandId}/`, logoForm);

          // 2. Create BrandAsset for image generation
          const assetForm = new FormData();
          assetForm.append('brand', String(brandId));
          assetForm.append('file', store.logoFile);
          assetForm.append('asset_type', 'logo');
          assetForm.append('name', 'Brand Logo');
          const assetRes = await api.post('/brand-assets/', assetForm);
          brandLogoId = assetRes.data?.id || null;
        } catch {
          // Non-fatal — continue without logo
        }
      }
      if (cancelledRef.current) return;

      // Step 1: Generate DNA (if URL provided, not skipped, and brand has no existing DNA)
      setStep(1);
      if (store.websiteUrl && !store.skipDNAGeneration) {
        try {
          // Check if brand already has DNA before generating to avoid duplicate work
          const brandDetail = await api.get(`/brands/${brandId}/`);
          const existingDNA = brandDetail.data?.brand_dna;
          const hasDNA = existingDNA && typeof existingDNA === 'object' && Object.keys(existingDNA).length > 0;

          if (hasDNA) {
            console.log('[AIWorkingScreen] Brand already has DNA - skipping regeneration');
          } else {
            console.log('[AIWorkingScreen] Generating DNA for brand:', brandId);
            await strategyService.generateDNA(brandId, store.websiteUrl);
          }
        } catch {
          // Non-fatal — continue without DNA
        }
      } else if (store.skipDNAGeneration) {
        console.log('[AIWorkingScreen] Skipping DNA generation - skipDNAGeneration flag set');
      }
      if (cancelledRef.current) return;

      // Step 2: Generate trending topics
      setStep(2);
      let trendingTopics: string[] = [];
      try {
        const trendResult = await strategyService.generateTrending(brandId);
        const topics = trendResult.topics || trendResult || [];
        trendingTopics = topics.slice(0, 5).map((t: { topic: string }) => t.topic);
        store.setTrendingTopics(trendingTopics);
      } catch {
        // Non-fatal — continue without trending
      }
      if (cancelledRef.current) return;

      // Step 3: Generate content ideas
      setStep(3);
      const count = store.postCount || 2;
      const ideasResult = await strategyService.generateIdeas({
        brand_id: brandId,
        count,
        trending_topics: trendingTopics.length > 0 ? trendingTopics : undefined,
      });
      const ideas: ContentIdea[] = ideasResult.ideas || ideasResult || [];
      store.setIdeasData(
        ideas.map((i) => ({
          id: i.id,
          title: i.title,
          hook: i.hook || '',
          angle: i.angle || '',
          platform: i.platform || '',
          content_format: i.content_format || '',
        }))
      );
      if (cancelledRef.current) return;

      // Step 4: Generate captions for each idea
      setStep(4);
      const toneMap: Record<string, CaptionTone> = {
        'professional & authoritative': 'professional',
        'friendly & approachable': 'friendly',
        'bold & provocative': 'enthusiastic',
        'educational & helpful': 'formal',
        'fun & casual': 'casual',
      };
      const toneAnswer = store.answers.tone ? String(store.answers.tone).toLowerCase() : '';
      const captionTone: CaptionTone = toneMap[toneAnswer] || 'professional';
      // Build user-selected platforms list — enforce these instead of backend's idea.platform
      const rawPlatforms = store.answers.platforms;
      const userPlatforms: CaptionPlatform[] = Array.isArray(rawPlatforms) && rawPlatforms.length > 0
        ? rawPlatforms.map((p: string) => p.replace(' / X', '').toLowerCase() as CaptionPlatform)
        : [];

      const posts: MagicPost[] = [];
      const captionsAccum: MagicCaptionData[] = [];
      const slicedIdeas = ideas.slice(0, count);
      for (let idx = 0; idx < slicedIdeas.length; idx++) {
        const idea = slicedIdeas[idx];
        if (cancelledRef.current) return;

        // Use user's selected platform(s) via round-robin; fall back to idea.platform or 'linkedin'
        const captionPlatform: CaptionPlatform = userPlatforms.length > 0
          ? userPlatforms[idx % userPlatforms.length]
          : (idea.platform?.toLowerCase() as CaptionPlatform) || 'linkedin';
        const displayPlatform = captionPlatform.charAt(0).toUpperCase() + captionPlatform.slice(1);

        try {
          const caption = await captionService.generate({
            topic: idea.title + (idea.hook ? ': ' + idea.hook : ''),
            tone: captionTone,
            length: 'medium',
            platform: captionPlatform,
            include_hashtags: true,
            include_emojis: true,
            include_cta: true,
          });

          // 🆕 The caption API returns hashtags in a SEPARATE field
          // (`generated_hashtags`) — merge them into the caption text now so
          // the final post.caption already carries the hashtags. Mirrors the
          // pattern in MagicHistoryPage.tsx:337-341 and VideoResultScreen.tsx:227.
          const generatedBody = (caption.generated_caption || '').trim();
          const generatedHashtags = (caption.generated_hashtags || '').trim();
          const mergedCaption = generatedHashtags && !generatedBody.includes('#')
            ? `${generatedBody}\n\n${generatedHashtags}`
            : generatedBody;

          posts.push({
            id: idea.id,
            title: idea.title,
            platform: displayPlatform,
            imageOverlay: idea.title,
            imageStyle: idea.hook || idea.angle || '',
            caption: mergedCaption,
            status: 'ready' as const,
            captionId: caption.id,
            ideaId: idea.id,
          });
          captionsAccum.push({
            captionId: caption.id,
            ideaId: idea.id,
            text: mergedCaption,
            platform: captionPlatform,
          });
        } catch {
          // Skip failed caption generation, still include the idea
          posts.push({
            id: idea.id,
            title: idea.title,
            platform: displayPlatform,
            imageOverlay: idea.title,
            imageStyle: idea.hook || idea.angle || '',
            caption: idea.hook || 'Caption could not be generated. Click "Give feedback" to retry.',
            status: 'ready' as const,
            ideaId: idea.id,
          });
        }
      }
      store.setCaptionsData(captionsAccum);
      if (cancelledRef.current) return;

      // Step 5: Generate images for each post
      setStep(5);

      // Copy/text-overlay toggle (from the `include_copy` magic-mode question).
      // "Yes" → backend appends an instruction to render copy into the image.
      // "No"  → backend appends an instruction to produce zero text/letters.
      const copyAnswer = store.answers.include_copy;
      const wantsCopy =
        (Array.isArray(copyAnswer) ? copyAnswer[0] : copyAnswer || '')
          .toString()
          .toLowerCase()
          .startsWith('yes');

      // Build brand-color hint to inject into every image prompt.
      // Drops the "Custom color" placeholder label and substitutes the user's
      // typed value from customAnswers.colors_other.
      const colorsAnswer = store.answers.colors;
      const selectedColors = Array.isArray(colorsAnswer)
        ? colorsAnswer
        : (colorsAnswer ? [String(colorsAnswer)] : []);
      const customColorText = (store.customAnswers?.colors_other || '').trim();
      const colorChoices = selectedColors.filter((c) => c !== 'Custom color');
      if (customColorText) colorChoices.push(customColorText);
      const colorHint = colorChoices.length > 0
        ? ` Use the following brand color palette in the visual design: ${colorChoices.join(', ')}.`
        : '';

      // Check if user selected product mode
      const productMode = store.answers.product_mode;
      const useProductImages = Array.isArray(productMode)
        ? productMode[0] === 'Yes - I have product images'
        : productMode === 'Yes - I have product images';

      // 🆕 Get product images from the new multi-product store structure
      const selectedProducts = store.products.filter(p => store.selectedProductIds.includes(p.id) && p.images.length > 0);
      
      const hasLegacyImages = store.productImages.length > 0;
      const hasNewProducts = selectedProducts.length > 0;

      // Lifted so step 6 (hashtag generation) can also read product context
      // for each post — same array, no double-build.
      const availableProductData: Array<{ file: File, type: string, features: string, background: string }> = [];

      if (useProductImages && (hasLegacyImages || hasNewProducts)) {
        // PRODUCT-BASED IMAGE GENERATION

        // Flatten all available images into a unified array with metadata

        // Add new products
        if (hasNewProducts) {
          selectedProducts.forEach(p => {
            p.images.forEach(img => {
              availableProductData.push({
                file: img,
                type: p.title || store.productAnswers.type || 'product',
                features: p.description || store.productAnswers.features || '',
                background: store.productAnswers.customBackground || store.productAnswers.background || 'clean'
              });
            });
          });
        }

        // Add legacy images if present
        if (hasLegacyImages) {
          store.productImages.forEach(img => {
            availableProductData.push({
              file: img,
              type: store.productAnswers.type || 'product',
              features: store.productAnswers.features || '',
              background: store.productAnswers.customBackground || store.productAnswers.background || 'clean'
            });
          });
        }

        console.log('[AIWorkingScreen] Using product-based image generation with', availableProductData.length, 'product images');

        for (let i = 0; i < posts.length; i++) {
          if (cancelledRef.current) return;
          try {
            const post = posts[i];
            // Use product images in round-robin fashion
            const productData = availableProductData[i % availableProductData.length];
            const productImage = productData.file;

            // Build prompt incorporating product details
            const productType = productData.type;
            const productFeatures = productData.features;
            const backgroundStyle = productData.background;

            const fallbackProductPrompt = `Professional empty ${backgroundStyle} photography studio background for a social media post about "${post.title}". The background setting should complement a ${productType} with features: ${productFeatures}. The visual style is ${post.imageStyle}.${colorHint} IMPORTANT: The center of the image must be completely empty as a product will be placed there. Do NOT generate the product itself.`;

            // 🆕 Ask the backend to synthesise brand DNA + idea + caption +
            // trending into one focused prompt. Falls back to the template
            // literal if the LLM call fails.
            const richProductPrompt = await visualPromptService.buildImagePrompt({
              brand_id: brandId,
              idea: { title: post.title, hook: post.imageStyle, platform: post.platform.toLowerCase() },
              caption: post.caption || captionsAccum[i]?.text || '',
              platform: post.platform.toLowerCase(),
              color_choices: colorChoices,
              trending_topics: trendingTopics,
              image_style_hint: post.imageStyle,
              with_copy: wantsCopy,
              copy_text: wantsCopy ? post.title : undefined,
              product_context: {
                product_type: productType,
                features: productFeatures,
                background_style: backgroundStyle,
              },
            });
            const productPrompt = richProductPrompt || fallbackProductPrompt;

            const imgReq: Parameters<typeof imageService.generate>[0] = {
              prompt: productPrompt,
              title: post.title,
              provider: 'gemini',
              style: 'modern',
              enhance_prompt: true,
              product_image: productImage,
              product_type: productType,
              background_style: backgroundStyle,
              analyze_product_style: true,
              match_product_style: true,
              product_position: 'center_bottom',  // ✅ FIX: Place product on table/surface instead of floating
              product_scale: 1.0,
              with_copy: wantsCopy,
            };
            if (wantsCopy) imgReq.copy_text = post.title;

            if (brandLogoId) {
              imgReq.brand_logo_id = brandLogoId;
              imgReq.logo_position = 'bottom_right';
            }

            const imgResult = await imageService.generate(imgReq);
            const imgUrl = imgResult.image_url || imgResult.generated_image_with_logo || imgResult.generated_image || imgResult.composited_image;
            if (imgUrl) {
              posts[i] = { ...post, imageUrl: imgUrl };
            }
          } catch (error) {
            console.error('[AIWorkingScreen] Product image generation failed:', error);
            // Non-fatal — post will show placeholder with generate button
          }
        }
      } else {
        // AI-ONLY IMAGE GENERATION (Current flow)
        console.log('[AIWorkingScreen] Using AI-only image generation');

        for (let i = 0; i < posts.length; i++) {
          if (cancelledRef.current) return;
          try {
            const post = posts[i];
            const fallbackAiPrompt = `Create a professional social media image for: "${post.title}". ${post.imageStyle}${colorHint}`;

            // 🆕 Synthesise brand DNA + idea + caption + trending into a
            // focused prompt. Falls back to the template literal if the
            // LLM call fails.
            const richAiPrompt = await visualPromptService.buildImagePrompt({
              brand_id: brandId,
              idea: { title: post.title, hook: post.imageStyle, platform: post.platform.toLowerCase() },
              caption: post.caption || captionsAccum[i]?.text || '',
              platform: post.platform.toLowerCase(),
              color_choices: colorChoices,
              trending_topics: trendingTopics,
              image_style_hint: post.imageStyle,
              with_copy: wantsCopy,
              copy_text: wantsCopy ? post.title : undefined,
            });
            const imgReq: Parameters<typeof imageService.generate>[0] = {
              prompt: richAiPrompt || fallbackAiPrompt,
              title: post.title,
              provider: 'gemini',
              style: 'modern',
              enhance_prompt: true,
              with_copy: wantsCopy,
            };
            if (wantsCopy) imgReq.copy_text = post.title;
            if (brandLogoId) {
              imgReq.brand_logo_id = brandLogoId;
              imgReq.logo_position = 'bottom_right';
            }
            const imgResult = await imageService.generate(imgReq);
            const imgUrl = imgResult.generated_image_with_logo || imgResult.generated_image || imgResult.composited_image;
            if (imgUrl) {
              posts[i] = { ...post, imageUrl: imgUrl };
            }
          } catch {
            // Non-fatal — post will show placeholder with generate button
          }
        }
      }

      if (cancelledRef.current) return;

      // 💾 Save posts to database (database = single source of truth)
      console.log('[AIWorkingScreen] Saving posts to database...');
      const savedPostIds: number[] = [];

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        try {
          const response = await api.post('/posts/', {
            caption: post.caption,
            media_files: JSON.stringify(post.imageUrl ? [post.imageUrl] : []),
            platforms: JSON.stringify([post.platform.toLowerCase()]),
            source: 'magic',
            status: 'draft',
            brand: brandId,
          });

          // Update post with real database ID
          posts[i].id = response.data.id;
          savedPostIds.push(response.data.id);
          console.log(`[AIWorkingScreen] Saved post ${i + 1}/${posts.length} (ID: ${response.data.id})`);
        } catch (err) {
          console.error('[AIWorkingScreen] Failed to save post:', post.title, err);
          // Continue with next post - don't let one failure block others
        }
      }

      // 🗃️ Save cache mapping to enable "Previous Posts" button reuse
      // CRITICAL FIX: Use unified cache key + include userId + set flag ONLY on success
      if (savedPostIds.length > 0) {
        try {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) {
            throw new Error('No user ID available for cache save');
          }

          // ✅ Use unified cache key generation (matches MagicModePage lookup)
          const { cacheKey } = buildMagicCacheKey(store.answers, store.customAnswers, userId);

          // ✅ Include userId in URL for backend validation
          await api.post(`/magic/posts/${userId}/${cacheKey}/`, {
            post_ids: savedPostIds,
          });

          console.log(`[AIWorkingScreen] ✅ Cache saved: ${cacheKey} → ${savedPostIds.length} posts`);

          // ✅ ONLY set flag AFTER successful cache save
          store.setHasPreviousGeneration(true);
          console.log(`[AIWorkingScreen] hasPreviousGeneration = true (cache saved successfully)`);
        } catch (err) {
          console.error('[AIWorkingScreen] ❌ Failed to save cache:', err);
          // ✅ Ensure flag is false on failure - no "Previous Posts" button if cache failed
          store.setHasPreviousGeneration(false);
        }
      }

      // Step 6: Generate hashtags for each saved post (based on idea +
      // trending themes + product + AI-generated caption + media), then
      // append them to the caption text so they're visible on the result
      // card and persist through to publishing.
      setStep(6);
      for (let i = 0; i < posts.length; i++) {
        if (cancelledRef.current) return;
        const post = posts[i];
        const postId = typeof post.id === 'number' ? post.id : Number(post.id);
        if (!postId || !savedPostIds.includes(postId)) continue;

        const platform = (post.platform || 'instagram')
          .toLowerCase()
          .replace(' / x', '')
          .replace('twitter / x', 'twitter');

        // If this batch used product mode, surface the same product
        // metadata we used at image-gen time so the LLM can pick
        // product-relevant tags too.
        const prodCtx = useProductImages && availableProductData.length > 0
          ? (() => {
              const pd = availableProductData[i % availableProductData.length];
              return {
                product_type: pd.type,
                features: pd.features,
                background_style: pd.background,
              };
            })()
          : undefined;

        try {
          const result = await hashtagService.generateHashtags(postId, {
            platform,
            topic: post.title,
            idea: { title: post.title, hook: post.imageStyle, angle: post.imageStyle },
            trending_topics: trendingTopics,
            product_context: prodCtx,
          });

          // 🆕 Append the chosen hashtags to the caption so users see them
          // on the result card. Skip if the caption already contains '#'
          // (caption-side hashtags from the caption generator) to avoid
          // duplication.
          const tags: { tag?: string }[] = (result && result.hashtags) || [];
          const tagLine = tags
            .map((t) => '#' + ((t.tag || '').replace(/^#+/, '').trim()))
            .filter((s) => s.length > 1)
            .join(' ');

          if (tagLine && !post.caption.includes('#')) {
            const newCaption = `${post.caption}\n\n${tagLine}`;
            posts[i] = { ...post, caption: newCaption };
            // Persist to backend so reloads / Magic History show the same text.
            try {
              await api.patch(`/posts/${postId}/`, { caption: newCaption });
            } catch (e) {
              console.warn('[AIWorkingScreen] Failed to persist hashtag-enriched caption:', e);
            }
            // Keep the magic-store captions cache in sync for downstream consumers.
            const cIdx = captionsAccum.findIndex((c) => c.captionId === posts[i].captionId);
            if (cIdx !== -1) captionsAccum[cIdx] = { ...captionsAccum[cIdx], text: newCaption };
          }
        } catch (err) {
          console.warn('[AIWorkingScreen] Hashtag generation failed for post', postId, err);
        }
      }
      // Refresh the store's captions snapshot with the appended hashtags
      // so any later consumer reads the hashtag-enriched version.
      store.setCaptionsData(captionsAccum);
      if (cancelledRef.current) return;

      // Step 7: Finalize
      setStep(7);
      store.setGeneratedPosts(posts);
      store.setPipelineCompleted(true);

      // ✅ Only set in-memory pipeline completion flag
      // localStorage flag will be set by ResultsScreen on beforeunload if posts are unfinished
      console.log('[AIWorkingScreen] ✅ Generation complete, navigating to results');

      // Brief pause so user sees the final step
      await new Promise((r) => setTimeout(r, 800));
      if (cancelledRef.current) return;

      onComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err as Error)?.message
        || 'Something went wrong. Please try again.';
      setError(msg);
    }
  };

  const handleRetry = () => {
    setError(null);
    setStep(0);
    runPipeline();
  };

  const handleStopConfirm = () => {
    cancelledRef.current = true;
    setShowStopConfirm(false);
    onStop?.();
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  // Compute mini progress for each step
  const getStepProgress = (i: number): number => {
    if (i < step) return 100;
    if (i > step) return 0;
    // Active step: fill based on elapsed time, cap at 95%
    const est = STEPS[i].estimatedMs;
    return Math.min(95, (stepElapsed / est) * 100);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-10 relative"
      style={{ background: 'rgb(var(--c-bg-primary))' }}
    >
      {/* Ambient bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(232,54,79,0.05), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(59,130,246,0.05), transparent 60%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-[520px] w-full">
        {/* Error state */}
        {error ? (
          <>
            <div className="text-[64px] mb-4">❌</div>
            <h2 className="text-[24px] font-extrabold text-text-primary text-center mb-2">
              Something went wrong
            </h2>
            <p className="text-[14px] text-text-secondary text-center mb-6 max-w-[400px]">
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 rounded-[14px] text-[15px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                boxShadow: 'var(--shadow-glow-coral)',
              }}
            >
              Try Again
            </button>
          </>
        ) : (
          <>
            {/* Thinking dots */}
            <div className="flex items-center gap-2 mb-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: 'rgb(var(--c-coral))',
                    animation: 'pulseDot 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>

            {/* Current step label */}
            <h2 className="text-[22px] font-extrabold text-text-primary text-center mb-1 pop" key={`label-${step}`}>
              {current.label}
            </h2>
            <p className="text-[14px] text-text-secondary text-center mb-6 pop" key={`desc-${step}`}>
              {current.desc}
            </p>

            {/* Terminal-style step log */}
            <div
              className="w-full rounded-[16px] p-4 mb-6"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="space-y-1">
                {STEPS.map((s, i) => {
                  const isDone = i < step;
                  const isActive = i === step;
                  const sp = getStepProgress(i);

                  return (
                    <div key={s.label}>
                      <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg" style={{
                        background: isActive ? 'rgba(232,54,79,0.06)' : 'transparent',
                      }}>
                        {/* Status indicator */}
                        <div className="w-5 text-center flex-shrink-0">
                          {isDone ? (
                            <span className="text-[13px]" style={{ color: 'rgb(var(--c-green))' }}>✓</span>
                          ) : isActive ? (
                            <div
                              className="w-2.5 h-2.5 mx-auto rounded-full"
                              style={{
                                background: 'rgb(var(--c-coral))',
                                animation: 'pulseDot 1.4s ease-in-out infinite',
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-text-muted">○</span>
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className="text-[13px] flex-1"
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                            fontWeight: isDone || isActive ? 500 : 400,
                            color: isDone
                              ? 'rgb(var(--c-green))'
                              : isActive
                                ? 'rgb(var(--c-text-primary))'
                                : 'rgba(var(--c-text-muted), 0.5)',
                          }}
                        >
                          {'> '}{s.label}
                        </span>

                        {/* Time estimate for active step */}
                        {isActive && (
                          <span className="text-[11px] text-text-muted tabular-nums">
                            ~{Math.max(1, Math.ceil((s.estimatedMs - stepElapsed) / 1000))}s
                          </span>
                        )}
                      </div>

                      {/* Sub-description for active step */}
                      {isActive && (
                        <div className="pl-10 pb-1">
                          <span
                            className="text-[12px] slide-up"
                            style={{
                              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                              color: 'rgb(var(--c-text-muted))',
                            }}
                          >
                            {s.desc}
                          </span>
                        </div>
                      )}

                      {/* Mini progress bar for active step */}
                      {isActive && (
                        <div
                          className="mx-2 mb-1 overflow-hidden"
                          style={{
                            height: 2,
                            borderRadius: 1,
                            background: 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${sp}%`,
                              borderRadius: 1,
                              background: 'linear-gradient(90deg, rgb(var(--c-coral)), rgb(var(--c-coral-hover)))',
                              transition: 'width 0.5s linear',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main progress bar */}
            <div className="w-full mb-6">
              <div
                className="w-full overflow-hidden"
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, rgb(var(--c-coral)), rgb(var(--c-purple)), rgb(var(--c-blue)))',
                    backgroundSize: '300% 100%',
                    animation: 'gradientShift 3s ease-in-out infinite',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[12px] text-text-muted">
                  Step {step + 1} of {STEPS.length}
                </span>
                <span className="text-[12px] font-semibold" style={{ color: 'rgb(var(--c-coral))' }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            {/* Stop button */}
            {onStop && (
              <button
                onClick={() => setShowStopConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgb(var(--c-text-secondary))',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="2" y="2" width="8" height="8" rx="1.5" />
                </svg>
                Stop Generating
              </button>
            )}
          </>
        )}
      </div>

      {/* Stop confirmation popup */}
      {showStopConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-[400px] rounded-[20px] p-7 scale-in"
            style={{
              background: 'rgb(var(--c-bg-elevated))',
              border: '1px solid var(--border-color)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="text-center mb-5">
              <div className="text-[44px] mb-3">⚠️</div>
              <h3 className="text-[20px] font-extrabold text-text-primary mb-2">
                Stop generating?
              </h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Your progress will be lost and you'll need to start over.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStopConfirm}
                className="flex-1 py-3 rounded-[12px] text-[14px] font-bold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                }}
              >
                Yes, stop
              </button>
              <button
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 py-3 rounded-[12px] text-[14px] font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'rgb(var(--c-text-secondary))',
                }}
              >
                No, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIWorkingScreen;
