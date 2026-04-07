# Sellanto (SocialSync)

AI-powered social media management platform for creators, marketers, and businesses. Create, schedule, approve, and publish content across 9+ platforms with AI-generated captions, images, and strategic insights.

**Current Version:** v1.6 (Magic Link V2)
**Branch:** feature/swapnil-v1.6

---

## Tech Stack

### Backend
| Tool | Purpose |
|------|---------|
| Django 4.x + DRF | REST API framework |
| MySQL (PyMySQL) | Production database |
| djangorestframework-simplejwt | JWT authentication |
| APScheduler | Background job scheduling |
| WhiteNoise | Static file serving |
| drf-spectacular | OpenAPI/Swagger docs |
| django-cors-headers | CORS handling |
| Gunicorn | Production WSGI server |

### Frontend
| Tool | Purpose |
|------|---------|
| React 19 + TypeScript 5.9 | UI framework |
| Vite 6.4 | Build tool |
| Zustand 5.0 | State management (persistent) |
| Axios 1.13 | HTTP client |
| React Router DOM 7.13 | Client-side routing |
| Tailwind CSS 3.4 | Styling |
| Framer Motion 12.34 | Animations |
| React Hook Form + Zod | Form handling & validation |
| Headless UI + Heroicons | UI components & icons |

### AI / LLM
| Provider | Usage |
|----------|-------|
| Claude (Anthropic) | Primary LLM for all text generation |
| OpenAI GPT-4o | Fallback text, primary for images (DALL-E 3), voice (TTS) |
| Google Gemini | Fallback LLM, image generation |
| ChromaDB | RAG/vector search |
| LangChain | LLM orchestration |

### Specialized Libraries
| Library | Purpose |
|---------|---------|
| moviepy | Video processing |
| Pillow | Image processing |
| BeautifulSoup4 | Web scraping (brand DNA) |
| PyPDF2 / pdfplumber | PDF brand guide parsing |
| tweepy | Twitter API |
| sentence-transformers | Text embeddings |
| pandas / scikit-learn | Data analysis |

---

## Project Structure

