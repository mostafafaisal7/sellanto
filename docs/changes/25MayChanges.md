# 25 May 2026 — Codebase Changes (In-Depth)

**Branch:** `features/swapnil-v3.2`
**Author:** Arifuzzaman Swapnil
**Working tree state at time of writing:** 17 files modified, 6 files added (untracked)
**Aggregate diff size:** ~650 insertions, ~132 deletions across 17 tracked files

> NOTE: These are *uncommitted working-tree changes* as of 2026-05-25. No new commits landed today; everything below is staged-and-modified or untracked. The most recent commit on the branch is `c248cfbd feat: add custom brand color, custom image prompt, and serialized token refresh`.

---

## 0. Executive Summary

Today's work falls into **five tightly-coupled themes**, all aimed at making the Magic Mode pipeline produce *visually relevant* output and at unblocking iteration after generation:

| # | Theme | Where it lives |
|---|---|---|
| 1 | **Visual Prompt Builder service** — a new backend service that synthesises brand DNA + idea + caption + trending themes + product context into ONE focused prompt before calling Imagen/Veo. | `posts/services/visual_prompt_builder.py` (new), `api/visual_prompt_views.py` (new), `frontend/src/services/visualPromptService.ts` (new), `accounts/services/prompt_resolver.py` (schema add). |
| 2 | **Video feedback → regeneration** loop — users can leave a comment on a generated video; backend persists it and starts a NEW generation with the feedback merged into the prompt. | `ai_video/models.py`, `ai_video/migrations/0004_*.py` (new), `api/views.py` (new endpoint), `api/urls.py`, `frontend/src/pages/magic/VideoResultScreen.tsx`. |
| 3 | **Hashtag generation, context-rich** — `generate_hashtags()` now consumes the full strategic context (idea / trending / product / media) instead of caption-only; and it now runs as the LAST step of the magic image pipeline so the chosen tags reflect every signal. | `posts/services/hashtag_service.py`, `api/hashtag_views.py`, `api/serializers.py`, `frontend/src/services/hashtagService.ts`, `frontend/src/pages/magic/AIWorkingScreen.tsx`, `frontend/src/pages/magic/VideoResultScreen.tsx`. |
| 4 | **Copy-on-image / copy-on-video toggle** — new `include_copy` question in Magic Mode, propagated through to both the image endpoint and the video endpoint as `with_copy` + `copy_text`. | `frontend/src/pages/magic/AIQuestionsScreen.tsx`, `AIWorkingScreen.tsx`, `VideoWorkingScreen.tsx`, `api/views.py` (`VideoGenerateAPIView`), plus the image side that was already in place. |
| 5 | **Brand DNA = live web research** + economics fix — the brand-DNA generator stops scraping with BS4 and instead asks Claude to use Anthropic's `web_search_20250305` server tool (5 search uses, 10k extended-thinking budget). Diamond cost is bumped 15 → 35 to cover the extra spend. Free-plan grant doubled 200 → 400 to keep new users whole. | `api/views.py` (`GenerateBrandDNAView`), `accounts/services/llm_service.py`, `accounts/services/diamond_service.py`, `accounts/services/email_service.py`, `accounts/models.py`, `accounts/migrations/0025_brand_dna_cost_bump.py` (new). |

Plus one untracked artifact unrelated to today's feature work: [`docs/securitycheck.md`](../securitycheck.md) — a full security & scalability audit dated 2026-05-21 (kept tracked-in-repo for the team).

The video player picker that previously asked for 5 s / 8 s / 15 s is gone; we now always render an 8-second clip.

---

## 1. Visual Prompt Builder (new service)

### 1.1 Why this exists

Before today, the Magic Mode pipeline built image and video prompts in the frontend with template literals like:

```ts
`Create a professional social media image for: "${post.title}". ${post.imageStyle}${colorHint}`
```

That string was sent to Imagen / Gemini and rarely matched the caption that had just been generated alongside it. The result: a caption talking about "Monday morning coffee rituals" with an image of a generic abstract gradient.

The fix is to have an LLM *write* the image prompt from the full strategic context, after the caption is already known.

### 1.2 Backend service — `posts/services/visual_prompt_builder.py` (NEW, 405 lines)

