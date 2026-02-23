import api from './api';
import type {
  VideoGeneration,
  SavedVideo,
  VideoLogo,
  VideoPromptTemplate,
  UserVideoSettings,
} from '../types';

export interface GenerateVideoRequest {
  prompt: string;
  title?: string;
  negative_prompt?: string;
  style?: string;
  duration?: number;
  resolution?: string;
  aspect_ratio?: string;
  fps?: number;
  camera_motion?: string;
  logo_id?: number | null;
  logo_position?: string;
  logo_size?: number;
  logo_opacity?: number;
  enhance_prompt?: boolean;
}

export const videoService = {
  // Generation
  async generate(data: GenerateVideoRequest): Promise<VideoGeneration> {
    const response = await api.post<VideoGeneration>('/ai-video/generate/', data);
    return response.data;
  },

  async getHistory(): Promise<VideoGeneration[]> {
    const response = await api.get<VideoGeneration[]>('/ai-video/history/');
    return response.data;
  },

  // Settings
  async getSettings(): Promise<UserVideoSettings> {
    const response = await api.get<UserVideoSettings>('/ai-video/settings/');
    return response.data;
  },

  async updateSettings(data: Partial<UserVideoSettings>): Promise<UserVideoSettings> {
    const response = await api.patch<UserVideoSettings>('/ai-video/settings/', data);
    return response.data;
  },

  // Logos
  async getLogos(): Promise<VideoLogo[]> {
    const response = await api.get<VideoLogo[]>('/ai-video/logos/');
    return response.data;
  },

  async uploadLogo(file: File, name: string, isDefault?: boolean): Promise<VideoLogo> {
    const formData = new FormData();
    formData.append('logo_file', file);
    formData.append('name', name);
    if (isDefault) formData.append('is_default', 'true');

    const response = await api.post<VideoLogo>('/ai-video/logos/', formData);
    return response.data;
  },

  async deleteLogo(id: number): Promise<void> {
    await api.delete(`/ai-video/logos/${id}/`);
  },

  // Saved Videos
  async getSaved(): Promise<SavedVideo[]> {
    const response = await api.get<SavedVideo[]>('/ai-video/saved/');
    return response.data;
  },

  async saveVideo(data: {
    name: string;
    video_file: string;
    thumbnail?: string;
    original_prompt: string;
    source_generation?: number;
    duration?: number;
    tags?: string;
  }): Promise<SavedVideo> {
    const response = await api.post<SavedVideo>('/ai-video/saved/', data);
    return response.data;
  },

  async deleteSavedVideo(id: number): Promise<void> {
    await api.delete(`/ai-video/saved/${id}/`);
  },

  // Templates
  async getTemplates(): Promise<VideoPromptTemplate[]> {
    const response = await api.get<VideoPromptTemplate[]>('/ai-video/templates/');
    return response.data;
  },

  async createTemplate(data: Partial<VideoPromptTemplate>): Promise<VideoPromptTemplate> {
    const response = await api.post<VideoPromptTemplate>('/ai-video/templates/', data);
    return response.data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await api.delete(`/ai-video/templates/${id}/`);
  },
};

export default videoService;
