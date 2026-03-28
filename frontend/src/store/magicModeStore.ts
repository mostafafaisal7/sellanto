import { create } from 'zustand';

export interface MagicPost {
  id: number;
  title: string;
  platform: string;
  imageOverlay: string;
  imageStyle: string;
  caption: string;
  status: 'ready' | 'approved';
  feedback?: Record<string, string>;
  imageUrl?: string;
  captionId?: number;
  ideaId?: number;
}

interface MagicModeState {
  screen: 'mode' | 'url' | 'questions' | 'working' | 'results';
  websiteUrl: string;
  answers: Record<string, string | string[]>;
  generatedPosts: MagicPost[];
  feedbackModal: { postId: number; answers: Record<string, string> } | null;
  postCount: number;
  brandId: number | null;
  loading: boolean;
  error: string | null;

  setScreen: (screen: MagicModeState['screen']) => void;
  setUrl: (url: string) => void;
  setAnswer: (questionId: string, answer: string | string[]) => void;
  setGeneratedPosts: (posts: MagicPost[]) => void;
  approvePost: (id: number) => void;
  resetPostStatus: (id: number) => void;
  openFeedback: (postId: number) => void;
  closeFeedback: () => void;
  answerFeedback: (questionId: string, answer: string) => void;
  setPostCount: (count: number) => void;
  setBrandId: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useMagicModeStore = create<MagicModeState>((set) => ({
  screen: 'mode',
  websiteUrl: '',
  answers: {},
  generatedPosts: [],
  feedbackModal: null,
  postCount: 3,
  brandId: null,
  loading: false,
  error: null,

  setScreen: (screen) => set({ screen }),
  setUrl: (websiteUrl) => set({ websiteUrl }),
  setAnswer: (questionId, answer) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),
  setGeneratedPosts: (generatedPosts) => set({ generatedPosts }),
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
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      screen: 'mode',
      websiteUrl: '',
      answers: {},
      generatedPosts: [],
      feedbackModal: null,
      postCount: 3,
      brandId: null,
      loading: false,
      error: null,
    }),
}));
