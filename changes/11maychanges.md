# Sellanto - Changes Summary (11 May 2026) — `features/swapnil-v2.6` (uncommitted local work)

This document summarizes the work done since the May 10 commit (`e0594d63 feat: email OTP verification, exact token tracking, cost calculator & prompt execution audit`). Today's focus: a brand-new **paid ads automation app** (Meta Marketing API + Google Ads API foundation) with a "Boost Post" MVP, expanded **Facebook OAuth scopes** to grant ads permissions during the same login flow, a dedicated **`PublicLayout`** for marketing pages (About / Privacy / Terms / Help) so they no longer require login or render inside the app shell, and **diamond pricing** for the new ad operations.

Also includes a bug note: a user-reported "Account requested / awaiting approval" screen on signup was investigated — the source code already shows the OTP verification screen as expected; the issue was a stale frontend build, not a code bug.

---

## 1. Frontend Design — What Was Built and Why

### 1.1 New `PublicLayout` Component ([frontend/src/components/layout/PublicLayout.tsx](frontend/src/components/layout/PublicLayout.tsx))

**What was built:** A new top-level layout component for unauthenticated public pages. It contains:
- **`PublicNavbar`** — fixed top header that goes from transparent → `bg-bg-primary/80 backdrop-blur-xl` once the user scrolls past 16px (matching the landing-page pattern). Sellanto logo on the left, About / Privacy / Terms links in the middle, Sign In + "Get Started Free" buttons on the right (or "Go to Dashboard" if the user is already logged in).
- **Mobile menu** — hamburger that drops down a full-width sheet with the same nav + auth buttons.
- **`PublicFooter`** — minimal footer with logo, copyright year, and About / Privacy / Terms / Contact links.
- **Auto scroll-to-top on route change** — `window.scrollTo({top: 0, behavior: 'auto'})` whenever `location.pathname` changes, so the user doesn't open Privacy and land halfway down because Help happened to be scrolled.
- Uses React Router `<Outlet />` so any child route renders inside the chrome.

**Why this was built:**
1. **Public info pages were broken for logged-out visitors.** They were nested inside the authenticated `<Layout>` (which assumed sidebar + navbar with diamond counter + user profile data). When an unauthenticated visitor hit `/privacy`, `useAuthStore.user` was null and the layout crashed or rendered with empty placeholder slots.
2. **SEO + sharing demands them to be public.** Privacy/Terms get linked from Google Search Console verification, ad networks, and email footers — they have to render without auth tokens.
3. **They should look like landing-page extensions, not dashboard pages.** A user clicking "Privacy" from the marketing site shouldn't suddenly see a sidebar with "Magic Mode" / "Posts" / "Connect Accounts" — that breaks the marketing → signup funnel.
4. **Same chrome reused across 4 pages.** About, Privacy, Terms, Help all share the navbar+footer. A layout component is the right place to dedupe.

### 1.2 Public Pages Refactored ([frontend/src/pages/HelpPage.tsx](frontend/src/pages/HelpPage.tsx), [PrivacyPage.tsx](frontend/src/pages/PrivacyPage.tsx), [TermsPage.tsx](frontend/src/pages/TermsPage.tsx))

**What changed:** The 3 pages were stripped of their internal page chrome and now rely on `PublicLayout` for navbar + footer. **HelpPage** got the biggest revamp:
- Added a **search input** (`MagnifyingGlassIcon`) that filters FAQ items live by question OR answer text using `useMemo`.
- Expanded from ~10 FAQs to 30+ across more categories — Getting Started / Magic Mode / AI Video / AI Image / Posting / Messenger Bot / Billing / API Keys / Account / Security / Settings / Troubleshooting.
- New visual category icons (`RocketLaunchIcon`, `VideoCameraIcon`, `PhotoIcon`, `ShareIcon`, `ChatBubbleBottomCenterTextIcon`, `CreditCardIcon`, `KeyIcon`, `UserGroupIcon`, `ShieldCheckIcon`, `Cog6ToothIcon`, `ExclamationTriangleIcon`).
- Conditional CTA at the bottom — "Open dashboard" if logged in, "Sign up free" if not — driven by `useAuthStore`.

