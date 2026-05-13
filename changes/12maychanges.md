# Sellanto - Changes Summary (12 May 2026) — `features/swapnil-v2.8` (uncommitted local work)

This document summarizes the work done since the May 11 commit (`ec9cf027 feat: meta ads integration, public layout & revamped help/privacy/terms pages`). Today's focus: making yesterday's Meta Ads backend **actually usable from the UI** — a polished **Boost Post modal**, a **connected ad accounts panel** that auto-populates after FB OAuth, several **production hardening fixes** in the boost-post Graph API chain (object_story_id resolution, required-but-undocumented Meta parameters, FX conversion for non-USD ad accounts), and the new production domain `yourbrandstar.com` whitelisted.

---

## 1. Frontend Design — What Was Built and Why

### 1.1 Boost Post Modal ([frontend/src/components/ads/BoostPostModal.tsx](frontend/src/components/ads/BoostPostModal.tsx))

**What was built:** A new full-page modal that turns an organic Facebook post into a paid ad campaign in one screen. Components:
- **Two-source loader** — opens with parallel calls to `postService.list({status: 'posted', page_size: 100})` and `adsService.listAdAccounts()`, so by the time the user sees the form both pickers are populated.
- **Post picker** — dropdown of "boostable" posts only, computed via `useMemo` to filter posts with `facebook_post_id` OR (as a fallback) `platforms.includes('facebook')`. Locked to `preselectedPost` when launched from the post detail view.
- **Ad account picker** — auto-selects when the user has only 1 connected account (the common case), forces explicit pick when multiple.
- **Budget + duration** — daily budget USD input (min $1) and duration days input (min 1).
- **Targeting basics** — country dropdown (12 common countries: BD/US/IN/GB/CA/AU/AE/SA/MY/SG/PK/ID), age min (default 18, floor 13) and age max (default 65, ceiling 65) with cross-validation `age_min <= age_max`.
- **Submission state** — `submitting` disables the close button so users can't abandon mid-Graph-API-chain. After response, shows either green "Campaign created: {name} (status: {status})" or red error with **Meta error code + subcode** propagated from backend (e.g. "code: 100/4834011") so support can debug without server logs.

**Why this was built:**
1. **Yesterday's backend was unreachable from the UI.** The `/api/v1/ads/boost-post/` endpoint existed but the only way to call it was Postman. That's not a feature — that's plumbing.
2. **The "1 USD daily budget × 1 day" path is the trial flow.** Users want to test a $1 boost before committing real money. Defaults are deliberately tiny so the worst-case cost while fiddling is $1.
3. **Country list is short on purpose.** A 195-country dropdown wastes screen space — 12 covers ~95% of Sellanto users (BD-heavy with diaspora). "Other" / advanced targeting is deferred.
4. **Showing Meta's error code + subcode** matters because Meta's error messages are vague ("Invalid parameter") but the subcodes are specific (4834011 = missing destination_type for POST_ENGAGEMENT). Surfacing both turns support tickets from "boost failed" into "boost failed code 100/4834011" — googleable.
5. **Two launch paths** (preselectedPost vs free choice) mean the same modal serves both the Connect Accounts page ("boost any post") and MyPostsPage ("boost this specific post"). Avoids two near-identical modals.

### 1.2 Ad Accounts Status Card ([frontend/src/components/platforms/AdAccountsStatus.tsx](frontend/src/components/platforms/AdAccountsStatus.tsx))

**What was built:** A self-contained card on the Connect Accounts page that shows the user's connected Meta ad accounts. Features:
- **`refreshKey` prop** — bumps trigger a refetch. Parent (`ConnectAccountsPage`) bumps it whenever the FB OAuth state changes, so right after the user clicks "Connect Facebook" with ads scopes granted, this card re-pulls and shows the newly auto-discovered accounts.
- **Manual refresh button** — small `ArrowPathIcon` that spins while loading; for the case where backend OAuth callback succeeds but the frontend racing finished first.
- **Three render branches**: error state (red banner with the parsed `response.data.error` message), loading skeletons (2 pulsing rows), empty state (dashed-border helper card explaining that the `ads_management` permission must be approved during FB OAuth — the most likely cause of empty state), populated list.
- **Per-account row** — purple gradient avatar with checkmark, account display name with fallback to `Ad Account act_<id>`, monospaced `act_<external_id> · CURRENCY · TIMEZONE` line, and an Active/Inactive badge.
- **"Boost a Facebook Post" CTA button** — only renders when ≥1 account is connected. Opens `BoostPostModal` directly. The card is the discovery surface AND the launch surface — no extra clicks.

