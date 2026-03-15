export interface CopySuggestion {
  text: string;
  style: 'bold' | 'inspirational' | 'question' | 'cta' | 'minimal';
  recommended_layout: 'center' | 'bottom_banner' | 'top_banner';
}

export interface CopyOverlayGenerateRequest {
  brand_id?: number;
  caption_text?: string;
  image_description?: string;
  cta_text?: string;
  idea_context?: string;
  trending_topics?: string;
  count?: number;
}

export interface CopyOverlayGenerateResponse {
  suggestions: CopySuggestion[];
}

export interface CopyOverlayApplyRequest {
  copy_text: string;
  position: 'center' | 'bottom_banner' | 'top_banner' | 'top_bottom_split';
  font_style: string;
  text_color: string;
  overlay_opacity: number;
  font_size: number;
  text_alignment: 'left' | 'center' | 'right';
  add_text_shadow: boolean;
}

export interface CopyOverlayApplyResponse {
  asset_id: number;
  overlay_image_url: string;
}

export type OverlayPosition = 'center' | 'bottom_banner' | 'top_banner' | 'top_bottom_split';
export type FontStyle = 'montserrat_bold' | 'montserrat_regular' | 'playfair_bold' | 'roboto_bold' | 'bebas_neue';
export type TextAlignment = 'left' | 'center' | 'right';

// AI Style variants
export interface AIStyleVariant {
  index: number;
  name: string;
  description: string;
  preview: string; // base64 data URL
  settings: {
    font_style: string;
    text_color: string;
    position: OverlayPosition;
    overlay_opacity: number;
    text_alignment: TextAlignment;
    add_text_shadow: boolean;
  };
}

export interface AIStylesRequest {
  copy_text: string;
  brand_id?: number;
}

export interface AIStylesResponse {
  variants: AIStyleVariant[];
}
