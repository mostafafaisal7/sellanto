# Permission: `instagram_manage_comments`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting instagram_manage_comments"

## What the permission does (per Meta's description)
> The `instagram_manage_comments` permission allows your app to create, delete and
> hide comments on behalf of the Instagram account linked to a Page. Your app can
> also read and respond to public media and comments that a business has been photo
> tagged or @mentioned in. The allowed usage for this permission is to read, update
> and delete comments of Instagram Business Accounts. You may also use this
> permission to request analytics insights to improve your app and for marketing or
> advertising purposes, through the use of aggregated and de-identified or
> anonymized information (provided such data cannot be re-identified).

## Actions this permission grants
| Action | Graph API call | In our system? |
|---|---|---|
| **Read** comments | `GET /{ig-media-id}/comments` | ✅ yes (sync + inbox + test-calls cmd) |
| **Create / reply** to a comment | `POST /{ig-comment-id}/replies` | ✅ yes — `CommentReplyView` |
| **Hide / unhide** a comment | `POST /{ig-comment-id}` `?hide=true` | ❌ **NOT built** |
| **Delete** a comment | `DELETE /{ig-comment-id}` | ❌ **NOT built** |

## Codebase cross-check (verified 2026-07-12)

### ✅ Already present
- **Read comments** — `GET /{ig-user-id}/media` then `GET /{media-id}/comments`.
  - Test-calls command: `api/management/commands/meta_test_calls.py:49-72`.
  - Sync: `analytics/management/commands/sync_comments.py`, model `PostComment`
    (`analytics/models.py:101`).
- **Reply to comment** — `CommentReplyView` at `api/views.py:5089`.
  - IG path: `POST /{comment.external_id}/replies` with the IG access token
    (`api/views.py:5116-5119`). FB path posts to `/comments`.
  - Frontend: `PostCommentInbox.tsx` (comment inbox + reply UI).

### ❌ Missing (needed to fully USE this permission)
- **Hide/unhide a comment** — no `POST /{ig-comment-id}?hide=true|false` anywhere.
- **Delete a comment** — no `DELETE /{ig-comment-id}` anywhere.
  (Note: `PostViewSet.destroy` deletes *posts*, not *comments*.)

## What we need to BUILD so we can test this permission

The test-call requirement can be satisfied with a **read** call (we already have
`GET /{media-id}/comments` in the test-calls command), so the minimum for App
Review may already be met. BUT to genuinely support the permission's stated
"create, delete and hide comments" usage — and to have a strong screencast — we
should add the write operations:

### Backend
1. **`InstagramService.hide_comment(access_token, comment_id, hide: bool)`**
   → `POST /{comment_id}` with `hide=true|false`. (Add to `platforms/services/instagram.py`.)
2. **`InstagramService.delete_comment(access_token, comment_id)`**
   → `DELETE /{comment_id}`. (Same file.)
3. **DRF endpoints** wrapping them, e.g.:
   - `POST /api/comments/{comment_id}/hide/`  → `CommentHideView`
   - `DELETE /api/comments/{comment_id}/`     → `CommentDeleteView`
   Reuse the auth + ownership pattern from `CommentReplyView` (`api/views.py:5089`):
   look up `Comment.objects.get(id=..., post__user=request.user)`, resolve the IG
   `SocialAccount`, call the service with `comment.external_id`.
4. **Add hide + delete calls to the test-calls command** (`meta_test_calls.py`) as
   opt-in (like the `pages_manage_posts` DELETE flow) so a real hide/delete call
   registers with Meta.

### Frontend
5. In **`PostCommentInbox.tsx`**, add **Hide** and **Delete** actions next to each
   comment (buttons → confirm → `commentService.hide(id)` / `.delete(id)`), plus
   the matching methods in the comment service. Reflect state (hidden/removed) in UI.

## Test call — how to satisfy the requirement
- Read call already available: run `python manage.py meta_test_calls` — it fires
  `GET /{media-id}/comments` with the IG token. Wait ≤24h for Meta to register it.
- After building hide/delete, extend the command so a create-reply / hide / delete
  call also registers (stronger evidence + matches the screencast).
