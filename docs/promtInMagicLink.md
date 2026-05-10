# Magic Link — AI Prompt Triggers (Complete Deep Reference)

> Every question a user answers in Magic Link feeds directly into one or more AI calls.
> This document maps **question → answer → prompt → API call**, step by step.
> Cross-checked against full frontend + backend source code.

---

## Overview: The Full Pipeline

```
User opens Magic Link
       │
       ▼
[Screen 1] URL Input  →  optional website URL + logo
       │
       ▼
[Screen 2] 7 Questions  →  industry, goal, tone, post_type, product_mode, platforms, colors
       │
       ├─ if post_type = "Image" & product_mode = "Yes"  →  [Screen 3] Product Upload
       ├─ if post_type = "Video"                         →  [Screen 3] Video Prompt
       │                                                            │
       │                                                            ▼
       │                                                 [Screen 4] VideoWorkingScreen
       │                                                            │
       │                                                            ▼
       │                                                 [Video Result Screen]
       │
       ▼
[CacheCheckScreen]  →  existing cache? → show previous or generate fresh
       │
       ▼
[AIWorkingScreen] 7-Step Generation Pipeline
       │
       ▼
[Results Screen] → Review → Edit → Feedback Loop → Approve → Publish/Schedule
```

**AI Models Used:**
- **Claude** (`claude-sonnet-4-20250514`) — primary for all text (captions, ideas, DNA, adaptations)
- **Claude** (`claude-haiku-4-5-20251001`) — fallback for text
- **OpenAI** (`gpt-4o`) — secondary fallback for text; `gpt-image-1.5` / `dall-e-3` for images
- **Gemini** (`gemini-2.0-flash`) — tertiary fallback for text; `gemini-3.1-flash-image-preview` for images; `veo-3.1-generate-preview` / `veo-2.0-generate-001` for video
- **OpenAI** (`text-embedding-3-small`) — embeddings for Brand DNA RAG

---

## Part 1 — The 7 Questions & What They Control

Defined in [AIQuestionsScreen.tsx](../frontend/src/pages/magic/AIQuestionsScreen.tsx).

| # | ID | Question | Options |
|---|---|---|---|
| 1 | `industry` | What best describes your business? | Digital Marketing Agency, E-commerce / Online Store, SaaS / Software Company, Local Service Business, Consulting / Freelancing, Other |
| 2 | `goal` | What's your main goal with social media? | Get more customers / leads, Build brand awareness, Drive website traffic, Establish thought leadership, Showcase products / services |
| 3 | `tone` | How should your posts sound? | Professional & Authoritative, Friendly & Approachable, Bold & Provocative, Educational & Helpful, Fun & Casual |
| 4 | `post_type` | What do you want to create? | 📷 Image posts, 🎬 Video content |
| 5* | `product_mode` | Feature your real products? | Yes - I have product images, No - AI generates everything |
| 6 | `platforms` | Where do you post most? (multi-select) | LinkedIn, Instagram, Facebook, Twitter/X, TikTok |
| 7 | `colors` | What colors represent your brand? | Blue tones, Red/Orange, Green, Purple, Dark/Minimal, Use colors from my website |

> \* Q5 (`product_mode`) only appears when `post_type = "Image posts"`.

**Answer → Control mapping:**

| Answer | What it controls |
|---|---|
| Q1 `industry` | Trending topics filter, Brand DNA context in Steps 3 & 4 |
| Q2 `goal` | Implicit via Brand DNA; idea goal field in Step 3 |
| Q3 `tone` | Caption tone enum in Step 4; cross-platform adaptation |
| Q4 `post_type` | Entire pipeline branch (image vs video) |
| Q5 `product_mode` | ProductUploadScreen shown/hidden; image gen Path A vs B |
| Q6 `platforms` | Round-robin caption platform assignment; post save |
| Q7 `colors` | Background style hint in image generation |
| URL Input | Triggers Brand DNA website crawl (Step 1) |

---

## Part 2 — The 7-Step AI Pipeline (Image Mode)

Defined in [AIWorkingScreen.tsx](../frontend/src/pages/magic/AIWorkingScreen.tsx):

```
Step 0  →  Brand Setup                ← No AI
Step 1  →  Brand DNA Generation       ← AI #1: Claude (website crawl → enrichment)
Step 2  →  Trending Topics            ← No AI (Google Trends / pytrends)
Step 3  →  Content Ideas              ← AI #2: Claude  ← PRIMARY PROMPT
Step 4  →  Caption Writing            ← AI #3: Claude  ← PRIMARY PROMPT (per idea)
Step 5  →  Image Design               ← AI #4: Gemini Imagen / OpenAI DALL-E
Step 6  →  Save & Polish              ← No AI
```

---

## Part 3 — Screen 1: URL Input

File: [URLInputScreen.tsx](../frontend/src/pages/magic/URLInputScreen.tsx)

**Fields:**
- Website URL (required, validated for domain format)
- Brand logo upload (optional — PNG/JPEG/WebP/SVG)

**What this triggers:**
- If URL is provided → Step 1 (Brand DNA generation) runs
- Logo file → uploaded in Step 0 via `PATCH /brands/{id}/`
- If URL skipped → Step 1 is skipped entirely (`skipDNAGeneration = true`)

---

## Part 4 — Step 0: Brand Setup (No AI)

**Trigger:** Always first  
**API calls:**
```
GET  /brands/                   ← check for existing brand
POST /brands/                   ← create if none exists
PATCH /brands/{id}/             ← upload logo (if provided)
POST /brand-assets/             ← create BrandAsset for logo
```

No prompt. Brand ID from this step is passed to every subsequent call.

---

## Part 5 — Step 1: Brand DNA Generation

**File:** `strategyService.generateDNA(brandId, websiteUrl)`  
**API:** `POST /brands/{brandId}/generate-dna/`  
**Model:** Claude (`claude-sonnet-4-20250514`)  
**Trigger:** Only if URL was provided AND user has no existing DNA  
**Skipped if:** `skipDNAGeneration = true` OR no URL entered

### Phase A — Website Crawl + Embedding (Backend, before Claude)

Before Claude is called, the backend:
1. Crawls brand website (up to 50 pages)
2. Chunks text (1000 char chunks, 200 char overlap)
3. Creates embeddings via **OpenAI** `text-embedding-3-small`
4. Stores chunks in `BrandDNAChunk` model for RAG
5. Stores metadata: `pages_crawled`, `total_chunks`, `page_titles`, `website_url`

```python
openai_client.create_embeddings_batch(
    chunk_texts,
    model="text-embedding-3-small"
)
```

### Phase B — Claude Enrichment Prompt

**System Prompt:** Default Claude behavior (no explicit system prompt set)

**User Prompt sent to Claude:**
```
Enhance the existing Brand DNA using website content. Keep ALL existing values but
fill gaps and enrich thin descriptions with evidence from the website.

For each of the 15 fields:
1. If the field has a strong value, keep it exactly as-is.
2. If the field has a thin/generic value, enrich it with website evidence
   while preserving the original intent.
3. If the field is empty, fill it using website content.
```

**Returns:** Enriched Brand DNA with 15 fields:
`brand_name, industry, tone_of_voice, target_audience, value_proposition, unique_selling_point, brand_personality, content_pillars, visual_style, mood, brand_colors, key_messages, competitors, brand_voice, tagline`

> This DNA object is injected into every subsequent AI call as `{brand_context}` / `{dna_context}`.

---

## Part 6 — Step 2: Trending Topics (Google Trends + Claude)

> See **Part 18** for the full prompt. Step 2 uses Claude to filter Google Trends data.

**API:** `POST /brands/{brandId}/generate-trending/`  
**Flow:** Google Trends (pytrends) raw data → Claude filter/rank → top 15 saved, top 5 used  
**Feeds from:** Q1 `industry` + Brand DNA keywords + content pillar names  
**Stored as:** `store.trendingTopics[]` → injected as `{trending_context}` in Step 3

---

## Part 7 — Step 3: Content Ideas ← PRIMARY AI CALL

**File:** `strategyService.generateIdeas()`  
**API:** `POST /ideas/generate/`  
**Model:** Claude (`claude-sonnet-4-20250514`)  
**Trigger:** Always runs

**What questions inject into this prompt:**
- Q1 `industry` → `{brand.industry}`
- Q2 `goal` → implicit via Brand DNA
- Q6 `platforms` → `{platform_text}`
- Step 2 output → `{trending_context}`

---

### System Prompt (sent to Claude):