Two builders, both fail-soft:

#### `ImageVisualPromptBuilder.build(...)`

Inputs:
- `brand` (full Brand row including the 15-field `brand_dna` JSON)
- `idea` (`title` / `hook` / `angle`)
- `caption` — the actual social caption that will accompany the post
- `platform` (instagram / facebook / etc.)
- `color_choices` — brand-palette hint
- `trending_topics` — list of trending themes the idea is anchored on
- `image_style_hint`
- `product_context` (`product_type`, `features`, `background_style`) — present when a real product photo will be composited in
- `with_copy` + `copy_text` — text-overlay toggle

The user message it builds is XML-block structured: `<brand>`, `<content_idea>`, `<caption_for_this_post>`, `<trending_themes>`, `<delivery_context>`, conditional `<product>`, and a `<text_overlay>` block that explicitly tells the LLM either "render this text prominently and artistically" OR "no text, typography, letters, numbers, or watermarks of any kind".

The system prompt (`IMAGE_SYSTEM_PROMPT`) instructs Claude to act as a senior creative director writing one 60–110-word paragraph that:
- Anchors every visual choice to the caption's subject
- Honours brand voice and palette
- References trending themes only when reinforcing the post
- Opens with the dominant visual subject (forces Veo/Imagen to commit to a focal point)
- Honours the text_overlay block exactly
- Adds no hashtags, CTAs, or platform names

#### `VideoVisualPromptBuilder.build(...)`

Inputs:
- `brand`, `user_prompt` (the seed the user typed in the magic flow), `idea`, `trending_topics`, `has_reference_image`

Different system prompt — for video, **the user's seed prompt is the central subject**; brand DNA + idea + trending are layered on top. The LLM is asked to write 80–130 words including 1–2 motion/shot cues ("slow dolly in", "handheld follow shot", etc.).

Both builders:
- Resolve through `prompt_resolver.resolve_prompt()` so admin overrides work (no code deploy needed to A/B prompts).
- Persist every call via `save_execution()` (token counts, latency, override-status, brand, success/error) so the admin panel can audit and tune them.
- Catch every exception and return the supplied `fallback` so the magic pipeline never crashes on enrichment.

### 1.3 HTTP shell — `api/visual_prompt_views.py` (NEW, 182 lines)

Two `APIView` classes — `BuildImageVisualPromptView` and `BuildVideoVisualPromptView` — both JWT-protected (`IsAuthenticated`). They:

1. Resolve and ownership-check the `brand_id` (must own directly OR be the workspace owner): `Brand.objects.get(Q(user=user) | Q(workspace__owner=user), id=bid)`.
2. Hand-craft a **fallback prompt** (the same template literal the frontend used to use) so even if the LLM call fails, the response carries a usable string.
3. Call the builder. Builder returns LLM output or fallback.
4. Respond `{"prompt": "<string>"}`.

**Not** gated on Diamond Tokens — the small LLM cost is absorbed into the already-paid image / video generation features (this is called noted in the module docstring).

### 1.4 URL wiring — `api/urls.py`

```python
+from . import visual_prompt_views
+path('visual-prompt/image/', visual_prompt_views.BuildImageVisualPromptView.as_view(), name='api-visual-prompt-image'),
+path('visual-prompt/video/', visual_prompt_views.BuildVideoVisualPromptView.as_view(), name='api-visual-prompt-video'),
```

### 1.5 Prompt schema entry — `accounts/services/prompt_resolver.py`

Two new entries in `PROMPT_SCHEMA` so the admin override panel knows what variables each prompt accepts:

```python
'visual_prompt_image': ['brand_name', 'caption', 'platform'],
'visual_prompt_video': ['brand_name', 'user_prompt'],
```

### 1.6 Frontend client — `frontend/src/services/visualPromptService.ts` (NEW, 65 lines)

`visualPromptService.buildImagePrompt(payload)` and `buildVideoPrompt(payload)`. Both POST to the new endpoints. **Both swallow errors and return `null`** so callers can use their fallback templates without crashing the pipeline.

TypeScript types for the payloads (`BuildImagePromptPayload`, `BuildVideoPromptPayload`) live alongside.

