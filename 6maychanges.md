# Sellanto - Changes Summary (6 May 2026)

This document summarizes the work shipped on May 6, 2026 — building on the previous day's landing-page launch. Today's focus: a real **cost-and-pricing analysis**, a polished **in-app Upgrade Plan page** (frontend + backend), and an **admin-only per-user Magic Mode prompt override system** with full audit logging.

---

## 1. Token Cost & Pricing Analysis (`tokenCostEstimations.md`)

A new top-level analysis document was added that maps every AI call in the system to a real per-call cost and recommends sustainable pricing.

### What's inside:
- **Provider price reference table** — current 2026 rates for Anthropic (Claude Sonnet 4 input $3 / output $15 per 1M), OpenAI (`gpt-image-1` $0.011 / $0.042 / $0.167 per image, `text-embedding-3-small`, TTS `nova`), Google (Gemini 2.0 Flash, Gemini 2.5 Flash Image, **Veo 3.1 Fast / Lite / Premium** at $0.15 / $0.25 / $0.40 per second).
- **Per-feature cost breakdown** with token counts:
    - 1 caption ≈ **$0.013** (Claude Sonnet 4 text-only)
    - 1 image-aware caption ≈ **$0.020** (adds ~1.5K image tokens)
    - 1 video-aware caption (4 frames) ≈ **$0.036**
    - 1 image (gpt-image-1 medium) = **$0.042**
    - 1 video (8s clip) = **$1.20 / $2.00 / $3.20** depending on Veo tier
    - 1 idea batch (5–10 ideas) ≈ **$0.054**
    - 1 brand DNA setup (one-time, ~75K embedding tokens) ≈ **$0.002**
    - 1 messenger reply (RAG + Claude) ≈ **$0.024**
- **Magic Mode full-run cost chain**: Lite (no video) ≈ **$0.15**; Standard with one Veo Fast ≈ **$1.43**; Pro with one Veo Lite ≈ **$2.32**; Hero with two Veo Premium ≈ **$6.81**.
- **Cost-of-quotas table** projecting per-user monthly COGS at each tier (Solo ≈ $2, Pro ≈ $24, Business ≈ $103 at full utilization).
- **Final pricing recommendation**: $0 / $29 / $149 (60–58% margin) with explicit warning that the prior $89 Business price loses money on heavy users.
- **Margin levers** — switching to Gemini 2.5 Flash Image (-7% on imagery), Veo 3.1 Fast for free/Pro, **Anthropic prompt caching** ($3/M → $0.30/M for repeat users), batched idea generation, gating `think_harder` to Business only.

### File added:
- **`tokenCostEstimations.md`** (top-level project doc).

---

## 2. PricingSection Quota & Price Realignment

The public landing page's pricing card was updated to match the cost-analysis recommendations so headline prices stay sustainable.

### `frontend/src/components/landing/PricingSection.tsx`:
- **Solo (free)**: 5→**3** Magic Mode runs, dropped the 1 video freebie, 2→**1** connected platform, added "10 AI captions / month".
- **Pro ($29/mo, $23 yearly)**: changed "unlimited Magic Mode" → **30 Magic Mode runs**, 200→**100** AI images, **30→2** Veo videos, added "200 Messenger Bot replies".
- **Business ($89 → $149/mo, $71 → $119 yearly)**: replaced the vague "unlimited AI quotas" with concrete numbers — unlimited Magic Mode, 500 images, **8 Veo videos**, 1,000 Messenger replies, 5 brand profiles, 3 team seats, custom Brand DNA training, dedicated success manager + SLA.

---

## 3. Upgrade Plan Page (Frontend + Backend)

A full in-app upgrade experience was built so users can see their current plan, view live usage meters, and switch tiers from a polished page (rather than a dead button).

### Backend
- **`api/subscription_views.py`** *(new)* — single source of truth `PLAN_CATALOG` for the 3 public-facing plans (Solo / Pro / Business) including USD prices, monthly + yearly, limits, feature lists, highlight flag, and CTA labels. All endpoints permission-gated by `IsAuthenticated`.
    - `GET  /api/v1/subscription/` → current plan + limits + usage + days remaining + active status.
    - `GET  /api/v1/subscription/plans/` → catalog of available plans.
    - `POST /api/v1/subscription/upgrade/` → switches the user's plan instantly (no payment gateway yet — clear `TODO` comment marks the slot for Stripe / SSLCommerz / bKash). Body: `{ plan, billing_cycle: 'monthly'|'yearly' }`. Returns the previous plan, the new subscription state, and a confirmation message.
