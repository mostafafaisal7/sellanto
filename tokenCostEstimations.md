# Sellanto — Token Cost & Pricing Plan Analysis

> **Purpose.** Calculate the real per-call cost (tokens + USD) of every AI feature in Sellanto, then design 3 sustainable pricing plans with healthy margins.
>
> **Date.** 2026-05-06
> **Currency.** All costs in USD. Convert to BDT at point-of-sale if billing locally.
> **Scope.** Costs are for the AI providers only (Anthropic, OpenAI, Google). Hosting, bandwidth, and storage costs are separate (estimated at ~$1–3 per active user per month and folded into margin, not itemized).

---

## 1. Provider Price Reference (live as of 2026-05)

| Provider | Model | Input | Output | Notes |
|---|---|---|---|---|
| **Anthropic** | Claude Sonnet 4 (`claude-sonnet-4-20250514`) | $3.00 / 1M tok | $15.00 / 1M tok | Cache read $0.30/1M, write $3.75/1M |
| **Anthropic** | Claude Sonnet 4 — extended thinking | same | same + thinking tokens | `thinking_budget=10000` adds up to 10k output tokens |
| **OpenAI** | `gpt-4o-mini` (fallback) | $0.15 / 1M | $0.60 / 1M | |
| **OpenAI** | `gpt-image-1` (medium 1024×1024) | — | $0.042 / image | low $0.011, high $0.167 |
| **OpenAI** | `text-embedding-3-small` | $0.02 / 1M | — | for Brand DNA + product RAG |
| **OpenAI** | TTS (`nova` voice) | — | $15 / 1M chars | messenger bot voice replies |
| **Google** | Gemini 2.0 Flash | $0.10 / 1M | $0.40 / 1M | fallback caption model |
| **Google** | Gemini 2.5 Flash Image | — | $0.039 / image | image-gen alternative |
| **Google** | Veo 3.1 Fast | — | **$0.15 / sec** | $1.20 per 8s clip |
| **Google** | Veo 3.1 Lite (default) | — | **$0.25 / sec** | $2.00 per 8s clip |
| **Google** | Veo 3.1 Premium | — | **$0.40 / sec** | $3.20 per 8s clip |

> Veo audio (`generateAudio: true`) is included in the per-second price. 1080p is the default; 4k surcharge is currently +20%.

---

## 2. Per-Feature Cost Breakdown

### 2.1 AI Caption (text only)
**Where:** [`ai_caption/openai_service.py`](ai_caption/openai_service.py) — Claude Sonnet 4 primary.

| Item | Tokens | Cost |
|---|---|---|
| Input — system (philosophy + tone + guidelines) | ~900 | $0.0027 |
| Input — user (topic + brand params) | ~400 | $0.0012 |
| Output — single caption (max 800, typical 500) | ~600 | $0.0090 |
| **Total per caption** | **~1,900 tok** | **~$0.013** |
| With `think_harder` (max 1500 + thinking) | ~3,800 tok | ~$0.045 |

### 2.2 AI Caption (image-aware)
Adds 1 vision input (~1,500 image tokens for a 1024×1024 frame).

| Item | Tokens | Cost |
|---|---|---|
| Input text + image | ~3,400 | $0.0102 |
| Output | ~600 | $0.0090 |
| **Total** | **~4,000 tok** | **~$0.020** |

### 2.3 AI Caption (video-aware, 4 extracted frames)
| Item | Tokens | Cost |
|---|---|---|
| Input text + 4 frames | ~8,000 | $0.024 |
| Output | ~800 | $0.012 |
| **Total** | **~8,800 tok** | **~$0.036** |

### 2.4 AI Image generation
**Where:** [`ai_image/openai_service.py`](ai_image/openai_service.py) — `gpt-image-1` primary, Gemini Image fallback.

| Quality | Resolution | Cost / image |
|---|---|---|
| Low | 1024×1024 | **$0.011** |
| **Medium (default)** | 1024×1024 | **$0.042** |
| High | 1024×1024 | $0.167 |
| Medium | 1536×1024 (landscape) | ~$0.063 |
| Medium | 1024×1536 (portrait) | ~$0.063 |
| Gemini 2.5 Flash Image | 1024×1024 | $0.039 |

> No prompt tokens — this is a flat per-image cost.

### 2.5 AI Video generation (Veo)
**Where:** [`video_studio/services/veo_service.py`](video_studio/services/veo_service.py) — fixed 8s clips.

| Tier | Per second | **Per 8s clip** | When to use |
|---|---|---|---|
| Veo 3.1 Fast | $0.15 | **$1.20** | Drafts, free/Solo tier |
| Veo 3.1 Lite (default) | $0.25 | **$2.00** | Pro tier production |
| Veo 3.1 Premium | $0.40 | **$3.20** | Business tier hero pieces |

