#!/usr/bin/env python3
"""
SaleAnto System Documentation Report Generator — V2 (Full Detail)
Generates a comprehensive 50+ page .docx report.
"""

from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'SaleAnto_System_Documentation.docx')

doc = Document()

# ── Styles ──
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(10)

for level in range(1, 4):
    doc.styles[f'Heading {level}'].font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)


def T(headers, rows):
    """Add formatted table."""
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.text = h
        for p in c.paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9)
    for rd in rows:
        row = t.add_row()
        for i, v in enumerate(rd):
            row.cells[i].text = str(v)
            for p in row.cells[i].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)
    doc.add_paragraph()
    return t


def EP(method, path, auth, body, success, notes=''):
    """Endpoint detail block."""
    data = [('Endpoint', path), ('Method', method), ('Auth', auth),
            ('Request Body', body), ('Success Response', success), ('Notes', notes)]
    t = doc.add_table(rows=len(data), cols=2)
    t.style = 'Light Grid Accent 1'
    for i, (k, v) in enumerate(data):
        t.rows[i].cells[0].text = k
        t.rows[i].cells[1].text = str(v)
        for p in t.rows[i].cells[0].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(8)
        for p in t.rows[i].cells[1].paragraphs:
            for r in p.runs:
                r.font.size = Pt(8)
    doc.add_paragraph()


def P(text):
    doc.add_paragraph(text)


def H(text, level=2):
    doc.add_heading(text, level=level)


def PB():
    doc.add_page_break()


# ══════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════════════════════════
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('SALEANTO')
r.bold = True; r.font.size = Pt(36); r.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('System Documentation Report')
r.font.size = Pt(20); r.font.color.rgb = RGBColor(0x44, 0x44, 0x66)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Apps, API Endpoints & Architecture Reference')
r.font.size = Pt(14); r.font.color.rgb = RGBColor(0x66, 0x66, 0x88)

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('CONFIDENTIAL')
r.bold = True; r.font.size = Pt(12); r.font.color.rgb = RGBColor(0xCC, 0, 0)

