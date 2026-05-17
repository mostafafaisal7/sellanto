# Sellanto AI Cost Audit — Per-Feature Pricing vs 3× Markup Target

**Audit date:** 2026-05-18
**Pricing model:** 1 Diamond = $0.001 USD (cost basis)
**Markup target:** 3× raw API cost (200% gross markup, the value documented at `accounts/services/diamond_service.py:9`)
**Rate source:** `accounts/services/cost_calculator.py` (verified May 2026)
**Scope:** Every key in `DIAMOND_COSTS` plus the `/overflow` end-to-end workflow

---

## Section A — Executive summary

| Metric | Value |
|---|---|
| AI features audited | 35 (every `DIAMOND_COSTS` key + ads) |
| Features priced **at or above** 3× target | 1 (`ads_boost_post`) |
| Features priced **within 25% of** 3× target | 3 (`messenger_reply`, `voice_preview`, `ads_campaign_create`) |
| Features **>50% under** 3× target | 31 |
| **Biggest single leak (per call)** | `video_30s` — costs $12.00, charges 3 ¢ in cost-basis terms |
| **Smallest leak (per call)** | `voice_preview` — costs $0.0015, charges $0.002 |

### Top-line findings
1. **Video is bleeding money.** Every Veo 3.1 call is billed at ~12% of its provider cost. A single 30-second video charged at the current 3,000 diamonds covers only $3.00 of cost basis against $12.00 in actual API spend — a $9 loss before infrastructure overhead.
2. **Image generation is the next-largest leak.** `image_standard` charges 15 diamonds for an API call costing 67 diamonds raw. We are charging customers ~22% of what we pay Google.
3. **Text features are uniformly 78–94% under the 3× target.** Most caption / brand-DNA / idea calls use Claude Sonnet 4 ($3/$15 per million); the table was set when Claude Haiku was the default. Either raise the diamond cost ~10× or actually route these features to Haiku 4.5.
4. **Ads pricing is roughly aligned** — `ads_boost_post` at 50 d is the only feature that beats target. This is a useful reference point for what "correctly priced" looks like.

### Recommended actions (priority order)
1. **Stop the video leak first.** Either raise video diamond costs ~12× or route default to `veo-3.1-lite-generate-preview` ($0.08/s, already in catalog) — a 5× cost drop that closes ~80% of the gap without touching prices.
2. **Apply the formula-driven cost engine** introduced alongside this audit (`FeatureCostConfig` model + `/admin-panel/feature-costs` UI). Once seeded with current values, an admin can raise every feature to 3× target with a single slider per row, no deploys.
3. **Cache + cheaper-model migrations for text features** — see Section D for prioritized list. Worth ~40% reduction in raw text costs before any pricing change.

---

## Section B — Per-feature audit

