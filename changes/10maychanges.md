# Sellanto - Changes Summary (10 May 2026) — `features/swapnil-v2.6` (uncommitted local work)

This document summarizes the work done since the May 7 commit (`8507a39d feat: billing system, finance dashboard & diamond analytics`). Today's focus: **email OTP signup verification**, **exact API token tracking + dynamic cost calculator** that derives real USD spend from every AI call, an **auto-calculated finance ledger** that no longer relies on manual expense entry for API costs, **prompt execution history** so admins can see exactly what was sent to the LLM and what came back, **expanded prompt override coverage** (6 prompt types → 19), and a **dedicated apiModelCost.md reference doc** with verified May-2026 pricing.

---

## 1. Frontend Design — What Was Built and Why

### 1.1 Email OTP Verification Screen ([frontend/src/components/auth/AuthModal.tsx](frontend/src/components/auth/AuthModal.tsx))

**What was built:** A new dedicated OTP screen inside the existing Auth modal. After signup (or after a login attempt by an unverified user), the modal swaps from the credentials form to a **6-digit code input** with:
- Large monospaced code input field, auto-focused on appearance.
- **Live 60-second countdown timer** showing seconds remaining before expiry.
- **"Resend code"** button (disabled until the timer hits 0 to prevent spam).
- Email address echoed back to the user (so they remember which inbox to check).
- Error states for: "Wrong code. N attempts left", "Code expired. Request a new one", "Too many wrong attempts."
- Success state automatically logs the user in via JWT tokens returned by the verify endpoint and routes to `/dashboard` or `/admin-panel`.

**Why this was built:**
1. **Stop fake-email signups.** Earlier the flow created a JWT immediately on registration, so anyone could sign up with `noone@nowhere.com` and consume free-tier diamonds. We were paying real money for spam accounts.
2. **Enable transactional email reliability.** Payment confirmations, plan upgrade emails, and admin notifications are useless if user emails bounce. OTP verification proves at signup time that the email is reachable.
3. **Better UX than email magic links.** Magic links break in webview browsers (Facebook in-app, LinkedIn in-app), which is exactly where new users land from social ads. A 6-digit code works everywhere.
4. **Same modal, no separate page.** Users would lose context if we redirected to `/verify-email` — they signed up to *use the product*, not to navigate. Keeping verification inside the AuthModal preserves the funnel.
5. **The login flow had to handle this too** because users could sign up, never verify, and then come back days later to log in. The login endpoint now returns `403 requires_verification` and the modal pivots to the OTP screen automatically.

### 1.2 Auto API Costs Tab in Admin Finance Page ([frontend/src/pages/admin/AdminFinancePage.tsx](frontend/src/pages/admin/AdminFinancePage.tsx))

**What was built:** A 4th tab in the finance dashboard called **"Auto API Costs"** that sits next to Overview / Revenue / Manual Expenses. It contains:
- **Hero header** showing total auto-calculated cost in coral, the date window, total deduction count, and the rate source (`apiModelCost.md`).
- **Cost-type cards** — 4 cards for `text` / `image` / `video` / `voice` with provider-color accents (purple/amber/coral/blue).
- **Monthly stacked bar chart** — costs split by provider (OpenAI / Gemini / Claude) per month so we can see which provider is eating the budget.
- **Top users table** — biggest API spenders for the period, useful for spotting abuse or whales.
- **Recent deductions feed** — last 50 API calls with computed cost per call.
- **Manual/auto split caption** under the tab strip clarifying that "Expenses include manual entries (X) + auto-calculated API costs from `apiModelCost.md` rates (Y)".

**Why this was built:**
1. **The old finance page only counted manual expenses.** I had to add a row every time we paid an OpenAI/Gemini bill. By the time the bill arrived from the provider, the data was 30 days stale.
2. **Per-call cost visibility.** Manual entry says "we spent $400 on OpenAI this month" — useless for finding which feature blew the budget. The auto panel says "captions cost $124, brand DNA cost $89, image refiner cost $187."
3. **Justify pricing decisions.** If we want to know whether the $29 Pro plan is sustainable, we need actual per-user COGS, not aggregate provider invoices.
4. **Spot the heavy-cost outliers.** Top-users table flagged 3 power users in early testing who were generating ~$15/day in Veo videos on the free plan — the kind of thing that's invisible until you compute it.
5. **Manual entries are still useful** for non-API costs (server hosting, payroll, marketing) — that's why we kept the Manual Expenses tab and just added Auto as a sibling, not a replacement.

