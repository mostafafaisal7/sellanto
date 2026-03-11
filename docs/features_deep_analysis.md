# SocialSync-AI — Complete Feature Analysis
## Every Feature: User Experience + Code Implementation

---

## 1. AUTHENTICATION SYSTEM

### User Experience
- User registers → gets JWT access + refresh token immediately
- "Register with Brand" flow → single form creates account + workspace + brand + DNA
- Login returns tokens, stored client-side (Bearer header for API calls)
- Token auto-refreshes every 60 min via refresh endpoint
- Admin can impersonate any user via header (no visible indicator to impersonated user)

### Code Implementation
**Files**: `api/views.py` (lines 117-312), `api/authentication.py`, `socialsync/middleware.py`

```
RegisterView.create()
  → User.objects.create_user(username, email, password)
  → Signal auto-creates UserProfile + OnboardingProgress
  → Returns JWT pair (access + refresh)

RegisterWithBrandView.post()
  → Creates User → Workspace → Brand in sequence
  → Optionally crawls website_url for Brand DNA
  → Uses UnifiedLLMService (Claude) to extract 15-field DNA
  → Returns JWT pair + onboarding status

LoginView.post()
  → authenticate(username, password)
  → NOTE: approval check is COMMENTED OUT (any user can login)
  → Returns access + refresh tokens

ImpersonatingJWTAuthentication (api/authentication.py)
  → Extends JWTAuthentication
  → Reads X-Impersonate-User header
  → If request.user.is_staff → swaps to target user
  → Stores original in request._original_user (no audit log)

ImpersonationMiddleware (socialsync/middleware.py)
  → Also handles session-based admin impersonation
  → JWT path: manually decodes token, checks is_staff, swaps user
```

---

## 2. ONBOARDING SYSTEM (7-Step Flow)

### User Experience
Step 1: Create Workspace → Step 2: Brand Wizard → Step 3: Connect Platforms
→ Step 4: AI & Automation Setup → Step 5: Generate Brand DNA
→ Step 6: Launch Plan Setup → Step 7: Complete
- Users can skip the entire flow
- Steps are tracked and can be completed non-linearly

### Code Implementation
**Files**: `onboarding/models.py`, `api/views.py` (OnboardingProgressView, OnboardingStepView, OnboardingSkipView)

```
OnboardingProgress model:
  - current_step (IntegerField, default=1)
  - completed_steps (JSONField, default=[])
  - is_completed, is_skipped (BooleanField)

mark_step_completed(step_number):
  - Adds step to completed_steps if not already there
  - Updates current_step to max(completed) + 1
  - Sets is_completed=True if step 7 completed

Signal in accounts/models.py:
  - post_save on User → auto-creates OnboardingProgress

Side effects in WorkspaceViewSet.perform_create():
  - progress.mark_step_completed(1)

In BrandViewSet.perform_create():
  - progress.mark_step_completed(2)
```

---

## 3. WORKSPACE & BRAND MANAGEMENT

### User Experience
- Create multiple Workspaces (each with daily generation limits)
- Each workspace has multiple Brands
- One Brand per workspace is "primary"
- Brand stores: name, industry, website, logo, PDF guide, social links, voice/tone, dos/don'ts, goals, target audiences
- Brand DNA auto-generates from website/PDF/manual input

### Code Implementation
**Files**: `brands/models.py`, `api/views.py` (WorkspaceViewSet, BrandViewSet)

```
Workspace model:
  - max_generations_per_day (checked via can_generate())
  - reset_daily_generations() — resets if generation_date != today
  - increment_generation(count) — tracked per generation event

Brand model:
  - brand_dna (JSONField) — 15 structured fields
  - brand_dna_source: website/pdf/manual/structured
  - is_primary (BooleanField) — workspace's active brand

BrandViewSet.set_primary() action:
  - Sets all brands in workspace is_primary=False
  - Sets target brand is_primary=True

BrandTemplate model:
  - Overlay templates for images with brand colors/fonts

LaunchPlan model (1-1 with Brand):
  - post_frequency (posts/week)
  - variant_generation_level: off/low/medium/high
  - approval_required (BooleanField)
  - formats_allowed (JSONField)
```

---

## 4. BRAND DNA GENERATION

### User Experience
- Click "Generate Brand DNA" → system crawls website (up to 5 pages)
- OR upload brand guide PDF → text extracted
- OR manually enter DNA fields
- AI outputs 15 structured fields: tagline, industry, description, products/services, target audience, USPs, brand voice, values, color theme, content themes, CTA style, platforms, keywords, competitor positioning
- DNA is saved and used in all subsequent AI generations

### Code Implementation
**Files**: `api/views.py` (GenerateBrandDNAView lines 3004-3179), `brands/models.py` (BrandDNAChunk, BrandDNAHistory)

