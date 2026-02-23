import api from './api';
import type {
  ImageGeneration,
  SavedImage,
  UserLogo,
  PromptTemplate,
  UserImageSettings,
} from '../types';

export interface GenerateImageRequest {
  prompt: string;
  title?: string;
  negative_prompt?: string;
  provider?: 'gemini' | 'openai';
  style?: string;
  size?: string;
  quality?: string;
  logo_id?: number | null;
  logo_position?: string;
  logo_size?: number;
  logo_opacity?: number;
  enhance_prompt?: boolean;
  add_lighting?: string;
  camera_angle?: string;
}

export const imageService = {
  // Generation
  async generate(data: GenerateImageRequest): Promise<ImageGeneration> {
    const response = await api.post<ImageGeneration>('/ai-image/generate/', data);
    return response.data;
  },

  async getHistory(): Promise<ImageGeneration[]> {
    const response = await api.get<ImageGeneration[]>('/ai-image/history/');
    return response.data;
  },

  // Settings
  async getSettings(): Promise<UserImageSettings> {
    const response = await api.get<UserImageSettings>('/ai-image/settings/');
    return response.data;
  },

  async updateSettings(data: Partial<UserImageSettings>): Promise<UserImageSettings> {
    const response = await api.patch<UserImageSettings>('/ai-image/settings/', data);
    return response.data;
  },

  // Logos
  async getLogos(): Promise<UserLogo[]> {
    const response = await api.get<UserLogo[]>('/ai-image/logos/');
    return response.data;
  },

  async uploadLogo(file: File, name: string, isDefault?: boolean): Promise<UserLogo> {
    const formData = new FormData();
    formData.append('logo_file', file);
    formData.append('name', name);
    if (isDefault) formData.append('is_default', 'true');

    const response = await api.post<UserLogo>('/ai-image/logos/', formData);
    return response.data;
  },

  async deleteLogo(id: number): Promise<void> {
    await api.delete(`/ai-image/logos/${id}/`);
  },

  async setDefaultLogo(id: number): Promise<UserLogo> {
    const response = await api.post<UserLogo>(`/ai-image/logos/${id}/set_default/`);
    return response.data;
  },

  // Saved Images
  async getSaved(): Promise<SavedImage[]> {
    const response = await api.get<SavedImage[]>('/ai-image/saved/');
    return response.data;
  },

  async saveImage(data: {
    name: string;
    image_file: string;
    original_prompt: string;
    source_generation?: number;
    style?: string;
    provider?: string;
    tags?: string;
  }): Promise<SavedImage> {
    const response = await api.post<SavedImage>('/ai-image/saved/', data);
    return response.data;
  },

  async deleteSavedImage(id: number): Promise<void> {
    await api.delete(`/ai-image/saved/${id}/`);
  },

  // Templates
  async getTemplates(): Promise<PromptTemplate[]> {
    const response = await api.get<PromptTemplate[]>('/ai-image/templates/');
    return response.data;
  },

  async createTemplate(data: Partial<PromptTemplate>): Promise<PromptTemplate> {
    const response = await api.post<PromptTemplate>('/ai-image/templates/', data);
    return response.data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await api.delete(`/ai-image/templates/${id}/`);
  },
};

export default imageService;
