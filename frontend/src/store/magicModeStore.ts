import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  screen: 'mode' | 'url' | 'questions' | 'working' | 'results';
  websiteUrl: string;
  answers: Record<string, string | string[]>;
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

  // Intermediate pipeline data (for Overflow bridge)
  trendingTopics: string[];
  ideasData: MagicIdeaData[];
  captionsData: MagicCaptionData[];
  pipelineCompleted: boolean;

  // Smart regeneration tracking
  originalAnswers: Record<string, string | string[]>;
  answersChanged: boolean;

  setScreen: (screen: MagicModeState['screen']) => void;
  setUrl: (url: string) => void;
  setLogoFile: (file: File | null) => void;
  setAnswer: (questionId: string, answer: string | string[]) => void;
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
  markAnswersChanged: () => void;
  resetAnswersChanged: () => void;
  reset: () => void;
}

export const useMagicModeStore = create<MagicModeState>()(
  persist(
    (set) => ({
      screen: 'mode',
      websiteUrl: '',
      answers: {},
      generatedPosts: [],
      feedbackModal: null,
      postCount: 2,
      brandId: null,
      skipInitialQuestions: false,
      loading: false,
      error: null,
      hasPreviousGeneration: false,
      logoFile: null,
      trendingTopics: [],
      ideasData: [],
      captionsData: [],
      pipelineCompleted: false,
      originalAnswers: {},
      answersChanged: false,

      setScreen: (screen) => set({ screen }),
      setUrl: (websiteUrl) => set({ websiteUrl }),
      setLogoFile: (logoFile) => set({ logoFile }),
      setAnswer: (questionId, answer) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),
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
      markAnswersChanged: () => set({ answersChanged: true }),
      resetAnswersChanged: () => set({ answersChanged: false }),
      reset: () => {
        localStorage.removeItem('magic_draft_post_ids');
        set({
          screen: 'mode',
          websiteUrl: '',
          answers: {},
          generatedPosts: [],
          feedbackModal: null,
          postCount: 2,
          brandId: null,
          logoFile: null,
          skipInitialQuestions: false,
          loading: false,
          error: null,
          hasPreviousGeneration: false,
          trendingTopics: [],
          ideasData: [],
          captionsData: [],
          pipelineCompleted: false,
          originalAnswers: {},
          answersChanged: false,
        });
      },
    }),
    {
      name: 'magic-mode-storage',
      partialize: (state) => ({
        brandId: state.brandId,
        websiteUrl: state.websiteUrl,
        answers: state.answers,
        generatedPosts: state.generatedPosts,
        postCount: state.postCount,
        hasPreviousGeneration: state.hasPreviousGeneration,
        trendingTopics: state.trendingTopics,
        ideasData: state.ideasData,
        captionsData: state.captionsData,
        pipelineCompleted: state.pipelineCompleted,
        originalAnswers: state.originalAnswers,
        answersChanged: state.answersChanged,
      }),
    }
  )
);