```
GenerateBrandDNAView.post():
  1. _crawl_site_pages(website_url, max_pages=5):
     - Uses requests + BeautifulSoup
     - Extracts <p>, <h1-h6>, <li> text
     - Follows internal links only

  2. UnifiedLLMService.chat_completion():
     - Sends website content to Claude (default)
     - System prompt extracts 15 DNA fields as JSON
     - think_harder flag → extended thinking (10000 token budget)

  3. Saves to brand.brand_dna (JSONField)
  4. Creates BrandDNAHistory record (is_active=True)
  5. Creates BrandDNAChunk records for RAG:
     - Chunks DNA fields into searchable text segments
     - Generates embeddings via OpenAI text-embedding-3-small

RegenerateBrandDNAFromInputsView.post():
  - Accepts 15 fields manually
  - If use_ai=True → sends to LLM for AI-enhancement
  - Saves to brand.brand_dna + new BrandDNAHistory
```

---

## 5. RBAC — ROLE-BASED ACCESS CONTROL

### User Experience
- Workspace owner assigns roles to team members
- 6 roles with different permissions:
  - owner: full access
  - admin: manage team, approve content
  - creator: create drafts only
  - approver: review and approve/reject
  - publisher: can schedule and publish
  - viewer: read-only access
- Roles are workspace-scoped

### Code Implementation
**Files**: `accounts/models.py` (UserRole lines 388-450)

```
UserRole model:
  - user (FK → User)
  - workspace (FK → Workspace)
  - role (CharField, 6 choices)
  - granted_by (FK → User)
  - unique_together: (user, workspace, role)

Static Methods:
  get_user_roles(user, workspace):
    → Returns QuerySet of UserRole for user in workspace

  has_role(user, workspace, role):
    → Workspace owner ALWAYS returns True (bypasses role check)
    → Otherwise checks UserRole exists

  has_any_role(user, workspace, roles):
    → Returns True if user has ANY of the listed roles
```

---

## 6. POST CREATION & MANAGEMENT

### User Experience
- Create post: enter caption, select platforms (multi-select), upload media, set scheduled time
- Post supports multiple platforms simultaneously
- Each platform gets its own caption variant (PostCaption)
- Checklist tracks completion: {caption, hashtags, creative, alt_text, platform_mapping}
- Media files stored as JSON array of file paths

### Code Implementation
**Files**: `posts/models.py` (Post), `api/views.py` (PostViewSet lines 353-531)

```
Post model key fields:
  - caption (TextField)
  - platforms (TextField → JSON array e.g. ["facebook","instagram"])
  - media_files (TextField → JSON array of file paths)
  - scheduled_time (DateTimeField)
  - status (CharField, 6 choices: draft/pending_approval/approved/rejected/scheduled/posted/failed)
  - checklist_status (JSONField) — tracks 5 checkboxes

Post properties:
  - platforms_list → json.loads(self.platforms)
  - media_files_list → json.loads(self.media_files)
  - get_success_platforms() → [p for p in list if {p}_post_id is not None]
  - get_failed_platforms() → [p for p in list if {p}_error is not None]

  update_checklist():
    - caption → bool(PostCaption.objects.filter(post=self, is_selected=True))
    - hashtags → bool(PostHashtag.objects.filter(post=self, is_selected=True))
    - creative → bool(self.media_files_list or ImageGeneration linked)
    - platform_mapping → bool(ScheduledPostPlatform linked)

PostViewSet:
  - get_queryset(): filter by status, platform, search term
  - create(): handles multi-platform JSON, file uploads
  - update(): partial updates (caption, platforms, scheduled_time)
  - cancel(): status → 'draft' if currently 'scheduled'
```

---

## 7. POST APPROVAL WORKFLOW

### User Experience
- Creator submits draft → status changes to "pending_approval"
- Approver sees queue of pending posts
- Approver can: Approve / Request Changes / Reject
- Each action creates an ApprovalLog entry (full audit trail)
- SystemNotification sent to creator on each decision
- ContentApproval model tracks version history

### Code Implementation
**Files**: `brands/models.py` (ContentApproval, ApprovalLog), `api/views.py` (ContentApprovalViewSet lines 2690-2755)

```
ContentApproval model:
  - post (FK → Post)
  - submitted_by, approver (FK → User)
  - status: pending/approved/changes_requested/rejected
  - compliance_checklist (JSONField)
  - version (IntegerField) — increments on resubmit

ApprovalLog model (brands/models.py):
  - approval (FK → ContentApproval)
  - action: submitted/approved/changes_requested/rejected
  - actor (FK → User)
  - comment (TextField)
  - created_at (DateTimeField)

ContentApprovalViewSet:
  perform_create():
    → sets post.status = 'pending_approval'
    → creates ApprovalLog(action='submitted')
    → creates SystemNotification for approvers

  approve() action:
    → approval.status = 'approved'
    → post.status = 'approved'
    → creates ApprovalLog(action='approved')
    → SystemNotification to submitted_by

  request_changes() action:
    → approval.status = 'changes_requested'
    → post.status = 'draft'
    → stores comments
    → SystemNotification to submitted_by

  reject() action:
    → approval.status = 'rejected'
    → post.status = 'rejected'
    → stores rejection_reason
    → SystemNotification to submitted_by
```

