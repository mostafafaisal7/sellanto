#!/usr/bin/env python3
"""
SaleAnto System Documentation Report Generator
Generates a comprehensive .docx report following the SaleAnto_Report_Template.
"""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'SaleAnto_System_Documentation.docx')

doc = Document()

# ── Styles ────────────────────────────────────────────────────────────────
style = doc.styles['Normal']
font = style.font
font.name = 'Calibri'
font.size = Pt(11)

for level in range(1, 4):
    h = doc.styles[f'Heading {level}']
    h.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)


def add_table(headers, rows, col_widths=None):
    """Helper to add a formatted table."""
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Light Grid Accent 1'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Header row
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(10)
    # Data rows
    for row_data in rows:
        row = table.add_row()
        for i, val in enumerate(row_data):
            row.cells[i].text = str(val)
            for p in row.cells[i].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10)
    doc.add_paragraph()
    return table


def add_endpoint_detail(method, path, auth, body, params, success, error, rate_limit, notes):
    """Add a detailed endpoint table (Template Table 8 style)."""
    data = [
        ('Endpoint', path),
        ('Method', method),
        ('Auth Required', auth),
        ('Request Body', body),
        ('Query Params', params),
        ('Success Response', success),
        ('Error Response', error),
        ('Rate Limit', rate_limit),
        ('Notes', notes),
    ]
    table = doc.add_table(rows=len(data), cols=2)
    table.style = 'Light Grid Accent 1'
    for i, (k, v) in enumerate(data):
        table.rows[i].cells[0].text = k
        table.rows[i].cells[1].text = str(v)
        for p in table.rows[i].cells[0].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9)
        for p in table.rows[i].cells[1].paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
    doc.add_paragraph()


# ════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════════════════════════
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('SALEANTO')
run.bold = True
run.font.size = Pt(36)
run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('System Documentation Report')
run.font.size = Pt(20)
run.font.color.rgb = RGBColor(0x44, 0x44, 0x66)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('Apps, API Endpoints & Architecture Reference')
run.font.size = Pt(14)
run.font.color.rgb = RGBColor(0x66, 0x66, 0x88)

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('CONFIDENTIAL')
run.bold = True
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0xCC, 0x00, 0x00)

doc.add_paragraph()

