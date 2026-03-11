# SocialSync-AI Architecture & Models Reference

## System Architecture

```
User → JWT Auth → API v1 (/api/v1/) → Views (api/views.py monolith)
                                     → Serializers (api/serializers.py)
                                     → LLM Service (accounts/services/llm_service.py)
                                     → Models (*/models.py)
```

## Multi-Tenant Hierarchy
```
User
└── Workspace (brands/models.py)
    └── Brand
        ├── ContentPillar
        ├── ContentIdea → Post
        │                 ├── PostCaption (per platform)
        │                 ├── PostHashtag
        │                 ├── ScheduledPostPlatform
        │                 └── ContentApproval
        └── CompetitorProfile → CompetitorInsight
```

## LLM Routing (accounts/services/llm_service.py)
- **Default**: Claude (Anthropic) — global admin key from settings
- **Fallback**: OpenAI → Gemini
- **Model Mapping**:
  - gpt-4o → claude-sonnet-4-20250514 OR gemini-2.0-flash
  - gpt-4o-mini → claude-haiku-4-5-20251001 OR gemini-2.0-flash-lite
  - gpt-4-turbo → claude-sonnet-4-20250514 OR gemini-1.5-pro
- **JSON Mode**: `response_format={"type": "json_object"}`
- **Extended Thinking**: `thinking_budget >= 1024`

---

## Models by App

### accounts/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| SiteConfiguration | key, value, is_active | Platform config KV store |
| UserProfile | user(1-1), subscription_plan, api_mode, usage counters | Per-user settings & limits |
| APIUsageLog | user, service, feature, tokens_used, estimated_cost | AI cost tracking |
| SupportDocument | title, file(PDF), extracted_text | Help docs with auto-extraction |
| SystemNotification | user, event_type, title, message, is_read | In-app notifications |
| UserRole | user, workspace, role(6 choices), granted_by | RBAC assignments |

**UserProfile.subscription_plan choices**: free, starter, pro, business, enterprise
**UserProfile.api_mode choices**: admin (use global keys), user (use own keys)
**UserRole.role choices**: owner, admin, creator, approver, publisher, viewer

---

### platforms/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| SocialAccount | user, platform(9 choices), account_name, status, tokens | Platform OAuth credentials |

**SocialAccount.platform choices**: facebook, twitter, instagram, linkedin, tiktok, youtube, pinterest, telegram, messenger
**SocialAccount.status choices**: active, expired, invalid, disconnected
**Key method**: `get_credentials()` — returns platform-specific credentials dict

---

### posts/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| Post | user, caption, status, platforms(JSON), scheduled_time, brand, idea | Core post object |
| PostCaption | post, platform, variant_number, body, is_selected, is_ab_test, ab_label | Per-platform caption variants |
| PostHashtag | post, platform, tag, tier, estimated_volume, is_selected, placement | Hashtag management |
| HashtagGroup | brand, name, tags(JSON) | Saved hashtag collections |
| BannedHashtag | brand, tag, reason | Brand-level banned hashtags |
| ScheduledPostPlatform | post, platform, caption(FK), scheduled_at, status, asset_variant | Per-platform schedule |

**Post.status flow**: draft → pending_approval → approved/rejected → scheduled → posted/failed
**PostCaption.platform choices**: twitter, linkedin, facebook, instagram, all
**PostHashtag.tier choices**: high_volume, mid_volume, niche
**PostHashtag.placement choices**: inline, end_of_caption, first_comment
**Platform char limits**: twitter=280, linkedin=3000, facebook=63206, instagram=2200

---

### ai_caption/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| UserAPISettings | user(1-1), _openai_api_key(base64), default_llm_provider, default models | Caption AI settings |
| CaptionGeneration | user, input_text, tone, length, platform, generated_caption, status | Caption generation history |
| CaptionTemplate | user, is_global, name, template_text, tone, platform | Reusable caption templates |
| SavedCaption | user, caption_generation, caption_text, is_favorite | Saved captions |

