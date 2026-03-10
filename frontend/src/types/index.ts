// ============================================
// USER & PROFILE TYPES
// ============================================

export interface OnboardingStatus {
  current_step: number;
  is_completed: boolean;
  is_skipped: boolean;
  needs_onboarding: boolean;
}

export interface OnboardingProgress extends OnboardingStatus {
  id: number;
  completed_steps: number[];
  skipped_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: number;
  name: string;
  timezone: string;
  team_size?: number;
  default_language: string;
  max_generations_per_day: number;
  generations_today: number;
  is_active: boolean;
  can_generate: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: number;
  workspace: number;
  brand_name: string;
  industry: string;
  target_region: string;
  website_url?: string;
  social_links: Record<string, string>;
  logo?: string;
  brand_guide_pdf?: string;
  voice_tone: string;
  do_dont_rules: Record<string, string[]>;
  goals: string[];
  audiences: string[];
  brand_dna: Record<string, unknown>;
  brand_dna_generated_at?: string;
  brand_dna_source: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandDNAChunk {
  id: number;
  brand: number;
  text: string;
  chunk_index: number;
  source_url: string;
  page_title: string;
  created_at: string;
}

export interface BrandDNAStatus {
  brand_id: number;
  brand_name: string;
  website_url: string;
  brand_dna: Record<string, unknown>;
  brand_dna_generated_at?: string;
  brand_dna_source: string;
  total_chunks: number;
}

export interface LaunchPlan {
  id: number;
  brand: number;
  post_frequency: number;
  formats_allowed: string[];
  variant_generation_level: 'off' | 'low' | 'medium' | 'high';
  approval_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentIdea {
  id: number;
  brand: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  goal: string;
  content_format: string;
  language: string;
  persona: string;
  status: 'new' | 'saved' | 'skipped' | 'drafted' | 'scheduled';
  post?: number;
  batch_id: string;
  generation_run: number;
  engagement_tier?: string;
  pillar_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentApproval {
  id: number;
  post: number;
  submitted_by: number;
  submitted_by_username: string;
  submitted_at: string;
  approver?: number;
  approver_username?: string;
  reviewed_at?: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  comments: string;
  rejection_reason: string;
  compliance_checklist: Record<string, boolean>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OverflowStatus {
  is_completed: boolean;
  current_step: number;
}

export interface PromptHistoryEntry {
  id: number;
  feature: string;
  prompt_text: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  profile: UserProfile;
  onboarding_status?: OnboardingStatus;
  overflow_status?: OverflowStatus;
}

export interface UserProfile {
  id: number;
  is_approved: boolean;
  phone?: string;
  company?: string;
  avatar?: string;
  // Subscription
  subscription_plan: SubscriptionPlan;
  plan_start_date?: string;
  plan_end_date?: string;
  plan_duration_months: number;
  // Limits
  max_social_accounts: number;
  max_posts_per_month: number;
  max_captions_per_month: number;
  max_videos_per_month: number;
  max_images_per_month: number;
  max_messenger_messages: number;
  // Usage
  posts_this_month: number;
  captions_this_month: number;
  videos_this_month: number;
  images_this_month: number;
  messenger_messages_this_month: number;
  // API Mode
  api_mode: 'admin' | 'user';
  admin_openai_key?: string;
  admin_gemini_key?: string;
  // Token Usage
  total_openai_tokens_used: number;
  total_gemini_tokens_used: number;
  openai_tokens_this_month: number;
  gemini_tokens_this_month: number;
  // Timestamps
  created_at: string;
  updated_at: string;
  last_activity?: string;
}

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

export interface APIUsageLog {
  id: number;
  user: number;
  service: 'openai' | 'gemini' | 'whisper' | 'tts';
  feature: 'caption' | 'video' | 'image' | 'messenger' | 'transcription' | 'tts';
  tokens_used: number;
  estimated_cost: number;
  request_data?: string;
  response_status: string;
  created_at: string;
}

// ============================================
// POST TYPES
// ============================================

export interface Post {
  id: number;
  user: number;
  caption: string;
  ai_generated: boolean;
  media_files: string[];
  scheduled_time: string;
  timezone: string;
  platforms: PlatformType[];
  status: PostStatus;
  // Platform-specific post IDs
  facebook_post_id?: string;
  twitter_post_id?: string;
  instagram_post_id?: string;
  linkedin_post_id?: string;
  tiktok_post_id?: string;
  youtube_post_id?: string;
  pinterest_post_id?: string;
  telegram_post_id?: string;
  // Platform-specific errors
  facebook_error?: string;
  twitter_error?: string;
  instagram_error?: string;
  linkedin_error?: string;
  tiktok_error?: string;
  youtube_error?: string;
  pinterest_error?: string;
  telegram_error?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
  posted_at?: string;
  // Computed field for UI
  platform_results?: PlatformResult[];
}

export type PostStatus = 'draft' | 'pending_approval' | 'changes_requested' | 'approved' | 'rejected' | 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled';

export interface PlatformResult {
  platform: PlatformType;
  success: boolean;
  post_id?: string;
  error?: string;
}

export interface CreatePostData {
  caption: string;
  media_files: File[];
  platforms: PlatformType[];
  scheduled_time: string;
  timezone: string;
  brand?: number;
  pillar?: number;
  goal?: string;
}

export interface UpdatePostData {
  caption?: string;
  platforms?: PlatformType[];
  scheduled_time?: string;
  timezone?: string;
  brand?: number;
  pillar?: number;
  goal?: string;
  media_files?: File[];
}

// ============================================
// PLATFORM / SOCIAL ACCOUNT TYPES
// ============================================

export type PlatformType =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'telegram'
  | 'threads'
  | 'snapchat'
  | 'reddit'
  | 'medium'
  | 'tumblr'
  | 'mastodon'
  | 'twitch'
  | 'whatsapp'
  | 'messenger'
  | 'slack'
  | 'discord'
  | 'email'
  | 'livechat'
  | 'wechat'
  | 'line'
  | 'viber'
  | 'sms'
  | 'signal'
  | 'intercom';

export interface SocialAccount {
  id: number;
  user: number;
  platform: PlatformType;
  account_name: string;
  // Facebook
  facebook_page_id?: string;
  facebook_access_token?: string;
  // Twitter/X
  twitter_api_key?: string;
  twitter_api_secret?: string;
  twitter_access_token?: string;
  twitter_access_token_secret?: string;
  // Instagram
  instagram_access_token?: string;
  instagram_business_account_id?: string;
  // LinkedIn
  linkedin_access_token?: string;
  linkedin_person_urn?: string;
  // TikTok
  tiktok_access_token?: string;
  tiktok_refresh_token?: string;
  // YouTube
  youtube_access_token?: string;
  youtube_refresh_token?: string;
  youtube_channel_id?: string;
  // Pinterest
  pinterest_access_token?: string;
  pinterest_board_id?: string;
  // Telegram
  telegram_bot_token?: string;
  telegram_channel_id?: string;
  // Status
  token_expires_at?: string;
  status: AccountStatus;
  is_active: boolean;
  is_validated: boolean;
  validation_error?: string;
  last_validated_at?: string;
  connected_at: string;
  updated_at: string;
}

export type AccountStatus = 'active' | 'expired' | 'invalid' | 'disconnected';

// ============================================
// AI CAPTION TYPES
// ============================================

export interface UserAPISettings {
  id: number;
  user: number;
  openai_api_key?: string;
  default_model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
  total_tokens_used: number;
  total_generations: number;
  created_at: string;
  updated_at: string;
}

export interface CaptionGeneration {
  id: number;
  user: number;
  input_text?: string;
  media_file?: string;
  media_type: 'none' | 'image' | 'video';
  tone: CaptionTone;
  length: CaptionLength;
  platform: CaptionPlatform;
  include_hashtags: boolean;
  include_emojis: boolean;
  include_cta: boolean;
  custom_instructions?: string;
  generated_caption?: string;
  generated_hashtags?: string;
  media_analysis?: string;
  status: GenerationStatus;
  error_message?: string;
  tokens_used: number;
  processing_time: number;
  model_used: string;
  used_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface CaptionTemplate {
  id: number;
  user?: number;
  is_global: boolean;
  name: string;
  category: TemplateCategory;
  template_text: string;
  tone: CaptionTone;
  platform: CaptionPlatform;
  created_at: string;
  updated_at: string;
}

export interface SavedCaption {
  id: number;
  user: number;
  caption_generation?: number;
  caption_text: string;
  hashtags?: string;
  notes?: string;
  is_favorite: boolean;
  used_count: number;
  created_at: string;
}

export type CaptionTone = 'professional' | 'casual' | 'friendly' | 'enthusiastic' | 'humorous' | 'inspirational' | 'formal' | 'conversational';
export type CaptionLength = 'short' | 'medium' | 'long' | 'extra_long';
export type CaptionPlatform = 'general' | 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'pinterest';
export type TemplateCategory = 'product' | 'promotion' | 'event' | 'announcement' | 'engagement' | 'educational' | 'behind_scenes' | 'testimonial' | 'holiday' | 'motivational';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerateCaptionRequest {
  input_text?: string;
  topic?: string; // Alias for input_text
  tone: CaptionTone;
  length: CaptionLength;
  platform: CaptionPlatform;
  include_hashtags: boolean;
  include_emojis: boolean;
  include_cta: boolean;
  custom_instructions?: string;
  media_file?: File;
}

// Type alias for service responses
export type GeneratedCaption = CaptionGeneration;

// ============================================
// AI IMAGE TYPES
// ============================================

export interface UserImageSettings {
  id: number;
  user: number;
  gemini_api_key?: string;
  openai_api_key?: string;
  default_provider: 'gemini' | 'openai';
  default_style: ImageStyle;
  default_size: ImageSize;
  openai_model: 'gpt-image-1.5' | 'dall-e-3' | 'dall-e-2';
  openai_quality: 'standard' | 'hd';
  total_images_generated: number;
  total_api_calls: number;
  openai_images_generated: number;
  gemini_images_generated: number;
  created_at: string;
  updated_at: string;
}

export interface UserLogo {
  id: number;
  user: number;
  name: string;
  logo_file: string;
  is_default: boolean;
  created_at: string;
}

export interface ImageGeneration {
  id: number;
  user: number;
  provider: 'gemini' | 'openai';
  model_used?: string;
  title: string;
  prompt: string;
  negative_prompt?: string;
  style: ImageStyle;
  size: ImageSize;
  quality: ImageQuality;
  // Logo options
  logo?: number;
  logo_position: LogoPosition;
  logo_size: number;
  logo_opacity: number;
  // Product options
  product_image?: string;
  product_position: ProductPosition;
  product_scale: number;
  composited_image?: string;
  // Generation options
  seed?: number;
  enhance_prompt: boolean;
  add_lighting?: LightingStyle;
  camera_angle?: CameraAngle;
  // Output
  generated_image?: string;
  generated_image_with_logo?: string;
  enhanced_prompt?: string;
  revised_prompt?: string;
  status: GenerationStatus;
  error_message?: string;
  processing_time: number;
  created_at: string;
  updated_at: string;
  // Prompt engineering metadata
  brand_style_anchor?: string;
  prompt_engineering_used?: boolean;
  failure_codes?: string[] | null;
  reprompt_attempt?: number;
}

export interface SavedImage {
  id: number;
  user: number;
  image_generation?: number;
  title: string;
  image_file: string;
  prompt?: string;
  is_favorite: boolean;
  download_count: number;
  created_at: string;
}

export interface PromptTemplate {
  id: number;
  user?: number;
  is_global: boolean;
  name: string;
  category: ImageCategory;
  prompt_template: string;
  negative_prompt?: string;
  recommended_style: ImageStyle;
  recommended_size: ImageSize;
  preview_image?: string;
  created_at: string;
  updated_at: string;
}

export type ImageStyle = 'realistic' | 'artistic' | 'anime' | 'cartoon' | '3d_render' | 'watercolor' | 'oil_painting' | 'digital_art' | 'pixel_art' | 'sketch' | 'cinematic' | 'photographic' | 'comic_book' | 'fantasy' | 'minimalist' | 'abstract' | 'vintage';
export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792' | '512x512' | '256x256' | '1080x1080' | '1080x1920' | '1920x1080' | '800x800' | '1200x628';
export type ImageQuality = 'standard' | 'high' | 'hd' | 'ultra';
export type LogoPosition = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center' | 'top_center' | 'bottom_center' | 'none';
export type ProductPosition = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'auto';
export type LightingStyle = 'natural' | 'studio' | 'dramatic' | 'soft' | 'golden_hour' | 'neon' | 'backlit' | 'ambient';
export type CameraAngle = 'front' | 'side' | 'top_down' | 'low_angle' | 'high_angle' | 'dutch_angle' | 'close_up' | 'wide_shot' | 'macro';
export type ImageCategory = 'product' | 'social_media' | 'marketing' | 'portrait' | 'landscape' | 'abstract' | 'food' | 'fashion' | 'technology' | 'nature';

export interface GenerateImageRequest {
  title: string;
  prompt: string;
  negative_prompt?: string;
  provider: 'gemini' | 'openai';
  style: ImageStyle;
  size: ImageSize;
  quality: ImageQuality;
  logo_id?: number;
  logo_position?: LogoPosition;
  logo_size?: number;
  logo_opacity?: number;
  product_image?: File;
  product_position?: ProductPosition;
  product_scale?: number;
  seed?: number;
  enhance_prompt?: boolean;
  add_lighting?: LightingStyle;
  camera_angle?: CameraAngle;
}

// ============================================
// AI VIDEO TYPES
// ============================================

export interface UserVideoSettings {
  id: number;
  user: number;
  gemini_api_key?: string;
  default_style: VideoStyle;
  default_duration: VideoDuration;
  default_resolution: VideoResolution;
  total_videos_generated: number;
  total_api_calls: number;
  total_duration_generated: number;
  created_at: string;
  updated_at: string;
}

export interface VideoLogo {
  id: number;
  user: number;
  name: string;
  logo_file: string;
  is_default: boolean;
  created_at: string;
}

export interface VideoGeneration {
  id: number;
  user: number;
  title: string;
  prompt: string;
  negative_prompt?: string;
  style: VideoStyle;
  duration: VideoDuration;
  resolution: VideoResolution;
  aspect_ratio: AspectRatio;
  fps: VideoFPS;
  // Logo options
  logo?: number;
  logo_position: LogoPosition;
  logo_size: number;
  logo_opacity: number;
  // Generation options
  seed?: number;
  enhance_prompt: boolean;
  camera_motion?: CameraMotion;
  motion_intensity?: MotionIntensity;
  // Output
  generated_video?: string;
  generated_video_with_logo?: string;
  thumbnail?: string;
  enhanced_prompt?: string;
  status: GenerationStatus;
  error_message?: string;
  processing_time: number;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface SavedVideo {
  id: number;
  user: number;
  video_generation?: number;
  title: string;
  video_file: string;
  thumbnail?: string;
  prompt?: string;
  duration: number;
  is_favorite: boolean;
  download_count: number;
  created_at: string;
}

export interface VideoPromptTemplate {
  id: number;
  user?: number;
  is_global: boolean;
  name: string;
  category: VideoCategory;
  prompt_template: string;
  negative_prompt?: string;
  recommended_style: VideoStyle;
  recommended_duration: VideoDuration;
  recommended_aspect_ratio: AspectRatio;
  preview_thumbnail?: string;
  created_at: string;
  updated_at: string;
}

export type VideoStyle = 'realistic' | 'cinematic' | 'anime' | 'cartoon' | '3d_animation' | 'stop_motion' | 'documentary' | 'music_video' | 'commercial' | 'vlog' | 'timelapse' | 'slow_motion' | 'abstract' | 'vintage' | 'futuristic';
export type VideoDuration = 3 | 5 | 8 | 10 | 15 | 30;
export type VideoResolution = '480p' | '720p' | '1080p' | '4k';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
export type VideoFPS = 24 | 30 | 60;
export type CameraMotion = 'static' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'dolly_in' | 'dolly_out' | 'orbit' | 'crane' | 'handheld';
export type MotionIntensity = 'subtle' | 'gentle' | 'moderate' | 'dynamic' | 'extreme';
export type VideoCategory = 'product' | 'social_media' | 'marketing' | 'explainer' | 'tutorial' | 'testimonial' | 'event' | 'intro_outro' | 'lifestyle' | 'nature' | 'abstract';

export interface GenerateVideoRequest {
  title: string;
  prompt: string;
  negative_prompt?: string;
  style: VideoStyle;
  duration: VideoDuration;
  resolution: VideoResolution;
  aspect_ratio: AspectRatio;
  fps: VideoFPS;
  logo_id?: number;
  logo_position?: LogoPosition;
  logo_size?: number;
  logo_opacity?: number;
  seed?: number;
  enhance_prompt?: boolean;
  camera_motion?: CameraMotion;
  motion_intensity?: MotionIntensity;
}

// ============================================
// MESSENGER BOT TYPES
// ============================================

export interface MessengerConnection {
  id: number;
  user: number;
  page_id: string;
  page_name: string;
  page_access_token: string;
  verify_token: string;
  webhook_url?: string;
  is_webhook_verified: boolean;
  is_active: boolean;
  auto_reply_enabled: boolean;
  greeting_text: string;
  website_url?: string;
  connected_at: string;
  last_synced: string;
  ai_config?: AIConfiguration;
}

export interface AIConfiguration {
  id: number;
  connection: number;
  openai_api_key: string;
  openai_model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
  embedding_model: string;
  rag_enabled: boolean;
  top_k_results: number;
  similarity_threshold: number;
  temperature: number;
  max_tokens: number;
  image_understanding_enabled: boolean;
  voice_transcription_enabled: boolean;
  voice_reply_enabled: boolean;
  voice_model: VoiceModel;
  created_at: string;
  updated_at: string;
}

export interface PDFKnowledgeBase {
  id: number;
  connection: number;
  file: string;
  filename: string;
  file_size: number;
  status: GenerationStatus;
  total_chunks: number;
  total_pages: number;
  vectorized_at?: string;
  uploaded_at: string;
  error_message?: string;
}

export interface CustomPrompt {
  id: number;
  connection: number;
  name: string;
  system_prompt: string;
  tone: PromptTone;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  connection: number;
  sender_id: string;
  sender_name?: string;
  sender_profile_pic?: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  is_active: boolean;
  human_takeover: boolean;
  messages?: Message[];
}

export interface Message {
  id: number;
  conversation: number;
  message_type: MessageType;
  sender: 'user' | 'bot';
  text?: string;
  image_url?: string;
  file_url?: string;
  rag_context_used?: string;
  prompt_used?: string;
  model_used?: string;
  tokens_used: number;
  processing_time: number;
  image_description?: string;
  timestamp: string;
  delivered: boolean;
  read: boolean;
  failed: boolean;
  error_message?: string;
}

export interface Notification {
  id: number;
  connection: number;
  conversation: number;
  message: number;
  notification_type: NotificationType;
  title: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  is_read: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export type VoiceModel = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type PromptTone = 'professional' | 'casual' | 'friendly' | 'technical' | 'sales' | 'support';
export type MessageType = 'text' | 'image' | 'file' | 'sticker' | 'quick_reply' | 'voice' | 'audio' | 'video' | 'location';
export type NotificationType = 'product_inquiry' | 'appointment' | 'order' | 'urgent' | 'complaint' | 'pricing' | 'availability' | 'contact' | 'general';

// ============================================
// E-COMMERCE TYPES
// ============================================

export interface ECommerceSettings {
  id: number;
  connection: number;
  platform_type: 'woocommerce' | 'shopify' | 'custom';
  store_url: string;
  consumer_key?: string;
  consumer_secret?: string;
  is_enabled: boolean;
  product_match_threshold: number;
  currency_symbol: string;
  last_synced?: string;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface EComProduct {
  id: number;
  woo_product_id: number;
  name: string;
  price: string;
  sale_price?: string;
  sku: string;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity?: number;
  first_image?: string;
  categories: { id: number; name: string; slug: string }[];
  synced_at: string;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface Analytics {
  id: number;
  user: number;
  post?: number;
  platform: PlatformType;
  metric_type: MetricType;
  metric_value: number;
  recorded_at: string;
  updated_at: string;
}

export type MetricType = 'likes' | 'shares' | 'comments' | 'views' | 'clicks' | 'impressions' | 'engagement_rate';

export interface AnalyticsSummary {
  total_likes: number;
  total_shares: number;
  total_comments: number;
  total_views: number;
  total_impressions: number;
  engagement_rate: number;
  by_platform: Partial<Record<PlatformType, PlatformAnalytics>>;
  by_post: PostAnalytics[];
  trends: AnalyticsTrend[];
}

export interface PlatformAnalytics {
  platform: PlatformType;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  impressions: number;
  engagement_rate: number;
  post_count: number;
}

export interface PostAnalytics {
  post_id: number;
  caption_preview: string;
  platforms: PlatformType[];
  total_engagement: number;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  posted_at: string;
}

export interface AnalyticsTrend {
  date: string;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  posts_count: number;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  total_posts: number;
  scheduled_posts: number;
  posted_posts: number;
  failed_posts: number;
  posts_this_month: number;
  connected_accounts: number;
  subscription_plan: SubscriptionPlan;
  max_posts_per_month: number;
  max_social_accounts: number;
  // Extended stats
  captions_generated: number;
  images_generated: number;
  videos_generated: number;
  messenger_messages: number;
  total_engagement: number;
  top_platform?: PlatformType;
}

// ============================================
// AUTH TYPES
// ============================================

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  phone?: string;
  company?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ============================================
// FILTER TYPES
// ============================================

export interface PostFilters {
  status?: PostStatus;
  platform?: PlatformType;
  search?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
  start_date?: string;
  end_date?: string;
}

export interface CaptionFilters {
  status?: GenerationStatus;
  tone?: CaptionTone;
  platform?: CaptionPlatform;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ImageFilters {
  status?: GenerationStatus;
  provider?: 'gemini' | 'openai';
  style?: ImageStyle;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface VideoFilters {
  status?: GenerationStatus;
  style?: VideoStyle;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ConversationFilters {
  is_active?: boolean;
  human_takeover?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AnalyticsFilters {
  platform?: PlatformType;
  metric_type?: MetricType;
  start_date?: string;
  end_date?: string;
  post_id?: number;
}

// ============================================
// ADMIN PANEL TYPES
// ============================================

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  last_login: string | null;
  is_active: boolean;
  is_approved: boolean;
  plan: string;
  company: string;
  api_mode: string;
  post_count: number;
  account_count: number;
  total_tokens: number;
  estimated_cost: number;
  caption_tokens?: number;
}

export interface AdminDashboardStats {
  total_users: number;
  pending_users: number;
  approved_users: number;
  total_posts: number;
  total_social_accounts: number;
  total_captions: number;
  total_images: number;
  total_videos: number;
  total_connections: number;
  total_conversations: number;
  total_messages: number;
  total_tokens: number;
  estimated_cost: number;
  pending_approvals: AdminUser[];
  top_users: AdminUser[];
  plan_distribution: { plan: string; count: number }[];
  recent_posts: {
    id: number;
    caption: string;
    status: string;
    platforms: string;
    created_at: string;
    username: string;
  }[];
}

export interface AdminUserDetail {
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    is_staff: boolean;
    date_joined: string;
    last_login: string | null;
  };
  profile: Record<string, unknown>;
  stats: {
    posts: number;
    accounts: number;
    captions: number;
    images: number;
    videos: number;
    conversations: number;
    messages: number;
  };
  tokens: {
    caption: number;
    messenger: number;
    total: number;
    cost: number;
  };
}

export interface AdminAPISettings {
  caption: {
    has_key: boolean;
    key_preview: string | null;
    model: string;
    tokens: number;
  };
  image: {
    has_key: boolean;
    key_preview: string | null;
    style: string;
  };
  video: {
    has_key: boolean;
    key_preview: string | null;
    style: string;
  };
  messenger: {
    page: string | null;
    has_key: boolean;
    key_preview: string | null;
    model: string;
  };
  admin_managed: boolean;
  admin_openai: string | null;
  admin_gemini: string | null;
}

export interface AdminAnalyticsData {
  days: number;
  daily_posts: { date: string; count: number }[];
  daily_captions: { date: string; count: number; tokens: number }[];
  top_users: {
    id: number;
    username: string;
    caption_tokens: number;
    posts: number;
    captions: number;
  }[];
  platform_stats: {
    facebook: number;
    instagram: number;
    twitter: number;
    linkedin: number;
  };
}

// ============================================
// V1.2.1 TYPES
// ============================================

export interface ContentPillar {
  id: number;
  brand: number;
  name: string;
  description: string;
  target_percentage: number;
  color_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostCaptionV2 {
  id: number;
  post: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'all';
  variant_number: number;
  body: string;
  cta_text: string;
  tone: string;
  char_count: number;
  is_selected: boolean;
  is_ab_test: boolean;
  ab_label: 'A' | 'B' | null;
  image_prompt?: string;
  generation_prompt_hash: string;
  created_at: string;
  updated_at: string;
}

export type HashtagTier = 'high_volume' | 'mid_volume' | 'niche';
export type HashtagPlacement = 'inline' | 'end_of_caption' | 'first_comment';

export interface PostHashtag {
  id: number;
  post: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  tag: string;
  tier: HashtagTier;
  estimated_volume: number;
  is_selected: boolean;
  placement: HashtagPlacement;
  created_at: string;
}

export interface HashtagGroup {
  id: number;
  brand: number;
  name: string;
  tags: string[];
  created_by: number;
  created_at: string;
}

export interface BannedHashtag {
  id: number;
  brand: number;
  tag: string;
  reason: string;
  added_by: number;
  created_at: string;
}

export type ScheduledPlatformStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface ScheduledPostPlatform {
  id: number;
  post: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  caption?: number;
  caption_body?: string;
  hashtag_placement: HashtagPlacement;
  scheduled_at: string;
  timezone: string;
  status: ScheduledPlatformStatus;
  asset_variant?: number;
  publish_result_json: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  created_by: number;
  created_at: string;
  published_at?: string;
}

export type SnapshotType = '24h' | '48h' | 'daily' | 'weekly';

export interface PostAnalyticsV2 {
  id: number;
  post: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  platform_post_id: string;
  snapshot_type: SnapshotType;
  impressions: number;
  reach: number;
  engagement_rate: number;
  likes: number;
  comments_count: number;
  shares: number;
  clicks: number;
  saves: number;
  profile_visits: number;
  data_json: Record<string, unknown>;
  fetched_at: string;
}

export type CommentSentiment = 'positive' | 'neutral' | 'negative';

export interface PostComment {
  id: number;
  post: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  platform_comment_id: string;
  author_name: string;
  author_handle: string;
  body: string;
  sentiment: CommentSentiment;
  replied: boolean;
  reply_type?: 'ai' | 'human';
  reply_body: string;
  replied_at?: string;
  fetched_at: string;
}

export type LearningSignalType =
  | 'best_hook'
  | 'best_time'
  | 'best_format'
  | 'best_pillar'
  | 'worst_hook'
  | 'worst_time'
  | 'worst_format'
  | 'ab_winner'
  | 'winner';

export interface LearningSignal {
  id: number;
  brand: number;
  signal_type: LearningSignalType;
  reference_id: string;
  data_json: Record<string, unknown>;
  applied: boolean;
  created_at: string;
}

export type RepurposeFormat = 'carousel' | 'thread' | 'reel' | 'email' | 'blog_outline';

export interface RepurposedContent {
  id: number;
  original_post: number;
  new_post: number;
  repurpose_format: RepurposeFormat;
  created_at: string;
}

export type ApprovalAction = 'submitted' | 'approved' | 'changes_requested' | 'rejected' | 'escalated';
export type RejectionReason = 'off_brand' | 'compliance_issue' | 'quality' | 'factual_error' | 'timing' | 'other';

export interface ApprovalLog {
  id: number;
  post: number;
  action: ApprovalAction;
  acted_by: number;
  acted_by_username?: string;
  comment: string;
  rejection_reason?: RejectionReason;
  created_at: string;
}

export interface BestTimeSuggestion {
  id: number;
  brand: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  day_of_week: number;
  hour_utc: number;
  score: number;
  source: 'own_data' | 'industry_default' | 'competitor_analysis';
  computed_at: string;
  reason?: string;
}

export interface AssetPlatformVariant {
  id: number;
  asset: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  format_label: string;
  file_url?: string;
  dimensions: string;
  created_at: string;
}

export interface CreativeVersionHistory {
  id: number;
  asset: number;
  version: number;
  file_url?: string;
  generation_params: Record<string, unknown>;
  created_at: string;
}

export type NotificationEventType =
  | 'approval_submitted'
  | 'content_approved'
  | 'changes_requested'
  | 'content_rejected'
  | 'sla_breach'
  | 'reply_sla_breach'
  | 'winner_detected'
  | 'images_ready'
  | 'repurpose_suggestion'
  | 'weekly_report'
  | 'batch_complete'
  | 'token_expiring';

export interface SystemNotification {
  id: number;
  user: number;
  event_type: NotificationEventType;
  title: string;
  message: string;
  data_json: Record<string, unknown>;
  channel: 'in_app' | 'email' | 'both';
  is_read: boolean;
  created_at: string;
}

export type WorkspaceRole = 'admin' | 'creator' | 'approver' | 'publisher' | 'viewer';

export interface UserRole {
  id: number;
  user: number;
  username?: string;
  workspace: number;
  role: WorkspaceRole;
  granted_by?: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReport {
  id: number;
  brand: number;
  workspace?: number;
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  winners: Record<string, unknown>[];
  losers: Record<string, unknown>[];
  best_hooks: string[];
  best_times: Record<string, unknown>[];
  pillar_performance: Record<string, unknown>;
  ab_test_results: Record<string, unknown>[];
  recommendations: string[];
  test_plan: string[];
  generated_at: string;
}

export interface CompetitorProfile {
  id: number;
  brand: number;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  handle_or_url: string;
  last_crawled_at?: string;
  created_at: string;
}

// ============================================
// V1.3 — OVERFLOW, TRENDING, DNA HISTORY
// ============================================

export interface OverflowProgress {
  current_step: number;
  completed_steps: number[];
  dna_completed: boolean;
  pillars_completed: boolean;
  competitors_completed: boolean;
  trending_completed: boolean;
  selected_idea_ids: number[];
  idea_media_preferences: Record<number, 'image' | 'video' | 'none'>;
  selected_caption_ids: number[];
  generated_media_ids: number[];
  created_post_id: number | null;
  is_completed: boolean;
  is_skipped: boolean;
  brand_id: number | null;
}

export interface BrandDNAHistoryEntry {
  id: number;
  website_url: string;
  source: string;
  is_active: boolean;
  generated_at: string;
  brand_name: string;
  industry: string;
  dna_data?: Record<string, any>;
}

export interface TrendingTopic {
  id: number;
  platform: string;
  topic: string;
  volume_score: number;
  region: string;
  relevance_explanation?: string;
  expires_at: string;
  category?: string;
}

export interface TrendFeedback {
  id: number;
  topic_text: string;
  is_accepted: boolean;
  source_trending_id?: number;
  created_at: string;
}

export interface CompetitorSuggestion {
  name: string;
  platform: string;
  handle_or_url: string;
  reason: string;
}

export interface IdeaHistoryItem {
  id: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  goal: string;
  content_format: string;
  status: string;
  pillar_name: string;
  engagement_tier: string;
  source: string;
  media_preference: string;
  brand_name: string;
  created_at: string;
}


// ============================================
// DIAMOND TOKEN TYPES
// ============================================

export interface DiamondWallet {
  balance: number;
  total_recharged: number;
  total_spent: number;
  last_recharge_at: string | null;
}

export interface DiamondTransaction {
  id: number;
  amount: number;
  transaction_type: 'recharge' | 'deduction' | 'refund' | 'plan_grant';
  balance_after: number;
  feature: string;
  provider: string;
  raw_tokens: number;
  model_used: string;
  note: string;
  created_at: string;
}

export interface DiamondUsageBreakdown {
  balance: number;
  by_feature: { feature: string; diamonds_spent: number; count: number }[];
  by_provider: { provider: string; diamonds_spent: number; raw_tokens: number }[];
  total_spent_today: number;
  total_spent_this_month: number;
}

export interface DiamondCostPreview {
  feature: string;
  diamond_cost: number;
  balance: number;
  can_afford: boolean;
}

export interface DiamondCosts {
  costs: Record<string, number>;
  plan_grants: Record<string, number>;
}

export interface GlobalAPIKeysStatus {
  openai: { is_set: boolean; is_active: boolean; masked_key: string; updated_at: string | null };
  gemini: { is_set: boolean; is_active: boolean; masked_key: string; updated_at: string | null };
  claude: { is_set: boolean; is_active: boolean; masked_key: string; updated_at: string | null };
}