# Cover info table
add_table(
    ['Field', 'Value'],
    [
        ('Project', 'SaleAnto \u2014 AI Social Media Platform'),
        ('Live URL', 'abedintechllc.com'),
        ('Version', '1.2.3'),
        ('Date', 'March 10, 2026'),
        ('Author', 'Arifuzzaman Swapnil / SaleAnto Dev Team'),
        ('Status', 'Beta'),
    ]
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('Table of Contents', level=1)
toc_items = [
    '1. Platform Overview',
    '   1.1 User Paths',
    '   1.2 Current Status',
    '2. System Architecture',
    '   2.1 Tech Stack',
    '   2.2 Architecture Diagram',
    '   2.3 Database Overview',
    '3. Module Documentation',
    '   M1 \u2014 Brand Manager',
    '   M2 \u2014 AI Image Engine',
    '   M3 \u2014 AI Copy Engine',
    '   M4 \u2014 Calendar Planner',
    '   M5 \u2014 Social Connector',
    '   M6 \u2014 Publisher Engine',
    '   M7 \u2014 Analytics Engine',
    '   M8 \u2014 Learning Engine',
    '   M9 \u2014 Overlay Engine',
    '   M10 \u2014 Export Engine',
    '   M11 \u2014 Billing Engine',
    '   M12 \u2014 Notification Engine',
    '4. Workflow Stages',
    '5. User Roles & Permissions',
    '6. Deployment & Environment',
    '   6.1 Environment Variables',
    '   6.2 Deployment Steps',
    '   6.3 Rate Limits & Generation Caps',
    '7. Changelog',
]
for item in toc_items:
    doc.add_paragraph(item, style='List Bullet')

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 1. PLATFORM OVERVIEW
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('1. Platform Overview', level=1)

doc.add_paragraph(
    'SaleAnto is an AI-powered social media management platform that helps brands and agencies '
    'create, schedule, publish, and analyze content across all major social media platforms. '
    'The platform leverages Claude AI (Anthropic), OpenAI, and Google Gemini to generate '
    'captions, images, videos, voice content, and strategic recommendations \u2014 all from a single dashboard.'
)
doc.add_paragraph(
    'SaleAnto serves two primary audiences: individual brands managing their own social media presence '
    '(Self-Serve path), and marketing agencies managing content for multiple client brands (Agency path). '
    'The platform provides end-to-end content workflow management from strategy planning through publishing '
    'and performance analytics, with AI assistance at every stage.'
)
doc.add_paragraph(
    'The core value proposition is "AI-First Social Media Management" \u2014 where every content decision '
    'is informed by brand DNA analysis, competitor intelligence, trending topics, and historical '
    'performance data. This enables brands to produce on-brand, data-driven content at scale '
    'without requiring a large creative team.'
)

# 1.1 User Paths
doc.add_heading('1.1 User Paths', level=2)
doc.add_paragraph(
    'Self-Serve Path: Individual brands sign up, complete onboarding (brand name, industry, website URL), '
    'and the system auto-generates their Brand DNA by crawling their website. They can then create content, '
    'schedule posts, and track analytics \u2014 all managed within a single workspace with one brand.'
)
doc.add_paragraph(
    'Agency Path: Agencies create a workspace and add multiple brands. Each brand gets its own Brand DNA, '
    'content calendar, and analytics. Team members are assigned roles (Creator, Approver, Publisher, Viewer) '
    'with granular permissions. Content goes through an approval pipeline before publishing.'
)

add_table(
    ['Plan', 'Brands', 'Key Features', 'Price'],
    [
        ('Free', '1', 'Limited: 30 posts/mo, 50 captions, 10 images, 5 videos, basic analytics', '$0'),
        ('Starter', '2', '100 posts/mo, 200 captions, 50 images, 20 videos, full analytics', '$9/mo'),
        ('Pro', '5', '500 posts/mo, 1000 captions, 200 images, 100 videos, strategy hub', '$29/mo'),
        ('Business', '15', '2000 posts/mo, 5000 captions, 1000 images, 500 videos, messenger bot, team roles', '$79/mo'),
        ('Enterprise', '100', 'Unlimited posts/captions, 5000 images, 2000 videos, white-label, API access', '$199/mo'),
    ]
)

# 1.2 Current Status
doc.add_heading('1.2 Current Status', level=2)

add_table(
    ['Item', 'Status', 'Notes'],
    [
        ('Brand Manager (M1)', 'Live', 'Brand DNA auto-generation, workspace management, multi-brand support'),
        ('AI Image Engine (M2)', 'Live', 'OpenAI DALL-E 3, GPT-Image-1, Gemini Imagen \u2014 with logo/product overlay'),
        ('AI Copy Engine (M3)', 'Live', 'Claude AI-powered captions, hashtags, content ideas, strategy'),
        ('Calendar Planner (M4)', 'Live', 'Drag-drop calendar, best-time suggestions, bulk scheduling'),
        ('Social Connector (M5)', 'Live', 'Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest, Telegram'),
        ('Publisher Engine (M6)', 'Live', 'Multi-platform publishing with per-platform customization'),
        ('Analytics Engine (M7)', 'Live', 'Post-level metrics, weekly reports, engagement tracking'),
        ('Learning Engine (M8)', 'Live', 'Best hooks, best times, top topics, audience signals from analytics'),
        ('Overlay Engine (M9)', 'Live', 'Text copy overlay on generated images with brand fonts'),
        ('Export Engine (M10)', 'In Progress', 'Asset resizing for platform specs, bulk export'),
        ('Billing Engine (M11)', 'Live', 'Plan-based usage limits, subscription tier management'),
        ('Notification Engine (M12)', 'Live', 'In-app notifications for images ready, approval status, daily limits'),
        ('Messenger Bot', 'Live', 'Facebook Messenger AI chatbot with RAG knowledge base, e-commerce sync'),
        ('AI Video Generation', 'Live', 'Gemini-powered video generation with reference images'),
        ('AI Voice Generation', 'Live', 'OpenAI TTS with 6 voice options'),
        ('Prompt Engineering', 'Live', '9-layer prompt engineering for brand-aware image generation'),
        ('Approval Workflows', 'Live', 'Submit \u2192 Review \u2192 Approve/Reject/Request Changes pipeline'),
        ('RBAC', 'Live', 'Role-based access control: Owner, Admin, Creator, Approver, Publisher, Viewer'),
    ]
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 2. SYSTEM ARCHITECTURE
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('2. System Architecture', level=1)

# 2.1 Tech Stack
doc.add_heading('2.1 Tech Stack', level=2)

add_table(
    ['Layer', 'Technology', 'Version', 'Purpose'],
    [
        ('Backend Framework', 'Django', '4.2', 'Python web framework, ORM, admin'),
        ('API Framework', 'Django REST Framework', '3.14', 'RESTful API with serializers, viewsets'),
        ('Authentication', 'SimpleJWT', '5.5.1', 'JWT token auth with refresh rotation'),
        ('API Docs', 'drf-spectacular', '0.29.0', 'OpenAPI/Swagger schema generation'),
        ('Database', 'MySQL', '8.0+', 'Primary relational data store'),
        ('DB Driver', 'mysqlclient', '2.2.8', 'MySQL database connector'),
        ('Frontend Framework', 'React', '19.0', 'SPA with TypeScript'),
        ('Build Tool', 'Vite', '6.4.1', 'Fast HMR dev server and production bundler'),
        ('State Management', 'Zustand', '5.0', 'Lightweight state with persistence'),
        ('Routing', 'React Router', '7.13', 'Client-side routing'),
        ('Styling', 'Tailwind CSS', '3.4', 'Utility-first CSS framework'),
        ('Animation', 'Framer Motion', '12.34', 'React animation library'),
        ('HTTP Client', 'Axios', '1.13.5', 'HTTP requests with interceptors'),
        ('Forms', 'React Hook Form + Zod', '7.71', 'Form validation'),
        ('AI \u2014 Text/Brain', 'Anthropic Claude', 'Sonnet 4', 'Captions, strategy, analysis, content ideas'),
        ('AI \u2014 Image', 'OpenAI DALL-E / GPT-Image', '3 / 1', 'Image generation'),
        ('AI \u2014 Image Alt', 'Google Gemini', '2.0 Flash', 'Image + video generation'),
        ('AI \u2014 Voice', 'OpenAI TTS', 'tts-1 / tts-1-hd', 'Text-to-speech generation'),
        ('AI \u2014 Embeddings', 'Sentence Transformers', '5.0', 'RAG embeddings for messenger bot'),
        ('Vector Store', 'ChromaDB / FAISS', '1.0 / 1.11', 'Vector similarity search for RAG'),
        ('Static Files', 'WhiteNoise', '6.7.0', 'Serve static files in production'),
        ('CORS', 'django-cors-headers', '4.9.0', 'Cross-origin request handling'),
        ('Env Config', 'python-decouple', '3.8', 'Environment variable management'),
        ('Task Scheduling', 'APScheduler', '3.11', 'Background scheduled tasks'),
        ('Web Scraping', 'BeautifulSoup4 + Requests', '4.14 / 2.32', 'Brand DNA website crawling'),
        ('PDF Processing', 'PyMuPDF + pdfplumber', '1.27 / 0.11', 'PDF knowledge base for messenger bot'),
        ('Image Processing', 'Pillow', '10.3', 'Image manipulation, overlays, resizing'),
        ('Trends', 'pytrends', '4.9', 'Google Trends integration'),
    ]
)

# 2.2 Architecture Diagram
doc.add_heading('2.2 Architecture Diagram', level=2)
doc.add_paragraph(
    'The system follows a decoupled SPA architecture where the React frontend communicates '
    'with the Django REST API via HTTP/JSON. All AI operations are server-side.'
)
doc.add_paragraph(
    '\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n'
    '\u2502  React Frontend \u2502\u2500\u2500\u2500\u2500\u2502  Django REST API  \u2502\u2500\u2500\u2500\u2500\u2502   MySQL Database \u2502\n'
    '\u2502  (Vite + TS)    \u2502 JWT \u2502  (DRF + SimpleJWT) \u2502 ORM \u2502   (sellento)     \u2502\n'
    '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n'
    '                             \u2502\n'
    '              \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n'
    '              \u2502              \u2502              \u2502\n'
    '     \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2510  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2510  \u250C\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n'
    '     \u2502 Claude API \u2502  \u2502 OpenAI API \u2502  \u2502 Gemini API  \u2502\n'
    '     \u2502 (Text/AI)  \u2502  \u2502 (Image/TTS)\u2502  \u2502 (Image/Vid) \u2502\n'
    '     \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
    style='No Spacing'
)

# 2.3 Database Overview
doc.add_heading('2.3 Database Overview', level=2)

add_table(
    ['Table Name', 'Module', 'Purpose', 'Key Relations'],
    [
        ('auth_user', 'Core', 'Django built-in user model', 'has_one: user_profiles'),
        ('user_profiles', 'Accounts (M11)', 'Extended profile, subscription, usage limits', 'belongs_to: auth_user'),
        ('site_configuration', 'Accounts', 'Key-value site settings', '\u2014'),
        ('workspaces', 'Brands (M1)', 'Team workspace container', 'has_many: brands, members'),
        ('brands', 'Brands (M1)', 'Brand/company profile with DNA', 'belongs_to: workspace; has_many: assets, pillars'),
        ('brand_assets', 'Brands (M1)', 'Logos, colors, fonts', 'belongs_to: brand'),
        ('launch_plans', 'Brands (M1)', 'Posting frequency & format rules', 'belongs_to: brand'),
        ('brand_dna_history', 'Brands (M1)', 'Versioned brand DNA snapshots', 'belongs_to: brand'),
        ('brand_dna_chunks', 'Brands (M1)', 'RAG chunks for brand context', 'belongs_to: brand'),
        ('content_pillars', 'Brands (M1)', 'Content categories with % targets', 'belongs_to: brand'),
        ('competitor_profiles', 'Brands (M1)', 'Competitor tracking', 'belongs_to: brand'),
        ('trending_topics', 'Brands (M1)', 'Trending topic suggestions', 'belongs_to: brand'),
        ('content_ideas', 'Brands (M1)', 'AI-generated content ideas', 'belongs_to: brand'),
        ('content_approvals', 'Brands (M1)', 'Approval workflow records', 'belongs_to: brand'),
        ('weekly_reports', 'Brands (M1)', 'Weekly performance summaries', 'belongs_to: brand'),
        ('generation_usage', 'Brands (M1)', 'Daily generation counters', 'belongs_to: brand'),
        ('prompt_history', 'Brands (M1)', 'AI prompt usage history', 'belongs_to: brand'),
        ('workspace_members', 'Brands (M1)', 'User roles in workspaces', 'FK: workspace, user'),
        ('posts', 'Posts (M4/M6)', 'Social media posts with scheduling', 'belongs_to: user; FK: social accounts'),
        ('social_accounts', 'Platforms (M5)', 'Connected social media accounts', 'belongs_to: user'),
        ('caption_generations', 'AI Caption (M3)', 'Caption generation records', 'belongs_to: user'),
        ('caption_templates', 'AI Caption (M3)', 'Reusable caption templates', 'belongs_to: user'),
        ('saved_captions', 'AI Caption (M3)', 'User-saved favorite captions', 'belongs_to: user'),
        ('user_api_settings', 'AI Caption (M3)', 'Per-user API key storage', 'belongs_to: user'),
        ('image_generations', 'AI Image (M2)', 'Image generation records', 'belongs_to: user'),
        ('saved_images', 'AI Image (M2)', 'User-saved favorite images', 'belongs_to: user'),
        ('user_logos', 'AI Image (M2)', 'Uploaded brand logos for overlay', 'belongs_to: user'),
        ('prompt_templates', 'AI Image (M2)', 'Reusable image prompt templates', 'belongs_to: user'),
        ('user_image_settings', 'AI Image (M2)', 'Image generation preferences', 'belongs_to: user'),
        ('video_generations', 'AI Video', 'Video generation records', 'belongs_to: user'),
        ('saved_videos', 'AI Video', 'User-saved videos', 'belongs_to: user'),
        ('video_logos', 'AI Video', 'Video watermark logos', 'belongs_to: user'),
        ('video_prompt_templates', 'AI Video', 'Video prompt templates', 'belongs_to: user'),
        ('user_video_settings', 'AI Video', 'Video generation preferences', 'belongs_to: user'),
        ('voice_generations', 'AI Voice', 'Voice/TTS generation records', 'belongs_to: user'),
        ('user_voice_settings', 'AI Voice', 'Voice generation preferences', 'belongs_to: user'),
        ('messenger_connections', 'Messenger Bot', 'Facebook page connections', 'belongs_to: user'),
        ('ai_configurations', 'Messenger Bot', 'Bot AI settings per connection', 'belongs_to: connection'),
        ('conversations', 'Messenger Bot', 'User conversations', 'belongs_to: connection'),
        ('messages', 'Messenger Bot', 'Individual messages', 'belongs_to: conversation'),
        ('custom_prompts', 'Messenger Bot', 'Bot system prompts', 'belongs_to: connection'),
        ('pdf_knowledge_bases', 'Messenger Bot', 'RAG knowledge documents', 'belongs_to: connection'),
        ('ecommerce_settings', 'Messenger Bot', 'WooCommerce/Shopify config', 'belongs_to: connection'),
        ('products', 'Messenger Bot', 'Synced e-commerce products', 'belongs_to: ecommerce_settings'),
        ('notifications', 'Messenger Bot (M12)', 'In-app notification records', 'belongs_to: user'),
        ('analytics', 'Analytics (M7)', 'Post-level analytics metrics', 'belongs_to: post'),
        ('onboarding_progress', 'Onboarding', 'Onboarding step completion', 'belongs_to: user'),
    ]
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 3. MODULE DOCUMENTATION
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('3. Module Documentation', level=1)
doc.add_paragraph(
    'Each module is documented with: Purpose, How It Works, Dependencies, API Endpoints, '
    'Data Model, Error Handling, and Configuration.'
)

# ── M1 — Brand Manager ────────────────────────────────────────────────────
doc.add_heading('M1 \u2014 Brand Manager', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Brand Manager module is the foundation of SaleAnto. It manages workspaces (team containers), '
    'brands (company profiles), Brand DNA (AI-extracted identity), content pillars (topic categories), '
    'competitor profiles, launch plans, and content ideas. Every other module depends on Brand DNA '
    'to produce on-brand content. The module also handles workspace membership and role-based access.'
)

doc.add_heading('How It Works', level=3)
doc.add_paragraph('Step 1 \u2014 User registers and creates a workspace (auto-created during registration).')
doc.add_paragraph('Step 2 \u2014 User adds a brand with name, industry, website URL, and target region.')
doc.add_paragraph('Step 3 \u2014 System crawls the brand website (up to 5 pages) using BeautifulSoup.')
doc.add_paragraph('Step 4 \u2014 Claude AI analyzes the crawled content and extracts 15-field Brand DNA profile.')
doc.add_paragraph('Step 5 \u2014 Brand DNA is saved to the brand record and versioned in BrandDNAHistory.')
doc.add_paragraph('Step 6 \u2014 User can generate content pillars, track competitors, and create launch plans.')
doc.add_paragraph('Step 7 \u2014 Brand DNA is consumed by all AI modules for on-brand content generation.')

doc.add_heading('Dependencies', level=3)
add_table(
    ['Depends On', 'Type', 'What It Needs'],
    [
        ('Anthropic Claude API', 'External', 'Brand DNA extraction, content pillar generation, idea generation'),
        ('BeautifulSoup4 + Requests', 'External', 'Website crawling for brand DNA'),
        ('pytrends', 'External', 'Google Trends data for trending topics'),
        ('accounts (UserProfile)', 'Internal', 'User ownership and subscription limits'),
    ]
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('GET', '/api/v1/brands/', 'JWT', 'List all brands for the authenticated user'),
        ('POST', '/api/v1/brands/', 'JWT', 'Create a new brand'),
        ('GET', '/api/v1/brands/{id}/', 'JWT', 'Get brand details with DNA'),
        ('PUT', '/api/v1/brands/{id}/', 'JWT', 'Update brand info'),
        ('DELETE', '/api/v1/brands/{id}/', 'JWT', 'Delete a brand'),
        ('POST', '/api/v1/brands/{id}/generate-dna/', 'JWT', 'Generate Brand DNA from website'),
        ('POST', '/api/v1/brands/{id}/regenerate-dna-inputs/', 'JWT', 'Regenerate DNA from manual inputs'),
        ('GET', '/api/v1/brands/{id}/dna-history/', 'JWT', 'Get DNA version history'),
        ('POST', '/api/v1/brands/{id}/pillars/generate/', 'JWT', 'AI-generate content pillars'),
        ('GET', '/api/v1/brands/{id}/pillars/', 'JWT', 'List content pillars'),
        ('POST', '/api/v1/brands/{id}/pillars/', 'JWT', 'Create a content pillar'),
        ('PUT', '/api/v1/brands/{id}/pillars/{pid}/', 'JWT', 'Update a pillar'),
        ('DELETE', '/api/v1/brands/{id}/pillars/{pid}/', 'JWT', 'Delete a pillar'),
        ('GET', '/api/v1/brands/{id}/competitors/', 'JWT', 'List competitor profiles'),
        ('POST', '/api/v1/brands/{id}/competitors/', 'JWT', 'Add a competitor'),
        ('POST', '/api/v1/competitors/suggest/', 'JWT', 'AI-suggest competitors'),
        ('GET', '/api/v1/brands/{id}/trending/', 'JWT', 'Get trending topics for brand'),
        ('POST', '/api/v1/brands/{id}/trending/refresh/', 'JWT', 'Refresh trending topics'),
        ('POST', '/api/v1/ideas/generate/', 'JWT', 'Generate content ideas for brand'),
        ('GET', '/api/v1/ideas/', 'JWT', 'List saved content ideas'),
        ('GET', '/api/v1/workspace/', 'JWT', 'Get current workspace'),
        ('GET', '/api/v1/workspace/members/', 'JWT', 'List workspace members'),
        ('POST', '/api/v1/workspace/members/', 'JWT', 'Invite member to workspace'),
        ('PUT', '/api/v1/workspace/members/{id}/', 'JWT', 'Update member role'),
        ('DELETE', '/api/v1/workspace/members/{id}/', 'JWT', 'Remove workspace member'),
    ]
)

doc.add_heading('Data Model', level=3)

doc.add_paragraph('Workspace', style='Heading 4') if doc.styles.get_by_id else doc.add_paragraph('Table: workspaces').bold
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('id', 'AutoField (PK)', 'No', 'Primary key'),
        ('name', 'CharField(200)', 'No', 'Workspace name'),
        ('owner', 'FK \u2192 User', 'No', 'Workspace owner'),
        ('slug', 'SlugField(200)', 'No', 'URL-safe slug, unique'),
        ('description', 'TextField', 'Yes', 'Workspace description'),
        ('logo', 'ImageField', 'Yes', 'Workspace logo'),
        ('plan', 'CharField(20)', 'No', 'Subscription plan (free/starter/pro/business/enterprise)'),
        ('is_active', 'BooleanField', 'No', 'Whether workspace is active (default True)'),
        ('created_at', 'DateTimeField', 'No', 'Auto-set on creation'),
        ('updated_at', 'DateTimeField', 'No', 'Auto-set on save'),
    ]
)

