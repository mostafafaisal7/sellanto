# SocialSync-AI — Deep Project Analysis
## Complete Codebase, Features & Architecture Reference

---

## 1. WHAT IS THIS PROJECT?

**SocialSync-AI** is a Django-based **SaaS Social Media Management Platform** with AI-powered content generation. It is a full-stack product: Django REST API + React SPA (served as Django template catch-all).

**Key Value Props:**
- Multi-tenant workspace management with RBAC
- AI content generation: captions, images, videos, voice — all in one platform
- Full post lifecycle: draft → approval → schedule → publish
- Facebook Messenger AI chatbot with RAG knowledge base
- Brand DNA system for consistent AI-generated content

---

## 2. TECH STACK

| Layer | Technology |
|-------|-----------|
| Backend | Django 6.0.3 + DRF 3.16.1 |
| Database (Dev) | SQLite |
| Database (Prod) | MySQL (config available, commented out) |
| Auth | JWT via `djangorestframework-simplejwt` |
| AI Primary | Claude (Anthropic) via `anthropic==0.84.0` |
| AI Secondary | OpenAI GPT-4o via `openai==1.97.0` |
| AI Tertiary | Google Gemini 2.0 Flash (REST API) |
| Image Gen | DALL-E 3 (OpenAI) + Gemini Imagen |
| Video Gen | Gemini Veo (exclusively) |
| Voice Gen | OpenAI TTS (exclusively) |
| Image Processing | Pillow 10.3.0 + moviepy 2.2.1 |
| RAG | LangChain 0.3.26 + ChromaDB 1.0.15 + sentence-transformers 5.0.0 |
| PDF | pdfplumber 0.11.7 |
| Frontend | React (pre-built, served from `/frontend/dist/`) |
| Static Files | WhiteNoise 6.12.0 |
| Production Server | Gunicorn 23.0.0 |
| Task Scheduling | APScheduler 3.11.0 (usage unclear) |
| API Docs | drf-spectacular (Swagger at `/doc/api/`) |

---

## 3. PROJECT FILE STRUCTURE

```
/sellanto
├── socialsync/                        # Django project config
│   ├── settings.py                    # Main settings (233 lines)
│   ├── urls.py                        # Root URL routing
│   ├── middleware.py                  # ImpersonationMiddleware
│   └── authentication.py             # ImpersonatingJWTAuthentication
│
├── api/                               # Central REST API
│   ├── views.py                       # Main views (3659 lines — MONOLITH)
│   ├── serializers.py                 # All serializers (~68KB)
│   ├── urls.py                        # 250+ endpoints
│   ├── admin_views.py                 # Admin panel views
│   ├── strategy_views.py              # Content strategy (pillars, ideas, trending)
│   ├── caption_views.py               # Caption management views
│   ├── hashtag_views.py               # Hashtag management views
│   ├── approval_views.py              # Approval workflow views
│   ├── scheduling_views.py            # Scheduling views
│   ├── analytics_views.py             # Analytics views
│   ├── notification_views.py          # Notification views
│   ├── creative_views.py              # Creative asset management
│   └── rbac_views.py                  # Role-based access control
│
├── accounts/                          # Auth & User profiles
│   ├── models.py                      # UserProfile, UserRole, SystemNotification
│   └── services/
│       └── llm_service.py             # Unified LLM Service (607 lines)
│
├── brands/                            # Multi-tenant brands
│   └── models.py                      # Workspace, Brand, ContentPillar, etc.
│
├── posts/                             # Post creation & scheduling
│   └── models.py                      # Post, PostCaption, PostHashtag, etc.
│
├── platforms/                         # Social account credentials
│   └── models.py                      # SocialAccount (9 platforms)
│
├── ai_caption/                        # Caption generation
│   └── models.py                      # UserAPISettings, CaptionGeneration
│
├── ai_image/                          # Image generation
│   └── models.py                      # ImageGeneration, UserLogo, AssetPlatformVariant
│
├── ai_video/                          # Video generation
│   └── models.py                      # VideoGeneration, VideoLogo
│
├── ai_voice/                          # Voice/TTS generation
│   └── models.py                      # VoiceGeneration, UserVoiceSettings
│
├── analytics/                         # Post performance analytics
│   └── models.py                      # PostAnalytics, PostComment, LearningSignal
│
├── messenger_bot/                     # Facebook Messenger AI chatbot
│   ├── views.py                       # Webhook + API (920 lines)
│   ├── models.py                      # MessengerConnection, PDFKnowledgeBase, etc.
│   └── services/                      # RAGEngine, MessageHandler, WooCommerceService, PDFProcessor
│
├── onboarding/                        # 7-step user onboarding
│   └── models.py                      # OnboardingProgress
│
├── admin_panel/                       # Admin dashboard app
│   └── models.py
│
├── frontend/
│   └── dist/                          # Pre-built React SPA
│
├── media/                             # User uploads
├── static/                            # CSS/JS/Images
├── staticfiles/                       # Collected static files
└── requirements.txt                   # Python deps (200+ packages)
```

---

## 4. DATABASE ARCHITECTURE (All Models)

### accounts/models.py
| Model | Purpose | Key Fields |
|-------|---------|-----------|
| SiteConfiguration | Platform config key-value store | key, value, is_active |
| UserProfile | Extended user data (1-1 with User) | subscription_plan, api_mode, usage counters, limits |
| APIUsageLog | AI API cost tracking | user, service, feature, tokens_used, estimated_cost |
| SupportDocument | Help doc PDFs with auto-extracted text | title, file, extracted_text, is_active |
| SystemNotification | In-app event notifications | user, event_type, title, message, is_read, data_json |
| UserRole | RBAC workspace assignments | user, workspace, role(6 choices), granted_by |