doc.add_paragraph()
T(['Field', 'Value'], [
    ('Project', 'SaleAnto \u2014 AI Social Media Platform'),
    ('Live URL', 'abedintechllc.com'),
    ('Version', '1.2.3'),
    ('Date', 'March 10, 2026'),
    ('Author', 'Arifuzzaman Swapnil / SaleAnto Dev Team'),
    ('Status', 'Beta'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# TOC
# ══════════════════════════════════════════════════════════════════════════
H('Table of Contents', 1)
toc = [
    '1. Platform Overview', '   1.1 User Paths', '   1.2 Current Status',
    '2. System Architecture', '   2.1 Tech Stack', '   2.2 Architecture Diagram',
    '   2.3 Database Overview', '   2.4 Authentication & Middleware',
    '3. Module Documentation (12 Modules)',
    '   M1 Brand Manager', '   M2 AI Image Engine', '   M3 AI Copy Engine',
    '   M4 Calendar Planner', '   M5 Social Connector', '   M6 Publisher Engine',
    '   M7 Analytics Engine', '   M8 Learning Engine', '   M9 Overlay Engine',
    '   M10 Export Engine', '   M11 Billing Engine', '   M12 Notification Engine',
    '   M13 Messenger Bot (Bonus)',
    '4. Workflow Stages', '5. User Roles & Permissions',
    '6. Frontend Architecture', '   6.1 Pages', '   6.2 Components', '   6.3 Services',
    '   6.4 State Management',
    '7. Deployment & Environment', '8. Complete API Endpoint Reference', '9. Changelog',
]
for item in toc:
    doc.add_paragraph(item, style='List Bullet')
PB()

# ══════════════════════════════════════════════════════════════════════════
# 1. PLATFORM OVERVIEW
# ══════════════════════════════════════════════════════════════════════════
H('1. Platform Overview', 1)
P('SaleAnto is an AI-powered social media management platform that helps brands and agencies create, schedule, publish, and analyze content across all major social media platforms. The platform leverages Claude AI (Anthropic), OpenAI, and Google Gemini to generate captions, images, videos, voice content, and strategic recommendations \u2014 all from a single dashboard.')
P('SaleAnto serves two primary audiences: individual brands managing their own social media presence (Self-Serve path), and marketing agencies managing content for multiple client brands (Agency path). The platform provides end-to-end content workflow management from strategy planning through publishing and performance analytics, with AI assistance at every stage.')
P('The core value proposition is "AI-First Social Media Management" \u2014 where every content decision is informed by brand DNA analysis, competitor intelligence, trending topics, and historical performance data.')

H('1.1 User Paths', 2)
P('Self-Serve Path: Individual brands sign up, complete onboarding (brand name, industry, website URL), and the system auto-generates their Brand DNA by crawling their website. They can then create content, schedule posts, and track analytics.')
P('Agency Path: Agencies create a workspace and add multiple brands. Each brand gets its own Brand DNA, content calendar, and analytics. Team members are assigned roles (Creator, Approver, Publisher, Viewer) with granular permissions.')

T(['Plan', 'Brands', 'Key Features', 'Price'], [
    ('Free', '1', '30 posts/mo, 50 captions, 10 images, 5 videos', '$0'),
    ('Starter', '2', '100 posts/mo, 200 captions, 50 images, 20 videos', '$9/mo'),
    ('Pro', '5', '500 posts/mo, 1000 captions, 200 images, 100 videos, strategy hub', '$29/mo'),
    ('Business', '15', '2000 posts/mo, 5000 captions, 1000 images, 500 videos, messenger bot', '$79/mo'),
    ('Enterprise', '100', 'Unlimited posts/captions, 5000 images, 2000 videos, white-label', '$199/mo'),
])

H('1.2 Current Status', 2)
T(['Item', 'Status', 'Notes'], [
    ('Brand Manager (M1)', 'Live', 'Brand DNA auto-generation, workspace management, multi-brand'),
    ('AI Image Engine (M2)', 'Live', 'DALL-E 3, GPT-Image-1, Gemini Imagen, logo/product overlay'),
    ('AI Copy Engine (M3)', 'Live', 'Claude AI-powered captions, hashtags, content ideas'),
    ('Calendar Planner (M4)', 'Live', 'Calendar, best-time suggestions, bulk scheduling'),
    ('Social Connector (M5)', 'Live', 'Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest, Telegram'),
    ('Publisher Engine (M6)', 'Live', 'Multi-platform publishing with per-platform customization'),
    ('Analytics Engine (M7)', 'Live', 'Post metrics, weekly reports, engagement tracking'),
    ('Learning Engine (M8)', 'Live', 'Best hooks/times/topics, audience signals'),
    ('Overlay Engine (M9)', 'Live', 'Text copy overlay on images with brand fonts'),
    ('Export Engine (M10)', 'In Progress', 'Asset resizing, bulk export'),
    ('Billing Engine (M11)', 'Live', 'Plan-based usage limits'),
    ('Notification Engine (M12)', 'Live', 'In-app notifications'),
    ('Messenger Bot', 'Live', 'AI chatbot with RAG, e-commerce sync'),
    ('Prompt Engineering', 'Live', '9-layer brand-aware prompt engineering'),
    ('Approval Workflows', 'Live', 'Submit/Review/Approve/Reject pipeline'),
    ('RBAC', 'Live', 'Owner, Admin, Creator, Approver, Publisher, Viewer'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# 2. SYSTEM ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════════
H('2. System Architecture', 1)

H('2.1 Tech Stack', 2)
T(['Layer', 'Technology', 'Version', 'Purpose'], [
    ('Backend', 'Django', '4.2', 'Python web framework, ORM, admin'),
    ('API', 'Django REST Framework', '3.14', 'RESTful API with serializers'),
    ('Auth', 'SimpleJWT', '5.5.1', 'JWT tokens with refresh rotation'),
    ('API Docs', 'drf-spectacular', '0.29.0', 'OpenAPI/Swagger schema'),
    ('Database', 'MySQL', '8.0+', 'Primary relational data store'),
    ('DB Driver', 'mysqlclient', '2.2.8', 'MySQL connector'),
    ('Frontend', 'React', '19.0', 'SPA with TypeScript'),
    ('Build', 'Vite', '6.4.1', 'Fast dev server and bundler'),
    ('State', 'Zustand', '5.0', 'Lightweight state management'),
    ('Routing', 'React Router', '7.13', 'Client-side routing'),
    ('CSS', 'Tailwind CSS', '3.4', 'Utility-first CSS'),
    ('Animation', 'Framer Motion', '12.34', 'React animations'),
    ('HTTP', 'Axios', '1.13.5', 'HTTP client with interceptors'),
    ('Forms', 'React Hook Form + Zod', '7.71', 'Form validation'),
    ('AI Text', 'Anthropic Claude', 'Sonnet 4', 'Captions, strategy, analysis'),
    ('AI Image', 'OpenAI DALL-E / GPT-Image', '3/1', 'Image generation'),
    ('AI Image Alt', 'Google Gemini', '2.0 Flash', 'Image + video generation'),
    ('AI Voice', 'OpenAI TTS', 'tts-1/tts-1-hd', 'Text-to-speech'),
    ('AI Embeddings', 'Sentence Transformers', '5.0', 'RAG embeddings'),
    ('Vector Store', 'ChromaDB / FAISS', '1.0/1.11', 'Vector search for RAG'),
    ('Static', 'WhiteNoise', '6.7.0', 'Static file serving'),
    ('CORS', 'django-cors-headers', '4.9.0', 'Cross-origin handling'),
    ('Env', 'python-decouple', '3.8', 'Environment variables'),
    ('Scheduler', 'APScheduler', '3.11', 'Background tasks'),
    ('Scraping', 'BeautifulSoup4', '4.14', 'Brand DNA website crawling'),
    ('PDF', 'PyMuPDF + pdfplumber', '1.27/0.11', 'PDF knowledge base'),
    ('Image', 'Pillow', '10.3', 'Image manipulation, overlays'),
    ('Trends', 'pytrends', '4.9', 'Google Trends'),
])

H('2.2 Architecture Diagram', 2)
P('Decoupled SPA architecture: React frontend communicates with Django REST API via HTTP/JSON.')
P('[React Frontend (Vite+TS)] --JWT--> [Django REST API (DRF+SimpleJWT)] --ORM--> [MySQL]')
P('                                          |')
P('                    [Claude API]  [OpenAI API]  [Gemini API]')
P('                    (Text/Chat)   (Image/TTS)   (Image/Video)')

H('2.3 Database Overview', 2)
T(['Table Name', 'Module', 'Purpose', 'Key Relations'], [
    ('auth_user', 'Core', 'Django user model', 'has_one: user_profiles'),
    ('user_profiles', 'Accounts', 'Profile, subscription, usage', 'belongs_to: auth_user'),
    ('site_configuration', 'Accounts', 'Key-value settings', '\u2014'),
    ('workspaces', 'Brands', 'Team workspace', 'has_many: brands'),
    ('brands', 'Brands', 'Brand profile + DNA', 'belongs_to: workspace'),
    ('brand_assets', 'Brands', 'Logos, colors, fonts', 'belongs_to: brand'),
    ('launch_plans', 'Brands', 'Posting frequency', 'belongs_to: brand'),
    ('brand_dna_history', 'Brands', 'DNA version history', 'belongs_to: brand'),
    ('brand_dna_chunks', 'Brands', 'RAG chunks for brand', 'belongs_to: brand'),
    ('content_pillars', 'Brands', 'Topic categories', 'belongs_to: brand'),
    ('competitor_profiles', 'Brands', 'Competitor tracking', 'belongs_to: brand'),
    ('competitor_insights', 'Brands', 'Crawled competitor data', 'belongs_to: competitor'),
    ('trending_cache', 'Brands', 'Trending topics', 'belongs_to: brand'),
    ('trend_feedback', 'Brands', 'Trend accept/reject', 'belongs_to: brand'),
    ('content_ideas', 'Brands', 'AI content ideas', 'belongs_to: brand'),
    ('content_approvals', 'Brands', 'Approval records', 'belongs_to: post'),
    ('approval_logs', 'Brands', 'Approval audit trail', 'belongs_to: post'),
    ('weekly_reports', 'Brands', 'Weekly summaries', 'belongs_to: brand'),
    ('generation_usage', 'Brands', 'Daily counters', 'belongs_to: workspace'),
    ('prompt_history', 'Brands', 'Prompt tracking', 'belongs_to: brand'),
    ('overflow_progress', 'Brands', 'Onboarding wizard', 'belongs_to: user'),
    ('best_time_suggestions', 'Brands', 'Posting time recs', 'belongs_to: brand'),
    ('brand_templates', 'Brands', 'Creative templates', 'belongs_to: brand'),
    ('posts', 'Posts', 'Social media posts', 'belongs_to: user'),
    ('post_captions', 'Posts', 'Platform-specific captions', 'belongs_to: post'),
    ('post_hashtags', 'Posts', 'Post hashtags', 'belongs_to: post'),
    ('hashtag_groups', 'Posts', 'Saved hashtag groups', 'belongs_to: brand'),
    ('banned_hashtags', 'Posts', 'Banned hashtags', 'belongs_to: brand'),
    ('scheduled_post_platforms', 'Posts', 'Per-platform schedule', 'belongs_to: post'),
    ('social_accounts', 'Platforms', 'Connected accounts', 'belongs_to: user'),
    ('caption_generations', 'AI Caption', 'Caption generation records', 'belongs_to: user'),
    ('user_api_settings', 'AI Caption', 'Per-user API keys', 'belongs_to: user'),
    ('image_generations', 'AI Image', 'Image generation records', 'belongs_to: user'),
    ('user_image_settings', 'AI Image', 'Image gen preferences', 'belongs_to: user'),
    ('user_logos', 'AI Image', 'Uploaded logos', 'belongs_to: user'),
    ('prompt_templates', 'AI Image', 'Image prompt templates', 'belongs_to: user'),
    ('video_generations', 'AI Video', 'Video generation records', 'belongs_to: user'),
    ('user_video_settings', 'AI Video', 'Video gen preferences', 'belongs_to: user'),
    ('video_logos', 'AI Video', 'Video watermarks', 'belongs_to: user'),
    ('video_prompt_templates', 'AI Video', 'Video prompts', 'belongs_to: user'),
    ('voice_generations', 'AI Voice', 'TTS records', 'belongs_to: user'),
    ('user_voice_settings', 'AI Voice', 'Voice preferences', 'belongs_to: user'),
    ('messenger_connections', 'Messenger', 'FB page connections', 'belongs_to: user'),
    ('ai_configurations', 'Messenger', 'Bot AI settings', 'belongs_to: connection'),
    ('conversations', 'Messenger', 'User conversations', 'belongs_to: connection'),
    ('messages', 'Messenger', 'Individual messages', 'belongs_to: conversation'),
    ('custom_prompts', 'Messenger', 'Bot system prompts', 'belongs_to: connection'),
    ('pdf_knowledge_bases', 'Messenger', 'RAG documents', 'belongs_to: connection'),
    ('pdf_chunks', 'Messenger', 'RAG text chunks', 'belongs_to: pdf'),
    ('notifications_msg', 'Messenger', 'Bot notifications', 'belongs_to: connection'),
    ('ecommerce_settings', 'Messenger', 'WooCommerce config', 'belongs_to: connection'),
    ('products', 'Messenger', 'Synced products', 'belongs_to: ecommerce'),
    ('system_notifications', 'Notifications', 'In-app alerts', 'belongs_to: user'),
    ('analytics', 'Analytics', 'V1 metrics', 'belongs_to: post'),
    ('post_analytics', 'Analytics', 'V1.2 detailed metrics', 'belongs_to: post'),
    ('post_comments', 'Analytics', 'Comment tracking', 'belongs_to: post'),
    ('learning_signals', 'Analytics', 'AI insights', 'belongs_to: brand'),
    ('repurposed_content', 'Analytics', 'Repurpose tracking', 'belongs_to: post'),
    ('onboarding_progress', 'Onboarding', 'Setup progress', 'belongs_to: user'),
])

H('2.4 Authentication & Middleware', 2)
P('Authentication: JWT (SimpleJWT) with access tokens (60 min) and refresh tokens (7 days). Token rotation enabled with blacklist.')
P('Custom Auth: ImpersonatingJWTAuthentication \u2014 supports admin impersonation via X-Impersonate-User header.')
P('Middleware Stack: SecurityMiddleware \u2192 WhiteNoiseMiddleware \u2192 CorsMiddleware \u2192 SessionMiddleware \u2192 CommonMiddleware \u2192 CsrfMiddleware \u2192 AuthenticationMiddleware \u2192 ImpersonationMiddleware \u2192 MessageMiddleware \u2192 XFrameOptionsMiddleware')
P('CORS: localhost:3000 (dev), abedintechllc.com (prod), ngrok tunnels (test)')
PB()

# ══════════════════════════════════════════════════════════════════════════
# 3. MODULE DOCUMENTATION
# ══════════════════════════════════════════════════════════════════════════
H('3. Module Documentation', 1)

# ── M1 Brand Manager ──
H('M1 \u2014 Brand Manager', 2)
H('Purpose', 3)
P('Foundation module managing workspaces, brands, Brand DNA (15-field AI profile), content pillars, competitor profiles, trending topics, content ideas, launch plans, and team membership with RBAC.')

H('How It Works', 3)
P('1. User registers \u2192 workspace auto-created')
P('2. Add brand (name, industry, website, region)')
P('3. System crawls website (up to 5 pages) via BeautifulSoup')
P('4. Claude AI extracts 15-field Brand DNA profile')
P('5. DNA saved + versioned in BrandDNAHistory')
P('6. User generates pillars, tracks competitors, creates launch plans')
P('7. Brand DNA consumed by all AI modules')

H('Brand DNA Fields (15)', 3)
T(['#', 'Field', 'What It Contains'], [
    ('1', 'brand_name', 'Official brand name'),
    ('2', 'tagline', 'Primary tagline/slogan'),
    ('3', 'industry', 'Industry vertical and sub-category'),
    ('4', 'description', '2-3 sentence brand description'),
    ('5', 'products_services', 'Specific offerings'),
    ('6', 'target_audience', 'Demographics + psychographics'),
    ('7', 'unique_selling_points', '3-5 differentiators'),
    ('8', 'brand_voice', 'Detailed voice description'),
    ('9', 'brand_values', 'Core values'),
    ('10', 'color_theme', 'Dominant colors'),
    ('11', 'content_themes', 'Recurring topics'),
    ('12', 'cta_style', 'How brand asks for action'),
    ('13', 'social_platforms', 'Social media links'),
    ('14', 'keywords', '10-15 content creation keywords'),
    ('15', 'competitor_positioning', 'Positioning vs alternatives'),
])

H('API Endpoints (Detailed)', 3)

EP('POST', '/api/v1/brands/{id}/generate-dna/', 'JWT',
   '{ "website_url": "https://...", "override_prompt": "", "think_harder": false }',
   '{ "success": true, "brand_dna": { 15 fields... }, "brand_dna_generated_at": "ISO" }',
   'Crawls up to 5 pages. Claude AI extracts DNA. Saves to brand + BrandDNAHistory.')

EP('POST', '/api/v1/ideas/generate/', 'JWT',
   '{ "brand_id": 1, "pillar_id": 5, "platform": "all", "goal": "leads", "content_format": "carousel", "count": 10, "trending_topics": ["AI"], "override_prompt": "", "think_harder": false }',
   '{ "ideas": [{ "id":1, "title":"...", "hook":"...", "angle":"...", "platform":"instagram", "engagement_tier":"high", "source":"ai_generated" }], "batch_id": "...", "used_prompt": "..." }',
   'Generates content ideas using Claude AI with Brand DNA context.')

EP('POST', '/api/v1/brands/{id}/pillars/generate/', 'JWT',
   '{ "brand_id": 1, "override_prompt": "", "think_harder": false }',
   '{ "pillars": [{ "name":"...", "description":"...", "target_percentage": 25, "color_code":"#6366F1" }] }',
   'Claude AI generates content pillars based on Brand DNA.')

EP('POST', '/api/v1/competitors/suggest/', 'JWT',
   '{ "brand_id": 1 }',
   '{ "competitors": [{ "platform":"twitter", "handle_or_url":"@competitor" }] }',
   'Claude AI suggests competitors based on brand industry.')

H('Data Models', 3)
P('Workspace')
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('id', 'AutoField (PK)', 'No', 'Primary key'),
    ('owner', 'FK \u2192 User', 'No', 'Workspace owner'),
    ('name', 'CharField(200)', 'No', 'Workspace name'),
    ('timezone', 'CharField(50)', 'No', 'Default: UTC'),
    ('team_size', 'IntegerField', 'Yes', 'Team size'),
    ('default_language', 'CharField(10)', 'No', 'Default: en'),
    ('max_generations_per_day', 'IntegerField', 'No', 'Default: 200'),
    ('generations_today', 'IntegerField', 'No', 'Daily counter'),
    ('generation_date', 'DateField', 'No', 'Counter reset date'),
    ('is_active', 'BooleanField', 'No', 'Default: True'),
    ('created_at', 'DateTimeField', 'No', 'Auto-set'),
])

P('Brand')
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('id', 'AutoField (PK)', 'No', 'Primary key'),
    ('workspace', 'FK \u2192 Workspace', 'No', 'Parent workspace'),
    ('user', 'FK \u2192 User', 'No', 'Brand owner'),
    ('brand_name', 'CharField(200)', 'No', 'Brand name'),
    ('industry', 'CharField(200)', 'No', 'Industry vertical'),
    ('target_region', 'CharField(200)', 'No', 'Geographic target'),
    ('website_url', 'URLField', 'Yes', 'Website for DNA crawl'),
    ('social_links', 'JSONField', 'No', 'Social media links'),
    ('logo', 'ImageField', 'Yes', 'Brand logo'),
    ('brand_guide_pdf', 'FileField', 'Yes', 'Brand guide document'),
    ('voice_tone', 'CharField(100)', 'No', 'Default: professional'),
    ('do_dont_rules', 'JSONField', 'No', 'Content rules'),
    ('goals', 'JSONField', 'No', 'Brand goals'),
    ('audiences', 'JSONField', 'No', 'Target audiences'),
    ('brand_dna', 'JSONField', 'No', '15-field DNA profile'),
    ('brand_dna_generated_at', 'DateTimeField', 'Yes', 'Last DNA gen time'),
    ('brand_dna_source', 'CharField(20)', 'Yes', 'website/manual/structured'),
    ('is_primary', 'BooleanField', 'No', 'Default: True'),
    ('created_at', 'DateTimeField', 'No', 'Auto-set'),
])

P('ContentPillar')
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('brand', 'FK \u2192 Brand', 'No', 'Parent brand'),
    ('name', 'CharField(100)', 'No', 'Pillar name'),
    ('description', 'TextField', 'Yes', 'Pillar description'),
    ('target_percentage', 'IntegerField', 'No', 'Content allocation %'),
    ('color_code', 'CharField(7)', 'No', 'Hex color code'),
    ('is_active', 'BooleanField', 'No', 'Default: True'),
])

