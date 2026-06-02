import { create } from 'zustand';
// 🔒 SECURITY FIX: Removed persist middleware to prevent localStorage data leakage
// All Magic Mode data now stored in database only

export interface MagicPost {
  id: number;
  title: string;
  platform: string;
  imageOverlay: string;
  imageStyle: string;
  caption: string;
  status: 'ready' | 'approved' | 'published' | 'scheduled';
  feedback?: Record<string, string>;
  imageUrl?: string;
  captionId?: number;
  ideaId?: number;
  scheduledTime?: string;
  approvedPlatforms?: string[];
  platformCaptions?: Record<string, string>;
  deletedPlatforms?: string[];
  magic_draft_id?: number; // 🔗 Database link to Draft post for "Add to Calendar" flow
}

export interface Product {
  id: string; // Unique ID for each product
  images: File[];
  title: string;
  description?: string;
  quantity?: string;
  price?: string;
}

export interface CustomQA {
  id: string;
  question: string;
  answer: string;
}

export interface ProductAnswers {
  type?: string;
  features?: string;
  background?: string;
  customBackground?: string; // Custom background prompt from user
}

export interface MagicIdeaData {
  id: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  content_format: string;
}

export interface MagicCaptionData {
  captionId: number;
  ideaId: number;
  text: string;
  platform: string;
}

interface MagicModeState {
  screen: 'mode' | 'url' | 'questions' | 'product_upload' | 'video_prompt' | 'video_working' | 'video_result' | 'working' | 'results';
  websiteUrl: string;
  answers: Record<string, string | string[]>;
  customAnswers: Record<string, string>; // NEW: Store custom "Other" text values
  generatedPosts: MagicPost[];
  feedbackModal: { postId: number; answers: Record<string, string> } | null;
  postCount: number;
  brandId: number | null;
  skipInitialQuestions: boolean;
  loading: boolean;
  error: string | null;
  hasPreviousGeneration: boolean;

  // Logo (not persisted — File objects can't be serialized)
  logoFile: File | null;

  // Product upload (not persisted — File objects can't be serialized)
  productImages: File[]; // Legacy - keeping for backward compatibility
  productAnswers: ProductAnswers;

  // New multi-product structure
  products: Product[];
  selectedProductIds: string[]; // IDs of products selected for AI training
  customQAs: CustomQA[];

  // Intermediate pipeline data (for Overflow bridge)
  trendingTopics: string[];
  ideasData: MagicIdeaData[];
  captionsData: MagicCaptionData[];
  pipelineCompleted: boolean;

  // Smart regeneration tracking
  originalAnswers: Record<string, string | string[]>;
  originalCustomAnswers: Record<string, string>; // Track original custom "Other" text values
  answersChanged: boolean;

  // Product upload flow tracking
  returningFromProductUpload: boolean;

  // DNA generation control
  skipDNAGeneration: boolean;

  // Video pending generation (set by VideoPromptScreen, consumed by VideoWorkingScreen)
  videoPending: { prompt: string; style: string; duration: number; referenceImage?: File } | null;

  // Video result (kept separate from generatedPosts — video is a single file, not a list of image posts)
  // videoPrompt/brandId/idea/trendingTopics carry the SAME rich context the video was
  // generated from, so the caption can be written to match the video (not the raw seed).
  videoResult: {
    videoUrl: string;
    generationId: number;
    prompt: string;
    style: string;
    videoPrompt?: string;
    brandId?: number | null;
    idea?: { title?: string; hook?: string; angle?: string } | null;
    trendingTopics?: string[];
  } | null;

