# Permission: `instagram_content_publish`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting instagram_content_publish"

## What the permission does (per Meta's description)
> The `instagram_content_publish` permission allows your app to create organic feed
> photo and video posts on behalf of a business user. The allowed usage for this
> permission is to manage your Instagram organic content creation process, for
> example post photos or videos to a main feed, on behalf of a business. You may
> also use this permission to request analytics insights to improve your app and
> for marketing or advertising purposes, through the use of aggregated and
> de-identified or anonymized information (provided such data cannot be
> re-identified).

## Actions this permission grants
| Action | Graph API call | In our system? |
|---|---|---|
| Create media container (photo/video) | `POST /{ig-user-id}/media` | ✅ yes |
| Publish the container to feed | `POST /{ig-user-id}/media_publish` | ✅ yes |
| Check publish quota | `GET /{ig-user-id}/content_publishing_limit` | ✅ yes (test-calls cmd) |

## Codebase cross-check (verified 2026-07-12) — ✅ ALREADY COVERED

### Publish photo + video/reel — ✅ done (frontend + backend), in production
- **Backend service:** `InstagramService.post_to_instagram(...)` at
  `platforms/services/instagram.py:176+`. Flow:
  1. Upload media to the FB Page as unpublished to get a hosted URL
     (`/{page_id}/photos` or `/{page_id}/videos`, `published=false`).
  2. Create IG media container: `POST /{ig-user-id}/media`
     (`instagram.py:299`), using `media_type=REELS` for videos (`instagram.py:307`).
  3. Publish: `POST /{ig-user-id}/media_publish` with `creation_id`
     (`instagram.py:382-385`).
  - Video path polls the container/processing status before publishing.
- **Scheduler/publish path:** IG posts are published through the normal
  post scheduler + `SocialAccount` (instagram) tokens, same as FB.
- **Frontend:** compose flow (CreatePost / Magic mode) → select Instagram →
  schedule/publish. Published id stored as `instagram_post_id`.

### Publish quota (read) — ✅ done
- `GET /{ig-user-id}/content_publishing_limit` in the test-calls command at
  `api/management/commands/meta_test_calls.py:102-112`.

## What we need to BUILD — NOTHING
- Full organic photo + video/reel publishing to the IG main feed is already built,
  wired frontend↔backend, and in production use. ✅

## Test call — how to satisfy the requirement
- Publishing any IG photo/video from the app fires the qualifying
  `POST /{ig-user-id}/media` + `/media_publish` calls. Publish one IG post from the
  UI to register the call.
- The read quota call is also available via `python manage.py meta_test_calls`
  (`content_publishing_limit`). Wait ≤24h for Meta to register calls.

## Notes
- Meta counts the container-create / publish calls under this permission. A single
  successful IG publish satisfies the requirement.