P('ContentIdea')
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('brand', 'FK \u2192 Brand', 'No', 'Parent brand'),
    ('user', 'FK \u2192 User', 'No', 'Creator'),
    ('title', 'CharField(300)', 'No', 'Idea title'),
    ('hook', 'TextField', 'Yes', 'Opening hook'),
    ('angle', 'CharField(300)', 'Yes', 'Unique angle'),
    ('platform', 'CharField(20)', 'Yes', 'Target platform'),
    ('goal', 'CharField(20)', 'Yes', 'leads/growth/authority'),
    ('content_format', 'CharField(20)', 'No', 'text/carousel/reel/thread/etc'),
    ('pillar', 'FK \u2192 ContentPillar', 'Yes', 'Content pillar'),
    ('engagement_tier', 'CharField(10)', 'No', 'high/mid/experimental'),
    ('source', 'CharField(25)', 'No', 'ai_generated/manual/trend_based'),
    ('trending_topic_ref', 'CharField(500)', 'Yes', 'Related trend'),
    ('status', 'CharField(20)', 'No', 'new/pending/used/rejected'),
    ('batch_id', 'CharField(50)', 'Yes', 'Generation batch'),
])
PB()

# ── M2 AI Image Engine ──
H('M2 \u2014 AI Image Engine', 2)
H('Purpose', 3)
P('Generates social media images using OpenAI (DALL-E 3, GPT-Image-1) and Google Gemini (Imagen). Supports logo overlay, product image references, 9-layer prompt engineering, image diagnosis, and auto-reprompting.')

H('Detailed Endpoint: Image Generation', 3)
EP('POST', '/api/v1/images/generate/', 'JWT',
   '{ "prompt": "string", "provider": "openai|gemini", "model": "dall-e-3|gpt-image-1|gemini", "size": "1024x1024", "quality": "standard|hd", "style": "vivid|natural", "logo_id": null, "logo_position": "bottom-right", "product_image": null, "brand_id": null }',
   '{ "id": 1, "prompt": "...", "revised_prompt": "...", "image": "/media/...", "provider": "openai", "status": "completed", "generation_time": 5.2, "prompt_engineering_used": true }',
   'If brand_id provided, uses 9-layer prompt engineering. Logo overlay via Pillow.')

H('9-Layer Prompt Engineering', 3)
EP('POST', '/api/v1/prompt-engineer/generate/', 'JWT',
   '{ "brand_id": 1, "subject": "Product showcase", "platform": "instagram", "mood": "energetic", "key_message": "Summer sale", "must_include": ["logo", "product"], "must_exclude": ["text", "people"], "text_overlay_position": "bottom_right" }',
   '{ "primary_prompt": "9-layer optimized prompt...", "brand_style_anchor": "Brand visual DNA...", "alternative_prompts": ["alt1", "alt2"], "recommended_params": { "style": "photorealistic", "size": "1024x1024" } }',
   'Claude AI generates brand-aware prompts using 9 optimization layers.')

EP('POST', '/api/v1/prompt-engineer/diagnose/', 'JWT',
   '{ "image_description": "What image looks like", "original_prompt": "Used prompt", "revised_prompt": "API revised" }',
   '{ "diagnosis": "Analysis...", "key_issues": ["Issue 1"], "recommendations": ["Fix 1"], "estimated_fix_impact": 0.85 }',
   'Claude AI diagnoses why image generation failed or produced poor results.')

