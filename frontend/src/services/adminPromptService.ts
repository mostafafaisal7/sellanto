import api from './api';

export type PromptType =
  // Ideas
  | 'idea_system'
  | 'idea_user'
  | 'idea_regenerate'
  // Captions
  | 'caption_system'
  | 'caption_user'
  | 'caption_regenerate'
  | 'caption_adapt'
  // Images
  | 'image_refiner'
  | 'image_product_bg'
  | 'image_product_smart'
  // Video
  | 'video_prompt'
  // Brand DNA
  | 'brand_dna'
  | 'brand_dna_website'
  | 'brand_dna_manual'
  // Trending
  | 'trending_filter'
  // Competitors
  | 'competitor_analyze'
  | 'competitor_suggest'
  // Pillars
  | 'pillars_generate'
  // Support
  | 'support_chat';

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

/** Lightweight snapshot of the last AI call for this prompt type — used so
 *  admins can see what actually got sent (with every dynamic value already
 *  filled in) on the most recent run. */
export interface LastExecutionSummary {
  id: number;
  created_at: string;
  was_override: boolean;
  model_used: string;
  tokens_in: number;
  tokens_out: number;
  success: boolean;
  prompt_sent: string;
  response_received: string;
  brand_name: string;
}

export interface PromptDescriptor {
  type: PromptType;
  display_name: string;
  stage: string;
  variables: string[];
  default_preview: string;
  /** Verbatim full default prompt with {variable} placeholders.
   *  This is what gets sent to the LLM when no override is active. */
  default_full: string;
  override: PromptOverride | null;
  /** Most recent actual API call for this prompt type — null if never run. */
  last_execution: LastExecutionSummary | null;
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

export interface ExecutionRecord {
  id: number;
  prompt_type: PromptType;
  was_override: boolean;
  model_used: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  success: boolean;
  error_message: string;
  brand_id: number | null;
  brand_name: string;
  prompt_sent: string;
  response_received: string;
  created_at: string;
}

export interface ExecutionHistoryResponse {
  target_user: { id: number; username: string; email: string };
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  executions: ExecutionRecord[];
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

  async executionHistory(
    userId: number,
    params?: { prompt_type?: PromptType; page?: number; page_size?: number },
  ): Promise<ExecutionHistoryResponse> {
    const { data } = await api.get<ExecutionHistoryResponse>(
      `/admin/users/${userId}/prompt-executions/`,
      { params },
    );
    return data;
  },
};

export default adminPromptService;