doc.add_paragraph('Brand')
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('id', 'AutoField (PK)', 'No', 'Primary key'),
        ('workspace', 'FK \u2192 Workspace', 'Yes', 'Parent workspace'),
        ('user', 'FK \u2192 User', 'No', 'Brand owner'),
        ('name', 'CharField(200)', 'No', 'Brand name'),
        ('industry', 'CharField(100)', 'Yes', 'Industry vertical'),
        ('website_url', 'URLField', 'Yes', 'Brand website for DNA crawl'),
        ('target_region', 'CharField(100)', 'Yes', 'Geographic target'),
        ('description', 'TextField', 'Yes', 'Brand description'),
        ('voice_tone', 'CharField(100)', 'Yes', 'Brand voice (professional, casual, etc.)'),
        ('brand_dna', 'JSONField', 'Yes', '15-field Brand DNA profile'),
        ('brand_dna_generated_at', 'DateTimeField', 'Yes', 'When DNA was last generated'),
        ('brand_dna_source', 'CharField(50)', 'Yes', 'Source: website, manual, hybrid'),
        ('products_services', 'TextField', 'Yes', 'Comma-separated products/services'),
        ('goals', 'JSONField', 'Yes', 'Brand goals'),
        ('target_audience', 'JSONField', 'Yes', 'Target audience details'),
        ('competitors', 'JSONField', 'Yes', 'Competitor data'),
        ('do_rules', 'TextField', 'Yes', 'Content rules: things to do'),
        ('dont_rules', 'TextField', 'Yes', 'Content rules: things to avoid'),
        ('logo', 'ImageField', 'Yes', 'Brand logo'),
        ('is_active', 'BooleanField', 'No', 'Active status (default True)'),
        ('created_at', 'DateTimeField', 'No', 'Auto-set on creation'),
        ('updated_at', 'DateTimeField', 'No', 'Auto-set on save'),
    ]
)