```
You are a senior social media strategist and creative director who generates content
ideas that are specific, actionable, and strategically grounded.

Your ideas are NOT generic "post about X" suggestions. Each idea is detailed enough
that a content creator could execute it without additional briefing.

Your approach combines:
- Data signals (trending topics, competitor gaps, past performance)
- Audience psychology (what makes people stop, save, share, and comment)
- Content strategy (pillar balance, funnel alignment, platform optimization)
- Creative frameworks (storytelling, contrarian takes, data-driven hooks,
  behind-the-scenes, social proof, UGC-inspired, educational series)

You understand that the best content ideas are at the intersection of:
1. What the brand wants to say
2. What the audience wants to hear
3. What the platform rewards

CRITICAL OUTPUT RULES:
- Return ONLY a valid JSON array — no markdown, no commentary
- Each idea must be specific enough to execute immediately
- No duplicate angles or overlapping ideas
```

---

### User Prompt Template (sent to Claude):

```xml
<context>
Brand: "{brand_name}"
Industry: {industry}
Region: {target_region}
Platform(s): {platform_text}
Content pillars: {pillar_context}
</context>

<data_signals>
Brand DNA: {dna_context}
Competitor insights: {competitor_context}
Trending topics: {trending_context}
Past performance signals: {learning_context}
</data_signals>

<instructions>
Think step by step:

1. ANALYZE all data signals to identify:
   - High-opportunity topics (trending + relevant to brand)
   - Competitor gaps (things competitors aren't covering well)
   - Audience pain points and aspirations
   - Seasonal or timely angles

2. GENERATE exactly {count} content ideas. For each idea:
   a. Map it to a specific content pillar from the pillars above
   b. Choose a creative framework:
      - Storytelling (customer journey, founder story, behind-the-scenes)
      - Contrarian (challenge conventional wisdom in the industry)
      - Data-driven (surprising stat + insight + action)
      - Listicle (numbered tips, mistakes, tools, examples)
      - Social proof (testimonial, case study, result showcase)
      - Trend-riding (timely angle on current conversation)
      - Educational (how-to, explainer, myth-busting)
   c. Write a hook that would work as the first line of a real post
   d. Specify a concrete content format
   e. Rate the expected engagement tier honestly

3. DIVERSIFY: Ensure variety across hook types, content formats, pillars,
   and funnel stages (awareness, engagement, conversion, retention).

<output_format>
Return ONLY a JSON array of exactly {count} objects:
[
  {
    "title": "<specific, descriptive 5-10 word title>",
    "hook": "<the actual scroll-stopping first line, ready to use>",
    "angle": "<the strategic angle or unique perspective, 1-2 sentences>",
    "platform": "<target platform>",
    "goal": "<awareness | engagement | conversion | education>",
    "content_format": "<carousel | reel | story | post | thread | video | poll | infographic>",
    "pillar_name": "<matching content pillar name>",
    "engagement_tier": "<high | medium | low>"
  }
]
</output_format>

<constraints>
- All ideas must map to provided content pillars.
- No two ideas should have the same hook type AND content format.
- Hooks must be specific to the brand — not generic templates.
- Rate engagement tiers honestly — not everything is "high."
- Return valid JSON array only.
</constraints>
```

**Runtime variables:**

| Variable | Source |
|---|---|
| `{brand_name}` | Brand profile |
| `{industry}` | Q1 answer |
| `{target_region}` | Brand profile |
| `{platform_text}` | Q6 answer |
| `{pillar_context}` | Brand DNA content pillars |
| `{dna_context}` | Full Brand DNA from Step 1 |
| `{competitor_context}` | Backend competitor analysis |
| `{trending_context}` | Top 5 topics from Step 2 |
| `{learning_context}` | Past post performance data |
| `{count}` | 2 default, up to 10 |

---

## Part 8 — Step 4: Caption Writing ← PRIMARY AI CALL

**File:** `captionService.generate()`  
**API:** `POST /ai-caption/generate/`  
**Model:** Claude (`claude-sonnet-4-20250514`)  
**Trigger:** Once per idea (3 ideas → 3 separate calls)

**What questions inject into this prompt:**
- Q3 `tone` → mapped to enum → `{tone}` param
- Q6 `platforms` → round-robin per idea → `{platform}`

**Tone mapping (Q3 → API value):**

| User selected | API value |
|---|---|
| Professional & Authoritative | `professional` |
| Friendly & Approachable | `friendly` |
| Bold & Provocative | `enthusiastic` |
| Educational & Helpful | `formal` |
| Fun & Casual | `casual` |

**Platform assignment:**
```javascript
// Round-robin: idea 0 → platforms[0], idea 1 → platforms[1 % length], etc.
platform = selectedPlatforms[ideaIndex % selectedPlatforms.length]
```

---

### System Prompt — Elite Copywriter (sent to Claude):

```
You are an elite social media content creator and conversion copywriter with 10+ years
of experience crafting viral, high-engagement content for brands ranging from startups
to Fortune 500 companies.

<writing_philosophy>
1. HOOK FIRST — The first line must earn the reader's next second.
2. AUTHENTIC VOICE — Write like a smart friend, not a corporate brochure.
3. EMOTIONAL RESONANCE — Tap specific emotions (curiosity, aspiration, belonging,
   FOMO, relief, excitement) rather than generic positivity.
4. VALUE DENSITY — Every line entertains, educates, or moves toward the CTA.
5. PLATFORM INTELLIGENCE — Write natively for each platform's culture and algorithm.
</writing_philosophy>

<current_style>
Writing style for this request: {tone_description}
</current_style>

<platform_guidelines>
{platform_specific_guidelines}
</platform_guidelines>

<engagement_techniques>
Apply these proven techniques where appropriate:
- Open loops ("Here's what nobody tells you about...")
- Specificity over generality ("347 customers" beats "many customers")
- Pattern interrupts in the first line
- Power words: discover, secret, mistake, finally, proof, warning, free, instant
- Micro-stories (setup > tension > resolution in 2-3 sentences)
- Direct address ("You're probably making this mistake right now")
</engagement_techniques>

<anti_patterns>
NEVER use these AI-sounding phrases:
- "In today's fast-paced world"
- "Unlock your potential" / "Unlock the power of"
- "Game-changer" / "Revolutionary" / "Cutting-edge"
- "Dive in" / "Elevate" / "Leverage" / "Seamlessly"
- "Delve into" / "Synergy" / "Paradigm shift"
</anti_patterns>

<formatting_rules>
- Emoji usage: {emoji_setting}
- Call-to-action: {cta_setting}
- Hashtag usage: {hashtag_setting}
</formatting_rules>

<output_rules>
- Return ONLY the caption text — no preamble, no explanation
- If hashtags are requested, place them on a new line at the very end
- No markdown formatting, no quotes around the text
</output_rules>
```

---

### User Prompt Template — Text Caption (sent to Claude):

```xml
<context>
You are generating caption variants for a social media draft post. Each variant
must also include a DALL-E 3 image prompt that visually complements the caption.

Brand context: {brand_context}
{pillar_context}
Original text: {original_text}
Hook/angle: {post.hook}
Goal: {post.goal}
Requested tone: {tone}
Include CTA: {include_cta}
</context>

<instructions>
Think step by step:

1. ANALYZE the original text and brand context to identify the core message,
   target audience, and emotional angle.
2. PLAN {count} distinctly different approaches. For each variant, choose a
   DIFFERENT combination from these dimensions:
   - Hook type: question | bold claim | statistic | micro-story | curiosity gap |
     pattern interrupt
   - Structure: linear narrative | problem-solve | listicle | testimonial-style |
     before-after | open loop
   - Persuasion lever: social proof | urgency | aspiration | empathy | authority | FOMO
3. WRITE each caption variant ensuring:
   a. The opening line (first 125 characters) is a scroll-stopper.
   b. Tone matches "{tone}" throughout.
   c. No AI-sounding phrases.
4. If {include_cta} is true, embed a clear, specific call-to-action.
5. For each caption, generate a DALL-E 3 image prompt that:
   - Describes subject, setting, composition, and mood in vivid detail
   - Specifies an art style
   - Includes lighting direction
   - Mentions camera angle or framing
   - Stays under 80 words

<output_format>
Return ONLY this JSON structure:
{
  "captions": [
    {
      "body": "<full caption text>",
      "cta_text": "<call-to-action text or empty string>",
      "image_prompt": "<detailed DALL-E 3 image prompt>"
    }
  ]
}
</output_format>

<constraints>
- Each variant MUST use a different hook type and persuasion lever.
- Do NOT start two captions with the same word or sentence structure.
- Do NOT use hashtags unless explicitly part of the instructions.
- Return valid JSON only.
</constraints>
```

---

### User Prompt Template — Image-Based Caption (Vision)

Triggered when user uploads an image to the standalone caption generator (not Magic Link).

