# Screencast Script — `pages_manage_posts` (re-submission after 2026-08-04 rejection)

Companion to [`01-pages_manage_posts.md`](01-pages_manage_posts.md). Meta rejected the
previous submission under **Developer Policy 1.6** — the use case was **accepted**, the
video was not.

---

## Meta's five requirements → where this script satisfies each

| # | Meta requires | Covered in |
|---|---|---|
| 1 | The complete Meta login flow | Scene 2 |
| 2 | A user granting app access to the permission | Scene 3 (consent screen, `pages_manage_posts` row read aloud) |
| 3 | End-to-end experience of the use case | Scenes 4–7 (**create** on the Page, then **delete** from the Page) |
| 4 | English UI, captions, tool-tips, buttons explained | Narration column throughout |
| 5 | Declare if server-to-server / system user token | **N/A — do not claim it.** We use the standard frontend FB Login flow and it is fully visible in the recording. |

---

## Good news: NO pre-recording code fix is required

This is **unlike `instagram_basic`** (file 08), where the notes described a screen that
did not exist and the code had to be fixed before recording. Here every claim in the
submitted justification is backed by shipped code:

| Claim in the notes | Code that backs it |
|---|---|
| "publishes the post via `POST /{page_id}/feed`" | `platforms/services/facebook.py:210` `_post_text` → `POST /{page_id}/feed` (v21.0); `:229` `_post_photo` → `/photos`; `:261` `_post_video` → `/videos` |
| "users compose post content inside SellAnto, select a target Page" | `CreatePostPage.tsx` compose + platform picker |
| "set a publish time" | "Schedule Post" button (`CreatePostPage.tsx:863`) → APScheduler `check_and_post` |

**Delete is also fully built and wired**, which matters because Meta's stated allowed
usage is "create **and delete** content on a Page":
`FacebookService.delete_post` (`platforms/services/facebook.py:291`) → `DELETE /{post-id}`
(`:305`), reached from `MyPostsPage` trash → `handleDelete` (`:123`) → `deletePost` →
`DELETE /posts/{id}/` → `PostViewSet.destroy` (`api/views.py:1103-1147`).

So the fix is purely in the recording: last time the video did not show the post going
**live on the real Facebook Page** end to end.

---

## What changed since the rejected attempt — this is now MUCH easier to record

**"Post Now" shipped on `feat/post-now` after the 2026-08-04 rejection.**

The old Instagram script (`04a`) warns "there is **no synchronous publish** … budget ~90s
of wait", because publishing used to mean setting `scheduled_time` to now+1min and waiting
for the 60-second APScheduler tick. **That is obsolete for this recording.**

`POST /api/v1/posts/<id>/publish/` (`PostViewSet.publish`, `api/views.py:1271`) calls the
same `posts.scheduler.publish_post()` the scheduler calls — only the trigger differs. The
UI button is labelled **"Post Now"** (`CreatePostPage.tsx:893`), beside "Schedule Post"
(`:863`), and calls `postService.publishNow` (`postService.ts:143`).

**Result: the post is live by the time the button finishes.** No dead air to edit around.

---

## Recording setup

**A plain screen recording of a browser window — no camera, no webcam, no phone.**

1. **Record against the public HTTPS URL, not `localhost`.** Facebook Login will not
   redirect to `http://localhost`, and `SiteConfiguration` is already set to
   `https://frances-vegetative-vincent.ngrok-free.dev` for both `facebook_redirect_uri`
   and `frontend_url`. Start Django on `:8000` and the ngrok tunnel on that reserved
   domain (it is already in `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`).
2. **Click through the ngrok interstitial BEFORE you hit record.** A free ngrok domain
   shows a "You are about to visit…" warning page on first visit. Visit the URL once,
   click **Visit Site**, and only then start recording — otherwise that page is the first
   thing the reviewer sees.
3. Use a **real Facebook Page you own** and a test post you are happy to publish publicly
   and then delete. The post is genuinely live between Scene 5 and Scene 7.
4. **Record a photo or text post, not a video post.** Video upload adds Meta-side
   processing delay that Post Now cannot skip.
5. Browser at ~1280×720 or larger, zoom 100%, English UI, no other tabs showing
   unrelated accounts. Close the ngrok inspector tab (`:4040`).
6. Turn on captions/annotations in your editor, or narrate — Meta explicitly asks that
   buttons and UI elements be **explained**, not merely clicked.

### The one trap that would sink this specific video

**Record only in the React app (`/posts`), never the legacy Django-template route.**

`posts/views.py:270 delete_post` does a **local `post.delete()` with no Facebook call**.
If the recording deletes through that route, the post disappears from SellAnto while
staying live on the Facebook Page — on video, in a submission whose whole subject is
creating and deleting Page posts. The React trash button (Scene 7) is the correct path
and does call Graph. This legacy view should be removed, or made to call
`FacebookService.delete_post`.

---

## Scene-by-scene