### 1.3 Prompt Execution History on Admin User Detail Page ([frontend/src/pages/admin/AdminUserDetailPage.tsx](frontend/src/pages/admin/AdminUserDetailPage.tsx))

**What was built:** Below the existing prompt-override editors (in the "Magic Prompts" tab), a new **"Execution history"** section that lists every AI call made for this user. Each row shows:
- Status dot (green = success, red = failure).
- Prompt type (e.g. `caption_system`, `idea_user`).
- **"Custom" badge** in coral if an admin override was active for that call.
- Model used (e.g. `claude-sonnet-4-20250514`).
- Token count + timestamp.
- **Click-to-expand** reveals the **full prompt sent** (in monospace `<pre>`) and the **full AI response received**, plus brand context and any error message.
- **Filter dropdown** — narrow by prompt type (all 19 types).
- Pagination (20 per page, total count shown).

**Why this was built:**
1. **The override editor was half-blind.** Admins could write a custom prompt but had no way to verify whether it actually got used and what the LLM said in return. They were editing prompts in the dark.
2. **Debugging "why did the AI say X?"** Customer support requests like "the caption mentions a competitor we don't sell" were impossible to investigate before — there was no record of the exact prompt + response that produced it.
3. **Prove or disprove that an override is working.** When we ship a new override, we need to confirm the runtime is actually applying it. The `was_override: true` boolean badge makes that obvious.
4. **Cost forensics.** Tokens and model are recorded per execution, so we can answer "this user is burning 200k tokens/day — what prompts are doing it?" without guessing.
5. **90-day retention only** because storing raw prompt+response forever balloons disk. A management command (deferred) will purge older rows.

### 1.4 Better Auth Error Messaging ([frontend/src/components/auth/AuthModal.tsx](frontend/src/components/auth/AuthModal.tsx))

**What was changed:** The modal's `onLogin` was rewritten to do a direct `fetch('/api/v1/auth/login/')` instead of going through `useAuthStore.login()`. The store's helper throws on non-2xx and discards the response body, but we now need that body to detect the `requires_verification` 403 case.

**Why this was built:**
1. **The auth store was a black box.** It returned `void` on success and threw `Error('Login failed')` on any non-2xx — the body containing `requires_verification`, `user_id`, `email`, `otp_ttl_seconds` was being thrown away.
2. **Server-driven verification.** When the server says "this user exists but isn't verified yet," the frontend needs the `user_id` to send to `/verify-otp/`. Without reading the body, we couldn't pivot to OTP.
3. **Kept the store for everything else** — direct `fetch` is a localized exception only for login because of the verification pivot. All other auth actions (logout, refresh, fetchUser) still go through the store.

### 1.5 New TypeScript Types & Service Methods

**adminPromptService.ts** — added 16 new prompt types (was 6, now 19) covering ideas / captions / images / video / brand DNA / trending / competitors / pillars / support. Added `ExecutionRecord` and `ExecutionHistoryResponse` interfaces and an `executionHistory(userId, params)` method.

**financeService.ts** — added `AutoExpensesResponse`, `AutoMonthEntry`, `AutoCategoryEntry`, `AutoFeatureEntry`, `AutoCostTypeEntry`, `AutoTopUserEntry` types. Added `getAutoExpenses(params)` method. Extended `FinanceSummary` and `CategoryBreakdown` with optional `auto_total`, `manual_expense_usd`, `auto_expense_usd` fields so the existing summary endpoint can blend in API-cost data.

**Why:** the frontend was using the same 6-prompt-type list across multiple files; now that the backend supports 19, the type union had to be widened. Same for finance — adding a new tab without typed responses would have been guessing-game prop drilling.

---

## 2. APIs — How They Work in Backend and Why They Exist