**subscription_plan**: free, starter, pro, business, enterprise
**api_mode**: admin (use global admin keys), user (use own keys)
**UserRole.role**: owner, admin, creator, approver, publisher, viewer

### brands/models.py
| Model | Purpose | Key Fields |
|-------|---------|-----------|
| Workspace | Top-level multi-tenant container | owner, name, timezone, team_size, max_generations_per_day, generations_today |
| Brand | Brand profile with DNA | workspace, user, brand_name, industry, website_url, brand_dna(JSON), is_primary, brand_dna_source |
| BrandAsset | Brand files (logos, fonts, etc.) | brand, file, asset_type |
| LaunchPlan | Content strategy settings (1-1 with Brand) | post_frequency, formats_allowed, variant_generation_level, approval_required |
| ContentIdea | AI-generated content ideas | brand, user, title, hook, angle, platform, status, pillar, source, engagement_tier |
| ContentApproval | Post approval records | post, submitted_by, approver, status, compliance_checklist, version |
| ApprovalLog | Full approval audit trail | approval, action, actor, comment, created_at |
| WeeklyReport | Structured analytics reports | brand, workspace, period_start, winners, losers, best_hooks, recommendations |
| GenerationUsage | Daily AI generation tracking | workspace, generation_type, date, count |
| ContentPillar | Content strategy pillars | brand, name, target_percentage, color_code, is_active |
| CompetitorProfile | Competitor handles per platform | brand, platform, handle_or_url, last_crawled_at |
| CompetitorInsight | Extracted competitor data | competitor_profile, hook_text, engagement_score |
| BrandTemplate | Reusable overlay templates | brand, template_data(JSON) |
| BrandDNAChunk | RAG chunks from DNA generation | brand, text, chunk_type, embedding(JSON) |
| BrandDNAHistory | DNA version history for restore | brand, brand_dna(JSON), is_active, source, created_at |
| TrendingCache | Cached Google Trends results | brand, platform, topics(JSON) |

**Brand DNA sources**: website, pdf, manual, structured
**ContentIdea.status**: new, saved, skipped, drafted, scheduled
**ContentApproval.status**: pending, approved, changes_requested, rejected
**LaunchPlan.variant_generation_level**: off, low(1), medium(2), high(3)

### posts/models.py
| Model | Purpose | Key Fields |
|-------|---------|-----------|
| Post | Core post object | user, caption, status, platforms(JSON), media_files(JSON), scheduled_time, brand, idea, checklist_status(JSON) |
| PostCaption | Per-platform caption variants | post, platform, variant_number, body, is_selected, is_ab_test, ab_label, char_count |
| PostHashtag | Hashtag management | post, platform, tag, tier, estimated_volume, is_selected, placement |
| HashtagGroup | Saved reusable hashtag sets | brand, name, tags(JSON) |
| BannedHashtag | Brand-level hashtag blacklist | brand, tag, reason, added_by |
| ScheduledPostPlatform | Per-platform scheduling | post, platform, caption(FK), asset_variant(FK), scheduled_at, timezone, status, retry_count |

**Post.status flow**: draft → pending_approval → approved/rejected → scheduled → posted/failed
**PostHashtag.tier**: high_volume, mid_volume, niche
**PostHashtag.placement**: inline, end_of_caption, first_comment
**Platform char limits**: twitter=280, linkedin=3000, facebook=63206, instagram=2200

### platforms/models.py
| Model | Purpose |
|-------|---------|
| SocialAccount | OAuth credentials for 9 platforms |

**Platforms**: facebook, twitter, instagram, linkedin, tiktok, youtube, pinterest, telegram, messenger
**Status**: active, expired, invalid, disconnected
**Key methods**: `get_credentials()`, `is_token_expired()`, `mark_as_expired/invalid/active()`

### ai_caption/models.py
| Model | Key Fields |
|-------|-----------|
| UserAPISettings | user(1-1), _openai_api_key(base64), default_llm_provider, default_model |
| CaptionGeneration | user, input_text, tone, length, platform, generated_caption, generated_hashtags, status, tokens_used |
| CaptionTemplate | user, is_global, name, template_text, tone, platform |
| SavedCaption | user, caption_generation, caption_text, is_favorite |

**Tone choices**: professional, casual, friendly, enthusiastic, humorous, inspirational, formal, conversational
**Length choices**: short(20-40w), medium(40-80w), long(80-120w), extra_long(120-200w)
**Platform choices**: general, facebook, instagram, twitter, linkedin, tiktok, youtube, pinterest

### ai_image/models.py
| Model | Key Fields |
|-------|-----------|
| UserImageSettings | user(1-1), default_provider, default_style, default_size, _openai_api_key(base64), _gemini_api_key(base64) |
| UserLogo | user, name, logo_file, is_default |
| ImageGeneration | user, post(FK), provider, style, size, quality, logo(FK), logo_position, logo_opacity, generated_image, composited_image, generated_image_with_logo, copy_overlay_image, copy_overlay_text, copy_overlay_settings(JSON), brand_style_anchor, prompt_engineering_used |
| SavedImage | user, image_generation, is_favorite |
| PromptTemplate | user, is_global, category, prompt_template |
| AssetPlatformVariant | asset(FK→ImageGeneration), platform, format_label, file_url, dimensions |
| CreativeVersionHistory | asset(FK), version, file_url, generation_params(JSON) |