```xml
<task>
Analyze the attached image, then create an engaging social media caption grounded
in what you actually see.
</task>

<parameters>
- Additional context from user: {additional_context or 'None'}
- Target length: {word_count}
- Custom instructions: {custom_instructions}
</parameters>

<instructions>
Think step by step:
1. OBSERVE: Scan the image carefully. Note the subject, setting, colors, mood,
   people, objects, and any text visible.
2. IDENTIFY the most compelling story, emotion, or message the image conveys.
3. CONNECT: If additional context is provided, weave it naturally into the caption.
4. WRITE: Create a caption that would make someone who hasn't seen the image curious.
</instructions>

<output_format>
ANALYSIS: [2-3 sentence detailed description of what you see]
CAPTION: [The generated social media caption]
</output_format>

<constraints>
- The caption must be grounded in visible image content — do not invent elements.
- The caption should work both with and without the image visible.
</constraints>
```

**Technical note:** Image is passed as base64 to Claude via Anthropic vision format:
```python
{
  'type': 'image',
  'source': {
    'type': 'base64',
    'media_type': 'image/jpeg',  # or png, webp
    'data': '<base64_data>',
  }
}
```

---

### User Prompt Template — Video Frame Analysis

Triggered when user uploads a video for caption generation (standalone tool).

```xml
<task>
The attached images are frames extracted from a video, presented in chronological order.
Analyze the full sequence to understand the story, then generate an engaging caption.
</task>

<parameters>
- Target length: {word_count}
- Context provided: {additional_context}
- Custom instructions: {custom_instructions}
</parameters>

<instructions>
Think step by step:
1. SCAN all frames in order — identify beginning, middle, and end of the visual narrative.
2. IDENTIFY: What is happening? What changes across frames? What's the key moment?
3. FIND THE HOOK: What's the single most interesting, surprising, or emotional aspect?
4. WRITE a caption that captures the essence — not a frame-by-frame description,
   but the feeling and story it conveys.
</instructions>

<output_format>
ANALYSIS: [2-3 sentences describing the video's content, story arc, and key moments]
CAPTION: [The generated social media caption]
</output_format>

<constraints>
- Treat the frames as a SEQUENCE — look for narrative flow, not just individual stills.
- The caption should make someone want to watch the video, not replace it.
</constraints>
```

---

### User Prompt Template — Caption Regeneration with Feedback

Triggered when user clicks "Give Feedback" → selects caption issue → submits.

```xml
<task>
Regenerate a social media caption based on user feedback. The new version must be
noticeably better than the original — not just slightly adjusted.
</task>

<original_caption>
{original_caption}
</original_caption>

<user_feedback>
{feedback}
</user_feedback>

<instructions>
Think step by step:
1. DIAGNOSE: What specifically is the user unhappy with? Map feedback to concrete
   issues (too long, wrong tone, weak hook, missing CTA, too generic, etc.).
2. PRESERVE: Identify what works in the original — don't throw it all away.
3. REWRITE: Create a new caption that addresses ALL feedback points.
4. VERIFY: Re-read the feedback and confirm every point has been addressed.
</instructions>

<constraints>
- Return ONLY the new caption text — no explanation, no "Here's your updated version."
- The new caption must demonstrably address the feedback.
</constraints>
```

**Feedback options in Results screen:**
```
"What do you want to change?"
  ├─ "The caption / text"   → caption_fix: "Too long / Too short / Wrong tone / Weak hook / Missing CTA / Other"
  ├─ "The image style"      → image_fix: "Wrong colors / Too busy / Wrong mood / Other"
  ├─ "The overall topic"    → topic_fix: "How-to guide / Success story / Product feature / Industry news / Other"
  └─ custom text → appended as `custom_instructions`
```

---

### User Prompt Template — Multi-Variation Captions

Triggered when user requests multiple caption options.

```xml
<task>
Generate {num_variations} distinctly different social media caption variations.
Each must feel like it was written by a different creative mind with a different strategy.
</task>

<topic_or_analysis>
{topic_or_analysis}
</topic_or_analysis>

<instructions>
Think step by step:
1. BRAINSTORM {num_variations} completely different creative strategies:
   - Variation 1: Different HOOK type (question vs. bold statement vs. stat)
   - Variation 2: Different ANGLE (educational vs. emotional vs. humorous)
   - Variation 3+: Different PERSUASION style (FOMO vs. aspiration vs. social proof)
2. WRITE each variation independently.
3. NUMBER each: 1., 2., 3., etc.
</instructions>

<quality_checklist>
- Opens with a different first word than all other variations
- Uses a different sentence structure
- Appeals to a different emotion
- Hits target word count +/-10 words
</quality_checklist>

<constraints>
- Do NOT create variations that are merely synonym swaps or reordered sentences.
</constraints>
```

**Runtime variables for Step 4:**

| Variable | Source |
|---|---|
| `{brand_context}` | Brand DNA from Step 1 |
| `{original_text}` | Idea title + angle from Step 3 |
| `{post.hook}` | Hook line from Step 3 |
| `{post.goal}` | Goal from Step 3 |
| `{tone}` | Q3 answer (mapped enum) |
| `{include_cta}` | Always `true` in Magic Link |
| `{count}` | 3 default variants |
| `{tone_description}` | Full description of tone style |
| `{platform_specific_guidelines}` | Platform-specific character limits + behavior notes |

---

## Part 9 — Step 5: Image Generation

**File:** `imageService.generate()`  
**API:** `POST /ai-image/generate/`  
**Models:** `gemini-3.1-flash-image-preview` (primary), `gpt-image-1.5` / `dall-e-3` (fallback)  
**Trigger:** Once per idea

**What questions feed this:**
- Q5 `product_mode` → Path A (product) or Path B (AI-only)
- Q7 `colors` → background_style hint
- The `image_prompt` from Step 4 caption output feeds into backend prompt enhancement

---

### Path A — Product-Based Images (product_mode = "Yes")

**Prompt built in frontend** ([AIWorkingScreen.tsx](../frontend/src/pages/magic/AIWorkingScreen.tsx)):

```javascript
const productPrompt = `Professional empty ${backgroundStyle} photography studio
background for a social media post about "${post.title}".
The background setting should complement a ${productType} with features: ${productFeatures}.
The visual style is ${post.imageStyle}.
IMPORTANT: The center of the image must be completely empty as a product will
be placed there. Do NOT generate the product itself.`;
```

**Backend then enhances this prompt** via `product_compositor.py`:

```
<task>
Generate ONLY a professional product photography background/scene.
The user has uploaded their own product image which will be composited onto
this scene afterward. You must generate the BACKGROUND ONLY.
</task>

<scene_description>
{original_prompt}
</scene_description>

<instructions>
Create a high-quality product photography environment that:
1. Matches the scene description above
2. Has even, professional lighting suitable for product photography
3. Features a clean, unobstructed area in the center-bottom third where a product
   will be placed
4. Includes appropriate surface texture (marble, wood, fabric, etc.)
5. Has depth and dimension through background elements, bokeh, or gradients
6. Feels premium and brand-appropriate
</instructions>

<critical_constraints>
- Do NOT generate any product, object, item, or subject in the foreground or center
- The center of the composition MUST be empty
- Focus exclusively on: background environment, surface/texture, lighting, atmospheric
  depth, and mood
- No text, logos, or watermarks
</critical_constraints>
```

**If product style analysis succeeds** (`analyze_product_style=true`), backend uses `smart_prompt_builder.py` to build a style-matched prompt:

```xml
<task>
Generate a professional product photography background that perfectly complements
the uploaded product. The background must match the product's visual style, colors,
and lighting characteristics.
</task>

<product_context>
Product Type: {product_type}
Detected Style: {mood}           ← from CV analysis of uploaded image
Color Temperature: {temp}        ← warm/cool/neutral
Lighting Character: {lighting}   ← soft natural/hard studio/dramatic/balanced
Brightness Level: {brightness}
</product_context>

<scene_requirements>
{original_prompt}

Visual Style:
- {style_description}
- {color_palette_description}   ← extracted hex codes from product image
- {environment_description}

Lighting:
- {lighting_description}
- Maintain consistent lighting direction and quality
- Subtle highlights and shadows for depth and dimension

Surface & Background:
- {surface_description}
- Create depth through subtle bokeh, gentle gradients, or tasteful environmental elements
- Premium high-end aesthetic

Composition:
- CRITICAL: EMPTY CENTER AREA where the product will be composited
- Visual balance with thoughtful use of negative space
</scene_requirements>

<critical_constraints>
- Do NOT generate ANY product, object, item, or subject in the foreground or center
- Match the detected color palette: {temp} tones {formatted_hex_colors}
- Complement the product's {lighting} characteristics
- Absolutely NO text, logos, watermarks, or graphics
</critical_constraints>
```