```
sellanto/
├── frontend/                          # React SPA
│   └── src/
│       ├── App.tsx                    # Routing (38+ routes)
│       ├── pages/                     # Page components
│       │   ├── DashboardPage.tsx      # Home dashboard
│       │   ├── CreatePostPage.tsx     # Manual post creation
│       │   ├── MyPostsPage.tsx        # Published posts
│       │   ├── DraftPostsPage.tsx     # Draft management
│       │   ├── ConnectAccountsPage.tsx# Social account OAuth
│       │   ├── StrategyHubPage.tsx    # Brand DNA, pillars, competitors
│       │   ├── IdeasHubPage.tsx       # AI idea generation
│       │   ├── CalendarPage.tsx       # Editorial calendar
│       │   ├── ApprovalReviewPage.tsx # Approval workflow
│       │   ├── OverflowPage.tsx       # 7-step content pipeline
│       │   ├── BusinessProfilePage.tsx# Brand setup wizard
│       │   ├── OnboardingPage.tsx     # 7-step onboarding
│       │   ├── magic/                 # Magic Mode wizard
│       │   │   ├── MagicModePage.tsx  # Main orchestrator
│       │   │   ├── URLInputScreen.tsx # Website URL input
│       │   │   ├── AIQuestionsScreen.tsx
│       │   │   ├── AIWorkingScreen.tsx
│       │   │   └── ResultsScreen.tsx  # Post review & approval
│       │   ├── admin/                 # Admin panel (5 pages)
│       │   └── ...                    # Settings, Profile, Info pages
│       ├── components/
│       │   ├── layout/               # Navbar, Sidebar, Footer
│       │   ├── ui/                   # Button, Card, Modal, Input, Badge...
│       │   ├── dashboard/            # Stats, QuickActions, Welcome
│       │   ├── diamond/              # Token balance & usage widgets
│       │   ├── redesign/             # V2 components (FeedbackModal, etc.)
│       │   └── platforms/            # OAuth connect modals
│       ├── store/                    # Zustand stores (8 stores)
│       │   ├── authStore.ts
│       │   ├── postStore.ts
│       │   ├── magicModeStore.ts     # Persisted
│       │   ├── overflowStore.ts      # Persisted
│       │   ├── diamondStore.ts
│       │   ├── dashboardStore.ts
│       │   ├── adminStore.ts
│       │   └── toastStore.ts
│       ├── services/                 # API client layer (16 services)
│       │   ├── api.ts                # Axios instance + interceptors
│       │   ├── authService.ts
│       │   ├── postService.ts
│       │   ├── captionService.ts
│       │   ├── imageService.ts
│       │   ├── strategyService.ts
│       │   ├── platformService.ts
│       │   ├── diamondService.ts
│       │   └── ...
│       └── types/                    # 700+ TypeScript type definitions
│
├── api/                              # DRF REST API (100+ endpoints)
│   ├── views.py                      # Core: auth, posts, platforms, dashboard
│   ├── strategy_views.py             # Pillars, competitors, ideas, trending
│   ├── caption_views.py              # Caption generation & management
│   ├── creative_views.py             # Image generation, alt-text, templates
│   ├── scheduling_views.py           # Scheduling, calendar, best times
│   ├── approval_views.py             # Submit, approve, reject, request changes
│   ├── admin_views.py                # Admin dashboard, user management
│   ├── diamond_views.py              # Token system endpoints
│   ├── hashtag_views.py              # Hashtag generation & management
│   ├── notification_views.py         # Notification CRUD
│   ├── rbac_views.py                 # Role-based access control
│   ├── serializers.py                # 80+ DRF serializers
│   └── urls.py                       # URL routing
│
├── posts/                            # Post model & scheduling
│   ├── models.py                     # Post, PostCaption, PostHashtag, SPP
│   ├── scheduler.py                  # APScheduler auto-publishing
│   ├── apps.py                       # Scheduler startup
│   └── services/
│       ├── best_time_service.py      # Optimal posting time analysis
│       └── hashtag_service.py        # 3-tier hashtag generation
│
├── brands/                           # Brand, workspace, strategy models
│   └── models.py                     # Workspace, Brand, ContentPillar,
│                                     # ContentIdea, CompetitorProfile, etc.
│
├── platforms/                        # Social media integrations
│   ├── models.py                     # SocialAccount (9 platforms)
│   ├── oauth_views.py                # Facebook/Twitter OAuth flows
│   └── services/                     # Platform-specific publishers
│       ├── facebook.py
│       ├── instagram.py
│       ├── twitter.py
│       └── linkedin.py
│
├── accounts/                         # User management
│   ├── models.py                     # UserProfile, DiamondWallet, GlobalAPIKey
│   └── services/
│       ├── llm_service.py            # Unified LLM routing (Claude/GPT/Gemini)
│       ├── diamond_service.py        # Token cost & deduction
│       └── notification_service.py   # Email & in-app notifications
│
├── onboarding/                       # Onboarding flow
├── ai_caption/                       # Caption generation models
├── ai_image/                         # Image generation models
├── ai_video/                         # Video generation (upcoming)
├── ai_voice/                         # Voice TTS (upcoming)
├── messenger_bot/                    # Facebook Messenger automation
│
├── socialsync/                       # Django project config
│   ├── settings.py
│   ├── urls.py
│   └── middleware.py
│
├── manage.py
└── requirements.txt
```

---

## Core Features

### 1. Magic Mode (V2) - AI-Powered Post Creation

4-screen wizard that takes a website URL and generates ready-to-publish posts:

1. **URL Input** - Enter website URL, optional logo upload
2. **AI Questions** - Industry, company size, platforms, content goals, tone
3. **AI Working** - Background pipeline: website crawl → trending topics → ideas → captions → images
4. **Results** - Per-platform post cards with:
   - Platform-specific captions (LinkedIn professional, Instagram punchy, Twitter concise)
   - AI-generated images with brand overlay
   - Edit caption, give AI feedback, or delete per platform
   - "Post All" (immediate) or "Schedule" (date/time picker)
   - "Next" button → dashboard when all posts resolved

**Approval modal on approve:**
- "Same caption for all platforms" → single caption, multi-platform cards
- "Different caption per platform" → AI generates unique captions per platform

### 2. Multi-Platform Publishing

**Supported platforms (9):**
- Facebook (Pages)
- Instagram (via Facebook Graph API)
- Twitter / X
- LinkedIn
- TikTok
- YouTube
- Pinterest
- Telegram
- Messenger (bot automation)

**Publishing flow:**
1. Create post with caption, media, platform selection
2. Optional: per-platform caption variants, hashtag placement
3. Schedule or publish immediately
4. Background scheduler auto-publishes at scheduled time (checks every 60s)
5. Per-platform status tracking with retry (max 3 attempts)

### 3. Content Strategy Tools