doc.add_heading('Error Handling', level=3)
add_table(
    ['Error Code', 'HTTP Status', 'Trigger', 'User Message'],
    [
        ('BRAND_NOT_FOUND', '404', 'Invalid brand_id or no permission', 'Brand not found'),
        ('WEBSITE_CRAWL_FAILED', '400', 'Cannot read brand website', 'Could not read website: {error}'),
        ('DNA_GENERATION_FAILED', '400', 'Claude API error during DNA gen', 'Failed to generate Brand DNA'),
        ('NO_API_KEY', '400', 'ANTHROPIC_API_KEY not configured', 'No AI API key configured'),
        ('WORKSPACE_NOT_FOUND', '404', 'Invalid workspace', 'Workspace not found'),
        ('PERMISSION_DENIED', '403', 'User lacks workspace role', 'You do not have permission'),
    ]
)

doc.add_heading('Configuration', level=3)
add_table(
    ['Variable', 'Required', 'Default', 'Description'],
    [
        ('ANTHROPIC_API_KEY', 'Yes', '\u2014', 'Claude API key for DNA generation and AI features'),
    ]
)

doc.add_page_break()

# ── M2 — AI Image Engine ──────────────────────────────────────────────────
doc.add_heading('M2 \u2014 AI Image Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The AI Image Engine generates social media images using OpenAI (DALL-E 3, GPT-Image-1) and '
    'Google Gemini (Imagen). It supports logo overlay, product image references, brand-aware 9-layer '
    'prompt engineering, image diagnosis for failed generations, and automatic reprompting. '
    'Generated images are stored on the server and can be saved to user favorites.'
)

doc.add_heading('How It Works', level=3)
doc.add_paragraph('Step 1 \u2014 User enters a prompt and selects provider (OpenAI/Gemini), size, and quality.')
doc.add_paragraph('Step 2 \u2014 If brand context available, 9-layer prompt engineering enhances the prompt.')
doc.add_paragraph('Step 3 \u2014 System calls the selected AI provider API (DALL-E 3 / GPT-Image-1 / Gemini Imagen).')
doc.add_paragraph('Step 4 \u2014 Generated image is downloaded and saved to media/generated_images/.')
doc.add_paragraph('Step 5 \u2014 If logo overlay requested, Pillow composites the logo onto the image.')
doc.add_paragraph('Step 6 \u2014 ImageGeneration record is saved with metadata (prompt, provider, settings).')
doc.add_paragraph('Step 7 \u2014 If generation fails, user can diagnose with Claude AI and auto-reprompt.')

doc.add_heading('Dependencies', level=3)
add_table(
    ['Depends On', 'Type', 'What It Needs'],
    [
        ('OpenAI API', 'External', 'DALL-E 3, GPT-Image-1 image generation'),
        ('Google Gemini API', 'External', 'Imagen image generation'),
        ('Anthropic Claude API', 'External', 'Prompt engineering, diagnosis, reprompting'),
        ('Pillow', 'Library', 'Image processing, logo overlay, resizing'),
        ('M1 \u2014 Brand Manager', 'Internal', 'Brand DNA for prompt engineering context'),
    ]
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('POST', '/api/v1/images/generate/', 'JWT', 'Generate image with AI'),
        ('GET', '/api/v1/images/', 'JWT', 'List generated images'),
        ('GET', '/api/v1/images/{id}/', 'JWT', 'Get image details'),
        ('DELETE', '/api/v1/images/{id}/', 'JWT', 'Delete generated image'),
        ('POST', '/api/v1/images/{id}/save/', 'JWT', 'Save image to favorites'),
        ('GET', '/api/v1/images/saved/', 'JWT', 'List saved images'),
        ('POST', '/api/v1/images/logos/upload/', 'JWT', 'Upload brand logo'),
        ('GET', '/api/v1/images/logos/', 'JWT', 'List uploaded logos'),
        ('DELETE', '/api/v1/images/logos/{id}/', 'JWT', 'Delete a logo'),
        ('GET', '/api/v1/images/templates/', 'JWT', 'List prompt templates'),
        ('POST', '/api/v1/images/templates/', 'JWT', 'Save prompt template'),
        ('GET', '/api/v1/images/settings/', 'JWT', 'Get image generation settings'),
        ('PUT', '/api/v1/images/settings/', 'JWT', 'Update generation settings'),
        ('POST', '/api/v1/prompt-engineer/generate/', 'JWT', '9-layer prompt engineering'),
        ('POST', '/api/v1/prompt-engineer/diagnose/', 'JWT', 'Diagnose failed image'),
        ('POST', '/api/v1/prompt-engineer/reprompt/', 'JWT', 'Auto-fix and reprompt'),
        ('POST', '/api/v1/drafts/generate-asset/', 'JWT', 'Generate image for a draft post'),
    ]
)

doc.add_heading('Data Model', level=3)
doc.add_paragraph('ImageGeneration')
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('id', 'AutoField (PK)', 'No', 'Primary key'),
        ('user', 'FK \u2192 User', 'No', 'Owner'),
        ('prompt', 'TextField', 'No', 'Generation prompt'),
        ('revised_prompt', 'TextField', 'Yes', 'AI-revised prompt'),
        ('provider', 'CharField(20)', 'No', 'openai / gemini'),
        ('model', 'CharField(50)', 'Yes', 'Specific model used'),
        ('size', 'CharField(20)', 'No', 'Image dimensions'),
        ('quality', 'CharField(20)', 'No', 'standard / hd'),
        ('style', 'CharField(20)', 'Yes', 'vivid / natural'),
        ('image', 'ImageField', 'Yes', 'Generated image file'),
        ('image_url', 'URLField', 'Yes', 'External URL if applicable'),
        ('logo_overlay', 'BooleanField', 'No', 'Whether logo was overlaid'),
        ('logo_position', 'CharField(20)', 'Yes', 'Logo position (bottom-right, etc.)'),
        ('product_image', 'ImageField', 'Yes', 'Reference product image'),
        ('brand_style_anchor', 'TextField', 'Yes', 'Brand visual DNA summary'),
        ('prompt_engineering_used', 'BooleanField', 'No', '9-layer prompt engineering flag'),
        ('failure_codes', 'JSONField', 'Yes', 'Failure taxonomy codes'),
        ('reprompt_attempt', 'IntegerField', 'No', 'Retry attempt number (max 3)'),
        ('status', 'CharField(20)', 'No', 'pending / completed / failed'),
        ('error_message', 'TextField', 'Yes', 'Error details if failed'),
        ('generation_time', 'FloatField', 'Yes', 'Time taken in seconds'),
        ('created_at', 'DateTimeField', 'No', 'Auto-set on creation'),
    ]
)