Numbers below use the rate tables at [accounts/services/cost_calculator.py:38-128](../accounts/services/cost_calculator.py#L38). Typical token volumes are based on the prompts in `magic/` and `api/` views; alt-text and vision calls include image-token input.

### B.1 Text / LLM features

All default to **Claude Sonnet 4** ($3.00/1M input, $15.00/1M output) routed through `accounts/services/llm_service.py`.

| Feature key | Typical in / out tokens | Raw $ | Raw 💎 | Target 3× 💎 | Current 💎 | Gap | Verdict | Call site |
|---|---|---|---|---|---|---|---|---|
| `caption` | 2,000 / 800 | $0.0180 | 18 | **54** | 5 | −91% | Under | [api/views.py:1013](../api/views.py#L1013) |
| `caption_adapt` | 1,500 / 600 | $0.0135 | 14 | **41** | 5 | −88% | Under | [api/caption_views.py](../api/caption_views.py) |
| `caption_regenerate` | 2,500 / 800 | $0.0195 | 20 | **59** | 5 | −92% | Under | [api/views.py:1171](../api/views.py#L1171) |
| `brand_dna` | 3,000 / 2,000 | $0.0390 | 39 | **117** | 15 | −87% | Under | [api/views.py:2485](../api/views.py#L2485) |
| `trending_generation` | 1,500 / 500 | $0.0120 | 12 | **36** | 8 | −78% | Under | [api/strategy_views.py:1181](../api/strategy_views.py#L1181) |
| `strategy_ideas` | 3,000 / 1,500 | $0.0315 | 32 | **95** | 10 | −89% | Under | [api/strategy_views.py:664](../api/strategy_views.py#L664) |
| `idea_regenerate` | 3,000 / 1,500 | $0.0315 | 32 | **95** | 10 | −89% | Under | [api/strategy_views.py:992](../api/strategy_views.py#L992) |
| `ai_reply_comment` | 500 / 200 | $0.0045 | 5 | **14** | 3 | −79% | Under | comment-reply path |
| `hashtag_generation` | 500 / 200 | $0.0045 | 5 | **14** | 3 | −79% | Under | [api/hashtag_views.py:35](../api/hashtag_views.py#L35) |
| `competitor_analysis` | 5,000 / 2,000 | $0.0450 | 45 | **135** | 12 | −91% | Under | [api/strategy_views.py:579](../api/strategy_views.py#L579) |
| `competitor_suggest` | 1,500 / 600 | $0.0135 | 14 | **41** | 8 | −80% | Under | [api/strategy_views.py:1408](../api/strategy_views.py#L1408) |
| `weekly_report` | 3,000 / 1,500 | $0.0315 | 32 | **95** | 15 | −84% | Under | weekly summary path |
| `pillar_generation` | 2,500 / 1,500 | $0.0300 | 30 | **90** | 10 | −89% | Under | [api/strategy_views.py:1564](../api/strategy_views.py#L1564) |
| `pillar_compliance` | 1,000 / 400 | $0.0090 | 9 | **27** | 5 | −81% | Under | [api/strategy_views.py:88](../api/strategy_views.py#L88) |
| `support_chat` | 1,500 / 400 | $0.0105 | 11 | **32** | 2 | −94% | Under | [api/views.py:3037](../api/views.py#L3037) |
| `refine_prompt` | 800 / 300 | $0.0069 | 7 | **21** | 3 | −86% | Under | [api/views.py:1588](../api/views.py#L1588) |
| `alt_text` | 1,000 / 200 (incl. vision) | $0.0060 | 6 | **18** | 3 | −83% | Under | [api/creative_views.py:28](../api/creative_views.py#L28) |
| `copy_overlay_text` | 1,000 / 400 | $0.0090 | 9 | **27** | 5 | −81% | Under | [api/creative_views.py:791](../api/creative_views.py#L791) |
| `compute_times` | 1,500 / 500 | $0.0120 | 12 | **36** | 5 | −86% | Under | [api/scheduling_views.py](../api/scheduling_views.py) |
| `repurpose_post` | 2,500 / 1,500 | $0.0300 | 30 | **90** | 10 | −89% | Under | repurpose flow |
| `messenger_reply` *(Haiku 4.5)* | 1,000 / 300 | $0.0025 | 3 | **8** | 3 | −63% | Closest to target | [api/views.py:3795](../api/views.py#L3795) |
| `prompt_engineer_generate` | 800 / 400 | $0.0084 | 8 | **25** | 5 | −80% | Under | [api/creative_views.py:650](../api/creative_views.py#L650) |
| `prompt_engineer_diagnose` | 800 / 400 | $0.0084 | 8 | **25** | 5 | −80% | Under | [api/creative_views.py:704](../api/creative_views.py#L704) |
| `prompt_engineer_reprompt` | 800 / 400 | $0.0084 | 8 | **25** | 5 | −80% | Under | [api/creative_views.py:742](../api/creative_views.py#L742) |
| `ai_styles` | 600 / 400 | $0.0078 | 8 | **23** | 5 | −78% | Under | [api/creative_views.py:922](../api/creative_views.py#L922) |

### B.2 Image generation

Default model: **Gemini 3.1 flash image preview** ($0.067/image). HD route uses **Gemini 3-pro image preview** ($0.134/image).

| Feature key | Provider+Model | Raw $ | Raw 💎 | Target 3× 💎 | Current 💎 | Gap | Verdict | Call site |
|---|---|---|---|---|---|---|---|---|
| `image_standard` | gemini-3.1-flash-image-preview | $0.067 | 67 | **201** | 15 | −93% | Under | [ai_image/gemini_service.py:150](../ai_image/gemini_service.py#L150) |
| `image_hd` | gemini-3-pro-image-preview | $0.134 | 134 | **402** | 40 | −90% | Under | [ai_image/gemini_service.py:150](../ai_image/gemini_service.py#L150) |

### B.3 Video generation

Default model: **Veo 3.1 generate preview** ($0.40/sec). The fast/lite tiers are 3.3× and 5× cheaper respectively but never selected as default.

| Feature key | Provider+Model | Duration | Raw $ | Raw 💎 | Target 3× 💎 | Current 💎 | Gap | Verdict |
|---|---|---|---|---|---|---|---|---|
| `video_5s` | veo-3.1-generate-preview | 5 s | $2.00 | 2,000 | **6,000** | 500 | −92% | Under |
| `video_8s` | veo-3.1-generate-preview | 8 s | $3.20 | 3,200 | **9,600** | 800 | −92% | Under |
| `video_10s` | veo-3.1-generate-preview | 10 s | $4.00 | 4,000 | **12,000** | 1,000 | −92% | Under |
| `video_15s` | veo-3.1-generate-preview | 15 s | $6.00 | 6,000 | **18,000** | 1,500 | −92% | Under |
| `video_30s` | veo-3.1-generate-preview | 30 s | $12.00 | 12,000 | **36,000** | 3,000 | −92% | Under |

Call site: [video_studio/services/veo_service.py:30](../video_studio/services/veo_service.py#L30), [ai_video/gemini_service.py:154](../ai_video/gemini_service.py#L154).

**If we switched default to `veo-3.1-lite-generate-preview` ($0.08/s):**

| Feature key | Raw $ (lite) | Raw 💎 | Target 3× 💎 | Current 💎 | Gap with lite |
|---|---|---|---|---|---|
| `video_5s` | $0.40 | 400 | **1,200** | 500 | −58% (still under but only 2.4× off) |
| `video_30s` | $2.40 | 2,400 | **7,200** | 3,000 | −58% |

### B.4 Voice / TTS

Provider: **OpenAI TTS-1** at $15.00/1M characters. Worst-case character counts taken from `cost_calculator.py:122`.

| Feature key | Typical chars | Raw $ | Raw 💎 | Target 3× 💎 | Current 💎 | Gap | Verdict |
|---|---|---|---|---|---|---|---|
| `voice_preview` | 100 | $0.0015 | 1.5 | **5** | 2 | −60% | Near target |
| `voice_short` | 500 | $0.0075 | 8 | **23** | 5 | −78% | Under |
| `voice_medium` | 1,000 | $0.0150 | 15 | **45** | 10 | −78% | Under |
| `voice_long` | 2,000 | $0.0300 | 30 | **90** | 15 | −83% | Under |
| `voice_extra_long` | 4,000 | $0.0600 | 60 | **180** | 25 | −86% | Under |

Call site: [ai_voice/views.py:82](../ai_voice/views.py#L82).

### B.5 Ads automation

These are AI-driven setup calls (audience-targeting suggestions, campaign-blueprint generation). Ad spend itself is paid by the user directly to Meta/Google.

| Feature key | Typical in / out | Raw $ | Raw 💎 | Target 3× 💎 | Current 💎 | Gap | Verdict |
|---|---|---|---|---|---|---|---|
| `ads_boost_post` | 1,500 / 600 | $0.0135 | 14 | **41** | 50 | **+22%** | **At target** ✓ |
| `ads_campaign_create` | 3,000 / 1,500 | $0.0315 | 32 | **95** | 100 | +5% | Near target |
| `ads_audience_create` | 1,000 / 500 | $0.0105 | 11 | **32** | 30 | −6% | Near target |
| `ads_ai_targeting_suggest` | 1,000 / 500 | $0.0105 | 11 | **32** | 20 | −38% | Under |
| `ads_insights_pull` | 500 / 200 | $0.0045 | 5 | **14** | 2 | −86% | Under (but very high call frequency) |

---

## Section C — `/overflow` itemized cost walk-through

`/overflow` is the 5-step guided workflow at [frontend/src/pages/OverflowPage.tsx](../frontend/src/pages/OverflowPage.tsx) (state in [frontend/src/store/overflowStore.ts](../frontend/src/store/overflowStore.ts)). Each step hits a normal AI endpoint that deducts diamonds — **there is no bypass tier**.

### C.1 Step-by-step cost

| Step | Sub-action | Feature | Current 💎 | Target 3× 💎 | Provider+Model | Notes |
|---|---|---|---|---|---|---|
| 1 | Brand DNA crawl + analysis | `brand_dna` | 15 | 117 | Claude Sonnet 4 | Full website crawl + ~5K token analysis |
| 2 | Generate Content Pillars | `pillar_generation` | 10 | 90 | Claude Sonnet 4 | Per-brand, ~4K tokens |
| 3a | Suggest Competitors | `competitor_suggest` | 8 | 41 | Claude Sonnet 4 | One call, returns N candidates |
| 3b | Crawl & analyse each competitor | `competitor_analysis` × N | 12 × N | 135 × N | Claude Sonnet 4 | Per-competitor web crawl |
| 4 | Generate Trending Topics | `trending_generation` | 8 | 36 | Claude Sonnet 4 | One call |
| 5 | Generate Ideas (batch of M) | `strategy_ideas` | 10 | 95 | Claude Sonnet 4 | Single batch call regardless of M |
| 6 | Generate Captions (per idea K) | `caption` × K | 5 × K | 54 × K | Claude Sonnet 4 | One call per idea |
| 7a | Generate Image (per caption) | `image_standard` × K | 15 × K | 201 × K | Gemini 3.1 flash image | Optional per idea |
| 7b | Generate Video (per caption) | `video_5s` × K | 500 × K | 6,000 × K | Veo 3.1 generate preview | Alternative to 7a |

### C.2 Typical run totals

**Configuration A** — 3 competitors / 5 ideas / 5 captions / 5 standard images, **no video**:

| Step | Current | Target |
|---|---|---|
| Brand DNA | 15 | 117 |
| Pillars | 10 | 90 |
| Competitor suggest | 8 | 41 |
| Competitor analysis × 3 | 36 | 405 |
| Trending | 8 | 36 |
| Ideas | 10 | 95 |
| Captions × 5 | 25 | 270 |
| Images × 5 | 75 | 1,005 |
| **Total** | **187 💎** | **2,059 💎** |
| **Cost basis** | $0.19 | $2.06 |
| **Gap** | **−91% under** | |

**Configuration B** — Same, but with 5-second video on each caption instead of images:

| Step | Current | Target |
|---|---|---|
| (Brand DNA + Pillars + Comp + Trending + Ideas + Captions) | 112 | 1,054 |
| Videos × 5 | 2,500 | 30,000 |
| **Total** | **2,612 💎** | **31,054 💎** |
| **Cost basis** | $2.61 | $31.05 |
| **Gap** | **−92% under** | |

**Configuration C** — Heavy power-user run: 5 competitors / 10 ideas / 10 captions / 5 images + 5 videos:

| Item | Current | Target |
|---|---|---|
| Brand DNA + Pillars + Trending | 33 | 243 |
| Competitor suggest + analysis × 5 | 68 | 716 |
| Ideas | 10 | 95 |
| Captions × 10 | 50 | 540 |
| Images × 5 | 75 | 1,005 |
| Videos × 5 | 2,500 | 30,000 |
| **Total** | **2,736 💎** | **32,599 💎** |
| **Cost basis** | $2.74 | $32.60 |
| **Real API spend** | ~$10.87 | ~$10.87 |

The "real API spend" row for Config C exposes the core problem: the company pays Google $10.87 in raw API costs for that run, but currently deducts diamonds equivalent to only $2.74 — a **$8.13 loss per power-user overflow run**.

---

## Section D — Cost-minimization recommendations

Priority-ordered. Each is independent of the pricing change.

### D.1 Route default video to Veo 3.1 Lite — **−80% raw cost**
- Current default at [video_studio/services/veo_service.py:30](../video_studio/services/veo_service.py#L30) is `veo-3.1-generate-preview` ($0.40/s).
- Lite is at line 36 of the same file ($0.08/s), already plumbed through the cost calculator.
- Change: swap `DEFAULT_VIDEO_MODEL` and the first entry in the model fallback chain.
- Effect: 5-second video raw cost drops $2.00 → $0.40. Standard tier becomes the premium tier.

### D.2 Route Haiku 4.5 for caption / hashtag / alt-text — **−66% raw cost on text**
- Haiku 4.5 = $1 in / $5 out vs Sonnet 4 = $3 / $15. Same output quality on the short-output features.
- The fallback matrix already maps `gpt-4o-mini ↔ claude-haiku-4-5` at [llm_service.py](../accounts/services/llm_service.py), but the route defaults to Sonnet.
- Change: pass `model='haiku'` (or the catalog equivalent) from `caption`, `hashtag_generation`, `alt_text`, `copy_overlay_text`, `ai_reply_comment` call sites.

### D.3 Default image to Gemini 2.5 flash image — **−42% raw cost on images**
- Current default `gemini-3.1-flash-image-preview` = $0.067/image.
- `gemini-2.5-flash-image` = $0.039/image (in `IMAGE_RATES`). Quality drop is acceptable for social-feed images.
- Change: swap primary at [ai_image/gemini_service.py:150-154](../ai_image/gemini_service.py#L150).

### D.4 Enable Anthropic prompt caching on long system prompts — **−90% input cost on cached tokens**
- `brand_dna`, `pillar_generation`, `trending_generation`, `strategy_ideas` all reuse the same multi-thousand-token brand-context system prompt within a session.
- Cache reads bill at 0.1× input rate — `cost_calculator.calculate_text_cost` already handles `cache_read_tokens` ([cost_calculator.py:216](../accounts/services/cost_calculator.py#L216)).
- Verify `llm_service.chat_completion()` actually sets `cache_control` headers; if not, add them.

### D.5 Embed-once for Brand DNA — **eliminates repeated embedding cost**
- `brand_dna_service.py` re-embeds the full website crawl on every regenerate.
- Persist embeddings keyed by `(brand_id, content_hash)` and reuse.
- Savings: avoids ~$0.01 per regenerate (small, but cumulative).

### D.6 Verify caption batching — **possible 4–6× reduction in caption cost**
- The `/api/v1/drafts/{post_id}/captions/generate/` endpoint already batches multiple captions in one LLM call.
- **Open question:** does the overflow flow actually use the batched endpoint, or does it loop one-call-per-caption?
- Check the call path from [frontend/src/store/overflowStore.ts](../frontend/src/store/overflowStore.ts) → `strategyService` and confirm.

---

## Section E — Pricing-alignment recommendations

### E.1 Raise all under-priced features to 3× target

The formula-driven cost engine introduced alongside this audit (see `accounts/services/diamond_service.py` and the `FeatureCostConfig` model) makes this a per-row slider in the admin UI. Recommended approach:

1. Apply the migration that seeds `FeatureCostConfig` from the current `DIAMOND_COSTS`. Day-1 behaviour is unchanged.
2. In the admin UI at `/admin-panel/feature-costs`, raise the `markup_pct` for each under-priced feature to **200%** (i.e. 3× cost).
3. Optionally clear the `flat_override_diamonds` field so the formula recalculates dynamically when token volumes change.

### E.2 Switch video pricing to duration-linear

Current `video_5s..video_30s` are discrete keys. A 7-second video gets billed as 8 seconds (next bucket up); a 12-second video gets billed as 15 seconds. Recommended: compute `diamonds = ceil(duration_seconds × $rate_per_sec × markup / $0.001)`.

This is already wired in the new `get_diamond_cost` path — passing `duration_seconds=N` as kwarg will compute the exact rate. The discrete buckets remain as overrides if the admin prefers fixed pricing.

### E.3 Communicate the price change before applying

Going from 187 → 2,059 diamonds for a typical overflow run is a **~11× price increase**. Recommended rollout:
1. Apply migration (no behaviour change).
2. Run audit-driven price tuner in shadow mode for 30 days (logged but not deducted).
3. Compare predicted user spend against actual diamond balances to identify users who would run dry.
4. Announce price change + top-up promo to those users.
5. Flip the markup live.

---

## Appendix — Methodology

- **Token estimates** are upper-bound for typical prompts in the relevant view file. Brand DNA includes website crawl content; competitor analysis includes full competitor page crawl. Real usage may be lower → final 3× target is conservative.
- **Vision cost** for `alt_text` includes ~750 image tokens at the standard Anthropic rate ($3/1M) plus a short text prompt. Output is short.
- **Voice cost** uses the worst-case character count from `VOICE_FEATURE_CHARS` in cost_calculator.py — actual cost will be ≤ shown.
- **All amounts** are pre-infrastructure (no server, storage, payroll, or Stripe fee allocation).
- **Diamond ↔ USD conversion** uses the cost-basis peg `1 💎 = $0.001`. The customer-facing top-up rate (~$0.008/💎 via [stripe_service.TOPUP_CATALOG](../accounts/services/stripe_service.py)) bakes margin into the diamond sale itself; this audit measures **API-deduction-side margin** only.