---

## 8. POST SCHEDULING & PUBLISHING

### User Experience
- Approved posts can be scheduled with date/time + timezone
- Per-platform scheduling: each platform can have different scheduled times
- Each platform mapped to specific caption variant + asset variant
- Calendar view shows all scheduled posts
- Posts publish automatically at scheduled time (via APScheduler or manual trigger)
- Post IDs stored per platform after publishing

### Code Implementation
**Files**: `posts/models.py` (ScheduledPostPlatform), `api/views.py`

```
ScheduledPostPlatform model:
  - post (FK → Post)
  - platform (CharField, 9 choices)
  - caption (FK → PostCaption) — which caption variant to use
  - asset_variant (FK → AssetPlatformVariant) — which image size
  - hashtag_placement: inline/end_of_caption/first_comment
  - scheduled_at (DateTimeField) + timezone
  - status: scheduled/publishing/published/failed/cancelled
  - retry_count, max_retries (for failure recovery)
  - publish_result_json (JSONField) — raw API response
  - published_at (DateTimeField)

Post.platform_post_ids (separate fields per platform):
  - facebook_post_id, twitter_post_id, instagram_post_id, etc.
  - Set after successful publish

Post.platform_errors:
  - facebook_error, twitter_error, etc.
  - Set on publish failure
```

---

## 9. AI CAPTION GENERATION

### User Experience
- Enter topic/text OR upload image/video (AI analyzes media first)
- Select: tone (8 options) × length (4 options) × platform (8 options)
- Toggle: include hashtags, include emojis, include CTA
- Optional: custom instructions
- AI generates caption + hashtags in one call
- Can regenerate with feedback ("make it shorter", "more professional")
- History view shows all past generations with status
- Save favorites to library

### Code Implementation
**Files**: `api/views.py` (generate_caption lines 572-717), `ai_caption/models.py`, LLM service

```
generate_caption() view:
  1. get_openai_key(request.user):
     - Checks UserAPISettings._openai_api_key (base64 decoded)
     - Falls back to admin key from UserProfile
     - Falls back to env OPENAI_API_KEY

  2. Parse request: topic, tone, length, platform, toggles, custom_instructions

  3. Determine media_type:
     - 'image' if image file uploaded
     - 'video' if video file uploaded
     - 'none' if text only

  4. CaptionGeneration.objects.create(status='processing')

  5. CaptionGeneratorService.generate():
     - Builds system prompt with platform guidelines, char limits
     - If media uploaded → sends to vision model first for analysis
     - Calls UnifiedLLMService.chat_completion() (Claude by default)
     - Extracts caption + hashtags from response

  6. Updates CaptionGeneration:
     - generated_caption, generated_hashtags, media_analysis
     - tokens_used, processing_time, model_used
     - status='completed'

  7. Updates usage counters:
     - UserProfile.captions_this_month += 1
     - APIUsageLog.log_usage()

regenerate_caption() view:
  - Gets original CaptionGeneration
  - Includes original caption + user feedback in new prompt
  - Creates NEW CaptionGeneration record (history preserved)

UserAPISettings.set_openai_api_key(key):
  → base64.b64encode(key.encode()).decode()

UserAPISettings.get_openai_api_key():
  → base64.b64decode(self._openai_api_key).decode()
```

---

## 10. PER-PLATFORM CAPTION VARIANTS (PostCaption)

### User Experience
- After creating a post, generate separate captions per platform
- Each platform has character limit awareness:
  - Twitter: 280 chars (red warning if exceeded)
  - LinkedIn: 3000 chars
  - Facebook: 63,206 chars
  - Instagram: 2,200 chars
- A/B testing: generate variant A and B for same platform
- Select which variant to use for publishing

### Code Implementation
**Files**: `posts/models.py` (PostCaption lines 216-286)

```
PostCaption model:
  PLATFORM_CHAR_LIMITS = {
    'twitter': 280, 'linkedin': 3000,
    'facebook': 63206, 'instagram': 2200
  }

  Properties:
    is_within_limit:
      → checks char_count vs platform limit
      → True if no limit defined for platform

    char_status:
      → 'red' if over limit
      → 'yellow' if within 10% of limit
      → 'green' if safe

  A/B Testing:
    is_ab_test = True
    ab_label = 'A' or 'B'
    variant_number = 1, 2, 3...

  is_selected = True → this caption used for publishing
```

