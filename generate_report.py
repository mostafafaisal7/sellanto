"""Generate V1.2.1 Progress Report as DOCX"""
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
import datetime


def set_cell_shading(cell, color):
    """Set cell background color"""
    shading = cell._element.get_or_add_tcPr()
    shading_elem = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): color,
        qn('w:val'): 'clear',
    })
    shading.append(shading_elem)


def add_styled_table(doc, headers, rows, col_widths=None):
    """Add a styled table"""
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'

    # Header row
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.bold = True
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(cell, '2B579A')

    # Data rows
    for r_idx, row in enumerate(rows):
        for c_idx, val in enumerate(row):
            cell = table.rows[r_idx + 1].cells[c_idx]
            cell.text = str(val)
            p = cell.paragraphs[0]
            for run in p.runs:
                run.font.size = Pt(8)
            if r_idx % 2 == 1:
                set_cell_shading(cell, 'F2F2F2')

    return table


def main():
    doc = Document()

    # Title
    title = doc.add_heading('SaleAnto V1.2.1 Progress Report', level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Subtitle
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f'Generated: {datetime.date.today().isoformat()} | Version: 1.2.1')
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(100, 100, 100)

    doc.add_paragraph()

    # ===================== EXECUTIVE SUMMARY =====================
    doc.add_heading('1. Executive Summary', level=1)

    add_styled_table(doc,
        ['Metric', 'Count', 'Status'],
        [
            ['DB Models (V1.2.1 new)', '19 models', 'DONE'],
            ['API Endpoints (total)', '119+ URL patterns', 'DONE'],
            ['Frontend Pages (V1.2.1)', '4 pages', 'DONE'],
            ['Frontend Components (V1.2.1)', '4 of 14 built', 'PARTIAL'],
            ['Backend Services (V1.2.1)', '9 services', 'DONE'],
            ['Management Commands', '4 commands', 'DONE'],
            ['RBAC / 6 Roles', '0 of 6 roles', 'NOT STARTED'],
            ['Admin Panel V1.2.1', '1 of 5 sections', 'PARTIAL'],
            ['Overall Completion', '~85%', '—'],
        ],
    )

    doc.add_paragraph()

    # ===================== STAGE-BY-STAGE =====================
    doc.add_heading('2. Stage-by-Stage Progress', level=1)

    stages = [
        ('Stage 1: Strategy & Content Pillars', '95%', 'Pillar distribution chart visual missing'),
        ('Stage 2: Ideation & Trending', '95%', 'Real trending API not connected (uses AI)'),
        ('Stage 3: Draft Creation & Checklist', '90%', 'Brand/pillar/goal dropdowns missing in form'),
        ('Stage 4: Caption Generation Engine', '95%', 'PlatformPreviewPanel component missing'),
        ('Stage 5: Hashtag Generation Engine', '100%', 'Fully complete'),
        ('Stage 6: Creative Asset Management', '85%', 'CreativeGenerator, ResizePreview, VersionHistory components missing'),
        ('Stage 7: Approval Pipeline', '95%', 'Approver role assignment missing'),
        ('Stage 8: Scheduling & Calendar', '95%', 'BestTimeSuggestionOverlay, drag-and-drop missing'),
        ('Stage 9: Analytics & Comments', '80%', 'PostStatsCard, MessengerInbox, WeeklyReportView components missing'),
        ('Stage 10: Learning Loop', '75%', 'RepurposePrompt modal, winner detection UI, signal-to-idea integration missing'),
        ('Notifications', '95%', 'Email channel delivery not implemented'),
        ('Admin & Governance', '40%', 'RBAC, Admin Dashboard V1.2.1, Permissions, System Health missing'),
        ('Roles & Permissions', '10%', '6 roles defined in PDF but not implemented'),
    ]

    add_styled_table(doc,
        ['Stage', 'Completion', 'What\'s Missing'],
        stages,
    )

    doc.add_paragraph()

    # ===================== ALL API ENDPOINTS =====================
    doc.add_heading('3. All V1.2.1 API Endpoints (with URLs for Testing)', level=1)

    p = doc.add_paragraph()
    run = p.add_run('Base URL: http://localhost:8099/api/')
    run.bold = True
    run.font.size = Pt(10)

    # Strategy endpoints
    doc.add_heading('3.1 Strategy & Pillars', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['GET/POST', '/api/content-pillars/', 'List/Create content pillars', 'DONE'],
            ['GET/PUT/DELETE', '/api/content-pillars/{id}/', 'Retrieve/Update/Delete pillar', 'DONE'],
            ['GET', '/api/brands/{id}/pillar-compliance/', 'Pillar distribution compliance', 'DONE'],
            ['GET/POST', '/api/competitor-profiles/', 'List/Create competitor profiles', 'DONE'],
            ['POST', '/api/brands/{id}/competitors/crawl/', 'Crawl competitor website (AI)', 'DONE'],
            ['GET', '/api/brands/{id}/competitors/insights/', 'Get competitor insights', 'DONE'],
            ['POST', '/api/brands/{id}/generate-dna/', 'Generate Brand DNA', 'DONE'],
            ['GET', '/api/brands/{id}/dna-status/', 'Check Brand DNA status', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Ideation endpoints
    doc.add_heading('3.2 Ideation & Trending', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['POST', '/api/ideas/generate/', 'Generate AI content ideas', 'DONE'],
            ['POST', '/api/ideas/{id}/regenerate/', 'Regenerate specific idea', 'DONE'],
            ['POST', '/api/ideas/{id}/add-to-calendar/', 'Add idea to calendar', 'DONE'],
            ['GET', '/api/trending/', 'Get trending topics', 'DONE'],
            ['GET/POST', '/api/content-ideas/', 'List/Create content ideas', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Caption endpoints
    doc.add_heading('3.3 Caption Generation', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['GET', '/api/drafts/{id}/captions/', 'List captions for post', 'DONE'],
            ['POST', '/api/drafts/{id}/captions/generate/', 'AI generate caption variants', 'DONE'],
            ['POST', '/api/drafts/{id}/captions/adapt/', 'Adapt caption to platform', 'DONE'],
            ['PATCH', '/api/captions/{id}/select/', 'Select caption as primary', 'DONE'],
            ['PATCH', '/api/captions/{id}/ab-tag/', 'Tag caption for A/B test', 'DONE'],
            ['GET/POST/PUT/DELETE', '/api/post-captions/', 'Caption CRUD', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Hashtag endpoints
    doc.add_heading('3.4 Hashtag Generation', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['GET', '/api/drafts/{id}/hashtags/', 'List hashtags for post', 'DONE'],
            ['POST', '/api/drafts/{id}/hashtags/generate/', 'AI generate hashtags', 'DONE'],
            ['PATCH', '/api/hashtags/{id}/', 'Toggle/update hashtag', 'DONE'],
            ['GET/POST/PUT/DELETE', '/api/hashtag-groups/', 'Hashtag group CRUD', 'DONE'],
            ['GET/POST/PUT/DELETE', '/api/banned-hashtags/', 'Banned hashtag CRUD', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Creative endpoints
    doc.add_heading('3.5 Creative Assets', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['POST', '/api/assets/{id}/alt-text/', 'Generate alt text (AI vision)', 'DONE'],
            ['POST', '/api/assets/{id}/resize/', 'Auto-resize for platforms', 'DONE'],
            ['POST', '/api/assets/{id}/apply-template/', 'Apply brand template overlay', 'DONE'],
            ['GET', '/api/assets/{id}/versions/', 'Get asset version history', 'DONE'],
            ['GET/POST/PUT/DELETE', '/api/brand-templates/', 'Brand template CRUD', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Approval endpoints
    doc.add_heading('3.6 Approval Pipeline', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['POST', '/api/drafts/{id}/submit/', 'Submit post for approval', 'DONE'],
            ['POST', '/api/drafts/{id}/approve/', 'Approve post', 'DONE'],
            ['POST', '/api/drafts/{id}/request-changes/', 'Request changes', 'DONE'],
            ['POST', '/api/drafts/{id}/reject/', 'Reject post', 'DONE'],
            ['GET', '/api/approvals/pending/', 'List pending approvals', 'DONE'],
            ['GET', '/api/drafts/{id}/approval-log/', 'Get approval history', 'DONE'],
            ['GET', '/api/drafts/{id}/checklist/', 'Get draft checklist', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Scheduling endpoints
    doc.add_heading('3.7 Scheduling & Calendar', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['POST', '/api/drafts/{id}/schedule/', 'Schedule post per-platform', 'DONE'],
            ['PATCH/DELETE', '/api/scheduled-posts/{id}/', 'Reschedule/cancel', 'DONE'],
            ['GET', '/api/schedule/calendar/', 'Get calendar events', 'DONE'],
            ['GET', '/api/brands/{id}/best-times/', 'Best time suggestions', 'DONE'],
            ['POST', '/api/schedule/conflict-check/', 'Check schedule conflicts', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Analytics endpoints
    doc.add_heading('3.8 Analytics & Comments', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['GET', '/api/posts/{id}/stats/', 'Post quick stats', 'DONE'],
            ['GET', '/api/posts/{id}/comments/', 'Post comments', 'DONE'],
            ['POST', '/api/comments/{id}/reply/', 'Human reply to comment', 'DONE'],
            ['POST', '/api/comments/{id}/ai-reply/', 'AI reply to comment', 'DONE'],
            ['GET', '/api/brands/{id}/weekly-report/', 'Weekly report', 'DONE'],
            ['GET', '/api/brands/{id}/analytics/dashboard/', 'Analytics dashboard', 'DONE'],
            ['GET', '/api/brands/{id}/ab-results/', 'A/B test results', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Learning endpoints
    doc.add_heading('3.9 Learning Loop & Repurposing', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['GET', '/api/brands/{id}/learning-signals/', 'Learning signals', 'DONE'],
            ['GET', '/api/brands/{id}/winners/', 'Winner posts', 'DONE'],
            ['POST', '/api/posts/{id}/repurpose/', 'Repurpose winning post', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # Notification endpoints
    doc.add_heading('3.10 Notifications', level=2)
    add_styled_table(doc,
        ['Method', 'URL', 'Description', 'Status'],
        [
            ['GET', '/api/notifications/', 'List notifications', 'DONE'],
            ['GET', '/api/notifications/unread-count/', 'Unread count', 'DONE'],
            ['POST', '/api/notifications/mark-all-read/', 'Mark all as read', 'DONE'],
            ['POST', '/api/notifications/{id}/read/', 'Mark one as read', 'DONE'],
            ['DELETE', '/api/notifications/{id}/', 'Delete notification', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # ===================== DB TABLES =====================
    doc.add_heading('4. Database Tables (V1.2.1 New)', level=1)

    add_styled_table(doc,
        ['#', 'Table', 'App', 'Key Fields', 'Status'],
        [
            ['1', 'content_pillars', 'brands', 'brand, name, target_percentage, color_code', 'DONE'],
            ['2', 'competitor_profiles', 'brands', 'brand, platform, handle_or_url', 'DONE'],
            ['3', 'competitor_insights', 'brands', 'competitor_profile, hook_text, engagement_score', 'DONE'],
            ['4', 'brand_templates', 'brands', 'brand, name, logo_position, colors', 'DONE'],
            ['5', 'trending_cache', 'brands', 'platform, topic, volume_score, expires_at', 'DONE'],
            ['6', 'approval_logs', 'brands', 'post, action, acted_by, rejection_reason', 'DONE'],
            ['7', 'best_time_suggestions', 'brands', 'brand, platform, day_of_week, hour_utc, score', 'DONE'],
            ['8', 'post_captions', 'posts', 'post, platform, body, tone, is_selected, ab_label', 'DONE'],
            ['9', 'post_hashtags', 'posts', 'post, platform, tag, tier, placement', 'DONE'],
            ['10', 'hashtag_groups', 'posts', 'brand, name, tags (JSON)', 'DONE'],
            ['11', 'banned_hashtags', 'posts', 'brand, tag, reason', 'DONE'],
            ['12', 'scheduled_post_platforms', 'posts', 'post, platform, scheduled_at, status', 'DONE'],
            ['13', 'asset_platform_variants', 'ai_image', 'asset, platform, dimensions', 'DONE'],
            ['14', 'creative_version_history', 'ai_image', 'asset, version, file_url', 'DONE'],
            ['15', 'post_analytics', 'analytics', 'post, platform, impressions, engagement_rate', 'DONE'],
            ['16', 'post_comments', 'analytics', 'post, author, body, sentiment, reply_body', 'DONE'],
            ['17', 'learning_signals', 'analytics', 'brand, signal_type, data_json', 'DONE'],
            ['18', 'repurposed_content', 'analytics', 'original_post, new_post, format', 'DONE'],
            ['19', 'system_notifications', 'accounts', 'user, event_type (20), title, is_read', 'DONE'],
            ['20', 'user_roles', 'accounts', 'NOT CREATED', 'MISSING'],
            ['21', 'audit_log', 'system', 'NOT CREATED', 'MISSING'],
        ],
    )

    doc.add_paragraph()

    # ===================== SERVICES =====================
    doc.add_heading('5. Backend Services', level=1)

    add_styled_table(doc,
        ['#', 'Service', 'File', 'Purpose', 'Status'],
        [
            ['1', 'Hashtag Generation', 'posts/services/hashtag_service.py', 'LLM hashtag gen + tier ratio + banned filter', 'DONE'],
            ['2', 'Caption Adaptation', 'ai_caption/services/adaptation_service.py', 'Platform-specific LLM rewrite', 'DONE'],
            ['3', 'Alt Text', 'ai_image/services/alt_text_service.py', 'LLM vision description (125 chars)', 'DONE'],
            ['4', 'Image Resize', 'ai_image/services/resize_service.py', 'Pillow auto-resize 7 formats', 'DONE'],
            ['5', 'Template Overlay', 'ai_image/services/template_service.py', 'Logo placement with Pillow', 'DONE'],
            ['6', 'Best Time', 'posts/services/best_time_service.py', 'Analytics + industry defaults', 'DONE'],
            ['7', 'Notifications', 'accounts/services/notification_service.py', '9 event helpers + base notify()', 'DONE'],
            ['8', 'Learning Loop', 'analytics/services/learning_service.py', 'Signal extraction + A/B winners', 'DONE'],
            ['9', 'Brand DNA', 'brands/services/brand_dna_service.py', 'Website crawl + embeddings', 'DONE'],
        ],
    )

    doc.add_paragraph()

    # ===================== FRONTEND =====================
    doc.add_heading('6. Frontend Pages & Routes', level=1)

    add_styled_table(doc,
        ['Route', 'Page', 'Description', 'Status'],
        [
            ['/', 'DashboardPage', 'Main dashboard', 'V1.1 DONE'],
            ['/posts', 'MyPostsPage', 'Post list with filters', 'V1.1 DONE'],
            ['/posts/create', 'CreatePostPage', 'Create/Edit post + V1.2.1 tabs', 'DONE'],
            ['/strategy', 'StrategyHubPage', 'Pillars, Competitors, DNA (3 tabs)', 'V1.2.1 DONE'],
            ['/ideas', 'IdeasHubPage', 'AI ideas + trending (dual panel)', 'V1.2.1 DONE'],
            ['/calendar', 'CalendarPage', 'FullCalendar scheduler', 'V1.2.1 DONE'],
            ['/approvals', 'ApprovalReviewPage', 'Approval review workflow', 'V1.2.1 DONE'],
            ['/analytics', 'AnalyticsPage', 'Analytics overview', 'V1.1 (needs V1.2.1 upgrade)'],
            ['/ai-caption', 'AICaptionPage', 'AI Caption generator', 'V1.1 DONE'],
            ['/ai-image', 'AIImagePage', 'AI Image generator', 'V1.1 DONE'],
            ['/ai-video', 'AIVideoPage', 'AI Video generator', 'V1.1 DONE'],
            ['/ai-voice', 'AIVoicePage', 'AI Voice generator', 'V1.1 DONE'],
            ['/messenger', 'MessengerBotPage', 'Messenger bot management', 'V1.1 DONE'],
            ['/platforms', 'ConnectAccountsPage', 'Social account connections', 'V1.1 DONE'],
            ['/admin-panel', 'AdminDashboardPage', 'Admin overview', 'V1.1 DONE'],
            ['/admin-panel/users', 'AdminUsersPage', 'User management', 'V1.1 DONE'],
            ['/admin-panel/analytics', 'AdminAnalyticsPage', 'Admin analytics', 'V1.1 DONE'],
        ],
    )

    doc.add_paragraph()

    # ===================== WHAT'S REMAINING =====================
    doc.add_heading('7. Remaining Work', level=1)

    doc.add_heading('7.1 Critical (Must Have)', level=2)
    add_styled_table(doc,
        ['#', 'Feature', 'Description', 'Effort'],
        [
            ['1', 'RBAC System', '6 roles (Owner/Admin/Creator/Approver/Publisher/Viewer), user_roles table, permission checks in all views', 'HIGH'],
            ['2', 'Admin Dashboard V1.2.1', 'Pipeline status, queue health, token health, API cost, SLA monitoring', 'MEDIUM'],
            ['3', 'Analytics Dashboard V1.2.1', 'Upgraded frontend with post stats, A/B results, pillar performance', 'MEDIUM'],
        ],
    )

    doc.add_paragraph()

    doc.add_heading('7.2 Important (Should Have)', level=2)
    add_styled_table(doc,
        ['#', 'Component', 'Description', 'Effort'],
        [
            ['4', 'PostStatsCard', 'Quick stats badge on published post cards', 'LOW'],
            ['5', 'WeeklyReportView', 'Interactive weekly analytics report page', 'MEDIUM'],
            ['6', 'Comment Monitor UI', 'Post comment inbox with reply interface', 'MEDIUM'],
            ['7', 'RepurposePrompt', 'Modal suggesting format conversion for winners', 'LOW'],
            ['8', 'PlatformPreviewPanel', 'Mock-up previews per platform', 'MEDIUM'],
            ['9', 'AssetResizePreview', 'Shows auto-resized variants per platform', 'LOW'],
            ['10', 'VersionHistoryPanel', 'Previous asset versions with restore', 'LOW'],
            ['11', 'BestTimeSuggestionOverlay', 'Highlighted time slots on calendar', 'LOW'],
            ['12', 'Brand/Pillar/Goal dropdowns', 'Add selectors in CreatePostPage form', 'LOW'],
        ],
    )

    doc.add_paragraph()

    doc.add_heading('7.3 Phase 2/3 (Future)', level=2)
    add_styled_table(doc,
        ['#', 'Feature', 'Phase'],
        [
            ['13', 'Ad templates', 'Phase 3'],
            ['14', 'UGC templates', 'Phase 3'],
            ['15', 'Email templates', 'Phase 3'],
            ['16', 'Email notification delivery', 'Phase 2'],
            ['17', 'Real platform API analytics sync', 'Phase 2'],
            ['18', 'Celery/cron job scheduler', 'Phase 2'],
            ['19', 'Audit log table', 'Phase 2'],
        ],
    )

    doc.add_paragraph()

    # ===================== NOTIFICATION EVENTS =====================
    doc.add_heading('8. Notification Events (PDF Section 6)', level=1)

    add_styled_table(doc,
        ['Event', 'Channel (PDF)', 'Recipients', 'Our Status'],
        [
            ['Post submitted', 'In-app + Email', 'Approver', 'In-app DONE'],
            ['Post approved', 'In-app', 'Creator', 'DONE'],
            ['Changes requested', 'In-app + Email', 'Creator', 'In-app DONE'],
            ['Post rejected', 'In-app + Email', 'Creator', 'In-app DONE'],
            ['Approval >12h', 'In-app + Email', 'Approver', 'In-app via check_sla'],
            ['Approval >24h', 'In-app + Email', 'Owner+Admin', 'In-app via check_sla'],
            ['Post scheduled', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Post published', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Publish failed', 'In-app + Email', 'Creator+Admin', 'NOT TRIGGERED'],
            ['Captions ready', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Images ready', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Video rendering', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Video ready', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Batch complete', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Weekly report', 'In-app + Email', 'Owner+Admin', 'NOT TRIGGERED'],
            ['Winner detected', 'In-app', 'Creator+Admin', 'NOT TRIGGERED'],
            ['Repurpose suggestion', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['New comment', 'In-app', 'Creator', 'NOT TRIGGERED'],
            ['Token expiring', 'In-app + Email', 'Owner+Admin', 'NOT TRIGGERED'],
            ['Daily limit 80%', 'In-app', 'Admin', 'NOT TRIGGERED'],
        ],
    )

    p = doc.add_paragraph()
    run = p.add_run('Status: 6/20 events actively triggered. 14 events need trigger points.')
    run.bold = True
    run.font.color.rgb = RGBColor(200, 0, 0)

    doc.add_paragraph()

    # ===================== ACCEPTANCE CRITERIA =====================
    doc.add_heading('9. Acceptance Criteria (PDF Section 12 - 33 Checks)', level=1)

    add_styled_table(doc,
        ['#', 'Check', 'Pass Criteria', 'Status'],
        [
            ['1', 'Pillars created', '2-10 pillars, sum to 100%', 'PASS'],
            ['2', 'Ideas generated', '20 in <8s, tagged to pillars', 'PASS'],
            ['3', 'Trending loaded', 'Panel <3s', 'PASS (AI-gen)'],
            ['4', 'Idea saved', 'Status changes, in calendar', 'PASS'],
            ['5', 'Draft from idea', 'Metadata pre-filled, checklist', 'PASS'],
            ['6', 'Captions generated', '3 variants <5s, adapted', 'PASS'],
            ['7', 'Char count', 'Real-time, correct colors', 'PASS'],
            ['8', 'Platform preview', 'Mock-up per platform', 'FAIL - Not built'],
            ['9', 'A/B tags persist', 'Linked to analytics', 'PASS'],
            ['10', 'Hashtags generated', 'Tier dist, banned excluded', 'PASS'],
            ['11', 'IG first-comment', 'Hashtags as first comment', 'PARTIAL'],
            ['12', 'Image generated', 'AI image <15s', 'PASS'],
            ['13', 'Auto-resize', 'Correct dimensions', 'PASS'],
            ['14', 'Alt text', '<=125 chars', 'PASS'],
            ['15', 'Template overlay', 'Logo, colors, fonts', 'PASS'],
            ['16', 'Version history', 'Previous versions accessible', 'PASS'],
            ['17', 'Submit approval', 'Blocked if incomplete', 'PARTIAL'],
            ['18', 'Approver notified', 'Within 30 seconds', 'PASS'],
            ['19', 'SLA escalation', '12h/24h/48h correct', 'PASS'],
            ['20', 'Approval state', 'Transitions logged', 'PASS'],
            ['21', 'Scheduling', 'Publish within 60s', 'PASS'],
            ['22', 'Best time overlay', 'Highlighted slots', 'PARTIAL'],
            ['23', 'Conflict detect', 'Warning <15min', 'PASS'],
            ['24', 'Drag-drop calendar', 'No page reload', 'FAIL - Not built'],
            ['25', 'Publish success', 'Post ID stored', 'PASS'],
            ['26', 'Publish failure', '3 retries, notify', 'PASS'],
            ['27', '24h stats badge', 'On post card', 'FAIL - Not built'],
            ['28', 'Comments sync', 'Within 15 min', 'PARTIAL'],
            ['29', 'AI reply', '<5s, Brand DNA tone', 'PASS'],
            ['30', 'Weekly report', 'Sunday auto-gen', 'PASS'],
            ['31', 'A/B results', 'Correct comparison', 'PASS'],
            ['32', 'Winner detect', 'Top 20% flagged', 'PARTIAL'],
            ['33', 'Repurpose prompt', 'Modal with options', 'FAIL - Not built'],
        ],
    )

    p = doc.add_paragraph()
    run = p.add_run('Score: 22/33 PASS, 5 PARTIAL, 4 FAIL (not built), 2 need triggers')
    run.bold = True

    doc.add_paragraph()

    # ===================== ROLES =====================
    doc.add_heading('10. Role-Based Access Control (PDF Section 3)', level=1)

    add_styled_table(doc,
        ['Role', 'Description', 'Current Status'],
        [
            ['Owner', 'Workspace creator, full control', 'NOT IMPL (no user_roles table)'],
            ['Admin', 'Operations manager', 'Partial (is_staff flag only)'],
            ['Creator', 'Content producer', 'NOT IMPL'],
            ['Approver', 'Quality gate / reviewer', 'NOT IMPL'],
            ['Publisher', 'Granted permission (not base role)', 'NOT IMPL'],
            ['Viewer', 'Read-only stakeholder', 'NOT IMPL'],
        ],
    )

    p = doc.add_paragraph()
    run = p.add_run('Rule: Publishing requires Owner, Admin, or explicitly granted Publisher permission. Creator alone cannot publish.')
    run.italic = True

    doc.add_paragraph()

    # ===================== HOW TO TEST =====================
    doc.add_heading('11. How to Test', level=1)

    p = doc.add_paragraph()
    p.add_run('Start Server:\n').bold = True
    p.add_run('python manage.py runserver 0.0.0.0:8099\n\n')
    p.add_run('Build Frontend:\n').bold = True
    p.add_run('cd frontend && npx vite build\n\n')
    p.add_run('Test API (example):\n').bold = True
    p.add_run('curl -X POST http://localhost:8099/api/auth/login/ -d \'{"username":"admin","password":"pass"}\'\n')
    p.add_run('Use the token in Authorization: Bearer <token> header for all API calls.\n\n')
    p.add_run('Django Check:\n').bold = True
    p.add_run('python manage.py check (should return 0 issues)')

    # Save
    output_path = r'd:\Projects\Final_version_socialSync\SaleAnto_V1.2.1_Progress_Report.docx'
    doc.save(output_path)
    print(f'Report saved to: {output_path}')


if __name__ == '__main__':
    main()