- **Brand DNA** - AI analyzes website/PDF to extract brand personality, voice, values, audiences
- **Content Pillars** - Core topic categories with target distribution percentages
- **Competitor Analysis** - Crawl competitors, extract content strategies, posting patterns
- **Trending Topics** - Platform-specific trend detection with relevance scoring
- **Content Ideas** - AI-generated ideas with hooks, angles, format suggestions
- **Best Times** - ML-based optimal posting time recommendations per platform

### 4. Overflow Pipeline (7-Step Workflow)

Full content strategy → multi-post creation pipeline:
1. Brand DNA analysis
2. Content pillar creation
3. Competitor research
4. Trending topic selection
5. Idea generation & selection
6. Per-platform caption generation
7. Media generation (AI images)
8. Multi-post creation with scheduling

### 5. Approval Workflow

Multi-level content approval system:
- **Statuses:** draft → pending_approval → approved/rejected/changes_requested → scheduled → posted
- **Checklist validation:** caption, hashtags, creative assets, alt-text, platform mapping
- **Role-based:** Creator, Approver, Publisher, Admin, Viewer
- **Audit trail:** Every action logged with timestamp and comment
- **SLA monitoring:** Automated breach detection every 30 minutes

### 6. AI Content Generation

**Captions:**
- Claude/GPT-4 powered with tone/style customization
- Platform-specific formatting (LinkedIn formal, Twitter 280 chars, TikTok Gen-Z)
- Multiple variants with A/B testing support
- Hashtag inclusion, CTA generation, emoji optimization

**Images:**
- DALL-E 3 / Gemini image generation
- Logo compositing (brand overlay)
- Platform-specific resizing
- Style templates: minimal, bold, gradient, vintage, modern
- Text overlay with AI-generated copy

**Other AI features:**
- Alt-text generation (GPT-4 Vision)
- Prompt engineering assistant
- Image diagnosis & re-prompting

### 7. Diamond Token System

Usage-based credit system for all AI operations:

| Feature | Cost (Diamonds) |
|---------|----------------|
| Caption generation | 5 |
| Image (standard) | 15 |
| Image (HD) | 40 |
| Hashtag generation | 3 |
| Brand DNA | 15 |
| Video (5s/10s/30s) | 500/1000/3000 |
| Voice TTS | 5-25 |

**Plans:**
| Plan | Diamonds |
|------|----------|
| Free | 50 |
| Starter | 500 |
| Pro | 2,500 |
| Business | 10,000 |
| Enterprise | 50,000 |

1 Diamond = $0.001 USD (3x SaaS markup on raw API costs)

### 8. Admin Panel

- User management (approve/reject new signups, plan assignment)
- Per-user API key management
- Global API key configuration (encrypted storage)
- Diamond token recharge
- System-wide analytics (users, posts, token usage by feature/provider)
- Facebook OAuth app settings
- User impersonation for debugging

### 9. Onboarding (7 Steps)

1. Workspace setup (name, timezone, team size)
2. Brand wizard (name, industry, website, region)
3. Connect social platforms (OAuth)
4. AI settings (API keys or use admin-provided)
5. Brand DNA generation (website crawl or manual)
6. Launch plan (posting frequency, formats, approval rules)
7. Complete

### 10. Editorial Calendar

- Month/week view of scheduled posts
- Platform color coding
- Best time indicators
- Rescheduling support
- Conflict detection (30-minute buffer)

### 11. Notifications

- In-app notification center with read/unread
- Email notifications for key events
- Event types: post_submitted, approved, rejected, published, failed, weekly_report, token_expiring, SLA_breach

---

## API Endpoints (100+)

### Authentication
```
POST /api/v1/auth/register/
POST /api/v1/auth/register-with-brand/
POST /api/v1/auth/login/
POST /api/v1/auth/logout/
POST /api/v1/auth/refresh/
GET  /api/v1/auth/me/
```

### Posts
```
GET    /api/v1/posts/                    # List (with filters)
POST   /api/v1/posts/                    # Create
GET    /api/v1/posts/{id}/               # Detail
PATCH  /api/v1/posts/{id}/               # Update
DELETE /api/v1/posts/{id}/               # Delete
POST   /api/v1/posts/{id}/cancel/        # Cancel scheduled
```

### Captions
```
POST /api/v1/ai-caption/generate/                  # Quick generate
POST /api/v1/ai-caption/regenerate/{id}/            # Regenerate with feedback
POST /api/v1/drafts/{post_id}/captions/generate/    # Generate for draft
GET  /api/v1/drafts/{post_id}/captions/             # List draft captions
POST /api/v1/captions/{id}/select/                  # Select variant
POST /api/v1/captions/{id}/preview/{platform}/      # Platform preview
```