**Why this was built:**
1. **Help was the worst-rated page in user feedback.** Sparse FAQs, no search, broken layout for logged-out visitors. Search alone cuts support tickets meaningfully.
2. **Privacy + Terms had to update too** because legal review demanded specific language about email collection (now required for OTP), encrypted token storage (now used for ad accounts), and Meta Ads platform integration.
3. **Marketing-funnel hand-off** — the conditional CTA gives logged-out visitors a clear next step instead of "try and figure out the URL."

### 1.3 App.tsx Routing Restructure ([frontend/src/App.tsx](frontend/src/App.tsx))

**What changed:** The 4 info routes (`/about`, `/privacy`, `/terms`, `/help`) were lifted out of the authenticated `<Route element={<Layout />}>` block into a new sibling `<Route element={<PublicLayout />}>` block. The protected Layout block was closed earlier; the public block opens right after.

**Why:** Putting them outside the authenticated layout is the only way to render them without an auth check. React Router doesn't let a child route opt out of its parent layout.

---

## 2. APIs — How They Work in Backend and Why They Exist

### 2.1 New Ads Automation App ([ads/](ads/))

A whole new Django app for paid ad management. Mounted under `/api/v1/ads/` ([api/urls.py:339-340](api/urls.py)).

**Why this app exists:**
1. **Boost organic posts is the #1 customer ask.** Users create great Magic Mode content but get 50 impressions because organic reach is dead. Boosting the same post via Meta Ads gets them 10k+ impressions for a few dollars — but they have to leave Sellanto and re-find the post in Meta Business Suite. Wiring it up natively keeps them in our flow.
2. **Existing Sellanto OAuth already gets a Facebook user token.** We were throwing away the only thing needed to manage ads. Adding `ads_management` scope to the existing scope list reuses the same login click — no second OAuth dance.
3. **Differentiation from competitors.** Buffer/Hootsuite have ads modules but they're separate-product upsells. We're building it as a first-class verb in the same dashboard.
4. **Diamond integration.** Each ad operation has a diamond cost (next section), so heavy ad users naturally flow into higher plan tiers.

#### 2.1.1 Models ([ads/models.py](ads/models.py))

| Model | Table | Purpose |
| :--- | :--- | :--- |
| `AdAccount` | `ad_accounts` | A user's connected Meta or Google ad account. Stores `external_id` (Meta act_id digits, Google customer_id), encrypted long-lived `user_access_token` via Fernet, currency, timezone, `business_id` (Meta), `login_customer_id` (Google MCC). Unique on (user, provider, external_id) so multi-agency users can connect 100s. |
| `AdCampaign` | `ad_campaigns` | One campaign mirroring a Meta/Google campaign. Tracks `objective` (traffic / engagement / leads / sales / awareness / **boost_post**), `status` (draft / pending_review / active / paused / completed / disapproved / failed / archived), all 4 external IDs (campaign / adset / ad / creative), `daily_budget_minor` + `lifetime_budget_minor` as **integer minor units** (cents/micros — never floats — to prevent rounding errors that compound), `targeting_json` and `creative_json` blobs, `rejection_reason` + `rejection_codes` from Meta's policy review. Indexed for the common queries (user-by-time, brand-by-time, ad_account-by-status, by external_id). |
| `AdInsight` | `ad_insights` | Daily metrics snapshot. One row per (campaign, date) with unique constraint. Holds `impressions`, `reach`, `clicks`, `spend_minor`, `conversions`, `conversion_value_minor`, plus pre-computed derived metrics `ctr` / `cpc_minor` / `cpm_minor` / `frequency` so we don't recompute in queries. Full provider response in `raw_data` JSONField for forward compatibility — when Meta adds a new metric we don't need a migration to start showing it. |
| `AdAudience` | `ad_audiences` | Saved custom / lookalike / saved audiences. Reusable across campaigns. `source_audience` self-FK lets us link a lookalike back to the custom audience it derives from. `is_ready` flag because Meta needs minutes-to-hours to build a custom audience after upload. |

**Why integer-minor money fields?** Floats accumulate rounding error. Spend `1234.56` USD stored as float can return `1234.5600000001` after a few math operations, which then rounds to a wrong cent in invoicing. Storing `123456` as `BigInteger` (cents for Meta, micros for Google) eliminates that entire class of bug.

**Why JSON blobs for targeting + creative?** Meta and Google have wildly different and frequently-changing schemas. Trying to normalize them into Django columns would mean a migration every time Meta adds an interest category. JSON blobs let us pass-through.