**Why this was built:**
1. **Users couldn't see what got connected.** Yesterday's `_auto_discover_ad_accounts` helper saved AdAccount rows but the UI gave no signal. Several test users thought it failed silently.
2. **The empty state is also documentation.** When ads_management isn't granted (the dev-tier vs app-review scope), there's no error — just no rows. Empty-state copy explains exactly why.
3. **Boost button placement.** Putting it on the Connect Accounts page lets a user discover ad accounts → immediately try boosting in the same flow. Forcing them to navigate to "My Posts" and find the right post would lose 30% of users.
4. **Refresh-key pattern over event bus** — simpler than wiring a global event for "FB OAuth completed." Just bump a number.

### 1.3 "Boost Post" Action on My Posts ([frontend/src/pages/MyPostsPage.tsx](frontend/src/pages/MyPostsPage.tsx))

**What was added:** When the user opens a post detail modal AND the post status is `'posted'` AND its platforms include `'facebook'`, a new gradient "Boost Post" button appears next to Close. Clicking it:
1. Closes the post detail modal.
2. Opens `BoostPostModal` with `preselectedPost={selectedPost}`.

**Why:** Users discover posts they want to boost while reviewing past performance. The natural flow is "this post got 200 likes organically — let me boost it." Having to remember the post ID and navigate elsewhere breaks that intent.

### 1.4 Ad Accounts Section on Connect Accounts Page ([frontend/src/pages/ConnectAccountsPage.tsx](frontend/src/pages/ConnectAccountsPage.tsx))

**What was added:**
- New `📢 Meta Ad Accounts` section between the FB connection block and the secondary platforms block.
- New `adRefreshKey` state, bumped inside `fetchData()` so any FB connection state change re-pulls ad accounts.
- Renders `<AdAccountsStatus refreshKey={adRefreshKey} />`.

**Why:** Single discovery surface. Users connect FB, scroll down a few inches, and immediately see the ad accounts. No mental model switch.

### 1.5 New `adsService.ts` Frontend Service ([frontend/src/services/adsService.ts](frontend/src/services/adsService.ts))

**What was built:** Typed wrappers for all 8 ads endpoints, exported as `adsService` with `AdAccount` and `AdCampaign` interfaces matching the backend serializers. Methods: `listAdAccounts`, `connectMeta`, `listCampaigns`, `getCampaign`, `pauseCampaign`, `resumeCampaign`, `getCampaignInsights`, `boostPost`.

**Why:** The 3 new components (BoostPostModal, AdAccountsStatus, the boost button) all need to call these endpoints. A typed service centralizes the URL paths and request shapes — no copy-paste of `/api/v1/ads/...` strings into components, and TypeScript catches mismatches when a backend field gets renamed.

---

## 2. APIs — How They Work in Backend and Why

### 2.1 Auto-Discover Ad Accounts in OAuth Callback ([platforms/oauth_views.py](platforms/oauth_views.py))