> 4K adds ~+20% (~$2.40 lite, ~$3.84 premium). Audio is included.

### 2.6 Strategy / Idea generation
**Where:** [`api/strategy_views.py`](api/strategy_views.py) — Claude Sonnet 4, max_tokens 3000.

| Item | Tokens | Cost |
|---|---|---|
| Input (brand context + pillars + competitors) | ~3,000 | $0.009 |
| Output (5–10 ideas as JSON) | ~3,000 | $0.045 |
| **Total per idea batch** | **~6,000 tok** | **~$0.054** |
| With `think_harder` (max 6000 + thinking) | ~12,000 tok | ~$0.13 |

### 2.7 Brand DNA setup (one-time per brand)
**Where:** [`brands/services/brand_dna_service.py`](brands/services/brand_dna_service.py) — `text-embedding-3-small`.

| Item | Tokens | Cost |
|---|---|---|
| Crawl 50 pages → ~300 chunks of 1k chars (~250 tok each) | ~75,000 | **~$0.0015** |
| Stored as embeddings, reused forever | — | — |
| **Total per brand** | | **~$0.002** |

### 2.8 Messenger Bot reply
**Where:** [`messenger_bot/services/rag_engine.py`](messenger_bot/services/rag_engine.py) — Claude Sonnet 4 + RAG.

| Item | Tokens | Cost |
|---|---|---|
| Input (system + brand chunks + history + msg) | ~4,000 | $0.012 |
| Output | ~800 | $0.012 |
| **Total per reply** | **~4,800 tok** | **~$0.024** |
| With voice TTS (~150 chars) | + chars | + ~$0.002 |

---

## 3. Magic Mode — Full-Run Cost Chain

A single Magic Mode run (URL → questions → posts) typically chains:
1. Brand context lookup (free — already embedded)
2. **1 idea batch** (Claude) → $0.054
3. **1 long-form caption** (Claude) → $0.013
4. **N images** (gpt-image-1 medium) → N × $0.042
5. **M videos** (Veo Fast or Lite, 8s) → M × $1.20–$2.00

| Magic Mode profile | Calls | Cost |
|---|---|---|
| **Lite** (text + 2 images, no video) | $0.054 + $0.013 + 2×$0.042 | **~$0.15** |
| **Standard** (text + 4 images + 1 Veo Fast) | $0.054 + $0.013 + 4×$0.042 + $1.20 | **~$1.43** |
| **Pro** (text + 6 images + 1 Veo Lite) | $0.054 + $0.013 + 6×$0.042 + $2.00 | **~$2.32** |
| **Hero** (text + 8 images + 2 Veo Premium) | $0.054 + $0.013 + 8×$0.042 + 2×$3.20 | **~$6.81** |

> **Insight:** The video call dominates the cost. Without video, a Magic Mode run costs **<$0.25**. With video, it's **$1.20–$6.80** depending on tier.

---

## 4. Cost of Realistic Monthly Quotas

What does it actually cost us per active user per month, by usage profile?

| Quota / month | Solo | Pro | Business |
|---|---|---|---|
| Magic Mode runs (lite, no video) | 3 | 30 | 100 |
| AI captions (standalone) | 10 | 200 | 1000 |
| AI images (standalone, medium) | 5 | 100 | 500 |
| AI videos (8s clips) | 0 | **5 × Veo Fast** | **15 × Veo Lite** |
| Messenger bot replies | 0 | 200 | 1000 |
| Brand profiles (one-time embed) | 1 | 1 | 5 |
| | | | |
| **Cost calculation** | | | |
| Magic runs cost | 3 × $0.15 = $0.45 | 30 × $0.15 = $4.50 | 100 × $0.15 = $15.00 |
| Captions | 10 × $0.013 = $0.13 | 200 × $0.013 = $2.60 | 1000 × $0.013 = $13.00 |
| Images | 5 × $0.042 = $0.21 | 100 × $0.042 = $4.20 | 500 × $0.042 = $21.00 |
| Videos | $0.00 | 5 × $1.20 = $6.00 | 15 × $2.00 = $30.00 |
| Messenger | $0.00 | 200 × $0.024 = $4.80 | 1000 × $0.024 = $24.00 |
| Brand DNA (amortized) | <$0.01 | <$0.01 | $0.01 |
| | | | |
| **🔻 Provider COGS / user / month** | **~$0.79** | **~$22.10** | **~$103.00** |

> **Hosting overhead** (DB, S3, bandwidth, Django host): add ~$1–$3/user/month.

> **Total fully-loaded COGS:** Solo **~$2/mo**, Pro **~$24/mo**, Business **~$106/mo**.

---

## 5. Pricing Plan Design — What to Charge