  setScreen: (screen: MagicModeState['screen']) => void;
  setUrl: (url: string) => void;
  setLogoFile: (file: File | null) => void;
  setAnswer: (questionId: string, answer: string | string[]) => void;
  setCustomAnswer: (key: string, customValue: string) => void; // NEW
  setGeneratedPosts: (posts: MagicPost[]) => void;
  approvePost: (id: number) => void;
  resetPostStatus: (id: number) => void;
  openFeedback: (postId: number) => void;
  closeFeedback: () => void;
  answerFeedback: (questionId: string, answer: string) => void;
  setPostCount: (count: number) => void;
  setBrandId: (id: number) => void;
  setSkipInitialQuestions: (skip: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasPreviousGeneration: (value: boolean) => void;
  setTrendingTopics: (topics: string[]) => void;
  setIdeasData: (ideas: MagicIdeaData[]) => void;
  setCaptionsData: (captions: MagicCaptionData[]) => void;
  setPipelineCompleted: (completed: boolean) => void;
  setOriginalAnswers: (answers: Record<string, string | string[]>) => void;
  setOriginalCustomAnswers: (customAnswers: Record<string, string>) => void;
  markAnswersChanged: () => void;
  resetAnswersChanged: () => void;
  // Legacy product actions (keeping for backward compatibility)
  setProductImages: (images: File[]) => void;
  addProductImageLegacy: (image: File) => void;
  removeProductImageLegacy: (index: number) => void;
  setProductAnswer: (key: keyof ProductAnswers, value: string) => void;
  clearProductData: () => void;
  setReturningFromProductUpload: (value: boolean) => void;

  // New multi-product actions
  addProduct: () => void;
  removeProduct: (productId: string) => void;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  addProductImage: (productId: string, image: File) => void;
  removeProductImage: (productId: string, imageIndex: number) => void;
  toggleProductSelection: (productId: string) => void;
  addCustomQA: () => void;
  removeCustomQA: (qaId: string) => void;
  updateCustomQA: (qaId: string, updates: Partial<CustomQA>) => void;
  setSkipDNAGeneration: (skip: boolean) => void;
  setVideoPending: (pending: MagicModeState['videoPending']) => void;
  setVideoResult: (result: MagicModeState['videoResult']) => void;

  reset: () => void;
}

export const useMagicModeStore = create<MagicModeState>()((set) => ({
      screen: 'url',  // Start with URL screen to allow brand loading and popup
      websiteUrl: '',
      answers: {},
      customAnswers: {}, // NEW
      generatedPosts: [],
      feedbackModal: null,
      postCount: 2,
      brandId: null,
      skipInitialQuestions: false,
      loading: false,
      error: null,
      hasPreviousGeneration: false,
      logoFile: null,
      productImages: [],
      productAnswers: {},
      products: [],
      selectedProductIds: [],
      customQAs: [],
      trendingTopics: [],
      ideasData: [],
      captionsData: [],
      pipelineCompleted: false,
      originalAnswers: {},
      originalCustomAnswers: {},
      answersChanged: false,
      returningFromProductUpload: false,
      skipDNAGeneration: false,
      videoPending: null,
      videoResult: null,

      setScreen: (screen) => set({ screen }),
      setUrl: (websiteUrl) => set({ websiteUrl }),
      setLogoFile: (logoFile) => set({ logoFile }),
      setAnswer: (questionId, answer) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),
      setCustomAnswer: (key, customValue) => // NEW
        set((state) => ({ customAnswers: { ...state.customAnswers, [key]: customValue } })),
      setGeneratedPosts: (generatedPosts) => set({ generatedPosts, hasPreviousGeneration: true }),
      approvePost: (id) =>
        set((state) => ({
          generatedPosts: state.generatedPosts.map((p) =>
            p.id === id ? { ...p, status: 'approved' as const } : p
          ),
        })),
      resetPostStatus: (id) =>
        set((state) => ({
          generatedPosts: state.generatedPosts.map((p) =>
            p.id === id ? { ...p, status: 'ready' as const } : p
          ),
        })),
      openFeedback: (postId) =>
        set({ feedbackModal: { postId, answers: {} } }),
      closeFeedback: () => set({ feedbackModal: null }),
      answerFeedback: (questionId, answer) =>
        set((state) => {
          if (!state.feedbackModal) return {};
          return {
            feedbackModal: {
              ...state.feedbackModal,
              answers: { ...state.feedbackModal.answers, [questionId]: answer },
            },
          };
        }),
      setPostCount: (postCount) => set({ postCount }),
      setBrandId: (brandId) => set({ brandId }),
      setSkipInitialQuestions: (skipInitialQuestions) => set({ skipInitialQuestions }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setHasPreviousGeneration: (hasPreviousGeneration) => set({ hasPreviousGeneration }),
      setTrendingTopics: (trendingTopics) => set({ trendingTopics }),
      setIdeasData: (ideasData) => set({ ideasData }),
      setCaptionsData: (captionsData) => set({ captionsData }),
      setPipelineCompleted: (pipelineCompleted) => set({ pipelineCompleted }),
      setOriginalAnswers: (originalAnswers) => set({ originalAnswers, answersChanged: false }),
      setOriginalCustomAnswers: (originalCustomAnswers) => set({ originalCustomAnswers }),
      markAnswersChanged: () => set({ answersChanged: true }),
      resetAnswersChanged: () => set({ answersChanged: false }),

      // Legacy product actions
      setProductImages: (productImages) => set({ productImages }),
      addProductImageLegacy: (image) =>
        set((state) => ({ productImages: [...state.productImages, image] })),
      removeProductImageLegacy: (index) =>
        set((state) => ({ productImages: state.productImages.filter((_, i) => i !== index) })),
      setProductAnswer: (key, value) =>
        set((state) => ({ productAnswers: { ...state.productAnswers, [key]: value } })),
      clearProductData: () => set({ productImages: [], productAnswers: {}, products: [], selectedProductIds: [], customQAs: [] }),
      setReturningFromProductUpload: (returningFromProductUpload) => set({ returningFromProductUpload }),

      // New multi-product actions
      addProduct: () =>
        set((state) => {
          const newProduct: Product = {
            id: `product-${Date.now()}-${Math.random()}`,
            images: [],
            title: '',
          };
          return { products: [...state.products, newProduct] };
        }),

      removeProduct: (productId) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
          selectedProductIds: state.selectedProductIds.filter((id) => id !== productId),
        })),