doc.add_heading('Error Handling', level=3)
add_table(
    ['Error Code', 'HTTP Status', 'Trigger', 'User Message'],
    [
        ('NO_API_KEY', '400', 'OpenAI/Gemini key not configured', 'No API key for image generation'),
        ('GENERATION_FAILED', '500', 'AI provider error/timeout', 'Image generation failed'),
        ('INVALID_SIZE', '400', 'Unsupported image dimensions', 'Invalid image size'),
        ('QUOTA_EXCEEDED', '429', 'Daily generation limit reached', 'Daily image limit exceeded'),
        ('CONTENT_POLICY', '400', 'AI content policy violation', 'Prompt violates content policy'),
    ]
)

doc.add_heading('Configuration', level=3)
add_table(
    ['Variable', 'Required', 'Default', 'Description'],
    [
        ('OPENAI_API_KEY', 'Yes*', '\u2014', 'OpenAI key for DALL-E / GPT-Image (* or Gemini key)'),
        ('GEMINI_API_KEY', 'Yes*', '\u2014', 'Gemini key for Imagen (* or OpenAI key)'),
        ('ANTHROPIC_API_KEY', 'Optional', '\u2014', 'Claude key for prompt engineering/diagnosis'),
    ]
)

doc.add_page_break()

# ── M3 — AI Copy Engine ───────────────────────────────────────────────────
doc.add_heading('M3 \u2014 AI Copy Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The AI Copy Engine generates social media captions, hashtags, content ideas, and text content '
    'using Claude AI as the primary provider (with OpenAI/Gemini fallback). It supports platform-specific '
    'caption generation, tone/length controls, Brand DNA context injection, caption templates, '
    'and variant generation for A/B testing. This is the core text AI module.'
)

doc.add_heading('How It Works', level=3)
doc.add_paragraph('Step 1 \u2014 User provides a topic/prompt, selects platform, tone, and length.')
doc.add_paragraph('Step 2 \u2014 System loads Brand DNA and injects it as context into the AI prompt.')
doc.add_paragraph('Step 3 \u2014 UnifiedLLMService routes to Claude (preferred) or fallback provider.')
doc.add_paragraph('Step 4 \u2014 AI generates caption with hashtags, emojis, and CTA appropriate for the platform.')
doc.add_paragraph('Step 5 \u2014 Result is saved as CaptionGeneration record.')
doc.add_paragraph('Step 6 \u2014 User can save favorites, generate variants, or use as post caption.')

doc.add_heading('Dependencies', level=3)
add_table(
    ['Depends On', 'Type', 'What It Needs'],
    [
        ('Anthropic Claude API', 'External', 'Primary text generation provider'),
        ('OpenAI API', 'External', 'Fallback text generation'),
        ('Google Gemini API', 'External', 'Fallback text generation'),
        ('M1 \u2014 Brand Manager', 'Internal', 'Brand DNA for context-aware generation'),
        ('UnifiedLLMService', 'Internal', 'Provider routing with fallback chain'),
    ]
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('POST', '/api/v1/captions/generate/', 'JWT', 'Generate AI caption'),
        ('GET', '/api/v1/captions/', 'JWT', 'List generated captions'),
        ('GET', '/api/v1/captions/{id}/', 'JWT', 'Get caption details'),
        ('DELETE', '/api/v1/captions/{id}/', 'JWT', 'Delete caption'),
        ('POST', '/api/v1/captions/{id}/save/', 'JWT', 'Save caption to favorites'),
        ('GET', '/api/v1/captions/saved/', 'JWT', 'List saved captions'),
        ('GET', '/api/v1/captions/templates/', 'JWT', 'List caption templates'),
        ('POST', '/api/v1/captions/templates/', 'JWT', 'Create caption template'),
        ('POST', '/api/v1/captions/draft/', 'JWT', 'Generate draft caption with variants'),
        ('POST', '/api/v1/captions/adapt/', 'JWT', 'Adapt caption for different platform'),
        ('POST', '/api/v1/hashtags/suggest/', 'JWT', 'AI-suggest hashtags'),
        ('GET', '/api/v1/hashtags/groups/', 'JWT', 'List hashtag groups'),
        ('POST', '/api/v1/hashtags/groups/', 'JWT', 'Create hashtag group'),
        ('GET', '/api/v1/hashtags/banned/', 'JWT', 'List banned hashtags'),
        ('POST', '/api/v1/hashtags/banned/', 'JWT', 'Add banned hashtag'),
    ]
)

doc.add_heading('Data Model', level=3)
doc.add_paragraph('CaptionGeneration')
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('id', 'AutoField (PK)', 'No', 'Primary key'),
        ('user', 'FK \u2192 User', 'No', 'Owner'),
        ('prompt', 'TextField', 'No', 'User input prompt'),
        ('caption', 'TextField', 'No', 'Generated caption text'),
        ('platform', 'CharField(50)', 'Yes', 'Target platform'),
        ('tone', 'CharField(50)', 'Yes', 'Tone: professional, casual, humorous, etc.'),
        ('length', 'CharField(20)', 'Yes', 'short / medium / long'),
        ('model', 'CharField(50)', 'Yes', 'AI model used'),
        ('provider', 'CharField(20)', 'Yes', 'claude / openai / gemini'),
        ('tokens_used', 'IntegerField', 'Yes', 'Token consumption'),
        ('created_at', 'DateTimeField', 'No', 'Auto-set'),
    ]
)

doc.add_heading('Error Handling', level=3)
add_table(
    ['Error Code', 'HTTP Status', 'Trigger', 'User Message'],
    [
        ('NO_API_KEY', '400', 'No AI API key configured', 'No AI API key configured. Please contact the administrator.'),
        ('GENERATION_FAILED', '400', 'AI provider returned error', 'Caption generation failed: {error}'),
        ('QUOTA_EXCEEDED', '429', 'Daily caption limit reached', 'Daily caption limit exceeded'),
    ]
)

doc.add_page_break()

# ── M4 — Calendar Planner ─────────────────────────────────────────────────
doc.add_heading('M4 \u2014 Calendar Planner', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Calendar Planner manages post scheduling with a visual calendar interface. It provides '
    'best-time suggestions based on platform-specific engagement data, bulk scheduling, '
    'drag-and-drop rescheduling, and conflict detection for overlapping posts.'
)

doc.add_heading('How It Works', level=3)
doc.add_paragraph('Step 1 \u2014 User creates a post draft and selects "Schedule".')
doc.add_paragraph('Step 2 \u2014 System suggests optimal posting times using AI analysis of engagement data.')
doc.add_paragraph('Step 3 \u2014 User picks a date/time or accepts the suggestion.')
doc.add_paragraph('Step 4 \u2014 APScheduler background job checks every minute for posts due to publish.')
doc.add_paragraph('Step 5 \u2014 Calendar view shows all scheduled, published, and draft posts.')

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('GET', '/api/v1/calendar/', 'JWT', 'Get calendar view (month/week/day)'),
        ('POST', '/api/v1/drafts/{id}/schedule/', 'JWT', 'Schedule a draft for publishing'),
        ('PUT', '/api/v1/drafts/{id}/reschedule/', 'JWT', 'Reschedule a post'),
        ('POST', '/api/v1/schedule/compute-times/', 'JWT', 'AI-suggest best posting times'),
        ('GET', '/api/v1/schedule/conflicts/', 'JWT', 'Check scheduling conflicts'),
    ]
)