### Images & Creative
```
POST /api/v1/ai-image/generate/                     # Generate image
POST /api/v1/ai-image/refine-prompt/                # Refine prompt
POST /api/v1/assets/{id}/alt-text/                  # Generate alt-text
POST /api/v1/assets/{id}/resize/                    # Platform resize
POST /api/v1/assets/{id}/copy-overlay/              # Text overlay
POST /api/v1/drafts/{post_id}/assets/generate/      # Generate for draft
```

### Scheduling
```
POST /api/v1/drafts/{post_id}/schedule/             # Schedule per-platform
PATCH /api/v1/scheduled-posts/{spp_id}/             # Reschedule
GET  /api/v1/schedule/calendar/                     # Calendar events
GET  /api/v1/brands/{id}/best-times/                # Best posting times
POST /api/v1/schedule/compute-times/                # AI time recommendations
POST /api/v1/schedule/conflict-check/               # Detect conflicts
```

### Hashtags
```
GET  /api/v1/drafts/{post_id}/hashtags/             # List
POST /api/v1/drafts/{post_id}/hashtags/generate/    # Generate (3-tier)
PATCH /api/v1/hashtags/{id}/                        # Toggle
```

### Approval
```
POST /api/v1/drafts/{post_id}/submit/               # Submit for review
POST /api/v1/drafts/{post_id}/approve/              # Approve
POST /api/v1/drafts/{post_id}/request-changes/      # Request changes
POST /api/v1/drafts/{post_id}/reject/               # Reject
GET  /api/v1/approvals/pending/                     # Pending list
```

### Strategy & Ideas
```
POST /api/v1/ideas/generate/                        # Generate ideas
POST /api/v1/ideas/{id}/regenerate/                 # Regenerate
GET  /api/v1/ideas/history/                         # Idea history
GET  /api/v1/trending/                              # Trending topics
POST /api/v1/brands/{id}/trending/generate/         # Generate trends
POST /api/v1/brands/{id}/generate-dna/              # Generate brand DNA
GET  /api/v1/brands/{id}/dna-status/                # DNA status
GET  /api/v1/brands/{id}/competitors/crawl/         # Crawl competitors
POST /api/v1/brands/{id}/pillars/generate/          # Generate pillars
```

### Brands & Workspace
```
GET  /api/v1/brands/                                # List brands
POST /api/v1/brands/                                # Create brand
GET  /api/v1/brands/{id}/                           # Brand detail
GET  /api/v1/workspaces/                            # List workspaces
```

### Platforms
```
GET  /api/v1/platforms/                             # Connected accounts
POST /api/v1/platforms/                             # Connect platform
GET  /api/v1/platforms/facebook/initiate/           # Start Facebook OAuth
GET  /api/v1/platforms/facebook/callback/           # OAuth callback
GET  /api/v1/platforms/facebook/status/             # Connection status
```

### Diamond Tokens
```
GET  /api/v1/diamond/balance/                       # Current balance
GET  /api/v1/diamond/usage/                         # Usage breakdown
GET  /api/v1/diamond/transactions/                  # Transaction history
GET  /api/v1/diamond/cost-preview/                  # Preview cost
```

### Dashboard
```
GET  /api/v1/dashboard/stats/                       # Dashboard stats
GET  /api/v1/dashboard/recent/                      # Recent posts
```

### Notifications
```
GET    /api/v1/notifications/                       # List
GET    /api/v1/notifications/unread-count/           # Unread count
POST   /api/v1/notifications/mark-all-read/         # Mark all read
PATCH  /api/v1/notifications/{id}/read/             # Mark one read
DELETE /api/v1/notifications/{id}/                  # Delete
```

### Admin
```
GET  /api/v1/admin/dashboard/                       # Admin stats
GET  /api/v1/admin/users/                           # User list
GET  /api/v1/admin/users/{id}/                      # User detail
POST /api/v1/admin/users/{id}/approve/              # Approve user
POST /api/v1/admin/users/{id}/plan/                 # Update plan
POST /api/v1/admin/users/{id}/api-settings/         # API keys
POST /api/v1/admin/users/{id}/recharge/             # Recharge diamonds
POST /api/v1/admin/bulk-approve/                    # Bulk approve
```