**17 styles**: realistic, artistic, anime, cartoon, 3d_render, watercolor, oil_painting, digital_art, pixel_art, sketch, cinematic, fantasy, minimalist, vintage, neon, vivid, natural
**Logo positions**: none, top_left, top_right, top_center, bottom_left, bottom_right, bottom_center, center
**Platform dims**: instagram_feed=1080x1080, instagram_story=1080x1920, linkedin_feed=1200x627, twitter_feed=1200x675, facebook_feed=1200x630
**`get_display_image()`**: copy_overlay > composited > with_logo > original

### ai_video/models.py
| Model | Key Fields |
|-------|-----------|
| UserVideoSettings | user(1-1), default_style, default_duration, default_resolution, _gemini_api_key(base64) |
| VideoLogo | user, name, logo_file, is_default |
| VideoGeneration | user, style, duration, aspect_ratio, fps, camera_motion, motion_intensity, generated_video, generated_video_with_logo, thumbnail, reference_image, status |
| SavedVideo | user, video_generation, is_favorite |
| VideoPromptTemplate | user, is_global, category, prompt_template |

**15 video styles**: realistic, cinematic, anime, cartoon, 3d_animation, artistic, vintage, slow_motion, timelapse, documentary, sci_fi, fantasy, horror, comedy, music_video
**Aspect ratios**: 16:9, 9:16, 1:1, 4:3, 21:9
**Camera motion**: static, pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, orbit, dolly, crane, handheld
**Motion intensity**: subtle, moderate, dynamic, intense
**Durations**: 3, 5, 8, 10, 15 seconds
**Provider**: Gemini Veo exclusively

### ai_voice/models.py
| Model | Key Fields |
|-------|-----------|
| UserVoiceSettings | user(1-1), openai_api_key(PLAINTEXT!), default_voice, default_speed, default_model, default_format |
| VoiceGeneration | user, input_text, voice, model, speed, output_format, audio_file, duration_seconds, file_size_bytes, characters_used, status |

**Voices**: alloy, echo, fable, onyx, nova, shimmer
**Models**: tts-1 (standard), tts-1-hd (high quality)
**Output formats**: mp3, opus, aac, flac, wav, pcm
**Speed range**: 0.25–4.0x

### analytics/models.py
| Model | Key Fields |
|-------|-----------|
| Analytics | user, post, platform, metric_type, metric_value (V1.1 legacy) |
| PostAnalytics | post, platform, snapshot_type, impressions, reach, likes, comments_count, shares, clicks, saves, engagement_rate |
| PostComment | post, platform, body, sentiment, replied, reply_type |
| LearningSignal | brand, signal_type, reference_id, data_json, applied |
| RepurposedContent | original_post, new_post, repurpose_format |

**snapshot_type**: 24h, 48h, daily, weekly
**sentiment**: positive, neutral, negative
**repurpose_format**: carousel, thread, reel, email, blog_outline
**performance_indicator**: green(>3%), yellow(>1.5%), red

### messenger_bot/models.py
| Model | Key Fields |
|-------|-----------|
| MessengerConnection | user(1-1), page_id, page_access_token, verify_token, website_url |
| AIConfiguration | connection(1-1), openai_api_key, rag_enabled, top_k_results, temperature, voice_enabled |
| PDFKnowledgeBase | connection, file, status, total_chunks (pending/processing/completed/failed) |
| PDFChunk | pdf, text, chunk_index, page_number, embedding(JSON array) |
| CustomPrompt | connection, system_prompt, tone, is_active (only ONE active per connection) |
| Conversation | connection, sender_id, human_takeover |
| Message | conversation, message_type, sender, text, rag_context_used, tokens_used |
| Notification | connection, notification_type, priority, is_read |
| ECommerceSettings | connection(1-1), platform_type(woocommerce/shopify/custom), store_url, consumer_key, consumer_secret |
| Product | ecommerce_settings, name, price, sku, stock_status, description, embedding(JSON) |

### onboarding/models.py
| Model | Key Fields |
|-------|-----------|
| OnboardingProgress | user(1-1), current_step, completed_steps(JSON), is_completed, is_skipped |

**7 steps**: 1=Workspace, 2=Brand Wizard, 3=Connect Platforms, 4=AI Setup, 5=Brand DNA, 6=Launch Plan, 7=Complete

---

## 5. UNIFIED LLM SERVICE

**File**: `accounts/services/llm_service.py` (607 lines)

### LLMResponse dataclass
```python
@dataclass
class LLMResponse:
    success: bool
    content: str = ''
    model: str = ''
    provider: str = ''
    tokens_used: int = 0
    finish_reason: str = ''
    error: str = ''
    thinking: str = ''  # Claude extended thinking output
```

### UnifiedLLMService
```python
chat_completion(messages, model, temperature, max_tokens, response_format, thinking_budget)
  → detects provider from model name prefix
  → Claude: model.startswith('claude') → _claude_completion()
  → Gemini: model.startswith('gemini') → _gemini_completion()
  → else → _openai_completion()
  → falls back to next provider on error

_claude_completion():
  → _to_claude_messages(): extracts system messages, validates alternating roles
  → _ensure_valid_claude_message_order(): deduplicates consecutive same-role
  → if thinking_budget >= 1024: adds {"type":"thinking", "budget_tokens":N}
  → returns LLMResponse

_gemini_completion():
  → REST API (not SDK)
  → _to_gemini_messages(): converts to {role:'user'/'model', parts:[{text}]}
  → systemInstruction passed separately
```