### 1.7 Frontend integration — `frontend/src/pages/magic/AIWorkingScreen.tsx`

In step 5 ("Designing images") the loop now calls:

```ts
const richProductPrompt = await visualPromptService.buildImagePrompt({
  brand_id: brandId,
  idea: { title: post.title, hook: post.imageStyle, platform: post.platform.toLowerCase() },
  caption: post.caption || captionsAccum[i]?.text || '',
  platform: post.platform.toLowerCase(),
  color_choices: colorChoices,
  trending_topics: trendingTopics,
  image_style_hint: post.imageStyle,
  with_copy: wantsCopy,
  copy_text: wantsCopy ? post.title : undefined,
  product_context: { product_type, features, background_style },   // when in product mode
});
const productPrompt = richProductPrompt || fallbackProductPrompt;
```

Mirrored on the AI-only path (no product images). Fallback is the old template literal — so if the new endpoint or LLM fails, the loop carries on with the pre-today behavior.

### 1.8 Video integration — `frontend/src/pages/magic/VideoWorkingScreen.tsx`

```ts
const richVideoPrompt = await visualPromptService.buildVideoPrompt({
  brand_id: brandId,
  user_prompt: pending.prompt,
  idea: firstIdea,
  trending_topics: trendingTopics,
  has_reference_image: !!pending.referenceImage,
});
const promptToSend = richVideoPrompt || enhancedPrompt;   // fallback = previous behaviour
```

The user's typed seed prompt remains the primary subject; brand voice and creative angle layer on top.

---

## 2. Video feedback → regeneration loop

### 2.1 Model — `ai_video/models.py`

`VideoGeneration` gains three fields:

```python
user_feedback         = models.TextField(blank=True, default='',
                          help_text="What the user wants changed about this video")
feedback_submitted_at = models.DateTimeField(null=True, blank=True)
regenerated_from      = models.ForeignKey(
    'self', null=True, blank=True, on_delete=models.SET_NULL,
    related_name='regenerations',
    help_text="The original VideoGeneration whose feedback spawned this one",
)
```

Plus the default `duration` is changed from 5 → 8.

### 2.2 Migration — `ai_video/migrations/0004_videogeneration_feedback_submitted_at_and_more.py` (NEW)

`AddField` for the three new fields and `AlterField` to update the default on `duration`. Generated 2026-05-24 21:11 by `makemigrations`.

### 2.3 Endpoint — `api/views.py` :: `VideoFeedbackRegenerateAPIView`

`POST /api/video/<int:generation_id>/feedback/`.

Flow:

1. Validate `feedback` is non-empty.
2. Load the original generation (404 if not owned by `request.user`).
3. **Always** persist `user_feedback` + `feedback_submitted_at` on the original — we want every comment captured even if the regen fails.
4. Run an **upfront balance check** (`diamond_gate(request.user, 'video_8s')`) — better UX than failing inside the worker thread.
5. Resolve the user's Gemini key (`get_gemini_key(user)`).
6. Compose a merged prompt:
   ```python
   merged = f"{original.prompt}\n\nUser feedback to address in this new version: {feedback}"
   ```
7. Create a new `VideoGeneration` row with `status='processing'`, `regenerated_from=original`, all other fields copied from the original.
8. Spawn a `threading.Thread` running `_video_generation_worker(...)` (existing worker — does the actual `deduct_diamonds(feature='video_8s')` on success).
9. Return `202 ACCEPTED` with `{generation_id, status: "processing"}` so the frontend can poll `/video/status/<id>/` exactly like the original generation.

### 2.4 Frontend — `frontend/src/pages/magic/VideoResultScreen.tsx`

New UI block under the video player:

- Textarea for the feedback comment (placeholder mentions the 800-diamond cost).
- "🔁 Regenerate with feedback" button.
- Status badge "✓ Updated based on your feedback" when a regen completes.

State machine:

| State | Trigger |
|---|---|
| `idle` | initial |
| `processing` | feedback submitted, polling `/video/status/<id>/` every 5 s for up to 10 minutes |
| `completed` | new video URL swapped into the player, draft post invalidated and rebuilt |
| `failed` | timeout or backend error |