**Negative prompt** (appended automatically):
```
product in center, product in foreground, foreground object, central subject,
cluttered composition, busy scene, text overlay, logo, watermark, branding, graphics
[+ style-specific negatives: busy patterns, excessive details, etc.]
```

**Product style analysis** is done locally in Python (no AI call) via `product_style_analyzer.py`:
- K-means clustering for dominant colors
- Color temperature detection (warm/cool/neutral)
- Brightness & contrast measurement
- Lighting type classification (soft natural, hard studio, dramatic, balanced)
- Style mood classification (modern minimalist, bold dramatic, moody atmospheric, professional)

**API Payload (Path A):**
```json
{
  "prompt": "<productPrompt>",
  "title": "post title",
  "provider": "gemini",
  "style": "modern",
  "enhance_prompt": true,
  "product_image": "<File>",
  "product_type": "<from productAnswers.type>",
  "background_style": "<from productAnswers.background>",
  "analyze_product_style": true,
  "match_product_style": true,
  "product_position": "center_bottom",
  "product_scale": 1.0,
  "brand_logo_id": "<optional>",
  "logo_position": "bottom_right"
}
```

---

### Path B — AI-Only Images (product_mode = "No")

**Prompt built in frontend:**
```javascript
{
  prompt: `Create a professional social media image for: "${post.title}". ${post.imageStyle}`,
  title: post.title,
  provider: 'gemini',
  style: 'modern',
  enhance_prompt: true,
  brand_logo_id: <optional>,
  logo_position: 'bottom_right'
}
```

**Backend adds style enhancement tags** before sending to Gemini/OpenAI:

```
{prompt}.

Visual style: {style_addition}.
Lighting: {lighting_addition}.
Camera angle: {camera_addition}.

Ensure professional quality with clear composition, consistent lighting, and a
cohesive visual mood throughout.
```

**Style options and their prompt additions:**

| Style | Addition |
|---|---|
| `realistic` | photorealistic, cinematic quality, natural lighting, detailed textures |
| `artistic` | artistic, creative, painterly, expressive, unique visual style |
| `cinematic` | cinematic, movie-like, dramatic lighting, film grain |
| `minimalist` | clean, minimal, simple composition, lots of white space |
| `vintage` | vintage, retro, nostalgic, film grain, muted colors |
| `neon` | neon lights, vibrant colors, night scene, glowing effects |

---

### Image Prompt Engineering — 9-Layer Architecture

File: `ai_image/services/prompt_engineering_service.py`

When admin-engineered prompts are active, this system prompt governs all image prompts:

```
You are an expert AI Image Prompt Engineer specializing in generating high-quality,
brand-consistent image prompts for OpenAI's DALL-E and Google's Imagen APIs.

PROMPT ARCHITECTURE — Every prompt MUST follow this 9-layer structure as a single
flowing paragraph (NOT as labeled sections):

LAYER 1 — FORMAT & PLATFORM: Image format, dimensions/aspect ratio, platform context.
LAYER 2 — SUBJECT & SCENE: Primary subject and scene in vivid, specific detail.
LAYER 3 — ART STYLE & AESTHETIC: Visual style, artistic approach, aesthetic feel.
LAYER 4 — COLOR & PALETTE: Color palette with descriptive names and hex codes.
LAYER 5 — COMPOSITION & LAYOUT: Spatial arrangement, focal points, depth of field,
          camera angle, text overlay space.
LAYER 6 — LIGHTING & ATMOSPHERE: Lighting direction, quality, temperature, mood.
LAYER 7 — TEXTURES & MATERIALS: Surface qualities and tactile details for realism.
LAYER 8 — BRAND CONSISTENCY ANCHOR: Brand style tag for consistency across all prompts.
LAYER 9 — NEGATIVE PROMPT / EXCLUSIONS: Explicitly state what to avoid.
```

**Failure Taxonomy & Auto-Corrections:**
| Code | Issue | Correction Injected |
|---|---|---|
| C1 | Color wrong | `dominant colors MUST be {correct_colors}` |
| S1 | Style mismatch | `this must be {correct_style}` |
| L1 | Layout cluttered | `simplify significantly, remove secondary objects` |
| A1 | Artifact distortion | `no warping, melting, or impossible geometry` |
| P1 | Prompt ignored | `CRITICAL — HIGHEST PRIORITY: {ignored_instruction}` |

---

## Part 10 — Step 6: Save to Database (No AI)

```
POST /posts/ {
  caption: string,          ← best caption variant from Step 4
  media_files: [imageUrl],  ← image URL from Step 5
  platforms: [platform],    ← from Q6 answer
  source: 'magic',
  status: 'draft',
  brand: brandId,
}
```

Then:
```
POST /magic/posts/{userId}/{cacheKey}/
Body: { post_ids: [123, 124, 125] }
```

---

## Part 11 — Video Mode (Separate Pipeline)

**Screens:** VideoPromptScreen → VideoWorkingScreen → Video Result  
**Triggered by:** Q4 `post_type = "Video content"`

### VideoPromptScreen

File: [VideoPromptScreen.tsx](../frontend/src/pages/magic/VideoPromptScreen.tsx)

**Fields collected:**
- Prompt text (min 10 chars, required)
- Reference image upload (optional — for image-to-video)
- Style selection (one of 6):
  - 🛍️ Product Showcase
  - ✨ Brand Story
  - 🎯 Promotional
  - 📚 Educational
  - 🌟 Lifestyle
  - 🎬 Cinematic
- Duration: 5s (Quick & punchy), 8s (Balanced), 15s (Full story)