      updateProduct: (productId, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates } : p
          ),
        })),

      addProductImage: (productId, image) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, images: [...p.images, image] } : p
          ),
        })),

      removeProductImage: (productId, imageIndex) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? { ...p, images: p.images.filter((_, i) => i !== imageIndex) }
              : p
          ),
        })),

      toggleProductSelection: (productId) =>
        set((state) => {
          const isSelected = state.selectedProductIds.includes(productId);
          return {
            selectedProductIds: isSelected
              ? state.selectedProductIds.filter((id) => id !== productId)
              : [...state.selectedProductIds, productId],
          };
        }),

      addCustomQA: () =>
        set((state) => {
          const newQA: CustomQA = {
            id: `qa-${Date.now()}-${Math.random()}`,
            question: '',
            answer: '',
          };
          return { customQAs: [...state.customQAs, newQA] };
        }),

      removeCustomQA: (qaId) =>
        set((state) => ({
          customQAs: state.customQAs.filter((qa) => qa.id !== qaId),
        })),

      updateCustomQA: (qaId, updates) =>
        set((state) => ({
          customQAs: state.customQAs.map((qa) =>
            qa.id === qaId ? { ...qa, ...updates } : qa
          ),
        })),

      setSkipDNAGeneration: (skipDNAGeneration) => set({ skipDNAGeneration }),
      setVideoPending: (videoPending) => set({ videoPending }),
      setVideoResult: (videoResult) => set({ videoResult }),

      reset: () => {
        // No localStorage cleanup needed - database is source of truth
        set({
          screen: 'url',  // Reset to URL screen (mode is legacy)
          websiteUrl: '',
          answers: {},
          customAnswers: {},
          generatedPosts: [],
          feedbackModal: null,
          postCount: 2,
          brandId: null,
          logoFile: null,
          productImages: [],
          productAnswers: {},
          products: [],
          selectedProductIds: [],
          customQAs: [],
          skipInitialQuestions: false,
          loading: false,
          error: null,
          hasPreviousGeneration: false,
          trendingTopics: [],
          ideasData: [],
          captionsData: [],
          pipelineCompleted: false,
          originalAnswers: {},
          originalCustomAnswers: {},
          answersChanged: false,
          returningFromProductUpload: false,
          skipDNAGeneration: false,
          videoPending: null,
          videoResult: null,
        });
      },
    }));
