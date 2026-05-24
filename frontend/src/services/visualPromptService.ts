/**
 * Visual prompt builder client.
 *
 * Posts magic-mode context (brand id, idea, caption, trending themes,
 * platform, colour palette, product details) to the backend, which uses
 * Claude to synthesise it into one focused prompt that gets passed to
 * Imagen / Veo.
 *
 * Both methods swallow errors and return `null` so callers can fall back
 * to their hand-stitched template prompts without crashing the magic
 * pipeline.
 */
import api from './api';

export interface BuildImagePromptPayload {
  brand_id: number;
  idea: { title: string; hook?: string; angle?: string; platform?: string };
  caption: string;
  platform: string;
  color_choices?: string[];
  trending_topics?: string[];
  image_style_hint?: string;
  with_copy?: boolean;
  copy_text?: string;
  product_context?: {
    product_type?: string;
    features?: string;
    background_style?: string;
  } | null;
}

export interface BuildVideoPromptPayload {
  brand_id: number;
  user_prompt: string;
  idea?: { title?: string; hook?: string; angle?: string } | null;
  trending_topics?: string[];
  has_reference_image?: boolean;
}

const visualPromptService = {
  async buildImagePrompt(payload: BuildImagePromptPayload): Promise<string | null> {
    try {
      const res = await api.post('/visual-prompt/image/', payload);
      const out = ((res.data?.prompt as string | undefined) || '').trim();
      return out || null;
    } catch (err) {
      console.warn('[visualPromptService] buildImagePrompt failed:', err);
      return null;
    }
  },

  async buildVideoPrompt(payload: BuildVideoPromptPayload): Promise<string | null> {
    try {
      const res = await api.post('/visual-prompt/video/', payload);
      const out = ((res.data?.prompt as string | undefined) || '').trim();
      return out || null;
    } catch (err) {
      console.warn('[visualPromptService] buildVideoPrompt failed:', err);
      return null;
    }
  },
};

export default visualPromptService;
