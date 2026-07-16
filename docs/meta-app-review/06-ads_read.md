# Permission: `ads_read`

**Source:** Meta App Dashboard → App Review → "Select the ways your app will use the ads_read permission"

This one is a **multiple-choice usage selector**, not a free-text justification.

## The options Meta offers
1. ☑️ **Provide API access to your ad performance data for use in custom dashboards
   and data analytics.**  ← **SELECT THIS ONE**
2. ☐ Send web events from your server directly to Facebook.  ← do NOT select
3. ☐ Other, please provide additional details.  ← not needed

## Which to pick — verified against our code (2026-07-12)

### ✅ Option 1 — "ad performance data for custom dashboards / analytics" — YES, this is us
Our entire Meta ads-reporting surface is exactly this: we read ad performance/insights
and render dashboards.
- `get_insights(...)` and `get_campaign_insights_breakdown(...)` →
  `GET /{entity}/insights` in `ads/services/meta_ads.py`.
- Endpoints: `meta/insights/` (`ads/urls.py:192`), `campaigns/<pk>/insights/`
  (`ads/urls.py:134`), `campaigns/<pk>/breakdown/`, `meta/account-summary/`,
  `meta/recommendations/`.
- Ad-account discovery: `GET /me/adaccounts` (authorized by ads_read).
- Frontend dashboards: `CampaignInsightsPanel`, `InsightBreakdownPanel`,
  `AccountInsightsPanel` (ROAS/CPA/reach/frequency KPIs + 8 breakdown dimensions).

### ❌ Option 2 — "send web events from your server directly to Facebook" — NO
That option describes the **Conversions API (CAPI)** / server-side pixel events
(`POST /{pixel-id}/events`). **We do NOT do this** — verified: no `/events`,
`conversions_api`, `action_source`, or server-event code anywhere in the repo. (We do
have `pixel_id` / `custom_event_type` on campaigns for *optimization targeting*, but we
never *send* events server-side.) Selecting this would misrepresent our usage.

## What we need to BUILD — NOTHING
- `ads_read` (insights/analytics reading) is fully built + wired frontend↔backend.
  Just select **Option 1**.

## Test call — how to satisfy the requirement
- Any insights read fires a qualifying call: run `python manage.py meta_test_calls`
  (or open a campaign's insights panel in the UI) → `GET /{entity}/insights` /
  `GET /me/adaccounts`. Wait ≤24h for Meta to register it.

## Action
- ☑️ Select **Option 1** ("ad performance data for custom dashboards and data
  analytics"). Leave options 2 and 3 unchecked.
