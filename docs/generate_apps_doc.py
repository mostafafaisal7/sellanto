"""
Generate: SaleAnto Apps Summary Document (V2 — Complete & In-Depth)
Format: App Name -> Importance/Benefits -> API -> Endpoints (with request/response details)
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(BASE_DIR, 'SaleAnto_Apps_Summary.docx')

doc = Document()

# ── Styles ──
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(10)
style.paragraph_format.space_after = Pt(4)

# Colors
BLUE = RGBColor(0x1a, 0x56, 0xdb)
DARK = RGBColor(0x1f, 0x2d, 0x3d)
GRAY = RGBColor(0x5d, 0x6d, 0x7e)
WHITE = RGBColor(0xff, 0xff, 0xff)
GREEN = RGBColor(0x27, 0xae, 0x60)
RED = RGBColor(0xc0, 0x39, 0x2b)
HEADER_BG = '1a56db'
HEADER_BG2 = '2c3e50'
ROW_ALT = 'f0f4ff'
DETAIL_BG = 'fafafa'


def set_cell_shading(cell, color):
    shading = cell._element.get_or_add_tcPr()
    shd = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): color,
        qn('w:val'): 'clear',
    })
    shading.append(shd)


def add_styled_table(headers, rows, col_widths=None, header_bg=HEADER_BG):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ''
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True; r.font.size = Pt(9); r.font.color.rgb = WHITE
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_cell_shading(cell, header_bg)
    for row_idx, row_data in enumerate(rows):
        row = table.add_row()
        for col_idx, val in enumerate(row_data):
            cell = row.cells[col_idx]
            cell.text = ''
            p = cell.paragraphs[0]
            r = p.add_run(str(val))
            r.font.size = Pt(8.5)
            if row_idx % 2 == 1:
                set_cell_shading(cell, ROW_ALT)
    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)
    doc.add_paragraph()
    return table


def add_detail_block(title, details):
    """Add a detailed request/response block for a key endpoint."""
    p = doc.add_paragraph()
    r = p.add_run(title)
    r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = DARK
    for line in details:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.5)
        r = p.add_run(line)
        r.font.size = Pt(8.5); r.font.name = 'Consolas'


# ══════════════════════════════════════════════════════════════════════════
# TITLE PAGE
# ══════════════════════════════════════════════════════════════════════════
doc.add_paragraph()
doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('SaleAnto Platform')
r.bold = True; r.font.size = Pt(28); r.font.color.rgb = BLUE

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Application Modules Reference')
r.font.size = Pt(18); r.font.color.rgb = DARK

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Complete API Documentation with Request/Response Details')
r.font.size = Pt(11); r.font.color.rgb = GRAY

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Version 1.2.3  |  March 2026  |  All 200+ Endpoints Documented')
r.font.size = Pt(10); r.font.color.rgb = GRAY

doc.add_page_break()


# ══════════════════════════════════════════════════════════════════════════
# APPS DATA — COMPLETE with request/response details
# endpoints: (method, path, description, detail_string)
# ══════════════════════════════════════════════════════════════════════════

apps_data = [
    {
        'name': 'accounts',
        'title': 'Accounts & User Management',
        'importance': [
            'Core user authentication and authorization layer for the entire platform',
            'Manages user registration, login (JWT), profile, and subscription billing',
            'Centralized API key management -- "Enter once, works everywhere" pattern via accounts/api_keys.py',
            'Subscription tier enforcement (Free/Starter/Pro/Business/Enterprise) with per-tier generation limits',
            'Unified LLM Service -- single AI router that abstracts Claude, OpenAI, and Gemini behind one interface (accounts/services/llm_service.py)',
            'Notification service -- in-app alerts for approvals, publish status, comments (accounts/services/notification_service.py)',
        ],
        'api_description': 'REST API for auth (JWT token pair via SimpleJWT), user profile CRUD, API key management, and generation usage tracking. Uses token rotation with blacklisting on logout. All auth endpoints are public; all others require Bearer token.',
        'endpoints': [
            ('POST', '/api/auth/register/', 'Register new user account',
             'Request: {username, email, password} | Response: {message, user: {id, username, email}} | Auth: No | Creates UserProfile with Free plan'),
            ('POST', '/api/auth/register-with-brand/', 'Register + create workspace + brand + DNA in one step',
             'Request: {username, email, password, company, brand_name, industry, target_region, website_url} | Response: {user, workspace_id, brand_id, brand_dna, tokens: {access, refresh}, ai_enhanced} | Auth: No'),
            ('POST', '/api/auth/login/', 'Login -- returns JWT access + refresh tokens',
             'Request: {username, password} | Response: {user: {id, username, email, is_staff}, tokens: {access, refresh}} | Auth: No | Sets token rotation'),
            ('POST', '/api/auth/logout/', 'Logout -- blacklists refresh token',
             'Request: {refresh} | Response: {message: "Logged out"} | Auth: Yes | Adds refresh token to blacklist'),
            ('POST', '/api/auth/refresh/', 'Refresh expired access token using refresh token',
             'Request: {refresh} | Response: {access, refresh} | Auth: Yes (refresh token) | Rotates refresh token'),
            ('GET', '/api/auth/me/', 'Get current authenticated user info',
             'Response: {id, username, email, first_name, last_name, is_staff} | Auth: Yes'),
            ('GET/PUT/PATCH', '/api/profile/', 'View or update user profile',
             'GET Response: {id, user, display_name, timezone, subscription_plan, max_posts, max_accounts, is_approved, company_name, avatar} | PATCH Request: {display_name, timezone, company_name} | Auth: Yes'),
            ('GET/PATCH', '/api/profile/api-keys/', 'View API key status / save OpenAI or Gemini keys',
             'GET Response: {openai_active, gemini_active, claude_active, openai_key_masked, gemini_key_masked} | PATCH Request: {openai_api_key?, gemini_api_key?} -- syncs key to all features via api_keys.sync_openai_key/sync_gemini_key | Auth: Yes'),
            ('GET', '/api/generation-usage/', 'Check remaining AI generation credits for current billing cycle',
             'Response: {plan, captions: {used, limit}, images: {used, limit}, videos: {used, limit}, voices: {used, limit}} | Auth: Yes'),
            ('POST', '/api/test-claude/', 'Test if Claude API key is configured and working',
             'Response: {status: "ok", provider: "claude", model} or {error: "No AI API key configured..."} | Auth: Yes'),
            ('POST', '/api/support-chat/', 'Send message to AI support agent powered by Claude',
             'Request: {message, conversation_history?: []} | Response: {reply, tokens_used} | Auth: Yes | Uses UnifiedLLMService'),
        ],
        'key_details': [
            ('JWT Token Lifecycle', [
                'Access token: 60 min expiry (configurable in settings.py)',
                'Refresh token: 7 day expiry with rotation',
                'On logout: refresh token added to OutstandingToken blacklist',
                'Token format: Bearer <access_token> in Authorization header',
            ]),
            ('API Key Sync Flow', [
                'User saves OpenAI key -> sync_openai_key() -> writes to UserVoiceSettings + UserImageSettings',
                'User saves Gemini key -> sync_gemini_key() -> writes to UserImageSettings + UserVideoSettings',
                'Claude key: global admin key from ANTHROPIC_API_KEY env var (not per-user)',
                'get_openai_key(user): checks VoiceSettings -> ImageSettings -> MessengerAIConfig -> django.settings fallback',
            ]),
            ('Subscription Plans & Limits', [
                'Free: 10 captions, 5 images, 2 videos, 3 voices per month',
                'Starter ($9): 50 captions, 25 images, 10 videos, 15 voices',
                'Pro ($29): 200 captions, 100 images, 40 videos, 60 voices',
                'Business ($79): 500 captions, 250 images, 100 videos, 150 voices',
                'Enterprise ($199): Unlimited all',
            ]),
        ],
    },
    {
        'name': 'brands',
        'title': 'Brand & Workspace Manager',
        'importance': [
            'Multi-brand architecture -- agencies manage unlimited brands under workspaces',
            'Brand DNA: AI-extracted 15-field brand identity profile (brand_personality, tone_of_voice, target_audience, core_values, visual_style, color_palette, content_themes, usp, brand_story, industry_keywords, competitors, goals, do_s, don_ts, hashtag_strategy)',
            'Workspace-level RBAC with 6 roles: Owner, Admin, Creator, Approver, Publisher, Viewer',
            'Brand assets management (logos, colors, fonts) -- consistent brand identity across all AI outputs',
            'Content pillars for strategic content categorization and compliance checking',
            'Competitor tracking with AI-powered crawling and insights',
            'Trending topic generation and manual curation per brand',
        ],
        'api_description': 'Full CRUD for workspaces, brands, brand assets via ModelViewSets. Brand DNA generation via AI website crawling + LLM analysis. Content strategy management with pillars, competitors, templates, ideas, and trending topics.',
        'endpoints': [
            ('GET/POST', '/api/workspaces/', 'List/create workspaces (ModelViewSet)',
             'GET Response: [{id, name, owner, brand_count, member_count, created_at}] | POST Request: {name} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/workspaces/{id}/', 'Workspace detail CRUD',
             'GET: full workspace with brands[] and members[] | PUT/PATCH: {name} | DELETE: removes workspace + all brands | Auth: Yes (Owner/Admin)'),
            ('GET/POST', '/api/brands/', 'List/create brands (ModelViewSet)',
             'GET: [{id, name, workspace, industry, website_url, logo, dna_status, created_at}] | POST: {name, workspace, industry?, website_url?, target_region?} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/brands/{id}/', 'Brand detail CRUD',
             'GET: full brand with brand_dna, assets[], social_accounts[] | PUT/PATCH: {name, industry, website_url, brand_dna fields} | Auth: Yes (Creator+)'),
            ('GET/POST', '/api/brand-assets/', 'List/upload brand assets (ModelViewSet)',
             'GET: [{id, brand, asset_type, file, name}] | POST: multipart {brand, asset_type: "logo"|"image"|"font", file, name} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/brand-assets/{id}/', 'Brand asset detail CRUD',
             'Auth: Yes (Creator+)'),
            ('POST', '/api/brands/{id}/generate-dna/', 'Generate Brand DNA by crawling brand website with AI',
             'Request: {website_url?, industry?, target_audience?, brand_description?} | Response: {brand_dna: {15 fields}, analysis, thinking} | Auth: Yes | Uses UnifiedLLMService to extract brand identity from crawled website content'),
            ('GET', '/api/brands/{id}/dna-status/', 'Check Brand DNA generation status',
             'Response: {status: "pending"|"completed"|"failed", progress?, error?} | Auth: Yes'),
            ('POST', '/api/brands/{id}/regenerate-dna-inputs/', 'Regenerate DNA from previously saved inputs',
             'Request: {} (uses cached inputs) | Response: {brand_dna: {15 fields}} | Auth: Yes'),
            ('GET', '/api/brands/{id}/dna-history/', 'View all past DNA versions with timestamps',
             'Response: [{id, brand_dna, created_at, source}] | Auth: Yes'),
            ('POST', '/api/brands/{id}/dna-history/{hid}/restore/', 'Restore a previous DNA version as current',
             'Response: {message, brand_dna} | Auth: Yes (Admin+)'),
            ('GET/POST', '/api/content-pillars/', 'List/create content pillars (ModelViewSet)',
             'GET: [{id, brand, name, description, color, post_count}] | POST: {brand, name, description, color?} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/content-pillars/{id}/', 'Content pillar detail CRUD',
             'Auth: Yes (Creator+)'),
            ('POST', '/api/brands/{id}/pillars/generate/', 'AI-generate content pillars from brand DNA',
             'Request: {count?: 5, override_prompt?, think_harder?} | Response: {pillars: [{name, description, color, example_topics}]} | Auth: Yes'),
            ('GET', '/api/brands/{id}/pillar-compliance/', 'Check post compliance against content pillars',
             'Response: {compliant_posts, non_compliant_posts, compliance_rate, suggestions} | Auth: Yes'),
            ('GET/POST', '/api/competitor-profiles/', 'List/create competitor profiles (ModelViewSet)',
             'GET: [{id, brand, name, website_url, platforms, last_crawled}] | POST: {brand, name, website_url} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/competitor-profiles/{id}/', 'Competitor profile detail CRUD',
             'Auth: Yes'),
            ('POST', '/api/brands/{id}/competitors/crawl/', 'Crawl competitor website for analysis',
             'Request: {competitor_id} | Response: {pages_crawled, content_summary} | Auth: Yes'),
            ('GET', '/api/brands/{id}/competitors/insights/', 'AI-generated competitor insights and recommendations',
             'Response: {insights: [{competitor, strengths, weaknesses, opportunities, content_gaps}]} | Auth: Yes'),
            ('POST', '/api/competitors/suggest/', 'AI-suggest competitors based on brand DNA and industry',
             'Request: {brand_id} | Response: {suggestions: [{name, website_url, reason}]} | Auth: Yes'),
            ('GET/POST', '/api/brand-templates/', 'List/create reusable brand templates (ModelViewSet)',
             'GET: [{id, brand, name, template_type, content}] | POST: {brand, name, template_type, content} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/brand-templates/{id}/', 'Brand template detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/content-ideas/', 'List/create content ideas (ModelViewSet)',
             'GET: [{id, brand, title, description, pillar, status, platform}] | POST: {brand, title, description, pillar?, platform?} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/content-ideas/{id}/', 'Content idea detail CRUD',
             'Auth: Yes'),
            ('POST', '/api/ideas/generate/', 'AI-generate content ideas from brand strategy',
             'Request: {brand_id, count?: 5, pillar_id?, platform?, override_prompt?, think_harder?} | Response: {ideas: [{title, description, platform, pillar, hook}]} | Auth: Yes | Rate limited'),
            ('POST', '/api/ideas/{id}/regenerate/', 'Regenerate a specific idea with modifications',
             'Request: {override_prompt?, think_harder?} | Response: {idea: {title, description, hook}} | Auth: Yes'),
            ('POST', '/api/ideas/{id}/add-to-calendar/', 'Convert idea into a calendar draft post',
             'Response: {post_id, message} | Auth: Yes'),
            ('GET', '/api/ideas/history/', 'View past idea generation history',
             'Response: [{id, brand, ideas_count, created_at, prompt_used}] | Auth: Yes'),
            ('GET', '/api/trending/', 'Get trending topics across all brands',
             'Response: [{id, topic, category, relevance_score, source}] | Auth: Yes'),
            ('POST', '/api/brands/{id}/trending/generate/', 'AI-generate trending topics relevant to brand',
             'Request: {count?: 10, override_prompt?, think_harder?} | Response: {topics: [{topic, category, relevance, angle}]} | Auth: Yes'),
            ('GET', '/api/brands/{id}/trending/', 'Get brand-specific trending topics',
             'Response: [{id, topic, category, relevance_score, is_manual, feedback}] | Auth: Yes'),
            ('POST', '/api/brands/{id}/trending/feedback/', 'Submit feedback on a trending topic',
             'Request: {topic_id, feedback: "useful"|"not_useful"|"used"} | Auth: Yes'),
            ('POST', '/api/brands/{id}/trending/manual/', 'Manually add a trending topic',
             'Request: {topic, category?, notes?} | Response: {id, topic} | Auth: Yes'),
            ('GET', '/api/brands/{id}/prompt-history/', 'View prompt engineering history for a brand',
             'Response: [{id, prompt_type, input_prompt, output_prompt, created_at}] | Auth: Yes'),
            ('GET', '/api/overflow/progress/', 'Check overflow/background task progress',
             'Response: {tasks: [{id, type, status, progress}]} | Auth: Yes'),
            ('POST', '/api/overflow/skip/', 'Skip remaining overflow tasks',
             'Response: {skipped_count} | Auth: Yes'),
            ('GET/POST', '/api/content-approvals/', 'List/create content approvals (ModelViewSet)',
             'Auth: Yes'),
            ('GET/PUT/DELETE', '/api/content-approvals/{id}/', 'Content approval detail CRUD',
             'Auth: Yes'),
            ('GET', '/api/brands/{id}/launch-plan/', 'Get launch plan for a brand',
             'Response: {id, brand, steps, progress, created_at} | Auth: Yes'),
            ('POST', '/api/launch-plans/', 'Create a new launch plan',
             'Request: {brand_id, steps?} | Response: {id, brand, steps} | Auth: Yes'),
        ],
        'key_details': [
            ('Brand DNA 15 Fields', [
                'brand_personality, tone_of_voice, target_audience, core_values, visual_style',
                'color_palette, content_themes, usp (unique selling proposition), brand_story',
                'industry_keywords, competitors, goals, do_s, don_ts, hashtag_strategy',
                'All fields are JSON text, AI-extracted from website crawl via UnifiedLLMService',
            ]),
            ('RBAC Roles & Permissions', [
                'Owner: full access, can delete workspace, manage billing',
                'Admin: manage members, approve content, manage settings',
                'Creator: create/edit drafts, generate AI content',
                'Approver: review and approve/reject submitted content',
                'Publisher: schedule and publish approved content',
                'Viewer: read-only access to all content and analytics',
            ]),
        ],
    },
    {
        'name': 'ai_caption',
        'title': 'AI Copy Engine (Captions & Text)',
        'importance': [
            'AI-powered social media caption generation using Claude (primary) with OpenAI/Gemini fallback',
            'Brand-aware captions -- uses Brand DNA, content pillars, and brand voice for tone-consistent messaging',
            'Platform-specific adaptation -- tailors captions for Instagram (2200 chars), Facebook, Twitter/X (280 chars), LinkedIn, TikTok',
            'A/B testing support -- generate variant captions tagged A/B for performance comparison',
            'Template system -- save and reuse successful caption formulas',
            'Draft-scoped captions with select/deselect workflow for post publishing pipeline',
            'Hashtag generation and management integrated with caption flow',
        ],
        'api_description': 'Caption generation, adaptation, and management via UnifiedLLMService (Claude preferred, OpenAI/Gemini fallback). Full CRUD for templates and saved captions via ViewSets. Draft-scoped operations for the publishing pipeline.',
        'endpoints': [
            ('POST', '/api/ai-caption/generate/', 'Generate AI caption from scratch',
             'Request: {topic?, platform?, tone?: "professional"|"casual"|"witty"|"inspiring", brand_id?, include_cta?: bool, count?: 3} | Response: {captions: [{id, body, platform, tone, cta_text, hashtags}], tokens_used} | Auth: Yes | Rate limited by plan'),
            ('POST', '/api/ai-caption/regenerate/{id}/', 'Regenerate a specific caption with modifications',
             'Request: {tone?, platform?, feedback?} | Response: {caption: {id, body, platform, tone}} | Auth: Yes'),
            ('GET', '/api/ai-caption/history/', 'View caption generation history (paginated)',
             'Query params: ?page=1&page_size=20&brand_id= | Response: {count, results: [{id, topic, platform, tone, created_at, captions_count}]} | Auth: Yes'),
            ('GET/PUT/PATCH', '/api/ai-caption/settings/', 'View/update caption AI settings',
             'GET Response: {provider, model, temperature, max_tokens, default_tone, default_platform} | PATCH: {provider?, temperature?} | Auth: Yes'),
            ('GET/POST', '/api/ai-caption/templates/', 'List/create caption templates (ModelViewSet)',
             'GET: [{id, name, template_text, platform, tone, variables, use_count}] | POST: {name, template_text, platform?, tone?, variables?: []} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/ai-caption/templates/{id}/', 'Caption template detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/ai-caption/saved/', 'List/save favorite captions (ModelViewSet)',
             'GET: [{id, caption_text, platform, tone, source, is_favorite, created_at}] | POST: {caption_text, platform?, tone?} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-caption/saved/{id}/', 'Saved caption detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/post-captions/', 'List/create post-caption associations (ModelViewSet)',
             'GET: [{id, post, platform, body, cta_text, is_selected, ab_label}] | POST: {post, platform, body} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/post-captions/{id}/', 'Post-caption detail CRUD',
             'Auth: Yes'),
            ('GET', '/api/drafts/{post_id}/captions/', 'Get all captions for a specific draft',
             'Response: [{id, platform, body, cta_text, is_selected, ab_label, image_prompt, created_at}] | Auth: Yes'),
            ('POST', '/api/drafts/{post_id}/captions/generate/', 'Generate captions for a draft post using brand context',
             'Request: {platforms: ["instagram","facebook"], count?: 3, tone?, include_cta?: bool, override_prompt?, think_harder?: bool} | Response: {captions: [{id, body, cta_text, image_prompt}], used_prompt, compliance_warnings} | Auth: Yes | Rate limited, daily limit warning'),
            ('POST', '/api/drafts/{post_id}/captions/adapt/', 'Adapt existing caption to different platforms',
             'Request: {caption_id, target_platforms: ["twitter","linkedin"]} | Response: {adapted: [{platform, body, cta_text}]} | Auth: Yes'),
            ('PATCH', '/api/captions/{id}/select/', 'Select/deselect caption as primary for publishing',
             'Request: {is_selected?: bool} | Response: {id, is_selected} | Auth: Yes'),
            ('GET', '/api/captions/{id}/preview/{platform}/', 'Preview caption formatted for specific platform',
             'Response: {formatted_text, char_count, max_chars, is_truncated, hashtag_count, has_cta} | Auth: Yes'),
            ('PATCH', '/api/captions/{id}/ab-tag/', 'Tag caption for A/B testing',
             'Request: {ab_label: "A"|"B"} | Response: {id, ab_label} | Auth: Yes'),
        ],
        'key_details': [
            ('Caption Generation Pipeline', [
                '1. User provides topic/platform/tone or draft context',
                '2. System loads Brand DNA + content pillars + brand voice',
                '3. Builds prompt with brand context, platform constraints, CTA requirements',
                '4. Sends to UnifiedLLMService (Claude -> OpenAI -> Gemini fallback)',
                '5. Returns parsed captions with body, CTA, image_prompt, hashtag suggestions',
                '6. Compliance check against content pillars (optional warnings)',
            ]),
        ],
    },
    {
        'name': 'ai_image',
        'title': 'AI Image Engine',
        'importance': [
            'AI image generation via 3 providers: DALL-E 3 (OpenAI), Gemini Imagen (Google), GPT-Image-1 (OpenAI)',
            '9-Layer Prompt Engineering System -- brand colors, logo placement, style matching, audience targeting, mood, composition, technical specs, negative prompts, platform optimization',
            'Copy overlay service -- adds marketing text on generated images with AI-suggested typography styles',
            'Logo watermarking -- automatically places brand logo on generated images',
            'Template-based generation -- reusable prompt templates for consistent visual identity',
            'Prompt diagnosis and refinement -- AI analyzes failed images and suggests corrections',
        ],
        'api_description': 'Image generation with multiple providers, 9-layer prompt engineering, copy overlay rendering, and asset management. Full CRUD for logos, saved images, and templates via ViewSets.',
        'endpoints': [
            ('POST', '/api/ai-image/generate/', 'Generate image with AI provider',
             'Request: {prompt, provider?: "dalle3"|"gemini"|"gpt-image", size?: "1024x1024"|"1792x1024"|"1024x1792", style?: "vivid"|"natural", quality?: "standard"|"hd", title?, brand_id?, override_prompt?, think_harder?} | Response: {id, image_url, revised_prompt, provider, size, status, tokens_used} | Auth: Yes | Rate limited by plan'),
            ('POST', '/api/ai-image/refine-prompt/', 'AI-refine image prompt for better results',
             'Request: {prompt, brand_id?, style?, platform?} | Response: {refined_prompt, improvements: []} | Auth: Yes | Uses UnifiedLLMService'),
            ('GET', '/api/ai-image/history/', 'Image generation history (paginated)',
             'Query: ?page=1&page_size=20 | Response: {count, results: [{id, prompt, image_url, provider, size, style, created_at}]} | Auth: Yes'),
            ('GET/PUT/PATCH', '/api/ai-image/settings/', 'View/update image AI settings & API keys',
             'GET: {default_provider, default_size, default_style, openai_key_active, gemini_key_active, logo_id} | PATCH: {default_provider?, default_size?} | Auth: Yes'),
            ('GET/POST', '/api/ai-image/logos/', 'List/upload brand logos for watermarking (ModelViewSet)',
             'GET: [{id, name, file_url, is_default}] | POST: multipart {name, file, is_default?} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-image/logos/{id}/', 'Logo detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/ai-image/saved/', 'List/save favorite images (ModelViewSet)',
             'GET: [{id, image_url, prompt, provider, is_favorite, created_at}] | POST: {generation_id} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-image/saved/{id}/', 'Saved image detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/ai-image/templates/', 'List/create image prompt templates (ModelViewSet)',
             'GET: [{id, name, prompt_template, style, variables, use_count}] | POST: {name, prompt_template, style?, variables?: []} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-image/templates/{id}/', 'Image template detail CRUD',
             'Auth: Yes'),
            ('POST', '/api/prompt-engineer/generate/', 'Generate enhanced prompt via 9-layer system',
             'Request: {brand_id, subject, key_message?, mood?, must_include?: [], must_exclude?: [], platform?, think_harder?} | Response: {optimized_prompt, layers: [{name, contribution}], final_prompt} | Auth: Yes'),
            ('POST', '/api/prompt-engineer/diagnose/', 'Diagnose why image prompt produced bad results',
             'Request: {image_description, original_prompt, revised_prompt?, think_harder?} | Response: {diagnosis, root_causes: [], recommendations: []} | Auth: Yes'),
            ('POST', '/api/prompt-engineer/reprompt/', 'Iteratively improve failed prompt with corrections',
             'Request: {brand_id, original_prompt, failure_description, attempt_number?, think_harder?} | Response: {corrected_prompt, changes_made: []} | Auth: Yes'),
            ('POST', '/api/copy-overlay/generate-text/', 'AI-generate marketing copy text for image overlay',
             'Request: {brand_id?, caption_text?, image_description?, cta_text?, count?: 4} | Response: {suggestions: [{headline, subtext, cta}]} | Auth: Yes'),
            ('POST', '/api/assets/{id}/copy-overlay/', 'Apply text overlay on image asset',
             'Request: {copy_text, position?: "top"|"center"|"bottom", font_style?: "modern"|"classic"|"bold", text_color?: "#fff", overlay_opacity?: 0.7, font_size?: 48, text_alignment?: "center"|"left"|"right", add_text_shadow?: bool} | Response: {asset_id, overlay_image_url} | Auth: Yes'),
            ('POST', '/api/assets/{id}/copy-overlay/ai-styles/', 'AI-suggest typography style variants for overlay',
             'Request: {copy_text, brand_id?} | Response: {styles: [{name, position, font_style, text_color, overlay_opacity, font_size, preview_base64}]} -- returns 4 variants with preview images | Auth: Yes'),
        ],
        'key_details': [
            ('9-Layer Prompt Engineering', [
                'Layer 1: Subject & Composition -- main subject, framing, perspective',
                'Layer 2: Brand Colors -- inject brand palette from DNA',
                'Layer 3: Visual Style -- match brand visual_style from DNA',
                'Layer 4: Mood & Atmosphere -- lighting, emotion, energy level',
                'Layer 5: Logo Placement -- instructions for brand logo positioning',
                'Layer 6: Audience Targeting -- age, demographics, cultural cues',
                'Layer 7: Platform Optimization -- aspect ratio, safe zones per platform',
                'Layer 8: Technical Specs -- resolution, quality, format constraints',
                'Layer 9: Negative Prompts -- what to avoid (text, watermarks, etc.)',
            ]),
        ],
    },
    {
        'name': 'ai_video',
        'title': 'AI Video Engine',
        'importance': [
            'AI video generation using Google Gemini Veo model',
            'Brand-aware video generation -- uses Brand DNA for consistent visual identity',
            'Template system for reusable video prompts and styles',
            'Logo watermarking on generated videos',
            'Saved videos library for quick reuse and favorites',
        ],
        'api_description': 'Video generation via Gemini Veo API. Full CRUD for logos, saved videos, and templates via ViewSets. Requires Gemini API key.',
        'endpoints': [
            ('POST', '/api/ai-video/generate/', 'Generate video with Gemini Veo',
             'Request: {prompt, duration?: "5s"|"10s"|"15s", aspect_ratio?: "16:9"|"9:16"|"1:1", brand_id?, style?, override_prompt?, think_harder?} | Response: {id, video_url, prompt, duration, status, tokens_used} | Auth: Yes | Rate limited by plan | Requires Gemini key'),
            ('GET', '/api/ai-video/history/', 'Video generation history (paginated)',
             'Query: ?page=1&page_size=20 | Response: {count, results: [{id, prompt, video_url, duration, status, created_at}]} | Auth: Yes'),
            ('GET/PUT/PATCH', '/api/ai-video/settings/', 'View/update video AI settings & Gemini key',
             'GET: {default_duration, default_aspect_ratio, gemini_key_active} | PATCH: {default_duration?, default_aspect_ratio?} | Auth: Yes'),
            ('GET/POST', '/api/ai-video/logos/', 'List/upload video logos (ModelViewSet)',
             'GET: [{id, name, file_url, is_default}] | POST: multipart {name, file} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-video/logos/{id}/', 'Video logo detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/ai-video/saved/', 'List/save favorite videos (ModelViewSet)',
             'GET: [{id, video_url, prompt, duration, is_favorite, created_at}] | POST: {generation_id} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-video/saved/{id}/', 'Saved video detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/ai-video/templates/', 'List/create video prompt templates (ModelViewSet)',
             'GET: [{id, name, prompt_template, style, use_count}] | POST: {name, prompt_template, style?} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/ai-video/templates/{id}/', 'Video template detail CRUD',
             'Auth: Yes'),
        ],
        'key_details': [],
    },
    {
        'name': 'ai_voice',
        'title': 'AI Voice Engine',
        'importance': [
            'Text-to-Speech (TTS) using OpenAI voice models: alloy, echo, fable, onyx, nova, shimmer',
            'Voice preview before full generation -- test voice style on a short sample before committing credits',
            'Multiple voice styles and playback speeds (0.25x - 4.0x) for different content needs',
            'Speech-to-Text (Whisper) integration for transcription workflows',
            'Voice generation history with playback, download, and re-generation capability',
        ],
        'api_description': 'Voice generation (TTS) and preview via OpenAI API. Settings management, history, and per-generation CRUD. Requires OpenAI API key.',
        'endpoints': [
            ('POST', '/api/ai-voice/generate/', 'Generate voice audio from text',
             'Request: {text, voice?: "alloy"|"echo"|"fable"|"onyx"|"nova"|"shimmer", model?: "tts-1"|"tts-1-hd", speed?: 1.0, response_format?: "mp3"|"opus"|"aac"|"flac"} | Response: {id, audio_url, voice, model, duration_seconds, text_length} | Auth: Yes | Rate limited by plan | Requires OpenAI key'),
            ('POST', '/api/ai-voice/preview/', 'Preview voice with short sample before full generation',
             'Request: {text (first 100 chars used), voice} | Response: {audio_url, duration_seconds} | Auth: Yes | Does not count toward usage limit'),
            ('GET', '/api/ai-voice/history/', 'Voice generation history (paginated)',
             'Query: ?page=1&page_size=20 | Response: {count, results: [{id, text_preview, voice, model, audio_url, duration, created_at}]} | Auth: Yes'),
            ('GET/PUT/PATCH', '/api/ai-voice/settings/', 'View/update voice AI settings & OpenAI key',
             'GET: {default_voice, default_model, default_speed, openai_key_active} | PATCH: {default_voice?, default_model?} | Auth: Yes'),
            ('GET', '/api/ai-voice/generation/{id}/', 'Get specific voice generation details',
             'Response: {id, text, voice, model, speed, audio_url, duration_seconds, created_at} | Auth: Yes'),
            ('DELETE', '/api/ai-voice/generation/{id}/delete/', 'Delete a voice generation and its audio file',
             'Response: {message: "Deleted"} | Auth: Yes'),
            ('POST', '/api/ai-voice/generation/{id}/regenerate/', 'Regenerate voice with same or modified params',
             'Request: {voice?, model?, speed?} | Response: {id, audio_url, duration_seconds} | Auth: Yes'),
        ],
        'key_details': [],
    },
    {
        'name': 'posts',
        'title': 'Post Management, Scheduling & Publishing',
        'importance': [
            'Complete post lifecycle management: draft -> review -> approve -> schedule -> publish -> analyze',
            'Multi-platform publishing to Facebook, Instagram, Twitter/X, LinkedIn, TikTok via platform APIs',
            'APScheduler-based scheduling engine with timezone-aware cron jobs',
            'AI-powered best-time suggestions based on brand analytics and competitor analysis',
            'Conflict detection -- prevents double-posting at same time on same platform',
            'Calendar view (FullCalendar compatible) for visual content planning across all brands',
            'Draft cloning for quick content repurposing with all captions, hashtags, and assets',
        ],
        'api_description': 'Full post CRUD via ModelViewSet with custom actions (publish, cancel). Scheduling via per-platform ScheduledPostPlatform model. Calendar, best-time, and conflict-check endpoints.',
        'endpoints': [
            ('GET/POST', '/api/posts/', 'List/create posts (ModelViewSet)',
             'GET: [{id, title, content, status, brand, platforms, created_at, scheduled_count, published_count}] | Filters: ?status=draft|scheduled|published|failed&brand_id=&search= | POST: {title?, content?, brand_id, platforms?: []} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/posts/{id}/', 'Post detail CRUD',
             'GET: full post with captions[], hashtags[], assets[], scheduled_platforms[] | PUT/PATCH: {title, content, platforms} | DELETE: cancels scheduled, removes post | Auth: Yes (Creator+)'),
            ('POST', '/api/posts/{id}/publish/', 'Publish post to connected social platforms (ViewSet action)',
             'Request: {platform_ids?: []} | Response: {published: [{platform, status, post_url?, error?}]} | Auth: Yes (Publisher+) | Calls platform APIs directly'),
            ('POST', '/api/posts/{id}/cancel/', 'Cancel a scheduled post (ViewSet action)',
             'Response: {message, cancelled_platforms: []} | Auth: Yes'),
            ('POST', '/api/drafts/{post_id}/schedule/', 'Schedule a draft for future publishing per-platform',
             'Request: {platforms: [{platform: "instagram", caption_id, scheduled_at: "ISO8601", timezone: "US/Eastern", hashtag_placement?: "inline"|"comment"}]} | Response: [{id, platform, scheduled_at, status}] | Auth: Yes (Publisher+) | Creates APScheduler jobs'),
            ('PATCH/DELETE', '/api/scheduled-posts/{spp_id}/', 'Reschedule or cancel a specific platform schedule',
             'PATCH: {scheduled_at: "ISO8601"} | DELETE: cancels scheduled job | Auth: Yes'),
            ('GET', '/api/schedule/calendar/', 'Calendar view -- all scheduled posts in date range (FullCalendar format)',
             'Query: ?start=2026-03-01&end=2026-03-31&brand_id= | Response: [{id, title, start, end, color, platform, status, pillar_name, post_id}] | Auth: Yes'),
            ('GET', '/api/brands/{id}/best-times/', 'AI-suggested best posting times per platform',
             'Query: ?platform=instagram | Response: [{platform, day_of_week, hour_utc, score, reason}] | Auth: Yes'),
            ('POST', '/api/schedule/conflict-check/', 'Check for scheduling conflicts before booking a slot',
             'Request: {platform, scheduled_at: "ISO8601", buffer_minutes?: 30} | Response: {has_conflict: bool, conflicts: [{post_id, scheduled_at}], message} | Auth: Yes'),
            ('POST', '/api/schedule/compute-times/', 'Compute optimal posting times via LLM analysis',
             'Request: {brand_id, platforms?: [], override_prompt?, think_harder?} | Response: {recommendations: [{platform, day_of_week, hour_utc, score, reason}]} | Auth: Yes | Uses competitor data'),
            ('POST', '/api/drafts/{post_id}/clone/', 'Clone a draft post with all captions, hashtags, assets',
             'Response: {original_post_id, new_post_id, status: "cloned"} | Auth: Yes'),
            ('GET', '/api/dashboard/stats/', 'Dashboard statistics',
             'Response: {total_posts, scheduled_posts, posted_posts, failed_posts, connected_accounts, subscription_plan, brands_count} | Auth: Yes'),
            ('GET', '/api/dashboard/recent/', 'Recent posts feed (latest 10)',
             'Query: ?limit=10 | Response: [{id, title, status, platform, created_at, thumbnail}] | Auth: Yes'),
        ],
        'key_details': [
            ('Post Status Flow', [
                'draft -> pending_approval -> approved -> scheduled -> publishing -> published',
                'draft -> pending_approval -> changes_requested -> draft (loop)',
                'draft -> pending_approval -> rejected (terminal)',
                'scheduled -> failed (on platform API error)',
            ]),
        ],
    },
    {
        'name': 'platforms',
        'title': 'Social Platform Connector',
        'importance': [
            'OAuth-based connection to 5 social platforms: Facebook, Instagram, Twitter/X, LinkedIn, TikTok',
            'Secure token storage with encryption and automatic token refresh for uninterrupted publishing',
            'Multi-account support -- connect multiple accounts per platform per brand',
            'Platform health monitoring -- track connection status, token expiry, and API permissions',
            'Platform-specific field validation (e.g., Instagram requires Facebook Page, Twitter has char limits)',
        ],
        'api_description': 'Social account connection management via two ViewSets. Handles OAuth token storage, account validation, and status tracking.',
        'endpoints': [
            ('GET/POST', '/api/platforms/', 'List/connect social accounts (SocialAccountViewSet)',
             'GET: [{id, platform, username, profile_url, is_active, token_expires_at, brand}] | POST: {platform: "facebook"|"instagram"|"twitter"|"linkedin"|"tiktok", access_token, page_id?, brand_id} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/platforms/{id}/', 'Social account detail/update/disconnect',
             'GET: full account with token status | PATCH: {is_active} | DELETE: disconnects and removes tokens | Auth: Yes'),
            ('GET/POST', '/api/platforms-detail/', 'Detailed platform info (SocialAccountDetailViewSet)',
             'GET: [{id, platform, username, profile_url, token_status, permissions, last_used, post_count}] | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/platforms-detail/{id}/', 'Platform detail CRUD with extended info',
             'Auth: Yes'),
        ],
        'key_details': [],
    },
    {
        'name': 'analytics',
        'title': 'Analytics & Learning Engine',
        'importance': [
            'Post performance tracking -- likes, comments, shares, reach, impressions, clicks per post per platform',
            'Cross-platform analytics dashboard with aggregated metrics and trend charts',
            'AI-powered weekly reports -- automatically generated performance summaries with recommendations',
            'A/B test results -- compare variant caption/creative performance side by side',
            'Learning signals -- AI identifies what works and feeds insights back into Brand DNA',
            'Winner post identification and one-click repurposing into new content',
            'Comment management with AI-generated reply suggestions using brand voice',
        ],
        'api_description': 'Analytics data retrieval, AI-powered insights, weekly reports, learning signals, A/B testing, comment management, and post repurposing.',
        'endpoints': [
            ('GET', '/api/analytics/summary/', 'Overall analytics summary across all platforms',
             'Query: ?brand_id=&period=7d|14d|30d|90d | Response: {total_posts, total_impressions, total_reach, total_likes, total_comments, total_shares, avg_engagement_rate, top_platform} | Auth: Yes'),
            ('GET', '/api/analytics/platforms/', 'Per-platform analytics breakdown',
             'Query: ?brand_id= | Response: [{platform, posts_count, impressions, reach, likes, comments, shares, engagement_rate}] | Auth: Yes'),
            ('GET', '/api/analytics/trends/', 'Engagement trends over time (for charts)',
             'Query: ?brand_id=&period=30d&metric=engagement|impressions|reach | Response: {labels: ["Mar 1", ...], datasets: [{label, data: []}]} | Auth: Yes'),
            ('GET', '/api/analytics/top-posts/', 'Top performing posts ranked by engagement',
             'Query: ?brand_id=&limit=10&sort_by=engagement_rate|impressions|likes | Response: [{post_id, title, platform, engagement_rate, impressions, likes, comments}] | Auth: Yes'),
            ('GET', '/api/posts/{id}/stats/', 'Quick stats for a specific post (24h/48h snapshots)',
             'Query: ?snapshot=24h|48h | Response: {post_id, impressions, reach, likes, comments, shares, clicks, engagement_rate, snapshot_at} | Auth: Yes'),
            ('GET', '/api/posts/{id}/comments/', 'Comments on a specific post',
             'Query: ?sentiment=positive|negative|neutral | Response: [{id, author, body, sentiment, replied, reply_body, created_at}] | Auth: Yes'),
            ('POST', '/api/comments/{id}/reply/', 'Reply to a comment (human reply)',
             'Request: {reply_body, reply_type?: "text"} | Response: {comment_id, reply_body, replied: true} | Auth: Yes'),
            ('POST', '/api/comments/{id}/ai-reply/', 'AI-generate a reply to a comment using brand voice',
             'Request: {override_prompt?, think_harder?} | Response: {comment_id, reply_body, ai_generated: true, tokens_used} | Auth: Yes | Uses UnifiedLLMService with Brand DNA context'),
            ('GET', '/api/brands/{id}/weekly-report/', 'AI-generated weekly performance report',
             'Response: [{id, brand, period_start, period_end, summary, highlights, recommendations, metrics, created_at}] -- last 10 reports | Auth: Yes (Admin+)'),
            ('GET/POST', '/api/weekly-reports/', 'List/create weekly reports (ReadOnlyModelViewSet)',
             'GET: [{id, brand, period_start, period_end, summary}] | Auth: Yes'),
            ('GET', '/api/weekly-reports/{id}/', 'Weekly report detail',
             'Response: {id, brand, period_start, period_end, summary, highlights, recommendations, metrics} | Auth: Yes'),
            ('GET', '/api/brands/{id}/analytics/dashboard/', 'Full analytics dashboard for a brand',
             'Query: ?period=7d|14d|30d|90d | Response: {total_impressions, total_reach, total_likes, total_comments, total_shares, total_clicks, avg_engagement_rate, daily_metrics: [], platform_breakdown: [], top_posts: []} | Auth: Yes'),
            ('GET', '/api/brands/{id}/ab-results/', 'A/B test comparison results',
             'Response: [{post_id, variant_a: {caption, engagement_rate, impressions}, variant_b: {caption, engagement_rate, impressions}, winner: "A"|"B", confidence}] | Auth: Yes'),
            ('GET', '/api/brands/{id}/learning-signals/', 'AI learning signals from post performance',
             'Query: ?applied=true|false | Response: [{id, signal_type, insight, confidence, source_posts, is_applied, created_at}] -- max 50 | Auth: Yes (Admin+)'),
            ('GET', '/api/brands/{id}/winners/', 'Top winner posts by performance',
             'Query: ?limit=10 | Response: [{post_id, title, platform, engagement_rate, why_winner}] | Auth: Yes'),
            ('POST', '/api/posts/{id}/repurpose/', 'Repurpose a winning post into new content format',
             'Request: {repurpose_format?: "carousel"|"thread"|"story"|"reel"} | Response: {new_post_id, repurpose_format, status} | Auth: Yes'),
        ],
        'key_details': [
            ('Learning Signal Types', [
                'best_time: optimal posting times discovered from data',
                'best_format: content format that performs best (carousel, video, image)',
                'best_tone: tone that resonates with audience',
                'best_topic: topics that drive most engagement',
                'hashtag_insight: hashtags that boost reach',
                'Signals feed back into Brand DNA to improve future AI generation',
            ]),
        ],
    },
    {
        'name': 'onboarding',
        'title': 'Onboarding Flow',
        'importance': [
            'Guided step-by-step onboarding for new users (5 steps)',
            'Step tracking -- saves progress so users can resume later from any device',
            'Skip option -- power users can bypass onboarding entirely',
            'Connects brand setup, platform linking, API key config, and first post creation into a smooth flow',
        ],
        'api_description': 'Onboarding progress tracking and step completion. Steps: 1) Create Brand, 2) Connect Platform, 3) Setup API Keys, 4) Create First Post, 5) Explore Features.',
        'endpoints': [
            ('GET/PUT', '/api/onboarding/', 'Get/update current onboarding progress',
             'GET Response: {current_step, total_steps: 5, steps: [{step_number, title, is_completed, completed_at}], is_skipped} | Auth: Yes'),
            ('POST', '/api/onboarding/step/{step}/', 'Complete an onboarding step',
             'Response: {step_number, is_completed: true, next_step} | Auth: Yes | Validates step prerequisites'),
            ('POST', '/api/onboarding/skip/', 'Skip remaining onboarding steps',
             'Response: {message: "Onboarding skipped", is_skipped: true} | Auth: Yes'),
        ],
        'key_details': [],
    },
    {
        'name': 'messenger_bot',
        'title': 'Messenger Bot & E-Commerce',
        'importance': [
            'AI-powered chatbot for Facebook Messenger -- automates customer conversations 24/7',
            'RAG Pipeline: PDF upload -> text extraction -> chunking -> embeddings -> cosine similarity search for context-aware answers',
            'Website crawling knowledge base -- bot answers from your actual website content',
            'WooCommerce e-commerce integration -- product sync, search, and AI recommendations in chat',
            'Human takeover mode -- seamlessly switch between AI and human agent per conversation',
            'Custom prompt management -- customize bot personality, tone, and response rules',
            'Facebook Webhook -- receives real-time messages and processes via MessageHandler service',
        ],
        'api_description': 'Messenger bot connection management, AI configuration, PDF/website knowledge base, e-commerce integration (WooCommerce), conversation handling, and custom prompts. Includes Facebook webhook for real-time message processing.',
        'endpoints': [
            ('GET', '/api/messenger/dashboard/', 'Messenger bot dashboard statistics',
             'Response: {total_connections, active_connections, total_conversations, total_messages, bot_messages, human_messages, avg_response_time, active_takeovers} | Auth: Yes'),
            ('GET/POST', '/api/messenger/connections/', 'List/create messenger connections (ModelViewSet)',
             'GET: [{id, page_name, page_id, is_active, conversations_count, last_message_at}] | POST: {page_id, page_access_token, page_name} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/messenger/connections/{id}/', 'Connection detail CRUD',
             'GET: full connection with config, stats | DELETE: disconnects webhook | Auth: Yes'),
            ('GET/PUT/PATCH', '/api/messenger/connections/{id}/config/', 'AI configuration for messenger bot',
             'GET: {ai_provider, response_style, max_tokens, temperature, system_prompt, greeting_message, fallback_message, openai_api_key_masked} | PATCH: {response_style?, max_tokens?, temperature?, system_prompt?, greeting_message?} | Auth: Yes'),
            ('GET/POST', '/api/messenger/connections/{id}/pdfs/', 'List/upload PDF knowledge base files',
             'GET: [{id, filename, size_bytes, pages, chunks_count, status, uploaded_at}] | POST: multipart {file} -> extracts text, chunks, generates embeddings | Auth: Yes'),
            ('GET/DELETE', '/api/messenger/connections/{id}/pdfs/{pdf_id}/', 'PDF detail/delete',
             'GET: {id, filename, pages, chunks: [{text_preview, embedding_status}]} | DELETE: removes PDF + embeddings | Auth: Yes'),
            ('GET', '/api/messenger/connections/{id}/conversations/', 'List conversations for a connection',
             'Query: ?status=active|takeover&search= | Response: [{id, sender_id, sender_name, last_message, unread_count, is_takeover, created_at}] | Auth: Yes'),
            ('GET', '/api/messenger/connections/{id}/conversations/{conv_id}/', 'Conversation detail with full message history',
             'Response: {id, sender_name, messages: [{id, direction: "in"|"out", body, is_bot, created_at}], is_takeover, metadata} | Auth: Yes'),
            ('POST', '/api/messenger/connections/{id}/conversations/{conv_id}/toggle-takeover/', 'Toggle human takeover mode',
             'Response: {conversation_id, is_takeover: bool, message} | Auth: Yes | When ON: bot stops auto-replying, human agent takes over'),
            ('POST', '/api/messenger/connections/{id}/conversations/{conv_id}/send-message/', 'Send message as human agent',
             'Request: {message} | Response: {message_id, body, direction: "out", is_bot: false} | Auth: Yes | Requires takeover mode ON'),
            ('GET/POST', '/api/messenger/connections/{id}/prompts/', 'List/create custom prompts for bot personality',
             'GET: [{id, name, prompt_text, is_active, created_at}] | POST: {name, prompt_text} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/messenger/connections/{id}/prompts/{pid}/', 'Custom prompt CRUD',
             'Auth: Yes'),
            ('POST', '/api/messenger/connections/{id}/prompts/{pid}/activate/', 'Activate a custom prompt (deactivates others)',
             'Response: {id, name, is_active: true} | Auth: Yes'),
            ('POST', '/api/messenger/connections/{id}/crawl-website/', 'Crawl website and add to knowledge base',
             'Request: {url, max_pages?: 10} | Response: {pages_crawled, chunks_created, status} | Auth: Yes'),
            ('GET/PUT', '/api/messenger/connections/{id}/ecommerce/', 'E-commerce settings (WooCommerce)',
             'GET: {store_url, consumer_key_masked, is_connected, products_count, last_sync} | PUT: {store_url, consumer_key, consumer_secret} | Auth: Yes'),
            ('POST', '/api/messenger/connections/{id}/ecommerce/test/', 'Test WooCommerce connection',
             'Response: {status: "connected"|"failed", message, store_name?} | Auth: Yes'),
            ('POST', '/api/messenger/connections/{id}/ecommerce/sync/', 'Sync products from WooCommerce store',
             'Response: {synced_count, new_products, updated_products, status} | Auth: Yes'),
            ('POST', '/api/messenger/connections/{id}/ecommerce/embeddings/', 'Regenerate product embeddings for search',
             'Response: {products_processed, embeddings_created, status} | Auth: Yes'),
            ('GET', '/api/messenger/connections/{id}/ecommerce/products/', 'List synced products',
             'Query: ?search=&category=&page= | Response: {count, results: [{id, name, price, image_url, category, in_stock}]} | Auth: Yes'),
            ('GET/POST', '/api/messenger/notifications/', 'List/manage messenger notifications (ModelViewSet)',
             'GET: [{id, connection, event_type, message, is_read, created_at}] | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/messenger/notifications/{id}/', 'Notification detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/messenger/webhook/{page_id}/', 'Facebook Messenger Webhook (OUTSIDE /api/v1/)',
             'GET: webhook verification -- Facebook sends hub.mode, hub.verify_token, hub.challenge | POST: receives incoming messages, delivery receipts, read receipts -> MessageHandler processes and auto-replies | Auth: No (CSRF exempt) | URL: /messenger/webhook/{page_id}/'),
        ],
        'key_details': [
            ('RAG Pipeline Flow', [
                '1. PDF Upload -> PyPDF2 text extraction',
                '2. Text split into 500-char chunks with 50-char overlap',
                '3. Each chunk embedded via OpenAI text-embedding-ada-002',
                '4. On incoming message: embed query -> cosine similarity search',
                '5. Top 3 relevant chunks injected into LLM prompt as context',
                '6. LLM generates response grounded in actual knowledge base',
            ]),
            ('E-Commerce Chat Flow', [
                '1. User asks about a product in Messenger',
                '2. Bot embeds query -> searches product embeddings',
                '3. Matching products returned with name, price, image, link',
                '4. Bot can recommend alternatives, check stock, provide details',
            ]),
        ],
    },
    {
        'name': 'admin_panel',
        'title': 'Admin Panel',
        'importance': [
            'Super-admin dashboard for platform-wide management (requires IsOriginalAdmin permission)',
            'User approval/rejection workflow -- control who can access the platform',
            'User plan management -- upgrade/downgrade subscription tiers with custom limits',
            'Per-user content audit -- view any user\'s posts, captions, images, videos, messenger data',
            'Platform-wide analytics -- overall system metrics, daily trends, top users, token costs',
            'Bulk operations -- approve multiple users at once, manage API settings per user',
        ],
        'api_description': 'Admin-only REST endpoints for user management, content auditing, API key oversight, and platform analytics. All endpoints require IsOriginalAdmin (superuser) permission.',
        'endpoints': [
            ('GET', '/api/admin/dashboard/', 'Admin dashboard with system-wide stats',
             'Response: {total_users, pending_users, approved_users, total_posts, total_captions, total_images, total_videos, total_tokens_used, estimated_cost, pipeline_stats: {drafts, pending, approved, scheduled, published, failed}, queue_health} | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/', 'List all users with filters',
             'Query: ?status=pending|approved&search=&plan=free|starter|pro&page= | Response: {count, results: [{id, username, email, plan, is_approved, post_count, account_count, tokens_used, joined_at}]} | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/', 'Detailed user profile for admin audit',
             'Response: {id, username, email, profile, plan, is_approved, stats: {posts, captions, images, videos, voices}, token_usage: {total, by_provider}, cost_estimation, api_keys_status, joined_at, last_login} | Auth: Yes (Admin only)'),
            ('POST', '/api/admin/users/{id}/approve/', 'Approve a pending user registration',
             'Response: {message, user_id, is_approved: true} | Auth: Yes (Admin only) | Sends notification to user'),
            ('POST', '/api/admin/users/{id}/reject/', 'Reject a user registration',
             'Response: {message, user_id, is_approved: false} | Auth: Yes (Admin only)'),
            ('PUT/PATCH', '/api/admin/users/{id}/plan/', 'Update user subscription plan and limits',
             'Request: {plan: "free"|"starter"|"pro"|"business"|"enterprise", max_posts?, max_accounts?} | Response: {user_id, plan, max_posts, max_accounts} | Auth: Yes (Admin only)'),
            ('GET/PUT/PATCH', '/api/admin/users/{id}/api-settings/', 'View/manage user API key settings',
             'GET: {caption_settings, image_settings, video_settings, messenger_config, admin_managed} | PUT: {admin_managed?: bool, openai_api_key?, gemini_api_key?} | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/posts/', 'View all posts by a specific user',
             'Response: [{id, title, status, platform, created_at}] | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/accounts/', 'View user\'s connected social accounts',
             'Response: [{id, platform, username, is_active}] | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/captions/', 'View user\'s generated captions with stats',
             'Response: {captions: [{id, body, platform, created_at}], stats: {total, completed, failed, tokens_used, estimated_cost}} | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/images/', 'View user\'s generated images',
             'Response: [{id, prompt, image_url, provider, created_at}] | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/videos/', 'View user\'s generated videos',
             'Response: [{id, prompt, video_url, duration, created_at}] | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/users/{id}/messenger/', 'View user\'s messenger connections and conversations',
             'Response: {connections: [{id, page_name, conversations_count}], recent_conversations: []} | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/conversations/{conv_id}/messages/', 'View conversation messages for audit',
             'Response: {messages: [{id, direction, body, is_bot, created_at}], stats: {total, bot_messages, user_messages, avg_response_time}} | Auth: Yes (Admin only)'),
            ('GET', '/api/admin/analytics/', 'Platform-wide analytics',
             'Query: ?days=30 | Response: {daily_posts: [{date, count}], daily_captions: [{date, count}], top_users: [{username, post_count}], platform_stats: [{platform, posts}]} | Auth: Yes (Admin only)'),
            ('POST', '/api/admin/bulk-approve/', 'Bulk approve multiple pending users at once',
             'Request: {user_ids: [1, 2, 3]} | Response: {approved_count, success: true} | Auth: Yes (Admin only)'),
        ],
        'key_details': [],
    },
    {
        'name': 'hashtags',
        'title': 'Hashtag Engine',
        'importance': [
            'AI-powered hashtag generation using Claude for platform-optimized hashtag sets',
            'Hashtag groups -- save and reuse curated hashtag collections per brand',
            'Banned hashtags -- brand-level blocklist to prevent unwanted tags',
            'Draft-scoped hashtags with toggle (select/deselect) per hashtag',
            'Placement control: inline (within caption) or comment (first comment)',
        ],
        'api_description': 'Hashtag generation, groups, banned lists, and draft-scoped management. AI generates hashtags based on caption content, brand, and platform best practices.',
        'endpoints': [
            ('GET', '/api/drafts/{post_id}/hashtags/', 'Get all hashtags for a specific draft',
             'Response: [{id, tag, is_selected, placement: "inline"|"comment", relevance_score, created_at}] | Auth: Yes'),
            ('POST', '/api/drafts/{post_id}/hashtags/generate/', 'Generate hashtags for a draft using Claude AI',
             'Request: {platform?, count?: 15, topic?, override_prompt?} | Response: {hashtags: [{tag, relevance_score}], used_prompt} | Auth: Yes | Rate limited, filters against BannedHashtag list'),
            ('PATCH', '/api/hashtags/{id}/', 'Toggle or update a hashtag',
             'Request: {is_selected?: bool, placement?: "inline"|"comment"} | Response: {id, tag, is_selected, placement} | Auth: Yes'),
            ('GET/POST', '/api/hashtag-groups/', 'List/create hashtag groups (ModelViewSet)',
             'GET: [{id, brand, name, tags: [], use_count}] | Query: ?brand_id= | POST: {brand, name, tags: ["#marketing", "#ai"]} | Auth: Yes'),
            ('GET/PUT/PATCH/DELETE', '/api/hashtag-groups/{id}/', 'Hashtag group detail CRUD',
             'Auth: Yes'),
            ('GET/POST', '/api/banned-hashtags/', 'List/create banned hashtags (ModelViewSet)',
             'GET: [{id, brand, tag, reason, created_at}] | Query: ?brand_id= | POST: {brand, tag, reason?} | Auth: Yes'),
            ('GET/PUT/DELETE', '/api/banned-hashtags/{id}/', 'Banned hashtag detail CRUD',
             'Auth: Yes'),
        ],
        'key_details': [],
    },
    {
        'name': 'approval_workflow',
        'title': 'Approval Pipeline',
        'importance': [
            'Content approval workflow: Submit -> Review -> Approve/Reject/Request Changes',
            'Role-based approvals -- only Approvers (IsApproverOrAbove) and Admins can approve content',
            'Audit trail -- complete log of who approved/rejected and when with comments',
            'Pre-publish checklist -- ensures quality before content goes live (images, captions, hashtags verified)',
            'Request changes flow -- reviewers can ask for specific edits with feedback comments',
        ],
        'api_description': 'Approval pipeline for content review before publishing. Integrates with RBAC roles. All approval actions create audit log entries.',
        'endpoints': [
            ('POST', '/api/drafts/{post_id}/submit/', 'Submit draft for approval',
             'Request: {comment?} | Response: {message, post_id, status: "pending_approval"} | Auth: Yes (Creator+) | Validates checklist completeness before allowing submission | Sends notification to Approvers'),
            ('POST', '/api/drafts/{post_id}/approve/', 'Approve a submitted draft',
             'Request: {comment?} | Response: {message, post_id, status: "approved"} | Auth: Yes (Approver+ only) | Creates approval log entry | Sends notification to Creator'),
            ('POST', '/api/drafts/{post_id}/request-changes/', 'Request changes on a pending draft',
             'Request: {comment: "required feedback"} | Response: {message, post_id, status: "changes_requested"} | Auth: Yes (Approver+) | Post returns to draft status | Sends notification to Creator'),
            ('POST', '/api/drafts/{post_id}/reject/', 'Reject a draft',
             'Request: {rejection_reason, comment?} | Response: {message, post_id, status: "rejected"} | Auth: Yes (Approver+) | Terminal state | Sends notification'),
            ('GET', '/api/approvals/pending/', 'List all pending approvals for current user',
             'Response: [{post_id, title, brand, submitted_by, submitted_at, comment}] | Auth: Yes (Approver+ only) | Filters by workspace membership'),
            ('GET', '/api/drafts/{post_id}/approval-log/', 'View approval audit trail for a post',
             'Response: [{id, action: "submitted"|"approved"|"rejected"|"changes_requested", user, comment, created_at}] -- ordered by created_at DESC | Auth: Yes'),
            ('GET/POST/PUT', '/api/drafts/{post_id}/checklist/', 'View/update pre-publish checklist',
             'GET Response: {items: [{name, is_checked, auto_checked}], is_complete} | POST/PUT: {items: [{name, is_checked}]} | Auth: Yes | Auto-checks: has_caption, has_image, has_platform'),
        ],
        'key_details': [],
    },
    {
        'name': 'creative_assets',
        'title': 'Creative Assets & Export',
        'importance': [
            'Post asset management -- attach images/videos/files to draft posts (max 4 per draft)',
            'AI alt-text generation for image accessibility compliance',
            'Image resizing for platform-specific dimensions (Instagram Story 1080x1920, Feed 1080x1080, etc.)',
            'Brand template application -- overlay brand visual template on any asset',
            'Asset versioning -- track all versions with generation params history',
            'Carousel splitting -- AI-powered split of long-form content into multi-slide carousels with generated images',
        ],
        'api_description': 'Asset management, AI generation, transformation, versioning, and export. Integrates with AI image generation, brand templates, and platform dimension specs.',
        'endpoints': [
            ('GET', '/api/posts/{post_id}/assets/', 'List assets attached to a post',
             'Response: [{id, title, file_url, asset_type, dimensions, prompt, style, is_primary, version, created_at}] | Auth: Yes'),
            ('GET', '/api/drafts/{post_id}/assets/', 'List assets for a draft (alias)',
             'Same response as above | Auth: Yes'),
            ('POST', '/api/drafts/{post_id}/assets/generate/', 'AI-generate image asset for draft',
             'Request: {prompt, style?, size?, title?} | Response: {asset_id, post_id, title, status, image_url, prompt} | Auth: Yes | Max 4 images per draft'),
            ('POST', '/api/drafts/{post_id}/assets/upload/', 'Upload asset file to draft',
             'Request: multipart {file, title?} | Response: {asset_id, post_id, title, image_url, dimensions} | Auth: Yes | Max 4 per draft'),
            ('POST', '/api/drafts/{post_id}/assets/carousel-split/', 'Split long-form content into carousel slides with AI',
             'Request: {content, max_slides?: 10, style?} | Response: {slides: [{slide_number, headline, body, image_url}]} | Auth: Yes | Phase 1: LLM splits content, Phase 2: generates image per slide'),
            ('POST', '/api/assets/{id}/alt-text/', 'AI-generate alt text for accessibility',
             'Response: {asset_id, alt_text} | Auth: Yes | Uses image analysis + brand context'),
            ('POST', '/api/assets/{id}/resize/', 'Resize asset for platform-specific dimensions',
             'Request: {platforms: ["instagram_story", "instagram_feed", "facebook_cover", "twitter_header", "linkedin_banner"]} | Response: {asset_id, variants: [{platform, width, height, file_url}]} | Auth: Yes'),
            ('POST', '/api/assets/{id}/apply-template/', 'Apply brand visual template to asset',
             'Request: {template_id} | Response: {asset_id, message, new_version} | Auth: Yes'),
            ('GET', '/api/assets/{id}/versions/', 'View all versions of an asset',
             'Response: [{id, version, file_url, generation_params, created_at}] | Auth: Yes'),
            ('POST', '/api/assets/{id}/regenerate/', 'Regenerate asset with new/modified params',
             'Request: {prompt?, style?} | Response: {asset_id, version, status, image_url} | Auth: Yes | Saves old version to CreativeVersionHistory'),
        ],
        'key_details': [],
    },
    {
        'name': 'notifications',
        'title': 'Notification Engine',
        'importance': [
            'In-app notification system for all platform events (approval requests, publish results, comments, mentions)',
            'Real-time unread count tracking for notification badge in UI',
            'Bulk mark-all-read for quick notification management',
            'Event-driven: triggered by approval_service, publishing_service, comment handlers, RBAC changes',
        ],
        'api_description': 'Notification listing with filters, read status management, and deletion. Events: approval_requested, post_approved, post_rejected, changes_requested, post_published, post_failed, new_comment, mention.',
        'endpoints': [
            ('GET', '/api/notifications/', 'List all notifications (paginated)',
             'Query: ?event_type=&is_read=true|false&limit=50 | Response: {count, unread_count, notifications: [{id, event_type, title, message, is_read, related_post_id?, created_at}]} | Auth: Yes'),
            ('GET', '/api/notifications/unread-count/', 'Get unread notification count for badge',
             'Response: {unread_count} | Auth: Yes'),
            ('POST/PATCH', '/api/notifications/mark-all-read/', 'Mark all notifications as read',
             'Response: {marked_count} | Auth: Yes'),
            ('POST/PATCH', '/api/notifications/{id}/read/', 'Mark single notification as read',
             'Response: {id, is_read: true} | Auth: Yes'),
            ('DELETE', '/api/notifications/{id}/', 'Delete a notification',
             'Response: 204 No Content | Auth: Yes'),
        ],
        'key_details': [],
    },
    {
        'name': 'rbac',
        'title': 'Role-Based Access Control (RBAC)',
        'importance': [
            'Workspace-level role management for team collaboration',
            '6 roles: Owner (auto-assigned), Admin, Creator, Approver, Publisher, Viewer',
            'Role assignment/removal by workspace Owner and Admins',
            'Permission checks enforced on all content operations via custom DRF permissions',
        ],
        'api_description': 'RBAC management for workspace member roles. Roles determine access to content creation, approval, publishing, and analytics.',
        'endpoints': [
            ('GET', '/api/workspaces/{id}/roles/', 'List all role assignments for a workspace',
             'Response: {owner: {id, username}, roles: [{id, user: {id, username, email}, role: "admin"|"creator"|"approver"|"publisher"|"viewer", assigned_at}]} | Auth: Yes'),
            ('POST', '/api/workspaces/{id}/roles/assign/', 'Assign role to a user in workspace',
             'Request: {user_id, role: "admin"|"creator"|"approver"|"publisher"|"viewer"} | Response: {id, user, role, created: bool} | Auth: Yes (Owner/Admin only)'),
            ('POST', '/api/workspaces/{id}/roles/remove/', 'Remove role from a user',
             'Request: {user_id, role} | Response: {message} | Auth: Yes (Owner/Admin only) | Cannot remove Owner role'),
            ('GET', '/api/my-roles/', 'Get current user\'s roles across all workspaces',
             'Response: {roles: [{workspace_id, workspace_name, role}]} | Auth: Yes'),
        ],
        'key_details': [],
    },
]


# ══════════════════════════════════════════════════════════════════════════
# SUMMARY TABLE
# ══════════════════════════════════════════════════════════════════════════
doc.add_heading('Summary of All Applications', level=1)

total_endpoints = sum(len(a['endpoints']) for a in apps_data)
p = doc.add_paragraph()
r = p.add_run(f'Total: {len(apps_data)} application modules  |  {total_endpoints} API endpoints  |  All with request/response details')
r.font.size = Pt(10); r.font.color.rgb = GRAY

summary_rows = []
for i, app in enumerate(apps_data, 1):
    summary_rows.append((
        str(i),
        app['title'],
        app['name'],
        app['importance'][0][:90] + ('...' if len(app['importance'][0]) > 90 else ''),
        str(len(app['endpoints'])),
    ))

add_styled_table(
    ['#', 'App Name', 'Package', 'Key Benefit', 'Endpoints'],
    summary_rows,
    col_widths=[1, 4.5, 2.5, 8.5, 2],
)

doc.add_page_break()


# ══════════════════════════════════════════════════════════════════════════
# DETAILED SECTIONS PER APP
# ══════════════════════════════════════════════════════════════════════════
for idx, app in enumerate(apps_data, 1):
    doc.add_heading(f'{idx}. {app["title"]}', level=1)

    # Package name
    p = doc.add_paragraph()
    r = p.add_run('Django App: ')
    r.bold = True; r.font.size = Pt(10)
    r = p.add_run(app['name'])
    r.font.size = Pt(10); r.font.color.rgb = BLUE

    # ── Importance & Benefits ──
    doc.add_heading('Importance & Benefits', level=2)
    for benefit in app['importance']:
        p = doc.add_paragraph(style='List Bullet')
        r = p.add_run(benefit)
        r.font.size = Pt(10)

    # ── API Description ──
    doc.add_heading('API Overview', level=2)
    p = doc.add_paragraph()
    r = p.add_run(app['api_description'])
    r.font.size = Pt(10)

    # ── Endpoints Table ──
    doc.add_heading('Endpoints', level=2)

    p = doc.add_paragraph()
    r = p.add_run(f'{len(app["endpoints"])} endpoints')
    r.font.size = Pt(9); r.font.color.rgb = GRAY; r.italic = True

    endpoint_rows = []
    for ep in app['endpoints']:
        method, path, desc = ep[0], ep[1], ep[2]
        endpoint_rows.append((method, path, desc))

    add_styled_table(
        ['Method', 'Endpoint', 'Description'],
        endpoint_rows,
        col_widths=[2.5, 8, 7],
    )

    # ── Detailed Request/Response for each endpoint ──
    doc.add_heading('Endpoint Details (Request / Response)', level=2)

    for ep in app['endpoints']:
        if len(ep) >= 4 and ep[3]:
            method, path, desc, detail = ep[0], ep[1], ep[2], ep[3]
            p = doc.add_paragraph()
            r = p.add_run(f'{method}  {path}')
            r.bold = True; r.font.size = Pt(9); r.font.color.rgb = BLUE; r.font.name = 'Consolas'

            # Parse detail string into formatted lines
            parts = detail.split(' | ')
            for part in parts:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.5)
                p.paragraph_format.space_after = Pt(1)
                r = p.add_run(part.strip())
                r.font.size = Pt(8.5); r.font.name = 'Consolas'

            doc.add_paragraph()  # spacer

    # ── Key Details (if any) ──
    if app.get('key_details'):
        doc.add_heading('Key Implementation Details', level=2)
        for title, lines in app['key_details']:
            p = doc.add_paragraph()
            r = p.add_run(title)
            r.bold = True; r.font.size = Pt(10); r.font.color.rgb = DARK
            for line in lines:
                p = doc.add_paragraph(style='List Bullet')
                p.paragraph_format.left_indent = Cm(1)
                r = p.add_run(line)
                r.font.size = Pt(9)

    # Page break between apps
    if idx < len(apps_data):
        doc.add_page_break()


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT COUNT SUMMARY
# ══════════════════════════════════════════════════════════════════════════
doc.add_page_break()
doc.add_heading('Endpoint Count by Category', level=1)

count_rows = []
total = 0
for app in apps_data:
    count = len(app['endpoints'])
    total += count
    count_rows.append((app['title'], str(count)))
count_rows.append(('TOTAL', str(total)))

add_styled_table(
    ['Application Module', 'Endpoint Count'],
    count_rows,
    col_widths=[10, 4],
)

# Footer
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('--- End of Document ---')
r.font.size = Pt(12); r.font.color.rgb = GRAY; r.italic = True


# ══════════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════════
try:
    doc.save(OUTPUT)
    print(f'Generated: {OUTPUT}')
except PermissionError:
    alt = OUTPUT.replace('.docx', '_v2.docx')
    doc.save(alt)
    print(f'Generated (alt): {alt}')

print(f'Apps: {len(apps_data)}')
print(f'Total endpoints: {total_endpoints}')