On `completed`, the screen:
- Swaps the player source via `setVideoResult(...)` so the result card now shows the regenerated clip.
- Resets `draftCreationStartedRef.current = false` and `setDraftPostId(null)` so the post-draft pipeline recreates a draft against the new video (otherwise the user would publish the old video).

### 2.5 URL — `api/urls.py`

```python
+path('video/<int:generation_id>/feedback/', views.VideoFeedbackRegenerateAPIView.as_view(),
+     name='api-video-feedback'),
```

---

## 3. Hashtag generation — context-rich + run last

### 3.1 Service — `posts/services/hashtag_service.py`

`generate_hashtags()` signature grows three optional kwargs:

```python
def generate_hashtags(
    post, platform,
    api_key=None, count=None, topic=None,
    override_prompt=None, user=None, think_harder=False,
    idea=None,              # {'title','hook','angle'}
    trending_topics=None,   # list[str]
    product_context=None,   # {'product_type','features','background_style'}
):
```

The prompt the LLM now sees has FOUR extra context blocks beyond the brand/caption pair:

- `media_context` — auto-derived from `post.media_files_list`. Detects video vs image by file extension or `'video'` substring, takes the first 4 items, truncates long URLs to last-200 chars, hides data-URL payloads ("video (inline data)"). Lets the LLM pick tags that reflect what's *in* the visual, not just the caption text.
- `idea_block` — title/hook/angle of the content idea the post was built from.
- `trending_block` — bullet-list of the trending themes the idea is anchored on.
- `product_block` — `product_type` / `features` / `background_style` when the post features a real product.

The instructions section was rewritten to *force* the model to span multiple signals:

> "Pick tags that span multiple signals: e.g. at least one tag should reflect the idea's angle, at least one a trending theme (when listed), and at least one the product category (when present)."

### 3.2 Endpoint — `api/hashtag_views.py` :: `GenerateHashtagsView`

Pulls the three new fields off `request.data` and forwards:

```python
created, used_prompt = generate_hashtags(
    post=post, ...,
    idea=data.get('idea'),
    trending_topics=data.get('trending_topics') or [],
    product_context=data.get('product_context'),
)
```

### 3.3 Serializer — `api/serializers.py` :: `GenerateHashtagsRequestSerializer`

New optional fields:

```python
idea            = serializers.DictField(required=False, allow_null=True)
trending_topics = serializers.ListField(child=CharField(allow_blank=True), required=False, allow_empty=True)
product_context = serializers.DictField(required=False, allow_null=True)
```

### 3.4 Frontend client — `frontend/src/services/hashtagService.ts`

The `generateHashtags()` data parameter grows the same three optional fields, fully typed.

### 3.5 Magic image pipeline — `frontend/src/pages/magic/AIWorkingScreen.tsx`

`STEPS` now has 7 entries instead of 6 — a new step **"Generating hashtags"** is inserted before "Final polish":

```ts
{ emoji: '#️⃣', label: 'Generating hashtags', desc: 'Picking hashtags based on the image and caption...', estimatedMs: 8000 },
```

Two new behaviours:

**A. Merge caption-generator hashtags immediately.** The caption API returns hashtags in a separate `generated_hashtags` field. Previously these were dropped. Now they're appended:

```ts
const generatedBody = (caption.generated_caption || '').trim();
const generatedHashtags = (caption.generated_hashtags || '').trim();
const mergedCaption = generatedHashtags && !generatedBody.includes('#')
  ? `${generatedBody}\n\n${generatedHashtags}`
  : generatedBody;
```

This mirrors the existing pattern in `MagicHistoryPage.tsx:337-341` and `VideoResultScreen.tsx:227`.

**B. Run dedicated hashtag generation after image-gen, against the saved drafts.** For each post, call `hashtagService.generateHashtags(postId, ...)` with the full strategic context, then append the chosen tags to the caption text via `\n\n#tag1 #tag2 ...` (skipping if the caption already contains `#` to avoid duplication). Also `PATCH /posts/<id>/` so reloads / Magic History show the same text, and refresh `captionsAccum` so downstream consumers see the enriched version.

`availableProductData` is now hoisted out of the product-mode block so step 6 (hashtag gen) can still read per-post product metadata.

