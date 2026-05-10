# Magic Link — API & Model Cost Analysis

> Only models **actually invoked** in the Magic Link flow are listed below.  
> All pricing verified from official sources (May 2026):
> - Anthropic → [platform.claude.com/docs/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing)
> - Google → [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
> - OpenAI → [openai.com/api/pricing](https://openai.com/api/pricing/)

---

## ⚠️ Deprecation Warnings

| Model | Used In | Deadline |
|-------|---------|----------|
| `claude-sonnet-4-20250514` | All LLM steps (primary) | **Retiring June 15, 2026** — migrate to `claude-sonnet-4-6` (same price) |

---

## Pipeline Architecture

```
Website Insert → Brand DNA (Claude) → [Static Q&A] → Trending Filter (Claude) → Ideas (Claude) → Captions (Claude) → AI Media → Finalize Post
```

> Q&A questions are static frontend (`AIQuestionsScreen.tsx`) — no API call.

---

## 📐 How Many Posts per Magic Link Run?

| Flow | Items Generated | Notes |
|------|----------------|-------|
| **Flow 1** (AI image) | **2 posts** | 2 ideas + 2 captions + 2 images per run *(default `postCount=2`)* |
| **Flow 2** (product + image) | **2 posts** | Same as Flow 1, with product reference for images |
| **Flow 3** (video) | **1 video** | 1 idea + 1 video per run |

## 📊 Cost Granularity Legend

| Cost Label | Meaning |
|------------|---------|
| `one-time per website` | Brand DNA — runs once when user adds a website, reused on every subsequent run |
| `per run` | Runs once per Magic Link execution (e.g., Trending Filter) |
| `per idea` / `per caption` | Runs once per post → multiply by post count in totals |
| `per image` / `per video` | Per media item generated |
| `per second` | Video cost is duration × per-second rate |

> **The "Estimated Total" tables below already multiply per-item costs by 2 posts** (for Flow 1/2) or 1 video (Flow 3).

---

## Step-by-Step Cost Table

### Phase 1 — Brand DNA Setup *(one-time per website)*

> Endpoint: `/api/brands/<id>/generate-dna/` → `GenerateBrandDNAView` (api/views.py:2121)  
> Crawls 5 pages, sends ~8000 chars to Claude, extracts 15-field structured JSON profile.

| Step | Platform | Model | Description | Cost |
|------|----------|-------|-------------|------|
| Website Crawl | — | HTTP (`_crawl_site_pages`) | 5 pages, ~8000 chars max | **$0.00** |
| Brand DNA Extraction | Anthropic | `claude-sonnet-4-20250514` ⚠️ | Extracts brand_name, tagline, voice, audience, USPs, values, colors, themes, keywords, etc. (~3K in / 2K out) | **~$0.039** |
| **Phase 1 Total** | | | | **~$0.039** |

---

### Phase 2 — Per-Run Steps *(all 3 flows)*

| Step | Platform | Model | Description | Cost per Run |
|------|----------|-------|-------------|-------------|
| Q&A (5 questions) | — | None (static UI) | Hardcoded in frontend | **$0.00** |
| Trending Fetch | — | Google Trends (`pytrends`) | Free Python library | **$0.00** |
| Trending Filter | Anthropic | `claude-sonnet-4-20250514` ⚠️ | Ranks raw trends by brand relevance (~1.5K in / 0.5K out) | **~$0.012** |
| Idea Generation | Anthropic | `claude-sonnet-4-20250514` ⚠️ | Generates ideas with hooks/angles (~3K in / 1.5K out) | **~$0.031** per idea |
| Caption Generation | Anthropic | `claude-sonnet-4-20250514` ⚠️ | Platform-specific captions (~2K in / 0.8K out) | **~$0.018** per caption |
| Caption Regen (feedback) | Anthropic | `claude-sonnet-4-20250514` ⚠️ | Rewrites from feedback (~2.5K in / 0.8K out) | **~$0.021** per regen |

> **Extended Thinking** (`think_harder=true`): adds 10K thinking token budget → +~$0.15 per LLM call

**LLM Fallback Chain** (all Phase 1 + 2 LLM steps route via `get_llm_service`):
1. **Primary**: Anthropic `claude-sonnet-4-20250514` ⚠️ (always used in production with Claude key)
2. **Fallback**: OpenAI `gpt-4o-mini` (only if Claude key missing — $0.15 in / $0.60 out per M tokens)
3. **Last Resort**: Google `gemini-2.0-flash` (only if Claude AND OpenAI keys both missing — $0.10 in / $0.40 out per M tokens)

---

### Phase 3 — Flow-Specific Media Generation

#### Flow 1 — Fully AI Generated Image

> Endpoint: `/api/ai-image/generate/` with `provider: 'gemini'` → `GeminiImageService`  
> File: [ai_image/gemini_service.py:148-153](ai_image/gemini_service.py#L148-L153)

| Step | Platform | Model | Description | Cost per Image |
|------|----------|-------|-------------|---------------|
| AI Image (primary) | Google | `gemini-3.1-flash-image-preview` | Tries first | **$0.067** (1K res) |
| AI Image (fallback 1) | Google | `gemini-2.5-flash-image` | Balanced quality | **$0.039** |
| AI Image (fallback 2) | Google | `gemini-3-pro-image-preview` | High quality | **$0.134** (1K/2K) |
| AI Image (last resort 1) | Google | `imagen-3.0-generate-001` | Imagen text-to-image | **~$0.04** *(Imagen 3 not on current Google pricing page; estimated using Imagen 4 std rate)* |
| AI Image (last resort 2) | Google | `imagen-3.0-fast-generate-001` | Imagen fast variant | **~$0.02** *(estimated using Imagen 4 fast rate)* |

#### Flow 2 — Product Upload + AI Enhanced Image

> Same Gemini pipeline as Flow 1. Product compositing done with PIL — no extra AI call.

| Step | Platform | Model | Description | Cost per Image |
|------|----------|-------|-------------|---------------|
| Product Style Analysis | — | PIL / Python | Color/style extraction locally | **$0.00** |
| AI Background Image | Google | `gemini-3.1-flash-image-preview` | Generates empty background | **$0.067** |
| Product Compositing | — | PIL / Python | Places product PNG on background | **$0.00** |

#### Flow 3 — AI Video Generation

> Endpoint: `/api/video/generate/` → `VideoGenerateAPIView` → `GeminiVideoService.generate_video`  
> File: [ai_video/gemini_service.py:148-155](ai_video/gemini_service.py#L148-L155)  
> Default duration: 5 sec (frontend can request more)

| Step | Platform | Model | Description | Cost |
|------|----------|-------|-------------|------|
| Video Concept Idea | Anthropic | `claude-sonnet-4-20250514` ⚠️ | 1 idea for creative direction | **~$0.031** |
| Text-to-Video (primary) | Google | `veo-3.1-generate-preview` | Video w/ BrandDNA injected | **$0.40 / sec** (720p–1080p), $0.60 / sec (4K) |
| Text-to-Video (fallback) | Google | `veo-2.0-generate-001` | Veo 2 fallback | **$0.35 / sec** |
| Image-to-Video (with product) | Google | `veo-3.1-generate-preview` | Product image as anchor frame (Veo 3.x only) | **$0.40 / sec** |

> **5-sec video at $0.40/sec = $2.00** · 8-sec = $3.20 · 10-sec = $4.00

---

## Estimated Total Cost Per Magic Link Run

> Each total below is **for one full Magic Link execution**, which generates 2 posts (Flow 1/2) or 1 video (Flow 3).

### Flow 1 — AI Image Only *(2 posts per run)*

| Step | Calls per Run | Unit Cost | Subtotal |
|------|---------------|-----------|---------|
| Trending Filter (Claude) | 1 × per run | $0.012 | $0.012 |
| Idea Generation (Claude) | 2 × per post | $0.031 | $0.062 |
| Caption Generation (Claude) | 2 × per post | $0.018 | $0.036 |
| Gemini Image (`gemini-3.1-flash-image-preview` @ 1K) | 2 × per post | $0.067 | $0.134 |
| **Total per run (2 posts)** | | | **~$0.24** |
| **→ Per post** | | | **~$0.12** |

### Flow 2 — Product Upload + AI Image *(2 posts per run)*

| Step | Calls per Run | Unit Cost | Subtotal |
|------|---------------|-----------|---------|
| Trending Filter (Claude) | 1 × per run | $0.012 | $0.012 |
| Idea Generation (Claude) | 2 × per post | $0.031 | $0.062 |
| Caption Generation (Claude) | 2 × per post | $0.018 | $0.036 |
| Gemini Image (background only) | 2 × per post | $0.067 | $0.134 |
| Product Compositing (PIL) | 2 × per post | $0.000 | $0.000 |
| **Total per run (2 posts)** | | | **~$0.24** |
| **→ Per post** | | | **~$0.12** |

### Flow 3 — AI Video (Veo 3.1, 5 sec) *(1 video per run)*

| Step | Calls per Run | Unit Cost | Subtotal |
|------|---------------|-----------|---------|
| Trending Filter (Claude) | 1 × per run | $0.012 | $0.012 |
| Video Concept Idea (Claude) | 1 × per video | $0.031 | $0.031 |
| Veo 3.1 Generate (5 sec) | 1 × per video | $2.00 | $2.00 |
| **Total per run (1 video)** | | | **~$2.04** |

### Flow 3 — AI Video (Veo 3.1, 8 sec) *(1 video per run)*

| Step | Calls per Run | Unit Cost | Subtotal |
|------|---------------|-----------|---------|
| Trending Filter (Claude) | 1 × per run | $0.012 | $0.012 |
| Video Concept Idea (Claude) | 1 × per video | $0.031 | $0.031 |
| Veo 3.1 Generate (8 sec) | 1 × per video | $3.20 | $3.20 |
| **Total per run (1 video)** | | | **~$3.24** |

---

## Verified Pricing — Models Actually Used

### Anthropic Claude *(verified from [platform.claude.com](https://platform.claude.com/docs/en/about-claude/pricing))*

| Model | Used In Magic Link | Input /M tokens | Output /M tokens | Status |
|-------|-------------------|----------------|-----------------|--------|
| `claude-sonnet-4-20250514` | Brand DNA, Trending Filter, Ideas, Captions, Caption Regen, Video Concept | $3.00 | $15.00 | ⚠️ DEPRECATED — retiring June 15, 2026 |

### OpenAI *(LLM fallback only — used when Claude key missing)*

| Model | Used In Magic Link | Input /M tokens | Output /M tokens | Source |
|-------|-------------------|----------------|-----------------|--------|
| `gpt-4o-mini` | LLM fallback chain (only if Claude key absent) | $0.15 | $0.60 | [pricepertoken.com](https://pricepertoken.com/pricing-page/model/openai-gpt-4o-mini) |

### Google Gemini *(verified from [ai.google.dev](https://ai.google.dev/gemini-api/docs/pricing))*

| Model | Used In Magic Link | Price | Status |
|-------|-------------------|-------|--------|
| `gemini-3.1-flash-image-preview` | Image gen primary (Flow 1, Flow 2) | **$0.067 / image** at 1K res ($0.045 at 0.5K, $0.101 at 2K, $0.151 at 4K) | ✅ Current |
| `gemini-2.5-flash-image` | Image gen fallback 1 | **$0.039 / image** (≤1024×1024) | ✅ Current |
| `gemini-3-pro-image-preview` | Image gen fallback 2 | **$0.134 / image** (1K/2K), $0.24 (4K) | ✅ Current |
| `imagen-3.0-generate-001` | Image gen last resort | ~$0.04 / image *(not on current Google pricing page; estimated)* | ⚠️ Not on official price list |
| `imagen-3.0-fast-generate-001` | Image gen last resort fast | ~$0.02 / image *(estimated)* | ⚠️ Not on official price list |
| `veo-3.1-generate-preview` | Video primary (Flow 3) | **$0.40 / sec** (720p–1080p), $0.60 / sec (4K) | ✅ Current |
| `veo-2.0-generate-001` | Video fallback (Flow 3) | **$0.35 / sec** | ✅ Current |
| `gemini-2.0-flash` | LLM last-resort fallback (only if both Claude and OpenAI keys missing) | $0.10 in / $0.40 out per M | ⚠️ Deprecating |

---

## Code Issues to Fix

| # | File | Issue | Impact |
|---|------|-------|--------|
| 1 | [accounts/services/llm_service.py:587](accounts/services/llm_service.py#L587) | `claude_model = 'claude-sonnet-4-20250514'` (deprecated) | Migrate to `claude-sonnet-4-6` before June 15, 2026 |
| 2 | [accounts/services/llm_service.py:586](accounts/services/llm_service.py#L586) | `gemini_model = 'gemini-2.0-flash'` (deprecating) | Last-resort fallback uses deprecated model |
| 3 | [ai_image/gemini_service.py:153](ai_image/gemini_service.py#L153) | `gemini-3-pro-image-preview` (fallback 2) costs $0.134/image — 2× the primary | Verify if this expensive fallback is necessary |

---

## Scale Cost Estimates

> Brand DNA (~$0.039) is one-time per website. Below = per-run only.

| Flow | Cost / Run (2 posts) | 100 runs / month | 1,000 runs / month |
|------|---------------------|-----------------|---------------------|
| Flow 1 (AI image) | ~$0.24 | ~$24 | ~$240 |
| Flow 2 (product + image) | ~$0.24 | ~$24 | ~$240 |
| Flow 3 (video, 5 sec) | ~$2.04 | ~$204 | ~$2,040 |
| Flow 3 (video, 8 sec) | ~$3.24 | ~$324 | ~$3,240 |

> First-time user adds **~$0.039** (one-time Brand DNA via Claude) on the very first run only.