### 2.1 Email OTP Endpoints ([api/views.py](api/views.py), [api/urls.py](api/urls.py))

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/verify-otp/` | `VerifyOTPView` | Validate the 6-digit code, flip `email_verified=True`, return JWT tokens. |
| `POST` | `/api/v1/auth/resend-otp/` | `ResendOTPView` | Issue a fresh 60-second code (invalidates any prior codes). |

**How they work in backend:**

`RegisterView` and `OnboardCompleteView` were both modified to **stop returning JWT tokens immediately** on signup. Instead they:
1. Call `EmailOTP.issue(user)` which:
   - Marks all the user's previous unused OTP rows as `is_used=True` (single active code at a time).
   - Generates a 6-digit code via `secrets.randbelow(1_000_000)` (cryptographically random, not `random.randint`).
   - Inserts a new `EmailOTP` row with `expires_at = now + 60s`.
2. Call `send_otp_email(user, otp.code, ttl_seconds=60)` — fires the branded HTML email via SMTP. Email failures are logged but don't roll back the registration.
3. Return `{requires_verification: true, user_id, email, otp_ttl_seconds}` instead of tokens.

`VerifyOTPView` accepts `{user_id, code}`, runs `EmailOTP.verify(user, code)` which:
- Returns `(False, 'Enter the 6-digit code from your email.')` if the code isn't 6 digits.
- Returns `(False, 'No active code. Request a new one.')` if no unused row exists.
- Returns `(False, 'Code expired. Request a new one.')` if `expires_at` has passed (and marks the row used so it can't be retried).
- Returns `(False, 'Too many wrong attempts. Request a new code.')` if `attempts >= 5` (and locks the row).
- Returns `(False, 'Wrong code. N attempt(s) left.')` and increments `attempts` on mismatch.
- Returns `(True, 'ok')` and marks the row used on match.

On success, the view flips `profile.email_verified = True`, sends the welcome email (only on the first verification, not on re-verifications), and issues fresh JWT tokens.

`LoginView` got a new gate: if `profile.email_verified` is False (and the user isn't staff/superuser, to keep existing admin accounts working), it issues a fresh OTP, sends the email, and returns `403 requires_verification` so the frontend can pivot to the OTP screen.

**Why these endpoints exist:**
1. **Email verification at login** (not just signup) catches users who registered before the OTP system existed but then return for the first time after this ships. They get walked through verification on their next login attempt.
2. **The 60-second TTL is intentionally short.** A 5-min window means a stolen code from a forwarded email is still usable. 60s + 5-attempt cap raises the bar enough.
3. **`resend-otp/` doesn't require the old code** because the user might have lost the email — this is a "I don't see it, send again" flow, not a renewal flow.
4. **Verification + welcome email are separate** so we don't spam users on login (only first verification triggers the welcome email).

### 2.2 Cost Calculator Service ([accounts/services/cost_calculator.py](accounts/services/cost_calculator.py))

**What it does:** Given a `DiamondTransaction` row, returns the actual USD cost as a `Decimal`. Three calculation paths:

1. **Token-based (LLM/text):** `cost = (input_tokens × input_rate + output_tokens × output_rate) / 1_000_000` plus cache adjustments. If `input_tokens`/`output_tokens` aren't populated (older rows), it falls back to splitting `raw_tokens` using `FEATURE_INPUT_RATIO` (e.g. captions are 71% input / 29% output, brand DNA is 60/40 — derived from real samples in `apiModelCost.md`).
2. **Per-image:** uses `IMAGE_RATES[model]` looked up by `model_used` (or by `DEFAULT_IMAGE_MODEL_BY_PROVIDER[provider]` if model name is empty for legacy rows). Multiplied by `IMAGE_QUALITY_MULTIPLIER` for HD vs standard.
3. **Per-second video:** `VIDEO_RATES_PER_SECOND[model] × duration_seconds`. Duration comes from the explicit `duration_seconds` column or, as a fallback, parsed out of feature names like `video_5s` → 5.

**Rate tables built into the file:**
- `LLM_RATES` — Claude (Sonnet/Haiku/Opus 4-series), GPT (4o, 4o-mini, 4-turbo, 4, 3.5), Gemini (2.5 pro/flash/lite, 2.0 flash) with verified May-2026 input/output rates per million tokens.
- `IMAGE_RATES` — Gemini image preview models, Imagen 3, OpenAI gpt-image-1.5, DALL-E 3/2.
- `VIDEO_RATES_PER_SECOND` — Veo 3.1 (preview/lite/fast), Veo 2.0.
- `EMBEDDING_RATES` — text-embedding-3-small/large.
- Anthropic prompt cache: read tokens billed at **10% of input rate**, write tokens at **125% of input rate** — both factored into `calculate_text_cost`.

**Why this was built:**
1. **The old cost field was an estimate.** `raw_cost_usd` was computed using a single hardcoded `gpt-4o` rate at deduction time, even when the real call was Claude or Gemini. Aggregate "cost" reports were off by 2–5×.
2. **Recompute retroactively without backfill.** Even rows that pre-date the new exact-token columns get a sensible cost via the input/output split heuristic, so we can show historical totals immediately.
3. **One source of truth.** Whenever a provider changes pricing, we update `cost_calculator.py` and `apiModelCost.md`, and **every** view (admin dashboard, finance summary, auto-expenses tab, per-user detail) reflects the new rate the next time it queries — no migration, no recalculation job.
4. **Helper functions** `cost_type_for_feature(feature)` and `map_feature_to_provider_category(feature, provider)` let reports group by `text/image/video/voice` and by `openai/gemini/claude` respectively, both used by the auto-expenses endpoint.

### 2.3 Auto Expenses Endpoint ([api/finance_views.py](api/finance_views.py))

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/finance/auto-expenses/?from=&to=&months=12` | `AutoExpensesView` | Live-computed API cost breakdown by month / category / feature / cost-type / top-users from every `DiamondTransaction` deduction. |

