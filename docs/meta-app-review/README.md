# Meta App Review — SellAnto

This folder tracks the **Facebook/Meta App Review** submission for SellAnto: every
permission being requested, its justification, screencast status, and — most
importantly — the **required API test call(s)** each permission needs before it
can be submitted.

The screenshots the user shared come from the Meta App Dashboard →
**App Review → Permissions and Features** flow. Each permission has its own
"Tell us why you're requesting X" form with:

- Detailed use-case description
- An uploaded screen recording (screencast)
- A **test-call requirement** (`N of M API call(s) required`) that must reach the
  target before the permission can be submitted

## Purpose of this folder

1. One markdown file per permission/screenshot, capturing exactly what Meta shows.
2. After all screenshots are logged, cross-check against **our codebase**: for each
   permission Meta wants a test call for, confirm our system actually makes that
   Graph API call (so the "0 of 1 API call(s)" requirement can be satisfied).

## Permissions log

| # | Permission | Justification filled | Screencast | Test calls | File |
|---|-----------|:---:|:---:|:---:|------|
| 1 | `pages_manage_posts` | ✅ | ✅ uploaded | ⚠️ 0 of 1 required | [01-pages_manage_posts.md](01-pages_manage_posts.md) |
| 2 | `instagram_manage_comments` | — | — | ⚠️ test not done | [02-instagram_manage_comments.md](02-instagram_manage_comments.md) |
| 3 | `instagram_manage_contents` | — | — | ⚠️ test not done | [03-instagram_manage_contents.md](03-instagram_manage_contents.md) |
| 4 | `instagram_content_publish` | ✅ accepted | 🔴 **REJECTED 8/4/26** — re-record | ⚠️ test not done | [04](04-instagram_content_publish.md) · [script](04a-instagram_content_publish-screencast-script.md) |
| 5 | ~~`business_management`~~ | — | — | ⛔ DROPPED — not needed | [05-business_management.md](05-business_management.md) |
| 6 | `ads_read` | select-usage | — | ⚠️ test not done | [06-ads_read.md](06-ads_read.md) |
| 7 | `ads_management` | — | — | ⚠️ test not done | [07-ads_management.md](07-ads_management.md) |
| 8 | `instagram_basic` | ✅ accepted | 🔴 **REJECTED 8/4/26** — re-record | ⚠️ test not done | [08](08-instagram_basic.md) · [script](08a-instagram_basic-screencast-script.md) |
| 9 | `pages_messaging` (Messenger) | needs writing | — | ✅ restored to scopes 2026-08-17 | [09-messaging-whatsapp-and-messenger.md](09-messaging-whatsapp-and-messenger.md) |

_(more rows added as screenshots/text arrive)_

### Build-needed summary (per permission)
- **`instagram_manage_comments`** — READ ✅ & REPLY ✅ exist; **HIDE ❌ and DELETE ❌
  need building** (backend service + DRF endpoints + `PostCommentInbox` UI + test-call
  hooks). See file 02.
- **`instagram_manage_contents`** — ✅ **already covered** (IG post/reel delete is
  built + wired frontend↔backend). No build needed; just trigger a real
  `DELETE /{ig-media-id}` (delete a published IG post, or add opt-in step to the
  test-calls cmd). See file 03.
- **`instagram_content_publish`** — 🔴 **REJECTED 2026-08-04** (Dev Policy 1.6, same
  template as `instagram_basic`). **Unlike `instagram_basic`, there is NO code defect** —
  every claim in the justification is backed by shipped code (`instagram.py:299` container,
  `:382` publish, `:308` REELS, scheduler at `posts/scheduler.py:386`). Do NOT rewrite the
  justification; the use case was accepted. The video failed to show the **end-to-end**
  flow — almost certainly it never showed the post **live on the real Instagram account**.
  Two recording traps: (a) IG publish also needs the FB Page (`scheduler.py:396-419`
  reads `facebook_page_id`/`facebook_access_token`, stages media on the Page first), and
  (b) there is **no synchronous publish** — APScheduler's `check_and_post` runs every
  60s (`scheduler.py:35-38`) and "Publish Now" just sets `scheduled_time` to now+1min, so
  budget ~90s of wait (much more for reels; **record a photo**). Full script in
  [04a](04a-instagram_content_publish-screencast-script.md). Pre-flight 2026-08-17: quota
  0/100, scope in token, both accounts wired — PUBLISH READY. See files 04 + 04a.
- **`business_management`** — ⛔ **DROPPED** (user confirmed not needed; no agency/
  multi-client plan). Remove from submission; no code change needed. See file 05.