---

## 11. HASHTAG MANAGEMENT

### User Experience
- AI generates hashtags in 3 tiers: high_volume, mid_volume, niche
- Each hashtag has estimated volume number
- User selects which to use + where to place them
- Brand-level saved HashtagGroups for reuse
- Brand-level BannedHashtag list (auto-excluded from suggestions)

### Code Implementation
**Files**: `posts/models.py` (PostHashtag, HashtagGroup, BannedHashtag)

```
PostHashtag model:
  - tag (CharField) — stored WITHOUT # symbol
  - tier: high_volume / mid_volume / niche
  - estimated_volume (IntegerField)
  - is_selected (BooleanField) → chosen for use
  - placement: inline / end_of_caption / first_comment

HashtagGroup model:
  - brand (FK → Brand)
  - tags (JSONField) → ["socialmedia", "marketing", ...]

BannedHashtag model:
  - brand (FK → Brand)
  - tag + reason
  - added_by (FK → User)
  - Used in AI generation to exclude banned tags from suggestions
```

---

## 12. AI IMAGE GENERATION

### User Experience
- Enter prompt (or auto-generate from brand context)
- Choose: provider (DALL-E 3 or Gemini), style (17 options), size, quality
- Optional: upload logo for watermarking + position
- Optional: upload product image → AI composites it into scene
- V1.2.2: Add text copy overlay to generated image
- Advanced: lighting, camera angle, enhance prompt, seed
- Brand-aware: if brand has DNA, system auto-incorporates brand style
- Platform variants auto-generated (Instagram/LinkedIn/Twitter/Facebook sizes)
- Version history tracked

### Code Implementation
**Files**: `api/views.py` (generate_image lines 1277-1520), `ai_image/models.py`

```
generate_image() view — 9-step pipeline:

  1. get_openai_key() / get_gemini_key(user)

  2. Parse: title, prompt, style, size, quality, provider, logo_id,
     logo_position, logo_opacity, product_image, enhance_prompt,
     lighting, camera_angle, brand_template_id, seed

  3. ImageGeneration.objects.create(status='processing')

  4. Save product_image (ImageField) if uploaded

  5. Brand-aware prompt engineering (if brand linked + enhance=True):
     ImagePromptEngineerService():
       - Loads brand DNA, brand_style_anchor
       - Uses Claude (extended thinking, 10000 token budget)
       - Outputs: enhanced prompt + negative prompt
       - Sets: brand_style_anchor, prompt_engineering_used=True

  6. ImageService(provider, openai_key, gemini_key).generate_image():
     - DALL-E 3 path: openai.images.generate()
     - Gemini path: Gemini imagen API
     - Returns: image bytes + revised_prompt

  7. Save generated_image (ImageField → MEDIA_ROOT)

  8. Product compositing (if product_image):
     ProductCompositor().composite():
       - Pillow-based compositing
       - Positions product in generated scene
       - Position choices: center/center_bottom/left/right/center_top/full
       - Returns composited_image

  9. Logo watermarking:
     - Pillow: resize logo, apply opacity, paste at position
     - Saves generated_image_with_logo

  10. AssetPlatformVariant auto-creation:
      - Resizes to each platform's required dimensions
      - instagram_feed(1080x1080), instagram_story(1080x1920),
        linkedin_feed(1200x627), twitter_feed(1200x675), facebook_feed(1200x630)

  11. CreativeVersionHistory record created

ImageGeneration.get_display_image():
  Priority: copy_overlay_image > composited_image > generated_image_with_logo > generated_image
```

---

## 13. COPY OVERLAY (V1.2.2)

### User Experience
- Select existing generated image
- Enter text for overlay OR let AI generate the copy
- Text is composited onto image (branding text, CTA, price, etc.)
- Overlay settings: font, position, color, size stored in JSON

### Code Implementation
**Files**: `ai_image/models.py` (ImageGeneration copy_overlay_* fields), `api/views.py`

```
ImageGeneration copy overlay fields:
  - copy_overlay_image (ImageField) — final image with text
  - copy_overlay_text (CharField) — the text that was overlaid
  - copy_overlay_settings (JSONField) — {font, position, color, size, bg_color}

Endpoints:
  POST /assets/<id>/copy-overlay/
    → Applies text to existing ImageGeneration
    → Uses Pillow for text rendering
    → Saves to copy_overlay_image field

  POST /copy-overlay/generate-text/
    → Sends brand context + image prompt to Claude
    → Returns suggested copy text
    → User can then apply to image
```

---

## 14. AI VIDEO GENERATION