**How it works in backend:**

1. **Window resolution** — same logic as `FinanceSummaryView` (explicit `from`/`to` wins, otherwise rolling N months).
2. **Pulls all deductions** via `DiamondTransaction.objects.filter(transaction_type='deduction', created_at__gte=window_start, created_at__lt=window_end).iterator()` — uses `iterator()` so a 100k-row scan doesn't blow up RAM.
3. For each row, calls `calculate_transaction_cost(tx)` to get the USD cost.
4. **Aggregates 5 ways simultaneously**: by month → `tx.created_at.replace(day=1)`, by provider category → `map_feature_to_provider_category(...)`, by feature → `tx.feature`, by cost type → `cost_type_for_feature(...)`, by user → `tx.user_id`.
5. Returns the full breakdown plus the rate source string `'apiModelCost.md (verified May 2026)'` so the UI can attribute the numbers.

**Also extended `FinanceSummaryView`:** the existing `/api/v1/admin/finance/summary/` endpoint now blends auto-calculated API costs into its expense totals, returns `manual_expense_usd` and `auto_expense_usd` separately so the UI can show the split, and adds `auto_total` per category in the breakdown.

**Why this was built:**
1. **Manual expense entry doesn't scale.** With ~50 API calls per active user per day, asking an admin to log every cost is impossible. The ledger should compute itself.
2. **Provider category buckets** (`openai`, `gemini`, `claude`) match how invoices arrive, so finance can reconcile "we computed $X for OpenAI this month, the invoice was $Y, delta is Z%."
3. **Top-users surfacing** is the cheapest fraud detection we have. Anyone in the top 10 who's on the free plan is getting investigated.
4. **Read-only by design** — it never writes to the DB, so it can be hit safely from any admin browser tab without race conditions.

### 2.4 Admin Dashboard Cost Accuracy ([api/admin_views.py](api/admin_views.py))

`AdminDashboardView` (the home of `/admin-panel/`) was switched from the legacy `estimate_cost(total_tokens)` (which assumed gpt-4o pricing for everything) to:
1. Iterating all `DiamondTransaction` deductions and applying `calculate_transaction_cost(tx)`.
2. Layering in costs for **legacy media rows** that pre-date diamond tracking — `ImageGeneration` and `VideoGeneration` rows whose count exceeds the matching diamond deductions get retroactively priced via `calculate_image_cost` / `calculate_video_cost`.