**Tone choices**: professional, casual, friendly, enthusiastic, humorous, inspirational, formal, conversational
**Length choices**: short(20-40w), medium(40-80w), long(80-120w), extra_long(120-200w)
**Platform choices**: general, facebook, instagram, twitter, linkedin, tiktok, youtube, pinterest
**default_llm_provider choices**: claude, openai, gemini
**CaptionGeneration.status**: pending, processing, completed, failed

---

### ai_image/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| UserImageSettings | user(1-1), default_provider, default_style, default_size, openai_model | Image AI settings |
| UserLogo | user, name, logo_file, is_default | User brand logos |
| ImageGeneration | user, post(FK), provider, style, size, logo(FK), logo_position, copy_overlay_* | Image generation |
| SavedImage | user, image_generation, is_favorite | Saved images |
| PromptTemplate | user, is_global, category, prompt_template | Reusable prompts |
| AssetPlatformVariant | asset(FK→ImageGeneration), platform, format_label, file_url, dimensions | Resized variants |
| CreativeVersionHistory | asset(FK), version, file_url, generation_params(JSON) | Version history |

**17 styles**: realistic, artistic, anime, cartoon, 3d_render, watercolor, oil_painting, digital_art, pixel_art, sketch, cinematic, fantasy, minimalist, vintage, neon, vivid, natural
**Logo positions**: none, top_left, top_right, top_center, bottom_left, bottom_right, bottom_center, center
**Platform dims**: instagram_feed=1080x1080, instagram_story=1080x1920, linkedin_feed=1200x627, twitter_feed=1200x675, facebook_feed=1200x630
**V1.2.2 Copy Overlay fields**: copy_overlay_image, copy_overlay_text, copy_overlay_settings(JSON)
**get_display_image()**: overlay > composited > with_logo > original

---

### ai_video/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| UserVideoSettings | user(1-1), default_style, default_duration, default_resolution | Video AI settings |
| VideoLogo | user, name, logo_file, is_default | Video logos |
| VideoGeneration | user, style, duration, aspect_ratio, fps, camera_motion, motion_intensity | Video generation |
| SavedVideo | user, video_generation, is_favorite | Saved videos |
| VideoPromptTemplate | user, is_global, category, prompt_template | Video prompts |

**15 video styles**: realistic, cinematic, anime, cartoon, 3d_animation, artistic, vintage, slow_motion, timelapse, documentary, sci_fi, fantasy, horror, comedy, music_video
**Aspect ratios**: 16:9, 9:16, 1:1, 4:3, 21:9
**FPS**: 24(cinematic), 30(standard), 60(smooth)
**Camera motion**: static, pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, orbit, dolly, crane, handheld
**Motion intensity**: subtle, moderate, dynamic, intense
**Durations**: 3, 5, 8, 10, 15 seconds

---

### ai_voice/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| UserVoiceSettings | user(1-1), openai_api_key(PLAINTEXT!), default_voice, default_speed | Voice AI settings |
| VoiceGeneration | user, input_text, voice, model, speed, output_format, audio_file | Voice generation |

**Voices**: alloy, echo, fable, onyx, nova, shimmer
**Models**: tts-1(standard), tts-1-hd(high quality)
**Output formats**: mp3, opus, aac, flac, wav, pcm
**Speed range**: 0.25 to 4.0

---

### analytics/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| Analytics | user, post, platform, metric_type, metric_value | V1.1 legacy metrics |
| PostAnalytics | post, platform, snapshot_type, impressions, reach, likes, engagement_rate | V1.2.1 analytics |
| PostComment | post, platform, body, sentiment, replied, reply_type | Comment tracking |
| LearningSignal | brand, signal_type, reference_id, data_json, applied | AI learning from past performance |
| RepurposedContent | original_post, new_post, repurpose_format | Content repurposing history |

**PostAnalytics.snapshot_type**: 24h, 48h, daily, weekly
**PostComment.sentiment**: positive, neutral, negative
**RepurposedContent.repurpose_format**: carousel, thread, reel, email, blog_outline
**performance_indicator**: green(>3%), yellow(>1.5%), red