### Scene 1 — Title + what this demonstrates (~15s)
> "This is SellAnto, a social media management tool. I'll show the complete flow for
> `pages_manage_posts`: logging in with Facebook, granting the permission, creating a
> post on my Facebook Page from inside SellAnto, seeing it live on Facebook, and then
> deleting it from the Page — the create and delete usage this permission allows."

Naming the permission out loud, on screen, at the start is worth doing: the reviewer is
checking one permission and should not have to hunt for it.

### Scene 2 — Complete Meta login flow (~30s) — **Meta requirement #1**
1. Show SellAnto logged out → log into SellAnto.
2. Navigate to **Connect Accounts**.
3. Click **Connect Facebook**.
4. **Show the actual Facebook login screen** (email/password, or the account chooser).
   Do not cut from "Connect" straight to "connected" — that cut is the most likely
   reason the last video failed.

> "I click Connect Facebook. This opens Facebook's own login — SellAnto never sees my
> Facebook password."

### Scene 3 — Granting the permission (~30s) — **Meta requirement #2**
1. Show the **Page selection** step (choose the Page you'll post to).
2. Show the **permissions consent screen** and pause on it.
3. **Read the `pages_manage_posts` row aloud** while it is visible, and explain it:

> "Facebook is now asking me to approve the permissions. This row — *create and manage
> Page posts* — is `pages_manage_posts`. This is what lets SellAnto publish the post I
> write here to my Page, and delete it again later. I click Save, then Continue."

4. Show the return to SellAnto with the Page listed as connected.

### Scene 4 — Compose the post (~45s) — **explain the UI (requirement #4)**
In **Create Post**, narrate each control as you use it:
- The caption box — type a clearly identifiable test message.
- (Optional) attach one image.
- The **platform selector** — click the Facebook Page. Say which Page it is.
- Point at **"Schedule Post"** and explain it exists (posts can be scheduled for later
  through the same publishing path) — then say you'll publish immediately instead.

> "I select my Facebook Page as the destination. I could schedule this for later, but
> for this demo I'll publish it right now."

### Scene 5 — Publish (~15s) — **the actual `pages_manage_posts` call**
1. Click **"Post Now"**.
2. Land on the posts list with the post marked **Posted**.

> "I click Post Now. SellAnto calls the Facebook Graph API — `POST /{page-id}/feed` — with
> the Page access token, and the post is now published on my Page."

This is the moment the permission is exercised. Do not cut it.

### Scene 6 — Prove it is live on Facebook (~30s) — **the part that was missing**
1. From the posts list, click the **live post link** for the Facebook post.
   (SellAnto resolves the real permalink via `GET /{post-id}?fields=permalink_url` —
   `_graph_permalink`, `api/views.py:895`.)
2. **Show the post on facebook.com**, on the real Page, with the text you just typed.
3. Let it sit on screen for a few seconds. Optionally show the Page timeline too.

> "Here is that exact post, live on my Facebook Page — the same text I typed in SellAnto."

**This scene is the single most important one in the video.** Meta's rejection is that
the *end-to-end experience* was not shown; the post visibly existing on Facebook, having
been created from inside your app, is that experience.

### Scene 7 — Delete it from the Page (~30s) — **the second half of the allowed usage**
1. Back in SellAnto → **My Posts** → the **trash** icon on that post.
2. Show the confirmation modal and explain it.
3. Confirm the delete.
4. **Go back to the Facebook Page tab and refresh** — show the post is gone.

> "Now I'll delete it. SellAnto calls `DELETE /{post-id}`, which removes it from the Page
> itself, not just from SellAnto. Refreshing my Facebook Page — the post is gone."

### Scene 8 — Close (~10s)
> "That's the full lifecycle: Facebook login, granting `pages_manage_posts`, creating a
> post on the Page from SellAnto, and deleting it from the Page."

**Total runtime: ~3½ minutes.** Do not pad it.

---

## The test call comes free with this recording

The submission still shows **`0 of 1 API call(s) required`**. Scenes 5 and 7 fire real
`POST /{page_id}/feed` and `DELETE /{post-id}` calls with this app's token, so **recording
the screencast satisfies the test-call requirement** — allow up to 24h for Meta to
register it.

To fire it without recording:

```
python manage.py meta_test_calls --exercise-delete
```

**The `--exercise-delete` flag is required.** Without it the command only makes
`GET /{page-id}/published_posts` (`meta_test_calls.py:121`) — and `published_posts` is
readable with `pages_read_engagement`, so it may not count as a `pages_manage_posts` call
at all. The qualifying `POST /feed` + `DELETE` pair is behind that flag (`:132-165`).

---

## Checklist before uploading

- [ ] ngrok interstitial clicked through before recording started
- [ ] Facebook login screen actually visible (Scene 2)
- [ ] Consent screen visible and `pages_manage_posts` named aloud (Scene 3)
- [ ] Post visible **live on facebook.com** (Scene 6)
- [ ] Post visibly **gone from the Page** after delete (Scene 7)
- [ ] Deleted via the React app, not the legacy Django route
- [ ] English UI, buttons explained, captions on
- [ ] No `localhost` in the address bar at any point
- [ ] Do **not** claim server-to-server / system user token
