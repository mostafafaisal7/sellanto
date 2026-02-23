import api from './api';
import type { GenerateCaptionRequest, GeneratedCaption } from '../types';

export const captionService = {
  async generate(data: GenerateCaptionRequest): Promise<GeneratedCaption> {
    const formData = new FormData();

    if (data.topic) formData.append('topic', data.topic);
    formData.append('tone', data.tone);
    formData.append('length', data.length);
    formData.append('platform', data.platform);
    formData.append('include_hashtags', String(data.include_hashtags));
    formData.append('include_emojis', String(data.include_emojis));
    formData.append('include_cta', String(data.include_cta));
    if (data.custom_instructions) formData.append('custom_instructions', data.custom_instructions);
    if (data.media_file) formData.append('media_file', data.media_file);

    const response = await api.post<GeneratedCaption>('/ai-caption/generate/', formData);
    return response.data;
  },

  async regenerate(id: number, feedback: string): Promise<GeneratedCaption> {
    const response = await api.post<GeneratedCaption>(`/ai-caption/regenerate/${id}/`, { feedback });
    return response.data;
  },

  async getHistory(): Promise<GeneratedCaption[]> {
    const response = await api.get<GeneratedCaption[]>('/ai-caption/history/');
    return response.data;
  },
};

export default captionService;