- **`ads_read`** — ✅ **already covered** (insights/analytics reading built + wired).
  No build needed. **Select Option 1** ("ad performance data for custom dashboards and
  data analytics"); do NOT select the server-events/CAPI option. See file 06.
- **`ads_management`** — ✅ **already covered** (full create + manage + insights built
  & wired frontend↔backend; core of feat/meta-ads-full-parity). No build needed;
  test call is a safe READ `GET /act_{id}/insights` (already in test-calls cmd). See
  file 07.
- **`instagram_basic`** — 🔴 **REJECTED 2026-08-04** (Dev Policy 1.6, screencast not
  aligned). Use case ACCEPTED — only the video failed, so do not rewrite the
  justification. Media read ✅ is solid, but **profile metadata is fetched and then
  discarded** (`platforms/services/instagram.py:476-477`) so no screen shows the
  username/followers/picture that Meta defines as the allowed usage. Recommended ~30-line
  fix + full scene-by-scene shooting script in
  [08a](08a-instagram_basic-screencast-script.md). Do NOT record `/discover` (routes
  missing, 404s), the "Total Reach" tile (renders `—`), or the "Archive" button
  (really deletes). See files 08 + 08a.
- **Messenger / WhatsApp** (file 09):
  - **WhatsApp** — ❌ NOT a feature (zero code). Don't request any WhatsApp scopes;
    build the Cloud API integration first if wanted.
  - **FB Messenger** — ✅ full feature (`messenger_bot` app: webhook + `/me/messages`).
    ✅ **`pages_messaging` RESTORED to `FB_SCOPES` 2026-08-17** (`oauth_views.py:67`).
    **Root cause:** commit `5e942c2f` ("expand Facebook OAuth scopes for Instagram
    publishing and leads", 2026-06-13) deleted it with the message *"Remove unused
    pages_messaging scope"* — but it was never unused. Six live call sites need it:
    `POST /me/messages` at `messenger_bot/views.py:964`,
    `messenger_bot/services/message_handler.py:850,1071`, `api/views.py:4263`; and
    `GET /{page_id}/conversations` at `messenger_bot/views.py:882`,
    `message_handler.py:583`. The feature is gated by the SiteConfiguration kill
    switch (`accounts/utils.py:4`), which is currently **ON** — so Messenger is live
    in the product while the scope was absent from the consent screen.
    Still TODO: write the justification + record a screencast + submit for **Advanced
    Access** (required for non-admin users).

## Pending action items (do later)

- [x] **Scheduler never started under `--noreload`** (fixed 2026-08-17) —
      `posts/apps.py:28` gated startup on `RUN_MAIN == 'true'`, which Django only
      sets when the auto-reloader is active. Under `runserver --noreload` the
      scheduler silently never ran, so scheduled posts stayed at `scheduled`
      forever and the UI reported "Failed to publish". Now keyed on whether the
      reloader is actually in use.
- [x] **Publishing failures were silent** (fixed 2026-08-17) — two paths in
      `publish_post()` (`SocialAccount.DoesNotExist` and the generic `except`)
      counted a failure without writing `<platform>_error`, so the UI had no
      reason to show. Added `_record_platform_error()`; also handles
      `MultipleObjectsReturned` and clears stale errors on retry.
- [x] **"Failed to publish" shown for posts that never ran** (fixed 2026-08-17) —
      `get_platform_results()` derived `success` as `bool(post_id) and not error`,
      so a not-yet-attempted platform (no id, no error) rendered as failed. Added a
      `state` field (`published` / `failed` / `pending` / `publishing`) and a shared
      `PublishingResults` component.

- [ ] **Fix legacy `delete_post` footgun** — `posts/views.py:270` only does a local
      `post.delete()` with **no Facebook call**, so it leaves the real Page post
      live on Facebook. The React app does NOT use it (it uses DRF
      `PostViewSet.destroy` at `api/views.py:1103`, which deletes on FB+IG
      correctly). Remove this legacy view (and its URL) OR make it call
      `FacebookService.delete_post`. Latent risk if anything re-wires to it.
- [ ] **Run the `pages_manage_posts` test call** — `python manage.py meta_test_calls`
      to satisfy the "0 of 1 API call(s) required", then wait ≤24h for Meta to
      register it.
- [ ] (Optional, not required for review) **Edit-post** support — `POST /{post_id}`
      update path is not implemented. Only add if we actually want edit-in-place.

## Status legend
- ✅ done
- ⚠️ action needed
- ❌ missing / not started