doc.add_page_break()

# ── M5 — Social Connector ─────────────────────────────────────────────────
doc.add_heading('M5 \u2014 Social Connector', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Social Connector module handles OAuth-based authentication with social media platforms. '
    'It stores platform credentials, manages token refresh, and provides the publishing '
    'infrastructure for all supported platforms: Facebook, Instagram, Twitter/X, LinkedIn, '
    'TikTok, YouTube, Pinterest, and Telegram.'
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('GET', '/api/v1/social-accounts/', 'JWT', 'List connected accounts'),
        ('POST', '/api/v1/social-accounts/', 'JWT', 'Connect a new social account'),
        ('DELETE', '/api/v1/social-accounts/{id}/', 'JWT', 'Disconnect account'),
        ('POST', '/api/v1/social-accounts/{id}/refresh/', 'JWT', 'Refresh OAuth token'),
        ('GET', '/api/v1/social-accounts/{id}/validate/', 'JWT', 'Validate account is active'),
    ]
)

doc.add_heading('Data Model', level=3)
doc.add_paragraph('SocialAccount')
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('id', 'AutoField (PK)', 'No', 'Primary key'),
        ('user', 'FK \u2192 User', 'No', 'Account owner'),
        ('platform', 'CharField(50)', 'No', 'facebook/twitter/instagram/linkedin/tiktok/youtube/pinterest/telegram'),
        ('platform_user_id', 'CharField(200)', 'Yes', 'Platform-specific user ID'),
        ('username', 'CharField(200)', 'Yes', 'Platform username'),
        ('display_name', 'CharField(200)', 'Yes', 'Display name on platform'),
        ('access_token', 'TextField', 'Yes', 'OAuth access token (encrypted)'),
        ('refresh_token', 'TextField', 'Yes', 'OAuth refresh token'),
        ('token_expires_at', 'DateTimeField', 'Yes', 'Token expiration'),
        ('profile_image_url', 'URLField', 'Yes', 'Platform profile picture'),
        ('platform_data', 'TextField', 'No', 'JSON: page_id, API keys, etc.'),
        ('status', 'CharField(20)', 'No', 'active / expired / revoked'),
        ('is_active', 'BooleanField', 'No', 'Active status'),
        ('connected_at', 'DateTimeField', 'No', 'When connected'),
        ('last_used_at', 'DateTimeField', 'Yes', 'Last publish time'),
    ]
)

doc.add_page_break()

# ── M6 — Publisher Engine ──────────────────────────────────────────────────
doc.add_heading('M6 \u2014 Publisher Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Publisher Engine handles the actual posting of content to social media platforms. '
    'It manages multi-platform publishing (same post to multiple accounts), per-platform '
    'content customization, media attachments, and publish status tracking. Posts can be '
    'published immediately or via the scheduler.'
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('POST', '/api/v1/posts/', 'JWT', 'Create and optionally publish a post'),
        ('GET', '/api/v1/posts/', 'JWT', 'List all posts with filters'),
        ('GET', '/api/v1/posts/{id}/', 'JWT', 'Get post details'),
        ('PUT', '/api/v1/posts/{id}/', 'JWT', 'Update post'),
        ('DELETE', '/api/v1/posts/{id}/', 'JWT', 'Delete post'),
        ('POST', '/api/v1/posts/{id}/publish/', 'JWT', 'Publish immediately'),
        ('POST', '/api/v1/posts/{id}/clone/', 'JWT', 'Clone post as draft'),
        ('GET', '/api/v1/posts/count-by-status/', 'JWT', 'Get post counts by status'),
    ]
)

doc.add_heading('Data Model', level=3)
doc.add_paragraph('Post')
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('id', 'AutoField (PK)', 'No', 'Primary key'),
        ('user', 'FK \u2192 User', 'No', 'Post owner'),
        ('content', 'TextField', 'No', 'Post text content'),
        ('media', 'FileField', 'Yes', 'Attached media file'),
        ('media_url', 'URLField', 'Yes', 'External media URL'),
        ('platforms', 'JSONField', 'No', 'Target platforms list'),
        ('social_accounts', 'M2M \u2192 SocialAccount', '\u2014', 'Target accounts'),
        ('status', 'CharField(20)', 'No', 'draft/pending_approval/approved/scheduled/posting/posted/failed'),
        ('scheduled_time', 'DateTimeField', 'Yes', 'When to publish'),
        ('published_at', 'DateTimeField', 'Yes', 'Actual publish time'),
        ('platform_post_ids', 'JSONField', 'Yes', 'Platform-specific post IDs after publishing'),
        ('platform_errors', 'JSONField', 'Yes', 'Per-platform error messages'),
        ('hashtags', 'TextField', 'Yes', 'Post hashtags'),
        ('caption_generation', 'FK \u2192 CaptionGeneration', 'Yes', 'Source caption'),
        ('image_generation', 'FK \u2192 ImageGeneration', 'Yes', 'Source image'),
        ('created_at', 'DateTimeField', 'No', 'Auto-set'),
        ('updated_at', 'DateTimeField', 'No', 'Auto-set'),
    ]
)

doc.add_page_break()

# ── M7 — Analytics Engine ─────────────────────────────────────────────────
doc.add_heading('M7 \u2014 Analytics Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Analytics Engine tracks post performance across all connected platforms. It collects '
    'metrics (likes, comments, shares, views, clicks), generates weekly performance reports, '
    'and provides aggregated analytics dashboards. Data is synced from platforms via management commands.'
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('GET', '/api/v1/analytics/summary/', 'JWT', 'Analytics overview (total posts, engagement, growth)'),
        ('GET', '/api/v1/analytics/dashboard/', 'JWT', 'Dashboard analytics with trends'),
        ('GET', '/api/v1/posts/{id}/stats/', 'JWT', 'Per-post performance metrics'),
        ('GET', '/api/v1/posts/{id}/comments/', 'JWT', 'Post comments with sentiment'),
        ('POST', '/api/v1/posts/{id}/comments/{cid}/reply/', 'JWT', 'AI-reply to a comment'),
        ('GET', '/api/v1/analytics/weekly-report/', 'JWT', 'Get latest weekly report'),
        ('POST', '/api/v1/analytics/weekly-report/generate/', 'JWT', 'Force-generate weekly report'),
        ('GET', '/api/v1/analytics/learning-signals/', 'JWT', 'Get AI learning signals'),
    ]
)

doc.add_page_break()

# ── M8 — Learning Engine ──────────────────────────────────────────────────
doc.add_heading('M8 \u2014 Learning Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Learning Engine analyzes post performance data to extract actionable insights. It identifies '
    'best-performing hooks, optimal posting times, top content topics, and audience preferences. '
    'These "learning signals" feed back into AI generation to continuously improve content quality.'
)

doc.add_heading('How It Works', level=3)
doc.add_paragraph('Step 1 \u2014 Analytics data is synced from social platforms via sync_analytics command.')
doc.add_paragraph('Step 2 \u2014 Claude AI analyzes engagement patterns across all posts.')
doc.add_paragraph('Step 3 \u2014 System extracts learning signals: best_hook, best_time, best_topic, audience_signal.')
doc.add_paragraph('Step 4 \u2014 Weekly report summarizes top/bottom performing posts with explanations.')
doc.add_paragraph('Step 5 \u2014 Insights are injected into future AI prompts for improved generation.')

doc.add_page_break()

# ── M9 — Overlay Engine ───────────────────────────────────────────────────
doc.add_heading('M9 \u2014 Overlay Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Overlay Engine adds text copy (headlines, CTAs, taglines) to AI-generated images. '
    'It uses Pillow for image manipulation with support for custom fonts (Bebas Neue, Montserrat, '
    'Playfair Display, Roboto), text positioning, color customization, and semi-transparent backgrounds.'
)