H('Data Model: ImageGeneration', 3)
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('user', 'FK \u2192 User', 'No', 'Owner'),
    ('prompt', 'TextField', 'No', 'Generation prompt'),
    ('revised_prompt', 'TextField', 'Yes', 'AI-revised prompt'),
    ('provider', 'CharField(20)', 'No', 'openai/gemini'),
    ('model', 'CharField(50)', 'Yes', 'Specific model'),
    ('size', 'CharField(20)', 'No', 'Image dimensions'),
    ('quality', 'CharField(20)', 'No', 'standard/hd'),
    ('style', 'CharField(20)', 'Yes', 'vivid/natural'),
    ('image', 'ImageField', 'Yes', 'Generated image file'),
    ('logo_overlay', 'BooleanField', 'No', 'Logo overlaid flag'),
    ('logo_position', 'CharField(20)', 'Yes', 'Position (bottom-right etc)'),
    ('product_image', 'ImageField', 'Yes', 'Reference product image'),
    ('brand_style_anchor', 'TextField', 'Yes', 'Brand visual DNA'),
    ('prompt_engineering_used', 'BooleanField', 'No', '9-layer flag'),
    ('failure_codes', 'JSONField', 'Yes', 'Failure taxonomy'),
    ('reprompt_attempt', 'IntegerField', 'No', 'Retry count (max 3)'),
    ('status', 'CharField(20)', 'No', 'pending/completed/failed'),
    ('error_message', 'TextField', 'Yes', 'Error details'),
    ('generation_time', 'FloatField', 'Yes', 'Seconds'),
])
PB()

# ── M3 AI Copy Engine ──
H('M3 \u2014 AI Copy Engine', 2)
H('Purpose', 3)
P('Generates social media captions, hashtags, content ideas using Claude AI (primary) with OpenAI/Gemini fallback. Supports platform-specific generation, tone/length controls, Brand DNA injection, A/B variants.')

H('UnifiedLLMService (Core AI Router)', 3)
P('The UnifiedLLMService routes all text AI calls through a provider fallback chain:')
P('1. Claude (preferred) \u2192 2. OpenAI (fallback) \u2192 3. Gemini (fallback)')
P('Model mapping: gpt-4o \u2192 claude-sonnet-4, gpt-4o-mini \u2192 claude-haiku-4.5')
P('Supports: JSON mode, extended thinking (budget >= 1024), vision analysis, model auto-detection')

H('Detailed Endpoint: Caption Generation', 3)
EP('POST', '/api/v1/captions/drafts/{post_id}/generate/', 'JWT',
   '{ "platforms": ["twitter", "linkedin"], "count": 3, "tone": "professional", "include_cta": false, "override_prompt": "", "think_harder": false }',
   '{ "captions": [{ "id":1, "platform":"twitter", "variant_number":1, "body":"...", "cta_text":"...", "tone":"professional", "char_count":245, "is_selected":true, "is_ab_test":false, "ab_label":null, "image_prompt":"DALL-E prompt...", "char_status":"within_limit" }], "used_prompt":"...", "compliance_warnings": [] }',
   'Claude generates platform-specific captions with Brand DNA context. Returns char_status per platform limit.')

EP('POST', '/api/v1/captions/drafts/{post_id}/adapt/', 'JWT',
   '{ "caption_id": 1, "target_platforms": ["twitter", "linkedin"], "override_prompt": "", "think_harder": false }',
   '{ "captions": [{ adapted captions per platform }], "used_prompt": "..." }',
   'Adapts existing caption for different platforms (length, tone, hashtag style).')

EP('POST', '/api/v1/hashtags/drafts/{post_id}/generate/', 'JWT',
   '{ "platforms": ["twitter"], "count": 15, "style": "mixed" }',
   '{ "hashtags": [{ "tag":"#AI", "tier":"high_volume", "estimated_volume":1000000, "is_selected":true }] }',
   'AI suggests hashtags with volume estimates and tier classification.')

H('Data Model: PostCaption', 3)
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('post', 'FK \u2192 Post', 'No', 'Parent post'),
    ('platform', 'CharField(20)', 'No', 'Target platform'),
    ('variant_number', 'IntegerField', 'No', 'Variant number'),
    ('body', 'TextField', 'No', 'Caption text'),
    ('cta_text', 'CharField(300)', 'Yes', 'Call to action'),
    ('tone', 'CharField(100)', 'Yes', 'Tone used'),
    ('char_count', 'IntegerField', 'No', 'Character count'),
    ('is_selected', 'BooleanField', 'No', 'Selected for use'),
    ('is_ab_test', 'BooleanField', 'No', 'A/B test flag'),
    ('ab_label', 'CharField(1)', 'Yes', 'A or B label'),
    ('image_prompt', 'TextField', 'Yes', 'Auto-generated image prompt'),
])
PB()

# ── M4 Calendar Planner ──
H('M4 \u2014 Calendar Planner', 2)
H('Purpose', 3)
P('Manages post scheduling with visual calendar, AI best-time suggestions, conflict detection, and per-platform scheduling.')

H('Detailed Endpoints', 3)
EP('POST', '/api/v1/drafts/{post_id}/schedule/', 'JWT',
   '{ "platforms": [{ "platform": "twitter", "caption_id": 1, "scheduled_at": "2026-03-15T14:30:00Z", "timezone": "UTC", "hashtag_placement": "end_of_caption" }] }',
   '[ { "id":1, "post":1, "platform":"twitter", "scheduled_at":"ISO", "status":"scheduled" } ]',
   'Creates ScheduledPostPlatform records. APScheduler picks up and publishes.')

EP('POST', '/api/v1/schedule/compute-times/', 'JWT',
   '{ "brand_id": 1, "platforms": ["twitter", "linkedin"], "override_prompt": "", "think_harder": false }',
   '{ "brand_id":1, "count":12, "recommendations": [{ "platform":"twitter", "day_of_week":3, "hour_utc":14, "score":0.95, "source":"competitor_analysis", "reason":"Peak engagement time" }] }',
   'Claude AI suggests optimal posting times based on competitor analysis and engagement data.')

EP('POST', '/api/v1/schedule/conflict-check/', 'JWT',
   '{ "platform": "twitter", "scheduled_at": "2026-03-15T14:30:00Z", "buffer_minutes": 30 }',
   '{ "has_conflict": false, "conflicts": [], "message": "No conflicts" }',
   'Checks for scheduling conflicts within buffer window.')

H('Data Model: ScheduledPostPlatform', 3)
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('post', 'FK \u2192 Post', 'No', 'Parent post'),
    ('platform', 'CharField(20)', 'No', 'Target platform'),
    ('caption', 'FK \u2192 PostCaption', 'Yes', 'Selected caption'),
    ('hashtag_placement', 'CharField(20)', 'No', 'end_of_caption/beginning/inline'),
    ('scheduled_at', 'DateTimeField', 'No', 'Publish time'),
    ('timezone', 'CharField(50)', 'No', 'Default: UTC'),
    ('status', 'CharField(20)', 'No', 'scheduled/publishing/published/failed'),
    ('publish_result_json', 'JSONField', 'No', 'Platform response'),
    ('retry_count', 'IntegerField', 'No', 'Retry attempts'),
    ('max_retries', 'IntegerField', 'No', 'Default: 3'),
    ('published_at', 'DateTimeField', 'Yes', 'Actual publish time'),
])
PB()

# ── M5 Social Connector ──
H('M5 \u2014 Social Connector', 2)
P('Handles OAuth authentication with 8 platforms: Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest, Telegram. Stores credentials, manages token refresh.')

H('Data Model: SocialAccount', 3)
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('user', 'FK \u2192 User', 'No', 'Account owner'),
    ('platform', 'CharField(50)', 'No', 'Platform name'),
    ('platform_user_id', 'CharField(200)', 'Yes', 'Platform user ID'),
    ('username', 'CharField(200)', 'Yes', 'Platform username'),
    ('display_name', 'CharField(200)', 'Yes', 'Display name'),
    ('access_token', 'TextField', 'Yes', 'OAuth token (encrypted)'),
    ('refresh_token', 'TextField', 'Yes', 'Refresh token'),
    ('token_expires_at', 'DateTimeField', 'Yes', 'Token expiry'),
    ('profile_image_url', 'URLField', 'Yes', 'Profile picture'),
    ('platform_data', 'TextField', 'No', 'JSON: page_id, API keys'),
    ('status', 'CharField(20)', 'No', 'active/expired/revoked'),
    ('is_active', 'BooleanField', 'No', 'Default: True'),
    ('connected_at', 'DateTimeField', 'No', 'Connection time'),
])
PB()

# ── M6 Publisher Engine ──
H('M6 \u2014 Publisher Engine', 2)
P('Handles actual posting to social media platforms. Multi-platform publishing, per-platform customization, media attachments, status tracking.')

