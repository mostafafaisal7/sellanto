import api from './api';
import type { GenerateCaptionRequest, GeneratedCaption } from '../types';

export interface RegenerateCaptionResponse {
  success: boolean;
  caption: string;
  hashtags: string;
  id: number;
}

export const captionService = {
  async generate(data: GenerateCaptionRequest & { override_prompt?: string }): Promise<GeneratedCaption> {
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
    if (data.override_prompt) formData.append('override_prompt', data.override_prompt);

    const response = await api.post<GeneratedCaption>('/ai-caption/generate/', formData);
    return response.data;
  },

  async regenerate(id: number, feedback: string): Promise<RegenerateCaptionResponse> {
    const response = await api.post<RegenerateCaptionResponse>(`/ai-caption/regenerate/${id}/`, { feedback });
    return response.data;
  },

  async getHistory(): Promise<GeneratedCaption[]> {
    const response = await api.get<GeneratedCaption[]>('/ai-caption/history/');
    return response.data;
  },
};

export default captionService;