### Model Mappings
```
OPENAI_TO_CLAUDE:
  gpt-4o         → claude-sonnet-4-20250514
  gpt-4o-mini    → claude-haiku-4-5-20251001
  gpt-4-turbo    → claude-sonnet-4-20250514

OPENAI_TO_GEMINI:
  gpt-4o         → gemini-2.0-flash
  gpt-4o-mini    → gemini-2.0-flash-lite
  gpt-4-turbo    → gemini-1.5-pro
```

### get_llm_service(user) factory
```
claude_key  = settings.ANTHROPIC_API_KEY (global — always available)
openai_key  = user.userapisettings.get_openai_api_key() (base64 decoded)
gemini_key  = user.userimagesettings._gemini_api_key (base64 decoded)
→ Returns configured UnifiedLLMService
```

---

## 6. AI GENERATION PIPELINES

### Caption Generation (api/views.py generate_caption ~line 572)
```
1. Parse: topic, tone, length, platform, toggles (hashtags, emojis, CTA)
2. get_openai_key(user) → checks UserAPISettings → admin key → env
3. CaptionGeneration.create(status='processing')
4. If media uploaded → vision model analyzes image/video first
5. CaptionGeneratorService.generate():
   - Builds platform-aware prompt (char limits, style guide)
   - UnifiedLLMService.chat_completion() → Claude by default
   - Extracts caption + hashtags from response
6. Update CaptionGeneration (status='completed', tokens_used, processing_time)
7. UserProfile.captions_this_month += 1
```

### Image Generation (api/views.py generate_image ~line 1277) — 11-step pipeline
```
1. get_openai_key / get_gemini_key
2. ImageGeneration.create(status='processing')
3. Save product_image if uploaded
4. Brand-aware prompt engineering (if brand + enhance=True):
   → ImagePromptEngineerService + Claude extended thinking (10000 token budget)
   → Outputs enhanced prompt + negative prompt + brand_style_anchor
5. ImageService(provider).generate_image():
   → DALL-E 3: openai.images.generate()
   → Gemini: Gemini Imagen API
6. Save generated_image
7. ProductCompositor().composite() (if product_image):
   → Pillow-based compositing at specified position
8. Logo watermarking:
   → Pillow: resize logo → apply opacity → paste at position
   → Saves generated_image_with_logo
9. AssetPlatformVariant auto-creation (5 platform sizes)
10. CreativeVersionHistory.create()
11. Update ImageGeneration (status='completed')

Display priority: copy_overlay_image > composited > with_logo > original
```

### Video Generation (api/views.py generate_video ~line 1599)
```
1. get_gemini_key (Gemini Veo exclusively)
2. VideoGeneration.create(status='processing')
3. Save reference_image if provided
4. GeminiVideoService.generate_video():
   → Builds Veo prompt with all style/motion params
   → Returns video bytes + enhanced prompt
5. Save generated_video
6. GeminiVideoService.generate_thumbnail():
   → moviepy extracts frame at 0s or 1s
7. GeminiVideoService.add_logo_to_video():
   → moviepy overlays logo throughout video
8. Update VideoGeneration (status='completed', total_duration_generated += duration)
```

### Voice Generation (api/views.py generate_voice ~line 2815)
```
1. Get/create UserVoiceSettings
2. get_openai_key (OpenAI TTS exclusively)
3. VoiceGeneration.create(status='processing')
4. openai.audio.speech.create(model, voice, input, speed, response_format)
5. Save audio_file
6. Calculate duration_seconds, file_size_bytes, characters_used
7. Update VoiceGeneration (status='completed')
```

### Brand DNA Generation (api/views.py GenerateBrandDNAView ~line 3004)
```
1. _crawl_site_pages(website_url, max_pages=5):
   → requests + BeautifulSoup
   → Extracts p/h1-h6/li text
   → Follows internal links only
2. UnifiedLLMService.chat_completion():
   → System prompt: extract 15-field DNA as JSON
   → think_harder flag → extended thinking (10000 token budget)
3. Save brand.brand_dna (JSONField)
4. BrandDNAHistory.create(is_active=True)
5. BrandDNAChunk.create() for each DNA field:
   → Generates embeddings via OpenAI text-embedding-3-small
   → Used for messenger bot RAG
```

### Messenger Bot RAG (messenger_bot/services/RAGEngine)
```
MessageHandler.process_message(sender_id, text, image_url):
  1. Get/create Conversation
  2. If human_takeover=True → save Message, skip AI
  3. RAGEngine.generate_response(query, connection, history)
  4. Detect important keywords → create Notification
  5. Send reply via Facebook Send API
  6. Save Message with AI metadata

RAGEngine.retrieve_relevant_chunks(query, connection):
  1. Create embedding for query (OpenAI text-embedding-3-small)
  2. Cosine similarity search: PDFChunk + BrandDNAChunk + Product
  3. Return top_k results above similarity_threshold

RAGEngine.generate_response():
  1. retrieve_relevant_chunks() for context
  2. Load active CustomPrompt for system message
  3. Build message history (last N conversations)
  4. UnifiedLLMService.chat_completion() → Claude default
  5. _clean_markdown() → removes **bold** *italic* for plain text
```

---

## 7. POST WORKFLOW (Complete Lifecycle)