**Auto-generated prompt** (if user hasn't typed custom text, MagicModePage.tsx builds):
```javascript
`A ${tonePhrase} video ${industryPhrase} that helps ${goalPhrase}${platformPhrase}...`
// e.g.: "A professional video for a SaaS company that helps drive website traffic
//        optimized for LinkedIn"
```

### VideoWorkingScreen — 6-Step Pipeline

File: [VideoWorkingScreen.tsx](../frontend/src/pages/magic/VideoWorkingScreen.tsx)

```
Step 0  →  Reading brand profile     ← No AI (3s)
Step 1  →  Building brand DNA        ← No AI (8s)
Step 2  →  Finding trending topics   ← No AI (8s)
Step 3  →  Crafting video concept    ← No AI (10s)
Step 4  →  Generating video          ← AI: Veo (1–3 min)
Step 5  →  Final polish              ← No AI (1s)
```

### Video Prompt Construction (Frontend)

```javascript
let basePrompt = pending.prompt;

// If reference image: wrap in empty-background instruction
if (pending.referenceImage) {
  basePrompt = `Professional empty photography studio background for: ${pending.prompt}.
  IMPORTANT: Keep the center of the video completely empty as a product will be
  placed there. Do NOT generate the product itself.`;
}

// Append creative direction hint if available
const enhancedPrompt = videoConceptHint
  ? `${basePrompt} — Creative direction: ${videoConceptHint}`
  : basePrompt;
```

**API Payload:**
```
POST /video/generate/  (multipart/form-data)
  prompt:          <enhancedPrompt>
  style:           <product_showcase|brand_story|promotional|educational|lifestyle|cinematic>
  duration:        <5|8|15>
  brand_id:        <brandId>
  reference_image: <File>  (optional)
```

### Video Prompt Enhancement — Backend (Veo)

File: `ai_video/gemini_service.py`

**Step 1 — Brand DNA injection:**
```python
brand_enhanced = f"""
{prompt}

🎨 Brand Context: {brand.brand_name}
({brand.industry} industry)
• Voice & Tone: {brand.voice_tone}
• Visual Style: {brand.brand_dna.get('visual_style', '')}
• Brand Colors: {colors_from_brand_dna[:3]}   # hex codes
• Mood: {brand.brand_dna.get('mood', '')}

🏢 Workspace: {workspace.name}
"""
```

**Step 2 — Style + motion enhancement:**
```
{brand_enhanced_prompt}.

Visual style: {style_addition}.
Camera movement: {camera_motion_addition}.
Motion intensity: {motion_intensity_addition}.

Additional guidance: Ensure smooth transitions, consistent lighting throughout,
and natural motion that serves the narrative. The video should feel intentional
and professionally directed, not randomly generated.
```

**Style prompt additions (injected per style choice):**

| Style | Prompt Addition |
|---|---|
| `realistic` | photorealistic, cinematic quality, natural lighting, detailed textures, lifelike |
| `cinematic` | cinematic, movie-like, dramatic lighting, film grain, professional cinematography, widescreen |
| `anime` | anime style, Japanese animation, vibrant colors, expressive, dynamic, 2D animated |
| `cartoon` | cartoon style, animated, colorful, playful, exaggerated expressions, fun |
| `3d_animation` | 3D animated, Pixar-style, rendered, smooth animation, CGI quality |
| `artistic` | artistic, creative, painterly, expressive, unique visual style |
| `vintage` | vintage film, retro, nostalgic, old movie aesthetic, film scratches, sepia tones |
| `slow_motion` | slow motion, smooth, detailed motion, time-stretched, cinematic slow-mo |
| `timelapse` | timelapse, accelerated time, smooth transitions, time compression |
| `documentary` | documentary style, realistic, informative, natural, observational |
| `sci_fi` | science fiction, futuristic, high-tech, neon lights, cyberpunk elements |
| `fantasy` | fantasy, magical, ethereal, mystical, enchanting atmosphere |

**Camera motion additions:**

| Motion | Prompt Addition |
|---|---|
| `static` | static camera, fixed shot, no camera movement |
| `pan_left` | camera panning left, horizontal movement left |
| `pan_right` | camera panning right, horizontal movement right |
| `zoom_in` | camera zooming in, getting closer, push in |
| `zoom_out` | camera zooming out, pulling back, wide reveal |
| `orbit` | camera orbiting, circling around subject, 360 movement |
| `dolly` | dolly shot, camera tracking, smooth forward movement |
| `crane` | crane shot, elevated camera movement, sweeping |
| `handheld` | handheld camera, slight shake, documentary feel |

**Veo API Payload:**
```json
{
  "instances": [{
    "prompt": "<final_enhanced_prompt_with_brand_dna>",
    "image": {
      "inlineData": {
        "data": "<base64_reference_image>",
        "mimeType": "image/png|image/jpeg|image/webp"
      }
    }
  }],
  "parameters": {
    "aspectRatio": "16:9|9:16|1:1",
    "sampleCount": 1,
    "resolution": "720p|1080p|4k"
  }
}
```

**Models:** `veo-3.1-generate-preview` (primary), `veo-2.0-generate-001` (fallback)  
**Image-to-video:** Only supported on Veo 3.x  
**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning`  
**Poll endpoint:** `GET https://generativelanguage.googleapis.com/v1beta/{operation_name}`

---

## Part 12 — Optional: Caption Adaptation (Cross-Platform)

**Trigger:** User approves post for multiple platforms AND selects "Different captions per platform"  
**File:** `captionService.adapt()` → `POST /captions/adapt/{captionId}/`  
**Model:** Claude

### System Prompt:

```
You are a platform-native social media strategist who specializes in cross-platform
content adaptation.

Your expertise:
- Twitter/X: Punchy, conversational, opinion-driven. Max 280 chars.
- LinkedIn: Professional thought leadership. First line is everything. 1300-1700 chars optimal.
- Facebook: Conversational, community-oriented. Questions drive engagement.
- Instagram: Visual-first. Hook in first 125 chars. 2200 char max.
- TikTok: Ultra-casual, trend-aware. 150 chars max recommended.

Your job is to translate the SOUL of a caption for a new platform — not just
shorten or lengthen it.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON
- Stay within character limits — this is non-negotiable
```

### User Prompt Template:

```xml
<context>
Target platform: {target_platform}
Platform character limit: {max_chars}
Platform tone guidance: {tone_guidance}
Brand context: {brand_context}
</context>

<source_caption>
{source_caption_body}
</source_caption>

<instructions>
1. READ the source caption — extract core message, emotional hook, CTA intent.
2. REWRITE for {target_platform} from scratch, as if a native user wrote it.
3. VERIFY the final caption is within {max_chars} characters.
</instructions>

<output_format>
{
  "adapted_body": "<adapted caption text>",
  "cta_text": "<adapted CTA or empty string>"
}
</output_format>
```

**Platform hint injected per target:**

| Platform | Hint |
|---|---|
| `linkedin` | Write for LinkedIn professionals. Use industry insights and thought leadership angle. |
| `instagram` | Write for Instagram. Short, punchy, visual-first. |
| `facebook` | Conversational, community-driven. Encourage discussion. |
| `twitter` | Ultra-concise, max 280 chars. Hot take or punchy statement. |
| `tiktok` | Gen-Z friendly, trendy, casual. |

---

## Part 13 — Feedback Loop (Results Screen)

File: [ResultsScreen.tsx](../frontend/src/pages/magic/ResultsScreen.tsx)

**Trigger:** User clicks "Give Feedback" on any result card

**Three regeneration paths:**

### Path 1 — Full Topic Regeneration

User selects "The overall topic"

```
strategyService.regenerateIdea(ideaId, feedbackText)
  → POST /ideas/{id}/regenerate/  { feedback: feedbackText }

captionService.generate({ topic: newTitle, tone, platform, ... })
  → POST /ai-caption/generate/  (same Step 4 prompt)

imageService.generate({ prompt: newTitle, ... })
  → POST /ai-image/generate/  (same Step 5 prompt)
```

### Path 2 — Image Regeneration

User selects "The image style"

```javascript
imageService.generate({
  prompt: `Create a social media image for: "${post.title}".
           Style feedback: ${feedback.image_fix || feedbackText}`,
  title: post.title,
  provider: 'gemini',
  style: 'modern',
  enhance_prompt: true,
})
```

### Path 3 — Caption Regeneration (default)

User selects "The caption / text"

```javascript
// If post has existing captionId:
captionService.regenerate(post.captionId, feedbackText)
  → POST /captions/{id}/regenerate/  { feedback: feedbackText }

// If no captionId:
captionService.generate({
  topic: post.title,
  tone: 'professional',
  length: 'medium',
  platform: post.platform.toLowerCase(),
  include_hashtags: true,
  include_emojis: true,
  include_cta: true,
  custom_instructions: feedbackText,   // ← user feedback appended here
})
```

---

## Part 14 — Admin Prompt Override System

File: [adminPromptService.ts](../frontend/src/services/adminPromptService.ts)

Admins can override any of the following prompts per user:

| Prompt Type | What it overrides |
|---|---|
| `idea_system` | System prompt for Step 3 content ideas |
| `idea_user` | User prompt template for Step 3 |
| `caption_system` | System prompt for Step 4 captions |
| `image_refiner` | Image generation prompt enhancement |
| `brand_dna` | Brand DNA analysis prompt |
| `video_prompt` | Video generation prompt |

**API Endpoints:**
```
GET    /admin/users/{userId}/prompt-overrides/                  ← list all
PUT    /admin/users/{userId}/prompt-overrides/{promptType}/     ← save/update
DELETE /admin/users/{userId}/prompt-overrides/{promptType}/     ← reset to default
GET    /admin/users/{userId}/prompt-overrides/{promptType}/audit/ ← history
```

**Override behavior:** When an override is active (`is_active: true`) for a user, the backend substitutes the stored `prompt_text` in place of the default system/user prompt before sending to Claude/Gemini.

---

## Part 15 — Unified LLM Routing

File: `accounts/services/llm_service.py`

All text AI calls route through a single service:

```
Primary:   Claude claude-sonnet-4-20250514
             └─ Fallback: Claude claude-haiku-4-5-20251001
Secondary: OpenAI gpt-4o
             └─ Fallback: OpenAI gpt-4o-mini
Tertiary:  Gemini gemini-2.0-flash
             └─ Fallback: Gemini gemini-2.0-flash-lite
```

**Extended Thinking support:**
```python
if thinking_budget >= 1024:
    params['thinking'] = {
        'type': 'enabled',
        'budget_tokens': thinking_budget,
    }
    # Temperature must be omitted when thinking enabled
    params['max_tokens'] = thinking_budget + requested_max_tokens
```

---

## Part 16 — Complete Data Flow Summary

```
URL Input
  └─► website URL → Phase A: OpenAI text-embedding-3-small (RAG chunks)
  └─► website URL → Phase B: Claude DNA enrichment (Step 1)
  └─► logo File  → Step 0 brand asset upload

Q1: industry
  └─► Google Trends filter (Step 2)
  └─► {brand.industry} in Step 3 ideas prompt
  └─► {dna_context} in Step 4 caption prompt

Q2: goal
  └─► implicit via Brand DNA → idea {goal} field → caption context

Q3: tone
  └─► maps to enum → Step 4 caption {tone} param
  └─► Step 4 system prompt {tone_description}
  └─► cross-platform adaptation hint

Q4: post_type
  └─► "Image" → image pipeline (Steps 0-6)
  └─► "Video" → video pipeline (VideoWorkingScreen)
  └─► shows/hides Q5

Q5: product_mode
  └─► "Yes" → ProductUploadScreen shown
  └─► "Yes" → Step 5 Path A (product compositor + style analyzer)
  └─► "No"  → Step 5 Path B (AI-only image)

Q6: platforms
  └─► round-robin per idea in Step 4 (platform assigned to each caption)
  └─► {platform_specific_guidelines} in Step 4 system prompt
  └─► saved as platforms[] on post in Step 6
  └─► multi-platform adaptation triggers if > 1 platform

Q7: colors
  └─► background_style hint in Step 5 image gen
  └─► color context in Brand DNA enrichment

Product Upload (if Q5 = Yes)
  └─► product_image File → Step 5 Path A compositor
  └─► product_type, features → productPrompt construction
  └─► backgroundStyle → productPrompt + smart_prompt_builder
  └─► product style analysis (local Python CV, no AI)

Video Prompt Screen (if Q4 = Video)
  └─► user prompt text → VideoWorkingScreen base prompt
  └─► style → Veo style_addition appended
  └─► duration → Veo parameters.duration
  └─► referenceImage → Veo image-to-video (Veo 3.x only)
  └─► Brand DNA from Step 1 → injected into final Veo prompt

Feedback (Results Screen)
  └─► "topic" feedback → re-run Steps 3+4+5
  └─► "image" feedback → re-run Step 5 with feedback in prompt
  └─► "caption" feedback → captionService.regenerate() with feedback text
```

---

## Part 17 — Key File Locations

| File | Purpose |
|---|---|
| [AIQuestionsScreen.tsx](../frontend/src/pages/magic/AIQuestionsScreen.tsx) | 7 questions, options, validation |
| [AIWorkingScreen.tsx](../frontend/src/pages/magic/AIWorkingScreen.tsx) | Image pipeline, all API calls, prompt construction |
| [VideoPromptScreen.tsx](../frontend/src/pages/magic/VideoPromptScreen.tsx) | Video prompt + style + duration + reference image |
| [VideoWorkingScreen.tsx](../frontend/src/pages/magic/VideoWorkingScreen.tsx) | Video generation pipeline, Veo API call |
| [ProductUploadScreen.tsx](../frontend/src/pages/magic/ProductUploadScreen.tsx) | Multi-product upload, background style |
| [URLInputScreen.tsx](../frontend/src/pages/magic/URLInputScreen.tsx) | Website URL + logo upload |
| [MagicModePage.tsx](../frontend/src/pages/magic/MagicModePage.tsx) | Screen orchestrator, navigation logic |
| [ResultsScreen.tsx](../frontend/src/pages/magic/ResultsScreen.tsx) | Post approval, feedback loop, multi-platform |
| [CacheCheckScreen.tsx](../frontend/src/pages/magic/CacheCheckScreen.tsx) | Previous generation cache check |
| [magicModeStore.ts](../frontend/src/store/magicModeStore.ts) | Zustand state (answers, posts, video, products) |
| [strategyService.ts](../frontend/src/services/strategyService.ts) | generateDNA, generateTrending, generateIdeas |
| [captionService.ts](../frontend/src/services/captionService.ts) | generate, regenerate, adapt caption calls |
| [imageService.ts](../frontend/src/services/imageService.ts) | image generation API calls |
| [adminPromptService.ts](../frontend/src/services/adminPromptService.ts) | Admin prompt override CRUD |
| [cacheUtils.ts](../frontend/src/pages/magic/cacheUtils.ts) | Cache key builder, previous posts logic |
| `backend/ai_image/product_compositor.py` | Product background prompt enhancement |
| `backend/ai_image/smart_prompt_builder.py` | Style-matched product-aware prompts |
| `backend/ai_image/product_style_analyzer.py` | Local CV analysis of product image |
| `backend/ai_image/gemini_service.py` | Gemini Imagen API calls + style tags |
| `backend/ai_image/openai_service.py` | OpenAI DALL-E API calls + style tags |
| `backend/ai_video/gemini_service.py` | Veo API calls, brand DNA injection, style tags |
| `backend/ai_caption/openai_service.py` | All caption generation prompts |
| `backend/accounts/services/llm_service.py` | Unified Claude/OpenAI/Gemini router |
| `backend/brands/services/brand_dna_service.py` | Website crawl + embedding creation |
| `backend/ai_image/services/prompt_engineering_service.py` | 9-layer image prompt architecture |

---

## Part 18 — CORRECTION: Step 2 Trending Topics Uses Claude

> **Documentation error fixed:** Step 2 is NOT "No AI." Google Trends data is fetched first, then Claude filters and ranks it.

**File:** `api/trending_service.py` — `generate_trending_for_brand()`  
**Flow:** pytrends (Google Trends) → Claude filter/rank → TrendingCache (15 topics saved)

**Phase 1 — Google Trends (no AI):**
- Daily trending searches for the region
- Rising queries for brand keywords (7-day window)
- Seasonal keyword queries (month-aware, industry-aware)
- Returns up to 60 unique raw topics

**Phase 2 — Claude Filtering:**

### System Prompt:
```
You are a real-time social media trend analyst. You receive REAL Google Trends data
and must identify the most relevant trending opportunities for a specific brand.

Your job:
1. Analyze the real-time Google Trends data provided
2. Cross-reference with the brand's products, audience, and niche
3. Pick trends that the brand can actually create content about
4. Add brand-specific context to make each topic actionable

You prioritize:
- REAL data from Google Trends over guessing
- Brand-specific relevance — every topic must connect to what the brand sells
- Timeliness — topics that are trending RIGHT NOW
- Actionability — each topic should clearly suggest content to create

Return ONLY valid JSON — no markdown, no commentary.
```

### User Prompt Template:
```xml
<context>
Today's date: {today_str}
Brand: "{brand_name}"
Industry: {industry}
Region: {target_region}
Website: {website_url}
</context>

<brand_dna>
{dna_summary}
</brand_dna>

<content_pillars>
{pillar_names}
</content_pillars>

<competitor_insights>
{top_10_insight_texts}
</competitor_insights>

<google_trends_data>
DAILY TRENDING SEARCHES ({region} — real-time):
{daily_trending_list}

RISING QUERIES (related to brand keywords — gaining momentum):
{rising_queries_list}

TOP QUERIES (most searched related to brand keywords):
{top_queries_list}
</google_trends_data>

═══ USER FEEDBACK — ACCEPTED TOPICS (generate MORE like these) ═══
{accepted_topics}

═══ USER FEEDBACK — REJECTED TOPICS (AVOID these) ═══
{rejected_topics}

<instructions>
1. Study the brand DNA to understand what "{brand_name}" sells and who its audience is.
2. From the REAL Google Trends data above, identify topics relevant to this brand.
3. Adapt trending topics to the brand's niche (e.g., "Eid" trending + dress brand
   → "Eid dress collection trends").
4. You may add 2-3 topics based on your knowledge of current events if highly relevant.
5. Generate exactly 15 topics. Each must be specific and actionable for THIS brand.
6. For each topic: write title, assign volume_score (0-100), explain relevance, classify.
7. Order by volume_score descending.
</instructions>

<output_format>
{
  "topics": [
    {
      "topic": "<specific trending topic title for this brand>",
      "volume_score": <0-100>,
      "relevance_explanation": "<why this matters for the brand right now>",
      "category": "<seasonal | cultural | industry | viral | evergreen>"
    }
  ]
}
</output_format>

<constraints>
- Exactly 15 topics.
- Every topic MUST directly relate to the brand's products, services, or audience.
- Return valid JSON only.
</constraints>
```

**Runtime variables:**

| Variable | Source |
|---|---|
| `{today_str}` | `date.today().strftime('%B %d, %Y')` |
| `{dna_summary}` | Brand DNA: description, niche, products, audience, keywords, content_themes |
| `{pillar_names}` | Active content pillars |
| `{top_10_insight_texts}` | Competitor insights ordered by engagement_score |
| `{daily_trending_list}` | Up to 20 Google daily trending searches |
| `{rising_queries_list}` | Up to 20 rising related queries |
| `{top_queries_list}` | Up to 15 top related queries |
| `{accepted_topics}` | Past TrendFeedback accepted by user (learn preference) |
| `{rejected_topics}` | Past TrendFeedback rejected by user (avoid similar) |

**Fallback:** If Claude fails → raw Google Trends saved directly without AI filtering.

---

## Part 19 — Brand DNA: Three Separate Prompts

Brand DNA is generated via **three different endpoints** with three different prompts.

---

### DNA Prompt A — Registration Enrichment

**File:** `api/views.py:220` (`RegisterWithBrandView`)  
**Trigger:** User registers with a website URL → auto-runs at signup  
**API:** Internal during `POST /auth/register/`

**System Prompt:**
```
You are a brand strategist specializing in enriching brand identity profiles.
Your task is to enhance an existing Brand DNA by cross-referencing it with fresh
website data — filling gaps, adding specificity, and improving strategic usefulness
WITHOUT overwriting the user's original input.

Principles:
- User-provided values are sacred — enhance, never replace
- Empty fields are opportunities — fill them with evidence-based content
- Thin descriptions should be enriched with specifics from the website
- The enhanced DNA should be immediately useful for content creation

Return ONLY valid JSON — no markdown, no commentary.
```

**User Prompt:**
```xml
<task>
Enhance the existing Brand DNA using website content. Keep ALL existing values but
fill gaps and enrich thin descriptions with evidence from the website.
</task>

<existing_dna>
{existing_dna_json}
</existing_dna>

<website_data>
URL: {brand.website_url}
Content: {website_content}
</website_data>

<instructions>
For each of the 15 fields:
1. If the field has a strong value, keep it exactly as-is.
2. If thin/generic, enrich with website evidence while preserving original intent.
3. If empty, fill it using website content.
4. Return all 15 fields in the output.
</instructions>

<output_format>
Return ONLY a single JSON object with all 15 Brand DNA fields.
</output_format>
```

---

### DNA Prompt B — Full Website Extraction (Step 1 in Magic Link)

**File:** `api/views.py:2183` (`GenerateBrandDNAView`)  
**Trigger:** Step 1 in Magic Link pipeline; or user clicks "Generate DNA" in brand settings  
**API:** `POST /brands/{brandId}/generate-dna/`

**System Prompt:**
```
You are a senior brand strategist who extracts comprehensive brand identity profiles
from website content. You combine analytical precision with strategic intuition to
build Brand DNA profiles that power content creation.

Your approach:
- You read website copy the way a strategist reads — looking for positioning,
  messaging hierarchy, value propositions, and audience signals
- You distinguish between what a brand SAYS and what it MEANS
- You extract implicit signals (tone of voice from writing style, target audience
  from language choices, values from what they emphasize)
- "professional" is not a useful brand voice description; "authoritative but
  approachable, uses industry jargon sparingly, favors short sentences" IS

CRITICAL: Base ALL analysis on actual page content.

Return ONLY valid JSON — no markdown, no commentary.
```

**User Prompt Template:**
```xml
<task>
Analyze the website content and extract a complete 15-field Brand DNA profile.
</task>

<website_data>
URL: {url}
Page title: {page_data.title}
Page content: {page_data.content}   ← up to 8000 chars from up to 5 crawled pages
</website_data>

<instructions>
Think step by step:
1. READ the website content thoroughly.
2. EXTRACT all 15 fields:
   1. brand_name — Official name
   2. tagline — Primary tagline or slogan
   3. industry — Vertical and sub-category
   4. description — 2-3 sentence brand description
   5. products_services — Specific offerings listed
   6. target_audience — Demographics + psychographics
   7. unique_selling_points — 3-5 specific differentiators
   8. brand_voice — Detailed voice (not just "professional")
   9. brand_values — Core values demonstrated
   10. color_theme — Dominant colors observed
   11. content_themes — Recurring topics and themes
   12. cta_style — How the brand asks for action
   13. social_platforms — Social media links found
   14. keywords — 10-15 high-relevance keywords
   15. competitor_positioning — Positioning vs. alternatives
3. For any field not directly stated, make a reasonable inference.
</instructions>

<constraints>
- All 15 fields required — leave none empty.
- Be specific and detailed.
- Return valid JSON only.
</constraints>
```

---

### DNA Prompt C — Manual Input Enhancement

**File:** `api/views.py:2433` (`RegenerateBrandDNAFromInputsView`)  
**Trigger:** User manually fills DNA fields + clicks "AI Enhance"  
**API:** `POST /brands/{brandId}/regenerate-dna/` with `use_ai: true`

**System Prompt:**
```
You are a brand strategist who polishes and completes Brand DNA profiles.
You take user-provided brand information and make it richer, more specific, and
more strategically actionable — while always preserving the user's original intent.

Your enhancements:
- Transform vague descriptions into specific, usable strategic language
- Fill empty fields with reasonable defaults inferred from filled fields
- Ensure internal consistency (voice matches values, audience matches positioning)
- Make every field useful for a content creator

Return ONLY valid JSON — no markdown, no commentary.
```

**User Prompt:**
```xml
<task>
Enhance and complete this Brand DNA profile. Keep user-provided values but make them
richer, more specific, and fill any empty fields with reasonable defaults.
</task>

<current_dna>
{dna_data_json}    ← all 15 fields as entered by user
</current_dna>

<instructions>
For each of the 15 fields:
1. If populated: Enhance specificity while preserving intent.
2. If empty: Infer a reasonable value from the other fields.
3. Ensure all fields are internally consistent.
</instructions>

<output_format>
Return ONLY a single JSON object with all 15 Brand DNA fields.
</output_format>
```

---

## Part 20 — Idea Regeneration Prompt

**File:** `api/strategy_views.py:1056`  
**API:** `POST /ideas/{id}/regenerate/`  
**Trigger:** User clicks "Give Feedback" → selects "The overall topic" → submits  
**Model:** Claude

### System Prompt:
```
You are a creative director who can take any content idea and reimagine it with a
completely different creative execution — different hook, different angle, different
emotional appeal — while keeping the strategic intent intact.

You think in terms of creative pivots:
- If the original was educational, try emotional storytelling
- If the original asked a question, try a bold, contrarian claim
- If the original was serious, try humor or relatability
- If the original was broad, try hyper-specific

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON — no markdown, no commentary
- The new version must feel like a brand-new idea, not a rewording
```

### User Prompt Template:
```xml
<task>
Regenerate this content idea with a completely fresh creative direction.
</task>

<original_idea>
- Title: {idea.title}
- Hook: {idea.hook}
- Angle: {idea.angle}
- Platform: {idea.platform}
</original_idea>

<brand_context>
Brand: {brand_name}, Industry: {industry}, Voice: {voice_tone}
Content Pillar: {pillar.name}
</brand_context>

<instructions>
Think step by step:
1. UNDERSTAND the original idea's core topic and strategic goal.
2. IDENTIFY the creative approach used (hook type + angle + emotional appeal).
3. CHOOSE a deliberately DIFFERENT combination:
   - Different hook type (question → bold statement or stat)
   - Different angle (educational → emotional or contrarian)
   - Different emotional appeal (curiosity → FOMO or empathy)
4. WRITE a new version that feels like a different creative team made it.
{5. FOLLOW additional instructions: {additional_instructions}}
</instructions>

<output_format>
{
  "title": "<new title>",
  "hook": "<new hook — ready to use as first line of a post>",
  "angle": "<new strategic angle>",
  "goal": "<awareness | engagement | conversion | education>",
  "content_format": "<carousel | reel | story | post | thread | video | poll>",
  "engagement_tier": "<high | medium | low>"
}
</output_format>
```

---

## Part 21 — Competitor Suggestion Prompt

**File:** `api/strategy_views.py:1402`  
**API:** `POST /brands/{brandId}/suggest-competitors/`  
**Trigger:** User clicks "Suggest Competitors" in brand settings  
**Model:** Claude

### System Prompt:
```
You are a competitive intelligence researcher with deep knowledge of the global
business landscape. You specialize in identifying direct, indirect, and aspirational
competitors for brands across industries.

Your suggestions are ALWAYS real, verifiable companies — never fabricated.

CRITICAL: If not confident a company exists or cannot verify its handle/URL,
do NOT include it. Accuracy is more important than hitting the requested count.

Return ONLY valid JSON — no markdown, no commentary.
```

### User Prompt Template:
```xml
<task>
Suggest real competitor companies for competitive analysis and monitoring.
</task>

<context>
Brand: "{brand_name}"
Industry: {industry}
Region: {target_region}
</context>

<existing_competitors>
Already added (DO NOT suggest): {existing_names}
</existing_competitors>

<instructions>
1. IDENTIFY the competitive landscape for "{brand_name}" in {industry} within {region}.
2. CONSIDER three categories:
   - Direct competitors (same product/service, same audience)
   - Indirect competitors (different product, overlapping audience)
   - Aspirational competitors (industry leaders to learn from)
3. SUGGEST exactly {count} real, verifiable companies.
4. For each, choose the platform where they are MOST ACTIVE.
5. Provide their actual handle or URL — not a guess.
</instructions>

<output_format>
{
  "competitors": [
    {
      "name": "<real company name>",
      "platform": "<website | twitter | linkedin | facebook | instagram>",
      "handle_or_url": "<verified URL or @handle>",
      "reason": "<1-2 sentence explanation of competitive relevance>"
    }
  ]
}
</output_format>
```

---

## Part 22 — Competitor Crawl Analysis Prompt

**File:** `api/strategy_views.py:465`  
**API:** `POST /brands/{brandId}/competitors/{competitorId}/crawl/`  
**Trigger:** User clicks "Analyze" on a competitor profile  
**Model:** Claude

### System Prompt:
```
You are a senior competitive intelligence analyst specializing in e-commerce and
social media marketing in South Asia (Bangladesh, India).

Your core skill is extracting ACCURATE, SPECIFIC business intelligence:
- Product categories, pricing ranges, discount strategies, and seasonal offers
- Delivery options, return policies, payment methods, customer experience features
- Content gaps and messaging weaknesses that can be exploited
- Loyalty programs, gift cards, customization options, and unique selling points

ACCURACY RULES (non-negotiable):
1. ONLY state facts DIRECTLY EVIDENCED in the crawled page content.
2. If a page shows prices, quote the actual price range and currency.
3. If a page shows a discount, quote the exact offer (e.g., "30% off").
4. NEVER claim a competitor "lacks" something unless confirmed absent from ALL pages.
5. If unsure, say "not found on crawled pages" — never assume.
6. Acknowledge competitor strengths — do not pretend they don't exist.

Return ONLY valid JSON array — no markdown, no commentary.
```

**User prompt:** crawled page content + brand context + competitor URL + instruction to extract 8-10 insights with: hook_text, recommendation, based_on, source_url, engagement_score (5-10).

---

## Part 23 — Content Pillars Generation Prompt

**File:** `api/strategy_views.py:1598`  
**API:** `POST /brands/{brandId}/generate-pillars/`  
**Trigger:** User clicks "Generate Pillars with AI" in content strategy  
**Model:** Claude

### System Prompt:
```
You are a content strategy architect who designs balanced content pillar frameworks
for social media brands. Your pillars are not vague categories — they are strategic
content territories that guide what to create, why, and how it serves the brand's goals.

A great pillar framework:
- Covers the full content funnel (awareness > consideration > conversion > retention)
- Balances audience value with business objectives
- Creates clear, non-overlapping content categories
- Is specific enough to guide daily content decisions

Return ONLY valid JSON — no markdown, no commentary.
```

### User Prompt Template:
```xml
<task>
Generate a content pillar strategy framework for a brand's social media presence.
</task>

<brand_dna>
{dna_context}
</brand_dna>

<context>
Brand: "{brand_name}"
Industry: {industry}
Competitor strategies: {top_5_competitor_insights}
Trending topics: {top_5_trending_topics}
Existing pillars (DO NOT duplicate): {existing_pillar_names}
Focus areas to emphasize: {focus_areas}
</context>

<instructions>
1. Read the Brand DNA carefully — understand products, audience, voice, values.
2. Design exactly {count} content pillars aligned with Brand DNA.
3. For each pillar:
   a. Name: 2-4 words, specific (e.g., "Customer Wins" not "Engagement")
   b. Description: What types of content + why it matters strategically
   c. Target percentage: Share of total content
   d. Color code: Unique hex color
4. {pct_instruction}
5. Include a mix of: educational, promotional, community-building, authority content.
</instructions>

<output_format>
{
  "pillars": [
    {
      "name": "<2-4 word pillar name>",
      "description": "<content types + strategic purpose>",
      "target_percentage": <integer>,
      "color_code": "<#hex>"
    }
  ]
}
</output_format>

<constraints>
- No pillar should overlap thematically with another.
- Do NOT duplicate existing pillars.
- Return valid JSON only.
</constraints>
```

---

## Part 24 — Support Chatbot Prompt

**File:** `api/views.py:2499`  
**API:** `POST /support/chat/`  
**Trigger:** User opens the in-app support chat  
**Model:** Claude (multi-turn conversation)

### System Prompt:
```
You are the official AI support assistant for Sellanto — a powerful all-in-one
social media management and AI content platform. You answer user questions accurately,
concisely, and helpfully. Always be friendly and professional.

[Full platform knowledge base injected — covers:]
- Platform overview
- Connecting social media accounts (Facebook Pages, Instagram Business, Twitter/X, LinkedIn)
- Creating & scheduling posts
- Magic Link AI content generation
- Caption generator, Image generator, Video generator
- Analytics dashboard, Billing & subscription plans
- Common troubleshooting steps
```

If support documents exist in the database, they are retrieved and appended:
```python
system_prompt += f"\n\n---\n\n## Additional Knowledge Base\n{retrieved_docs}"
```

---

## Part 25 — Complete AI Prompt Inventory

| # | Prompt | File:Line | Endpoint | Model | In Magic Link? |
|---|---|---|---|---|---|
| 1 | Brand DNA — Registration Enrichment | `api/views.py:220` | Internal (signup) | Claude | Step 1 (signup) |
| 2 | Brand DNA — Full Website Extraction | `api/views.py:2183` | `POST /brands/{id}/generate-dna/` | Claude | **Step 1 (main)** |
| 3 | Brand DNA — Manual Input Enhancement | `api/views.py:2433` | `POST /brands/{id}/regenerate-dna/` | Claude | Optional |
| 4 | Trending Topics Filter (Google→Claude) | `api/trending_service.py:275` | `POST /brands/{id}/generate-trending/` | Claude | **Step 2** |
| 5 | Content Ideas | `api/strategy_views.py:871` | `POST /ideas/generate/` | Claude | **Step 3** |
| 6 | Idea Regeneration | `api/strategy_views.py:1056` | `POST /ideas/{id}/regenerate/` | Claude | Feedback loop |
| 7 | Content Pillars Generation | `api/strategy_views.py:1598` | `POST /brands/{id}/generate-pillars/` | Claude | Pre-magic |
| 8 | Competitor Suggestion | `api/strategy_views.py:1402` | `POST /brands/{id}/suggest-competitors/` | Claude | Pre-magic |
| 9 | Competitor Crawl Analysis | `api/strategy_views.py:465` | `POST /brands/{id}/competitors/{id}/crawl/` | Claude | Pre-magic |
| 10 | Caption — Text + DALL-E prompt | `ai_caption/openai_service.py` | `POST /ai-caption/generate/` | Claude | **Step 4** |
| 11 | Caption — Image Vision | `ai_caption/openai_service.py:457` | `POST /ai-caption/generate/` + image | Claude Vision | Standalone |
| 12 | Caption — Video Frame Analysis | `ai_caption/openai_service.py:595` | `POST /ai-caption/generate/` + video | Claude Vision | Standalone |
| 13 | Caption Regeneration with Feedback | `ai_caption/openai_service.py:718` | `POST /captions/{id}/regenerate/` | Claude | Feedback loop |
| 14 | Caption Multi-Variations | `ai_caption/openai_service.py:807` | `POST /ai-caption/generate/` count>1 | Claude | Standalone |
| 15 | Caption Adaptation (Cross-Platform) | `ai_caption/adaptation_service.py` | `POST /captions/adapt/{id}/` | Claude | Optional |
| 16 | Image — Product Background | `ai_image/product_compositor.py` | `POST /ai-image/generate/` | Gemini Imagen | **Step 5A** |
| 17 | Image — Style-Matched Background | `ai_image/smart_prompt_builder.py` | `POST /ai-image/generate/` | Gemini Imagen | **Step 5A** |
| 18 | Image — AI-Only | `ai_image/gemini_service.py` | `POST /ai-image/generate/` | Gemini Imagen | **Step 5B** |
| 19 | Image Prompt Engineering (9-layer) | `ai_image/services/prompt_engineering_service.py` | Admin-activated | Claude | Optional |
| 20 | Video + Brand DNA | `ai_video/gemini_service.py` | `POST /video/generate/` | Google Veo | Video pipeline |
| 21 | Support Chatbot | `api/views.py:2499` | `POST /support/chat/` | Claude | N/A |
| 22 | Website Embeddings (RAG) | `brands/services/brand_dna_service.py` | Internal | OpenAI text-embedding-3-small | Step 1 pre-process |

---

## Part 26 — Cache System
```
{industry_idx}/{goal_idx}/{tone_idx}/{product_mode_idx}/{platforms_idxs}/{colors_idx}
Example: "2/2/1/2/13/1"
```

- Each answer → 1-based option index
- Multi-select platforms → sorted indices concatenated: [1,3] = "13"
- Custom "Other" text → appended and sanitized

**Save:** `POST /magic/posts/{userId}/{cacheKey}/` with `{ post_ids: [...] }`  
**Load:** `GET /magic/posts/{userId}/{cacheKey}/`  
**Screen:** [CacheCheckScreen.tsx](../frontend/src/pages/magic/CacheCheckScreen.tsx) — shows 3 states:
1. Checking... (loading spinner)
2. Found — "Use Previous Data" vs "Generate Fresh Content"
3. Not found — auto-proceeds to generation after 800ms
