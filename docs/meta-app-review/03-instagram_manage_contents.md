# Permission: `instagram_manage_contents`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting instagram_manage_contents"

## What the permission does (per Meta's description)
> The `instagram_manage_contents` permission allows your app to delete posts on
> behalf of an Instagram account linked to a Facebook Page. The allowed usage for
> this permission is to allow an app user to delete an Instagram post, story or
> reel. You may also use this permission to request analytics insights to improve
> your app and for marketing or advertising purposes, through the use of aggregated
> and de-identified or anonymized information (provided such data cannot be
> re-identified).

## Actions this permission grants
| Action | Graph API call | In our system? |
|---|---|---|
| **Delete** an IG post / story / reel | `DELETE /{ig-media-id}` | ✅ yes |
| List content (context read) | `GET /{ig-user-id}/media` | ✅ yes |

## Codebase cross-check (verified 2026-07-12) — ✅ ALREADY COVERED

### Delete — ✅ done (frontend + backend), wired end-to-end
- **Backend service:** `InstagramService.delete_post(access_token, media_id)`
  → `DELETE /{media_id}` at `platforms/services/instagram.py:438-458`.
- **DRF API** (what React calls): `PostViewSet.destroy` at `api/views.py:1103-1147`
  — when `post.instagram_post_id` is set it calls `InstagramService.delete_post(...)`
  (`api/views.py:1113-1121`), tolerates "already gone" errors, then deletes the
  local row.
- **Frontend chain:** `MyPostsPage` Trash button → confirm modal → `handleDelete`
  (`MyPostsPage.tsx:59`) → `postStore.deletePost` (`postStore.ts:91`) →
  `postService.delete` → `DELETE /posts/{id}/`. ✅ full loop.

### Content list — ✅ done
- `GET /{ig-user-id}/media` (fields: media_type, media_url, caption, like_count,
  comments_count, …) in the test-calls command at
  `api/management/commands/meta_test_calls.py:74-85`.

## Nuance — post vs story/reel
- The Graph API deletes a **published IG media object** (post OR reel) with the same
  `DELETE /{media-id}` — our `delete_post` covers post + reel already, since we store
  the returned media id (`instagram_post_id`) regardless of type.
- **Stories:** Meta's Content Publishing API does not let apps publish stories via
  this stack, and we don't track a separate story media id. So story deletion is not
  exercised — but it's not required to satisfy the test call (deleting a post/reel
  qualifies). No build needed for review; only build story-delete if we later add
  story publishing.

## What we need to BUILD — NOTHING (for the test call)
- Delete is fully built + wired (frontend + backend). ✅
- The test-call requirement is satisfiable today: `PostViewSet.destroy` fires a real
  `DELETE /{ig-media-id}` whenever a user deletes a published IG post. To force a
  qualifying call for the review, either delete a published IG post from the UI, or
  add an opt-in `DELETE /{media-id}` step to `meta_test_calls.py` (mirroring the
  `pages_manage_posts` opt-in delete). Wait ≤24h for Meta to register it.

## Optional (not required for review)
- [ ] Add an opt-in IG-content DELETE test to `meta_test_calls.py` so the call can be
      triggered without deleting a real user post from the UI (publishes a throwaway
      IG media then deletes it — note: IG publish has rate/quota limits).