```
DRAFT CREATION
  POST /api/v1/posts/ → PostViewSet.create()
  → Post.status = 'draft'
  → Checklist: {caption: false, hashtags: false, creative: false, alt_text: false, platform_mapping: false}

CONTENT PREPARATION
  POST /drafts/<id>/captions/generate/ → AI generates PostCaption variants per platform
  POST /drafts/<id>/hashtags/generate/ → AI generates PostHashtag with tier metadata
  POST /drafts/<id>/assets/generate/  → ImageGeneration linked to draft
  POST /assets/<id>/copy-overlay/     → Add text to image (V1.2.2)

APPROVAL WORKFLOW (if LaunchPlan.approval_required=True)
  POST /drafts/<id>/submit/           → Post.status = 'pending_approval', ContentApproval created
  GET  /approvals/pending/            → Approver sees queue
  POST /drafts/<id>/approve/          → Post.status = 'approved'
  OR
  POST /drafts/<id>/request-changes/  → Post.status = 'draft' (returned to creator)
  POST /drafts/<id>/reject/           → Post.status = 'rejected'

SCHEDULING
  POST /drafts/<id>/schedule/         → Post.status = 'scheduled', ScheduledPostPlatform created per platform
  → Each platform: linked to specific PostCaption + AssetPlatformVariant
  → APScheduler publishes at scheduled_time

PUBLISHING
  → Post.status = 'posted' on success (platform_post_ids set)
  → Post.status = 'failed' on error (platform_errors set)

ANALYTICS
  → PostAnalytics snapshots at 24h, 48h, daily, weekly
  → LearningSignal extracted from high/low performers
  → WeeklyReport generated per brand
```

---

## 8. RBAC PERMISSION SYSTEM

```python
UserRole model:
  unique_together: (user, workspace, role)

UserRole.has_role(user, workspace, role):
  → Workspace.owner ALWAYS returns True (bypasses role check)
  → Otherwise: UserRole.objects.filter(user, workspace, role).exists()

UserRole.has_any_role(user, workspace, roles):
  → True if user has ANY of the listed roles

Permission checks in views:
  - RBAC validated manually in each view (no decorator pattern)
  - Workspace owner gets full bypass
```

---

## 9. AUTHENTICATION

```
Registration:
  POST /auth/register/          → User + UserProfile (signal) + OnboardingProgress (signal)
  POST /auth/register-with-brand/ → + Workspace + Brand + Brand DNA (LLM)
  Returns: {access, refresh, user, onboarding_status}

Login:
  POST /auth/login/             → Returns JWT pair
  NOTE: is_approved check COMMENTED OUT (any user can login)

Token Lifecycle:
  access: 60 minutes
  refresh: 7 days (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION = True)

Admin Impersonation:
  Header: X-Impersonate-User: <user_id>
  Auth class: ImpersonatingJWTAuthentication (api/authentication.py)
  → Reads is_staff → swaps request.user → NO audit log (SECURITY ISSUE)
```

---

## 10. SUBSCRIPTION PLANS & LIMITS

| Plan | Posts/mo | Captions/mo | Images/mo | Videos/mo | Accounts |
|------|---------|------------|---------|---------|---------|
| free | 10 | 20 | 10 | 5 | 1 |
| starter | 50 | 100 | 50 | 20 | 3 |
| pro | 200 | 500 | 200 | 50 | 5 |
| business | 500 | 1000 | 500 | 100 | 10 |
| enterprise | unlimited | unlimited | unlimited | unlimited | unlimited |

```python
# Limit checking
UserProfile.can_generate_caption() → captions_this_month < max_captions_per_month
UserProfile.increment_usage(field) → F(field)+1 atomic update
UserProfile.reset_monthly_counters() → sets all *_this_month to 0
UserProfile.set_plan(plan_name) → updates limits to plan tier constants

# Daily workspace limit (AI generation)
Workspace.can_generate() → generations_today < max_generations_per_day
Workspace.reset_daily_generations() → resets if generation_date != today
```

---

## 11. API ENDPOINTS SUMMARY

Base: `/api/v1/`  Auth: `Authorization: Bearer <JWT_TOKEN>`

### Core Endpoints
```
Auth:        /auth/register/, /auth/register-with-brand/, /auth/login/, /auth/logout/, /auth/refresh/, /auth/me/
Profile:     /profile/, /profile/api-keys/
Dashboard:   /dashboard/stats/, /dashboard/recent/
Onboarding:  /onboarding/, /onboarding/step/<n>/, /onboarding/skip/
Posts:       /posts/ (ViewSet CRUD)
Platforms:   /platforms/, /platforms-detail/
```

### AI Generation
```
Caption:  /ai-caption/generate/, /ai-caption/regenerate/<id>/, /ai-caption/history/, /ai-caption/settings/
Image:    /ai-image/generate/, /ai-image/refine-prompt/, /ai-image/history/, /ai-image/settings/, /ai-image/logos/, /ai-image/saved/, /ai-image/templates/
Video:    /ai-video/generate/, /ai-video/history/, /ai-video/settings/, /ai-video/logos/, /ai-video/saved/, /ai-video/templates/
Voice:    /ai-voice/generate/, /ai-voice/preview/, /ai-voice/generation/<id>/, /ai-voice/history/, /ai-voice/settings/
Copy:     /copy-overlay/generate-text/, /assets/<id>/copy-overlay/, /assets/<id>/copy-overlay/ai-styles/
```

### Draft Workflow
```
/drafts/<id>/checklist/          GET/POST
/drafts/<id>/captions/           GET
/drafts/<id>/captions/generate/  POST  ← AI-generate per-platform captions
/drafts/<id>/captions/adapt/     POST
/captions/<id>/select/           POST
/captions/<id>/ab-tag/           POST
/drafts/<id>/hashtags/           GET
/drafts/<id>/hashtags/generate/  POST
/hashtags/<id>/                  PUT
/drafts/<id>/assets/generate/    POST
/drafts/<id>/assets/upload/      POST
/drafts/<id>/assets/carousel-split/ POST
/assets/<id>/alt-text/           POST
/assets/<id>/resize/             POST
/assets/<id>/versions/           GET
```

