import api from './api';

export interface VoiceGeneration {
  id: number;
  title: string;
  input_text: string;
  voice: string;
  model: string;
  speed: number;
  output_format: string;
  audio_file: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  characters_used: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  processing_time: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserVoiceSettings {
  id: number;
  has_api_key: boolean;
  masked_api_key: string;
  default_voice: string;
  default_speed: number;
  default_model: string;
  total_characters_used: number;
  total_generations: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateVoiceRequest {
  text: string;
  title?: string;
  voice?: string;
  model?: string;
  speed?: number;
  format?: string;
}

export const voiceService = {
  async generate(data: GenerateVoiceRequest): Promise<VoiceGeneration> {
    const response = await api.post<VoiceGeneration>('/ai-voice/generate/', data);
    return response.data;
  },

  async preview(data: { text: string; voice: string; speed: number }): Promise<{ audio_base64: string; content_type: string }> {
    const response = await api.post('/ai-voice/preview/', data);
    return response.data;
  },

  async getHistory(): Promise<VoiceGeneration[]> {
    const response = await api.get<VoiceGeneration[]>('/ai-voice/history/');
    return response.data;
  },

  async getGeneration(id: number): Promise<VoiceGeneration> {
    const response = await api.get<VoiceGeneration>(`/ai-voice/generation/${id}/`);
    return response.data;
  },

  async deleteGeneration(id: number): Promise<void> {
    await api.post(`/ai-voice/generation/${id}/delete/`);
  },

  async regenerate(id: number): Promise<VoiceGeneration> {
    const response = await api.post<VoiceGeneration>(`/ai-voice/generation/${id}/regenerate/`);
    return response.data;
  },

  async getSettings(): Promise<UserVoiceSettings> {
    const response = await api.get<UserVoiceSettings>('/ai-voice/settings/');
    return response.data;
  },

  async updateSettings(data: { openai_api_key?: string; default_voice?: string; default_speed?: number; default_model?: string }): Promise<UserVoiceSettings> {
    const response = await api.patch<UserVoiceSettings>('/ai-voice/settings/', data);
    return response.data;
  },
};

export default voiceService;