### 3.6 Magic video pipeline — `frontend/src/pages/magic/VideoResultScreen.tsx`

A new `useEffect` (gated by `hashtagsGeneratedRef`) auto-generates hashtags once both the draft post AND the caption are ready:

```ts
hashtagService.generateHashtags(draftPostId, {
  platform,
  topic: prompt.slice(0, 120),
}).catch(...);
```

Runs exactly once per draft; rolls back the ref on failure so a retry is possible if the draft is recreated (which happens on regeneration — see §2.4).

---

## 4. Copy on image / copy on video toggle

### 4.1 New magic-mode question — `frontend/src/pages/magic/AIQuestionsScreen.tsx`

```ts
{ id: 'include_copy', emoji: '📝',
  question: 'Should the visuals include text on them?',
  subtext: 'Yes = headline copy is burned into the image/video. No = clean visuals only.',
  options: ['Yes — include copy on the visual', 'No — no text, image only'],
  singleSelect: true },
```

### 4.2 Image pipeline propagation — `AIWorkingScreen.tsx`

Reads `store.answers.include_copy`, normalises array/string variants, takes the `.toLowerCase().startsWith('yes')` to derive `wantsCopy`. Then for both product-mode and AI-only paths:

```ts
const imgReq = {
  ...,
  with_copy: wantsCopy,
};
if (wantsCopy) imgReq.copy_text = post.title;
```

Also passed into the new `visualPromptService.buildImagePrompt(...)` call, which embeds it as the `<text_overlay>` block in the LLM prompt (see §1.2).

### 4.3 Video pipeline propagation — `VideoWorkingScreen.tsx`

Same `wantsCopy` derivation. Plus a new `videoCopyTitle` taken from the first generated idea's title (or the user's seed prompt sliced to 80 chars) so the video has a sensible piece of copy to render.

```ts
formData.append('with_copy', String(wantsCopy));
if (wantsCopy && copyTextForVideo) formData.append('copy_text', copyTextForVideo);
```

### 4.4 Video endpoint — `api/views.py` :: `VideoGenerateAPIView`

Reads `with_copy` and `copy_text` and appends an instruction to the prompt **before** queuing the generation:

```python
with_copy = _parse_bool(request.data.get('with_copy', 'false'), default=False)
copy_text = (request.data.get('copy_text', '') or '').strip()
if with_copy and copy_text:
    prompt += (
        f'\n\nIMPORTANT: This video MUST prominently feature the following marketing copy '
        f'text rendered artistically as part of the composition: "{copy_text}". '
        f'The text should be professionally designed, clearly readable, and integrated '
        f'into the visual layout. Keep the text on-screen for the duration of the clip.'
    )
elif not with_copy:
    prompt += (
        '\n\nCRITICAL REQUIREMENT: Do NOT include any text, typography, words, letters, '
        'numbers, watermarks, or any written characters anywhere in the video. '
        'Purely visual content with zero text elements.'
    )
```

This mirrors the symmetric path the image endpoint already had.

### 4.5 Video duration picker removed — `VideoPromptScreen.tsx`

The 5 s / 8 s / 15 s picker UI is gone. A single constant `VIDEO_DURATION = 8` is passed to `onGenerate`. Backend default is also now 8 (`ai_video/models.py`).

---

## 5. Brand DNA → live web research

### 5.1 Endpoint rewrite — `api/views.py` :: `GenerateBrandDNAView`

Before today, the view:
1. Used `_crawl_site_pages(url, max_pages=5)` and `_fetch_page_content(url)` from `api/strategy_views.py` (BeautifulSoup-based crawler).
2. Stuffed up to 8000 chars of scraped HTML into the prompt.
3. Asked Claude to extract the 15 Brand-DNA fields from that blob.
4. Optionally bumped `max_tokens` 2500→5000 and turned on 10k extended thinking via a `think_harder` request flag.