### Approval & Scheduling
```
/drafts/<id>/submit/             POST  → pending_approval
/drafts/<id>/approve/            POST
/drafts/<id>/request-changes/    POST
/drafts/<id>/reject/             POST
/approvals/pending/              GET
/drafts/<id>/approval-log/       GET
/drafts/<id>/schedule/           POST
/scheduled-posts/<id>/           PUT
/schedule/calendar/              GET
/schedule/conflict-check/        POST
/schedule/compute-times/         POST
/brands/<id>/best-times/         GET
```

### Brands & Strategy
```
/workspaces/, /brands/, /brands/<id>/
/brands/<id>/pillar-compliance/
/brands/<id>/competitors/crawl/
/brands/<id>/competitors/insights/
/brands/<id>/pillars/generate/
/brands/<id>/trending/, /brands/<id>/trending/generate/
/brands/<id>/dna-history/, /brands/<id>/dna-history/<id>/restore/
/brands/<id>/prompt-history/
/ideas/generate/, /ideas/<id>/regenerate/, /ideas/history/
/ideas/<id>/add-to-calendar/
/competitors/suggest/
/trending/
/overflow/progress/, /overflow/skip/
```

### Analytics & Reports
```
/analytics/summary/, /analytics/platforms/, /analytics/trends/, /analytics/top-posts/
/posts/<id>/stats/, /posts/<id>/comments/
/comments/<id>/reply/, /comments/<id>/ai-reply/
/brands/<id>/weekly-report/
/brands/<id>/analytics/dashboard/
/brands/<id>/ab-results/, /brands/<id>/learning-signals/, /brands/<id>/winners/
/posts/<id>/repurpose/
```

### Messenger Bot
```
/messenger/dashboard/
/messenger/connections/, /messenger/connections/<id>/config/
/messenger/connections/<id>/pdfs/
/messenger/connections/<id>/conversations/
/messenger/connections/<id>/conversations/<id>/toggle-takeover/
/messenger/connections/<id>/conversations/<id>/send-message/
/messenger/connections/<id>/crawl-website/
/messenger/connections/<id>/ecommerce/
/messenger/connections/<id>/ecommerce/sync/
/messenger/connections/<id>/ecommerce/embeddings/
/messenger/connections/<id>/ecommerce/products/
```

### RBAC & Notifications
```
/workspaces/<id>/roles/, /workspaces/<id>/roles/assign/, /workspaces/<id>/roles/remove/
/my-roles/
/notifications/, /notifications/unread-count/
/notifications/mark-all-read/, /notifications/<id>/read/
```

### Admin (staff only)
```
/admin/dashboard/, /admin/users/, /admin/users/<id>/
/admin/users/<id>/approve/, /admin/users/<id>/reject/, /admin/users/<id>/plan/
/admin/users/<id>/api-settings/
/admin/users/<id>/posts/, /admin/users/<id>/captions/, /admin/users/<id>/images/, /admin/users/<id>/videos/
/admin/analytics/, /admin/bulk-approve/
```

---

## 12. SETTINGS KEY CONFIGURATION

```python
# socialsync/settings.py

SECRET_KEY = config('DJANGO_SECRET_KEY', default='hardcoded-insecure-key')  # SECURITY ISSUE
DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'abedintechllc.com', ...]

# JWT
ACCESS_TOKEN_LIFETIME = 60 minutes
REFRESH_TOKEN_LIFETIME = 7 days
ROTATE_REFRESH_TOKENS = True
BLACKLIST_AFTER_ROTATION = True

# DRF
DEFAULT_AUTHENTICATION = [ImpersonatingJWTAuthentication, SessionAuthentication]
DEFAULT_PERMISSION = [IsAuthenticated]
PAGE_SIZE = 10

# AI Keys
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
GEMINI_API_KEY = config('GEMINI_API_KEY', default='')
ANTHROPIC_API_KEY = config('test', default='')  # SECURITY ISSUE: wrong env var name 'test'

# CORS
CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'https://abedintechllc.com', ngrok URL]

# URLs
/admin/         → Django Admin
/api/v1/        → REST API
/doc/api/       → Swagger UI
/doc/api/redoc/ → ReDoc
/{any}          → React SPA catch-all
```

---

## 13. SECURITY ISSUES (CRITICAL → LOW)

### CRITICAL
1. **Wrong env var for Anthropic key**: `config('test', default='')` in settings.py — should be `config('ANTHROPIC_API_KEY')`
2. **Hardcoded fallback SECRET_KEY**: exposed in code, should fail fast if missing
3. **Admin impersonation without audit log**: `X-Impersonate-User` header, any staff user can impersonate anyone

### HIGH
4. **Base64 is not encryption**: API keys in UserAPISettings, UserImageSettings, UserVideoSettings stored base64 — trivially reversible. Use Fernet encryption.
5. **Plaintext voice API key**: `UserVoiceSettings.openai_api_key = CharField()` — no encoding at all
6. **No rate limiting**: AI generation endpoints have no throttling (DDoS/cost abuse risk)

### MEDIUM
7. **No webhook signature verification**: Facebook messenger webhook payloads not verified
8. **No API key rotation mechanism**: Keys stored forever with no expiry
9. **No request/response audit logging** for security-sensitive operations

---

## 14. TECHNICAL DEBT