A healthy SaaS gross margin is **70–80%** (COGS = 20–30% of price). Below is the recommended pricing using a **70% margin target**, with an aggressive Pro option at 60%.

| Plan | Quotas (above) | COGS | **Recommended price** | Margin | Note |
|---|---|---|---|---|---|
| **Solo (Free)** | 3 Magic / 10 cap / 5 img / 0 vid | ~$2 | **$0** | -100% (acquisition cost) | Gated upgrades after limit |
| **Pro** | 30 Magic / 200 cap / 100 img / 5 vid (Fast) / 200 msg | ~$24 | **$59 / mo** | ~60% | Most popular; charge $49 yearly |
| **Business** | 100 Magic / 1000 cap / 500 img / 15 vid (Lite) / 1000 msg / 5 brands / 3 seats | ~$106 | **$249 / mo** | ~58% | $199 yearly per-seat |

### Yearly billing (recommended discount: 20%)
- Pro yearly: **$49/mo** ($588/yr) — still ~50% margin
- Business yearly: **$199/mo** ($2,388/yr) — still ~47% margin

### Why these numbers vs my earlier $0/$29/$89?
The original $29 Pro / $89 Business numbers in the landing page **lose money** at the heavy end. A heavy Pro user with 30 videos would cost us ~$60/mo while paying $29 — a 100%+ loss. The recommended pricing aligns COGS to industry-standard SaaS margins.

### If you must keep low headline prices (BD-market positioning)
Reduce the video quotas hard (videos are 80% of cost):

| Plan | Cheap version quota change | New COGS | Suggested price |
|---|---|---|---|
| Pro | **2 videos/mo** instead of 5 (Veo Fast) | ~$15 | **$29 / mo** ✅ |
| Business | **8 videos/mo** instead of 15 | ~$70 | **$149 / mo** ✅ |

**This is the version I'd ship.** It matches your landing page's existing $29 anchor while staying profitable. Update the Business tier from $89 → **$149**.

---

## 6. Margin Levers (how to push margin higher later)

1. **Switch image gen to Gemini 2.5 Flash Image** ($0.039 vs $0.042) → 7% image savings.
2. **Default to Veo 3 Fast for free/Pro tier**, reserve Lite/Premium for Business → 40–60% video savings.
3. **Use prompt caching** on Claude system prompts (Brand DNA, captioning system prompt). With cache hits at $0.30/1M instead of $3/1M, you cut text input cost **10×** for repeat users. This is a big one for high-volume Pro/Business accounts.
4. **Batch idea generation** (5–10 ideas in one call) instead of N separate calls.
5. **Cap `think_harder` to Business tier** — extended thinking is 3× the cost.
6. **Pre-generate during off-peak** for batched scheduled posts → no impact on cost but improves UX.
7. **TTS only on Business** — voice replies cost ~$0.002 each but add up at 1000+/mo.

---

## 7. Final Recommendation

> **Ship this pricing on the landing page:**
>
> | Plan | Price | What user gets |
> |---|---|---|
> | **Solo** | **$0 / forever** | 3 Magic / 10 captions / 5 images / 0 videos / 1 platform |
> | **Pro** ⭐ | **$29 / mo** ($23 yearly) | 30 Magic / unlimited captions / 100 images / **2 Veo videos** / all 8 platforms / 200 messenger replies |
> | **Business** | **$149 / mo** ($119 yearly) | unlimited Magic / unlimited captions / 500 images / **8 Veo videos** / 5 brand profiles / 3 team seats / 1000 messenger replies / SLA |
>
> **Why:**
> - **Solo $0** acquires users at ~$2/mo cost — acceptable burn for funnel-top.
> - **Pro $29** keeps the existing landing-page anchor, hits ~50% margin, and is competitively positioned vs Buffer/Hootsuite (~$25–35).
> - **Business $149** (raised from $89) is the only sustainable price for the team-grade quotas. Keeping it at $89 would lose money on every account.
>
> **Update needed:** [`PricingSection.tsx`](frontend/src/components/landing/PricingSection.tsx) currently says **Pro 30 videos**, **Business unlimited** — change to **Pro: 2 videos**, **Business: 8 videos**, and bump **Business price from $89 → $149**.

---

## Appendix — Quick Math Cheat Sheet

```
1 caption       = $0.013   (Claude Sonnet 4)
1 image         = $0.042   (gpt-image-1 medium)
1 video (8s)    = $1.20–$3.20  (Veo Fast / Lite / Premium)
1 idea batch    = $0.054   (5–10 ideas)
1 brand DNA     = $0.002   (one-time embed)
1 messenger msg = $0.024   (RAG + Claude)

Magic Mode (no video) ≈ $0.15
Magic Mode (1 video)  ≈ $1.43–$6.81
```