H('Data Model: Post', 3)
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('user', 'FK \u2192 User', 'No', 'Post owner'),
    ('caption', 'TextField', 'No', 'Post text content'),
    ('ai_generated', 'BooleanField', 'No', 'AI generated flag'),
    ('media_files', 'TextField', 'No', 'JSON array of media'),
    ('scheduled_time', 'DateTimeField', 'No', 'Schedule time'),
    ('platforms', 'TextField', 'No', 'JSON array of platforms'),
    ('status', 'CharField(20)', 'No', 'draft/pending_approval/approved/scheduled/posting/posted/failed/rejected/cancelled'),
    ('idea', 'FK \u2192 ContentIdea', 'Yes', 'Source idea'),
    ('brand', 'FK \u2192 Brand', 'Yes', 'Associated brand'),
    ('pillar', 'FK \u2192 ContentPillar', 'Yes', 'Content pillar'),
    ('hook', 'TextField', 'Yes', 'Opening hook'),
    ('goal', 'CharField(20)', 'Yes', 'Post goal'),
    ('checklist_status', 'JSONField', 'No', 'Approval checklist'),
    ('submitted_at', 'DateTimeField', 'Yes', 'Approval submit time'),
    ('approved_at', 'DateTimeField', 'Yes', 'Approval time'),
    ('facebook_post_id', 'CharField(200)', 'Yes', 'FB post ID after publish'),
    ('twitter_post_id', 'CharField(200)', 'Yes', 'Twitter post ID'),
    ('instagram_post_id', 'CharField(200)', 'Yes', 'IG post ID'),
    ('linkedin_post_id', 'CharField(200)', 'Yes', 'LinkedIn post ID'),
    ('(+ tiktok, youtube, pinterest, telegram)', '', '', 'Same pattern for all 8 platforms'),
    ('(+ per-platform error fields)', '', '', 'facebook_error, twitter_error, etc.'),
])
PB()

# ── M7 Analytics Engine ──
H('M7 \u2014 Analytics Engine', 2)
P('Tracks post performance across all platforms. Collects metrics, generates weekly reports, provides dashboards.')

H('Detailed Endpoints', 3)
EP('GET', '/api/v1/posts/{post_id}/stats/', 'JWT', 'No body (Query: ?snapshot=24h)',
   '[ { "platform":"twitter", "snapshot_type":"24h", "impressions":5000, "reach":3000, "engagement_rate":4.5, "likes":150, "comments_count":30, "shares":20, "clicks":100, "saves":25 } ]',
   'Returns per-platform analytics snapshots.')

EP('POST', '/api/v1/comments/{id}/ai-reply/', 'JWT',
   '{ "override_prompt": "", "think_harder": false }',
   '{ "replied": true, "reply_type": "ai", "reply_body": "AI-generated reply...", "used_prompt": "..." }',
   'Claude AI generates contextual reply based on comment sentiment and brand voice.')

EP('GET', '/api/v1/brands/{id}/weekly-report/', 'JWT', 'No body',
   '[ { "period_start":"...", "period_end":"...", "data":{}, "winners":[], "losers":[], "best_hooks":[], "best_times":[], "pillar_performance":{}, "recommendations":[], "test_plan":{} } ]',
   'AI-generated weekly performance analysis.')

H('Data Model: PostAnalytics', 3)
T(['Column', 'Type', 'Nullable', 'Description'], [
    ('post', 'FK \u2192 Post', 'No', 'Parent post'),
    ('platform', 'CharField(20)', 'No', 'Platform name'),
    ('platform_post_id', 'CharField(200)', 'Yes', 'Platform post ID'),
    ('snapshot_type', 'CharField(10)', 'No', '24h/48h/7d/latest'),
    ('impressions', 'IntegerField', 'No', 'View count'),
    ('reach', 'IntegerField', 'No', 'Unique viewers'),
    ('engagement_rate', 'FloatField', 'No', 'Engagement %'),
    ('likes', 'IntegerField', 'No', 'Like count'),
    ('comments_count', 'IntegerField', 'No', 'Comment count'),
    ('shares', 'IntegerField', 'No', 'Share count'),
    ('clicks', 'IntegerField', 'No', 'Click count'),
    ('saves', 'IntegerField', 'No', 'Save count'),
    ('profile_visits', 'IntegerField', 'No', 'Profile visit count'),
    ('data_json', 'JSONField', 'No', 'Extra platform-specific data'),
])
PB()

# ── M8 Learning Engine ──
H('M8 \u2014 Learning Engine', 2)
P('Analyzes post performance to extract actionable insights. Identifies best hooks, optimal posting times, top topics. Learning signals feed back into AI generation.')
P('Signal types: high_engagement, best_hook, best_time, best_topic, audience_signal')
P('Data stored in LearningSignal model with signal_type, reference_id, data_json, applied flag.')
PB()

# ── M9 Overlay Engine ──
H('M9 \u2014 Overlay Engine', 2)
P('Adds text copy to AI-generated images using Pillow. Fonts: Bebas Neue, Montserrat (Bold/Regular), Playfair Display Bold, Roboto Bold.')

EP('POST', '/api/v1/assets/{id}/copy-overlay/', 'JWT',
   '{ "copy_text": "Text to overlay (max 200)", "position": "center|bottom_banner|top_banner|top_bottom_split", "font_style": "montserrat_bold|playfair_bold|roboto_bold|bebas_neue", "text_color": "#FFFFFF", "overlay_opacity": 60, "font_size": 0, "text_alignment": "left|center|right", "add_text_shadow": true }',
   '{ "asset_id": 10, "overlay_image_url": "/media/..." }',
   'Renders text onto image with semi-transparent background, custom font/color.')

EP('POST', '/api/v1/assets/{id}/copy-overlay/generate/', 'JWT',
   '{ "brand_id": 1, "caption_text": "...", "image_description": "...", "count": 5 }',
   '{ "suggestions": ["Copy 1", "Copy 2", ...] }',
   'Claude AI generates copy suggestions based on brand DNA and image context.')
PB()

# ── M10 Export Engine ──
H('M10 \u2014 Export Engine', 2)
P('Asset resizing for platform specs, creative template management, carousel splitting.')

EP('POST', '/api/v1/drafts/{post_id}/assets/carousel-split/', 'JWT',
   '{ "content": "Long-form content", "max_slides": 10, "style": "minimal" }',
   '{ "post_id":1, "total_slides":5, "slides": [{ "slide_number":1, "headline":"...", "body":"...", "image_url":"..." }] }',
   'Splits long-form content into carousel slides with auto-generated images.')
PB()

# ── M11 Billing Engine ──
H('M11 \u2014 Billing Engine', 2)
P('Manages subscription plans and usage limits via UserProfile fields.')

T(['Resource', 'Free', 'Starter', 'Pro', 'Business', 'Enterprise'], [
    ('Posts/month', '30', '100', '500', '2000', 'Unlimited'),
    ('Captions/month', '50', '200', '1000', '5000', 'Unlimited'),
    ('Images/month', '10', '50', '200', '1000', '5000'),
    ('Videos/month', '5', '20', '100', '500', '2000'),
    ('Messenger msgs', '0', '0', '500', '5000', 'Unlimited'),
    ('Brands', '1', '2', '5', '15', '100'),
])
PB()

# ── M12 Notification Engine ──
H('M12 \u2014 Notification Engine', 2)
P('In-app notifications for all key events. 20+ notification types including:')
T(['Type', 'Trigger', 'Example Message'], [
    ('images_ready', 'Image gen complete', 'Your images are ready!'),
    ('daily_limit_warning', 'Usage at 80%', 'You have used 80% of your daily image limit'),
    ('post_submitted', 'Post submitted', 'A new post has been submitted for review'),
    ('post_approved', 'Post approved', 'Your post has been approved'),
    ('post_rejected', 'Post rejected', 'Your post was rejected'),
    ('post_published', 'Post published', 'Your post was published to Facebook'),
    ('post_failed', 'Publish failed', 'Failed to publish to Instagram'),
    ('weekly_report', 'Report generated', 'Your weekly report is ready'),
    ('token_expiring', 'Token near expiry', 'Your Facebook token expires in 3 days'),
    ('winner_detected', 'High performer', 'Your post is performing above average!'),
    ('reply_sla_breach', 'Comment unread', 'A comment has been waiting 24 hours'),
])
PB()

# ── M13 Messenger Bot ──
H('M13 \u2014 Messenger Bot (Bonus Module)', 2)
H('Purpose', 3)
P('Facebook Messenger AI chatbot with RAG knowledge base (PDF + website), WooCommerce/Shopify e-commerce integration, image understanding (vision), voice transcription (Whisper), and intelligent notification routing.')

H('How It Works', 3)
P('1. User connects Facebook Page \u2192 MessengerConnection created')
P('2. Upload PDFs \u2192 PDFProcessor extracts text \u2192 OpenAI embeddings \u2192 PDFChunk records')
P('3. Optionally connect WooCommerce \u2192 Sync products \u2192 Generate product embeddings')
P('4. Message arrives via webhook \u2192 MessageHandler.process_message()')
P('5. System detects message importance (AI classification or keyword matching)')
P('6. RAGEngine retrieves relevant chunks from 3 sources: PDFs + Brand DNA + Products')
P('7. Claude/GPT generates response with context and conversation history')
P('8. Response sent via Facebook Graph API')
P('9. If important: creates Notification for business owner')

H('RAG Pipeline', 3)
P('Query \u2192 Embedding \u2192 Cosine similarity search (threshold 0.7) across:')
P('  - PDF chunks (uploaded documents)')
P('  - Brand DNA chunks (website crawl)')
P('  - Product embeddings (WooCommerce catalog)')
P('  - Top-K (3 default) results sorted by similarity')
P('  - Context injected into AI prompt with source citations')