| Issue | Severity | Location |
|-------|---------|---------|
| api/views.py 3659 LOC monolith | HIGH | api/views.py |
| api/serializers.py ~68KB | HIGH | api/serializers.py |
| Zero test coverage | HIGH | all tests.py (empty stubs) |
| No async task queue | HIGH | video/PDF generation blocks requests |
| SQLite in production | MEDIUM | settings.py (MySQL config commented out) |
| Legacy unused model files | LOW | accounts/models_v1.py, models_v2.py |
| APScheduler usage unclear | LOW | requirements.txt |
| No Redis caching | MEDIUM | all read-heavy endpoints |

---

## 15. VERSION FEATURE MAP

| Feature | Version |
|---------|---------|
| Core platform (auth, posts, captions, images, scheduling, analytics) | V1.0 |
| Content Pillars, RBAC, Competitor tracking, Weekly Reports, Learning Signals | V1.2.1 |
| Copy Overlay (text on images), AI overlay styles | V1.2.2 |
| DNA History restore, Trending Topics, Manual trends, Overflow onboarding | V1.3 |
| Competitor Suggestions, AI Pillar Generation, Trend Feedback, Scheduling improvements | V1.4 (planned) |
| **Diamond Token credit system, Global API Key management, Notification Service** | **V1.2.4 (current)** |

---

## 18. DIAMOND TOKEN SYSTEM (V1.2.4)

**NEW in V1.2.4** — AI credit/billing layer replacing per-user API keys.

### Models (accounts/models.py)

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| DiamondWallet | One per user, stores credit balance | user(1-1), balance, total_recharged, total_spent, last_recharge_at |
| DiamondTransaction | Immutable ledger — every diamond move | user, amount, transaction_type, balance_after, feature, provider, raw_tokens, model_used, raw_cost_usd, recharged_by, note |
| GlobalAPIKey | Admin-managed shared API keys | provider(openai/gemini/claude), api_key, is_active, set_by |

**DiamondTransaction.transaction_type**: recharge, deduction, refund, plan_grant

**Auto-creation signal**: on new User → DiamondWallet created + 200 diamond plan_grant (free plan default)

### Diamond Service (`accounts/services/diamond_service.py`)

```python
DIAMOND_COSTS = {
    # Text (5-15 diamonds)
    'caption': 5, 'brand_dna': 15, 'strategy_ideas': 10, 'hashtag_generation': 3,
    'competitor_analysis': 12, 'weekly_report': 15, 'pillar_generation': 10,
    'ai_reply_comment': 3, 'copy_overlay_text': 5, 'repurpose_post': 10,
    # Image (15-40)
    'image_standard': 15, 'image_hd': 40,
    # Video Gemini Veo (duration-based)
    'video_5s': 500, 'video_8s': 800, 'video_10s': 1000, 'video_15s': 1500,
    # Voice TTS (character-based)
    'voice_short': 5, 'voice_medium': 10, 'voice_long': 15, 'voice_extra_long': 25,
    # Messenger / Prompts
    'messenger_reply': 3, 'prompt_engineer_generate': 5,
}

PLAN_DIAMONDS = {
    'free': 50, 'starter': 500, 'pro': 2500, 'business': 10000, 'enterprise': 50000
}

# Key functions:
get_diamond_cost(feature, **kwargs)  # Duration/quality/char-aware pricing
pre_check(user, feature, **kwargs)   # → (can_afford, cost, balance)
deduct_diamonds(user, feature, provider, raw_tokens, model_used, raw_cost_usd)
recharge_diamonds(user, amount, recharged_by, note)   # Admin top-up
grant_plan_diamonds(user, plan)      # On plan upgrade
get_usage_summary(user, days=30)     # → {by_feature, by_provider, totals}
```

### Global API Key Management (`accounts/api_keys.py`)

```python
get_openai_key(user=None)   # GlobalAPIKey (DB) → settings.OPENAI_API_KEY
get_gemini_key(user=None)   # GlobalAPIKey (DB) → settings.GEMINI_API_KEY
get_claude_key(user=None)   # GlobalAPIKey (DB) → settings.ANTHROPIC_API_KEY
mask_key(key)               # "sk-ab**...xyz" for display
```
Admin sets keys once via `PUT /api/v1/admin/global-api-keys/`, all users share them.

### Diamond API Endpoints (`api/diamond_views.py`)

**User:**
- `GET /api/v1/diamond/balance/` — wallet info
- `GET /api/v1/diamond/usage/?days=30` — breakdown by feature/provider
- `GET /api/v1/diamond/transactions/` — paginated ledger (filterable by type/feature)
- `GET /api/v1/diamond/cost-preview/?feature=image&quality=hd` — affordability check
- `GET /api/v1/diamond/costs/` — full cost table + plan grants

**Admin (superuser only):**
- `POST /api/v1/admin/users/<id>/recharge/` — add diamonds (amount, note)
- `GET/PUT /api/v1/admin/global-api-keys/` — manage openai/gemini/claude keys
- `GET /api/v1/admin/diamond-overview/` — platform-wide stats + top spenders

### How to use Diamond checks in views
```python
from accounts.services.diamond_service import pre_check, deduct_diamonds, InsufficientDiamondsError

# Before AI call
can_afford, cost, balance = pre_check(request.user, 'caption')
if not can_afford:
    return Response({'error': 'insufficient_diamonds', 'balance': balance, 'required': cost}, status=402)

# After successful AI call
deduct_diamonds(request.user, 'caption', provider='claude', raw_tokens=result.tokens_used, model_used=result.model)
```

---

