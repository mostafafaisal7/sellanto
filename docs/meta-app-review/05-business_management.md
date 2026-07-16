# Permission: `business_management`

> ## ⛔ DECISION (2026-07-12): NOT NEEDED — DROP FROM SUBMISSION
> The user confirmed we do **not** need `business_management`. No agency / multi-client
> Business Manager features are planned. **Action: remove this permission from the
> Meta App Review submission** (it's already absent from `FB_SCOPES`, so no code change
> is required). Nothing to build, nothing to test. Re-open this file only if an
> agency/multi-client roadmap appears — the full build plan is preserved below.

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting business_management"

## What the permission does (per Meta's description)
> The `business_management` permission allows your app to read and write with the
> Business Manager API. The allowed usage for this permission is to manage business
> assets such as an ad account and to claim ad accounts. You may also use this
> permission to request analytics insights to improve your app and for marketing or
> advertising purposes, through the use of aggregated and de-identified or
> anonymized information (provided such data cannot be re-identified).

## Actions this permission grants (Business Manager API)
| Action | Graph API call | In our system? |
|---|---|---|
| List the user's businesses | `GET /me/businesses` | ❌ no |
| Read a business's owned/client ad accounts | `GET /{business-id}/owned_ad_accounts`, `/client_ad_accounts` | ❌ no |
| Read business pages / assets | `GET /{business-id}/owned_pages`, `/client_pages` | ❌ no |
| Claim / assign an ad account | `POST /{business-id}/claimed_ad_accounts` (or `/adaccounts`) | ❌ no |

## Codebase cross-check (verified 2026-07-12) — ⚠️ NOT COVERED

**We make ZERO Business Manager API calls, and the scope is intentionally NOT requested.**

- **Scope intentionally omitted** — `platforms/oauth_views.py:51-54`:
  > "NOTE: business_management is intentionally NOT requested — ad-account discovery
  > uses `GET /me/adaccounts` (authorized by ads_read/ads_management), and the app
  > has no Business Manager API calls. Re-add only if agency / multi-client Business
  > Manager features are built."
- **`business_management` is NOT in `FB_SCOPES`** (`platforms/oauth_views.py:55-75`).
  So Meta won't even surface it on the consent screen today.
- The `business_id` we store (`ads/models.py:58`, set at `meta_ads.py:129`) is just a
  **sub-field** of `GET /me/adaccounts` (`account.business.id`) — that call is
  authorized by `ads_read`, NOT by `business_management`. It does not count as a
  Business Manager API call.
- No `/me/businesses`, `/{business-id}/owned_ad_accounts`, `/client_ad_accounts`,
  or claim calls anywhere in the codebase (`api/management/commands/meta_test_calls.py`
  has no business_management entry either).

## ⚠️ Decision needed first — do we actually WANT this permission?
`business_management` is only needed for **agency / multi-client Business Manager**
features (managing/claiming ad accounts across a Business Manager). Our current model
is single-user: each user connects their own token and we read *their* ad accounts via
`/me/adaccounts`. **If we don't need agency features, the cleanest path is to REMOVE
`business_management` from the review submission** rather than build to it.

If we DO want it (agency/multi-client roadmap), then to test it we must build:

## What we need to BUILD so we can test this permission

### Backend
1. **Add `business_management` to `FB_SCOPES`** (`platforms/oauth_views.py:55`) so
   Meta grants it and it appears on the consent screen.
2. **Business Manager service functions** (new, e.g. in `ads/services/meta_ads.py` or
   a new `business.py`):
   - `list_businesses(token)` → `GET /me/businesses`
   - `list_business_ad_accounts(token, business_id)` →
     `GET /{business-id}/owned_ad_accounts` + `/client_ad_accounts`
   - (write, optional) `claim_ad_account(token, business_id, adaccount_id)` →
     the claim/assign endpoint.
3. **DRF endpoints** exposing them (e.g. `GET /ads/businesses/`,
   `GET /ads/businesses/{id}/ad-accounts/`).
4. **Add a `business_management` read test call to `meta_test_calls.py`**:
   `GET /me/businesses` (and, if a business id is available,
   `GET /{business-id}/owned_ad_accounts`). A read call satisfies the requirement.

### Frontend
5. In the ads account-connection UI, add a **Business Manager picker**: list the
   user's businesses → list that business's ad accounts → let them pick/claim one.
   (Extends the existing ad-account selector.)

## Recommendation
- **If no agency features are planned:** drop `business_management` from the App Review
  submission — nothing to build, nothing to test.
- **If agency/multi-client is on the roadmap:** build items 1–4 above (a single
  `GET /me/businesses` read call is enough to satisfy the test-call requirement), then
  add the frontend picker (item 5) for real usage + a convincing screencast.

## Test call — how to satisfy the requirement (only if we keep the permission)
- After adding the scope + a `GET /me/businesses` call, run
  `python manage.py meta_test_calls`. Wait ≤24h for Meta to register it.
- Requires the user to actually have a Business Manager with the app granted
  `business_management`.