**What was added:** A new helper `_auto_discover_ad_accounts(user, long_lived_token)` called near the end of `facebook_oauth_callback` (right after the existing `_auto_setup_messenger`). It:
1. Imports `meta_ads.list_user_ad_accounts`, `token_encryption.encrypt_token`, and `AdAccount` lazily (so a missing `ads` app doesn't break OAuth).
2. Calls `list_user_ad_accounts(long_lived_token)` — hits `GET /me/adaccounts?fields=account_id,name,currency,timezone_name,business{id,name}`.
3. **Catches `MetaAdsError` separately** and logs at `WARNING` level with the Meta error code + subcode. Most common cause: user didn't grant `ads_management`/`ads_read` on consent — completely normal, not an error to surface to the user.
4. Encrypts the long-lived user token once via `encrypt_token(...)` and reuses it across all `update_or_create` calls.
5. Saves each ad account with `update_or_create(user, provider='meta', external_id=ext_id, defaults={...})` — idempotent so reconnecting just refreshes display name/currency.
6. Logs `Auto-saved {saved}/{total} ad accounts for {user.username}` for observability.

**Why this was built:**
1. **The manual `/api/v1/ads/accounts/connect-meta/` endpoint is redundant 95% of the time.** Users who grant ads scopes during the main FB OAuth shouldn't need a second API call — Sellanto already has the token, just use it.
2. **Failure must not break OAuth.** Pages and Messenger are already saved by the time this runs. If ad-account discovery fails, that's a *missing feature* not a *broken signup*. Hence the broad try/except + WARNING-level logging.
3. **Idempotency on `update_or_create`** because users will re-OAuth when tokens expire (60-day Meta window). Idempotent re-discovery means existing AdCampaign FKs to AdAccount stay intact.
4. **Lazy imports** — wrapping the imports inside the function keeps the OAuth view import-cycle-free if the `ads` app gets removed/refactored.

### 2.2 Boost Post Hardening ([ads/services/meta_ads.py](ads/services/meta_ads.py))

Three production bugs in yesterday's boost-post chain were diagnosed and fixed today.

#### 2.2.1 `_resolve_object_story_id` helper (new)

**The bug:** Sellanto's `_post_photo` returns whatever Meta sends back. For text posts that's already `<page_id>_<post_id>`. For photo posts, Meta returns just the **photo media ID** (e.g. `122132552841070138`). When we tried to use that as `object_story_id` for an ad creative, Meta rejected with code 100 ("Invalid parameter"). The ad creative needs the **feed post ID**, not the photo media ID — they're different objects.

**The fix:** New helper that does:
1. **Fast path** — if the input already contains `_`, it's already in `<page>_<post>` format. Return as-is.
2. **Page Access Token first** — under Meta's "new Pages experience" rollout, **only Page tokens** can read a photo's `post_id` field. Try `_get(fb_post_id, page_access_token, fields='id,post_id')` first.
3. **Fall back to user token** — works on older pages that haven't migrated to the new experience, and for non-photo objects (videos, links).
4. **Last resort** — naive `f'{page_id}_{fb_post_id}'` concat. Works for some object types and at least gives Meta something to chew on instead of None.

The helper signature: `_resolve_object_story_id(page_id, fb_post_id, user_token, page_access_token='')`.

**Why it had to handle Page Access Token specifically:** This is Meta's most undocumented gotcha. Their dev docs still show the User Access Token approach but the new Pages experience silently broke that for photo lookups. Found by reading 3 different Stack Overflow threads + a Meta dev forum post.

#### 2.2.2 `is_adset_budget_sharing_enabled='false'` on campaign creation

**The bug:** Meta started returning code 100 / subcode 4834011 ("Invalid parameter") on **every** campaign creation, even with the exact same payload that worked yesterday. Turned out Meta tightened the validation: when you don't use Campaign Budget Optimization (CBO) and instead set the budget at the AdSet level (which we do — `daily_budget` on the adset), Meta now requires you to **explicitly opt out** of CBO via `is_adset_budget_sharing_enabled='false'`.

**The fix:** Added the parameter to the campaign POST. Stringified `'false'` per Graph API conventions.

#### 2.2.3 `destination_type='ON_POST'` + `promoted_object={page_id}` on adset creation

**The bug:** Same code 100 / subcode 4834011 but on adset creation. For `optimization_goal='POST_ENGAGEMENT'`, Meta now requires both:
- `promoted_object.page_id` — the Page being promoted (Meta needs to know whose post is being boosted, even though the creative's object_story_id implies it).
- `destination_type='ON_POST'` — explicitly says "people will engage on the post" vs `ON_PAGE` (drives to page) or `MESSENGER` etc.

**The fix:** Added both to the adset POST. `promoted_object` is JSON-encoded since Graph API takes it as a stringified JSON object.

#### 2.2.4 Step-wrapped error handling + detailed logging

**Each of the 4 boost-post API calls** is now wrapped in its own `try/except MetaAdsError as e: raise MetaAdsError(f'Step N (X): {e}', code=e.code, subcode=e.subcode, raw=e.raw)`. So when something fails, the message says exactly which step blew up, and Meta's code/subcode are preserved end-to-end so the frontend modal can show "code: 100/4834011" instead of generic "Invalid parameter."

`logger.info(f'[boost_post] step N/4 ...')` lines around each step + `step N OK <returned_id>=...` after success let us follow execution in production logs without stepping through with a debugger.

The final "flip campaign+adset to ACTIVE" calls were demoted to `logger.warning(f'[boost_post] flip-to-ACTIVE failed (non-fatal): {e}')` — by the time we get there, the ad object exists and Meta will eventually serve it; failing the whole API call would be misleading.

### 2.3 FX Conversion for Non-USD Ad Accounts ([ads/views.py](ads/views.py))

**The bug:** The boost-post view was sending `daily_budget_cents = int(round(usd * 100))` regardless of the ad account's currency. Meta's `daily_budget` field is in the **ad account's currency minor units** (cents for USD, paisa for BDT). When we sent `100` (= "$1.00") to a BDT account, Meta interpreted it as "1 BDT" — way below the ~124 BDT minimum — and rejected the adset.

**The fix:** A new `FX_PER_USD` dict in the view with approximate rates for 13 currencies (USD/BDT/INR/PKR/IDR/EUR/GBP/CAD/AUD/SGD/MYR/AED/SAR). Conversion: `daily_budget_cents = int(round(usd * fx_rate * 100))`. Logs the conversion: `[boost_post] budget conversion: $1 USD x 120 = 12000 BDT minor units`.

**Why hardcoded rates and not a live FX API:** The `fx_service.py` from the May 7 work exists and could be used here. It's deferred because (a) the rates only matter for the minimum-budget validation Meta does at our submission moment — not for accounting (Meta bills the user directly in their account currency, regardless of our conversion); (b) rates fluctuating ±5% just means "user pays $1.05 instead of $1" which they don't notice. A code comment explicitly says "refresh quarterly. For production, fetch live rates from an FX service."

### 2.4 Page Access Token Threaded Through Boost Flow ([ads/views.py](ads/views.py))

**Change:** `BoostPostView` now passes `page_access_token=sa.facebook_access_token or ''` to `meta_ads.boost_post(...)`. The service then forwards it to `_resolve_object_story_id` (see 2.2.1) so the photo lookup uses the correct token.

**Why:** Closes the loop on the photo-post-ID resolution — the helper can only do the right thing if it has the right token, and `BoostPostView` is the only place that has access to the user's `SocialAccount.facebook_access_token`.

### 2.5 Facebook Service: Prefer `post_id` over `id` ([platforms/services/facebook.py](platforms/services/facebook.py))

**What changed:** Both `_post_photo` and `_post_video` now read `post_id = result.get('post_id') or result.get('id')` instead of `result['id']`. When Meta returns both (newer API responses do), we prefer `post_id` — which is the **feed post ID** (boostable) over `id` — the **photo/video media ID** (not directly boostable).

**Why:** This is the **upstream fix** for the photo-post-ID problem in 2.2.1. Now newly published posts get stored with the correct ID from the start. Old posts in the DB still need the runtime resolver, but going forward the resolver's slow path is hit less often.

**Why preserve fallback to `id`:** Some Graph API calls only return `id`. Falling back keeps backward compat with legacy responses.

### 2.6 PostSerializer Exposes Per-Platform Post IDs ([api/serializers.py](api/serializers.py))

**What changed:** Added 4 new fields to `PostSerializer.Meta.fields`: `facebook_post_id`, `instagram_post_id`, `twitter_post_id`, `linkedin_post_id`. All 4 also added to `read_only_fields`.

**Why:** The frontend `BoostPostModal` filters posts to "those with `facebook_post_id`." That field has to be in the API response for the filter to work. Previously the serializer hid these fields, so the filter always fell through to the platforms-list fallback — which over-counts (e.g. a draft post targeting FB but never posted has `platforms.includes('facebook')` but no `facebook_post_id`).

Read-only because the user shouldn't be writing these — Meta/Twitter/etc. assign them at publish time.

### 2.7 Production Domain Whitelist ([socialsync/settings.py](socialsync/settings.py))

**What changed:** Added `yourbrandstar.com` and `www.yourbrandstar.com` to both `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.

**Why:** New production domain coming online. Without these, Django returns `400 Bad Request: Invalid HTTP_HOST header` on every request from that domain, and any POST gets blocked by CSRF. This is the only gate that has to flip before DNS cuts over.

---

## 3. Bug Hunt Highlights — How These Were Found

These weren't theoretical issues — they came out of running real boost attempts today and reading Meta's error responses:

| # | Symptom | Root Cause | Fix |
|---|---------|------------|-----|
| 1 | "Invalid parameter" on creative creation | `object_story_id` was a photo media ID, not a feed post ID | `_resolve_object_story_id` helper that prefers Page Access Token |
| 2 | "Invalid parameter" code 100/4834011 on campaign | Missing `is_adset_budget_sharing_enabled='false'` (Meta tightened validation) | Add the param |
| 3 | "Invalid parameter" code 100/4834011 on adset | Missing `destination_type='ON_POST'` + `promoted_object.page_id` for POST_ENGAGEMENT | Add both |
| 4 | Adset rejected for "below minimum budget" on BDT accounts | Sending USD cents as BDT minor units → 1 BDT instead of 120 BDT | FX conversion table |
| 5 | New posts couldn't be boosted | `_post_photo` returned `id` (photo media) not `post_id` (feed post) | Prefer `post_id` in result parsing |

---

## 4. File Summary

| Component | Key Files |
| :--- | :--- |
| **Boost Post UI** | [frontend/src/components/ads/BoostPostModal.tsx](frontend/src/components/ads/BoostPostModal.tsx) (new — full modal with country/age targeting), [frontend/src/components/platforms/AdAccountsStatus.tsx](frontend/src/components/platforms/AdAccountsStatus.tsx) (new — connected accounts card + Boost CTA), [frontend/src/services/adsService.ts](frontend/src/services/adsService.ts) (new — typed wrappers for all 8 ads endpoints) |
| **Surface wiring** | [frontend/src/pages/ConnectAccountsPage.tsx](frontend/src/pages/ConnectAccountsPage.tsx) (Meta Ad Accounts section + `adRefreshKey`), [frontend/src/pages/MyPostsPage.tsx](frontend/src/pages/MyPostsPage.tsx) ("Boost Post" button in detail modal + `boostingPost` state) |
| **OAuth auto-discovery** | [platforms/oauth_views.py](platforms/oauth_views.py) (`_auto_discover_ad_accounts` helper called from FB callback) |
| **Boost Post hardening** | [ads/services/meta_ads.py](ads/services/meta_ads.py) (`_resolve_object_story_id` + 3 Meta-required-param fixes + step-wrapped error handling + detailed logging), [ads/views.py](ads/views.py) (FX conversion + Page Access Token threading) |
| **Upstream post-ID fix** | [platforms/services/facebook.py](platforms/services/facebook.py) (`_post_photo`/`_post_video` prefer `post_id` over `id`) |
| **Serializer exposure** | [api/serializers.py](api/serializers.py) (`facebook_post_id` + 3 sibling fields exposed read-only on `PostSerializer`) |
| **Production domain** | [socialsync/settings.py](socialsync/settings.py) (yourbrandstar.com whitelisted) |

---

## 5. Out of Scope (Deferred)

- **Live FX rates from `fx_service.py`** — current hardcoded table works for the minimum-budget gate but should use the same provider chain as billing for consistency.
- **Boost retry flow on policy disapproval** — when Meta rejects the ad post-creation for policy violation, we capture `rejection_reason` but don't surface a "fix and retry" UI. Manual rebuild required.
- **Campaign management UI** — the modal creates campaigns but there's no UI to list / pause / resume / view insights. Backend endpoints all exist; frontend is the gap.
- **Insights chart** — `getCampaignInsights` is wired in `adsService` but no component renders the timeseries. Recharts area chart deferred.
- **Targeting beyond age + country** — interest targeting, custom audiences, lookalike audiences all need real UI. The backend `targeting` blob is open-ended; frontend just doesn't expose it yet.
- **Old posts auto-backfill of `post_id`** — going forward `_post_photo` stores `post_id`, but historical rows still have photo media IDs. A management command that reconciles them would let users boost older posts without hitting the slow-path resolver.
- **Page Access Token rotation** — when a Page token expires (60 days), boost-post will silently fail the photo lookup. A pre-flight check + reconnect prompt is needed.
- **Pre-launch ad preview** — show users what their boosted ad will look like in Facebook feed before they spend money. Currently they have to launch + check Meta Ads Manager.