### User Experience
- Enter prompt, choose style (15 options), duration (3-15 sec), resolution, aspect ratio, FPS
- Optional: reference image for image-to-video
- Optional: logo for video watermark + position
- Advanced: camera motion (12 options), motion intensity (4 levels), seed
- AI generates video via Gemini Veo API
- Thumbnail auto-generated from video
- Logo composited as overlay throughout video

### Code Implementation
**Files**: `api/views.py` (generate_video lines 1599-1777), `ai_video/models.py`

```
generate_video() view:

  1. get_gemini_key(user) — video uses Gemini exclusively

  2. Parse: title, prompt, style, duration, resolution, aspect_ratio, fps,
     reference_image, camera_motion, motion_intensity, enhance_prompt, seed

  3. VideoGeneration.objects.create(status='processing')

  4. Save reference_image if provided

  5. GeminiVideoService(gemini_api_key).generate_video():
     - Builds Gemini Veo prompt with all parameters
     - Returns: video_bytes, enhanced_prompt

  6. Save generated_video (FileField)

  7. Generate thumbnail:
     GeminiVideoService.generate_thumbnail():
       - Uses moviepy to extract frame at 0s or 1s
       - Saves as ImageField thumbnail

  8. Logo watermark:
     GeminiVideoService.add_logo_to_video():
       - moviepy: overlay logo image at position throughout video
       - Saves generated_video_with_logo

  9. Updates: enhanced_prompt, processing_time, status='completed'
  10. total_duration_generated += duration (tracks seconds generated)

VideoGeneration.file_size_mb property:
  → self.file_size / (1024 * 1024) if file_size else None

VideoGeneration.get_display_video():
  → generated_video_with_logo if exists, else generated_video
```

---

## 15. AI VOICE GENERATION

### User Experience
- Enter text to convert to speech
- Choose voice (6 options: alloy, echo, fable, onyx, nova, shimmer)
- Choose model (tts-1 standard or tts-1-hd high quality)
- Set speed (0.25x to 4.0x)
- Choose output format (mp3, opus, aac, flac, wav, pcm)
- Preview before saving
- Download audio file

### Code Implementation
**Files**: `api/views.py` (generate_voice lines 2815-2854), `ai_voice/models.py`

```
generate_voice() view:

  1. ValidateVoiceSerializer (validates voice, model, speed choices)

  2. get_openai_key(user) — voice uses OpenAI TTS exclusively

  3. Get/create UserVoiceSettings (stores last-used preferences)

  4. VoiceGeneration.objects.create(status='processing')

  5. openai.audio.speech.create(
       model=model,
       voice=voice,
       input=text,
       speed=speed,
       response_format=output_format
     )

  6. Save audio_file (FileField)
  7. Calculate: duration_seconds, file_size_bytes, characters_used
  8. Update usage stats

SECURITY ISSUE:
  UserVoiceSettings.openai_api_key = CharField(max_length=255)
  → Stored as PLAINTEXT in database, no encoding at all
```

---

## 16. MESSENGER BOT (Facebook Messenger AI Chatbot)

### User Experience
- Connect Facebook Page → auto-generates verify_token for webhook
- Configure AI: model, temperature, response length
- Upload PDFs → auto-chunked and vectorized for RAG
- Or auto-crawl website for knowledge base
- Set custom AI persona with system prompt + tone
- Bot auto-responds to all messages
- Human Takeover: toggle to manually respond (AI goes silent)
- View all conversations and messages with timestamps
- E-commerce: connect WooCommerce store → AI recommends products
- Notifications for important messages (price inquiries, complaints, urgent keywords)

### Code Implementation
**Files**: `messenger_bot/models.py`, `messenger_bot/views.py` (920 lines), `messenger_bot/services/`

```
Webhook Flow:
  GET /webhook/messenger/<verify_token>/
    → Verifies with Facebook (hub.challenge response)

  POST /webhook/messenger/<verify_token>/
    → Receives Facebook message events
    → Calls MessageHandler.process_message(sender_id, text, image_url)

MessageHandler.process_message():
  1. Gets or creates Conversation record
  2. If human_takeover=True → skip AI, create Message record only
  3. Calls RAGEngine.generate_response(query, connection, history)
  4. Detects important keywords → creates Notification record
  5. Sends reply via Facebook Send API
  6. Saves Message with AI metadata (tokens, rag_context_used)

RAGEngine.retrieve_relevant_chunks(query, connection):
  1. Creates embedding for query (OpenAI text-embedding-3-small)
  2. Searches PDFChunk table → cosine_similarity for each chunk
  3. Searches BrandDNAChunk table → same similarity search
  4. Searches Product table → embedding similarity for product matching
  5. Combines + sorts by similarity score
  6. Returns top_k results above similarity_threshold

RAGEngine.generate_response():
  1. retrieve_relevant_chunks() for context
  2. Loads active CustomPrompt for system message
  3. Builds message history (last N conversations)
  4. Calls UnifiedLLMService.chat_completion() (Claude default)
  5. _clean_markdown(response) → removes **bold**, *italic*, etc.
  6. Returns plain text response

PDFProcessor pipeline:
  extract_text_from_pdf() → PyPDF2
  clean_text() → normalize whitespace, remove special chars
  create_chunks(chunk_size=500, overlap=50) → sentence-boundary-aware chunking
  → Stored in PDFChunk with embedding JSON array

WooCommerceService.sync_products():
  - WooCommerce REST API v3
  - Paginate: per_page=100, up to 50 pages (5000 products max)
  - Creates/updates Product records
  - Generates embeddings from: name + description + categories + price + SKU
  - Cosine similarity matching for product recommendations

IMPORTANT_KEYWORDS dict (message_handler.py):
  - English + Bengali keywords for: price, appointment, order, complaint, urgent, contact
  - Detected → creates Notification with appropriate priority + type
```