doc.add_heading('How It Works', level=3)
doc.add_paragraph('Step 1 \u2014 User selects a generated image and clicks "Add Copy".')
doc.add_paragraph('Step 2 \u2014 Claude AI generates copy suggestions based on brand DNA and image prompt.')
doc.add_paragraph('Step 3 \u2014 User selects headline, subtext, CTA, font, and colors.')
doc.add_paragraph('Step 4 \u2014 Pillow renders text onto the image with proper positioning and background.')
doc.add_paragraph('Step 5 \u2014 Overlaid image is saved as a new file.')

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('POST', '/api/v1/images/{id}/generate-copy/', 'JWT', 'AI-generate copy suggestions for image'),
        ('POST', '/api/v1/images/{id}/apply-overlay/', 'JWT', 'Apply text overlay to image'),
    ]
)

doc.add_page_break()

# ── M10 — Export Engine ────────────────────────────────────────────────────
doc.add_heading('M10 \u2014 Export Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Export Engine handles asset resizing for platform-specific dimensions, bulk asset '
    'management, and creative template management. It ensures generated images meet the '
    'dimension requirements of each social platform (Instagram square, Story 9:16, Facebook landscape, etc.).'
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('POST', '/api/v1/creative/resize/', 'JWT', 'Resize asset for platform specs'),
        ('GET', '/api/v1/creative/templates/', 'JWT', 'List creative templates'),
        ('POST', '/api/v1/creative/templates/', 'JWT', 'Save creative template'),
    ]
)

doc.add_page_break()

# ── M11 — Billing Engine ──────────────────────────────────────────────────
doc.add_heading('M11 \u2014 Billing Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Billing Engine manages subscription plans and usage limits. It tracks daily generation '
    'counts (posts, captions, images, videos) against plan-based quotas. Admin can override '
    'user plans. The system enforces limits before every generation and warns at 80% usage.'
)

doc.add_heading('Plan Limits', level=3)
add_table(
    ['Resource', 'Free', 'Starter', 'Pro', 'Business', 'Enterprise'],
    [
        ('Posts/month', '30', '100', '500', '2000', 'Unlimited'),
        ('Captions/month', '50', '200', '1000', '5000', 'Unlimited'),
        ('Images/month', '10', '50', '200', '1000', '5000'),
        ('Videos/month', '5', '20', '100', '500', '2000'),
        ('Messenger messages', '0', '0', '500', '5000', 'Unlimited'),
        ('Brands', '1', '2', '5', '15', '100'),
        ('Workspace members', '1', '2', '5', '15', 'Unlimited'),
    ]
)

doc.add_heading('Data Model', level=3)
doc.add_paragraph('UserProfile (subscription fields)')
add_table(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
        ('subscription_plan', 'CharField(20)', 'No', 'free/starter/pro/business/enterprise'),
        ('max_posts_per_month', 'IntegerField', 'No', 'Monthly post limit'),
        ('max_captions_per_month', 'IntegerField', 'No', 'Monthly caption limit'),
        ('max_images_per_month', 'IntegerField', 'No', 'Monthly image limit'),
        ('max_videos_per_month', 'IntegerField', 'No', 'Monthly video limit'),
        ('max_messenger_messages', 'IntegerField', 'No', 'Monthly messenger message limit'),
        ('posts_this_month', 'IntegerField', 'No', 'Current month usage counter'),
        ('captions_this_month', 'IntegerField', 'No', 'Current month usage counter'),
        ('images_this_month', 'IntegerField', 'No', 'Current month usage counter'),
        ('videos_this_month', 'IntegerField', 'No', 'Current month usage counter'),
        ('total_tokens_used', 'BigIntegerField', 'No', 'Lifetime AI token consumption'),
    ]
)

doc.add_page_break()

# ── M12 — Notification Engine ─────────────────────────────────────────────
doc.add_heading('M12 \u2014 Notification Engine', level=2)

doc.add_heading('Purpose', level=3)
doc.add_paragraph(
    'The Notification Engine sends in-app notifications for key events: image generation complete, '
    'approval status changes, daily usage limit warnings, weekly report availability, and post '
    'publish success/failure. Notifications are stored in the database and surfaced via the '
    'NotificationCenter component in the frontend.'
)

doc.add_heading('API Endpoints', level=3)
add_table(
    ['Method', 'Endpoint', 'Auth', 'Description'],
    [
        ('GET', '/api/v1/notifications/', 'JWT', 'List user notifications'),
        ('POST', '/api/v1/notifications/{id}/read/', 'JWT', 'Mark notification as read'),
        ('POST', '/api/v1/notifications/read-all/', 'JWT', 'Mark all as read'),
        ('GET', '/api/v1/notifications/unread-count/', 'JWT', 'Get unread notification count'),
    ]
)