H('Key Models', 3)
T(['Model', 'Purpose', 'Key Fields'], [
    ('MessengerConnection', 'FB Page connection', 'page_id, page_access_token, verify_token, is_webhook_verified'),
    ('AIConfiguration', 'Bot AI settings', 'openai_model, embedding_model, rag_enabled, top_k_results, similarity_threshold, temperature, max_tokens, voice_transcription_enabled'),
    ('PDFKnowledgeBase', 'RAG documents', 'file, filename, status (pending/processing/completed/failed), total_chunks, total_pages'),
    ('PDFChunk', 'RAG text chunks', 'text, chunk_index, page_number, embedding (JSON vector)'),
    ('Conversation', 'User conversations', 'sender_id, sender_name, message_count, human_takeover'),
    ('Message', 'Individual messages', 'message_type (text/image/file/sticker), sender (user/bot), text, rag_context_used, tokens_used, processing_time'),
    ('CustomPrompt', 'Bot personality', 'system_prompt, tone (professional/casual/friendly/technical/sales/support)'),
    ('ECommerceSettings', 'WooCommerce config', 'store_url, consumer_key, consumer_secret, product_match_threshold'),
    ('Product', 'Synced products', 'name, price, stock_status, permalink, embedding'),
    ('Notification', 'Important alerts', 'notification_type, title, summary, priority (high/medium/low)'),
])

