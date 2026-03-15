import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import strategyService from '../services/strategyService';

interface IdeaData {
  id: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  content_format: string;
}

export interface SelectedCaption {
  id: string;
  ideaId: number;
  text: string;
}

export interface CaptionMediaEntry {
  mediaUrl: string | null;
  mediaId: number | null;
}

interface OverflowState {
  currentStep: number;
  subStep: number;
  brandId: number | null;

  dnaCompleted: boolean;
  pillarsCompleted: boolean;
  competitorsCompleted: boolean;
  trendingCompleted: boolean;

  // Trending → Ideas data flow
  selectedTrendingTopics: string[];
  brandContext: { brand_name: string; industry: string; target_audience: string; description: string } | null;

  // Ideas data (so CaptionsStep can access title/hook)
  ideasData: IdeaData[];
  selectedIdeaIds: number[];
  ideaMediaPreferences: Record<number, 'image' | 'video' | 'none'>;

  // AI prompt visibility (survives step navigation)
  ideasUsedPrompt: string;
  trendingUsedPrompt: string;

  // Provider/model info (survives step navigation)
  dnaProvider: string;
  dnaModelUsed: string;
  pillarsProvider: string;
  pillarsModelUsed: string;
  compProvider: string;
  compModelUsed: string;
  trendProvider: string;
  trendModelUsed: string;
  ideasProvider: string;
  ideasModelUsed: string;
  captionProvider: string;
  captionModelUsed: string;

  selectedCaptionIds: number[];
  generatedMediaIds: number[];
  generatedMediaUrl: string | null;
  createdPostId: number | null;

  // Multi-post: per-caption data
  selectedCaptions: SelectedCaption[];
  captionMediaMap: Record<string, CaptionMediaEntry>;

  isCompleted: boolean;
  isSkipped: boolean;

  // Actions
  setStep: (step: number) => void;
  setSubStep: (sub: number) => void;
  setBrandId: (id: number) => void;
  markDNAComplete: () => void;
  markPillarsComplete: () => void;
  markCompetitorsComplete: () => void;
  markTrendingComplete: () => void;
  toggleTrendingTopic: (topic: string) => void;
  setSelectedTrendingTopics: (topics: string[]) => void;
  setBrandContext: (ctx: OverflowState['brandContext']) => void;
  setIdeasData: (ideas: IdeaData[]) => void;
  setIdeasUsedPrompt: (prompt: string) => void;
  setTrendingUsedPrompt: (prompt: string) => void;
  setDnaProviderModel: (p: string, m: string) => void;
  setPillarsProviderModel: (p: string, m: string) => void;
  setCompProviderModel: (p: string, m: string) => void;
  setTrendProviderModel: (p: string, m: string) => void;
  setIdeasProviderModel: (p: string, m: string) => void;
  setCaptionProviderModel: (p: string, m: string) => void;
  toggleIdeaSelection: (ideaId: number) => void;
  setIdeaSelection: (ids: number[]) => void;
  setMediaPreference: (ideaId: number, pref: 'image' | 'video' | 'none') => void;
  addCaption: (captionId: number) => void;
  setCaptions: (ids: number[]) => void;
  addMedia: (mediaId: number) => void;
  setGeneratedMediaUrl: (url: string) => void;
  setCreatedPost: (postId: number) => void;
  setSelectedCaptions: (captions: SelectedCaption[]) => void;
  setCaptionMedia: (captionId: string, mediaUrl: string | null, mediaId: number | null) => void;
  complete: () => void;
  skip: () => void;
  reset: () => void;
  initFromIdeasHub: (params: { brandId: number; idea: IdeaData }) => void;
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
}

