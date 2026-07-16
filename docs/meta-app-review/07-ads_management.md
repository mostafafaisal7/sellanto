# Permission: `ads_management`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting ads_management"

## What the permission does (per Meta's description)
> The `ads_management` permission allows your app to both read and manage the Ads
> account it owns, or has been granted access to, by the Ad account owner. The
> allowed usage for this permission is to programmatically create campaigns, manage
> ads or fetch Ad metrics to help their business. Additionally, it can also be used
> to build ad management tools to provide innovative solutions and differentiated
> values for advertisers. You may also use this permission to request analytics
> insights... (aggregated / de-identified).

## Actions this permission grants
| Action | Graph API call | In our system? |
|---|---|---|
| Create campaign / adset / ad | `POST /act_{id}/campaigns`, `/adsets`, `/ads`, `/adcreatives` | ✅ yes |
| Boost an existing post | boost flow (campaign→adset→creative→ad) | ✅ yes |
| Carousel / lead-form ads | `POST .../ads` (child_attachments), `/leadgen_forms` | ✅ yes |
| Pause / resume | `POST /{campaign-id}` `status=PAUSED/ACTIVE` | ✅ yes |
| Update name / budget | `POST /{campaign-id}` / `/{adset-id}` | ✅ yes |
| Read insights | `GET /act_{id}/insights` | ✅ yes |

## Codebase cross-check (verified 2026-07-12) — ✅ FULLY COVERED

This is the core of the Meta-ads parity work (branch `feat/meta-ads-full-parity`).

### Create + manage — ✅ done (frontend + backend)
Service `ads/services/meta_ads.py`:
- `create_link_campaign` (`:533`) — full campaign→adset→creative→ad, with objectives,
  targeting, budget/bid/schedule, multi-version copy, pixel/conversions.
- `create_carousel_campaign` (`:838`), `boost_post` (`:185`), `create_lead_form` (`:1595`).
- `pause_campaign` (`:1315`), `resume_campaign` (`:1324`),
  `update_campaign_name` (`:1333`), `update_campaign_budget` (`:1342`).
- Insights: `get_insights`, `get_campaign_insights_breakdown`, `get_account_summary`,
  `get_account_recommendations`, targeting/geo search, audiences, pixels, ad preview.

DRF endpoints (`ads/urls.py`): `meta/campaigns/create/`, `meta/carousel/`,
`boost-post/`, `boost-from-post/`, `meta/lead-forms/`, `campaigns/<pk>/pause|resume/`,
`campaigns/<pk>/insights|breakdown/`, `meta/insights/`, `meta/preview/`,
`meta/targeting/search|geo/`, `meta/pixels/`, `meta/audiences/live/`,
`meta/account-summary/`, `meta/recommendations/`, `meta/suggest/`.

Frontend (`feat/meta-ads-full-parity`): `CreateCampaignModal` (media picker, advanced
creative, multi-version copy, targeting builder, launch paused/active), `CarouselModal`,
`LeadFormModal`, insights/breakdown/account panels, pause/resume controls.

### Safety notes (already in place)
- Explicit **paused vs active** launch choice; `bool("false")` bug fixed (`_parse_bool`).
- Live-activation guard requires `confirm_live` → 409 to avoid accidental spend.
- Rollback (`_delete_quietly`) on partial-failure for create + boost.

## What we need to BUILD — NOTHING
- Create + manage + read is fully built, wired frontend↔backend, and (partially)
  tested against live accounts. ✅

## Test call — how to satisfy the requirement
- The safest qualifying call is a **read**: `GET /act_{id}/insights` — already in
  `api/management/commands/meta_test_calls.py:208-212` (labeled `ads_management`).
  Run `python manage.py meta_test_calls`; wait ≤24h. **No live write needed** to
  satisfy the test-call requirement (honors the "don't touch other ad accounts" rule).
- A create-campaign call also qualifies but performs a real write — only do this on an
  account we own + in paused mode if we want stronger evidence for the screencast.

## Notes
- This is the highest-scrutiny ads permission. The screencast should clearly show a
  user creating/managing a campaign inside SellAnto. Advanced Access is required for
  non-admin users to use it on their own ad accounts.