H('Messenger API Endpoints', 3)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/api/v1/messenger/dashboard/', 'Messenger dashboard stats'),
    ('GET/PUT', '/api/v1/messenger/connections/{id}/config/', 'AI configuration'),
    ('GET/POST', '/api/v1/messenger/connections/{id}/pdfs/', 'PDF knowledge base'),
    ('GET', '/api/v1/messenger/connections/{id}/conversations/', 'List conversations'),
    ('POST', '/api/v1/messenger/connections/{id}/conversations/{pk}/toggle-takeover/', 'Toggle human takeover'),
    ('POST', '/api/v1/messenger/connections/{id}/conversations/{pk}/send-message/', 'Send manual message'),
    ('GET/POST', '/api/v1/messenger/connections/{id}/prompts/', 'Custom prompts'),
    ('POST', '/api/v1/messenger/connections/{id}/prompts/{pk}/activate/', 'Activate prompt'),
    ('POST', '/api/v1/messenger/connections/{id}/crawl-website/', 'Crawl website for RAG'),
    ('GET/PUT', '/api/v1/messenger/connections/{id}/ecommerce/', 'E-commerce settings'),
    ('POST', '/api/v1/messenger/connections/{id}/ecommerce/test/', 'Test WooCommerce connection'),
    ('POST', '/api/v1/messenger/connections/{id}/ecommerce/sync/', 'Sync products'),
    ('POST', '/api/v1/messenger/connections/{id}/ecommerce/embeddings/', 'Regenerate embeddings'),
    ('GET', '/api/v1/messenger/connections/{id}/ecommerce/products/', 'List synced products'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# 4. WORKFLOW STAGES
# ══════════════════════════════════════════════════════════════════════════
H('4. Workflow Stages', 1)
T(['#', 'Stage', 'User Action', 'System Response', 'Modules'], [
    ('1', 'Strategy Setup', 'Create brand, provide website URL', 'Crawl website, generate 15-field Brand DNA via Claude AI', 'M1'),
    ('2', 'Idea Generation', 'Request content ideas', 'Claude generates 5-10 ideas based on DNA, trends, competitors', 'M1, M3, M8'),
    ('3', 'Draft Creation', 'Select idea, create post draft', 'Pre-fill with AI caption, suggest images', 'M3, M6'),
    ('4', 'Caption Generation', 'Generate captions (tone, length, platform)', 'Claude generates platform-specific captions with hashtags/CTAs', 'M3'),
    ('5', 'Hashtag Engine', 'Request hashtag suggestions', 'AI suggests with volume estimates, filters banned tags', 'M3'),
    ('6', 'Creative Assets', 'Generate images/videos, add overlays', 'DALL-E/Gemini generates, overlay logos/text, resize', 'M2, M9, M10'),
    ('7', 'Approval Pipeline', 'Submit for review', 'Track status, notify team, enforce workflow', 'M12'),
    ('8', 'Schedule & Publish', 'Select time or accept AI suggestion', 'Queue post, publish at optimal time, track status', 'M4, M5, M6'),
    ('9', 'Analytics', 'View performance metrics', 'Sync from platforms, generate weekly reports', 'M7'),
    ('10', 'Learning Loop', 'Automatic', 'Extract learning signals, feed into future generations', 'M8'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# 5. USER ROLES & PERMISSIONS
# ══════════════════════════════════════════════════════════════════════════
H('5. User Roles & Permissions', 1)
T(['Role', 'Create', 'Approve', 'Publish', 'Analytics', 'Admin'], [
    ('Owner', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'),
    ('Admin', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes (except delete workspace)'),
    ('Creator', 'Yes', 'No', 'No', 'Own posts', 'No'),
    ('Approver', 'No', 'Yes', 'No', 'Yes', 'No'),
    ('Publisher', 'No', 'No', 'Yes', 'Yes', 'No'),
    ('Viewer', 'No', 'No', 'No', 'Yes', 'No'),
])

H('Approval Pipeline Flow', 2)
P('Creator submits draft \u2192 Status: pending_approval \u2192 Approver reviews')
P('  \u2192 Approve: status=approved, ready to publish')
P('  \u2192 Request Changes: status=changes_requested, creator notified with comment')
P('  \u2192 Reject: status=rejected with reason (off_brand/compliance/quality/factual_error/timing)')
P('All actions logged in ApprovalLog with acted_by, comment, timestamp.')
PB()

# ══════════════════════════════════════════════════════════════════════════
# 6. FRONTEND ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════════
H('6. Frontend Architecture', 1)
P('React 19 + TypeScript SPA built with Vite. State: Zustand. Styling: Tailwind CSS. Animation: Framer Motion.')

H('6.1 Pages (30)', 2)
T(['Page', 'Path', 'Purpose'], [
    ('DashboardPage', '/', 'Main dashboard with stats, quick actions'),
    ('MyPostsPage', '/posts', 'List/manage all user posts'),
    ('CreatePostPage', '/posts/create', 'Create/edit posts with multi-platform'),
    ('AICaptionPage', '/ai-caption', 'AI caption generation'),
    ('AIImagePage', '/ai-image', 'AI image generation'),
    ('AIVideoPage', '/ai-video', 'AI video generation'),
    ('AIVoicePage', '/ai-voice', 'AI voice/TTS generation'),
    ('StrategyHubPage', '/strategy', 'Content strategy & competitor analysis'),
    ('IdeasHubPage', '/ideas', 'Content idea generation & management'),
    ('CalendarPage', '/calendar', 'Content calendar/scheduling'),
    ('AnalyticsPage', '/analytics', 'Post analytics & performance'),
    ('MessengerBotPage', '/messenger', 'FB Messenger bot with RAG/e-commerce'),
    ('ConnectAccountsPage', '/accounts', 'Connect social media accounts'),
    ('ApprovalReviewPage', '/approvals', 'Review content approval workflows'),
    ('PermissionsPage', '/permissions', 'Workspace RBAC management'),
    ('ProfilePage', '/profile', 'User profile management'),
    ('SettingsPage', '/settings', 'App settings, API keys, theme'),
    ('OverflowPage', '/overflow', 'Advanced onboarding wizard'),
    ('IdeaHistoryPage', '/ideas/history', 'Historical idea tracking'),
    ('BusinessProfilePage', '/business-profile', 'Brand/business setup'),
    ('OnboardingPage', '/onboarding', 'Initial setup wizard'),
    ('AdminDashboardPage', '/admin', 'Admin overview'),
    ('AdminUsersPage', '/admin/users', 'Manage users'),
    ('AdminUserDetailPage', '/admin/users/:id', 'User detail/impersonation'),
    ('AdminAnalyticsPage', '/admin/analytics', 'Platform-wide analytics'),
    ('APITestPage', '/api-test', 'API testing interface'),
    ('AboutPage', '/about', 'About information'),
    ('PrivacyPage', '/privacy', 'Privacy policy'),
    ('TermsPage', '/terms', 'Terms of service'),
    ('HelpPage', '/help', 'Help/support'),
])

H('6.2 Components', 2)
T(['Directory', 'Components', 'Purpose'], [
    ('layout/', 'Layout, Navbar, Sidebar, Footer, SupportChatbot', 'App shell and navigation'),
    ('dashboard/', 'WelcomeSection, StatsCard, QuickActions, SubscriptionInfo', 'Dashboard widgets'),
    ('admin/', 'AdminLayout, AdminNavbar, AdminSidebar, UserSelectModal', 'Admin panel'),
    ('ai-image/', 'CopyOverlayModal, ImageDiagnosisModal, PromptPreviewPanel, RepromptPanel', 'AI image tools'),
    ('ui/', 'Button, Card, Input, Modal, Avatar, Badge, Spinner, PlatformIcon, PromptInfoButton', 'Shared UI components'),
    ('(root)', 'CaptionEditor, CreativeGenerator, HashtagManager, PlatformPreviewPanel, PostCommentInbox, RepurposePrompt, VersionHistoryPanel, WeeklyReportView, NotificationCenter, DraftChecklistWidget, BestTimeSuggestionOverlay, AssetResizePreview', 'Feature components'),
])

H('6.3 Services (API Clients)', 2)
T(['Service', 'File', 'API Calls'], [
    ('authService', 'authService.ts', 'Login, register, logout, current user'),
    ('postService', 'postService.ts', 'CRUD posts, scheduling, cloning'),
    ('captionService', 'captionService.ts', 'AI caption generation, drafts, variants'),
    ('imageService', 'imageService.ts', 'AI image gen, logos, prompt engineering, diagnosis'),
    ('videoService', 'videoService.ts', 'AI video generation'),
    ('voiceService', 'voiceService.ts', 'AI voice/TTS generation'),
    ('strategyService', 'strategyService.ts', 'Brand DNA, pillars, competitors, trending'),
    ('hashtagService', 'hashtagService.ts', 'Hashtag groups, suggestions, banned tags'),
    ('calendarService', 'calendarService.ts', 'Schedule management, best times'),
    ('analyticsService', 'analyticsService.ts', 'Post stats, engagement, platform metrics'),
    ('approvalService', 'approvalService.ts', 'Submission, approval, rejection'),
    ('creativeService', 'creativeService.ts', 'Asset management, resizing, overlays'),
    ('messengerService', 'messengerService.ts', 'Bot config, conversations, PDFs'),
    ('notificationService', 'notificationService.ts', 'Notification management'),
    ('platformService', 'platformService.ts', 'Social account management'),
    ('rbacService', 'rbacService.ts', 'Role-based access control'),
    ('dashboardService', 'dashboardService.ts', 'Dashboard statistics'),
    ('onboardingService', 'onboardingService.ts', 'Onboarding workflow'),
])

H('6.4 State Management (Zustand)', 2)
T(['Store', 'Purpose', 'Key State'], [
    ('authStore', 'Authentication', 'user, tokens, login/logout/register actions'),
    ('postStore', 'Posts', 'posts list, filters, creation state'),
    ('dashboardStore', 'Dashboard', 'stats, recent posts'),
    ('adminStore', 'Admin panel', 'user management, impersonation'),
    ('overflowStore', 'Onboarding', 'overflow wizard progress'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# 7. DEPLOYMENT & ENVIRONMENT
# ══════════════════════════════════════════════════════════════════════════
H('7. Deployment & Environment', 1)

H('7.1 Environment Variables', 2)
T(['Variable', 'Required', 'Module', 'Description'], [
    ('DJANGO_SECRET_KEY', 'Yes', 'Core', 'Django secret key'),
    ('DJANGO_DEBUG', 'Yes', 'Core', 'Debug mode (True/False)'),
    ('ALLOWED_HOSTS', 'Yes', 'Core', 'Comma-separated hostnames'),
    ('DB_NAME', 'Yes', 'Core', 'MySQL database name (default: sellento)'),
    ('DB_USER', 'Yes', 'Core', 'MySQL user (default: root)'),
    ('DB_PASSWORD', 'Yes', 'Core', 'MySQL password'),
    ('DB_HOST', 'Yes', 'Core', 'MySQL host (default: localhost)'),
    ('DB_PORT', 'Yes', 'Core', 'MySQL port (default: 3306)'),
    ('ANTHROPIC_API_KEY', 'Yes', 'M1,M3,M8', 'Claude API key (global admin)'),
    ('OPENAI_API_KEY', 'Optional', 'M2,Voice', 'OpenAI key (DALL-E, TTS)'),
    ('GEMINI_API_KEY', 'Optional', 'M2,Video', 'Gemini key (Imagen, Veo)'),
    ('TIME_ZONE', 'No', 'Core', 'Server timezone (default: UTC)'),
])

H('7.2 Deployment Steps', 2)
steps = [
    '1. Clone repo: git clone <url> && cd Final_version_socialSync',
    '2. Create venv: python -m venv venv && source venv/bin/activate',
    '3. Install deps: pip install -r requirements.txt',
    '4. Create .env from template: cp .env.example .env',
    '5. Create MySQL DB: CREATE DATABASE sellento CHARACTER SET utf8mb4;',
    '6. Run migrations: python manage.py migrate',
    '7. Create superuser: python manage.py createsuperuser',
    '8. Collect static: python manage.py collectstatic --noinput',
    '9. Build frontend: cd frontend && npm install && npm run build',
    '10. Start: gunicorn socialsync.wsgi:application --bind 0.0.0.0:8000 --workers 4',
    '11. Configure Nginx reverse proxy',
    '12. Setup cron jobs: run_scheduler, sync_analytics, sync_comments, generate_weekly_report, fetch_trending, process_pdfs, check_sla, check_token_health',
]
for s in steps:
    P(s)

H('7.3 Rate Limits', 2)
T(['Resource', 'Free', 'Enterprise', 'Enforced By'], [
    ('Posts/month', '30', 'Unlimited', 'UserProfile'),
    ('Captions/month', '50', 'Unlimited', 'UserProfile'),
    ('Images/month', '10', '5000', 'UserProfile'),
    ('Videos/month', '5', '2000', 'UserProfile'),
    ('Messenger msgs', '0', 'Unlimited', 'UserProfile'),
    ('Workspace generations/day', '200', 'Configurable', 'Workspace'),
    ('File upload', '10MB', '10MB', 'Django settings'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# 8. COMPLETE API REFERENCE
# ══════════════════════════════════════════════════════════════════════════
H('8. Complete API Endpoint Reference', 1)
P('All endpoints are prefixed with /api/v1/. Auth: JWT Bearer Token unless noted.')

H('Authentication (6 endpoints)', 2)
T(['Method', 'Endpoint', 'Auth', 'Description'], [
    ('POST', '/auth/register/', 'AllowAny', 'Register user (username, email, password, password_confirm)'),
    ('POST', '/auth/register-with-brand/', 'AllowAny', 'Register + create brand + workspace + auto DNA'),
    ('POST', '/auth/login/', 'AllowAny', 'Login (username, password) \u2192 access + refresh tokens'),
    ('POST', '/auth/logout/', 'JWT', 'Blacklist refresh token'),
    ('POST', '/auth/refresh/', 'AllowAny', 'Refresh access token'),
    ('GET', '/auth/me/', 'JWT', 'Current user info + profile + brands'),
])

H('Profile & Settings (3)', 2)
T(['Method', 'Endpoint', 'Auth', 'Description'], [
    ('GET/PUT', '/profile/', 'JWT', 'User profile CRUD'),
    ('GET', '/profile/api-keys/', 'JWT', 'Get API key status (masked)'),
    ('PATCH', '/profile/api-keys/', 'JWT', 'Update OpenAI/Gemini keys (synced to all features)'),
])

H('Brands & Workspaces (20+)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET/POST', '/brands/', 'List/create brands'),
    ('GET/PUT/DELETE', '/brands/{id}/', 'Brand CRUD'),
    ('POST', '/brands/{id}/generate-dna/', 'Generate Brand DNA from website'),
    ('POST', '/brands/{id}/regenerate-dna-inputs/', 'Regenerate DNA from manual inputs'),
    ('GET', '/brands/{id}/dna-history/', 'DNA version history'),
    ('POST', '/brands/{id}/dna-history/{hid}/restore/', 'Restore old DNA version'),
    ('GET/POST', '/brands/{id}/pillars/', 'Content pillars CRUD'),
    ('POST', '/brands/{id}/pillars/generate/', 'AI-generate pillars'),
    ('GET', '/brands/{id}/pillar-compliance/', 'Check pillar allocation compliance'),
    ('GET/POST', '/brands/{id}/competitors/', 'Competitor profiles'),
    ('POST', '/brands/{id}/competitors/crawl/', 'Crawl competitor website'),
    ('GET', '/brands/{id}/competitors/insights/', 'Competitor insights'),
    ('POST', '/competitors/suggest/', 'AI-suggest competitors'),
    ('GET', '/brands/{id}/trending/', 'Trending topics for brand'),
    ('POST', '/brands/{id}/trending/generate/', 'Generate trending topics'),
    ('POST', '/brands/{id}/trending/feedback/', 'Accept/reject trend'),
    ('POST', '/brands/{id}/trending/manual/', 'Add manual trend'),
    ('GET', '/brands/{id}/prompt-history/', 'Prompt usage history'),
    ('GET/POST', '/workspaces/', 'Workspace CRUD'),
    ('GET', '/workspace/members/', 'List workspace members'),
])

H('Content Ideas & Strategy (6)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('POST', '/ideas/generate/', 'AI-generate content ideas'),
    ('POST', '/ideas/{id}/regenerate/', 'Regenerate single idea'),
    ('POST', '/ideas/{id}/add-to-calendar/', 'Convert idea to scheduled post'),
    ('GET', '/ideas/history/', 'Idea history'),
    ('GET', '/trending/', 'Global trending topics'),
    ('POST', '/schedule/compute-times/', 'AI-suggest best posting times'),
])

H('Draft Management (15+)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/drafts/{post_id}/captions/', 'List draft captions'),
    ('POST', '/drafts/{post_id}/captions/generate/', 'AI-generate captions'),
    ('POST', '/drafts/{post_id}/captions/adapt/', 'Adapt caption for platform'),
    ('POST', '/captions/{id}/select/', 'Select caption for use'),
    ('GET', '/captions/{id}/preview/{platform}/', 'Platform-specific preview'),
    ('POST', '/captions/{id}/ab-tag/', 'Tag caption for A/B test'),
    ('GET', '/drafts/{post_id}/hashtags/', 'List draft hashtags'),
    ('POST', '/drafts/{post_id}/hashtags/generate/', 'AI-generate hashtags'),
    ('GET', '/drafts/{post_id}/checklist/', 'Draft readiness checklist'),
    ('GET/POST', '/drafts/{post_id}/assets/', 'List/upload assets'),
    ('POST', '/drafts/{post_id}/assets/generate/', 'AI-generate image asset'),
    ('POST', '/drafts/{post_id}/assets/carousel-split/', 'Split content into carousel'),
    ('POST', '/drafts/{post_id}/clone/', 'Clone draft'),
])

H('Approval Pipeline (6)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('POST', '/drafts/{post_id}/submit/', 'Submit for approval'),
    ('POST', '/drafts/{post_id}/approve/', 'Approve post'),
    ('POST', '/drafts/{post_id}/request-changes/', 'Request changes'),
    ('POST', '/drafts/{post_id}/reject/', 'Reject post'),
    ('GET', '/approvals/pending/', 'List pending approvals'),
    ('GET', '/drafts/{post_id}/approval-log/', 'Full approval history'),
])

H('Scheduling (5)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('POST', '/drafts/{post_id}/schedule/', 'Schedule post for platforms'),
    ('PUT', '/scheduled-posts/{spp_id}/', 'Reschedule'),
    ('GET', '/schedule/calendar/', 'Calendar view (start/end params)'),
    ('GET', '/brands/{id}/best-times/', 'Best time suggestions'),
    ('POST', '/schedule/conflict-check/', 'Check scheduling conflicts'),
])

H('Analytics (10)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/posts/{id}/stats/', 'Post quick stats (?snapshot=24h)'),
    ('GET', '/posts/{id}/comments/', 'Post comments with sentiment'),
    ('POST', '/comments/{id}/reply/', 'Reply to comment'),
    ('POST', '/comments/{id}/ai-reply/', 'AI-reply to comment'),
    ('GET', '/brands/{id}/weekly-report/', 'Weekly performance report'),
    ('GET', '/brands/{id}/analytics/dashboard/', 'Analytics dashboard'),
    ('GET', '/brands/{id}/ab-results/', 'A/B test results'),
    ('GET', '/brands/{id}/learning-signals/', 'AI learning signals'),
    ('GET', '/brands/{id}/winners/', 'Top performing posts'),
    ('POST', '/posts/{id}/repurpose/', 'Repurpose as carousel/thread/reel'),
])

H('Creative Assets & Prompt Engineering (10)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('POST', '/assets/{id}/alt-text/', 'Generate alt text for image'),
    ('POST', '/assets/{id}/resize/', 'Resize for platform specs'),
    ('POST', '/assets/{id}/apply-template/', 'Apply brand template'),
    ('GET', '/assets/{id}/versions/', 'Asset version history'),
    ('POST', '/assets/{id}/regenerate/', 'Regenerate asset'),
    ('POST', '/prompt-engineer/generate/', '9-layer prompt engineering'),
    ('POST', '/prompt-engineer/diagnose/', 'Diagnose failed image'),
    ('POST', '/prompt-engineer/reprompt/', 'Auto-fix and reprompt'),
    ('POST', '/assets/{id}/copy-overlay/', 'Apply text overlay'),
    ('POST', '/assets/{id}/copy-overlay/ai-styles/', 'Generate overlay styles'),
])

H('Notifications (5)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/notifications/', 'List notifications (?event_type, ?is_read, ?limit)'),
    ('GET', '/notifications/unread-count/', 'Unread count'),
    ('PATCH', '/notifications/mark-all-read/', 'Mark all as read'),
    ('PATCH', '/notifications/{id}/read/', 'Mark one as read'),
    ('DELETE', '/notifications/{id}/', 'Delete notification'),
])

