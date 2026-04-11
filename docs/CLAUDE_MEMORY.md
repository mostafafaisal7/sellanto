# SocialSync-AI Project Memory

## Project Overview
- **Name**: SocialSync-AI / SaleAnto (Django-based SaaS Social Media Management Platform)
- **Version**: v1.2.4 (current branch: dev)
- **Stack**: Django 6.0.3, DRF 3.16.1, React frontend, SQLite (dev) / MySQL (prod)
- **Working Dir**: D:/faysal/swapnil-project/sellanto/SocialSync-AI-DJango-main/sellanto

## Architecture
- **13 Django apps**: accounts, admin_panel, ai_caption, ai_image, ai_video, ai_voice, analytics, api, brands, messenger_bot, onboarding, platforms, posts
- **Multi-tenant**: Workspace → Brand → Content hierarchy
- **RBAC**: 6 roles (owner, admin, creator, approver, publisher, viewer)
- **Triple AI**: Claude (primary/default) + OpenAI (GPT-4o) + Google Gemini (2.0 Flash)
- **LLM Router**: `accounts/services/llm_service.py` — Claude first, fallback chain
- **Auth**: JWT (simplejwt, 60min access / 7day refresh) + Session + Admin Impersonation

## Key Files
- Settings: `socialsync/settings.py`
- Local Settings: `socialsync/settings_local.py`
- Main URLs: `socialsync/urls.py`
- API main views (3728 LOC): `api/views.py`
- API split view modules: `api/admin_views.py`, `api/strategy_views.py`, `api/caption_views.py`, `api/hashtag_views.py`, `api/approval_views.py`, `api/scheduling_views.py`, `api/analytics_views.py`, `api/notification_views.py`, `api/creative_views.py`, `api/rbac_views.py`
- **V1.2.4 NEW**: `api/diamond_views.py` (270 LOC) — Diamond Token + GlobalAPIKey admin endpoints
- API serializers (1674 LOC, refactored): `api/serializers.py`
- API URLs (330+ endpoints): `api/urls.py`
- LLM Service (607 LOC): `accounts/services/llm_service.py`
- **V1.2.4 NEW**: `accounts/services/diamond_service.py` — AI credit billing
- **V1.2.4 NEW**: `accounts/services/notification_service.py` — Centralized notifications
- **V1.2.4 NEW**: `accounts/api_keys.py` — Global API key resolver (DB → settings fallback)
- Messenger Bot views (920 LOC): `messenger_bot/views.py`
- Messenger Bot services: `messenger_bot/services/` (RAGEngine, MessageHandler, WooCommerceService, PDFProcessor)
- All models: `*/models.py` across each app
- Requirements: `requirements.txt`

## Critical Security Issues
1. ANTHROPIC_API_KEY env var named 'test' in settings.py (CRITICAL - wrong name)
2. GlobalAPIKey stores keys as plaintext TextField (DB-level, no encryption)
3. Hardcoded fallback SECRET_KEY in settings.py
4. Voice API key stored as plaintext CharField in UserVoiceSettings
5. No rate limiting on AI generation endpoints
6. Impersonation via `X-Impersonate-User` header - no audit log

## V1.2.4 New Architecture: Diamond Token System
- **DiamondWallet** + **DiamondTransaction** models in `accounts/models.py`
- **GlobalAPIKey** model — admin sets shared API keys for openai/gemini/claude
- `accounts/api_keys.py` — `get_openai_key()`, `get_gemini_key()`, `get_claude_key()` (DB → settings)
- `accounts/services/diamond_service.py` — `pre_check()`, `deduct_diamonds()`, `recharge_diamonds()`, `grant_plan_diamonds()`, `DIAMOND_COSTS` dict
- New user signal: auto-creates DiamondWallet + grants 200 free diamonds
- `api/diamond_views.py` — user balance/usage/transactions + admin recharge/keys/overview
- Diamond endpoints: `/api/v1/diamond/*` (user) + `/api/v1/admin/diamond-overview/` + `/api/v1/admin/global-api-keys/`
- **Pattern for AI views**: call `pre_check()` before, `deduct_diamonds()` after success → HTTP 402 on insufficient

## V1.2.4 Notification Service
- `accounts/services/notification_service.py` — `notify()` + domain helpers
- All events covered: post lifecycle, approvals, AI generation, analytics, platform tokens
- Email delivery via Django `send_mail` (fail_silently); channel: in_app/email/both

## Known Technical Debt
- `api/views.py` is monolithic (3500+ LOC) - needs splitting
- Empty tests.py files - zero test coverage
- `accounts/models_v1.py`, `models_v2.py` - unused legacy
- SQLite in use (should be MySQL/PostgreSQL for prod)
- No caching layer (Redis needed)
- No async task queue for video generation
- APScheduler present but usage unclear

## Subscription Plans
- Free / Starter / Pro / Business / Enterprise
- Tracked in UserProfile.subscription_plan
- Limits: max_social_accounts, max_posts_per_month, max_captions_per_month, etc.

## AI Generation Pipeline
- Captions: 8 tones × 4 lengths × 8 platforms + A/B testing
- Images: DALL-E 3 / Gemini, 17 styles, logo watermarking, platform variants, copy overlay (V1.2.2)
- Videos: 15 styles, aspect ratios, camera motion (12+ options), 5 durations
- Voice: OpenAI TTS, 6 voices, 6 output formats
- Brand DNA: Website crawl + PDF + manual input → RAG chunks

## Post Workflow
- Status: draft → pending_approval → approved/rejected → scheduled → posted/failed
- Approval log (ContentApproval model in brands app)
- Per-platform scheduling (ScheduledPostPlatform model in posts app)
- Caption variants per platform (PostCaption model)
- Hashtag management with tiers (PostHashtag model)
- Checklist: {caption, hashtags, creative, alt_text, platform_mapping}

## See Also
- [project_deep_analysis.md](project_deep_analysis.md) - **MASTER reference**: all models, endpoints, pipelines, code locations, patterns (Sections 18+19 = V1.2.4 Diamond + Notifications)
- [architecture.md](architecture.md) - Model relationships and field details
- [features_deep_analysis.md](features_deep_analysis.md) - Feature-by-feature UX + code implementation
- [api_endpoints.md](api_endpoints.md) - All 250+ API endpoints table
- [security.md](security.md) - Security issues and fixes