---

## 17. ANALYTICS & LEARNING

### User Experience
- View post performance: likes, shares, comments, views, impressions, engagement rate
- Per-platform breakdown
- Time-series trends (select metric + date range)
- Performance indicator: green (>3%), yellow (>1.5%), red
- Comments with sentiment labels (positive/neutral/negative)
- Repurpose high-performing posts to: carousel, thread, reel, email, blog outline
- Weekly report: winners/losers, best hooks, best posting times

### Code Implementation
**Files**: `analytics/models.py`, `brands/models.py` (WeeklyReport, LearningSignal), `api/views.py`

```
PostAnalytics model:
  - Snapshots at: 24h, 48h, daily, weekly after publishing
  - Stores: impressions, reach, likes, comments_count, shares, clicks, saves
  - engagement_rate = (likes + comments + shares) / impressions * 100

  performance_indicator property:
    'green' if engagement_rate > 3.0
    'yellow' if engagement_rate > 1.5
    'red' otherwise

AnalyticsSummaryView.get():
  - PostAnalytics.objects.filter(post__user=user, fetched_at__gte=days_ago)
  - Aggregates: Sum(likes), Sum(shares), Sum(impressions), etc.
  - Calculates total engagement_rate

PlatformAnalyticsView.get():
  - Groups by platform
  - Returns per-platform metrics dict

AnalyticsTrendView.get():
  - Groups by fetched_at__date
  - Returns [{date, value}] time-series

LearningSignal model:
  - Captures: best_hook, best_time, best_format, ab_winner, etc.
  - applied=False → not yet used in generation
  - Used to personalize future content suggestions

WeeklyReport model:
  - winners (JSONField) → top performing post IDs + metrics
  - losers (JSONField) → lowest performing
  - best_hooks (JSONField) → hooks from high-engagement posts
  - best_times (JSONField) → {hour: engagement_avg}
  - ab_test_results (JSONField)
  - recommendations (JSONField) → AI-generated suggestions

RepurposedContent model:
  - Links original Post to new Post
  - repurpose_format: carousel/thread/reel/email/blog_outline
```

---

## 18. CONTENT IDEAS & PILLARS

### User Experience
- Define Content Pillars (e.g. "Educational", "Promotional", "Behind-the-Scenes")
- Each pillar has target percentage (e.g. 40% educational, 30% promotional)
- AI generates Content Ideas assigned to pillars
- Ideas have: title, hook, angle, format, platform, goal, language
- Status flow: new → saved → drafted → scheduled
- Trending topics auto-fetched per brand industry

### Code Implementation
**Files**: `brands/models.py` (ContentPillar, ContentIdea, TrendingCache, CompetitorInsight)

```
ContentPillar model:
  - target_percentage (IntegerField, 0-100)
  - color_code (CharField, hex color)
  - is_active (BooleanField)

ContentIdea model:
  - source: ai_generated / trending / competitor_inspired
  - engagement_tier: low / mid / high
  - status: new / saved / skipped / drafted / scheduled
  - post (FK → Post) → linked when converted to draft
  - metadata_json (JSONField) → additional AI metadata
  - batch_id + generation_run → track which batch this came from

TrendingCache model:
  - Cached results from pytrends (Google Trends)
  - Per-brand, per-platform trending topics

CompetitorProfile + CompetitorInsight:
  - Tracks competitor handles/URLs per platform
  - Extracts: hook_text, angle, format_type, engagement_score
  - Used to inspire content ideas (source='competitor_inspired')
```

---

## 19. SOCIAL PLATFORM CONNECTIONS

### User Experience
- Connect 9 platforms: Facebook, Twitter/X, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Telegram, Messenger
- Each platform stores its OAuth tokens
- Token expiry tracked — shows "expired" status when token invalid
- Validate button to test current token

### Code Implementation
**Files**: `platforms/models.py` (SocialAccount)

