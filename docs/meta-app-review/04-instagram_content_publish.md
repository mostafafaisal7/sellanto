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

---

## 🔴 REJECTION — 2026-08-04, 4:16 AM

> **Screencast Not Aligned with Use Case Details**
> **Developer Policy 1.6 - Build a Trustworthy Product**
> We have determined that your apps' use case is allowed, however, the submitted
> screencast fails to demonstrate the end-to-end experience of the use case described in
> the submission notes, hence the requested permission/feature is rejected.
> Please resolve this issue by sharing a new screencast that contains the end-to-end
> experience of the use case when you re-submit for App Review, including:
> The complete Meta login flow; A user granting app access to the permission/feature;
> The end-to-end experience of the use case for the requested permission/feature;
> Follow the best practices shared in the Screen Recording Guide, including: use English
> as the app UI language, provide captions and tool-tips, and explain the meaning of
> buttons and other UI elements; and If your app is a server-to-server app OR your app is
> using system user token to access Meta API, please indicate it in your next submission
> so that we're aware that frontend Meta login authentication flow is not visible.

### Justification submitted (ACCEPTED — do not rewrite)
> SellAnto allows users to publish photos, videos, and reels to their connected Instagram
> Business account. The app creates a media container via POST /{ig_user_id}/media with
> the media URL and caption, then publishes it via POST /{ig_user_id}/media_publish. Users
> can also schedule Instagram posts for a future time.

### Analysis — no code defect (verified 2026-08-17)
Unlike `instagram_basic` (whose notes described an unbuilt screen), **every claim above is
backed by shipped code**:

| Claim | Code |
|---|---|
| media container | `platforms/services/instagram.py:299` |
| media_publish | `platforms/services/instagram.py:382` |
| videos / reels | `instagram.py:308` (`media_type=REELS`) |
| scheduling | `CreatePostPage.tsx` + `posts/scheduler.py:386` |

So **only the video failed.** The likeliest gap: the recording showed the post being
scheduled or the app's success toast, but never showed the post **live on the real
Instagram account**. That verification shot is mandatory in the re-record.

**Two constraints that break naive recordings:**
1. IG publishing requires the **Facebook Page** too — `posts/scheduler.py:396-419` reads
   `facebook_page_id` + `facebook_access_token` and stages the media on the Page as
   unpublished before creating the IG container.
2. **No synchronous publish exists.** APScheduler's `check_and_post` runs every 60s
   (`posts/scheduler.py:35-38`); "Publish Now" sets `scheduled_time` to now + 1 minute
   (`CreatePostPage.tsx:215-221`). Expect ~90s for a photo, far longer for a reel
   (`instagram.py:330` sleeps 60s plus FB video polling) — **record a photo**.

➡️ Full scene-by-scene script:
[04a-instagram_content_publish-screencast-script.md](04a-instagram_content_publish-screencast-script.md)

### Pre-flight (2026-08-17) — PUBLISH READY ✅
```
IG customoobd (17841477940902567) · FB Customoo (877455748776936)
tokens present · content_publishing_limit 0/100 per 86400s
instagram_content_publish present in token
```
