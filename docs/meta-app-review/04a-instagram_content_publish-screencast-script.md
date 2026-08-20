# Screencast Script — `instagram_content_publish` (re-submission after 2026-08-04 rejection)

Companion to [`04-instagram_content_publish.md`](04-instagram_content_publish.md).
Rejected **2026-08-04 4:16 AM** under **Developer Policy 1.6 — "Screencast Not Aligned
with Use Case Details"**, same template as the `instagram_basic` rejection
([08a](08a-instagram_basic-screencast-script.md)).

---

## Diagnosis — this rejection is NOT the same as `instagram_basic`

The `instagram_basic` rejection had a **code** defect: the notes described a screen
(profile picture + username) that did not exist, so no video could have demonstrated it.

**`instagram_content_publish` has no code defect.** Verified 2026-08-17:

| Claim in the submitted notes | Reality |
|---|---|
| "creates a media container via `POST /{ig_user_id}/media`" | ✅ `platforms/services/instagram.py:299` |
| "publishes it via `POST /{ig_user_id}/media_publish`" | ✅ `platforms/services/instagram.py:382` |
| "photos, videos, and reels" | ✅ videos use `media_type=REELS` (`instagram.py:308`) |
| "schedule Instagram posts for a future time" | ✅ `CreatePostPage.tsx` date/time + `posts/scheduler.py:386` |

Every sentence of the justification is backed by shipped code. **Do not rewrite the
justification** — Meta already said "your apps' use case is allowed." The failure was
purely that the video did not show the **end-to-end** flow: login → consent → compose →
**published post visible on Instagram**.

