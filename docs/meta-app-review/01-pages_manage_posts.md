# Permission: `pages_manage_posts`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting pages_manage_posts"

## What the permission does (per Meta's description)
> The `pages_manage_posts` permission allows your app to create, edit and delete
> your Page posts. If you have access to `pages_read_user_content`, you can also
> use `pages_manage_posts` to delete Page posts created by a user. The allowed
> usage for this permission is to create and delete content on a Page. You may
> also use this permission to request analytics insights to improve your app and
> for marketing or advertising purposes, through the use of aggregated and
> de-identified or anonymized information (provided such data cannot be
> re-identified).

## Justification we submitted (text in the form)
> SellAnto allows users to schedule and publish posts to their Facebook Pages.
> Users compose post content inside SellAnto, select a target Facebook Page, and
> set a publish time. SellAnto then publishes the post via `POST /{page_id}/feed`
> using the page access token. This permission is required to create posts on the
> user's behalf.

## Screencast
- **Status:** 🔴 **REJECTED 2026-08-04** — Developer Policy 1.6, "Screencast Not Aligned
  with Use Case Details". Same template as `instagram_basic` (08) and
  `instagram_content_publish` (04), same date.

### Rejection text (verbatim, received 2026-08-04 4:16 AM)
> We have determined that your apps' use case is allowed, however, the submitted
> screencast fails to demonstrate the end-to-end experience of the use case described in
> the submission notes, hence the requested permission/feature is rejected.

Meta requires the re-record to contain: the complete Meta login flow; a user granting app
access to the permission; the end-to-end experience of the use case; English UI with
captions/tool-tips and buttons explained; and a declaration if the app is
server-to-server or uses a system user token.

### Diagnosis — the use case was ACCEPTED, only the video failed
**There is NO code defect here.** This is the `instagram_content_publish` situation (file
04), not the `instagram_basic` one (file 08): every claim in the submitted justification
is backed by shipped code (see the cross-check below), so **do not rewrite the
justification**. The video simply never showed the post **live on the real Facebook Page**.

Full scene-by-scene re-record script:
[01a-pages_manage_posts-screencast-script.md](01a-pages_manage_posts-screencast-script.md).

**Materially easier now:** "Post Now" (`POST /api/v1/posts/<id>/publish/`,
`api/views.py:1271`) shipped on `feat/post-now` *after* this rejection, so publishing is
synchronous — the ~90s scheduler wait that complicates the Instagram scripts does not
apply to this recording.

### Optional strengthening of the notes (add, do not replace)
The submitted justification describes only **create**. Meta's own allowed usage in this
same feedback is "to create **and delete** content on a Page", and SellAnto has delete
fully built and wired (below). Adding two sentences covers the whole allowed usage and
matches what Scenes 6–7 of the script put on screen:

> Users can also delete a published Page post from SellAnto. Deleting it in SellAnto calls
> `DELETE /{post-id}`, removing the post from the Facebook Page itself rather than only
> from SellAnto's records, so a user retracting content does not have to go to Facebook
> separately. This is why SellAnto needs create *and* delete under `pages_manage_posts`.

## Required API test calls
- **Status:** ⚠️ **`0 of 1 API call(s) required`** — NOT satisfied yet.
- Meta note: *"Completed test calls can take up to 24 hours to show for your app."*
- Action: make at least **1 real Graph API call** using `pages_manage_posts`
  (i.e. `POST /{page_id}/feed`) from the app, then wait up to 24h for it to register.

## Codebase cross-check — RESULT (verified 2026-07-12)

`pages_manage_posts` grants **create / edit / delete** of Page posts. Coverage:

### CREATE — ✅ done (frontend + backend)
- Backend publish: `FacebookService._post_text/_post_photo/_post_video` →
  `POST /{page_id}/feed` at `platforms/services/facebook.py:210+`.
- Frontend: compose + schedule/publish flow (CreatePost → scheduler).

### DELETE — ✅ done (frontend + backend), fully wired end-to-end
- Backend service: `FacebookService.delete_post(page_id, access_token, post_id)`
  → `DELETE /{post-id}` at `platforms/services/facebook.py:291`.
- **DRF API** (what React calls): `PostViewSet.destroy` at `api/views.py:1103-1147`
  deletes on **Instagram + Facebook** (when `facebook_post_id`/`instagram_post_id`
  set), tolerates "already gone" errors, then deletes the local row.
- Frontend chain: `MyPostsPage` Trash button → confirm modal → `handleDelete`
  (`MyPostsPage.tsx:59`) → `postStore.deletePost` (`postStore.ts:91`) →
  `postService.delete` → `DELETE /posts/{id}/`. ✅ full loop.
- ⚠️ Legacy Django-template view `posts/views.py:270 delete_post` only does a
  **local** `post.delete()` (no Facebook call). Not used by the React app, but is
  a latent footgun — should be removed or made to call `FacebookService.delete_post`.

### EDIT — ❓ not implemented (optional; NOT required for review)
- No `POST /{post_id}` update path found. Meta only needs 1 test call, and
  create/delete already cover the permission's allowed usage.

## Test call — how to satisfy "0 of 1"
- A management command already exists: `api/management/commands/meta_test_calls.py`
  exercises `pages_manage_posts` (GET published_posts, and opt-in DELETE that
  publishes a throwaway post then deletes it). Running it fires a qualifying call
  with this app's token. Wait up to 24h for Meta to register it.

## Notes
- This is one of the standard Page-management permissions. Publishing to a Page
  feed is exactly the "create content on a Page" allowed use case, so the
  justification aligns with Meta's stated allowed usage.