---

### messenger_bot/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| MessengerConnection | user(1-1), page_id, page_access_token, verify_token, website_url | FB Page connection |
| AIConfiguration | connection(1-1), openai_api_key, rag_enabled, top_k_results, temperature | Bot AI config |
| PDFKnowledgeBase | connection, file, status, total_chunks | PDF upload for RAG |
| PDFChunk | pdf, text, chunk_index, page_number, embedding(JSON) | RAG vector chunks |
| CustomPrompt | connection, system_prompt, tone, is_active | Bot persona prompts |
| Conversation | connection, sender_id, human_takeover | FB user conversations |
| Message | conversation, message_type, sender, text, rag_context_used | Individual messages |
| Notification | connection, notification_type, priority, is_read | Bot alerts |
| ECommerceSettings | connection(1-1), platform_type, store_url, consumer_key | WooCommerce/Shopify |
| Product | ecommerce_settings, name, price, sku, stock_status, embedding | Synced products |

**E-commerce platforms**: woocommerce, shopify, custom
**CustomPrompt**: only ONE active per connection (enforced in save())
**human_takeover=True**: AI stops auto-replying to that conversation

---

### onboarding/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| OnboardingProgress | user(1-1), current_step, completed_steps(JSON), is_completed, is_skipped | 7-step onboarding |

**Steps**: 1=Create Workspace, 2=Brand Wizard, 3=Connect Platforms, 4=AI & Automation, 5=Generate Brand DNA, 6=Launch Plan, 7=Complete

---

### brands/models.py
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| Workspace | owner, name, timezone, team_size, max_generations_per_day | Top-level tenant |
| Brand | workspace, user, brand_name, industry, website_url, brand_dna(JSON), is_primary | Brand profile |
| BrandAsset | brand, file, asset_type | Logo, fonts, colors |
| LaunchPlan | brand(1-1), post_frequency, formats_allowed, variant_generation_level, approval_required | Content strategy |
| ContentIdea | brand, user, title, hook, angle, platform, status, pillar | Content ideas |
| ContentApproval | post, submitted_by, approver, status, compliance_checklist | Approval workflow |
| WeeklyReport | brand, workspace, period_start, data(JSON), winners, losers, recommendations | Analytics reports |
| GenerationUsage | workspace, generation_type, date, count | Usage tracking |
| ContentPillar | brand, name, target_percentage, color_code, is_active | Content categories |
| CompetitorProfile | brand, platform, handle_or_url, last_crawled_at | Competitor tracking |
| CompetitorInsight | competitor_profile, hook_text, engagement_score | Competitor content analysis |

**ContentIdea.status**: new, saved, skipped, drafted, scheduled
**ContentApproval.status**: pending, approved, changes_requested, rejected
**LaunchPlan.variant_generation_level**: off, low(1), medium(2), high(3)
**Brand DNA sources**: website, pdf, manual, structured

---

## Settings Key Configuration (socialsync/settings.py)

```python
# JWT
ACCESS_TOKEN_LIFETIME = 60 minutes
REFRESH_TOKEN_LIFETIME = 7 days
ROTATE_REFRESH_TOKENS = True
BLACKLIST_AFTER_ROTATION = True

# Auth
DEFAULT_AUTHENTICATION = ImpersonatingJWTAuthentication, SessionAuthentication
DEFAULT_PERMISSION = IsAuthenticated
PAGE_SIZE = 10

# CORS
CORS_ALLOWED_ORIGINS = [localhost:3000, abedintechllc.com, ngrok URL]
CORS_ALLOW_CREDENTIALS = True

# API Docs
Swagger: /doc/api/
ReDoc: /doc/api/redoc/
```

## URL Structure
```
/admin/          → Django Admin
/api/v1/         → All REST API (api/urls.py)
/doc/api/        → Swagger UI
/doc/api/redoc/  → ReDoc
/static/         → Static files
/media/          → User uploads
/{any}           → React SPA (catch-all)
```