The most likely defect in the rejected video: it showed the post being *scheduled* (or
the app's own success toast) but never showed **the post actually live on the real
Instagram account**. That is the single most important shot in this recording.

### Pre-flight verification (2026-08-17, all green)
```
IG account                   : customoobd (17841477940902567)
FB page                      : Customoo (877455748776936)
instagram_access_token       : present
facebook_access_token        : present
content_publishing_limit     : quota_usage 0 / 100 per 86400s
instagram_content_publish    : present in token
==> PUBLISH READY: YES
```

---

## Two constraints that will break the recording if ignored

**1. Instagram publishing requires the Facebook Page too.**
`posts/scheduler.py:396-419` reads `facebook_page_id` + `facebook_access_token` from the
user's **Facebook** account, uploads the media to the Page as unpublished, then hands the
resulting URL to the IG container. If the FB account is missing/inactive the post fails
with *"Facebook account required for Instagram posting"*. So during the OAuth scene you
must connect **Facebook**, not just Instagram. (This is also why the consent screen is
genuinely part of the publish use case — good for the reviewer to see.)

> ⚠️ **Fixed 2026-08-17 — the scheduler did not start under `runserver --noreload`.**
> `posts/apps.py:28` returned early unless `RUN_MAIN == 'true'`, an env var Django
> only sets when the auto-reloader is active. With `--noreload` the scheduler never
> started, so scheduled posts sat at `scheduled` forever and the UI showed
> "Failed to publish". If you start the server with `--noreload`, verify the log
> prints `[SCHEDULER] Auto-posting scheduler active` before recording.

**2. There is no synchronous "publish now" call.**
Publishing always goes through the APScheduler job `check_and_post`, which runs
**every 60 seconds** (`posts/scheduler.py:35-38`). Clicking "Publish Now" sets
`scheduled_time` to now + 1 minute (`CreatePostPage.tsx:215-221`) — it does not post
instantly. **Budget up to ~90 seconds of wait**, and for a video/reel considerably more
(the service sleeps 60s for processing at `instagram.py:330` plus FB video polling).

> **Recommendation: record a PHOTO post, not a video/reel.** A photo takes ~10s of
> processing vs. 60-120s+ for a reel. The permission covers both; you only need to
> demonstrate one. Mention reels verbally instead of filming one.

Do **not** cut the video during the wait — a jump cut looks like the result was faked.
Either let it run with narration, or use a *visible* speed-up with a caption
("waiting for the scheduler — sped up 4×").

---

## Meta's five requirements → where this script satisfies each

| # | Meta requires | Covered in |
|---|---|---|
| 1 | The complete Meta login flow | Scene 2 |
| 2 | A user granting app access to the permission | Scene 3 (consent screen, `instagram_content_publish` row read aloud) |
| 3 | End-to-end experience of the use case | Scenes 4–7 (**Scene 7 is the one that was missing**) |
| 4 | English UI, captions, tool-tips, buttons explained | Narration column throughout |
| 5 | Declare if server-to-server / system user token | **N/A — do not claim it.** Standard frontend FB Login, fully visible. |

---

## Recording setup

Identical to [08a](08a-instagram_basic-screencast-script.md#recording-setup):

- **Log out of Facebook first** — requirement #1 is the *complete* login flow. If you are
  already logged in, Meta sees a one-click "Continue as…" and rejects again.
- One FB Page (**Customoo**) + one IG Business account (**customoobd**).
- English UI, captions on, tool-tips explained aloud.
- 1080p, Game Bar / OBS / Loom.
- Have the image file ready on the desktop **before** you hit record.
- Open a second browser tab with **instagram.com/customoobd** already loaded (for Scene 7).

---

## Scene-by-scene script

### Scene 1 — App overview (~15s)
Land on the SellAnto dashboard, logged in to SellAnto but **not** Facebook.

> "This is SellAnto, a social media management tool. I'll show how a business publishes
> a photo to their Instagram Business account from inside SellAnto."

### Scene 2 — Complete Meta login flow (~30s) — *requirement #1*
Go to **Connect Accounts** → click **Connect** on the Facebook card → the real
facebook.com login page appears → type email + password → submit.

> "I'm clicking Connect on the Facebook card. This opens Facebook's own login page.
> Instagram Business accounts are managed through a Facebook Page, so connecting
> Facebook is what links the Instagram account."

### Scene 3 — Granting the permission (~30s) — *requirement #2*
The consent screen appears. **Slow down here.** Scroll through the permission list and
read the relevant row aloud.

> "Facebook is now asking me to grant SellAnto a set of permissions. This row —
> *Publish content to Instagram* — is `instagram_content_publish`. Granting it lets
> SellAnto post photos and videos to my Instagram Business account on my behalf.
> I'll select my Page, Customoo, and my Instagram account, then click Save / Continue."

> ⚠️ The consent screen now lists **13 scopes**, including `pages_messaging`. That is
> expected. Keep narration on the Instagram row; do not draw attention to the others.

### Scene 4 — Connection confirmed (~15s)
Back on Connect Accounts. The Instagram card now shows the avatar, `@customoobd`,
follower/post counts, and the account ID.

> "SellAnto now shows the connected Instagram Business account — the username,
> profile picture, and account ID — so I can confirm the right account is linked."

### Scene 5 — Compose the post (~45s) — *the use case begins*
Navigate to **Create Post**.

1. In **Select Platforms**, click the **Instagram** tile. Point out it turns highlighted
   and reads "2,200 chars".
   > "I'm selecting Instagram as the destination. SellAnto shows Instagram's 2,200
   > character caption limit."
2. Upload the photo. Wait for the preview thumbnail.
   > "I'm attaching the photo that will be published to the Instagram feed."
3. Type a caption — use something clearly identifiable so the reviewer can match it
   later, e.g. **"App Review test post — SellAnto"** plus the date.
   > "This is the caption that will appear on the Instagram post."
4. Show the live preview panel with the Instagram chip.

### Scene 6 — Publish (~60-90s) — *the API calls fire here*
Click **Publish Now**.

> "I'm clicking Publish Now. SellAnto uploads the image, creates an Instagram media
> container using the media endpoint, waits for Instagram to process it, and then
> publishes it to the main feed."

Then navigate to **My Posts** and let the status update.

> "The post appears in My Posts. The status is updating from scheduled to published —
> this takes up to a minute while Instagram processes the media."

**Keep recording until the status reads Published.** If you speed this up, caption it.

> 💡 Optional but strong: briefly show the terminal running the Django server. Its live
> log prints `Creating IMAGE container...`, the container ID, then
> `[OK] SUCCESS! Post ID: …`. This is direct visual proof of the two Graph calls Meta
> is reviewing. Only do this if the log has no secrets on screen.

### Scene 7 — Verify on Instagram (~30s) — **THE SHOT THAT WAS MISSING**
Switch to the second browser tab and open **instagram.com/customoobd**. Refresh. The new
post is at the top of the grid. Click it so the caption is readable.

> "And here is the same post, now live on the real Instagram account — same photo,
> same caption. That completes the end-to-end flow: connect the account, grant the
> permission, compose in SellAnto, and publish to the Instagram feed."

Optionally return to SellAnto → **My Posts** → show the "View on Instagram" permalink
resolving to the same post.

### Scene 8 — Scheduling (~20s, optional but recommended)
The notes claim scheduling, so show it exists even if you don't wait for it to fire.

> "SellAnto can also schedule Instagram posts. Here I pick a future date and time —
> the post is queued and published automatically at that time."

Compose a second post, set a future date/time, click Schedule, and show it in
**My Posts** with a "Scheduled" status. You do not need to wait for it to publish.

---

## Pre-flight checklist

- [ ] Logged **out** of Facebook
- [ ] Photo file ready on the desktop (`.jpg`/`.png`)
- [ ] Django server running; frontend built; APScheduler active (log shows
      `[SCHEDULER] Auto-posting scheduler active (checks every 60 seconds)`)
- [ ] `instagram.com/customoobd` open in a second tab
- [ ] Publishing quota has room (was 0/100 on 2026-08-17)
- [ ] English UI, captions on
- [ ] Caption text is distinctive so the reviewer can match app ↔ Instagram

## Screens that must NOT appear

| Screen | Why |
|---|---|
| `/discover` | Calls unrouted endpoints → 404s |
| "Total Reach" tile | Renders `—` (no data) |
| **"Archive" button** on Instagram Content | Issues a real `DELETE /v21.0/{media_id}` — **permanently deletes the post** |
| Any non-English UI | Violates requirement #4 |
| Terminal output containing tokens | Leaks credentials |

---

## Submission notes — keep the existing text, add one paragraph

The current justification is accurate and its use case was **accepted**. Do not rewrite
it. Append this so the reviewer knows where to look:

> The screencast demonstrates the complete flow end to end: logging in to Facebook,
> granting the `instagram_content_publish` permission on the Meta consent screen,
> composing a photo post with a caption inside SellAnto, publishing it, and finally
> showing the published post live on the Instagram Business account itself. Note that
> publishing is executed by a background job that runs once per minute, so there is a
> short delay between clicking Publish and the post appearing; this is visible in the
> recording. Instagram publishing also requires the linked Facebook Page, because the
> media is staged on the Page before the Instagram media container is created.

### Claim → scene map (for your own check before uploading)

| Claim in the notes | Scene |
|---|---|
| "publish photos, videos, and reels" | 5-6 (photo filmed; reels mentioned) |
| "creates a media container via `POST /{ig_user_id}/media`" | 6 (+ server log) |
| "publishes it via `POST /{ig_user_id}/media_publish`" | 6-7 |
| "to their connected Instagram Business account" | 4, 7 |
| "schedule Instagram posts for a future time" | 8 |
