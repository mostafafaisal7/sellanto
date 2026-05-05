import api from './api';

export type PromptType =
  | 'idea_system'
  | 'idea_user'
  | 'caption_system'
  | 'image_refiner'
  | 'brand_dna'
  | 'video_prompt';

export interface PromptOverride {
  id: number;
  prompt_type: PromptType;
  prompt_text: string;
  is_active: boolean;
  updated_at: string | null;
  updated_by: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface PromptDescriptor {
  type: PromptType;
  display_name: string;
  stage: string;
  variables: string[];
  default_preview: string;
  override: PromptOverride | null;
}

export interface PromptOverridesResponse {
  target_user: { id: number; username: string; email: string };
  prompts: PromptDescriptor[];
}

export interface AuditEntry {
  id: number;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  admin: string | null;
  admin_id: number | null;
  previous_text: string;
  new_text: string;
  created_at: string;
}

export const adminPromptService = {
  async list(userId: number): Promise<PromptOverridesResponse> {
    const { data } = await api.get<PromptOverridesResponse>(
      `/admin/users/${userId}/prompt-overrides/`,
    );
    return data;
  },

  async save(
    userId: number,
    promptType: PromptType,
    promptText: string,
    isActive: boolean = true,
  ): Promise<{ ok: boolean; override: PromptOverride }> {
    const { data } = await api.put<{ ok: boolean; override: PromptOverride }>(
      `/admin/users/${userId}/prompt-overrides/${promptType}/`,
      { prompt_text: promptText, is_active: isActive },
    );
    return data;
  },

  async remove(userId: number, promptType: PromptType): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(
      `/admin/users/${userId}/prompt-overrides/${promptType}/`,
    );
    return data;
  },

  async audit(userId: number, promptType: PromptType): Promise<AuditEntry[]> {
    const { data } = await api.get<{ audit: AuditEntry[] }>(
      `/admin/users/${userId}/prompt-overrides/${promptType}/audit/`,
    );
    return data.audit;
  },
};

export default adminPromptService;