**Why:** the dashboard's "Total Cost" stat used to be off by 3–5× because it ignored Claude (expensive) and counted videos at chat-LLM rates. Now it matches the finance dashboard.

### 2.5 Prompt Execution Recording ([accounts/services/prompt_resolver.py](accounts/services/prompt_resolver.py), [accounts/models.py](accounts/models.py))

**New model:** `PromptExecution` — append-only record of every AI prompt sent. Fields: `user`, `prompt_type`, `was_override`, `prompt_sent`, `response_received`, `model_used`, `tokens_in`, `tokens_out`, `latency_ms`, `success`, `error_message`, `brand_id`, `brand_name`, `created_at`. Indexed on `(user, prompt_type, -created_at)` and `(user, -created_at)` so admin filters are O(log n).

**New helper:** `save_execution(user, prompt_type, prompt_sent, response_received='', was_override=False, model_used='', tokens_in=0, tokens_out=0, latency_ms=0, success=True, error_message='', brand=None)` — the call sites pass everything; the helper writes the row inside a try/except so a logging failure never breaks the AI request.

**`resolve_prompt` extended:** added a `return_meta=True` keyword. When set, it returns `(text, was_override: bool)` instead of just `text`, so call sites can pass `was_override` straight to `save_execution`.

**Where it's now wired in:**
- `api/strategy_views.py` — idea generation, idea regeneration, both system + user prompts.
- `api/trending_service.py` — Google Trends → Claude filter.
- (Other call sites still need migration; tracked as follow-up work.)

**Why this was built:**
1. **Without execution records, the override system is unverifiable.** An admin could write a custom prompt and never know if it was applied.
2. **Brand context attached to each record** lets us answer "show me every prompt that ran for Brand X" — useful for support tickets that mention a specific brand.
3. **Latency is recorded** so we can spot slow models (gemini-2.0-flash sometimes spikes to 8s; Claude is more consistent).
4. **`success=False` rows** are the gold mine for debugging. We now know exactly which prompt failed and what error came back.

### 2.6 Exact Token Tracking on LLM Responses ([accounts/services/llm_service.py](accounts/services/llm_service.py))

**`LLMResponse` dataclass extended** with 4 new fields: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`. The 3 provider implementations were updated to populate them:

- **Anthropic:** `resp.usage.input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` — Claude's prompt-cache returns are explicit in the SDK.
- **OpenAI:** `resp.usage.prompt_tokens`, `completion_tokens`, plus `prompt_tokens_details.cached_tokens` if present (newer SDK versions).
- **Gemini:** `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`.

**`tokens_used` is preserved** as the sum for back-compat with anything that still reads it.

**Why this was built:**
1. **Anthropic charges 5× more for output than input** ($15 vs $3 per million). Without the split, we can't compute the actual cost.
2. **Anthropic prompt caching saves 90%** on cache reads. We were paying for cache hits at full rate because we didn't know about them. With the new field, the cost calculator gives us the discounted price.
3. **Gemini cached-content tokens** are similar — they get billed at a fraction of the regular rate.

### 2.7 Diamond Deduction Auto-Fill ([accounts/services/diamond_service.py](accounts/services/diamond_service.py))

`deduct_diamonds(...)` got a new `result=` keyword argument. When you pass an `LLMResponse` (or any object/dict with the right attributes), it auto-fills `provider`, `model_used`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `raw_tokens`, `raw_cost_usd`, `media_count`, `duration_seconds` from the response.

**Caller change** (across `api/caption_views.py`, `api/strategy_views.py`, `api/scheduling_views.py`, `api/views.py`, etc.):
```python
# Before
deduct_diamonds(user=request.user, feature='caption', provider='claude',
                raw_tokens=llm_result.tokens_used if hasattr(llm_result, 'tokens_used') else 0)

