"""Generate docs/changes/UncommittedChangesReport.docx — brief, per-file
report of the current uncommitted changes on features/swapnil-v3.8.

Each file gets: why changed, key changed lines, how to test, test scenario,
expected output. Generated with python-docx 1.1.2.
"""
from __future__ import annotations

import os
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


OUT = os.path.join(os.path.dirname(__file__), 'UncommittedChangesReport.docx')


# ──────────────────────────────────────────────────────────────────
# Styling helpers
# ──────────────────────────────────────────────────────────────────


def set_cell_bg(cell, color_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tc_pr.append(shd)


def add_heading(doc, text, level=1, color=None):
    h = doc.add_heading(text, level=level)
    if color is not None:
        for run in h.runs:
            run.font.color.rgb = color
    return h


def add_para(doc, text, bold=False, italic=False, size=11, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    return p


def add_label_value(doc, label, value):
    p = doc.add_paragraph()
    r1 = p.add_run(f'{label}: ')
    r1.bold = True
    r1.font.size = Pt(11)
    r2 = p.add_run(value)
    r2.font.size = Pt(11)


def add_code(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'Consolas'
    run.font.size = Pt(9)
    # Light grey background by adding shading via paragraph properties.
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F2F2F2')
    pPr.append(shd)
    return p


def add_bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(it, style='List Bullet')
        for run in p.runs:
            run.font.size = Pt(11)


def file_section(doc, idx, path, kind, body):
    """Render one file's section.

    body keys: why, changes (list of bullets), how_to_test, test_scenario,
    expected_output.
    """
    # File header
    h = doc.add_heading(f'{idx}. {path}', level=2)
    for run in h.runs:
        run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)

    add_label_value(doc, 'Type', kind)

    add_para(doc, 'Why it changed', bold=True, size=12,
             color=RGBColor(0x8B, 0x00, 0x00))
    add_para(doc, body['why'], size=11)

    add_para(doc, 'Key changes', bold=True, size=12,
             color=RGBColor(0x8B, 0x00, 0x00))
    add_bullets(doc, body['changes'])

    add_para(doc, 'How to test it', bold=True, size=12,
             color=RGBColor(0x8B, 0x00, 0x00))
    add_para(doc, body['how_to_test'], size=11)

    add_para(doc, 'Test scenario', bold=True, size=12,
             color=RGBColor(0x8B, 0x00, 0x00))
    add_para(doc, body['test_scenario'], size=11)

    add_para(doc, 'Expected output', bold=True, size=12,
             color=RGBColor(0x8B, 0x00, 0x00))
    add_para(doc, body['expected_output'], size=11)

    doc.add_paragraph('')  # spacer


# ──────────────────────────────────────────────────────────────────
# File-by-file content
# ──────────────────────────────────────────────────────────────────

FILES = [
    # ----- 1 -----
    ('ai_image/services/copy_generation_service.py', 'modified', {
        'why': (
            "Marketing copy suggestions for image overlays were being written from "
            "brand + caption text alone, so the resulting copy often did not "
            "feel like it belonged ON the actual image. The visual_prompt that "
            "is now built upstream by visual_prompt_builder is added here so "
            "the LLM can ground the copy in the exact scene that will be rendered."
        ),
        'changes': [
            "Added a new `visual_prompt: str = ''` parameter to `generate_copy_suggestions(...)`.",
            "Built a `<visual_prompt>` XML block (truncated to 800 chars) that the user prompt now interpolates between `<post_context>` and the TASK line.",
            "Added a CRITICAL instruction telling the LLM to reference what the image shows and never write generic slogans.",
        ],
        'how_to_test': (
            "Trigger the copy-overlay endpoint after the visual prompt builder has run, "
            "with and without the visual_prompt field, and compare suggestions."
        ),
        'test_scenario': (
            "1) Run Magic Mode end-to-end so a visual_prompt is produced.\n"
            "2) Call POST /api/v1/creative/copy-overlay/generate/ once with the visual_prompt field "
            "populated and once with it empty.\n"
            "3) Inspect the 5 returned suggestions."
        ),
        'expected_output': (
            "When visual_prompt is supplied the suggestions reference the scene (e.g. "
            "'Fresh roast, brewed your way' when the image shows coffee beans). "
            "When it is empty the function still returns 5 valid suggestions but generic, "
            "and no errors are raised."
        ),
    }),

    # ----- 2 -----
    ('api/creative_views.py', 'modified', {
        'why': (
            "The /creative/copy-overlay/generate/ endpoint did not forward the new "
            "visual_prompt field to the service layer, so the change in "
            "copy_generation_service.py was unreachable from HTTP."
        ),
        'changes': [
            "Added `visual_prompt=data.get('visual_prompt', '')` to the `generate_copy_suggestions(...)` call inside `GenerateCopyOverlayTextView.post()`.",
        ],
        'how_to_test': (
            "Hit the endpoint with a request body that contains `visual_prompt` and "
            "verify that the prompt actually reaches the LLM."
        ),
        'test_scenario': (
            "POST /api/v1/creative/copy-overlay/generate/ with JSON: "
            "{brand_id, caption_text, visual_prompt: '<scene description>'}. "
            "Confirm via logs or the admin Prompt Execution table that the LLM payload "
            "contained the <visual_prompt> block."
        ),
        'expected_output': (
            "HTTP 200 with 5 overlay suggestions in the response. The persisted "
            "PromptExecution row shows the <visual_prompt> tag in the user message."
        ),
    }),

    # ----- 3 -----
    ('api/serializers.py', 'modified', {
        'why': (
            "Two things needed to flow through serializers: (a) PostSerializer had "
            "to expose the new caption_generation_id field to the frontend, and "
            "(b) CopyOverlayGenerateSerializer had to accept the new visual_prompt input."
        ),
        'changes': [
            "Added `'caption_generation_id'` to `PostSerializer.Meta.fields`.",
            "Added `visual_prompt = serializers.CharField(required=False, default='')` to `CopyOverlayGenerateSerializer` with a comment explaining its purpose.",
        ],
        'how_to_test': (
            "(a) GET an existing post that has a caption_generation_id stored — confirm the "
            "field appears in the JSON. (b) POST to copy-overlay/generate with the new "
            "field and confirm DRF does not strip or reject it."
        ),
        'test_scenario': (
            "1) Save a Post row in shell with caption_generation_id=42, then GET /api/v1/posts/<id>/ "
            "and confirm the response contains `\"caption_generation_id\": 42`.\n"
            "2) POST to /api/v1/creative/copy-overlay/generate/ including `visual_prompt`, "
            "and confirm no 400 'unknown field' response."
        ),
        'expected_output': (
            "(a) Post JSON contains caption_generation_id. (b) Copy overlay endpoint "
            "returns 200 OK and the suggestions reference the visual prompt."
        ),
    }),

    # ----- 4 -----
    ('api/strategy_views.py', 'modified', {
        'why': (
            "The Regenerate-Idea flow used to take a single free-form `instructions` "
            "string, so the LLM received vague guidance and frequently produced ideas "
            "that did not honour the user's intent (e.g. asked for a topic change, "
            "got the same topic with a different tone). The endpoint now accepts a "
            "structured `feedback_category` (topic / tone / image / other) and injects "
            "a category-specific constraint into the regeneration prompt."
        ),
        'changes': [
            "Read `feedback_category` from request.data alongside `instructions`.",
            "Build `category_instruction` with branches for 'topic', 'tone', 'image', else 'other' (falls back to raw instructions).",
            "Replaced the inline conditional `5. FOLLOW...` line in the prompt with `{category_instruction}` so the rule injected is precise.",
        ],
        'how_to_test': (
            "Call the /ideas/<id>/regenerate/ endpoint four times with different "
            "feedback_category values and inspect the new idea's relationship to the old one."
        ),
        'test_scenario': (
            "POST /ideas/<id>/regenerate/ with each of: feedback_category='topic', "
            "='tone', ='image', and no feedback_category (just instructions)."
        ),
        'expected_output': (
            "topic → an idea on a fully unrelated theme. tone → same topic, different "
            "voice (e.g. inspirational → factual). image → same topic, different visual "
            "framing in the hook/angle. other → idea follows the raw instructions verbatim."
        ),
    }),

    # ----- 5 -----
    ('api/trending_service.py', 'modified', {
        'why': (
            "Users complained that the Trending feed kept showing the same topics "
            "every refresh because TrendingCache rows expire after 12 h but the LLM "
            "had no memory of what it had already proposed. We now persist every "
            "shown topic per brand in `ShownTrendingTopic` and inject the last 60 "
            "into the prompt as a hard-exclusion list."
        ),
        'changes': [
            "Imported `ShownTrendingTopic` and pulled the last 60 shown topics for the brand.",
            "Appended a `<previously_shown_topics>` block to the prompt with a 'HARD CONSTRAINT — DO NOT return any of these or semantically identical variants' line.",
            "After generation, `bulk_create` a ShownTrendingTopic row for every topic the LLM produced (ignore_conflicts so dedup is forgiving).",
        ],
        'how_to_test': (
            "Run the trending generation flow twice in a row for the same brand and "
            "verify zero overlap between the two response sets."
        ),
        'test_scenario': (
            "1) Generate trending topics for brand X — note the 15 topics.\n"
            "2) Re-generate trending topics for brand X within the same hour.\n"
            "3) Check the database: `select count(*) from shown_trending_topics where brand_id=X;` "
            "should grow by ~15."
        ),
        'expected_output': (
            "The second call returns 15 topics that do not match (semantically or "
            "literally) any of the topics from the first call. The shown_trending_topics "
            "table grows by the number of topics on each generation."
        ),
    }),

    # ----- 6 -----
    ('api/views.py', 'modified', {
        'why': (
            "Caption feedback regeneration relies on the captionId living in the "
            "Zustand store, which is wiped on page reload. The cache endpoint now "
            "persists a {post_id: caption_generation_id} mapping into Post rows so "
            "regeneration still works after a refresh."
        ),
        'changes': [
            "MagicModeCachedPostsView.get(...) now returns `caption_generation_id` for each post.",
            "MagicModeCachedPostsView.post(...) parses an optional `caption_ids: {post_id: cap_gen_id}` map and updates Post rows in bulk (with ownership + ValueError safety).",
        ],
        'how_to_test': (
            "Run Magic Mode → wait for posts to be ready → reload the page → click "
            "'regenerate caption' on a post and confirm the backend takes the regenerate path."
        ),
        'test_scenario': (
            "1) Generate posts via Magic Mode.\n"
            "2) Reload the browser tab (Zustand store clears).\n"
            "3) Open a post and submit caption feedback.\n"
            "4) Inspect the network call — should be POST /captions/<captionId>/regenerate/ "
            "not POST /captions/generate/."
        ),
        'expected_output': (
            "Network tab shows the regenerate endpoint being called with the correct "
            "caption ID. The new caption is a clear refinement of the old one (not a "
            "from-scratch generation)."
        ),
    }),

    # ----- 7 -----
    ('brands/models.py', 'modified', {
        'why': (
            "Needed a persistent log of every trending topic ever shown to a brand "
            "so the LLM can be forced to skip them on future generations. "
            "TrendingCache rows expire after 12 h and so cannot be used for this."
        ),
        'changes': [
            "Added `class ShownTrendingTopic(models.Model)` with `brand` FK, `topic` (CharField 500), `shown_at` timestamp.",
            "Added a `(brand, shown_at)` index for fast ordering queries.",
            "Used `db_table = 'shown_trending_topics'` and ordering `-shown_at` so the most recent topics surface first.",
        ],
        'how_to_test': (
            "Run the trending service then query the new table from a Django shell."
        ),
        'test_scenario': (
            "python manage.py shell -c \"from brands.models import ShownTrendingTopic; "
            "print(ShownTrendingTopic.objects.filter(brand_id=<X>).count())\""
        ),
        'expected_output': (
            "Count grows by ~15 each time trending is regenerated for that brand. "
            "Calling .latest('shown_at') returns the most recently shown topic string."
        ),
    }),

    # ----- 8 -----
    ('frontend/src/App.tsx', 'modified', {
        'why': (
            "Five new Meta App Review demonstration pages (Leads, Ads, Comments, "
            "Instagram Content, Discover) need React Router entries so Meta reviewers "
            "can navigate to each permission's UI when auditing the app."
        ),
        'changes': [
            "Imported `LeadsPage`, `AdsPage`, `CommentsPage`, `InstagramContentPage`, `DiscoverPage` from `./pages`.",
            "Registered five new routes: /comments, /instagram-content, /discover, /leads, /ads.",
        ],
        'how_to_test': (
            "Boot the frontend dev server and visit each URL directly."
        ),
        'test_scenario': (
            "Open /comments, /instagram-content, /discover, /leads, /ads in turn while "
            "logged in. Confirm each renders without 404 and shows the page's heading."
        ),
        'expected_output': (
            "All five routes render their corresponding page components (no white screen, "
            "no NotFound redirect)."
        ),
    }),

    # ----- 9 -----
    ('frontend/src/components/layout/Sidebar.tsx', 'modified', {
        'why': (
            "The new Meta App Review pages also need to be reachable from the sidebar. "
            "They are grouped under a single 'Engage' parent so the sidebar does not "
            "balloon with five new top-level items."
        ),
        'changes': [
            "Imported 5 new heroicons (ChatBubbleLeftRightIcon, HashtagIcon, UserGroupIcon, MegaphoneIcon, PhotoIcon).",
            "Added an 'Engage' parent nav item with children: Comments, Instagram Content, Discover, Leads, Ads.",
        ],
        'how_to_test': (
            "Open the sidebar and expand 'Engage'; click each child."
        ),
        'test_scenario': (
            "After login, locate the 'Engage' group in the sidebar, expand it, and click "
            "each of the 5 children. Verify the URL changes correctly and the active-state "
            "highlighting works."
        ),
        'expected_output': (
            "Engage parent expands smoothly. Clicking any child navigates to the matching "
            "route AND highlights that row as active. Collapsing the parent hides the children."
        ),
    }),

    # ----- 10 -----
    ('frontend/src/pages/ConnectAccountsPage.tsx', 'modified', {
        'why': (
            "Meta requires us to demonstrate `pages_manage_metadata` — letting the user "
            "view and update their Facebook Page's name, category, About text, website, "
            "and phone — inside SellAnto."
        ),
        'changes': [
            "Added pageMetaList / pageMetaExpanded / pageMetaEdit state.",
            "On fetchData(), call `/api/v1/platforms/facebook/pages/metadata/` and populate pageMetaList.",
            "Rendered a new 'Page Metadata' section with a permission badge, an empty state, and accordion rows per page. Each row expands to show editable fields and a Save button that PATCHes `/api/v1/platforms/facebook/pages/<id>/metadata/`.",
        ],
        'how_to_test': (
            "Connect a Facebook account with at least one Page and exercise both the read "
            "and the update paths."
        ),
        'test_scenario': (
            "1) Connect a FB account.\n"
            "2) Open Connect Accounts → scroll to 'Page Metadata' → expand a page.\n"
            "3) Edit the 'About' field and click Save Changes.\n"
            "4) Reload the page and confirm the new value persists."
        ),
        'expected_output': (
            "Initial fetch shows all connected pages with name and category. Editing About "
            "and clicking Save shows the success toast, the row reflects the new value "
            "without reload, and the value persists after a hard refresh."
        ),
    }),

    # ----- 11 -----
    ('frontend/src/pages/index.ts', 'modified', {
        'why': (
            "Barrel export so the 5 new Meta App Review pages can be imported as named "
            "members from `./pages` in App.tsx."
        ),
        'changes': [
            "Added named exports for LeadsPage, AdsPage, CommentsPage, InstagramContentPage, DiscoverPage.",
        ],
        'how_to_test': (
            "Run `npm run build` (or `tsc --noEmit`) and confirm no missing-export errors."
        ),
        'test_scenario': (
            "From the frontend directory: `npm run build`. The build must complete with no "
            "TS2305 'has no exported member' errors against ./pages."
        ),
        'expected_output': (
            "Build succeeds. App.tsx imports for the 5 page components resolve cleanly."
        ),
    }),

    # ----- 12 -----
    ('frontend/src/pages/magic/AIWorkingScreen.tsx', 'modified', {
        'why': (
            "Three improvements: (1) the existing DNA-skip logic was unsafe — it skipped "
            "if any DNA blob existed even when it lacked the fields downstream steps "
            "rely on; (2) AI-only image generation had no link back to the brand's "
            "products/services so the images were generic; (3) the cache write did not "
            "include caption_ids, so feedback regeneration broke after reload."
        ),
        'changes': [
            "Always fetch the brand detail once and reuse `brandDNA` for downstream steps.",
            "Defined REQUIRED_DNA_FIELDS and `hasSufficientDNA` heuristic; regenerate DNA when fields are missing even if some DNA exists.",
            "Built `dnaProductContext` from `brand_dna.products_services` and passed it to `visualPromptService.buildImagePrompt(...)` on the AI-only image path.",
            "When saving the cache, build `captionIdsMap = {post_id: captionId}` and send it as `caption_ids` to the backend.",
        ],
        'how_to_test': (
            "Exercise three flows: (a) brand with empty DNA, (b) brand with sufficient "
            "DNA, (c) post reload + caption feedback."
        ),
        'test_scenario': (
            "1) Brand without DNA: run Magic Mode → confirm step 1 regenerates DNA.\n"
            "2) Brand with full DNA: re-run Magic Mode → step 1 should log 'sufficient DNA — skipping'.\n"
            "3) For AI-only image mode (no product image uploaded), check the image — it must "
            "represent the brand's actual offering.\n"
            "4) Reload the tab → click 'regenerate caption' → network call hits "
            "/captions/<id>/regenerate/ (proof caption_ids was persisted)."
        ),
        'expected_output': (
            "(a) DNA is generated and brandDNA is populated. (b) DNA generation is "
            "skipped, console logs 'sufficient DNA'. (c) Image clearly references the "
            "brand's product or service. (d) Caption regeneration works after reload."
        ),
    }),

    # ----- 13 -----
    ('frontend/src/pages/magic/ResultsScreen.tsx', 'modified', {
        'why': (
            "Two bugs and one upgrade: (1) caption tone was hard-coded to 'professional' "
            "on the fallback path, ignoring the user's tone answer; (2) the topic-change "
            "regeneration was sending a prompt-engineered string instead of using the new "
            "structured `feedback_category`; (3) when captionId was missing after reload "
            "the caption regen restarted from scratch instead of using the existing "
            "caption as context."
        ),
        'changes': [
            "Hoisted the toneMap + captionTone derivation to the top of the handler so all 3 branches share it.",
            "When the feedback says 'topic', call `strategyService.regenerateIdea(post.ideaId, feedbackText, 'topic')`.",
            "On the captionId-missing branch, set `custom_instructions = 'Original caption: \"<orig>\". User feedback: <feedbackText>'` so the LLM has the original to refine, not just the title.",
        ],
        'how_to_test': (
            "Exercise each of the three regeneration branches."
        ),
        'test_scenario': (
            "1) Click 'Change topic' on a post — confirm the new idea is on a different theme.\n"
            "2) Click 'Change image' on a post — confirm only the image swaps (not the caption).\n"
            "3) Reload the tab → click 'Change caption' with feedback 'shorter' — confirm "
            "the new caption is a refinement of the old one (not a rewrite from the title)."
        ),
        'expected_output': (
            "(1) Topic change yields a fully new idea + caption + image. (2) Image change "
            "swaps the image only. (3) Even after reload the caption regen output looks "
            "like an edit of the original instead of a from-scratch generation."
        ),
    }),

    # ----- 14 -----
    ('frontend/src/pages/magic/cacheUtils.ts', 'modified', {
        'why': (
            "Symmetric with the AIWorkingScreen + backend changes: when restoring cached "
            "Magic posts after a reload, surface the persisted caption_generation_id back "
            "into the in-memory post.captionId so feedback regeneration works seamlessly."
        ),
        'changes': [
            "In `lookupCachedPosts(...)`, added `captionId: p.caption_generation_id || undefined` to the restored post object.",
        ],
        'how_to_test': (
            "Reload mid-flow and confirm captionId is hydrated on each card."
        ),
        'test_scenario': (
            "After a Magic generation completes, refresh the browser. Open DevTools and "
            "inspect the Zustand store — generatedPosts[*].captionId should be populated."
        ),
        'expected_output': (
            "Each post object has captionId set to a number after reload (instead of "
            "undefined as before)."
        ),
    }),

    # ----- 15 -----
    ('frontend/src/services/strategyService.ts', 'modified', {
        'why': (
            "Matches the backend RegenerateIdeaView signature change — the client used to "
            "pass `overridePrompt`, but the backend now consumes `instructions` and "
            "`feedback_category`."
        ),
        'changes': [
            "Reworked `regenerateIdea(ideaId, instructions?, feedbackCategory?)` to send `{instructions, feedback_category}` to the backend.",
            "feedbackCategory typed as `'topic' | 'tone' | 'image' | 'other'`.",
        ],
        'how_to_test': (
            "Verified end-to-end via the ResultsScreen 'Change topic' flow."
        ),
        'test_scenario': (
            "Confirm the network payload matches the new contract by triggering "
            "'Change topic' and inspecting the POST body in DevTools."
        ),
        'expected_output': (
            "Request body: { instructions: '<text>', feedback_category: 'topic' }. "
            "Response: 200 OK with the new idea object."
        ),
    }),

    # ----- 16 -----
    ('frontend/src/types/copyOverlay.ts', 'modified', {
        'why': (
            "TypeScript needed to learn about the new visual_prompt field so the "
            "AIWorkingScreen / copy-overlay caller can pass it without `any`-cast."
        ),
        'changes': [
            "Added `visual_prompt?: string` to `CopyOverlayGenerateRequest` with a JSDoc comment explaining purpose.",
        ],
        'how_to_test': (
            "TS compile + usage in the call site."
        ),
        'test_scenario': (
            "tsc --noEmit. Then call `copyOverlayService.generate({ visual_prompt: 'foo' })` "
            "in the magic working screen — should type-check."
        ),
        'expected_output': (
            "Build passes. The field is autocompleted by VS Code when you start typing "
            "`visual_pro…` inside the request object."
        ),
    }),

    # ----- 17 -----
    ('platforms/oauth_views.py', 'modified', {
        'why': (
            "App Review requires us to actually request the new Meta permissions during "
            "the FB OAuth handshake so reviewers can grant + audit them."
        ),
        'changes': [
            "Added to FB_SCOPES: `instagram_business_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, and `leads_retrieval`.",
        ],
        'how_to_test': (
            "Walk through the Facebook OAuth consent screen and verify the new scopes appear."
        ),
        'test_scenario': (
            "Disconnect any test FB account, then click 'Connect Facebook' from the app. "
            "On the Meta consent dialog, expand 'Choose what <app> can access' and confirm "
            "each new scope is listed."
        ),
        'expected_output': (
            "The Meta consent screen lists: 'Read & publish content on your IG Business "
            "account', 'Manage comments on your IG content', 'Read insights for your IG "
            "Business account', and 'Access your leads from Lead Ads'. After consent, the "
            "stored token grants those permissions."
        ),
    }),

    # ----- 18 -----
    ('posts/models.py', 'modified', {
        'why': (
            "Caption regeneration needed a way to survive page reloads. The frontend "
            "lost track of captionId because it lived only in the Zustand store. The "
            "Post model now persists it directly."
        ),
        'changes': [
            "Added `caption_generation_id = models.IntegerField(null=True, blank=True, help_text='ID of the CaptionGeneration record that produced this post caption')` to the Post model.",
        ],
        'how_to_test': (
            "Run the new migration and confirm the field is queryable; round-trip a value."
        ),
        'test_scenario': (
            "python manage.py migrate posts. Then in shell: "
            "p = Post.objects.first(); p.caption_generation_id = 42; p.save(); "
            "Post.objects.get(id=p.id).caption_generation_id == 42."
        ),
        'expected_output': (
            "Migration applies cleanly. The round-trip assertion is True."
        ),
    }),

    # ----- 19 -----
    ('posts/services/visual_prompt_builder.py', 'modified', {
        'why': (
            "When no product image was uploaded, the LLM-built image prompt had no "
            "concrete product/service to anchor to, so it produced generic visuals. "
            "Now the brand DNA's `products_services` text is injected as a "
            "<key_products> block on both the image and video builders."
        ),
        'changes': [
            "ImageVisualPromptBuilder._build_user_message: when product_context is None but DNA has products_services, emit a `<key_products>` block + an INSTRUCTION line telling the LLM the image MUST visually feature the listed offering.",
            "VideoVisualPromptBuilder._build_user_message: same fallback — if no reference image and DNA has products_services, append a `<key_products>` section before <creative_idea>.",
        ],
        'how_to_test': (
            "Run Magic Mode with a brand that has rich DNA but no uploaded product image "
            "and inspect the generated image."
        ),
        'test_scenario': (
            "1) Pick a brand whose DNA `products_services` field is populated (e.g. 'Organic "
            "cold-pressed juices').\n"
            "2) Run Magic Mode without uploading any product image.\n"
            "3) Inspect the prompt sent to Gemini via the PromptExecution log.\n"
            "4) Inspect the generated image."
        ),
        'expected_output': (
            "The PromptExecution row contains a `<key_products>` block listing the "
            "products_services text. The rendered image visibly features the listed "
            "offering rather than a generic abstract scene."
        ),
    }),

    # ----- 20 -----
    ('brands/migrations/0009_add_caption_gen_id_and_shown_trending_topic.py', 'new', {
        'why': (
            "Schema change for the new `ShownTrendingTopic` model in brands/models.py."
        ),
        'changes': [
            "CreateModel ShownTrendingTopic with brand FK, topic CharField(500), shown_at auto_now_add, table 'shown_trending_topics', ordering '-shown_at', composite index on (brand, shown_at).",
        ],
        'how_to_test': (
            "Apply the migration and confirm the table exists."
        ),
        'test_scenario': (
            "python manage.py migrate brands. Then in MySQL: DESCRIBE shown_trending_topics; "
            "confirm 4 columns (id, brand_id, topic, shown_at) and the index "
            "shown_trend_brand_i_6fcf54_idx exists."
        ),
        'expected_output': (
            "Migration applies cleanly. Table and index exist with the expected schema."
        ),
    }),

    # ----- 21 -----
    ('posts/migrations/0008_add_caption_gen_id_and_shown_trending_topic.py', 'new', {
        'why': (
            "Schema change for the new caption_generation_id field on Post."
        ),
        'changes': [
            "AddField Post.caption_generation_id (IntegerField, null+blank=True, help_text documents the link to CaptionGeneration).",
        ],
        'how_to_test': (
            "Apply the migration and confirm column exists."
        ),
        'test_scenario': (
            "python manage.py migrate posts. In MySQL: SHOW COLUMNS FROM posts_post LIKE "
            "'caption_generation_id';"
        ),
        'expected_output': (
            "Column exists as int(11), nullable. Migration rolls back cleanly via "
            "`migrate posts 0007` if needed."
        ),
    }),

    # ----- 22 -----
    ('frontend/src/pages/AdsPage.tsx', 'new', {
        'why': (
            "Meta App Review demonstration page for ads_management, ads_read, "
            "pages_manage_ads, and Marketing API Access Tier."
        ),
        'changes': [
            "New ~531-line React page showing a list of Meta ad campaigns with status, budget, spend.",
            "Insights chart for impressions, clicks, and spend over time.",
            "Pause/Resume controls per campaign.",
            "Entry points to Boost Post and Run Video Ad flows.",
        ],
        'how_to_test': (
            "Visit /ads as a user with ad accounts connected."
        ),
        'test_scenario': (
            "1) Connect a FB ad account via /platforms.\n"
            "2) Navigate to /ads.\n"
            "3) Click Pause on any active campaign → confirm status updates locally.\n"
            "4) Click 'Boost Post' / 'Run Video Ad' — flows should open."
        ),
        'expected_output': (
            "Page renders the list with real campaign data. Pause/Resume toggles update "
            "the UI immediately. Boost Post and Run Video Ad open their respective flows."
        ),
    }),

    # ----- 23 -----
    ('frontend/src/pages/CommentsPage.tsx', 'new', {
        'why': (
            "Meta App Review demonstration page for instagram_manage_comments and "
            "pages_read_engagement. A unified comment inbox across all connected FB Pages "
            "and IG Business accounts."
        ),
        'changes': [
            "New ~301-line page that lists posts with comments and uses the existing PostCommentInbox component for the per-post reply UI.",
            "Includes search + filter + per-platform icon.",
        ],
        'how_to_test': (
            "Visit /comments with a connected FB Page that has comments on a post."
        ),
        'test_scenario': (
            "1) Pre-condition: FB Page connected and at least one post on that Page has a "
            "comment.\n"
            "2) Navigate to /comments.\n"
            "3) Locate the post; click into its comments; reply to a comment.\n"
            "4) Confirm the reply appears on the actual FB post."
        ),
        'expected_output': (
            "Page lists posts with comment counts. Clicking opens the inbox. Replies post "
            "to FB and the success toast appears."
        ),
    }),

    # ----- 24 -----
    ('frontend/src/pages/DiscoverPage.tsx', 'new', {
        'why': (
            "Demonstration page for the Instagram Public Content Access permission — "
            "search public hashtags and browse top/recent media."
        ),
        'changes': [
            "New ~432-line page with hashtag search + profile lookup + a bookmark/save flow for inspiration.",
            "Wires up two new backend endpoints: GET /instagram/discover/hashtag/?tag=… and GET /instagram/discover/profile/?username=…",
        ],
        'how_to_test': (
            "Visit /discover and exercise both search modes."
        ),
        'test_scenario': (
            "1) Search the hashtag #coffee → expect top + recent media tiles.\n"
            "2) Look up a public IG Business username → expect their profile card + "
            "recent media.\n"
            "3) Click bookmark on a tile → confirm the bookmark persists."
        ),
        'expected_output': (
            "Hashtag search returns at least 1 media tile if the hashtag is valid. Profile "
            "lookup returns the public profile + recent grid. Bookmark click stores the "
            "media in user's saved-inspiration list."
        ),
    }),

    # ----- 25 -----
    ('frontend/src/pages/InstagramContentPage.tsx', 'new', {
        'why': (
            "Demonstration page for the instagram_manage_contents permission — manage "
            "published IG content (view engagement, archive media)."
        ),
        'changes': [
            "New ~441-line page that lists media (image/video/carousel) with per-post likes, comments, reach, impressions.",
            "Archive/hide action per media item via POST /instagram/content/<media_id>/archive/.",
            "Filter by media type and date.",
        ],
        'how_to_test': (
            "Visit /instagram-content with at least one IG Business account connected that "
            "has published media."
        ),
        'test_scenario': (
            "1) Navigate to /instagram-content.\n"
            "2) Filter to 'Video' only — confirm only video media remains.\n"
            "3) Archive a media item → confirm it disappears from the listing (or moves to "
            "an Archived view, depending on UI variant)."
        ),
        'expected_output': (
            "Listing renders with engagement counts. Filter trims the list. Archive POST "
            "succeeds and the UI updates without reload."
        ),
    }),

    # ----- 26 -----
    ('frontend/src/pages/LeadsPage.tsx', 'new', {
        'why': (
            "Demonstration page for the leads_retrieval permission — display Facebook "
            "Lead Ad form submissions."
        ),
        'changes': [
            "New ~445-line page that lists Lead Ad forms per connected FB Page.",
            "Browse submissions per form, with email/phone/name fields.",
            "Force-sync button calls POST /leads/sync/ to pull fresh data from the Graph API.",
        ],
        'how_to_test': (
            "Visit /leads with a connected FB Page that has at least one Lead Ad form + "
            "at least one submission."
        ),
        'test_scenario': (
            "1) Pre-condition: leads_retrieval scope granted + at least one form with a "
            "submission.\n"
            "2) Navigate to /leads.\n"
            "3) Click into a form → see the submission table.\n"
            "4) Click 'Force sync' → confirm the count refreshes after a moment."
        ),
        'expected_output': (
            "Forms list renders correctly. Submissions table shows name/email/phone "
            "fields. Force-sync triggers a backend pull and updates the displayed count."
        ),
    }),
]


# ──────────────────────────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────────────────────────


def build():
    doc = Document()

    # Default style
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)

    # Title
    title = doc.add_heading('Uncommitted Changes Report', level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run('features/swapnil-v3.8  •  2026-06-10')
    r.italic = True
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x59, 0x59, 0x59)

    doc.add_paragraph('')

    # Summary block
    add_heading(doc, 'Summary', level=1,
                color=RGBColor(0x1F, 0x4E, 0x79))
    add_para(
        doc,
        'This report covers every uncommitted change currently in the working '
        'tree on branch features/swapnil-v3.8 — 19 modified files and 7 new '
        '(untracked) files, ~417 insertions across the tracked diff plus ~2150 '
        'lines of new frontend pages. The work falls into 4 themes:',
    )
    add_bullets(doc, [
        'Meta App Review surfaces — 5 new pages (Leads, Ads, Comments, Instagram Content, Discover) plus sidebar + OAuth scope wiring + Page Metadata UI on the Connect Accounts page.',
        'Trending feed deduplication — new ShownTrendingTopic model + hard-exclusion block in the LLM prompt so users never see the same trending topic twice.',
        'Magic Mode regeneration robustness — caption_generation_id persisted on Post, products_services injected into the visual prompt builder, structured feedback_category in idea regeneration, captionId restored after reload.',
        'Copy overlay quality — visual_prompt now reaches the copy generation LLM so overlay text feels native to the image it sits on.',
    ])

    add_heading(doc, 'How to read this report', level=2,
                color=RGBColor(0x1F, 0x4E, 0x79))
    add_bullets(doc, [
        'Each file has 5 fields: Why it changed, Key changes, How to test it, Test scenario, Expected output.',
        'Order: backend modified files first, then frontend modified files, then new migrations, then new pages.',
        'Migration commands assume the standard `python manage.py migrate` workflow.',
    ])

    doc.add_page_break()

    # Files
    for idx, (path, kind, body) in enumerate(FILES, start=1):
        file_section(doc, idx, path, kind, body)

    # Footer / generated marker
    doc.add_paragraph('')
    foot = doc.add_paragraph()
    foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = foot.add_run('Generated 2026-06-10 from the working-tree diff on features/swapnil-v3.8.')
    r.italic = True
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

    doc.save(OUT)
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    build()