```
SocialAccount model per platform:

Facebook:
  facebook_page_id, facebook_access_token

Twitter/X:
  twitter_api_key, twitter_api_secret, twitter_access_token, twitter_access_token_secret

Instagram:
  instagram_access_token, instagram_business_account_id

LinkedIn:
  linkedin_access_token, linkedin_person_urn

TikTok:
  tiktok_access_token, tiktok_refresh_token

YouTube:
  youtube_access_token, youtube_refresh_token, youtube_channel_id

Pinterest:
  pinterest_access_token, pinterest_board_id

Telegram:
  telegram_bot_token, telegram_channel_id

Messenger:
  (reuses facebook tokens)

get_credentials() returns platform-specific dict:
  - {'page_id': ..., 'access_token': ...} for facebook
  - {'api_key': ..., 'api_secret': ..., 'access_token': ..., 'access_token_secret': ...} for twitter
  etc.

is_token_expired():
  → token_expires_at < timezone.now()

Status transitions:
  mark_as_expired() → status = 'expired'
  mark_as_invalid() → status = 'invalid'
  mark_as_active() → status = 'active', is_validated = True
```

---

## 20. SUBSCRIPTION & USAGE LIMITS

### User Experience
- 5 plan tiers: Free / Starter / Pro / Business / Enterprise
- Each plan has: max social accounts, max posts/month, max captions/month, max videos, max images
- Counters reset monthly
- Errors shown when limit reached

### Code Implementation
**Files**: `accounts/models.py` (UserProfile lines 49-223)

```
UserProfile limit fields:
  max_social_accounts (IntegerField)
  max_posts_per_month (IntegerField)
  max_captions_per_month (IntegerField)
  max_videos_per_month (IntegerField)
  max_images_per_month (IntegerField)
  max_messenger_messages (IntegerField)

Usage counter fields:
  posts_this_month, captions_this_month, videos_this_month
  images_this_month (IntegerField, reset monthly)

Limit check methods:
  can_add_account() → social_accounts.count() < max_social_accounts
  can_create_post() → posts_this_month < max_posts_per_month
  can_generate_caption() → captions_this_month < max_captions_per_month
  can_generate_video() → videos_this_month < max_videos_per_month
  can_generate_image() → images_this_month < max_images_per_month

increment_usage(field):
  → UserProfile.objects.filter(pk=self.pk).update(**{field: F(field)+1})

reset_monthly_counters():
  → Sets all *_this_month fields to 0

set_plan(plan_name):
  → Updates subscription_plan
  → Sets limits based on plan tier constants
  → Called from admin panel

Token usage tracking:
  add_token_usage(provider, tokens, cost):
    → total_openai_tokens_used += tokens (if provider='openai')
    → openai_tokens_this_month += tokens
    → same for gemini
```

---

## 21. NOTIFICATIONS SYSTEM

### User Experience
- In-app notifications for workflow events
- Event types: post_submitted, post_approved, changes_requested, post_rejected, post_published, post_failed, post_scheduled, role_assigned, mention, system_alert
- Unread count shown in navbar
- Mark individual or all as read

### Code Implementation
**Files**: `accounts/models.py` (SystemNotification), `api/views.py`

```
SystemNotification model:
  - event_type (CharField, 10 choices)
  - channel: in_app / email / both
  - data_json (JSONField) → {post_id, brand_name, post_title, etc.}
  - is_read (BooleanField, default=False)

Created in ContentApprovalViewSet actions:
  SystemNotification.objects.create(
    user=submitted_by,
    event_type='post_approved',
    title='Your post was approved',
    message='...',
    data_json={'post_id': post.id},
    channel='in_app'
  )
```

---

## 22. ADMIN PANEL

### User Experience
- Super admin dashboard with platform-wide stats
- List all users, see their subscription plans, usage stats
- Approve/reject new user accounts
- Manually change subscription plans
- View any user's posts and captions
- Impersonate any user for debugging

### Code Implementation
**Files**: `admin_panel/` app, `api/views.py` (admin endpoints)

```
AdminDashboardView:
  - User.objects.count(), UserProfile.objects.filter(subscription_plan=plan).count()
  - Total posts, captions, images, videos this month

AdminUserListView:
  - Lists all UserProfile with usage stats
  - Filterable by plan, is_approved

AdminApproveUserView:
  - Sets UserProfile.is_approved = True

AdminUpdatePlanView:
  - Calls UserProfile.set_plan(plan_name)

ImpersonatingJWTAuthentication:
  - Admin sends X-Impersonate-User: <user_id> header
  - Any API call acts as that user
  - NO audit trail (security issue)
```

---

## 23. SUPPORT CHATBOT (Internal)

### User Experience
- Users can chat with AI support assistant
- AI answers based on: uploaded SupportDocuments + general knowledge
- Answers platform-specific questions about using SocialSync-AI

