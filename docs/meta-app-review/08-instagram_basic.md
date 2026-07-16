# Permission: `instagram_basic`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting instagram_basic"

## What the permission does (per Meta's description)
> The `instagram_basic` allows your app to read an Instagram account profile's info
> and media. The allowed usage for this permission is to get basic metadata of an
> Instagram Business account profile, for example username and ID. You may also use
> this permission to request analytics insights... (aggregated / de-identified).

## Actions this permission grants
| Action | Graph API call | In our system? |
|---|---|---|
| Read IG profile metadata (id, username, followers, media_count, picture) | `GET /{ig-user-id}?fields=...` | ✅ yes |
| Read the account's media list | `GET /{ig-user-id}/media` | ✅ yes |

## Codebase cross-check (verified 2026-07-12) — ✅ FULLY COVERED

This is the foundational IG read scope; it underpins connect, profile display, and
media listing.

- **Profile metadata:** `GET /{ig-user-id}?fields=id,username,followers_count,
  media_count,profile_picture_url` — test-calls command
  `api/management/commands/meta_test_calls.py:87-100` (labeled `instagram_basic`).
- **Credential validation / username fetch:** `InstagramService.validate_credentials
  (access_token, business_account_id)` → `GET /{business_account_id}?fields=username,
  profile_picture_url` at `platforms/services/instagram.py:460+`.
- **Media list:** `GET /{ig-user-id}/media` (used by manage_contents/comments flows
  and the media picker).
- **Connect flow:** IG account is linked via the Facebook OAuth connect
  (`instagram_basic` is in `FB_SCOPES`, `platforms/oauth_views.py:60`), storing
  `instagram_business_account_id` + token on `SocialAccount`.

## What we need to BUILD — NOTHING
- IG profile + media reading is fully built and wired (connect, profile display,
  media picker, analytics). ✅

## Test call — how to satisfy the requirement
- `GET /{ig-user-id}?fields=id,username,...` is already in the test-calls command.
  Run `python manage.py meta_test_calls`; wait ≤24h for Meta to register it.

## Notes
- `instagram_basic` is a prerequisite for the other IG permissions
  (`instagram_content_publish`, `instagram_manage_comments`,
  `instagram_manage_contents`) — all of which we already use. Low-risk, standard scope.
