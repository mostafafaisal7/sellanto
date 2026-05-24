"""Per-user Magic Mode prompt override resolver + execution recorder.

Usage at a call site
────────────────────
    from accounts.services.prompt_resolver import resolve_prompt, save_execution
    import time

    vars_dict = {'brand_name': brand.brand_name, 'count': 3, ...}
    default_system = f"You are a strategist for {brand.brand_name}..."

    prompt, was_override = resolve_prompt(
        request.user, 'idea_system', default_system, vars_dict,
        return_meta=True,          # <— ask for (text, bool) tuple
    )

    t0 = time.monotonic()
    result = llm.chat(...)
    latency = int((time.monotonic() - t0) * 1000)

    save_execution(
        user=request.user,
        prompt_type='idea_system',
        prompt_sent=prompt,
        response_received=result.content,
        was_override=was_override,
        model_used=result.model,
        tokens_in=result.input_tokens,
        tokens_out=result.output_tokens,
        latency_ms=latency,
        success=result.success,
        brand=brand,
    )

For backwards compatibility ``resolve_prompt`` still returns a plain ``str``
by default (``return_meta=False``).  Pass ``return_meta=True`` when you need
the ``(text, was_override)`` tuple so you can pass it to ``save_execution``.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Variable schema
# ─────────────────────────────────────────────────────────────

PROMPT_SCHEMA: dict[str, list[str]] = {
    # Ideas
    'idea_system': [],
    'idea_user': [
        'brand_name', 'industry', 'target_region', 'platform_text',
        'pillar_context', 'specific_pillar_line', 'dna_context',
        'competitor_context', 'trending_context', 'learning_context',
        'count',
    ],
    'idea_regenerate': [
        'idea_title', 'idea_hook', 'idea_angle', 'idea_platform',
        'brand_name', 'industry', 'voice_tone', 'pillar_name',
        'additional_instructions',
    ],
    # Captions
    'caption_system': [
        'tone_description', 'platform_guidelines',
        'emoji_setting', 'cta_setting', 'hashtag_setting',
    ],
    'caption_user': [
        'brand_context', 'pillar_context', 'original_text',
        'hook', 'goal', 'tone', 'include_cta', 'count',
    ],
    'caption_regenerate': [
        'original_caption', 'feedback',
    ],
    'caption_adapt': [
        'target_platform', 'max_chars', 'tone_guidance',
        'brand_context', 'source_caption_body',
    ],
    # Images
    'image_refiner': [
        'context_block', 'user_prompt',
    ],
    'visual_prompt_image': [
        'brand_name', 'caption', 'platform',
    ],
    'visual_prompt_video': [
        'brand_name', 'user_prompt',
    ],
    'image_product_bg': [
        'background_style', 'post_title', 'product_type',
        'product_features', 'image_style',
    ],
    'image_product_smart': [
        'product_type', 'mood', 'temp', 'lighting', 'brightness',
        'original_prompt', 'style_description', 'color_palette_description',
        'environment_description', 'lighting_description', 'surface_description',
        'formatted_hex_colors',
    ],
    # Video
    'video_prompt': [
        'user_prompt', 'brand_name', 'industry', 'voice_tone',
        'visual_style', 'mood', 'primary_color', 'color_palette',
        'lighting', 'temperature',
    ],
    # Brand DNA
    'brand_dna': [
        'existing_dna', 'website_url', 'website_content',
    ],
    'brand_dna_website': [
        'url', 'page_title', 'page_content',
    ],
    'brand_dna_manual': [
        'dna_data',
    ],
    # Trending
    'trending_filter': [
        'today_str', 'brand_name', 'industry', 'target_region', 'website_url',
        'dna_summary', 'pillar_names', 'competitor_insights',
        'daily_trending', 'rising_queries', 'top_queries',
        'accepted_topics', 'rejected_topics',
    ],
    # Competitors
    'competitor_analyze': [
        'brand_name', 'industry', 'crawled_content', 'competitor_url',
    ],
    'competitor_suggest': [
        'brand_name', 'industry', 'target_region', 'existing_competitors', 'count',
    ],
    # Pillars
    'pillars_generate': [
        'dna_context', 'brand_name', 'industry', 'competitor_insights',
        'trending_topics', 'existing_pillar_names', 'focus_areas',
        'count', 'pct_instruction',
    ],
    # Support
    'support_chat': [],
}


# ─────────────────────────────────────────────────────────────
# FULL default prompts (verbatim — what actually gets sent to the LLM
# when no override is active). These are the same strings hardcoded at
# the call sites in api/strategy_views.py, api/caption_views.py,
# api/trending_service.py, api/views.py, etc. Centralised here so the
# admin UI can display them in full, and so they stay in sync.
#
# Variables use {placeholder} syntax — same as the override field. They
# get filled in at runtime via str.format(**vars_dict).
# ─────────────────────────────────────────────────────────────

_DEFAULT_FULL_PROMPTS: dict[str, str] = {
    # ── IDEAS ────────────────────────────────────────────────────────
    'idea_system': (
        'You are a senior social media strategist and creative director who generates content ideas that are specific, actionable, and strategically grounded.\n\n'
        'Your ideas are NOT generic "post about X" suggestions. Each idea is detailed enough that a content creator could execute it without additional briefing.\n\n'
        'Your approach combines:\n'
        '- Data signals (trending topics, competitor gaps, past performance)\n'
        '- Audience psychology (what makes people stop, save, share, and comment)\n'
        '- Content strategy (pillar balance, funnel alignment, platform optimization)\n'
        '- Creative frameworks (storytelling, contrarian takes, data-driven hooks, behind-the-scenes, social proof, UGC-inspired, educational series)\n\n'
        'You understand that the best content ideas are at the intersection of:\n'
        '1. What the brand wants to say\n'
        '2. What the audience wants to hear\n'
        '3. What the platform rewards\n\n'
        'CRITICAL OUTPUT RULES:\n'
        '- Return ONLY a valid JSON array — no markdown, no commentary\n'
        '- Each idea must be specific enough to execute immediately\n'
        '- No duplicate angles or overlapping ideas'
    ),
    'idea_user': (
        '<context>\n'
        'Brand: "{brand_name}"\n'
        'Industry: {industry}\n'
        'Region: {target_region}\n'
        'Platform(s): {platform_text}\n'
        'Content pillars: {pillar_context}\n'
        '{specific_pillar_line}\n'
        '</context>\n\n'
        '<data_signals>\n'
        'Brand DNA: {dna_context}\n'
        'Competitor insights: {competitor_context}\n'
        'Trending topics: {trending_context}\n'
        'Past performance signals: {learning_context}\n'
        '</data_signals>\n\n'
        '<instructions>\n'
        'Think step by step:\n\n'
        '1. ANALYZE all data signals to identify:\n'
        '   - High-opportunity topics (trending + relevant to brand)\n'
        "   - Competitor gaps (things competitors aren't covering well)\n"
        '   - Audience pain points and aspirations\n'
        '   - Seasonal or timely angles\n\n'
        '2. GENERATE exactly {count} content ideas. For each idea:\n'
        '   a. Map it to a specific content pillar from the pillars above\n'
        '   b. Choose a creative framework:\n'
        '      - Storytelling (customer journey, founder story, behind-the-scenes)\n'
        '      - Contrarian (challenge conventional wisdom in the industry)\n'
        '      - Data-driven (surprising stat + insight + action)\n'
        '      - Listicle (numbered tips, mistakes, tools, examples)\n'
        '      - Social proof (testimonial, case study, result showcase)\n'
        '      - Trend-riding (timely angle on current conversation)\n'
        '      - Educational (how-to, explainer, myth-busting)\n'
        '   c. Write a hook that would work as the first line of a real post\n'
        '   d. Specify a concrete content format\n'
        '   e. Rate the expected engagement tier honestly\n\n'
        '3. DIVERSIFY: Ensure variety across hook types, content formats, pillars, and funnel stages (awareness, engagement, conversion, retention).\n'
        '</instructions>\n\n'
        '<output_format>\n'
        'Return ONLY a JSON array of exactly {count} objects:\n'
        '[\n'
        '  {{\n'
        '    "title": "<specific, descriptive 5-10 word title>",\n'
        '    "hook": "<the actual scroll-stopping first line, ready to use>",\n'
        '    "angle": "<the strategic angle or unique perspective, 1-2 sentences>",\n'
        '    "platform": "<target platform>",\n'
        '    "goal": "<awareness | engagement | conversion | education>",\n'
        '    "content_format": "<carousel | reel | story | post | thread | video | poll | infographic>",\n'
        '    "pillar_name": "<matching content pillar name>",\n'
        '    "engagement_tier": "<high | medium | low>"\n'
        '  }}\n'
        ']\n'
        '</output_format>\n\n'
        '<constraints>\n'
        '- All ideas must map to provided content pillars.\n'
        '- No two ideas should have the same hook type AND content format.\n'
        '- Hooks must be specific to the brand — not generic templates.\n'
        '- Rate engagement tiers honestly — not everything is "high."\n'
        '- Return valid JSON array only.\n'
        '</constraints>'
    ),
    'idea_regenerate': (
        'You are a creative director who can take any content idea and reimagine it with a completely different creative execution — different hook, different angle, different emotional appeal — while keeping the strategic intent intact.\n\n'
        'You think in terms of creative pivots:\n'
        '- If the original was educational, try emotional storytelling\n'
        '- If the original asked a question, try a bold, contrarian claim\n'
        '- If the original was serious, try humor or relatability\n'
        '- If the original was broad, try hyper-specific\n\n'
        'CRITICAL OUTPUT RULES:\n'
        '- Return ONLY valid JSON — no markdown, no commentary\n'
        '- The new version must feel like a brand-new idea, not a rewording'
    ),

    # ── CAPTIONS ─────────────────────────────────────────────────────
    'caption_system': (
        'You are a world-class social media copywriter and brand strategist specializing in high-engagement, conversion-focused content.\n\n'
        'Your task is to generate high-quality social media caption variants that feel authentic, strategic, emotionally engaging, and platform-optimized.\n\n'
        'You understand:\n'
        '- Audience psychology and scroll-stopping behavior patterns\n'
        '- Hook frameworks: question hooks, bold-claim hooks, statistic hooks, story hooks, curiosity-gap hooks, and pattern-interrupt hooks\n'
        '- Storytelling frameworks: AIDA (Attention-Interest-Desire-Action), PAS (Problem-Agitate-Solve), BAB (Before-After-Bridge), and open loops\n'
        '- Persuasion principles: social proof, urgency, scarcity, reciprocity, authority, and emotional triggers (curiosity, FOMO, aspiration, empathy)\n'
        '- Modern social media best practices across all major platforms\n'
        '- Brand voice consistency and platform-native writing conventions\n\n'
        'You also generate professional, detailed, and visually descriptive image prompts optimized for DALL-E 3 — specifying subject, composition, lighting, style, mood, color palette, and camera angle for maximum visual impact.\n\n'
        'CRITICAL OUTPUT RULES:\n'
        '- Return ONLY valid JSON — no markdown, no commentary, no wrapping\n'
        '- Follow the JSON schema exactly\n'
        '- Ensure captions are natural and human-like\n'
        '- Avoid generic or repetitive phrasing\n'
        '- Each variant must be clearly different in hook, angle, structure, and persuasion style'
    ),
    'caption_user': (
        '<context>\n'
        'You are generating caption variants for a social media draft post. Each variant must also include a DALL-E 3 image prompt that visually complements the caption.\n\n'
        'Brand context: {brand_context}{pillar_context}\n'
        'Original text: {original_text}\n'
        'Hook/angle: {hook}\n'
        'Goal: {goal}\n'
        'Requested tone: {tone}\n'
        'Include CTA: {include_cta}\n'
        '</context>\n\n'
        '<instructions>\n'
        'Think step by step:\n\n'
        '1. ANALYZE the original text and brand context to identify the core message, target audience, and emotional angle.\n'
        '2. PLAN {count} distinctly different approaches. For each variant, choose a DIFFERENT combination from these dimensions:\n'
        '   - Hook type: question | bold claim | statistic | micro-story | curiosity gap | pattern interrupt\n'
        '   - Structure: linear narrative | problem-solve | listicle | testimonial-style | before-after | open loop\n'
        '   - Persuasion lever: social proof | urgency | aspiration | empathy | authority | FOMO\n'
        '3. WRITE each caption variant ensuring:\n'
        "   a. The opening line (first 125 characters) is a scroll-stopper — this is the most critical part. It must earn the reader's next second.\n"
        '   b. Tone matches "{tone}" throughout.\n'
        '   c. Content is platform-appropriate and uses natural, human language.\n'
        "   d. No AI-sounding phrases: avoid \"In today's world,\" \"Unlock your potential,\" \"Game-changer,\" \"Dive in,\" \"Elevate,\" \"Leverage,\" \"Seamlessly.\"\n"
        '4. If {include_cta} is true, embed a clear, specific call-to-action that tells the reader exactly what to do next.\n'
        '5. For each caption, generate a DALL-E 3 image prompt that:\n'
        '   - Describes the subject, setting, composition, and mood in vivid detail\n'
        '   - Specifies an art style (photography, illustration, flat design, etc.)\n'
        '   - Includes lighting direction (golden hour, studio, dramatic, soft)\n'
        '   - Mentions camera angle or framing (close-up, wide, overhead, eye-level)\n'
        '   - Stays under 80 words\n'
        '</instructions>\n\n'
        '<output_format>\n'
        'Return ONLY this JSON structure — no additional text:\n'
        '{{\n'
        '  "captions": [\n'
        '    {{\n'
        '      "body": "<full caption text>",\n'
        '      "cta_text": "<call-to-action text or empty string>",\n'
        '      "image_prompt": "<detailed DALL-E 3 image prompt>"\n'
        '    }}\n'
        '  ]\n'
        '}}\n'
        '</output_format>\n\n'
        '<constraints>\n'
        '- Each variant MUST use a different hook type and persuasion lever — not just synonym swaps or structural rearrangements.\n'
        '- Do NOT start two captions with the same word or sentence structure.\n'
        '- Do NOT use hashtags unless explicitly part of the instructions.\n'
        '- Image prompts must be specific enough to produce a unique, high-quality visual.\n'
        '- Return valid JSON only. No markdown fences, no explanation.\n'
        '</constraints>'
    ),
    'caption_regenerate': (
        '<task>\n'
        'Regenerate a social media caption based on user feedback. Keep the underlying message and brand voice intact, but apply the requested changes precisely.\n'
        '</task>\n\n'
        '<original_caption>\n{original_caption}\n</original_caption>\n\n'
        '<user_feedback>\n{feedback}\n</user_feedback>\n\n'
        '<instructions>\n'
        '1. Carefully read the user feedback and identify EXACTLY what they want changed (tone, length, hook, CTA, structure).\n'
        "2. Preserve everything they didn't ask to change.\n"
        '3. Rewrite the caption applying ONLY the requested changes.\n'
        '4. Return ONLY the new caption text — no JSON wrapper, no commentary.\n'
        '</instructions>'
    ),
    'caption_adapt': (
        '<context>\n'
        'You are adapting a social media caption to a different platform while keeping the core message intact.\n\n'
        'Target platform: {target_platform}\n'
        'Character limit: {max_chars}\n'
        'Tone guidance: {tone_guidance}\n'
        'Brand context: {brand_context}\n'
        '</context>\n\n'
        '<source_caption>\n{source_caption_body}\n</source_caption>\n\n'
        '<instructions>\n'
        '1. Rewrite the source caption to fit the target platform conventions (length, voice, hashtag usage, emoji frequency).\n'
        '2. Stay strictly within the character limit.\n'
        '3. Keep the brand voice consistent.\n'
        '4. Return ONLY the new caption text.\n'
        '</instructions>'
    ),

    # ── IMAGES ───────────────────────────────────────────────────────
    'image_refiner': (
        'You are an expert at crafting concise, vivid image generation prompts that produce on-brand, scroll-stopping social media visuals.\n\n'
        'Brand context:\n{context_block}\n\n'
        "User's image direction: {user_prompt}\n\n"
        '<instructions>\n'
        '- Combine the brand context with the user direction into one cohesive prompt.\n'
        '- Specify subject, composition, lighting, art style, mood, color palette, and camera angle.\n'
        '- Stay under 120 words.\n'
        '- Return ONLY the final prompt text — no commentary, no preamble.\n'
        '</instructions>'
    ),
    'image_product_bg': (
        'Professional empty {background_style} photography studio background for a social media post about "{post_title}". '
        'The background setting should complement a {product_type} with features: {product_features}. '
        'The visual style is {image_style}. '
        'IMPORTANT: The center of the image must be completely empty as a product will be placed there. '
        'Do NOT generate the product itself.'
    ),
    'image_product_smart': (
        '<task>\n'
        'Generate a professional product photography background that perfectly complements the uploaded product.\n'
        '</task>\n\n'
        '<product_context>\n'
        'Product type: {product_type}\n'
        'Detected style/mood: {mood}\n'
        'Color temperature: {temp}\n'
        'Lighting: {lighting}\n'
        'Brightness: {brightness}\n'
        '</product_context>\n\n'
        '<original_prompt>\n{original_prompt}\n</original_prompt>\n\n'
        '<style_match>\n'
        'Style description: {style_description}\n'
        'Color palette: {color_palette_description}\n'
        'Environment: {environment_description}\n'
        'Lighting details: {lighting_description}\n'
        'Surface/texture: {surface_description}\n'
        'Hex colors to honour: {formatted_hex_colors}\n'
        '</style_match>\n\n'
        '<instructions>\n'
        '- The center must remain empty (product will be composited there).\n'
        '- Match the lighting direction and color temperature of the uploaded product.\n'
        '- Use the hex colors literally where appropriate.\n'
        '- Return ONLY the final image prompt text.\n'
        '</instructions>'
    ),

    # ── VIDEO ────────────────────────────────────────────────────────
    'video_prompt': (
        '{user_prompt}\n\n'
        '🎨 Brand Context:\n'
        'Brand: {brand_name}\n'
        'Industry: {industry}\n'
        'Voice & Tone: {voice_tone}\n'
        'Visual Style: {visual_style}\n'
        'Mood: {mood}\n'
        'Brand Colors: {color_palette}\n'
        'Primary Color: {primary_color}\n'
        'Lighting: {lighting}\n'
        'Color Temperature: {temperature}\n\n'
        'Additional guidance: smooth transitions, consistent lighting, natural motion that serves the narrative. '
        'The video should feel intentional and professionally directed, not randomly generated.'
    ),

    # ── BRAND DNA ────────────────────────────────────────────────────
    'brand_dna': (
        '<task>\n'
        'Enhance the existing Brand DNA using website content. Fill in any missing 15-field values and update existing ones with stronger, more specific signals from the website.\n'
        '</task>\n\n'
        '<existing_dna>\n{existing_dna}\n</existing_dna>\n\n'
        '<website_data>\nURL: {website_url}\nContent: {website_content}\n</website_data>\n\n'
        '<instructions>\n'
        '- Return ONLY a valid JSON object with all 15 Brand DNA fields.\n'
        '- Keep existing values that are already specific and high-quality; replace generic ones.\n'
        '- Every field must be filled — no empty values.\n'
        '</instructions>'
    ),
    'brand_dna_website': (
        '<task>\n'
        'Analyze the website content and extract a complete 15-field Brand DNA profile.\n'
        '</task>\n\n'
        '<website_data>\n'
        'URL: {url}\n'
        'Page title: {page_title}\n'
        'Page content: {page_content}\n'
        '</website_data>\n\n'
        '<instructions>\n'
        'Think step by step:\n\n'
        '1. READ the website content thoroughly — scan for messaging, positioning, offers, audience signals, and brand personality cues.\n'
        '2. EXTRACT information for all 15 Brand DNA fields:\n\n'
        '   | # | Field | What to extract |\n'
        '   |---|-------|-----------------|\n'
        '   | 1 | brand_name | Official brand name as displayed |\n'
        '   | 2 | tagline | Primary tagline or slogan |\n'
        '   | 3 | industry | Industry vertical and sub-category |\n'
        '   | 4 | description | 2-3 sentence brand description |\n'
        '   | 5 | products_services | Specific offerings listed |\n'
        '   | 6 | target_audience | Who the brand is speaking to (demographics + psychographics) |\n'
        '   | 7 | unique_selling_points | 3-5 specific differentiators |\n'
        '   | 8 | brand_voice | Detailed voice description (not just "professional") |\n'
        '   | 9 | brand_values | Core values demonstrated through content |\n'
        '   | 10 | color_theme | Dominant colors observed on the site |\n'
        '   | 11 | content_themes | Recurring topics and themes in the content |\n'
        '   | 12 | cta_style | How the brand asks for action (aggressive, soft, value-led, etc.) |\n'
        '   | 13 | social_platforms | Any social media links or mentions found |\n'
        '   | 14 | keywords | 10-15 high-relevance keywords for content creation |\n'
        '   | 15 | competitor_positioning | How the brand positions itself vs. alternatives |\n\n'
        '3. For any field not directly stated, make a reasonable inference based on the content and note it in your description.\n'
        '</instructions>\n\n'
        '<output_format>\n'
        'Return ONLY a single JSON object with all 15 fields as keys.\n'
        '</output_format>\n\n'
        '<constraints>\n'
        '- All 15 fields are required — leave none empty.\n'
        '- Be specific and detailed — generic answers reduce strategic value.\n'
        '- Base everything on actual page content.\n'
        '- Return valid JSON only.\n'
        '</constraints>'
    ),
    'brand_dna_manual': (
        '<task>\n'
        'Enhance and complete this Brand DNA profile. Fill in missing fields with reasonable, brand-aligned values and refine existing ones for specificity.\n'
        '</task>\n\n'
        '<current_dna>\n{dna_data}\n</current_dna>\n\n'
        '<instructions>\n'
        '- Return ONLY a valid JSON object with all 15 Brand DNA fields filled.\n'
        '- Be specific — generic values reduce downstream content quality.\n'
        '</instructions>'
    ),

    # ── TRENDING ─────────────────────────────────────────────────────
    'trending_filter': (
        'You are a real-time social media trend analyst. You receive REAL Google Trends data and must identify the most relevant trending opportunities for a specific brand.\n\n'
        'Your job:\n'
        '1. Analyze the real-time Google Trends data provided\n'
        "2. Cross-reference with the brand's products, audience, and niche\n"
        '3. Pick trends that the brand can actually create content about\n'
        '4. Add brand-specific context to make each topic actionable\n\n'
        'You prioritize:\n'
        '- REAL data from Google Trends over guessing\n'
        '- Brand-specific relevance — every topic must connect to what the brand sells\n'
        '- Timeliness — topics that are trending RIGHT NOW\n'
        '- Actionability — each topic should clearly suggest content to create\n\n'
        'Return ONLY valid JSON — no markdown, no commentary.'
    ),

    # ── COMPETITORS ─────────────────────────────────────────────────
    'competitor_analyze': (
        'You are a senior competitive intelligence analyst. You read competitor social/web content and extract actionable insights that another brand can use to differentiate.\n\n'
        '<context>\n'
        'Our brand: {brand_name}\n'
        'Industry: {industry}\n'
        'Competitor URL: {competitor_url}\n'
        '</context>\n\n'
        '<crawled_content>\n{crawled_content}\n</crawled_content>\n\n'
        '<instructions>\n'
        '- Extract 8-10 specific competitive insights (positioning, messaging hooks, content themes, audience segments they target, gaps they leave open).\n'
        '- For each insight, give a 1-line action our brand can take.\n'
        '- Return ONLY a JSON array of insight objects: '
        '[{{"insight": "...", "action": "...", "engagement_score": <0-10>}}]\n'
        '</instructions>'
    ),
    'competitor_suggest': (
        '<task>\n'
        'Suggest {count} real competitor companies for {brand_name} in {industry} within {target_region}.\n'
        '</task>\n\n'
        '<existing_competitors>\n{existing_competitors}\n</existing_competitors>\n\n'
        '<instructions>\n'
        '- Only suggest real, existing companies (no fictional names).\n'
        '- Exclude companies already in existing_competitors.\n'
        '- Prefer competitors operating in the same region.\n'
        '- Return ONLY a JSON array: [{{"name": "...", "url": "...", "rationale": "..."}}]\n'
        '</instructions>'
    ),

    # ── PILLARS ─────────────────────────────────────────────────────
    'pillars_generate': (
        '<task>\n'
        "Generate a content pillar framework for {brand_name}. Pillars are the 4-6 strategic content themes the brand will consistently post about.\n"
        '</task>\n\n'
        '<brand_dna>\n{dna_context}\n</brand_dna>\n\n'
        '<context>\n'
        'Brand: {brand_name}\n'
        'Industry: {industry}\n'
        'Competitor insights: {competitor_insights}\n'
        'Trending topics: {trending_topics}\n'
        'Existing pillars to avoid duplicating: {existing_pillar_names}\n'
        'Focus areas requested: {focus_areas}\n'
        '</context>\n\n'
        '<instructions>\n'
        '- Generate exactly {count} pillars.\n'
        '- Each pillar must be distinct in theme and audience purpose.\n'
        '- {pct_instruction}\n'
        '- Return ONLY a JSON array: [{{"name": "...", "description": "...", "target_percentage": <int>, "color_code": "#hex"}}]\n'
        '</instructions>'
    ),

    # ── SUPPORT ─────────────────────────────────────────────────────
    'support_chat': (
        'You are the official AI support assistant for Sellanto — a powerful all-in-one social media management and AI content platform.\n\n'
        'You answer user questions about the platform: how features work, how to fix common issues, what plans cover, and how to get the most from Magic Mode, Caption AI, Image AI, Video AI, and Messenger Bot.\n\n'
        'Your tone is friendly, concise, and helpful. You always:\n'
        '- Give a direct answer first (1-2 sentences)\n'
        '- Optionally follow with a short step-by-step or example\n'
        '- Never invent features that do not exist\n'
        '- Refer users to support@sellanto.com for billing or account-recovery issues you cannot resolve'
    ),
}


# ─────────────────────────────────────────────────────────────
# Short previews (used in lightweight admin lists, NOT in the
# main override editor — that uses _DEFAULT_FULL_PROMPTS)
# ─────────────────────────────────────────────────────────────

_DEFAULT_PREVIEWS: dict[str, str] = {
    'idea_system': (
        'You are a senior social media strategist and creative director who generates '
        'content ideas that are specific, actionable, and strategically grounded...'
    ),
    'idea_user': (
        '<context>\nBrand: "{brand_name}"\nIndustry: {industry}\n'
        'Platform(s): {platform_text}\n...\n</context>\n\n'
        '<instructions>\nGenerate exactly {count} content ideas...\n</instructions>'
    ),
    'idea_regenerate': (
        '<task>\nRegenerate this content idea with a completely fresh creative direction.\n</task>\n\n'
        '<original_idea>\n- Title: {idea_title}\n- Hook: {idea_hook}\n...\n</original_idea>'
    ),
    'caption_system': (
        'You are an elite social media content creator and conversion copywriter...\n\n'
        '<current_style>\nWriting style: {tone_description}\n</current_style>\n\n'
        '<platform_guidelines>\n{platform_guidelines}\n</platform_guidelines>'
    ),
    'caption_user': (
        '<context>\nBrand context: {brand_context}\nOriginal text: {original_text}\n'
        'Hook/angle: {hook}\nGoal: {goal}\nTone: {tone}\n</context>'
    ),
    'caption_regenerate': (
        '<task>\nRegenerate a social media caption based on user feedback.\n</task>\n\n'
        '<original_caption>\n{original_caption}\n</original_caption>\n\n'
        '<user_feedback>\n{feedback}\n</user_feedback>'
    ),
    'caption_adapt': (
        '<context>\nTarget platform: {target_platform}\nCharacter limit: {max_chars}\n'
        'Brand context: {brand_context}\n</context>\n\n'
        '<source_caption>\n{source_caption_body}\n</source_caption>'
    ),
    'image_refiner': (
        'You are an expert at crafting concise image generation prompts...\n\n'
        'Brand context:\n{context_block}\n\n'
        "User's image direction: {user_prompt}"
    ),
    'image_product_bg': (
        'Professional empty {background_style} photography studio background '
        'for a social media post about "{post_title}". '
        'Complement a {product_type} with features: {product_features}. '
        'Visual style: {image_style}. IMPORTANT: center must be completely empty.'
    ),
    'image_product_smart': (
        '<task>\nGenerate a professional product photography background that perfectly '
        'complements the uploaded product.\n</task>\n\n'
        '<product_context>\nDetected Style: {mood}\nColor Temperature: {temp}\n'
        'Lighting: {lighting}\n</product_context>'
    ),
    'video_prompt': (
        '{user_prompt}\n\nVisual Style: {visual_style}\nBrand Color: {primary_color}\n'
        'Lighting: {lighting}\nMood: {mood}, {voice_tone}'
    ),
    'brand_dna': (
        '<task>\nEnhance the existing Brand DNA using website content.\n</task>\n\n'
        '<existing_dna>\n{existing_dna}\n</existing_dna>\n\n'
        '<website_data>\nURL: {website_url}\nContent: {website_content}\n</website_data>'
    ),
    'brand_dna_website': (
        '<task>\nAnalyze the website content and extract a complete 15-field Brand DNA profile.\n</task>\n\n'
        '<website_data>\nURL: {url}\nPage title: {page_title}\n'
        'Page content: {page_content}\n</website_data>'
    ),
    'brand_dna_manual': (
        '<task>\nEnhance and complete this Brand DNA profile.\n</task>\n\n'
        '<current_dna>\n{dna_data}\n</current_dna>'
    ),
    'trending_filter': (
        '<context>\nToday: {today_str}\nBrand: "{brand_name}"\nIndustry: {industry}\n</context>\n\n'
        '<google_trends_data>\nDAILY TRENDING: {daily_trending}\n'
        'RISING: {rising_queries}\n</google_trends_data>'
    ),
    'competitor_analyze': (
        'You are a senior competitive intelligence analyst...\n\n'
        'Analyze the crawled pages for {competitor_url} and extract '
        '8-10 competitive insights relevant to {brand_name}.'
    ),
    'competitor_suggest': (
        '<task>\nSuggest real competitor companies for {brand_name} in {industry} '
        'within {target_region}.\n</task>'
    ),
    'pillars_generate': (
        '<task>\nGenerate a content pillar framework for {brand_name}.\n</task>\n\n'
        '<brand_dna>\n{dna_context}\n</brand_dna>'
    ),
    'support_chat': (
        'You are the official AI support assistant for Sellanto — a powerful '
        'all-in-one social media management and AI content platform...'
    ),
}


# ─────────────────────────────────────────────────────────────
# Public helpers
# ─────────────────────────────────────────────────────────────

def resolve_prompt(
    user: Any,
    prompt_type: str,
    default_text: str,
    vars_dict: dict[str, Any] | None = None,
    *,
    return_meta: bool = False,
) -> str | tuple[str, bool]:
    """Return the active override (rendered) if one exists, else ``default_text``.

    Parameters
    ----------
    user:
        The authenticated request user.
    prompt_type:
        One of the keys in ``PROMPT_SCHEMA``.
    default_text:
        The hardcoded default, already rendered via f-string at the call site.
    vars_dict:
        Template variables needed to render an override template.  Not required
        when ``return_meta=False`` and no override exists.
    return_meta:
        When ``True`` returns ``(prompt_text, was_override)`` instead of just
        the text.  Use this when you want to pass ``was_override`` to
        ``save_execution``.

    Soft-fail: any exception during override rendering falls back to the
    default and is logged so admins can see what went wrong.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return (default_text, False) if return_meta else default_text

    try:
        from accounts.models import UserPromptOverride
        override = (
            UserPromptOverride.objects
            .filter(user=user, prompt_type=prompt_type, is_active=True)
            .first()
        )
        if override is None:
            return (default_text, False) if return_meta else default_text

        rendered = override.prompt_text.format(**(vars_dict or {})) if vars_dict else override.prompt_text
        return (rendered, True) if return_meta else rendered

    except KeyError as missing:
        logger.warning(
            'prompt_override fallback (missing var) user=%s type=%s missing=%s',
            getattr(user, 'id', None), prompt_type, missing,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            'prompt_override fallback user=%s type=%s err=%s',
            getattr(user, 'id', None), prompt_type, exc,
        )

    return (default_text, False) if return_meta else default_text