After today, the view:
1. **Drops the scraper entirely.** Only `url = brand.website_url` is read.
2. Tells Claude to **use the `web_search` tool itself** — instructs it to run 2-5 searches, starting with `site:{url}` queries to enumerate pages, then targeted "<brand-name> mission" / "<brand-name> founder" / "<brand-name> vs <competitor>" follow-ups.
3. **Always** uses 8000 max_tokens and 10k thinking budget; the `think_harder` request flag is removed (no longer needed — this is always the deeper path).
4. Passes the `web_search_20250305` server tool with `max_uses: 5`.
5. Surfaces the extracted `brand_name` as `page_title` instead of the BS4-scraped `<title>` (falls back to URL).

The system prompt is rewritten to instruct the strategist persona to "use the web_search tool to read actual brand pages — homepage, about, services, blog — instead of guessing".

### 5.2 LLM service support for tools — `accounts/services/llm_service.py`

`UnifiedLLMService.chat_completion(...)` and `_claude_completion(...)` grow a new `tools` kwarg:

```python
def chat_completion(self, messages, ..., tools: Optional[List[Dict]] = None, ...):
    ...
    return self._claude_completion(messages, ..., tools)
```

In `_claude_completion`:

```python
if tools:
    params['tools'] = tools
resp = client.messages.create(**params)
```

Claude-only for now; ignored by other providers. Tools spec is in raw Anthropic format so callers can pass server tools (web_search) or, eventually, custom function-calling tools.

### 5.3 Diamond cost bump — `accounts/services/diamond_service.py`

```python
'brand_dna': 35,  # bumped from 15 — covers web_search + extended thinking
```

This is the fallback cost in code. The live `FeatureCostConfig` table is bumped via migration (§5.4).

### 5.4 Data migration — `accounts/migrations/0025_brand_dna_cost_bump.py` (NEW)

Idempotent `RunPython` migration:

```python
def bump_brand_dna_cost(apps, schema_editor):
    FeatureCostConfig = apps.get_model('accounts', 'FeatureCostConfig')
    FeatureCostConfig.objects.filter(feature='brand_dna').update(flat_override_diamonds=35)
```

`revert_brand_dna_cost()` flips back to 15 for `migrate ... 0024`. Module docstring explains the rationale (covers Anthropic web_search + 10k thinking budget — roughly 3× the previous spend per call) and notes the no-op fallback path for fresh installs.

### 5.5 Free-plan grant doubled — `accounts/models.py`

The `create_user_profile` post-save signal that seeds a new `DiamondWallet`:

```python
balance=400,                       # was 200
total_recharged=400,               # was 200
DiamondTransaction(amount=400, balance_after=400,
    note='Initial free plan grant (400 diamonds)')
```

This keeps new free-plan users whole given the brand-DNA cost bump (one DNA gen now costs 35 of the 400, vs 15 of 200 — same fraction).

### 5.6 Welcome-email copy — `accounts/services/email_service.py`

Both the plain-text and the HTML welcome email update from "200 free Diamond Tokens" → "400 free Diamond Tokens" to stay consistent with the grant.

---

## 6. Files changed — index

### 6.1 Modified (17 files)