### RBAC
```
GET  /api/v1/workspaces/{id}/roles/                 # List roles
POST /api/v1/workspaces/{id}/roles/assign/          # Assign role
POST /api/v1/workspaces/{id}/roles/remove/          # Remove role
GET  /api/v1/my-roles/                              # My roles
```

---

## Data Models

### Core Models

**Post** (`posts/models.py`)
- caption, media_files (JSON), platforms (JSON), scheduled_time, timezone
- status: draft | pending_approval | changes_requested | approved | rejected | scheduled | posting | posted | failed | cancelled
- source: manual | magic | overflow
- format_type: static | carousel | reel | thread | story | text
- Per-platform post IDs and error tracking (facebook_post_id, twitter_error, etc.)
- Checklist: {caption, hashtags, creative, alt_text, platform_mapping}
- Relations: brand, pillar, idea

**PostCaption** - Platform-optimized caption variants with A/B testing
**PostHashtag** - 3-tier hashtags (high_volume, mid_volume, niche) with placement options
**ScheduledPostPlatform** - Per-platform scheduling with individual status tracking and retry

**SocialAccount** (`platforms/models.py`)
- 9 platforms: facebook, twitter, instagram, linkedin, tiktok, youtube, pinterest, telegram, messenger
- Per-platform OAuth credentials and token management
- Status: active | expired | invalid | disconnected

**Brand** (`brands/models.py`)
- brand_name, industry, target_region, website_url, social_links
- logo, brand_guide_pdf, voice_tone, do_dont_rules
- brand_dna (JSON), brand_dna_source (website | pdf | manual | structured)

**Workspace** - Team workspace with timezone, daily generation limits
**ContentPillar** - Content categories with target distribution
**ContentIdea** - AI-generated ideas with hooks, angles, formats
**CompetitorProfile** - Tracked competitors with insights

**UserProfile** (`accounts/models.py`)
- Plan: free | starter | pro | business | enterprise
- Monthly limits for posts, captions, images
- Per-user or admin-provided API keys

**DiamondWallet** - Credit balance, lifetime stats
**DiamondTransaction** - Immutable ledger (recharge, deduction, refund, plan_grant)

---

## Frontend Routing

### Public
```
/login              → LoginPage
/register           → LoginPage
```

### Protected (with Layout)
```
/                   → DashboardPage
/posts              → MyPostsPage
/posts/create       → CreatePostPage
/posts/:id/edit     → CreatePostPage
/posts/drafts       → DraftPostsPage
/platforms          → ConnectAccountsPage
/profile            → ProfilePage
/settings           → SettingsPage
/business-profile   → BusinessProfilePage
/strategy           → StrategyHubPage
/ideas              → IdeasHubPage
/ideas/history      → IdeaHistoryPage
/calendar           → CalendarPage
/approvals          → ApprovalReviewPage
/overflow           → OverflowPage
/overflow/history   → OverflowHistoryPage
/settings/permissions → PermissionsPage
```

### Magic Mode (no sidebar/layout)
```
/mode-select        → ModeSelectPage
/magic              → MagicModePage (4-screen wizard)
/magic/history      → MagicHistoryPage
/magic/draft        → MagicDraftPage
/onboarding         → OnboardingPage (7-step)
/setup/*            → SetupFlowPage
/getting-started    → GettingStartedPage
```

### Admin (staff only)
```
/admin-panel                    → AdminDashboardPage
/admin-panel/users              → AdminUsersPage
/admin-panel/users/:id          → AdminUserDetailPage
/admin-panel/api-keys           → AdminAPIKeysPage
/admin-panel/facebook-settings  → AdminFacebookSettingsPage
```

---

## Background Jobs (APScheduler)

| Job | Interval | Purpose |
|-----|----------|---------|
| check_and_post | 1 min | Auto-publish scheduled posts |
| run_sla_check | 30 min | Approval SLA monitoring |
| run_analytics_sync | 6 hrs | Sync engagement metrics |
| run_weekly_report | Sunday midnight | Brand performance reports |
| run_comment_sync | 15 min | Fetch social media comments |
| run_token_health_check | Daily 6 AM | Check OAuth token expiry |
| run_trending_fetch | 6 hrs | Fetch trending topics |

Worker management uses flock-based file locking to prevent duplicate execution across Gunicorn workers.

---

## LLM Service Architecture

Claude is the **primary provider** for all text generation. Unified routing through `accounts/services/llm_service.py`:

```python
service = get_llm_service(user)
result = service.chat_completion(
    messages=[...],
    temperature=0.7,
    max_tokens=500,
    response_format={"type": "json_object"},  # JSON mode
    thinking_budget=10000,                     # Extended thinking (Claude)
)
```

**Provider priority chain:** Claude → OpenAI → Gemini

**Features:**
- Automatic message format conversion across providers
- Extended thinking support (Claude)
- JSON mode with validation
- Vision/image support (base64 & URL)
- Model mapping across providers
- Fallback on provider failure

---

## Hashtag Strategy (3-Tier)

| Tier | Distribution | Volume | Purpose |
|------|-------------|--------|---------|
| High Volume | 30% | 100k+ posts | Reach & visibility |
| Mid Volume | 40% | 10k-100k | Sweet spot for ranking |
| Niche | 30% | <10k | Low competition, top rank |

**Per-platform limits:** Instagram (20), LinkedIn (5), Twitter (3), Facebook (3)

Supports brand-level banned hashtag lists and placement options (inline, end_of_caption, first_comment).

---

## Design System

### Colors (Dark Theme Only)
```
Primary:    #E8364F (coral)
Hover:      #FF6B7A (coral-hover)
Secondary:  #8B5CF6 (purple)
Success:    #10B981 (green)
Info:       #3B82F6 (blue)
Warning:    #F59E0B (amber)
Background: #0A0E27 (primary), #0F1635 (secondary)
```

### Typography
- **Headings:** DM Sans
- **Body:** Inter
- **Code:** JetBrains Mono

### UI Components
Button (primary/secondary/ghost/danger/success), Card (glass-morphism), Modal (backdrop blur), Input/Textarea, Badge, StatusBadge, PlatformBadge, Avatar, Spinner, Toast

---

## Installation & Setup

### Backend

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate         # Linux/Mac
venv\Scripts\activate            # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env             # Edit with your settings

# Database setup
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic

# Run server
python manage.py runserver 8010
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # Development (http://localhost:3000)
npm run build                    # Production build → dist/
```

### Environment Variables

```env
# Django
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (MySQL)
DB_ENGINE=django.db.backends.mysql
DB_NAME=sellanto
DB_USER=root
DB_PASSWORD=password
DB_HOST=127.0.0.1
DB_PORT=3306

# AI API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...

# Facebook OAuth
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_REDIRECT_URI=http://localhost:8000/api/v1/platforms/facebook/callback/

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Accessing the App
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8010/api/v1/
- **Django Admin:** http://localhost:8010/admin/
- **API Docs:** http://localhost:8010/doc/api/

---

## Deployment

### Static Files
Django serves React build from `frontend/dist/` via WhiteNoise middleware. Build frontend first, then deploy backend.

### Production Server
```bash
gunicorn socialsync.wsgi --workers 3 --bind 0.0.0.0:8000
```

### Scheduler
APScheduler auto-starts on Django startup. Uses file lock (`/tmp/sellanto_scheduler.lock`) to ensure only one worker runs the scheduler across Gunicorn processes.

### Database
Production uses MySQL. Always backup before migrations:
```bash
python manage.py migrate
```

---

## Security

- JWT authentication on all API endpoints (except register/login)
- Admin endpoints require `is_staff` permission
- Role-based access control (RBAC) with workspace isolation
- Encrypted API key storage (GlobalAPIKey model)
- OAuth CSRF protection via UUID state tokens (10-min expiry)
- Input validation: Zod schemas (frontend), DRF serializers (backend)
- HTTPS required in production
- User API keys masked in responses
- Diamond token pre-flight check prevents unauthorized AI usage

---

## Version History

| Version | Features |
|---------|----------|
| v1.0 | Core post scheduling, authentication, multi-platform support |
| v1.2.1 | Strategy hub, content pillars, competitor analysis, approval workflow, weekly reports |
| v1.3 | Overflow pipeline, DNA history, idea history, trending topics |
| v1.4 | Pillar generation, trend feedback, manual trend input |
| v1.5 | Diamond token system, admin panel, API key management |
| v1.6 | Magic Mode V2 — per-platform captions, approve flow, draft page, in-page publish |

---

## Project Statistics

- **Frontend:** ~18,200 lines TypeScript/React across ~100 files
- **Backend:** 100+ API endpoints across 12+ view modules
- **Database:** 30+ Django models
- **Python Dependencies:** 180+ packages
- **UI Components:** 60+ React components
- **State Stores:** 8 Zustand stores
- **API Services:** 16 frontend service modules
- **Type Definitions:** 700+