# After
deduct_diamonds(user=request.user, feature='caption', result=llm_result)
```

**Why:**
1. **Hardcoded `provider='claude'` was lying** when the LLM service fell back to OpenAI or Gemini. The cost calculator then priced fallback calls at Claude rates — wildly wrong.
2. **Forgetting fields was easy.** A dozen call sites each had to remember to pass `model_used`, `input_tokens`, etc. The auto-fill makes "use the actual response" the path of least resistance.
3. **Backward compatible.** Old call signatures still work; you just get less accurate cost data for anything that doesn't switch to `result=`.

### 2.8 Expanded Prompt Override Coverage ([accounts/models.py](accounts/models.py), [api/admin_views.py](api/admin_views.py))

**`UserPromptOverride.PROMPT_TYPE_CHOICES`** went from 6 entries to 19, organized in 8 groups:
- Ideas (3): `idea_system`, `idea_user`, `idea_regenerate`
- Captions (4): `caption_system`, `caption_user`, `caption_regenerate`, `caption_adapt`
- Images (3): `image_refiner`, `image_product_bg`, `image_product_smart`
- Video (1): `video_prompt`
- Brand DNA (3): `brand_dna`, `brand_dna_website`, `brand_dna_manual`
- Trending (1): `trending_filter`
- Competitors (2): `competitor_analyze`, `competitor_suggest`
- Pillars (1): `pillars_generate`
- Support (1): `support_chat`

`prompt_type` column widened from `max_length=30` to `max_length=50` (some new keys are longer). `PROMPT_TYPE_META` in `admin_views.py` extended with display names + stage descriptions for all 19. `PROMPT_SCHEMA` in `prompt_resolver.py` extended with the variable list each prompt template expects.

**Why this was built:**
1. **The 6 existing types only covered Magic Mode.** Trending filter, competitor analyzer, content pillars generator, support chat — all had hardcoded prompts in the codebase that admins couldn't tune per-user.
2. **Per-user image-prompt customization** matters for product photography where one client wants minimalist white backgrounds and another wants moody lifestyle shots.
3. **Brand DNA has 3 distinct flows** (registration enrichment, full website extraction, manual input enhancement) — each runs a different prompt and each deserves its own override slot.

### 2.9 Payment "Pending" Confirmation Email ([accounts/services/payment_service.py](accounts/services/payment_service.py), [accounts/services/email_service.py](accounts/services/email_service.py))

**What changed:** `submit_payment_request(...)` now also fires `send_payment_pending_email(user, payment_request)` after the admin notification. The user gets a "🎉 We received your payment, our team is verifying" email immediately, with the request ID, amount, plan, and an ETA ("usually within 1 hour during business hours").

**Why:**
1. **Users were anxious after submission.** The previous flow showed the success modal, but if the user closed it, they had no record of what they submitted. An email gives them something to forward to support if approval takes too long.
2. **Email failures don't roll back the request.** Wrapped in try/except — the admin still gets notified, the request is still queued. Belt-and-braces.

### 2.10 Plan-Aware Veo Cost Tracking ([api/views.py VideoGenerateAPIView](api/views.py))

After a Veo video completes, the view now writes a `DiamondTransaction` row with the **actual model used** (returned by the Veo service in `result['model_used']`), the exact `duration` in seconds, `media_count=1`, and `provider='gemini'`. The cost calculator then prices it correctly: e.g. `veo-3.1-generate-preview` at $0.40/sec × 5s = $2.00 — instead of the legacy approximation.

**Why:** The video generation flow was creating videos but not always writing a deduction row for them, which made `VideoGeneration.objects.filter(status='completed').count()` exceed the count of `feature__startswith='video_'` deductions. The admin dashboard then back-filled with an estimate. Now the deduction is always written and the legacy path is just defensive.

### 2.11 New Admin Endpoint: Prompt Execution History ([api/admin_views.py](api/admin_views.py))

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users/<user_id>/prompt-executions/?prompt_type=&page=1&page_size=20` | `AdminPromptExecutionHistoryView` | Paginated history of `PromptExecution` rows for the target user. |

**How it works:** Filters `PromptExecution.objects.filter(user=target_user)` (with optional `prompt_type=`), paginates with simple `offset/limit` slicing, returns rows with the full prompt text + response + metadata. Permission-gated by `IsOriginalAdmin` so impersonation can't bypass it.

**Why:** the frontend execution-history panel needs a way to query this. No reason to baroque it into the existing override-detail endpoint — separation of concerns + clean cache headers.

---

## 3. Models & Migrations