doc.add_heading('Notification Types', level=3)
add_table(
    ['Type', 'Trigger', 'Message Example'],
    [
        ('images_ready', 'Image generation completes', 'Your images are ready! View them now.'),
        ('daily_limit_warning', 'Usage reaches 80% of limit', 'You have used 80% of your daily image limit.'),
        ('approval_submitted', 'Post submitted for approval', 'A new post has been submitted for review.'),
        ('approval_approved', 'Post approved', 'Your post has been approved and is ready to publish.'),
        ('approval_rejected', 'Post rejected', 'Your post was rejected. Please review the feedback.'),
        ('weekly_report', 'Weekly report generated', 'Your weekly performance report is ready.'),
        ('post_published', 'Post successfully published', 'Your post was published to Facebook, Twitter.'),
        ('post_failed', 'Post publishing failed', 'Failed to publish to Instagram: token expired.'),
    ]
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 4. WORKFLOW STAGES
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('4. Workflow Stages', level=1)

add_table(
    ['#', 'Stage', 'User Action', 'System Response', 'Modules'],
    [
        ('1', 'Strategy Setup',
         'User creates brand, provides website URL, defines industry and target audience.',
         'System crawls website, generates 15-field Brand DNA using Claude AI, creates workspace.',
         'M1'),
        ('2', 'Idea Generation',
         'User requests content ideas for a brand, optionally specifies topic or pillar.',
         'Claude AI generates 5-10 content ideas based on Brand DNA, trending topics, and competitor analysis.',
         'M1, M3, M8'),
        ('3', 'Draft Creation',
         'User selects an idea and creates a post draft with target platforms.',
         'System pre-fills draft with AI-generated caption and suggests images/videos.',
         'M3, M6'),
        ('4', 'Caption Generation',
         'User generates AI captions specifying tone, length, and platform.',
         'Claude AI generates platform-specific captions with hashtags, emojis, and CTAs using Brand DNA.',
         'M3'),
        ('5', 'Hashtag Engine',
         'User requests hashtag suggestions or selects from groups.',
         'AI suggests relevant hashtags, filters banned tags, groups by campaign.',
         'M3'),
        ('6', 'Creative Assets',
         'User generates images/videos, adds logo overlay, applies text copy.',
         'AI generates images (DALL-E/Gemini), overlays logos and text, resizes for platforms.',
         'M2, M9, M10'),
        ('7', 'Approval Pipeline',
         'Creator submits draft for review. Approver reviews and approves/rejects.',
         'System tracks approval status, notifies relevant team members, enforces workflow.',
         'M12'),
        ('8', 'Schedule & Publish',
         'User selects posting time or accepts AI suggestion, publishes to platforms.',
         'Scheduler queues post, publishes at optimal time, tracks per-platform status.',
         'M4, M5, M6'),
        ('9', 'Analytics',
         'User views post performance, engagement metrics, weekly reports.',
         'System syncs analytics from platforms, generates weekly reports with Claude analysis.',
         'M7'),
        ('10', 'Learning Loop',
         'System automatically analyzes top-performing content.',
         'AI extracts learning signals (best hooks, times, topics) and feeds into future generations.',
         'M8'),
    ]
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 5. USER ROLES & PERMISSIONS
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('5. User Roles & Permissions', level=1)

doc.add_paragraph(
    'SaleAnto uses Role-Based Access Control (RBAC) at the workspace level. Each workspace member '
    'is assigned a role that determines their permissions. Roles are managed through the '
    'workspace settings by the Owner or Admin.'
)

add_table(
    ['Role', 'Create Content', 'Approve Content', 'Publish', 'View Analytics', 'Admin Settings'],
    [
        ('Owner', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'),
        ('Admin', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'),
        ('Creator', 'Yes', 'No', 'No', 'Own posts only', 'No'),
        ('Approver', 'No', 'Yes', 'No', 'Yes', 'No'),
        ('Publisher', 'No', 'No', 'Yes', 'Yes', 'No'),
        ('Viewer', 'No', 'No', 'No', 'Yes', 'No'),
    ]
)

doc.add_paragraph(
    'Owner: Full access. Can manage workspace settings, billing, member roles, and all content operations. '
    'Automatically assigned to the workspace creator.'
)
doc.add_paragraph(
    'Admin: Same as Owner except cannot delete the workspace or change ownership.'
)
doc.add_paragraph(
    'Creator: Can create and edit posts, generate AI content, but cannot publish or approve. '
    'Submits content for approval.'
)
doc.add_paragraph(
    'Approver: Can review submitted content and approve, reject, or request changes. '
    'Cannot create or publish content.'
)
doc.add_paragraph(
    'Publisher: Can take approved content and schedule/publish it to platforms. Cannot create or approve.'
)
doc.add_paragraph(
    'Viewer: Read-only access to analytics and published content. Cannot modify anything.'
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 6. DEPLOYMENT & ENVIRONMENT
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('6. Deployment & Environment', level=1)

# 6.1 Environment Variables
doc.add_heading('6.1 Environment Variables', level=2)

add_table(
    ['Variable', 'Required', 'Module', 'Description'],
    [
        ('DJANGO_SECRET_KEY', 'Yes', 'Core', 'Django secret key for cryptographic signing'),
        ('DJANGO_DEBUG', 'Yes', 'Core', 'Debug mode (True/False). Must be False in production'),
        ('ALLOWED_HOSTS', 'Yes', 'Core', 'Comma-separated allowed hostnames'),
        ('DB_NAME', 'Yes', 'Core', 'MySQL database name (default: sellento)'),
        ('DB_USER', 'Yes', 'Core', 'MySQL database user (default: root)'),
        ('DB_PASSWORD', 'Yes', 'Core', 'MySQL database password'),
        ('DB_HOST', 'Yes', 'Core', 'MySQL host (default: localhost)'),
        ('DB_PORT', 'Yes', 'Core', 'MySQL port (default: 3306)'),
        ('ANTHROPIC_API_KEY', 'Yes', 'M1, M3, M8', 'Claude API key for all text AI features'),
        ('OPENAI_API_KEY', 'Optional', 'M2, Voice', 'OpenAI key for DALL-E, GPT-Image, TTS (fallback for text)'),
        ('GEMINI_API_KEY', 'Optional', 'M2, Video', 'Gemini key for Imagen, video generation (fallback for text)'),
        ('TIME_ZONE', 'No', 'Core', 'Server timezone (default: UTC)'),
    ]
)

# 6.2 Deployment Steps
doc.add_heading('6.2 Deployment Steps', level=2)

steps = [
    'Step 1 \u2014 Clone the repository: git clone <repo-url> && cd Final_version_socialSync',
    'Step 2 \u2014 Create and activate virtual environment: python -m venv venv && source venv/bin/activate',
    'Step 3 \u2014 Install dependencies: pip install -r requirements.txt',
    'Step 4 \u2014 Create .env file from template: cp .env.example .env && edit with your values',
    'Step 5 \u2014 Create MySQL database: CREATE DATABASE sellento CHARACTER SET utf8mb4;',
    'Step 6 \u2014 Run migrations: python manage.py migrate',
    'Step 7 \u2014 Create superuser: python manage.py createsuperuser',
    'Step 8 \u2014 Collect static files: python manage.py collectstatic --noinput',
    'Step 9 \u2014 Build React frontend: cd frontend && npm install && npm run build && cd ..',
    'Step 10 \u2014 Start with Gunicorn: gunicorn socialsync.wsgi:application --bind 0.0.0.0:8000 --workers 4',
    'Step 11 \u2014 Configure Nginx as reverse proxy (serve static/media files)',
    'Step 12 \u2014 Set up management commands as cron jobs:',
    '    - python manage.py run_scheduler (post publishing)',
    '    - python manage.py sync_analytics (analytics sync)',
    '    - python manage.py sync_comments (comment sync)',
    '    - python manage.py generate_weekly_report (weekly reports)',
    '    - python manage.py fetch_trending (trending topics)',
    'Step 13 \u2014 Verify health: curl https://yourdomain.com/api/v1/auth/me/ (should return 401)',
]
for step in steps:
    doc.add_paragraph(step)

# 6.3 Rate Limits
doc.add_heading('6.3 Rate Limits & Generation Caps', level=2)

add_table(
    ['Resource', 'Default (Free)', 'Maximum (Enterprise)', 'Enforced By'],
    [
        ('Posts per month', '30', 'Unlimited', 'M11 (UserProfile)'),
        ('Captions per month', '50', 'Unlimited', 'M11 (UserProfile)'),
        ('Images per month', '10', '5000', 'M11 (UserProfile)'),
        ('Videos per month', '5', '2000', 'M11 (UserProfile)'),
        ('Messenger messages', '0', 'Unlimited', 'M11 (UserProfile)'),
        ('Brands per workspace', '1', '100', 'M11 (UserProfile)'),
        ('API requests', 'No limit', 'No limit', 'Not enforced'),
        ('File upload size', '10MB', '10MB', 'Django settings'),
    ]
)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# 7. CHANGELOG
# ════════════════════════════════════════════════════════════════════════════
doc.add_heading('7. Changelog', level=1)

add_table(
    ['Date', 'Version', 'Author', 'Changes'],
    [
        ('2026-03-10', '1.2.3', 'Arifuzzaman Swapnil',
         'Strategy hub enhancements, prompt history model, API key cleanup, '
         'image service updates (GPT-Image-1), QuickActions component update, '
         'Footer and StrategyHubPage UI fixes'),
        ('2026-03-09', '1.2.2', 'Arifuzzaman Swapnil',
         'Copy overlay system (text on images), prompt engineering fixes, '
         'CopyOverlayModal, ImageDiagnosisModal, RepromptPanel components, '
         'APITestPage, font support (Bebas Neue, Montserrat, Playfair, Roboto)'),
        ('2026-03-08', '1.2.1', 'Arifuzzaman Swapnil',
         'Strategy hub (content pillars, competitors, trending), approval workflows, '
         'RBAC (role-based access control), notification system, hashtag management, '
         'scheduling with best-time suggestions'),
        ('2026-03-05', '1.2.0', 'Arifuzzaman Swapnil',
         'Claude API integration as primary text AI, unified LLM service with fallback chain, '
         'Brand DNA generation from website, 9-layer prompt engineering for images'),
        ('2026-02-28', '1.1.0', 'Arifuzzaman Swapnil',
         'Core AI features: caption generation, image generation (DALL-E + Gemini), '
         'video generation, voice generation, messenger bot with RAG'),
        ('2026-02-15', '1.0.0', 'Arifuzzaman Swapnil',
         'Initial release: user auth, brand management, post CRUD, '
         'social account connections, basic dashboard, admin panel'),
    ]
)

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('END OF DOCUMENT')
run.bold = True
run.font.size = Pt(14)
run.font.color.rgb = RGBColor(0x66, 0x66, 0x88)

# ════════════════════════════════════════════════════════════════════════════
# SAVE
# ════════════════════════════════════════════════════════════════════════════
doc.save(OUTPUT_PATH)
print(f'Report generated: {OUTPUT_PATH}')
print(f'Sections: 7 major sections')
print(f'Modules documented: 12')
print(f'Tables: 30+')