- **`api/urls.py`** — 3 new routes registered alongside the existing user-profile block.
- **`accounts/models.py`** — `UserProfile.set_plan()` `plan_limits` dict realigned with the new pricing (`free`: 3 posts / 0 video / 1 account; `pro`: 30 posts / 2 video / 8 accounts; `business`: ∞ posts / 8 video / 10 accounts; `enterprise`: ∞ everywhere). No schema change — only dict values, no migration needed.

### Frontend
- **`frontend/src/services/subscriptionService.ts`** *(new)* — typed wrapper for the 3 endpoints with full TS interfaces (`PlanLimits`, `PlanUsage`, `PlanCatalogEntry`, `SubscriptionStatus`, `UpgradeResponse`, `BillingCycle`, `PlanId`).
- **`frontend/src/pages/UpgradePage.tsx`** *(new)* — composed layout:
    - **Header** with back-to-dashboard ghost button.
    - **Current-plan banner** — gradient card with plan name, days remaining, status badges, and **6 live usage meters** (Magic Mode, captions, images, videos, messenger, accounts) — bars turn coral over 90% usage; ∞ rendered for unlimited tiers.
    - **Monthly ↔ Yearly toggle** with a `-20%` savings badge.
    - **3 plan cards** — coral-bordered "Current plan" ribbon on the user's tier, "Most popular" gradient halo on Pro, dynamic CTAs (`Upgrade to ...` / `Switch to ...` / `Your current plan`) with up/down arrows for upgrades vs downgrades.
    - **Quota comparison table** — side-by-side numeric comparison of every quota across plans.
    - **3-card FAQ** — switching, quota caps, billing.
    - **Confirm modal** — shows new quotas + plan price + clear "payment not enabled yet" disclaimer.
    - **Success modal** — celebrates the switch, offers "Open dashboard".
- **`frontend/src/services/index.ts`** — exports the new `subscriptionService`.
- **`frontend/src/pages/index.ts`** — exports `UpgradePage`.
- **`frontend/src/App.tsx`** — `/upgrade` route added inside the protected Layout block.

### Wiring of existing surfaces:
- **`frontend/src/components/layout/Sidebar.tsx`** — new "**Upgrade Plan**" entry with **Pro** badge in the Settings group, using `ArrowUpCircleIcon`.
- **`frontend/src/pages/ProfilePage.tsx`** — the dead "Upgrade Plan" button now `navigate('/upgrade')`.
- **`frontend/src/components/dashboard/SubscriptionInfo.tsx`** — the dashboard's "UPGRADE FOR UNLIMITED" gradient button now navigates to `/upgrade`.

---

## 4. Admin: Per-User Magic Mode Prompt Overrides

A new admin-only feature was built that lets staff override any of the 6 prompts in the Magic Mode chain **for a specific user**, with full edit history. Privacy-controlled — the override text is never returned to a non-admin endpoint.

### The 6 overridable prompts (all previously hardcoded f-strings):
| Type key | Display name | Source location |
| :--- | :--- | :--- |
| `idea_system` | Idea Generator — System | `api/strategy_views.py:855` |
| `idea_user` | Idea Generator — User Context | `api/strategy_views.py:768` |
| `caption_system` | Caption Generator — System | `ai_caption/openai_service.py:163` |
| `image_refiner` | Image Prompt Refiner | `api/views.py:1252` |
| `brand_dna` | Brand DNA Enhancer | `api/views.py:182` |
| `video_prompt` | Video Prompt Builder | `video_studio/services/prompt_builder.py:51` |

### Backend

**Models (`accounts/models.py`)**
- **`UserPromptOverride`** — `(user, prompt_type)` unique. Fields: `prompt_text`, `is_active`, `created_by`, `updated_by`, timestamps. Stored in table `user_prompt_overrides`.
- **`PromptOverrideAuditLog`** — append-only history. Fields: `override` FK (nullable to survive deletion), `target_user`, `prompt_type`, `action` (create/update/delete/activate/deactivate), `admin`, `previous_text`, `new_text`, `created_at`. Stored in `prompt_override_audit_log`.

**Migration**
- **`accounts/migrations/0013_promptoverrideauditlog_userpromptoverride_and_more.py`** — auto-generated, applied cleanly.

**Resolver helper (`accounts/services/prompt_resolver.py`)** *(new)*
- `PROMPT_SCHEMA` registry — dict mapping each `prompt_type` → list of expected variable names. Used by the admin UI to render variable chips and to surface "missing variable" warnings.
- `resolve_prompt(user, prompt_type, default_text, vars_dict)` — looks up an active `UserPromptOverride` for the user; if found, calls `override.format(**vars_dict)`; on **any** error (missing variable, malformed template) silently falls back to the default and emits a `logger.warning(...)` so admins can diagnose. Soft-fail by design.
- `get_default_preview(prompt_type)` — short read-only previews shown in the editor when no override is set.