| File | What changed |
|---|---|
| [accounts/models.py](../../accounts/models.py) | Free-plan grant 200 → 400 (and matching `DiamondTransaction` note). |
| [accounts/services/diamond_service.py](../../accounts/services/diamond_service.py) | `'brand_dna': 35` (was 15). |
| [accounts/services/email_service.py](../../accounts/services/email_service.py) | Welcome email copy "200" → "400" (plain + HTML). |
| [accounts/services/llm_service.py](../../accounts/services/llm_service.py) | `chat_completion(..., tools=None)` + `_claude_completion(..., tools=None)` pass-through to Anthropic SDK. |
| [accounts/services/prompt_resolver.py](../../accounts/services/prompt_resolver.py) | Two new `PROMPT_SCHEMA` entries: `visual_prompt_image`, `visual_prompt_video`. |
| [ai_video/models.py](../../ai_video/models.py) | `VideoGeneration`: `user_feedback`, `feedback_submitted_at`, `regenerated_from` FK; default duration 5 → 8. |
| [api/hashtag_views.py](../../api/hashtag_views.py) | Forwards `idea` / `trending_topics` / `product_context` through to `generate_hashtags()`. |
| [api/serializers.py](../../api/serializers.py) | `GenerateHashtagsRequestSerializer` accepts `idea` / `trending_topics` / `product_context`. |
| [api/urls.py](../../api/urls.py) | 3 new routes: `video/<id>/feedback/`, `visual-prompt/image/`, `visual-prompt/video/`. |
| [api/views.py](../../api/views.py) | `GenerateBrandDNAView` rewritten to use Claude's `web_search`. New `VideoFeedbackRegenerateAPIView`. `VideoGenerateAPIView` reads `with_copy` / `copy_text` and default duration is 8. |
| [frontend/src/pages/magic/AIQuestionsScreen.tsx](../../frontend/src/pages/magic/AIQuestionsScreen.tsx) | New `include_copy` question. |
| [frontend/src/pages/magic/AIWorkingScreen.tsx](../../frontend/src/pages/magic/AIWorkingScreen.tsx) | Caption hashtags merged inline; new "Generating hashtags" pipeline step; `visualPromptService.buildImagePrompt(...)` integration; `wantsCopy` plumbing. |
| [frontend/src/pages/magic/VideoPromptScreen.tsx](../../frontend/src/pages/magic/VideoPromptScreen.tsx) | Duration picker removed; constant `VIDEO_DURATION = 8`. |
| [frontend/src/pages/magic/VideoResultScreen.tsx](../../frontend/src/pages/magic/VideoResultScreen.tsx) | Feedback textarea + regen button + polling state machine; auto-hashtag generation effect. |
| [frontend/src/pages/magic/VideoWorkingScreen.tsx](../../frontend/src/pages/magic/VideoWorkingScreen.tsx) | `visualPromptService.buildVideoPrompt(...)` integration; `wantsCopy` + `copy_text` plumbing. |
| [frontend/src/services/hashtagService.ts](../../frontend/src/services/hashtagService.ts) | `generateHashtags()` accepts `idea` / `trending_topics` / `product_context`. |
| [posts/services/hashtag_service.py](../../posts/services/hashtag_service.py) | Strategic context + media context blocks added to the LLM prompt; instructions rewritten to force multi-signal tag selection. |

### 6.2 Added (6 files, untracked)

| File | Purpose |
|---|---|
| [accounts/migrations/0025_brand_dna_cost_bump.py](../../accounts/migrations/0025_brand_dna_cost_bump.py) | Bumps live `FeatureCostConfig` row for `brand_dna` 15 → 35. |
| [ai_video/migrations/0004_videogeneration_feedback_submitted_at_and_more.py](../../ai_video/migrations/0004_videogeneration_feedback_submitted_at_and_more.py) | Adds `user_feedback`, `feedback_submitted_at`, `regenerated_from` to `VideoGeneration`; alters default duration to 8. |
| [api/visual_prompt_views.py](../../api/visual_prompt_views.py) | `BuildImageVisualPromptView` + `BuildVideoVisualPromptView`. |
| [docs/securitycheck.md](../securitycheck.md) | 2026-05-21 security & scalability audit (~340 lines, 8.5/10 critical risk score). |
| [frontend/src/services/visualPromptService.ts](../../frontend/src/services/visualPromptService.ts) | Client for the two new visual-prompt endpoints. |
| [posts/services/visual_prompt_builder.py](../../posts/services/visual_prompt_builder.py) | The `ImageVisualPromptBuilder` and `VideoVisualPromptBuilder` services. |

---

## 7. Behavioural impact (what users will notice)

| Surface | Change | Effect |
|---|---|---|
| New-user signup | Welcome email + initial wallet | 400 tokens instead of 200 (≈ matched to brand-DNA cost bump). |
| Brand-DNA generation | Slower (web_search + thinking) | More accurate DNA — multiple pages researched live — but takes ~3× longer and costs 35 diamonds (was 15). |
| Magic image pipeline | Extra ~8 s step "Generating hashtags" | Posts arrive with hashtags pre-merged into the caption text. Image prompts are richer; should track the caption more tightly. |
| Magic Mode questionnaire | New "Include copy?" question | Yes → text is burned into the image / video; No → strictly visual. |
| Magic video pipeline | Duration picker gone; everything is 8 s | Single consistent length; one less choice. |
| Video result screen | New "Want to improve this video?" feedback box | Users can iterate on a video without restarting the whole flow. Each regen costs another `video_8s` diamond charge. |
| Video result screen | Hashtags auto-generated against the saved draft | Tags pre-populated before publish. |