## 19. NOTIFICATION SERVICE (V1.2.4)

**File**: `accounts/services/notification_service.py`

```python
# Core function
notify(user, event_type, title, message='', data_json=None, channel='in_app')

# Domain helpers (auto-dispatch to correct users)
notify_post_submitted(post, submitted_by)
notify_post_approved(post, approved_by)
notify_changes_requested(post, reviewer, comment)
notify_post_rejected(post, rejected_by, reason)
notify_post_published(post)
notify_publish_failed(post, error_message)
notify_new_comment(post, comment)
notify_weekly_report(user, brand, report)
notify_approval_reminder(post, approver, hours_pending)
notify_post_scheduled(post, scheduled_by)
notify_captions_ready(post)
notify_images_ready(post)
notify_video_rendering(post) / notify_video_ready(post)
notify_batch_complete(user, batch_summary)
notify_winner_detected(post, brand)        # notifies creator + workspace owner
notify_repurpose_suggestion(post)
notify_token_expiring(user, platform, days_remaining)
notify_daily_limit_warning(user, usage_percent)
notify_reply_sla_breach(comment, hours_waiting)
```

Email delivery via Django `send_mail` (fail_silently=True). `channel='both'` sends in-app + email.

---

## 16. DEPENDENCY MAP (Feature → Code)

```
User Auth              → api/views.py (RegisterView, LoginView, ~line 117)
                         api/authentication.py (ImpersonatingJWTAuthentication)
                         socialsync/middleware.py (ImpersonationMiddleware)

Onboarding             → onboarding/models.py (OnboardingProgress)
                         api/views.py (OnboardingProgressView ~line 316)

Posts Lifecycle        → posts/models.py (Post, PostCaption, PostHashtag, ScheduledPostPlatform)
                         api/views.py (PostViewSet ~line 353)
                         api/caption_views.py, api/hashtag_views.py
                         api/approval_views.py, api/scheduling_views.py

AI Caption             → ai_caption/models.py (CaptionGeneration)
                         api/views.py (generate_caption ~line 572)
                         accounts/services/llm_service.py (UnifiedLLMService)

AI Image               → ai_image/models.py (ImageGeneration, AssetPlatformVariant)
                         api/views.py (generate_image ~line 1277)
                         Pillow (watermark, composite, resize)

AI Video               → ai_video/models.py (VideoGeneration)
                         api/views.py (generate_video ~line 1599)
                         Gemini Veo API + moviepy

AI Voice               → ai_voice/models.py (VoiceGeneration)
                         api/views.py (generate_voice ~line 2815)
                         OpenAI TTS API

Brand DNA              → brands/models.py (Brand.brand_dna, BrandDNAChunk, BrandDNAHistory)
                         api/views.py (GenerateBrandDNAView ~line 3004)
                         requests + BeautifulSoup (web crawl) + UnifiedLLMService

Messenger Bot          → messenger_bot/models.py + messenger_bot/views.py (920 lines)
                         messenger_bot/services/ (RAGEngine, MessageHandler, WooCommerceService)
                         ChromaDB + sentence-transformers (embeddings)

Analytics              → analytics/models.py (PostAnalytics, LearningSignal)
                         api/analytics_views.py

Content Strategy       → brands/models.py (ContentPillar, ContentIdea, CompetitorProfile)
                         api/strategy_views.py

RBAC                   → accounts/models.py (UserRole)
                         api/rbac_views.py

Admin Panel            → api/admin_views.py
                         accounts/models.py (UserProfile.set_plan())

Notifications          → accounts/models.py (SystemNotification)
                         api/notification_views.py
```

---

## 17. HOW TO WORK IN THIS CODEBASE

### Finding things quickly
- New feature in posts? Start in `posts/models.py` + `api/views.py` PostViewSet
- New AI feature? Start in the relevant `ai_*/models.py` + `api/views.py`
- New API endpoint? Add URL in `api/urls.py`, view in appropriate `api/*_views.py`
- LLM call? Always use `get_llm_service(user)` from `accounts/services/llm_service.py`
- Subscription limit? Check/update in `accounts/models.py` UserProfile methods
- Permissions? Check `accounts/models.py` UserRole + workspace owner bypass

### Common Patterns
```python
# Check subscription limit before generation
if not request.user.userprofile.can_generate_caption():
    return Response({'error': 'limit_reached'}, status=403)

# Get LLM service
from accounts.services.llm_service import get_llm_service
service = get_llm_service(request.user)
result = service.chat_completion(messages=[...], temperature=0.7)

# JSON mode
result = service.chat_completion(
    messages=[...],
    response_format={"type": "json_object"}
)

# Extended thinking (Claude)
result = service.chat_completion(
    messages=[...],
    thinking_budget=10000
)

# Increment usage counter
request.user.userprofile.increment_usage('captions_this_month')

# Check RBAC
from accounts.models import UserRole
if not UserRole.has_any_role(request.user, workspace, ['admin', 'approver']):
    return Response({'error': 'forbidden'}, status=403)

# Create notification
SystemNotification.objects.create(
    user=target_user,
    event_type='post_approved',
    title='Your post was approved',
    message='...',
    data_json={'post_id': post.id},
    channel='in_app'
)
```

### Model Signal Setup
- `post_save` on `User` → auto-creates `UserProfile` + `OnboardingProgress`
- Workspace creation → `OnboardingProgress.mark_step_completed(1)`
- Brand creation → `OnboardingProgress.mark_step_completed(2)`

---

*Last updated: 2026-03-11 — Full deep analysis of all 13 apps, 250+ endpoints, all models and services*