**Six call-site refactors** — each now builds the default prompt as before, builds a flat `vars_dict` of the same variables, and routes through `resolve_prompt`:
- `api/strategy_views.py` — both idea prompts (system + user context).
- `ai_caption/openai_service.py` — `_build_system_prompt()` now wraps its return value with `resolve_prompt`. `__init__` now stores `self.user`.
- `api/views.py` — image refiner and brand DNA enhancer.
- `video_studio/services/prompt_builder.py` — `build_enhanced_prompt(...)` gained an optional `user` parameter; the override is applied at the very end of prompt construction. `video_studio/views.py` updated to pass `request.user`.

**Admin API (`api/admin_views.py`)** *(3 new views, all gated by `IsOriginalAdmin`)*
- **`AdminPromptOverridesListView`** — `GET /api/v1/admin/users/<user_id>/prompt-overrides/` returns target user info, all 6 prompt descriptors with display names, stage labels, variables list, default preview, and the user's existing override (if any).
- **`AdminPromptOverrideDetailView`** — `PUT/DELETE /api/v1/admin/users/<user_id>/prompt-overrides/<prompt_type>/`. PUT upserts (validates `prompt_type`, requires non-empty `prompt_text`, supports `is_active` toggle); DELETE hard-deletes. Both write a `PromptOverrideAuditLog` row capturing `previous_text` and `new_text`.
- **`AdminPromptOverrideAuditView`** — `GET /api/v1/admin/users/<user_id>/prompt-overrides/<prompt_type>/audit/` returns the last 50 audit entries (admin name, timestamp, action, prev/new diff payload).

**URLs (`api/urls.py`)** — 3 new admin routes added inside the existing admin block.

**Constant `PROMPT_TYPE_META`** in `admin_views.py` — central definition of the 6 prompts (type, display name, stage description) used by the list endpoint.

### Frontend

**Service (`frontend/src/services/adminPromptService.ts`)** *(new)*
- Typed wrappers for `list`, `save`, `remove`, `audit`. Exports `PromptType`, `PromptOverride`, `PromptDescriptor`, `PromptOverridesResponse`, `AuditEntry` types.
- Registered in the services barrel `frontend/src/services/index.ts`.

**Components (`frontend/src/components/admin/`)**
- **`PromptOverrideEditor.tsx`** *(new)* — single-prompt editor card:
    - **Header** with prompt name + status badge ("Custom" coral / "Disabled" muted / "Default" muted) + "History" button.
    - **Variable chips row** — clickable buttons that insert `{var_name}` at the cursor position; chips for variables missing from the current template glow amber.
    - **Textarea** — monospace, ~10 rows, autosizing, focus-glow coral. Empty placeholder explains the system default is in effect.
    - **Missing-variable warning row** — yellow banner listing `{...}` chips that the runtime expects but the admin removed; non-blocking (soft-fail).
    - **Footer actions** — Save (with confirm modal showing the missing-variable warning), Show default toggle (renders the default preview as read-only `<pre>`), Active checkbox, Reset to default (with confirm modal that triggers DELETE).
- **`PromptAuditTimeline.tsx`** *(new)* — modal showing the last 50 edits:
    - Action icons + colors per type (create/update/delete/activate/deactivate).
    - Each row collapses to "by {admin} · {timestamp}"; expanding reveals a side-by-side prev → new diff with monospace formatting.

**Page wiring (`frontend/src/pages/admin/AdminUserDetailPage.tsx`)**
- New `'prompts'` value added to the `TabType` union.
- New tab entry "**Magic Prompts**" with `CommandLineIcon` appended to the tabs array.
- New `useState` slice (`prompts`, `promptsLoading`, `promptsError`, `auditPrompt`).
- New `useEffect` lazy-loads prompt descriptors via `adminPromptService.list(userId)` when the tab activates.
- New tab-content section renders 6 `<PromptOverrideEditor>` cards in a 2-column grid; each editor's `onSaved` callback updates local state without a refetch; `onOpenAudit` opens the `<PromptAuditTimeline>` modal scoped to the chosen prompt type.

### Privacy & security
- All 4 endpoints require `IsOriginalAdmin` — even during impersonation, edits are recorded against the **original admin user** (not the impersonated one).
- Override text is never returned to any non-admin endpoint; the runtime resolver is server-side only and the resolved prompt is sent to the LLM but never to the user's browser.
- Every save / delete writes an immutable audit row capturing `admin`, `target_user`, `prompt_type`, `action`, `previous_text`, `new_text`, `created_at`.
- Variable schema enforced softly — admins can save anything; runtime falls back to default + logs a warning if formatting fails.