export const useOverflowStore = create<OverflowState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      subStep: 1,
      brandId: null,
      dnaCompleted: false,
      pillarsCompleted: false,
      competitorsCompleted: false,
      trendingCompleted: false,
      selectedTrendingTopics: [],
      brandContext: null,
      ideasData: [],
      selectedIdeaIds: [],
      ideaMediaPreferences: {},
      ideasUsedPrompt: '',
      trendingUsedPrompt: '',
      dnaProvider: '',
      dnaModelUsed: '',
      pillarsProvider: '',
      pillarsModelUsed: '',
      compProvider: '',
      compModelUsed: '',
      trendProvider: '',
      trendModelUsed: '',
      ideasProvider: '',
      ideasModelUsed: '',
      captionProvider: '',
      captionModelUsed: '',
      selectedCaptionIds: [],
      generatedMediaIds: [],
      generatedMediaUrl: null,
      createdPostId: null,
      selectedCaptions: [],
      captionMediaMap: {},
      isCompleted: false,
      isSkipped: false,

      setStep: (step) => set({ currentStep: step }),
      setSubStep: (sub) => set({ subStep: sub }),
      setBrandId: (id) => set({ brandId: id }),

      markDNAComplete: () => {
        set({ dnaCompleted: true });
        get().saveToServer();
      },
      markPillarsComplete: () => {
        set({ pillarsCompleted: true });
        get().saveToServer();
      },
      markCompetitorsComplete: () => {
        set({ competitorsCompleted: true });
        get().saveToServer();
      },
      markTrendingComplete: () => {
        set({ trendingCompleted: true });
        get().saveToServer();
      },

      toggleTrendingTopic: (topic) => {
        const { selectedTrendingTopics } = get();
        if (selectedTrendingTopics.includes(topic)) {
          set({ selectedTrendingTopics: selectedTrendingTopics.filter((t) => t !== topic) });
        } else {
          set({ selectedTrendingTopics: [...selectedTrendingTopics, topic] });
        }
      },
      setSelectedTrendingTopics: (topics) => set({ selectedTrendingTopics: topics }),
      setBrandContext: (ctx) => set({ brandContext: ctx }),

      setIdeasData: (ideas) => set({ ideasData: ideas }),
      setIdeasUsedPrompt: (prompt) => set({ ideasUsedPrompt: prompt }),
      setTrendingUsedPrompt: (prompt) => set({ trendingUsedPrompt: prompt }),
      setDnaProviderModel: (p, m) => set({ dnaProvider: p, dnaModelUsed: m }),
      setPillarsProviderModel: (p, m) => set({ pillarsProvider: p, pillarsModelUsed: m }),
      setCompProviderModel: (p, m) => set({ compProvider: p, compModelUsed: m }),
      setTrendProviderModel: (p, m) => set({ trendProvider: p, trendModelUsed: m }),
      setIdeasProviderModel: (p, m) => set({ ideasProvider: p, ideasModelUsed: m }),
      setCaptionProviderModel: (p, m) => set({ captionProvider: p, captionModelUsed: m }),
      toggleIdeaSelection: (ideaId) => {
        const { selectedIdeaIds } = get();
        if (selectedIdeaIds.includes(ideaId)) {
          set({ selectedIdeaIds: selectedIdeaIds.filter((id) => id !== ideaId) });
        } else {
          set({ selectedIdeaIds: [...selectedIdeaIds, ideaId] });
        }
      },
      setIdeaSelection: (ids) => set({ selectedIdeaIds: ids }),
      setMediaPreference: (ideaId, pref) => {
        set({ ideaMediaPreferences: { ...get().ideaMediaPreferences, [ideaId]: pref } });
      },
      addCaption: (captionId) => {
        const ids = get().selectedCaptionIds;
        if (!ids.includes(captionId)) set({ selectedCaptionIds: [...ids, captionId] });
      },
      setCaptions: (ids) => set({ selectedCaptionIds: ids }),
      addMedia: (mediaId) => {
        const ids = get().generatedMediaIds;
        if (!ids.includes(mediaId)) set({ generatedMediaIds: [...ids, mediaId] });
      },
      setGeneratedMediaUrl: (url) => set({ generatedMediaUrl: url }),
      setCreatedPost: (postId) => set({ createdPostId: postId }),

      setSelectedCaptions: (captions) => set({ selectedCaptions: captions }),
      setCaptionMedia: (captionId, mediaUrl, mediaId) => {
        const map = { ...get().captionMediaMap, [captionId]: { mediaUrl, mediaId } };
        // Also keep generatedMediaUrl in sync (first caption's media)
        const first = get().selectedCaptions[0];
        const firstUrl = first ? (map[first.id]?.mediaUrl || null) : null;
        set({ captionMediaMap: map, generatedMediaUrl: firstUrl });
      },

      complete: () => {
        set({ isCompleted: true });
        get().saveToServer();
      },
      skip: async () => {
        set({ isSkipped: true });
        try {
          await strategyService.skipOverflow();
        } catch { /* ignore */ }
      },
      reset: () => set({
        currentStep: 1, subStep: 1, brandId: null,
        dnaCompleted: false, pillarsCompleted: false,
        competitorsCompleted: false, trendingCompleted: false,
        selectedTrendingTopics: [], brandContext: null,
        ideasData: [], selectedIdeaIds: [], ideaMediaPreferences: {}, ideasUsedPrompt: '', trendingUsedPrompt: '',
        dnaProvider: '', dnaModelUsed: '', pillarsProvider: '', pillarsModelUsed: '',
        compProvider: '', compModelUsed: '', trendProvider: '', trendModelUsed: '',
        ideasProvider: '', ideasModelUsed: '', captionProvider: '', captionModelUsed: '',
        selectedCaptionIds: [], generatedMediaIds: [], generatedMediaUrl: null,
        createdPostId: null, selectedCaptions: [], captionMediaMap: {},
        isCompleted: false, isSkipped: false,
      }),

      initFromIdeasHub: ({ brandId, idea }) => set({
        currentStep: 3, subStep: 1, brandId,
        dnaCompleted: true, pillarsCompleted: true,
        competitorsCompleted: true, trendingCompleted: true,
        selectedTrendingTopics: [], brandContext: null,
        ideasData: [idea], selectedIdeaIds: [idea.id],
        ideaMediaPreferences: {}, ideasUsedPrompt: '', trendingUsedPrompt: '',
        dnaProvider: '', dnaModelUsed: '', pillarsProvider: '', pillarsModelUsed: '',
        compProvider: '', compModelUsed: '', trendProvider: '', trendModelUsed: '',
        ideasProvider: '', ideasModelUsed: '', captionProvider: '', captionModelUsed: '',
        selectedCaptionIds: [], generatedMediaIds: [], generatedMediaUrl: null,
        createdPostId: null, selectedCaptions: [], captionMediaMap: {},
        isCompleted: false, isSkipped: false,
      }),

      loadFromServer: async () => {
        try {
          const data = await strategyService.getOverflowProgress();
          set({
            currentStep: data.current_step || 1,
            brandId: data.brand_id || null,
            dnaCompleted: data.dna_completed || false,
            pillarsCompleted: data.pillars_completed || false,
            competitorsCompleted: data.competitors_completed || false,
            trendingCompleted: data.trending_completed || false,
            selectedIdeaIds: data.selected_idea_ids || [],
            ideaMediaPreferences: data.idea_media_preferences || {},
            selectedCaptionIds: data.selected_caption_ids || [],
            generatedMediaIds: data.generated_media_ids || [],
            createdPostId: data.created_post_id || null,
            isCompleted: data.is_completed || false,
            isSkipped: data.is_skipped || false,
          });
        } catch { /* first time — no progress yet */ }
      },

      saveToServer: async () => {
        const s = get();
        try {
          await strategyService.updateOverflowProgress({
            current_step: s.currentStep,
            brand_id: s.brandId,
            dna_completed: s.dnaCompleted,
            pillars_completed: s.pillarsCompleted,
            competitors_completed: s.competitorsCompleted,
            trending_completed: s.trendingCompleted,
            selected_idea_ids: s.selectedIdeaIds,
            idea_media_preferences: s.ideaMediaPreferences,
            selected_caption_ids: s.selectedCaptionIds,
            generated_media_ids: s.generatedMediaIds,
            created_post_id: s.createdPostId,
            is_completed: s.isCompleted,
          });
        } catch { /* ignore save failures */ }
      },
    }),
    {
      name: 'overflow-storage',
      partialize: (state) => ({
        currentStep: state.currentStep,
        subStep: state.subStep,
        brandId: state.brandId,
        selectedTrendingTopics: state.selectedTrendingTopics,
        ideasData: state.ideasData,
        ideasUsedPrompt: state.ideasUsedPrompt,
        trendingUsedPrompt: state.trendingUsedPrompt,
        dnaProvider: state.dnaProvider,
        dnaModelUsed: state.dnaModelUsed,
        pillarsProvider: state.pillarsProvider,
        pillarsModelUsed: state.pillarsModelUsed,
        compProvider: state.compProvider,
        compModelUsed: state.compModelUsed,
        trendProvider: state.trendProvider,
        trendModelUsed: state.trendModelUsed,
        ideasProvider: state.ideasProvider,
        ideasModelUsed: state.ideasModelUsed,
        captionProvider: state.captionProvider,
        captionModelUsed: state.captionModelUsed,
        selectedIdeaIds: state.selectedIdeaIds,
        ideaMediaPreferences: state.ideaMediaPreferences,
        selectedCaptionIds: state.selectedCaptionIds,
        generatedMediaUrl: state.generatedMediaUrl,
        selectedCaptions: state.selectedCaptions,
        captionMediaMap: state.captionMediaMap,
        isCompleted: state.isCompleted,
        isSkipped: state.isSkipped,
      }),
    }
  )
);

export default useOverflowStore;