### Code Implementation
**Files**: `accounts/models.py` (SupportDocument), `api/views.py` (SupportChatView lines 3508-3613)

```
SupportChatView.post():
  1. _get_rag_context(query):
     - Gets all SupportDocument where is_active=True
     - Simple text-match search on extracted_text
     - Returns relevant sections as context string

  2. Builds messages:
     - System: "You are a helpful support assistant for SocialSync-AI..."
     - Includes RAG context in system prompt
     - User: the question

  3. UnifiedLLMService.chat_completion()
  4. Returns AI response

SupportDocument.save():
  - Auto-extracts text from PDF using pdfplumber
  - Stores in extracted_text field
```

---

## 24. LLM SERVICE (Unified AI Router)

### Architecture
```
accounts/services/llm_service.py

UnifiedLLMService:
  __init__(claude_key, openai_key, gemini_key, default_provider, default_model):
    - Initializes Anthropic client (if claude_key)
    - Initializes OpenAI client (if openai_key)
    - Stores gemini_key for REST calls

  chat_completion(messages, model, temperature, max_tokens, response_format, thinking_budget):
    → Detects provider from model string:
       model.startswith('claude') → _claude_completion()
       model.startswith('gemini') → _gemini_completion()
       else → _openai_completion()
    → Falls back to next provider on error

  _claude_completion():
    - _to_claude_messages(): separates system messages, validates alternating order
    - _ensure_valid_claude_message_order(): deduplicates consecutive same-role messages
    - If thinking_budget >= 1024: adds thinking block {"type":"thinking", "budget_tokens":N}
    - Returns LLMResponse(content, tokens_used, model_used, provider)

  _openai_completion():
    - Standard chat completion
    - JSON mode: response_format={"type":"json_object"}

  _gemini_completion():
    - REST API call (not SDK)
    - _to_gemini_messages(): converts to {role:'user'/'model', parts:[{text}]}
    - systemInstruction passed separately

  _to_claude_messages(messages):
    - Extracts system messages → passed as system= parameter
    - Converts: user/assistant roles only
    - Handles image_url content → converts to Anthropic vision format

get_llm_service(user):
  Factory function:
  - claude_key: settings.ANTHROPIC_API_KEY (global, always)
  - openai_key: user.userapisettings.get_openai_api_key()
  - gemini_key: user.userimagesettings._gemini_api_key (base64 decoded)
  - default_provider: user's preference from UserAPISettings
  - default_model: user's preferred model
  Returns: UnifiedLLMService instance

Model mappings:
  OPENAI_TO_CLAUDE = {
    'gpt-4o': 'claude-sonnet-4-20250514',
    'gpt-4o-mini': 'claude-haiku-4-5-20251001',
    'gpt-4-turbo': 'claude-sonnet-4-20250514',
  }
  OPENAI_TO_GEMINI = {
    'gpt-4o': 'gemini-2.0-flash',
    'gpt-4o-mini': 'gemini-2.0-flash-lite',
    'gpt-4-turbo': 'gemini-1.5-pro',
  }
```

---

## FEATURE DEPENDENCY MAP

```
User
├── Auth (JWT) → all features gated
├── Onboarding → 7 steps trigger workspace/brand creation
├── Workspace
│   └── Brand
│       ├── Brand DNA ←→ LLM Service (Claude)
│       ├── Content Pillars → Content Ideas → Posts
│       ├── Competitor Profiles → Insights → Ideas
│       └── Launch Plan → approval settings, posting frequency
├── Posts
│   ├── PostCaptions (per platform, A/B variants)
│   ├── PostHashtags (tiered, with banned list)
│   ├── ImageGeneration → AssetPlatformVariant → ScheduledPostPlatform
│   ├── ContentApproval → ApprovalLog → SystemNotification
│   └── ScheduledPostPlatform → publish via SocialAccount credentials
├── AI Generation
│   ├── Caption → UnifiedLLMService (Claude default)
│   ├── Image → DALL-E 3 / Gemini + Pillow processing
│   ├── Video → Gemini Veo + moviepy processing
│   └── Voice → OpenAI TTS
├── Analytics
│   ├── PostAnalytics snapshots → LearningSignal
│   ├── WeeklyReport (winners/losers/best-times)
│   └── RepurposedContent
├── Messenger Bot
│   ├── Webhook → MessageHandler → RAGEngine → UnifiedLLMService
│   ├── PDFKnowledgeBase → PDFChunk (embeddings)
│   ├── BrandDNAChunk (from Brand DNA)
│   ├── ECommerceSettings → WooCommerce sync → Product embeddings
│   └── Conversation → Message → Notification
├── Platforms (SocialAccount credentials)
└── Subscription (UserProfile limits)
    └── APIUsageLog → cost tracking
```
