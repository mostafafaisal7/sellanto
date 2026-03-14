import api from './api';

export const strategyService = {
  // Content Pillars
  async getPillars(brandId: number) {
    const res = await api.get(`/content-pillars/by-brand/${brandId}/`);
    return res.data;
  },
  async createPillar(data: { brand?: number; name: string; description?: string; target_percentage: number; color_code?: string }) {
    const res = await api.post('/content-pillars/', data);
    return res.data;
  },
  async updatePillar(id: number, data: Record<string, unknown>) {
    const res = await api.patch(`/content-pillars/${id}/`, data);
    return res.data;
  },
  async deletePillar(id: number) {
    await api.delete(`/content-pillars/${id}/`);
  },
  async getPillarCompliance(brandId: number) {
    const res = await api.get(`/brands/${brandId}/pillar-compliance/`);
    return res.data;
  },

  // Competitors
  async getCompetitors(brandId: number) {
    const res = await api.get(`/competitor-profiles/by-brand/${brandId}/`);
    return res.data;
  },
  async addCompetitor(data: { brand?: number; platform: string; handle_or_url: string }) {
    const res = await api.post('/competitor-profiles/', data);
    return res.data;
  },
  async deleteCompetitor(id: number) {
    await api.delete(`/competitor-profiles/${id}/`);
  },
  async triggerCrawl(brandId: number, competitorId?: number, overridePrompt?: string) {
    const data: Record<string, unknown> = {};
    if (competitorId) data.competitor_id = competitorId;
    if (overridePrompt) data.override_prompt = overridePrompt;
    const res = await api.post(`/brands/${brandId}/competitors/crawl/`, data);
    return res.data;
  },
  async getInsights(brandId: number) {
    const res = await api.get(`/brands/${brandId}/competitors/insights/`);
    return res.data;
  },

  // Brand Templates
  async getTemplates(brandId?: number) {
    const params = brandId ? { brand: brandId } : {};
    const res = await api.get('/brand-templates/', { params });
    return res.data;
  },
  async createTemplate(data: FormData) {
    const res = await api.post('/brand-templates/', data);
    return res.data;
  },

  // Ideas
  async generateIdeas(data: { brand_id: number; pillar_id?: number; platform?: string; count?: number; trending_topics?: string[]; override_prompt?: string }) {
    const res = await api.post('/ideas/generate/', data);
    return res.data;
  },
  async regenerateIdea(ideaId: number, overridePrompt?: string) {
    const res = await api.post(`/ideas/${ideaId}/regenerate/`, overridePrompt ? { override_prompt: overridePrompt } : {});
    return res.data;
  },
  async addIdeaToCalendar(ideaId: number) {
    const res = await api.post(`/ideas/${ideaId}/add-to-calendar/`);
    return res.data;
  },
  async getTrending(platform?: string) {
    const params = platform ? { platform } : {};
    const res = await api.get('/trending/', { params });
    return res.data;
  },

  // Brand DNA
  async generateDNA(brandId: number, websiteUrl: string, overridePrompt?: string) {
    const res = await api.post(`/brands/${brandId}/generate-dna/`, { website_url: websiteUrl, ...(overridePrompt ? { override_prompt: overridePrompt } : {}) });
    return res.data;
  },
  async getDNAStatus(brandId: number) {
    const res = await api.get(`/brands/${brandId}/dna-status/`);
    return res.data;
  },

  async regenerateDNAFromInputs(brandId: number, inputs: Record<string, unknown>, overridePrompt?: string) {
    const res = await api.post(`/brands/${brandId}/regenerate-dna-inputs/`, { ...inputs, ...(overridePrompt ? { override_prompt: overridePrompt } : {}) });
    return res.data;
  },

  // V1.3 — DNA History
  async getDNAHistory(brandId: number) {
    const res = await api.get(`/brands/${brandId}/dna-history/`);
    return res.data;
  },
  async restoreDNA(brandId: number, historyId: number) {
    const res = await api.post(`/brands/${brandId}/dna-history/${historyId}/restore/`);
    return res.data;
  },

  // V1.3 — Brand-specific Trending
  async generateTrending(brandId: number, overridePrompt?: string) {
    const res = await api.post(`/brands/${brandId}/trending/generate/`, overridePrompt ? { override_prompt: overridePrompt } : {});
    return res.data;
  },
  async getBrandTrending(brandId: number) {
    const res = await api.get(`/brands/${brandId}/trending/`);
    return res.data;
  },

  // V1.3 — Overflow Flow
  async getOverflowProgress() {
    const res = await api.get('/overflow/progress/');
    return res.data;
  },
  async updateOverflowProgress(data: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await api.put('/overflow/progress/', data, { _silentError: true } as any);
    return res.data;
  },
  async skipOverflow() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await api.post('/overflow/skip/', {}, { _silentError: true } as any);
    return res.data;
  },

  // V1.3 — Idea History
  async getIdeaHistory(params?: { brand_id?: number; status?: string; platform?: string; search?: string }) {
    const res = await api.get('/ideas/history/', { params });
    return res.data;
  },

  // V1.4 — Competitor Suggestions
  async suggestCompetitors(brandId: number, count?: number, overridePrompt?: string) {
    const res = await api.post('/competitors/suggest/', { brand_id: brandId, count: count || 5, ...(overridePrompt ? { override_prompt: overridePrompt } : {}) });
    return res.data;
  },

  // V1.4 — Pillar Generation
  async generatePillars(brandId: number, count?: number, focusAreas?: string[], overridePrompt?: string) {
    const res = await api.post(`/brands/${brandId}/pillars/generate/`, {
      count: count || 5,
      focus_areas: focusAreas || [],
      ...(overridePrompt ? { override_prompt: overridePrompt } : {}),
    });
    return res.data;
  },

  // V1.4 — Trend Feedback
  async submitTrendFeedback(brandId: number, topicText: string, isAccepted: boolean, sourceTrendingId?: number) {
    const res = await api.post(`/brands/${brandId}/trending/feedback/`, {
      topic_text: topicText,
      is_accepted: isAccepted,
      source_trending_id: sourceTrendingId,
    });
    return res.data;
  },
  async getTrendFeedback(brandId: number) {
    const res = await api.get(`/brands/${brandId}/trending/feedback/`);
    return res.data;
  },

  // V1.4 — Manual Trends
  async addManualTrend(brandId: number, topic: string, explanation?: string) {
    const res = await api.post(`/brands/${brandId}/trending/manual/`, {
      topic,
      relevance_explanation: explanation,
    });
    return res.data;
  },

  // Prompt History
  async getPromptHistory(brandId: number, feature?: string) {
    const params = feature ? { feature } : {};
    const res = await api.get(`/brands/${brandId}/prompt-history/`, { params });
    return res.data;
  },

  // Brand Assets (logos)
  async getBrandLogos(brandId: number) {
    const res = await api.get('/brand-assets/', { params: { brand: brandId } });
    return (res.data || []).filter((a: { asset_type: string }) => a.asset_type === 'logo');
  },
  async uploadBrandLogo(brandId: number, file: File, name: string) {
    const formData = new FormData();
    formData.append('brand', String(brandId));
    formData.append('file', file);
    formData.append('asset_type', 'logo');
    formData.append('name', name);
    const res = await api.post('/brand-assets/', formData);
    return res.data;
  },
  async deleteBrandLogo(assetId: number) {
    await api.delete(`/brand-assets/${assetId}/`);
  },
};

export default strategyService;