H('RBAC (4)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/workspaces/{id}/roles/', 'List workspace roles'),
    ('POST', '/workspaces/{id}/roles/assign/', 'Assign role to user'),
    ('POST', '/workspaces/{id}/roles/remove/', 'Remove role'),
    ('GET', '/my-roles/', 'Current user roles across workspaces'),
])

H('Messenger Bot (14)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/messenger/dashboard/', 'Bot dashboard stats'),
    ('GET/PUT', '/messenger/connections/{id}/config/', 'AI configuration'),
    ('GET/POST', '/messenger/connections/{id}/pdfs/', 'PDF knowledge base'),
    ('GET', '/messenger/connections/{id}/conversations/', 'List conversations'),
    ('POST', '/messenger/connections/{id}/conversations/{pk}/toggle-takeover/', 'Toggle human takeover'),
    ('POST', '/messenger/connections/{id}/conversations/{pk}/send-message/', 'Send manual message'),
    ('GET/POST', '/messenger/connections/{id}/prompts/', 'Custom prompts'),
    ('POST', '/messenger/connections/{id}/prompts/{pk}/activate/', 'Activate prompt'),
    ('POST', '/messenger/connections/{id}/crawl-website/', 'Crawl website for RAG'),
    ('GET/PUT', '/messenger/connections/{id}/ecommerce/', 'E-commerce settings'),
    ('POST', '/messenger/connections/{id}/ecommerce/test/', 'Test WooCommerce'),
    ('POST', '/messenger/connections/{id}/ecommerce/sync/', 'Sync products'),
    ('POST', '/messenger/connections/{id}/ecommerce/embeddings/', 'Regenerate embeddings'),
    ('GET', '/messenger/connections/{id}/ecommerce/products/', 'List products'),
])

H('Admin Panel (14)', 2)
T(['Method', 'Endpoint', 'Description'], [
    ('GET', '/admin/dashboard/', 'Admin dashboard (users, posts, AI stats, pipeline)'),
    ('GET', '/admin/users/', 'List users (?status, ?search, ?plan)'),
    ('GET', '/admin/users/{id}/', 'User detail'),
    ('POST', '/admin/users/{id}/approve/', 'Approve user'),
    ('POST', '/admin/users/{id}/reject/', 'Reject user'),
    ('PUT', '/admin/users/{id}/plan/', 'Update subscription plan'),
    ('GET/PUT', '/admin/users/{id}/api-settings/', 'Manage user API keys'),
    ('GET', '/admin/users/{id}/posts/', 'User posts'),
    ('GET', '/admin/users/{id}/accounts/', 'User social accounts'),
    ('GET', '/admin/users/{id}/captions/', 'User captions + token stats'),
    ('GET', '/admin/users/{id}/images/', 'User images'),
    ('GET', '/admin/users/{id}/videos/', 'User videos'),
    ('GET', '/admin/users/{id}/messenger/', 'User messenger data'),
    ('GET', '/admin/analytics/', 'Platform-wide analytics'),
])
PB()

# ══════════════════════════════════════════════════════════════════════════
# 9. CHANGELOG
# ══════════════════════════════════════════════════════════════════════════
H('9. Changelog', 1)
T(['Date', 'Version', 'Author', 'Changes'], [
    ('2026-03-10', '1.2.3', 'Arifuzzaman Swapnil', 'Strategy hub enhancements, prompt history, API key cleanup, GPT-Image-1 support, QuickActions + Footer + StrategyHubPage UI fixes'),
    ('2026-03-09', '1.2.2', 'Arifuzzaman Swapnil', 'Copy overlay system (text on images), prompt engineering fixes, CopyOverlayModal, ImageDiagnosisModal, RepromptPanel, APITestPage, font support'),
    ('2026-03-08', '1.2.1', 'Arifuzzaman Swapnil', 'Strategy hub (pillars, competitors, trending), approval workflows, RBAC, notifications, hashtag management, scheduling'),
    ('2026-03-05', '1.2.0', 'Arifuzzaman Swapnil', 'Claude API integration, unified LLM service, Brand DNA generation, 9-layer prompt engineering'),
    ('2026-02-28', '1.1.0', 'Arifuzzaman Swapnil', 'Core AI: captions, images (DALL-E + Gemini), videos, voice, messenger bot with RAG'),
    ('2026-02-15', '1.0.0', 'Arifuzzaman Swapnil', 'Initial: auth, brand management, posts, social accounts, dashboard, admin'),
])

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('END OF DOCUMENT')
r.bold = True; r.font.size = Pt(14); r.font.color.rgb = RGBColor(0x66, 0x66, 0x88)

# ══════════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════════
try:
    doc.save(OUTPUT_PATH)
    print(f'Report generated: {OUTPUT_PATH}')
except PermissionError:
    alt_path = OUTPUT_PATH.replace('.docx', '_v2.docx')
    doc.save(alt_path)
    print(f'Original file locked. Report generated: {alt_path}')