### 3.1 New Models ([accounts/models.py](accounts/models.py))

| Model | Table | Purpose |
| :--- | :--- | :--- |
| `EmailOTP` | `email_otps` | 6-digit codes for first-time signup verification. 60s TTL, 5 wrong-attempt cap, `issue()` invalidates prior unused codes, `verify()` is single-use. |
| `PromptExecution` | `prompt_executions` | Append-only record of every AI prompt sent for a user. Stores prompt + response, model, tokens, latency, success/error, brand context. Indexed on `(user, prompt_type, -created_at)` for fast filtered queries. |

### 3.2 Schema Changes

- **`UserProfile.email_verified`** — `BooleanField(default=False)` — set to True after OTP verification.
- **`DiamondTransaction`** added 5 new columns: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` (all IntegerField default 0), `media_count`, `duration_seconds`.
- **`UserPromptOverride.prompt_type`** widened to `max_length=50`. Same on `PromptOverrideAuditLog.prompt_type`.

### 3.3 Migrations

- `accounts/migrations/0017_add_prompt_execution_extend_override_types.py` — adds `PromptExecution` model + widens `prompt_type` columns + extends `PROMPT_TYPE_CHOICES`.
- `accounts/migrations/0018_add_exact_token_tracking.py` — adds the 5 new columns on `DiamondTransaction`.
- `accounts/migrations/0019_userprofile_email_verified_emailotp.py` — adds `email_verified` flag on `UserProfile` + creates the `EmailOTP` table.

---

## 4. Documentation Added ([docs/](docs/))

### 4.1 [docs/apiModelCost.md](docs/apiModelCost.md)

Full reference doc mapping every model used in the Magic Link flow to its current price. Includes:
- Deprecation warnings (e.g. `claude-sonnet-4-20250514` retiring June 15, 2026).
- Pipeline architecture diagram.
- Per-phase cost table (Brand DNA setup, per-run steps, flow-specific media).
- Per-flow total cost estimates (Flow 1 AI image ~$0.24, Flow 3 video 5s ~$2.04, etc.).
- Verified pricing tables for Anthropic, OpenAI, Google with source links.
- "Code Issues to Fix" section listing files that still reference deprecated models.
- Scale cost estimates (per-run × 100 / 1000 runs/month).

**Why:** the cost calculator's rate tables need a paper trail — when an auditor asks "where did $0.40/sec for Veo come from?" we point at this doc with its link to `ai.google.dev/gemini-api/docs/pricing`.

### 4.2 [docs/promtInMagicLink.md](docs/promtInMagicLink.md)

Maps every Magic Link UI question to the prompts it influences. Format:
- Per-question section (industry / goal / tone / post_type / product_mode / platforms / colors).
- For each: where it's stored, which prompts read it, what variable name it becomes, and which API call it ends up in.

**Why:** when a customer says "I picked 'professional' tone and the AI gave me a casual caption," we need to trace the variable end-to-end. This doc is the trace map.

---

## 5. File Summary

| Component | Key Files |
| :--- | :--- |
| **Email OTP** | [accounts/models.py](accounts/models.py) (`EmailOTP`, `UserProfile.email_verified`), [accounts/services/email_service.py](accounts/services/email_service.py) (new — `send_otp_email`/`send_welcome_email`/`send_payment_pending_email`), [accounts/migrations/0019_*.py](accounts/migrations/0019_userprofile_email_verified_emailotp.py), [api/views.py](api/views.py) (`VerifyOTPView`, `ResendOTPView`, `RegisterView`/`OnboardCompleteView`/`LoginView` rewrites), [api/urls.py](api/urls.py) (2 new routes), [frontend/src/components/auth/AuthModal.tsx](frontend/src/components/auth/AuthModal.tsx) (OTP screen + countdown + resend) |
| **Cost calculator** | [accounts/services/cost_calculator.py](accounts/services/cost_calculator.py) (new — rate tables + 3 calc paths), [docs/apiModelCost.md](docs/apiModelCost.md) (new — verified pricing reference) |
| **Exact token tracking** | [accounts/models.py](accounts/models.py) (`DiamondTransaction` 5 new cols), [accounts/migrations/0018_*.py](accounts/migrations/0018_add_exact_token_tracking.py), [accounts/services/llm_service.py](accounts/services/llm_service.py) (`LLMResponse` 4 new fields + 3 provider populators), [accounts/services/diamond_service.py](accounts/services/diamond_service.py) (`deduct_diamonds(result=)` auto-fill) |
| **Auto-calculated finance** | [api/finance_views.py](api/finance_views.py) (`FinanceSummaryView` blend + `AutoExpensesView` new), [api/admin_views.py](api/admin_views.py) (`AdminDashboardView` switched to calculator), [api/urls.py](api/urls.py) (1 new route), [frontend/src/services/financeService.ts](frontend/src/services/financeService.ts) (6 new types + `getAutoExpenses`), [frontend/src/pages/admin/AdminFinancePage.tsx](frontend/src/pages/admin/AdminFinancePage.tsx) (Auto API Costs tab + `AutoExpensesPanel` component) |
| **Prompt execution history** | [accounts/models.py](accounts/models.py) (`PromptExecution`), [accounts/migrations/0017_*.py](accounts/migrations/0017_add_prompt_execution_extend_override_types.py), [accounts/services/prompt_resolver.py](accounts/services/prompt_resolver.py) (`save_execution` + `return_meta`), [api/admin_views.py](api/admin_views.py) (`AdminPromptExecutionHistoryView` + extended `PROMPT_TYPE_META`), [api/urls.py](api/urls.py) (1 new route), [api/strategy_views.py](api/strategy_views.py) + [api/trending_service.py](api/trending_service.py) (call-site wiring), [frontend/src/services/adminPromptService.ts](frontend/src/services/adminPromptService.ts) (16 new prompt types + `executionHistory` method), [frontend/src/pages/admin/AdminUserDetailPage.tsx](frontend/src/pages/admin/AdminUserDetailPage.tsx) (history panel with filter + pagination + expand) |
| **Expanded prompts** | [accounts/models.py](accounts/models.py) (`UserPromptOverride.PROMPT_TYPE_CHOICES` 6→19), [accounts/services/prompt_resolver.py](accounts/services/prompt_resolver.py) (`PROMPT_SCHEMA` extended), [api/admin_views.py](api/admin_views.py) (`PROMPT_TYPE_META` extended) |
| **Caller refactors** | [api/caption_views.py](api/caption_views.py), [api/strategy_views.py](api/strategy_views.py), [api/scheduling_views.py](api/scheduling_views.py), [api/views.py](api/views.py) — switched to `deduct_diamonds(result=...)` for accurate cost tracking |
| **Payment pending email** | [accounts/services/payment_service.py](accounts/services/payment_service.py) (fires after submit), [accounts/services/email_service.py](accounts/services/email_service.py) (`send_payment_pending_email`) |
| **Documentation** | [docs/apiModelCost.md](docs/apiModelCost.md), [docs/promtInMagicLink.md](docs/promtInMagicLink.md) |

---

## 6. Out of Scope (Deferred)

- **PromptExecution retention/purge** — the model has 90-day retention noted in its docstring but the management command isn't written yet. Disk will fill if not addressed.
- **Wiring `save_execution` everywhere** — only strategy_views and trending_service are wired. Caption views, image refiner, brand DNA, video prompt builder, and support chat still need migration to record their executions.
- **Provider-rate sync from upstream** — rates in `cost_calculator.py` are manually maintained from `apiModelCost.md`. A scheduled scraper that flags outdated rates would prevent drift.
- **`claude-sonnet-4-20250514` migration** — `apiModelCost.md` flags this as deprecated June 15, 2026; the LLM service still defaults to it. Needs a config/code update before the deadline.
- **Email infrastructure hardening** — current SMTP setup is Gmail-relay style. For production volume we'd want SendGrid/Postmark with bounce handling, OTP delivery SLA monitoring, and DKIM/DMARC.
- **OTP rate limiting** — `resend-otp/` has no per-IP throttle. A bored actor could enumerate user_ids and trigger emails. Needs a Django ratelimit decorator.
- **User-facing prompt execution view** — currently admin-only. Power users on Business/Enterprise might want to see their own AI prompts for transparency.
