# SocialSync (SaleAnto) — Version 1.2.3

**All-in-One AI-Powered Social Media Management Platform**

> Full-stack SaaS application with Django REST Framework backend, React 19 frontend, JWT authentication, AI content generation (OpenAI + Google Gemini), multi-platform social media publishing, Messenger chatbot with RAG, and a comprehensive admin panel.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Features Overview](#features-overview)
5. [Frontend Pages & Routes](#frontend-pages--routes)
6. [Complete API Reference](#complete-api-reference)
7. [Database Models](#database-models)
8. [Authentication & Authorization](#authentication--authorization)
9. [Third-Party Integrations](#third-party-integrations)
10. [Deployment](#deployment)

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.x | Runtime |
| Django | 4.2.7 | Web framework |
| Django REST Framework | 3.14.0 | REST API |
| SimpleJWT | 5.5.1 | JWT Authentication |
| MySQL (PyMySQL) | 1.1.1 | Database |
| OpenAI SDK | 2.14.0 | AI Caption, Voice, Messenger Bot |
| Google Generative AI | 0.8.6 | AI Image & Video Generation (Gemini) |
| Tweepy | 4.14.0 | Twitter/X API |
| MoviePy | 2.2.1 | Video processing & logo overlay |
| Pillow | 10.1.0 | Image processing & compositing |
| PyPDF2 | 3.0.1 | PDF text extraction (RAG) |
| BeautifulSoup4 | 4.14.3 | Web scraping (Brand DNA, competitors) |
| APScheduler | 3.11.1 | Background scheduling |
| WhiteNoise | 6.7.0 | Static file serving |
| pytrends | 4.9.3 | Google Trends data |
| Django CORS Headers | 4.9.0 | CORS management |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 6.4.1 | Build tool & dev server |
| React Router DOM | 7.13.0 | Client-side routing |
| Zustand | 5.0.11 | State management |
| TailwindCSS | 3.4.0 | Utility-first CSS |
| Axios | 1.13.5 | HTTP client |
| Framer Motion | 12.34.0 | Animations |
| React Hook Form | 7.71.1 | Form management |
| Zod | 4.3.6 | Schema validation |
| Headless UI | 2.2.9 | Accessible UI primitives |
| Heroicons | 2.2.0 | Icon library |
| date-fns | 4.1.0 | Date utilities |
| react-markdown | 10.1.0 | Markdown rendering |

---

## Project Structure

```
Final_version_socialSync/
├── socialsync/              # Django main project (settings, urls, wsgi, middleware)
├── accounts/                # User profiles, RBAC, notifications, site config
├── admin_panel/             # Super-admin panel logic
├── ai_caption/              # AI caption generation (OpenAI GPT)
├── ai_image/                # AI image generation (DALL-E, Gemini)
├── ai_video/                # AI video generation (Gemini)
├── ai_voice/                # AI text-to-speech (OpenAI TTS)
├── analytics/               # Post analytics, comments, learning signals
├── api/                     # REST API layer (all ViewSets, serializers, views)
├── brands/                  # Workspaces, brands, content pillars, strategy
├── messenger_bot/           # Facebook Messenger chatbot with RAG
├── onboarding/              # User onboarding wizard
├── platforms/               # Social account connections (8 platforms)
├── posts/                   # Post CRUD, captions, hashtags, scheduling
├── upcoming_features/       # Placeholder for future features
├── frontend/                # React 19 SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page-level components
│   │   ├── store/           # Zustand state management
│   │   ├── services/        # API service layer (Axios)
│   │   └── App.tsx          # Root router
│   └── dist/                # Production build output
├── static/                  # Django static files
├── staticfiles/             # Collected static files (WhiteNoise)
├── media/                   # User uploads (avatars, images, videos, PDFs)
├── templates/               # Django HTML templates
├── manage.py                # Django management CLI
├── requirements.txt         # Python dependencies
└── .env                     # Environment variables
```

---

## Environment Setup

### 1. Clone & Install Backend

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True

# Database (MySQL)
DB_NAME=your_database_name
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306

# AI API Keys (optional — users can also set via Settings page)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

### 3. Run Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

### 4. Install & Build Frontend

```bash
cd frontend
npm install
npm run dev      # Development (localhost:3000)
npm run build    # Production build → frontend/dist/
```

### 5. Run the Server

```bash
python manage.py runserver
```

- **Backend API**: `http://localhost:8000/api/v1/`
- **Frontend (dev)**: `http://localhost:3000`
- **Django Admin**: `http://localhost:8000/admin/`

---

## Features Overview

### 1. Authentication & User Management
- JWT-based authentication (access token 60min, refresh token 7 days)
- User registration with admin approval system
- User profiles with subscription plans (Free, Starter, Pro, Business, Enterprise)
- Monthly usage limits per plan (posts, captions, images, videos, messenger messages)
- API key management (admin-provided or user-provided modes)
- Token usage tracking (OpenAI & Gemini)

### 2. Onboarding Wizard (7 Steps)
- Step 1: Create Workspace
- Step 2: Brand Wizard (name, industry, region, voice & tone)
- Step 3: Connect Social Platforms
- Step 4: AI & Automation Setup
- Step 5: Generate Brand DNA (from website crawl or PDF)
- Step 6: Launch Plan Configuration
- Step 7: Onboarding Complete

### 3. Brand & Workspace Management
- Multi-workspace support
- Multi-brand per workspace
- Brand DNA generation (AI-powered from website crawl/PDF/manual input)
- Brand DNA history with rollback capability
- Brand assets management (logos, icons, banners, fonts, color palettes, templates)
- Brand voice & tone rules (do/don't rules)
- Launch plan configuration (post frequency, format types, variant levels, approval requirements)

### 4. Content Strategy Hub (V1.2.1)
- Content pillars with target percentages for balanced calendar
- Competitor profile tracking (Twitter, LinkedIn, Facebook, Instagram, Website)
- Competitor content crawling and insight extraction
- Pillar compliance checking
- Brand overlay templates for generated creatives

### 5. AI Content Idea Generation
- AI-powered idea generation based on brand DNA, pillars, and audience
- Trending topics integration (Google Trends via pytrends)
- Brand-specific trending topic analysis with relevance scoring
- Idea history tracking
- Convert ideas to drafts with one click
- Add ideas directly to content calendar
- Source tracking (AI Generated, Trending Topic, Competitor Inspired)
- Engagement tier prediction (Low, Mid, High)

### 6. AI Caption Generation
- Powered by OpenAI GPT-4o / GPT-4o-mini / GPT-4 Turbo
- 8 tone options: Professional, Casual, Friendly, Enthusiastic, Humorous, Inspirational, Formal, Conversational
- 4 length options: Short (20-40 words), Medium (40-80), Long (80-120), Extra Long (120-200)
- Platform-specific optimization (Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest)
- Media analysis: Upload an image/video → AI analyzes it and generates relevant captions
- Include/exclude hashtags, emojis, call-to-action
- Custom instructions support
- Caption templates (pre-defined for Product Launch, Promotion, Event, Announcement, etc.)
- Save/favorite captions
- Regeneration support
- Token usage tracking

### 7. Draft Caption System (V1.2.1)
- Per-post multi-variant captions with platform adaptation
- A/B testing labels (Variant A / Variant B)
- Platform character limit validation with color indicators (green/yellow/red)
- Caption preview per platform
- Select best caption for each platform
- Auto-adapt captions across platforms

### 8. Hashtag Engine (V1.2.1)
- AI-powered hashtag generation per platform
- Three-tier system: High Volume (Reach), Mid Volume (Relevance), Niche (Authority)
- Placement options: Inline, End of Caption, First Comment (Instagram)
- Platform-specific defaults (Instagram: 20, LinkedIn: 5, Twitter: 3, Facebook: 3)
- Reusable saved hashtag groups per brand
- Brand-level banned hashtags
- Toggle individual hashtags on/off

### 9. AI Image Generation
- **Providers**: OpenAI DALL-E 3/2 and Google Gemini
- **17 art styles**: Realistic, Artistic, Anime, Cartoon, 3D Render, Watercolor, Oil Painting, Digital Art, Pixel Art, Sketch, Cinematic, Fantasy, Minimalist, Vintage, Neon, Vivid, Natural
- **10 size options**: 256x256 to 1920x1080
- **Logo overlay**: Upload logos, choose position (8 positions), size (5-30%), opacity (10-100%)
- **Product compositing**: Upload product images, place in generated scenes
- **Advanced options**: Seed, prompt enhancement, lighting (7 options), camera angle (9 options)
- **Quality settings**: Standard, High, HD, Ultra HD
- Prompt templates (Social Media, Marketing, Product, Portrait, Landscape, etc.)
- Image history & saved favorites
- Download tracking

### 10. Creative Asset Management (V1.2.1)
- Draft-scoped asset generation and upload
- AI-generated alt text for accessibility (max 125 chars)
- Auto-resize to platform dimensions:
  - Instagram Feed: 1080x1080
  - Instagram Story: 1080x1920
  - LinkedIn Feed: 1200x627
  - Twitter Feed: 1200x675
  - Facebook Feed: 1200x630
  - Facebook Story: 1080x1920
- Brand template overlay application
- Version history tracking for creative iterations
- Asset regeneration
- Carousel splitting
- Clone draft with all assets

### 11. AI Video Generation
- **Provider**: Google Gemini
- **15 styles**: Realistic, Cinematic, Anime, Cartoon, 3D Animation, Artistic, Vintage, Slow Motion, Timelapse, Documentary, Sci-Fi, Fantasy, Horror, Comedy, Music Video
- **Duration options**: 3s, 5s, 8s, 10s, 15s, 30s
- **Resolutions**: 480p, 720p, 1080p, 4K
- **Aspect ratios**: 16:9, 9:16, 1:1, 4:3, 21:9
- **FPS options**: 24 (Cinematic), 30 (Standard), 60 (Smooth)
- **Camera motions**: Static, Pan Left/Right, Tilt Up/Down, Zoom In/Out, Orbit, Dolly, Crane, Handheld
- **Motion intensity**: Subtle, Moderate, Dynamic, Intense
- Logo watermark overlay with configurable position, size, opacity
- Prompt enhancement
- Thumbnail auto-generation
- Video templates (Social Media, Marketing, Product Demo, Intro/Outro, etc.)
- Saved videos & favorites

### 12. AI Voice / Text-to-Speech
- **Provider**: OpenAI TTS-1 / TTS-1-HD
- **6 voices**: Alloy (Neutral), Echo (Male), Fable (British), Onyx (Deep Male), Nova (Female), Shimmer (Soft Female)
- **Speed control**: 0.25x to 4.0x
- **Output formats**: MP3, Opus, AAC, FLAC, WAV, PCM
- Preview before full generation
- Voice generation history
- Audio file download
- Character usage tracking

### 13. Multi-Platform Social Media Publishing
- **8 supported platforms**:
  - Facebook (Page ID + Access Token)
  - Twitter/X (API Key, Secret, Access Token, Token Secret)
  - Instagram (Graph API Access Token + Business Account ID)
  - LinkedIn (Access Token + Person URN)
  - TikTok (Access Token + Refresh Token)
  - YouTube (Access Token + Refresh Token + Channel ID)
  - Pinterest (Access Token + Board ID)
  - Telegram (Bot Token + Channel ID)
- Account validation & status tracking (Active, Expired, Invalid, Disconnected)
- Token expiry monitoring
- Per-platform credential management

### 14. Post Management & Scheduling
- Full post lifecycle: Draft → Pending Approval → Approved → Scheduled → Posting → Posted
- Post format types: Static Image, Carousel, Reel/Short, Thread, Story, Text Only
- Post goals: Lead Generation, Audience Growth, Thought Leadership
- Media file attachments (JSON array)
- Per-platform post ID and error tracking
- **Draft checklist** (V1.2.1): Caption, Hashtags, Creative, Alt Text, Platform Mapping
- Platform-specific scheduling (different times per platform)
- Best time suggestions (from own data or industry defaults)
- Conflict checking for overlapping schedules
- Calendar view
- Reschedule capability

### 15. Content Approval Pipeline (V1.2.1)
- Submit drafts for approval
- Approve / Request Changes / Reject workflow
- Rejection reason categories: Off Brand, Compliance Issue, Quality, Factual Error, Timing, Other
- Full approval log with audit trail
- Pending approvals queue
- Compliance checklist

### 16. Analytics & Reporting (V1.1 + V1.2.1)
- Platform analytics summary
- Analytics trends over time
- Top performing posts
- **Post-level analytics** (V1.2.1):
  - Performance snapshots: 24h, 48h, Daily, Weekly
  - Metrics: Impressions, Reach, Engagement Rate, Likes, Comments, Shares, Clicks, Saves, Profile Visits
  - Performance indicator (green/yellow/red)
- **Comment management** (V1.2.1):
  - Track comments on published posts
  - Sentiment analysis (Positive, Neutral, Negative)
  - Manual reply
  - AI-powered auto-reply
- **A/B test results**: Compare Variant A vs B performance
- **Learning signals**: Best/worst hooks, times, formats, pillars; A/B winners
- **Winner post detection**: Identify top performers automatically
- **Content repurposing**: Convert winners into Carousel, Thread, Reel, Email, Blog Outline
- **Weekly reports** per brand:
  - Winners & losers
  - Best hooks & posting times
  - Pillar performance (actual vs target)
  - A/B test results
  - AI-generated recommendations
  - Next week experiment suggestions
- **Analytics dashboard** per brand

### 17. Facebook Messenger AI Chatbot
- Connect any Facebook Page
- Webhook-based real-time messaging
- **AI engine**: OpenAI GPT-4o / GPT-4o-mini / GPT-4 Turbo / GPT-3.5 Turbo
- **RAG (Retrieval-Augmented Generation)**:
  - Upload PDF knowledge base documents
  - Auto-extract text from PDFs
  - Vectorized text chunks with OpenAI embeddings
  - Configurable similarity threshold (0-1) and top-k results
- **Website crawling**: Extract knowledge from business website
- **Custom prompts**: Define AI personality, role, behavior, tone
- **Image understanding**: Vision-enabled chatbot (GPT-4o)
- **Voice message support**:
  - Transcribe incoming voice messages (Whisper)
  - Reply with voice messages (TTS)
  - 6 voice options
- **Human takeover mode**: Disable auto-reply per conversation
- **Send manual messages** from dashboard
- **E-Commerce integration** (WooCommerce/Shopify):
  - Product sync from store
  - AI-powered product matching via embeddings
  - Product recommendations in chat
  - Configurable match threshold & currency
- **Smart notifications**: Product Inquiry, Appointment, Order, Urgent, Complaint, Pricing, Availability, Contact
- Conversation history with full message tracking
- Delivery & read status tracking

### 18. Overflow Page (V1.3 — Guided Content Creation Flow)
- Step-by-step guided workflow for new users
- Step 1: Brand DNA + Pillars + Competitors + Trending setup
- Step 2: Select ideas & set media preferences
- Step 3: Select captions
- Step 4: Generate media (image/video)
- Step 5: Create and schedule post
- Progress tracking with skip option
- Auto-redirects logged-in users to this page

### 19. Notification System (V1.2.1)
- 20 event types including:
  - Post lifecycle: Submitted, Approved, Changes Requested, Rejected
  - Approval reminders (12h, 24h escalation)
  - Scheduling: Scheduled, Published, Failed
  - Content: Captions Ready, Images Ready, Video Rendering/Ready
  - Analytics: Weekly Report, Winner Detected, Repurpose Suggestion, New Comment
  - System: Token Expiring, Daily Limit Warning (80%), Reply SLA Breach
- Channels: In-App, Email, Both
- Unread count badge
- Mark as read (individual & bulk)
- Delete notifications

### 20. Role-Based Access Control (RBAC) (V1.2.1)
- Workspace-level role assignments
- 6 roles: Owner, Admin, Creator, Approver, Publisher, Viewer
- Assign/remove roles per workspace
- Workspace owners automatically have all permissions
- View own roles across workspaces

### 21. Admin Panel (Super Admin)
- Admin dashboard with system-wide statistics
- Full user management:
  - List all users with filtering
  - View user details (profile, posts, accounts, captions, images, videos, messenger)
  - Approve/reject user registrations
  - Bulk approve users
  - Update user subscription plans
  - Configure user API settings (admin vs user-provided keys)
- Impersonation middleware (admin can act as any user)
- View conversation messages
- System-wide analytics
- Separate admin layout with dedicated navigation

### 22. AI Support Chat
- Built-in support chatbot
- PDF-based knowledge base (SupportDocument model)
- Auto-extract text from uploaded PDFs
- AI-powered responses using knowledge base context

### 23. Generation Usage Tracking
- Per-workspace daily generation tracking
- Types: Idea, Caption, Image, Video, Brand DNA
- Daily generation limits (configurable per workspace, default: 200/day)
- Auto-reset daily counters

---

## Frontend Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/login` | LoginPage | User login (redirects to `/overflow` if authenticated) |
| `/register` | LoginPage | User registration |
| `/onboarding` | OnboardingPage | Full-screen 7-step onboarding wizard |
| `/business-profile` | BusinessProfilePage | Brand setup wizard (accessible during onboarding) |
| `/` | DashboardPage | Main dashboard with stats & recent posts |
| `/overflow` | OverflowPage | Guided content creation flow (default landing page) |
| `/posts` | MyPostsPage | List all posts with status filters |
| `/posts/create` | CreatePostPage | Create new post / draft |
| `/posts/:id/edit` | CreatePostPage | Edit existing post / draft |
| `/platforms` | ConnectAccountsPage | Connect & manage social media accounts |
| `/profile` | ProfilePage | User profile management |
| `/settings` | SettingsPage | API keys & app settings |
| `/ai-caption` | AICaptionPage | AI caption generator |
| `/ai-image` | AIImagePage | AI image generator |
| `/ai-video` | AIVideoPage | AI video generator |
| `/ai-voice` | AIVoicePage | AI text-to-speech |
| `/messenger` | MessengerBotPage | Messenger chatbot management |
| `/analytics` | AnalyticsPage | Post analytics & reporting |
| `/strategy` | StrategyHubPage | Content pillars, competitors, brand templates |
| `/ideas` | IdeasHubPage | AI idea generation & management |
| `/ideas/history` | IdeaHistoryPage | Browse all past generated ideas |
| `/calendar` | CalendarPage | Content scheduling calendar |
| `/approvals` | ApprovalReviewPage | Pending approvals queue & review |
| `/settings/permissions` | PermissionsPage | RBAC role management |
| `/about` | AboutPage | About the platform |
| `/privacy` | PrivacyPage | Privacy policy |
| `/terms` | TermsPage | Terms of service |
| `/help` | HelpPage | Help & documentation |
| `/admin-panel` | AdminDashboardPage | Admin dashboard (staff only) |
| `/admin-panel/users` | AdminUsersPage | User management list |
| `/admin-panel/users/:id` | AdminUserDetailPage | Individual user details & management |
| `/admin-panel/analytics` | AdminAnalyticsPage | System-wide analytics |

---

## Complete API Reference

**Base URL**: `/api/v1/`

All API endpoints require JWT authentication unless marked as public. Include the header:
```
Authorization: Bearer <access_token>
```

---

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register/` | Register new user (public) |
| `POST` | `/api/v1/auth/login/` | Login → returns access + refresh tokens (public) |
| `POST` | `/api/v1/auth/logout/` | Logout (blacklists refresh token) |
| `POST` | `/api/v1/auth/refresh/` | Refresh access token using refresh token |
| `GET` | `/api/v1/auth/me/` | Get current authenticated user info |

---

### User Profile

| Method | Endpoint | Description |
|---|---|---|
| `GET/PUT` | `/api/v1/profile/` | View/update user profile |
| `GET/PUT` | `/api/v1/profile/api-keys/` | View/update global API keys (OpenAI, Gemini) |

---

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/dashboard/stats/` | Get dashboard summary statistics |
| `GET` | `/api/v1/dashboard/recent/` | Get recent posts list |

---

### Onboarding

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/onboarding/` | Get onboarding progress |
| `POST` | `/api/v1/onboarding/step/<step_number>/` | Complete an onboarding step (1-7) |
| `POST` | `/api/v1/onboarding/skip/` | Skip onboarding entirely |

---

### Workspaces

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/workspaces/` | List user's workspaces |
| `POST` | `/api/v1/workspaces/` | Create a new workspace |
| `GET` | `/api/v1/workspaces/<id>/` | Get workspace details |
| `PUT/PATCH` | `/api/v1/workspaces/<id>/` | Update workspace |
| `DELETE` | `/api/v1/workspaces/<id>/` | Delete workspace |

---

### Brands

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/brands/` | List all brands |
| `POST` | `/api/v1/brands/` | Create a new brand |
| `GET` | `/api/v1/brands/<id>/` | Get brand details |
| `PUT/PATCH` | `/api/v1/brands/<id>/` | Update brand |
| `DELETE` | `/api/v1/brands/<id>/` | Delete brand |

---

### Brand DNA

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/brands/<brand_id>/generate-dna/` | Generate Brand DNA (website crawl/PDF/manual) |
| `GET` | `/api/v1/brands/<brand_id>/dna-status/` | Check DNA generation status |
| `GET` | `/api/v1/brands/<brand_id>/dna-history/` | List all DNA history versions |
| `POST` | `/api/v1/brands/<brand_id>/dna-history/<history_id>/restore/` | Restore a previous DNA version |

---

### Brand Assets

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/brand-assets/` | List all brand assets |
| `POST` | `/api/v1/brand-assets/` | Upload a new brand asset |
| `GET` | `/api/v1/brand-assets/<id>/` | Get asset details |
| `DELETE` | `/api/v1/brand-assets/<id>/` | Delete asset |

---

### Launch Plans

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/brands/<brand_id>/launch-plan/` | Get launch plan for a brand |
| `POST` | `/api/v1/launch-plans/` | Create a launch plan |

---

### Generation Usage

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/generation-usage/` | Get daily generation usage counts |

---

### Content Pillars (V1.2.1 Strategy)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/content-pillars/` | List all content pillars |
| `POST` | `/api/v1/content-pillars/` | Create a content pillar |
| `GET` | `/api/v1/content-pillars/<id>/` | Get pillar details |
| `PUT/PATCH` | `/api/v1/content-pillars/<id>/` | Update pillar |
| `DELETE` | `/api/v1/content-pillars/<id>/` | Delete pillar |
| `GET` | `/api/v1/brands/<brand_id>/pillar-compliance/` | Check content distribution vs pillar targets |

---

### Competitor Analysis (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/competitor-profiles/` | List competitor profiles |
| `POST` | `/api/v1/competitor-profiles/` | Add a competitor profile |
| `GET` | `/api/v1/competitor-profiles/<id>/` | Get competitor details |
| `PUT/PATCH` | `/api/v1/competitor-profiles/<id>/` | Update competitor |
| `DELETE` | `/api/v1/competitor-profiles/<id>/` | Delete competitor |
| `POST` | `/api/v1/brands/<brand_id>/competitors/crawl/` | Crawl competitor content |
| `GET` | `/api/v1/brands/<brand_id>/competitors/insights/` | Get extracted competitor insights |

---

### Brand Templates (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/brand-templates/` | List brand overlay templates |
| `POST` | `/api/v1/brand-templates/` | Create a template |
| `GET` | `/api/v1/brand-templates/<id>/` | Get template details |
| `PUT/PATCH` | `/api/v1/brand-templates/<id>/` | Update template |
| `DELETE` | `/api/v1/brand-templates/<id>/` | Delete template |

---

### Idea Generation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/content-ideas/` | List all content ideas |
| `POST` | `/api/v1/content-ideas/` | Create an idea manually |
| `GET` | `/api/v1/content-ideas/<id>/` | Get idea details |
| `PUT/PATCH` | `/api/v1/content-ideas/<id>/` | Update idea (save/skip/draft) |
| `DELETE` | `/api/v1/content-ideas/<id>/` | Delete idea |
| `POST` | `/api/v1/ideas/generate/` | AI-generate content ideas for a brand |
| `POST` | `/api/v1/ideas/<idea_id>/regenerate/` | Regenerate a specific idea |
| `POST` | `/api/v1/ideas/<idea_id>/add-to-calendar/` | Convert idea to calendar draft |
| `GET` | `/api/v1/ideas/history/` | Browse all past generated ideas |

---

### Trending Topics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/trending/` | Get cached trending topics |
| `POST` | `/api/v1/brands/<brand_id>/trending/generate/` | Generate brand-relevant trending topics |
| `GET` | `/api/v1/brands/<brand_id>/trending/` | Get brand's trending topics |

---

### Overflow (Guided Flow — V1.3)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/overflow/progress/` | Get overflow progress status |
| `POST` | `/api/v1/overflow/progress/` | Update overflow progress (advance steps) |
| `POST` | `/api/v1/overflow/skip/` | Skip the overflow flow |

---

### Posts (CRUD)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/posts/` | List all posts (filterable by status) |
| `POST` | `/api/v1/posts/` | Create a new post/draft |
| `GET` | `/api/v1/posts/<id>/` | Get post details |
| `PUT/PATCH` | `/api/v1/posts/<id>/` | Update post |
| `DELETE` | `/api/v1/posts/<id>/` | Delete post |

---

### Draft Captions (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/drafts/<post_id>/captions/` | List all captions for a draft |
| `POST` | `/api/v1/drafts/<post_id>/captions/generate/` | AI-generate caption variants |
| `POST` | `/api/v1/drafts/<post_id>/captions/adapt/` | Adapt a caption for different platform |
| `POST` | `/api/v1/captions/<caption_id>/select/` | Select a caption as the active one |
| `GET` | `/api/v1/captions/<caption_id>/preview/<platform>/` | Preview caption on specific platform |
| `POST` | `/api/v1/captions/<caption_id>/ab-tag/` | Tag caption as A/B variant |

**Post Caption ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/post-captions/` | List all post captions |
| `POST` | `/api/v1/post-captions/` | Create a caption |
| `GET` | `/api/v1/post-captions/<id>/` | Get caption details |
| `PUT/PATCH` | `/api/v1/post-captions/<id>/` | Update caption |
| `DELETE` | `/api/v1/post-captions/<id>/` | Delete caption |

---

### Draft Hashtags (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/drafts/<post_id>/hashtags/` | List all hashtags for a draft |
| `POST` | `/api/v1/drafts/<post_id>/hashtags/generate/` | AI-generate hashtags |
| `PUT` | `/api/v1/hashtags/<hashtag_id>/` | Toggle hashtag on/off |

**Hashtag Group ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/hashtag-groups/` | List saved hashtag groups |
| `POST` | `/api/v1/hashtag-groups/` | Create a hashtag group |
| `GET` | `/api/v1/hashtag-groups/<id>/` | Get group details |
| `PUT/PATCH` | `/api/v1/hashtag-groups/<id>/` | Update group |
| `DELETE` | `/api/v1/hashtag-groups/<id>/` | Delete group |

**Banned Hashtag ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/banned-hashtags/` | List banned hashtags |
| `POST` | `/api/v1/banned-hashtags/` | Ban a hashtag |
| `DELETE` | `/api/v1/banned-hashtags/<id>/` | Unban a hashtag |

---

### Draft Checklist (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/drafts/<post_id>/checklist/` | Get auto-calculated checklist status |

---

### Approval Pipeline (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/drafts/<post_id>/submit/` | Submit draft for approval |
| `POST` | `/api/v1/drafts/<post_id>/approve/` | Approve a post |
| `POST` | `/api/v1/drafts/<post_id>/request-changes/` | Request changes on a post |
| `POST` | `/api/v1/drafts/<post_id>/reject/` | Reject a post (with reason) |
| `GET` | `/api/v1/approvals/pending/` | List all pending approvals |
| `GET` | `/api/v1/drafts/<post_id>/approval-log/` | Get full approval audit trail |

---

### Scheduling (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/drafts/<post_id>/schedule/` | Schedule a post per-platform |
| `PUT` | `/api/v1/scheduled-posts/<spp_id>/` | Reschedule a platform posting |
| `GET` | `/api/v1/schedule/calendar/` | Get calendar view of all scheduled posts |
| `GET` | `/api/v1/brands/<brand_id>/best-times/` | Get best posting time suggestions |
| `POST` | `/api/v1/schedule/conflict-check/` | Check for scheduling conflicts |

---

### AI Caption (Standalone Generator)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai-caption/generate/` | Generate caption (text or from media upload) |
| `POST` | `/api/v1/ai-caption/regenerate/<pk>/` | Regenerate a previous caption |
| `GET` | `/api/v1/ai-caption/history/` | Get caption generation history |
| `GET/PUT` | `/api/v1/ai-caption/settings/` | View/update caption API settings |

**Caption Template ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-caption/templates/` | List caption templates |
| `POST` | `/api/v1/ai-caption/templates/` | Create a template |
| `GET` | `/api/v1/ai-caption/templates/<id>/` | Get template |
| `PUT/PATCH` | `/api/v1/ai-caption/templates/<id>/` | Update template |
| `DELETE` | `/api/v1/ai-caption/templates/<id>/` | Delete template |

**Saved Caption ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-caption/saved/` | List saved captions |
| `POST` | `/api/v1/ai-caption/saved/` | Save a caption |
| `DELETE` | `/api/v1/ai-caption/saved/<id>/` | Delete saved caption |

---

### AI Image Generation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai-image/generate/` | Generate an image (DALL-E or Gemini) |
| `GET` | `/api/v1/ai-image/history/` | Get image generation history |
| `GET/PUT` | `/api/v1/ai-image/settings/` | View/update image generation settings |

**User Logo ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-image/logos/` | List uploaded logos |
| `POST` | `/api/v1/ai-image/logos/` | Upload a logo |
| `DELETE` | `/api/v1/ai-image/logos/<id>/` | Delete a logo |

**Saved Image ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-image/saved/` | List saved images |
| `POST` | `/api/v1/ai-image/saved/` | Save an image |
| `DELETE` | `/api/v1/ai-image/saved/<id>/` | Delete saved image |

**Image Prompt Template ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-image/templates/` | List image prompt templates |
| `POST` | `/api/v1/ai-image/templates/` | Create a template |
| `PUT/PATCH` | `/api/v1/ai-image/templates/<id>/` | Update template |
| `DELETE` | `/api/v1/ai-image/templates/<id>/` | Delete template |

---

### Creative Assets (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/posts/<post_id>/assets/` | List assets for a post |
| `GET` | `/api/v1/drafts/<post_id>/assets/` | List assets for a draft |
| `POST` | `/api/v1/drafts/<post_id>/assets/generate/` | AI-generate asset for a draft |
| `POST` | `/api/v1/drafts/<post_id>/assets/upload/` | Upload asset for a draft |
| `POST` | `/api/v1/drafts/<post_id>/assets/carousel-split/` | Split image into carousel slides |
| `POST` | `/api/v1/assets/<asset_id>/alt-text/` | AI-generate alt text |
| `POST` | `/api/v1/assets/<asset_id>/resize/` | Auto-resize for platform dimensions |
| `POST` | `/api/v1/assets/<asset_id>/apply-template/` | Apply brand template overlay |
| `GET` | `/api/v1/assets/<asset_id>/versions/` | Get version history |
| `POST` | `/api/v1/assets/<asset_id>/regenerate/` | Regenerate asset |
| `POST` | `/api/v1/drafts/<post_id>/clone/` | Clone a draft with all its assets |

---

### AI Video Generation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai-video/generate/` | Generate a video (Gemini) |
| `GET` | `/api/v1/ai-video/history/` | Get video generation history |
| `GET/PUT` | `/api/v1/ai-video/settings/` | View/update video settings |

**Video Logo ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-video/logos/` | List uploaded video logos |
| `POST` | `/api/v1/ai-video/logos/` | Upload a logo |
| `DELETE` | `/api/v1/ai-video/logos/<id>/` | Delete a logo |

**Saved Video ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-video/saved/` | List saved videos |
| `POST` | `/api/v1/ai-video/saved/` | Save a video |
| `DELETE` | `/api/v1/ai-video/saved/<id>/` | Delete saved video |

**Video Prompt Template ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai-video/templates/` | List video prompt templates |
| `POST` | `/api/v1/ai-video/templates/` | Create a template |
| `PUT/PATCH` | `/api/v1/ai-video/templates/<id>/` | Update template |
| `DELETE` | `/api/v1/ai-video/templates/<id>/` | Delete template |

---

### AI Voice / Text-to-Speech

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai-voice/generate/` | Generate voice audio |
| `POST` | `/api/v1/ai-voice/preview/` | Preview voice (shorter) |
| `GET` | `/api/v1/ai-voice/history/` | Get voice generation history |
| `GET/PUT` | `/api/v1/ai-voice/settings/` | View/update voice settings |
| `GET` | `/api/v1/ai-voice/generation/<generation_id>/` | Get specific generation details |
| `DELETE` | `/api/v1/ai-voice/generation/<generation_id>/delete/` | Delete a generation |
| `POST` | `/api/v1/ai-voice/generation/<generation_id>/regenerate/` | Regenerate voice |

---

### Social Platforms

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/platforms/` | List connected social accounts |
| `POST` | `/api/v1/platforms/` | Connect a new social account |
| `GET` | `/api/v1/platforms/<id>/` | Get account details |
| `PUT/PATCH` | `/api/v1/platforms/<id>/` | Update account credentials |
| `DELETE` | `/api/v1/platforms/<id>/` | Disconnect account |
| `GET` | `/api/v1/platforms-detail/<id>/` | Get full account detail (with credentials) |

---

### Messenger Bot

**Connection ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/messenger/connections/` | List messenger connections |
| `POST` | `/api/v1/messenger/connections/` | Create a connection |
| `GET` | `/api/v1/messenger/connections/<id>/` | Get connection details |
| `PUT/PATCH` | `/api/v1/messenger/connections/<id>/` | Update connection |
| `DELETE` | `/api/v1/messenger/connections/<id>/` | Delete connection |

**Dashboard & Configuration:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/messenger/dashboard/` | Get messenger dashboard stats |
| `GET/PUT` | `/api/v1/messenger/connections/<id>/config/` | View/update AI configuration |
| `POST` | `/api/v1/messenger/connections/<id>/crawl-website/` | Crawl website for knowledge extraction |

**PDF Knowledge Base:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/messenger/connections/<id>/pdfs/` | List uploaded PDFs |
| `POST` | `/api/v1/messenger/connections/<id>/pdfs/` | Upload a PDF |
| `GET` | `/api/v1/messenger/connections/<id>/pdfs/<pdf_id>/` | Get PDF details |
| `DELETE` | `/api/v1/messenger/connections/<id>/pdfs/<pdf_id>/` | Delete a PDF |

**Conversations:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/messenger/connections/<id>/conversations/` | List all conversations |
| `GET` | `/api/v1/messenger/connections/<id>/conversations/<conv_id>/` | Get conversation with messages |
| `POST` | `/api/v1/messenger/connections/<id>/conversations/<conv_id>/toggle-takeover/` | Toggle human takeover mode |
| `POST` | `/api/v1/messenger/connections/<id>/conversations/<conv_id>/send-message/` | Send manual message |

**Custom Prompts:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/messenger/connections/<id>/prompts/` | List custom prompts |
| `POST` | `/api/v1/messenger/connections/<id>/prompts/` | Create a prompt |
| `GET` | `/api/v1/messenger/connections/<id>/prompts/<pk>/` | Get prompt details |
| `PUT` | `/api/v1/messenger/connections/<id>/prompts/<pk>/` | Update prompt |
| `DELETE` | `/api/v1/messenger/connections/<id>/prompts/<pk>/` | Delete prompt |
| `POST` | `/api/v1/messenger/connections/<id>/prompts/<pk>/activate/` | Activate a prompt |

**E-Commerce Integration:**

| Method | Endpoint | Description |
|---|---|---|
| `GET/PUT` | `/api/v1/messenger/connections/<id>/ecommerce/` | View/update e-commerce settings |
| `POST` | `/api/v1/messenger/connections/<id>/ecommerce/test/` | Test e-commerce connection |
| `POST` | `/api/v1/messenger/connections/<id>/ecommerce/sync/` | Sync products from store |
| `POST` | `/api/v1/messenger/connections/<id>/ecommerce/embeddings/` | Regenerate product embeddings |
| `GET` | `/api/v1/messenger/connections/<id>/ecommerce/products/` | List synced products |

**Notification ViewSet:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/messenger/notifications/` | List messenger notifications |
| `GET` | `/api/v1/messenger/notifications/<id>/` | Get notification details |
| `PUT/PATCH` | `/api/v1/messenger/notifications/<id>/` | Update notification (mark read/resolved) |

---

### Analytics (V1.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/summary/` | Get analytics summary |
| `GET` | `/api/v1/analytics/platforms/` | Get per-platform analytics |
| `GET` | `/api/v1/analytics/trends/` | Get analytics trends over time |
| `GET` | `/api/v1/analytics/top-posts/` | Get top performing posts |

---

### Post Analytics (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/posts/<post_id>/stats/` | Get quick stats for a post |
| `GET` | `/api/v1/posts/<post_id>/comments/` | Get comments on a post |
| `POST` | `/api/v1/comments/<comment_id>/reply/` | Reply to a comment |
| `POST` | `/api/v1/comments/<comment_id>/ai-reply/` | AI-generate and send reply |
| `GET` | `/api/v1/brands/<brand_id>/weekly-report/` | Get/generate weekly report |
| `GET` | `/api/v1/brands/<brand_id>/analytics/dashboard/` | Get analytics dashboard |
| `GET` | `/api/v1/brands/<brand_id>/ab-results/` | Get A/B test results |

---

### Learning & Repurposing (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/brands/<brand_id>/learning-signals/` | Get performance-based learning signals |
| `GET` | `/api/v1/brands/<brand_id>/winners/` | Get winner/top performing posts |
| `POST` | `/api/v1/posts/<post_id>/repurpose/` | Repurpose a post into a new format |

---

### System Notifications (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/notifications/` | List all notifications |
| `GET` | `/api/v1/notifications/unread-count/` | Get unread notification count |
| `POST` | `/api/v1/notifications/mark-all-read/` | Mark all notifications as read |
| `POST` | `/api/v1/notifications/<notification_id>/read/` | Mark single notification as read |
| `DELETE` | `/api/v1/notifications/<notification_id>/` | Delete a notification |

---

### RBAC — Role-Based Access Control (V1.2.1)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/workspaces/<workspace_id>/roles/` | List all role assignments in workspace |
| `POST` | `/api/v1/workspaces/<workspace_id>/roles/assign/` | Assign a role to a user |
| `POST` | `/api/v1/workspaces/<workspace_id>/roles/remove/` | Remove a role from a user |
| `GET` | `/api/v1/my-roles/` | Get current user's roles across all workspaces |

---

### Support Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/support-chat/` | Send message to AI support chatbot |

---

### Admin Panel API (Staff Only)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/dashboard/` | Get admin dashboard statistics |
| `GET` | `/api/v1/admin/users/` | List all users (with search/filter) |
| `GET` | `/api/v1/admin/users/<user_id>/` | Get user detail |
| `POST` | `/api/v1/admin/users/<user_id>/approve/` | Approve a user registration |
| `POST` | `/api/v1/admin/users/<user_id>/reject/` | Reject a user registration |
| `PUT` | `/api/v1/admin/users/<user_id>/plan/` | Update user subscription plan |
| `GET/PUT` | `/api/v1/admin/users/<user_id>/api-settings/` | View/update user's API key settings |
| `GET` | `/api/v1/admin/users/<user_id>/posts/` | Get user's posts |
| `GET` | `/api/v1/admin/users/<user_id>/accounts/` | Get user's connected social accounts |
| `GET` | `/api/v1/admin/users/<user_id>/captions/` | Get user's caption generations |
| `GET` | `/api/v1/admin/users/<user_id>/images/` | Get user's image generations |
| `GET` | `/api/v1/admin/users/<user_id>/videos/` | Get user's video generations |
| `GET` | `/api/v1/admin/users/<user_id>/messenger/` | Get user's messenger data |
| `GET` | `/api/v1/admin/conversations/<conv_id>/messages/` | Get conversation messages |
| `GET` | `/api/v1/admin/analytics/` | Get system-wide analytics |
| `POST` | `/api/v1/admin/bulk-approve/` | Bulk approve multiple users |

---

### Content Approvals ViewSet

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/content-approvals/` | List all content approvals |
| `POST` | `/api/v1/content-approvals/` | Create an approval record |
| `GET` | `/api/v1/content-approvals/<id>/` | Get approval details |
| `PUT/PATCH` | `/api/v1/content-approvals/<id>/` | Update approval |

---

### Weekly Reports ViewSet

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/weekly-reports/` | List all weekly reports |
| `GET` | `/api/v1/weekly-reports/<id>/` | Get report details |

---

## Database Models

### accounts app
- **SiteConfiguration** — Key-value store for site-wide settings
- **UserProfile** — Extended user profile (plan, limits, API keys, usage tracking)
- **APIUsageLog** — Detailed API usage logs per user
- **SupportDocument** — PDF knowledge base for AI support chatbot
- **SystemNotification** — In-app notification system (20 event types)
- **UserRole** — RBAC workspace-level role assignments (6 roles)

### posts app
- **Post** — Core post model with full lifecycle management
- **PostCaption** — Platform-optimized caption variants with A/B tagging
- **PostHashtag** — Per-platform hashtags with tier system
- **HashtagGroup** — Reusable saved hashtag sets
- **BannedHashtag** — Brand-level banned hashtags
- **ScheduledPostPlatform** — Per-platform scheduling with status tracking

### brands app
- **Workspace** — Multi-workspace support with daily generation limits
- **Brand** — Brand profile with DNA, voice/tone, goals, audiences
- **BrandAsset** — Uploaded brand assets (logos, banners, fonts, etc.)
- **LaunchPlan** — Content publication strategy per brand
- **ContentIdea** — AI-generated content ideas with source tracking
- **ContentApproval** — Approval workflow records
- **WeeklyReport** — Structured weekly performance reports
- **GenerationUsage** — Daily generation count tracking
- **ContentPillar** — Strategy pillars with target percentages
- **CompetitorProfile** — Competitor social handles/URLs
- **CompetitorInsight** — Extracted competitor content insights
- **BrandTemplate** — Brand overlay templates for creatives
- **TrendingCache** — Cached trending topics with expiry
- **ApprovalLog** — Full approval audit trail
- **BestTimeSuggestion** — Optimal posting time suggestions
- **BrandDNAChunk** — Vectorized website content for Brand DNA RAG
- **BrandDNAHistory** — Historical DNA generations for rollback
- **OverflowProgress** — Guided flow progress tracking

### analytics app
- **Analytics** — Legacy engagement metrics (V1.1)
- **PostAnalytics** — Performance snapshots (24h/48h/daily/weekly)
- **PostComment** — Comment tracking with sentiment analysis
- **LearningSignal** — Performance-based insights for content optimization
- **RepurposedContent** — Original-to-repurposed post relationships

### ai_caption app
- **UserAPISettings** — User's OpenAI API key & model preferences
- **CaptionGeneration** — Caption generation history with all parameters
- **CaptionTemplate** — Pre-defined caption templates
- **SavedCaption** — Favorite/saved captions

### ai_image app
- **UserImageSettings** — Image generation API keys & defaults
- **UserLogo** — Uploaded logos for overlay
- **ImageGeneration** — Image generation history (linked to posts as creative assets)
- **SavedImage** — Favorite/saved images
- **PromptTemplate** — Pre-defined image prompt templates
- **AssetPlatformVariant** — Auto-resized platform-specific variants
- **CreativeVersionHistory** — Version tracking for creative iterations

### ai_video app
- **UserVideoSettings** — Video generation settings & Gemini API key
- **VideoLogo** — Uploaded logos for video watermarks
- **VideoGeneration** — Video generation history
- **SavedVideo** — Favorite/saved videos
- **VideoPromptTemplate** — Pre-defined video prompt templates

### ai_voice app
- **UserVoiceSettings** — Voice generation settings & OpenAI API key
- **VoiceGeneration** — Voice generation history with audio files

### messenger_bot app
- **MessengerConnection** — Facebook Page connections
- **AIConfiguration** — OpenAI & RAG settings per connection
- **PDFKnowledgeBase** — Uploaded PDFs for RAG
- **PDFChunk** — Vectorized text chunks with embeddings
- **CustomPrompt** — AI personality/behavior prompts
- **Conversation** — User conversations with takeover support
- **Message** — Individual messages with AI metadata
- **Notification** — Business-owner smart notifications
- **ECommerceSettings** — WooCommerce/Shopify integration config
- **Product** — Synced e-commerce products with embeddings

### platforms app
- **SocialAccount** — Connected social media accounts (8 platforms)

### onboarding app
- **OnboardingProgress** — 7-step onboarding wizard progress

---

## Authentication & Authorization

### JWT Authentication
- **Access Token**: 60 minutes lifetime
- **Refresh Token**: 7 days lifetime (rotated on refresh, old tokens blacklisted)
- **Header Format**: `Authorization: Bearer <access_token>`
- **Token Refresh**: `POST /api/v1/auth/refresh/` with `{ "refresh": "<refresh_token>" }`

### User Approval Flow
1. User registers via `/api/v1/auth/register/`
2. Account created with `is_approved = False`
3. Admin approves via Admin Panel (`/api/v1/admin/users/<id>/approve/`)
4. User can now access the platform

### Subscription Plans

| Plan | Posts/mo | Captions/mo | Videos/mo | Images/mo | Messenger/mo | Accounts |
|---|---|---|---|---|---|---|
| Free | 10 | 20 | 5 | 10 | 100 | 1 |
| Starter | 50 | 100 | 20 | 50 | 500 | 3 |
| Pro | 200 | 500 | 50 | 200 | 2,000 | 5 |
| Business | 500 | 1,000 | 100 | 500 | 5,000 | 10 |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited | 50 |

### RBAC Roles
| Role | Capabilities |
|---|---|
| Owner | Full access (auto-granted to workspace creator) |
| Admin | Full management permissions |
| Creator | Create and edit content |
| Approver | Review and approve/reject content |
| Publisher | Schedule and publish approved content |
| Viewer | Read-only access |

### Impersonation
- Admin middleware (`ImpersonationMiddleware`) allows staff users to act as any user
- Custom JWT authentication class (`ImpersonatingJWTAuthentication`)

---

## Third-Party Integrations

### AI Services
| Service | Used For | Models |
|---|---|---|
| OpenAI | Captions, Messenger Bot, Voice TTS, Embeddings | GPT-4o, GPT-4o-mini, GPT-4 Turbo, DALL-E 3/2, Whisper, TTS-1/TTS-1-HD |
| Google Gemini | Image Generation, Video Generation | Gemini generative models |

### Social Media Platforms
| Platform | API | Features |
|---|---|---|
| Facebook | Graph API | Page posting, Messenger integration |
| Twitter/X | Twitter API v2 (Tweepy) | Tweet posting |
| Instagram | Instagram Graph API | Feed posting |
| LinkedIn | LinkedIn API | Share posting |
| TikTok | TikTok API | Video posting |
| YouTube | YouTube Data API | Video uploads |
| Pinterest | Pinterest API | Pin creation |
| Telegram | Telegram Bot API | Channel posting |

### E-Commerce
| Platform | Integration |
|---|---|
| WooCommerce | REST API (consumer key/secret) |
| Shopify | API integration |
| Custom API | Configurable endpoint |

### Other
| Service | Purpose |
|---|---|
| Google Trends (pytrends) | Trending topic discovery |
| BeautifulSoup4 | Website crawling for Brand DNA & competitor analysis |

---

## Deployment

### Production Setup (cPanel/Passenger)
- WhiteNoise middleware serves static files
- `passenger_wsgi.py` configured for cPanel deployment
- React SPA built to `frontend/dist/` and served via Django catch-all route
- MySQL database (production)
- CORS configured for production domain

### Production Domain
- `https://abedintechllc.com`

### Key Configuration Files
- `socialsync/settings.py` — Django settings
- `.env` / `.env.production` — Environment variables
- `passenger_wsgi.py` — WSGI entry for cPanel
- `frontend/vite.config.ts` — Vite build config
- `frontend/tailwind.config.js` — TailwindCSS config

---

## Version History

| Version | Highlights |
|---|---|
| **V1.0** | Core platform: Auth, Posts, Platforms, AI Caption, AI Image, AI Video, AI Voice, Analytics |
| **V1.1** | Messenger Bot with RAG, E-Commerce integration, Onboarding wizard, Brand management |
| **V1.2.1** | Content Strategy Hub, Draft Captions/Hashtags, Approval Pipeline, Scheduling, Creative Assets, Post Analytics, Comments, Learning Signals, Repurposing, Weekly Reports, Notifications, RBAC, Admin Panel |
| **V1.3** | Overflow guided flow, Trending Topics, Brand DNA History, Idea History, Enhanced Overflow page responsiveness |

---

*Generated for SocialSync (SaleAnto) v1.2.3 — All-in-One AI-Powered Social Media Management Platform*