---

## 5. Polish & Bug Fixes

### Hero headline
- `frontend/src/components/landing/HeroSection.tsx` — replaced the awkward `inline-block` gradient that wrapped the headline weirdly with a clean two-line layout: line 1 ("Turn any URL into") solid white, line 2 ("a week of social content") gradient with `pb-2` so descenders ('g', 'p') aren't clipped by `bg-clip-text`.

### Framer Motion v11 type compatibility
- `frontend/src/components/landing/HeroSection.tsx` — `fadeUp` annotated as `Variants` from framer-motion; `ease: 'easeOut'` cast `as const` so the literal narrows to `Easing`.
- `frontend/src/components/landing/AIVideoSection.tsx` — `ease: 'linear' as const` for the marquee transition.
- Resolves 5 TS2322 errors in `npm run build`.

### Premium platform strip
- `frontend/src/components/landing/PlatformStrip.tsx` — full redesign. Replaced text "Fb / Ig / TT" tiles with **real brand SVG icons** from the existing `PlatformIcon` component, in actual brand colors. Added a pulsing live indicator chip ("8 platforms · 1 click"), a gradient two-line headline ("Post once. Reach everywhere."), per-tile brand-colored hover halos with radial wash + scale-up + lift, and a bottom feature strip ("Auto-resize per platform · Smart-time scheduling · One-click cross-post · More platforms coming").

---

## 6. File Summary

| Component | Key Files Modified / Added |
| :--- | :--- |
| **Cost analysis doc** | `tokenCostEstimations.md` (new) |
| **Pricing realignment** | `frontend/src/components/landing/PricingSection.tsx` |
| **Upgrade Plan backend** | `api/subscription_views.py` (new), `api/urls.py`, `accounts/models.py` (`set_plan` limits) |
| **Upgrade Plan frontend** | `frontend/src/services/subscriptionService.ts` (new), `frontend/src/pages/UpgradePage.tsx` (new), `frontend/src/services/index.ts`, `frontend/src/pages/index.ts`, `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/pages/ProfilePage.tsx`, `frontend/src/components/dashboard/SubscriptionInfo.tsx` |
| **Prompt overrides backend** | `accounts/models.py` (`UserPromptOverride` + `PromptOverrideAuditLog`), `accounts/services/prompt_resolver.py` (new), `accounts/migrations/0013_*.py` (new), `api/admin_views.py` (3 views + `PROMPT_TYPE_META`), `api/urls.py` (3 routes), `api/strategy_views.py` (2 sites), `ai_caption/openai_service.py` (1 site + `__init__`), `api/views.py` (2 sites), `video_studio/services/prompt_builder.py` (signature + 1 site), `video_studio/views.py` (pass `user`) |
| **Prompt overrides frontend** | `frontend/src/services/adminPromptService.ts` (new), `frontend/src/services/index.ts`, `frontend/src/components/admin/PromptOverrideEditor.tsx` (new), `frontend/src/components/admin/PromptAuditTimeline.tsx` (new), `frontend/src/pages/admin/AdminUserDetailPage.tsx` (Magic Prompts tab + state + handlers) |
| **Polish** | `frontend/src/components/landing/HeroSection.tsx` (headline + ease typing), `frontend/src/components/landing/AIVideoSection.tsx` (ease typing), `frontend/src/components/landing/PlatformStrip.tsx` (full redesign) |

---

## 7. Verification

| Check | Result |
| :--- | :--- |
| `python manage.py makemigrations accounts` | 1 new migration generated (`0013`) |
| `python manage.py migrate` | Applied cleanly |
| `python manage.py check` | 0 issues |
| `npx tsc --noEmit` (frontend) | Clean |
| `npm run build` (frontend) | ✓ in 15.81s; production bundle `index-CBmKPZCE.js` (1.79 MB / 468 KB gzip) |

---

## 8. Out of scope (deferred to later sprints)

- **Payment gateway integration** — `/upgrade/` applies plans directly; Stripe / SSLCommerz / bKash slot is marked with a `TODO` comment in `subscription_views.py`.
- **Live "test run" of edited prompts** — admin can't trigger an LLM call from the editor to preview output.
- **Bulk apply prompt overrides across users** — one user at a time only; no "copy from user X" action.
- **Versioned restore from audit log** — history is browseable but no 1-click "restore version N" button (admin can copy text manually from the timeline).
- **Global default prompt editing** — overrides are per-user only; editing the system-wide default still requires a code release.
- **Bundle code-splitting** — main JS chunk is still > 500 KB; Vite warns but it's a pre-existing issue, not regressed today.