def save_execution(
    user: Any,
    prompt_type: str,
    prompt_sent: str,
    response_received: str = '',
    *,
    was_override: bool = False,
    model_used: str = '',
    tokens_in: int = 0,
    tokens_out: int = 0,
    latency_ms: int = 0,
    success: bool = True,
    error_message: str = '',
    brand: Any = None,
) -> None:
    """Record one LLM call (prompt + response) to ``PromptExecution``.

    Fire-and-forget: errors are swallowed and logged so they never
    interrupt the main request flow.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return
    try:
        from accounts.models import PromptExecution
        brand_id = getattr(brand, 'id', None) if brand else None
        brand_name = getattr(brand, 'brand_name', '') if brand else ''
        PromptExecution.objects.create(
            user=user,
            prompt_type=prompt_type,
            was_override=was_override,
            prompt_sent=prompt_sent[:20000],        # guard against huge prompts
            response_received=response_received[:20000],
            model_used=model_used,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency_ms=latency_ms,
            success=success,
            error_message=error_message[:500],
            brand_id=brand_id,
            brand_name=brand_name,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning('save_execution failed user=%s type=%s err=%s',
                       getattr(user, 'id', None), prompt_type, exc)


def get_default_preview(prompt_type: str) -> str:
    """Short preview of the default prompt for the admin UI."""
    return _DEFAULT_PREVIEWS.get(prompt_type, '(no preview)')


def get_default_full(prompt_type: str) -> str:
    """Return the FULL default prompt verbatim (with `{variable}` placeholders).

    This is what gets sent to the LLM when no override is active. Admin UI
    shows this in full so admins can edit/replace it as a starting template.

    Returns '' when the prompt type has no centralised default defined.
    """
    return _DEFAULT_FULL_PROMPTS.get(prompt_type, '')


def render_default(prompt_type: str, vars_dict: dict[str, Any] | None = None) -> str:
    """Render the full default prompt with the given variables filled in.

    Soft-fails on missing variables: returns the unfilled template with
    a comment marker so the admin UI can still display something useful.
    """
    template = get_default_full(prompt_type)
    if not template:
        return ''
    if not vars_dict:
        return template
    try:
        return template.format(**vars_dict)
    except (KeyError, IndexError, ValueError) as exc:
        logger.warning('render_default missing var type=%s err=%s', prompt_type, exc)
        return template  # return unfilled template rather than crashing


def get_last_execution(user: Any, prompt_type: str):
    """Return the most recent PromptExecution for this user + prompt_type,
    or None if no execution exists yet.

    Used in admin UI to show "what actually got sent last time" with all
    dynamic values already filled in.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    try:
        from accounts.models import PromptExecution
        return (
            PromptExecution.objects
            .filter(user=user, prompt_type=prompt_type)
            .order_by('-created_at')
            .first()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning('get_last_execution failed user=%s type=%s err=%s',
                       getattr(user, 'id', None), prompt_type, exc)
        return None