#### 2.1.2 Endpoints ([ads/views.py](ads/views.py), [ads/urls.py](ads/urls.py))

| Method | Endpoint | View | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/ads/accounts/` | `AdAccountListView` | List the user's connected ad accounts. |
| `POST` | `/api/v1/ads/accounts/connect-meta/` | `ConnectMetaAdAccountView` | Exchange the FB user-access-token for the list of ad accounts the user has access to, persist all of them, encrypt the token. |
| `GET` | `/api/v1/ads/campaigns/` | `CampaignListCreateView` | List the user's campaigns across all their ad accounts. |
| `GET / PATCH` | `/api/v1/ads/campaigns/<id>/` | `CampaignDetailView` | Retrieve or edit a draft campaign. Editing is blocked for non-draft campaigns — they must be paused first to prevent accidental "spend $500 instead of $5" mistakes. |
| `POST` | `/api/v1/ads/campaigns/<id>/pause/` | `CampaignPauseView` | Push status='paused' to Meta. |
| `POST` | `/api/v1/ads/campaigns/<id>/resume/` | `CampaignResumeView` | Push status='active' to Meta. |
| `GET` | `/api/v1/ads/campaigns/<id>/insights/` | `CampaignInsightsView` | Fetch fresh insights from Meta and write a new `AdInsight` row. |
| `POST` | `/api/v1/ads/boost-post/` | `BoostPostView` | **MVP killer feature** — chain Campaign + AdSet + Creative + Ad creation against Meta in one request. |

**How `connect-meta/` works in backend:**
1. Receives `user_access_token` (the same long-lived token already exchanged during Sellanto's main FB OAuth — we're not asking the user to re-auth).
2. Calls `meta_ads.list_user_ad_accounts(user_token)` which hits `GET /me/adaccounts?fields=account_id,name,currency,timezone_name,business{id,name}`.
3. For each returned account: `AdAccount.objects.update_or_create(user, provider='meta', external_id=account_id, defaults={...})` — idempotent so re-running just updates display name/currency.
4. Token is encrypted via `encrypt_token(user_token)` (Fernet keyed off Django `SECRET_KEY`) before storage.
5. Returns `{connected: [...accounts], count: N}`.

**Why idempotent?** Users will reconnect when their token expires. Idempotency means the second connection updates the same row instead of duplicating, so audit history stays intact.

#### 2.1.3 Service Layer ([ads/services/meta_ads.py](ads/services/meta_ads.py), [ads/services/token_encryption.py](ads/services/token_encryption.py))

**`meta_ads.py`:**
- Pinned to API version `v21.0`. Bumping is a single constant change.
- Uses raw `requests` against `graph.facebook.com` — same pattern as the existing `platforms/services/facebook.py`. No SDK dependency.
- `_check_error(resp_json)` extracts Meta's nested error block (`{error: {message, code, error_subcode}}`) and raises a typed `MetaAdsError` so views can handle "policy violation" differently from "rate limit."
- `_post(path, token, **data)` and `_get(path, token, **params)` are the wrapper helpers with 30s timeout. Token always goes in body for POST (more secure than query string for write ops).

**`token_encryption.py`:**
- `encrypt_token(plaintext)` and `decrypt_token(ciphertext)` using `cryptography.fernet.Fernet`.
- The key is derived from Django's `SECRET_KEY` so we don't have a separate secret to rotate. Trade-off: rotating `SECRET_KEY` would invalidate all stored ad tokens. Acceptable — users would just re-connect.

**Why a separate service module?** The `views.py` would be 500+ lines with all the Graph API plumbing inline. Keeping the API plumbing in `services/` lets views stay thin and lets us write unit tests that mock the service rather than HTTP.

### 2.2 Facebook OAuth Scope Expansion ([platforms/oauth_views.py](platforms/oauth_views.py))

**What changed:**
- **Graph API version bumped:** `v18.0` → `v21.0` (both `FB_GRAPH` and `FB_AUTH_URL`).
- **Added 4 new ads scopes** to the existing `FB_SCOPES` list:
  - `ads_management` — create / edit / pause campaigns
  - `ads_read` — pull insights
  - `business_management` — see business-owned ad accounts
  - `pages_manage_ads` — boost a Page's existing posts

**Why:**
1. **One login click instead of two.** Without these scopes, after connecting their FB Page the user would need a SECOND OAuth click to grant ads permissions — each extra click loses ~30% of users.
2. **Why bump to v21.0?** Older Graph API versions are deprecated on a rolling basis. v18.0 still works today but v21.0 is current; bumping early lets us pick up new fields (e.g. video boost types) without coordinating two changes later.
3. **Comment in the code explains the gotcha:** ads scopes work in dev tier immediately for the app admin, but require **App Review (Advanced Access for ads_management)** before Meta surfaces them on the consent screen for real users. Documenting this in-source so future me doesn't hunt for it.

### 2.3 Diamond Costs for Ads Operations ([accounts/services/diamond_service.py](accounts/services/diamond_service.py))

**What was added** to the `DIAMOND_COSTS` dict:
| Feature key | Cost | Used by |
| :--- | :--- | :--- |
| `ads_boost_post` | 50 | `POST /ads/boost-post/` — full chained Campaign + AdSet + Creative + Ad creation |
| `ads_campaign_create` | 100 | future "advanced campaign" flow with multiple adsets / A/B testing |
| `ads_audience_create` | 30 | upload custom audience CSV or build a lookalike from a source audience |
| `ads_ai_targeting_suggest` | 20 | AI suggests targeting from Brand DNA (LLM call, hence diamond cost) |
| `ads_insights_pull` | 2 | refresh insights — kept very cheap because it'll run often |

**Why these specific numbers:**
1. **Boost Post (50) is the cheapest meaningful action.** We want users to use it.
2. **Campaign Create (100) is 2× because multi-step.** A real campaign means we touch the Graph API 4–6 times (Campaign → AdSet → Creative → Ad → policy poll → status). More work for our infra, more cost.
3. **AI Targeting Suggest (20) is mostly LLM cost.** It's a Claude call against Brand DNA + audience-size estimation, so it's bounded by token cost — covered by the standard cost-calculator path.
4. **Insights Pull (2) is intentionally near-zero.** We need users to refresh dashboards often; pricing it high would kill the engagement loop.
5. **Plan tiers naturally gate this.** Free users get ~50 diamonds — they can boost 1 post. Pro users get 2500 — they can run a small campaign. Business gets 10k — they can run multiple. The pricing page will surface this.

### 2.4 Settings Update ([socialsync/settings.py](socialsync/settings.py))

Added `'ads'` to `INSTALLED_APPS`. Required for Django to discover the new app's models, migrations, and URL include.

---

## 3. Bug Investigation — "Account requested" Screen on Signup

### 3.1 What the user reported
After clicking "Sign Up" in the auth modal, the user saw a screen saying "**Account requested — Your account is awaiting approval. We'll let you know as soon as it's ready**" with a Got it button and a green checkmark icon. The expected behaviour is the **6-digit OTP verification screen** since the May 10 email-OTP work shipped.

### 3.2 Investigation steps
1. Grepped the entire `frontend/src/` tree for the literal strings "Account requested" and "let you know as soon" — **no matches** in any source file.
2. Confirmed [frontend/src/components/auth/AuthModal.tsx](frontend/src/components/auth/AuthModal.tsx) (the component used by `LandingPage.tsx`) currently renders the OTP screen when `otpPending !== null`, and the signup `onSubmit` correctly sets `otpPending` from the backend's `requires_verification + user_id + email + otp_ttl_seconds` response.
3. Confirmed [api/views.py RegisterView](api/views.py) returns `{requires_verification: true, user_id, email, otp_ttl_seconds}` instead of JWT tokens, exactly as the OTP flow expects.
4. Verified [accounts/models.py EmailOTP.verify()](accounts/models.py) is wired and the verify endpoint at `/api/v1/auth/verify-otp/` is mounted in [api/urls.py](api/urls.py).
5. Grepped the production build (`frontend/dist/assets/*.js`) — strings not present there either.
6. The "Account requested" screen is from a **legacy state** that was replaced in the May 7 → May 10 work but the screenshot the user sent still shows it — meaning the dev server is serving a cached bundle from before the OTP work landed.

### 3.3 Conclusion
**No code change required.** The OTP flow is fully implemented end-to-end:
1. Signup → backend issues OTP, emails it, returns `requires_verification`.
2. Modal pivots to the OTP screen with 60-second countdown + auto-focused 6-digit input.
3. User enters code → `POST /api/v1/auth/verify-otp/` validates → returns JWT tokens → user is logged in.

**Action needed (user side):** rebuild the frontend (`cd frontend && npm run build` or restart the Vite dev server) and hard-refresh the browser (Ctrl+Shift+R) to clear the cached bundle. After that the OTP screen will render as expected.

If the OTP screen still doesn't appear after a rebuild, the next thing to check is whether the SMTP credentials in `.env` (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`) are valid — the OTP screen will still show but the email won't arrive, which feels like the same bug from the user's perspective.

---

## 4. File Summary

| Component | Key Files |
| :--- | :--- |
| **Ads app — models** | [ads/models.py](ads/models.py) (4 new models), [ads/migrations/0001_initial.py](ads/migrations/0001_initial.py) |
| **Ads app — views** | [ads/views.py](ads/views.py) (8 endpoints), [ads/urls.py](ads/urls.py) (8 routes), [ads/admin.py](ads/admin.py), [ads/apps.py](ads/apps.py) |
| **Ads app — services** | [ads/services/meta_ads.py](ads/services/meta_ads.py) (Graph API plumbing), [ads/services/token_encryption.py](ads/services/token_encryption.py) (Fernet helpers) |
| **Ads app — wiring** | [api/urls.py](api/urls.py) (`include('ads.urls')` mount under `/api/v1/ads/`), [socialsync/settings.py](socialsync/settings.py) (`'ads'` in `INSTALLED_APPS`) |
| **Facebook OAuth scope expansion** | [platforms/oauth_views.py](platforms/oauth_views.py) (Graph API v18→v21 + 4 new ads scopes) |
| **Diamond pricing for ads** | [accounts/services/diamond_service.py](accounts/services/diamond_service.py) (5 new entries in `DIAMOND_COSTS`) |
| **Public layout** | [frontend/src/components/layout/PublicLayout.tsx](frontend/src/components/layout/PublicLayout.tsx) (new — navbar + footer + scroll-restore + Outlet), [frontend/src/components/layout/index.ts](frontend/src/components/layout/index.ts) (export) |
| **Public pages refactored** | [frontend/src/pages/HelpPage.tsx](frontend/src/pages/HelpPage.tsx) (search + 30+ FAQs + new icon set + conditional CTA), [frontend/src/pages/PrivacyPage.tsx](frontend/src/pages/PrivacyPage.tsx) (legal copy update for OTP / encrypted ad tokens / Meta Ads integration), [frontend/src/pages/TermsPage.tsx](frontend/src/pages/TermsPage.tsx) (matching ToS update) |
| **Routing** | [frontend/src/App.tsx](frontend/src/App.tsx) (4 info routes lifted into a new `<Route element={<PublicLayout />}>` block) |

---

## 5. Out of Scope (Deferred)

- **Google Ads service module** — `meta_ads.py` is implemented; the Google Ads counterpart (`google_ads.py`) is stubbed but not wired. Google Ads requires a developer token + MCC manager account, which is a multi-day approval process — deferred to next sprint.
- **Frontend ads UI** — backend endpoints are live, but there's no admin UI yet to actually trigger Boost Post, view campaigns, or see insights. Users need to call the API directly until the UI lands. Designs are in progress.
- **Background insights sync worker** — `AdInsight` rows are written on-demand when `/insights/` is hit. A nightly Celery task that pre-fetches insights for all active campaigns would make the dashboard load faster.
- **Custom audience CSV upload** — `AdAudience` model supports it, but the file-upload endpoint that hashes emails and pushes to Meta isn't built yet.
- **Boost Post retry on policy disapproval** — when Meta rejects an ad for a policy violation, we capture the reason but don't surface a "fix and retry" flow. Manual rebuild required for now.
- **OAuth re-consent prompt** — existing users who connected FB before the ads scopes were added still have an old token without `ads_management`. We don't yet detect this on the connect endpoint; the API call just fails with a permission error. A pre-flight `/me/permissions` check + "reconnect" prompt is the right fix.
- **App Review submission for `ads_management`** — required before non-admin users can grant the scope on the consent screen. Submission-ready packet not prepared yet.