---

## 8. Risks / things to watch

1. **Latency budget on the magic pipeline.** Adding two LLM calls per post (visual prompt + hashtag) plus one for video (visual prompt) extends Magic Mode end-to-end. The fallbacks mean it won't break, but if Anthropic is slow, total time can rise 10–20s per post. Worth measuring.
2. **Cost accounting.** Visual-prompt and per-post hashtag calls are NOT separately gated — the cost is absorbed. If usage scales, this becomes a real line item; monitor Claude spend vs paid features.
3. **Brand-DNA migration ordering.** Migration `0025_brand_dna_cost_bump` depends on `0024_featurecostconfig`. Run `python manage.py migrate accounts` before users hit the new endpoint, otherwise they're still charged 15.
4. **Video regeneration thread.** `VideoFeedbackRegenerateAPIView` uses a daemon `threading.Thread`. Under Passenger/cPanel this means the regen dies if the worker recycles. For now this is consistent with the existing `_video_generation_worker` pattern. The new Celery refactor is out of scope.
5. **Free-plan economics.** A new user gets 400 diamonds. Brand DNA costs 35. That leaves 365 for everything else. The brand DNA is a one-shot per brand, so this is workable, but if a user creates multiple brands or regenerates DNA, they hit the wall fast. Marketing/PMs should sign off.
6. **`include_copy` answer normalisation.** The frontend does `.toLowerCase().startsWith('yes')` on the answer string. If we ever localise the question, that check needs to move to an enum lookup.
7. **CRLF line endings.** Git keeps warning that several edited files will be normalised. Not a behavioural risk, but worth one cleanup pass when staging.

---

## 9. Suggested commit plan

When ready to commit:

1. **One commit** for the brand-DNA + diamond economics change: `accounts/models.py`, `accounts/services/diamond_service.py`, `accounts/services/email_service.py`, `accounts/services/llm_service.py`, `accounts/migrations/0025_brand_dna_cost_bump.py`, and the `GenerateBrandDNAView` part of `api/views.py`. Message: `feat(brand-dna): live web_search research + cost bump (15→35), 400-token free grant`.
2. **One commit** for the visual prompt builder feature: `posts/services/visual_prompt_builder.py`, `api/visual_prompt_views.py`, `api/urls.py` (partial), `accounts/services/prompt_resolver.py`, `frontend/src/services/visualPromptService.ts`, and the relevant edits in `AIWorkingScreen.tsx`/`VideoWorkingScreen.tsx`. Message: `feat(magic): synthesise image+video prompts from brand DNA + caption + idea`.
3. **One commit** for the hashtag-context enrichment + pipeline step: `posts/services/hashtag_service.py`, `api/hashtag_views.py`, `api/serializers.py`, `frontend/src/services/hashtagService.ts`, plus the hashtag-loop additions in `AIWorkingScreen.tsx` and the auto-hashtag effect in `VideoResultScreen.tsx`. Message: `feat(hashtags): use idea+trending+product+media context; auto-run as last magic step`.
4. **One commit** for video feedback/regeneration: `ai_video/models.py`, `ai_video/migrations/0004_*.py`, `VideoFeedbackRegenerateAPIView` part of `api/views.py`, route in `api/urls.py`, and the UI in `VideoResultScreen.tsx`. Message: `feat(video): user feedback box + one-click regeneration with merged prompt`.
5. **One commit** for the `include_copy` question + 8 s duration: `frontend/src/pages/magic/AIQuestionsScreen.tsx`, `VideoPromptScreen.tsx`, `VideoWorkingScreen.tsx`, plus the `with_copy`/`copy_text` arm of `VideoGenerateAPIView` in `api/views.py` and matching `ai_video/models.py` duration default. Message: `feat(magic): "include copy" toggle + fixed 8-second video duration`.
6. **Separate commit** for the security audit doc: `docs/securitycheck.md`. Message: `docs: full repo security + scalability audit (2026-05-21)`.

Splitting like this keeps the per-commit diff small enough to bisect cleanly later.

---

*Generated 2026-05-25 by Claude Code.*
