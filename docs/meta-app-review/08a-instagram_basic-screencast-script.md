# Screencast Script — `instagram_basic` (re-submission after 2026-08-04 rejection)

Companion to [`08-instagram_basic.md`](08-instagram_basic.md). This exists because Meta
rejected the previous submission under **Developer Policy 1.6** — the use case was
accepted, the video was not.

---

## Meta's five requirements → where this script satisfies each

| # | Meta requires | Covered in |
|---|---|---|
| 1 | The complete Meta login flow | Scene 2 |
| 2 | A user granting app access to the permission | Scene 3 (consent screen, `instagram_basic` row read aloud) |
| 3 | End-to-end experience of the use case | Scenes 4–6 |
| 4 | English UI, captions, tool-tips, buttons explained | Narration column throughout |
| 5 | Declare if server-to-server / system user token | **N/A — do not claim it.** We use the standard frontend FB Login flow and it is fully visible in the recording. |

---

## Pre-recording code fix (REQUIRED — we already claimed this to Meta)

**Problem:** the notes submitted in the rejected attempt state that SellAnto reads the
account ID, username **and profile picture** "to display the connected Instagram account
within the SellAnto dashboard." **That screen does not exist.** The connected-account
card shows only account name + status (`FacebookConnect.tsx:392-403`), and
`platforms/services/instagram.py:476-477` throws away the `profile_picture_url` it just
fetched at `:466`.

So the rejection is not merely "the video was thin" — the video could not demonstrate
the notes, because the notes describe unbuilt functionality. Meta's wording is precise
on this: *"the use case **described in the submission notes**."*

Two ways to close the gap: build it, or retract the claim. Retracting weakens an
otherwise-accepted use case, so **build it** — it is ~30 lines and is a real product
improvement (users should be able to confirm *which* account they connected).

**Fix (~30 lines), in three parts:**
1. `platforms/services/instagram.py:466` — widen the field list to
   `id,username,followers_count,media_count,profile_picture_url`, and stop discarding
   the extra fields at `:476-477`; return them in the payload.
2. `platforms/oauth_views.py:784-800` (the IG block of the status endpoint) — include
   those fields in the per-account dict returned to the frontend.
3. `FacebookConnect.tsx:392-403` — render avatar + `@username` + "N followers ·
   N posts" in the 📸 Instagram status row.

This is a real product improvement, not a review prop: users connecting an account
should be able to confirm *which* account they connected.

**If you ship the fix, also do this:** change the `/instagram-content` banner at
`InstagramContentPage.tsx:312` from `"instagram_manage_contents active"` to name
`instagram_basic` as well — an on-screen label naming a *different* permission is an
avoidable reviewer distraction.

---

## Recording setup

**This is a plain screen recording of a browser window — no camera, no webcam, no phone.**
You record your own screen while clicking through SellAnto, then upload the MP4 to the
App Review form.

- **Recorder (any of these):**
  - **Windows Game Bar** — press `Win + G`, hit record. Built into Windows 11, zero setup.
    Captures the active window plus microphone.
  - **OBS Studio** — free, best quality/control; use Display Capture + Mic input.
  - **Loom** — easiest for narration, but export the MP4 and upload the file; do not
    submit a Loom share link.
- **Audio:** record a microphone voiceover as you click, OR record silent and add burnt-in
  captions afterwards. One or the other is mandatory (see Captions below).
- **Browser:** clean profile, no extensions, no other tabs. Log out of Facebook first —
  Meta wants the *complete* login flow, not a session that is already authenticated.
- **Test account:** a Facebook account with exactly **one** Page that has **one** linked
  Instagram Business account holding **at least 6–8 real posts** (mixed image + video,
  so the type filters demonstrate something). With multiple Pages a
  `MessengerPagePicker` modal appears (`FacebookConnect.tsx:154-155,285-293`) and the
  flow stops being linear.
- **Language:** app UI in English. Required by Meta.
- **Captions:** burn in on-screen captions or add a voiceover — Meta explicitly asks for
  captions/tool-tips and for buttons to be explained. Silent screen capture is what gets
  rejected.
- **Resolution:** 1080p, cursor visible, no cuts mid-flow. Pause ~2s on each key screen.
- **Length target:** 2–3 minutes.

---

## Scene-by-scene

### Scene 1 — Context (0:00–0:15)
**Screen:** SellAnto dashboard, logged in.
**Narration:**
> "This is SellAnto, a social media management tool. I'll show how we use
> `instagram_basic` to read a connected Instagram Business account's profile
> information and its media, so the user can manage their published content from
> inside our app."

### Scene 2 — Start the Meta login flow (0:15–0:35)
**Screen:** navigate to **`/platforms`** (sidebar: **"Connect Account"**,
`Sidebar.tsx:86`).
**Point at, and read aloud:**
- Page header **"Connect Platforms"** — *"Link your social media accounts to start
  posting"* (`ConnectAccountsPage.tsx:307-308`)
- The Facebook card subtitle: **"Pages · Instagram · Messenger"**
  (`ConnectAccountsPage.tsx:340`) — say *"Instagram is connected through Facebook,
  because Instagram Business accounts are linked to a Facebook Page."*

**Narration:**
> "I click 'Connect Facebook Page'. This button starts the Facebook Login flow and
> requests the permissions our app needs, including `instagram_basic`."

Click **"Connect Facebook Page"** (`FacebookConnect.tsx:76,300-317`). A 650×700 popup
opens (`FacebookConnect.tsx:205`).

### Scene 3 — Login + grant the permission (0:35–1:05) ⭐ REQUIRED
**Screen:** the Facebook popup. **Do not cut or speed up this section.**
1. Show the **Facebook login page**, enter credentials, submit.
2. Show the **Page/Instagram selection** step if Facebook presents it.
3. Show the **consent screen listing the requested permissions.** Hover/point at the
   Instagram row.

**Narration (say the permission name out loud):**
> "Here Facebook shows exactly what SellAnto is asking for. This includes access to
> the profile information and media of my Instagram Business account — that is the
> `instagram_basic` permission. I review it and click Continue to grant access."

Click through to approve. This scene alone satisfies Meta's requirements 1 and 2.

### Scene 4 — Connection confirmed, profile metadata visible (1:05–1:30)
**Screen:** popup closes, back on `/platforms`.

Narrate the button's own state changes as they happen
(`FacebookConnect.tsx:311-315`) — this is free evidence that a real flow is running:
> "'Waiting for login', now 'Setting up Messenger', now 'Refreshing status'."

Then the status card resolves to **"Fully Connected"** — *"Everything is connected and
working"* (`FacebookConnect.tsx:60-65,450`).

**Point at the 📸 Instagram section** (`FacebookConnect.tsx:392-403`):
> "Before I connected, this Instagram section read 'No accounts linked'. Now it shows
> my Instagram Business account."

- **With the pre-recording fix:** point at the avatar, `@username`, and the follower /
  post counts. Say: *"This is exactly what `instagram_basic` gives us — the account's
  username, ID and basic profile metadata — so the user can confirm which account is
  connected."*
- **Without the fix:** you can only point at the account name. Weaker. Compensate by
  leaning harder on Scene 5.

### Scene 5 — Live profile read (1:30–1:45)
**Screen:** scroll to **"Active Node Swarm"** (`ConnectAccountsPage.tsx:919-943`).
Find the Instagram account card, click **"Validate Node"**.

**Narration:**
> "This button re-checks the connection by calling the Instagram API for the account's
> username and profile picture. The confirmation means we successfully read the profile
> metadata."

Toast: **"Credentials validated successfully!"**
Backend: `GET /v21.0/{ig-id}?fields=username,profile_picture_url`
(`platforms/services/instagram.py:461-477`).

### Scene 6 — The core use case: reading the account's media (1:45–2:40) ⭐ THE USE CASE
**Screen:** sidebar → **Engage → "Instagram Content"** (`Sidebar.tsx:92`), route
**`/instagram-content`** (`InstagramContentPage.tsx:226`).

**Narrate on arrival:**
> "This page reads the media published on the connected Instagram Business account."

Read the on-screen subtitle aloud (`InstagramContentPage.tsx:285`):
> *"View and manage all media published to your Instagram Business account."*

Then demonstrate, explaining each control as Meta requires:
1. **The media grid loads** — real posts from the account, via
   `GET /v21.0/{ig-user-id}/media` (`api/views.py:4916`). *"Each tile is a real post
   from my Instagram account — the image, the caption, and the date it was published."*
2. **KPI tiles** — **"Total Posts", "Total Likes", "Total Comments"**
   (`InstagramContentPage.tsx:330-333`). ⚠️ **Skip "Total Reach"** — it renders `—`.
3. **Hover a tile** to reveal like/comment counts (`:184-207`). *"Hovering a post shows
   its engagement counts."*
4. **Type filters** — click **Image**, then **Video**, then **All**
   (`:356-365`). *"These filter the media by type."*
5. **Search box** — type a word, placeholder is *"Search captions…"* (`:351`).
6. **"Load more"** (`:433`) — *"This loads the next page of media using the API's
   pagination cursor."*
7. **"Refresh"** (`:303`) — *"This re-fetches the latest media from Instagram."*

🚫 **Do not click "Archive".** It issues a real `DELETE /v21.0/{media_id}`
(`api/views.py:4940-4955`) and permanently deletes the post.

### Scene 7 — Close (2:40–2:55)
**Narration:**
> "To summarise: the user logs in with Facebook, grants access to their Instagram
> Business account, and SellAnto reads that account's profile metadata and published
> media so the user can review their content in one place. That is our use case for
> `instagram_basic`."

---

## Pre-flight checklist

- [ ] Pre-recording code fix shipped (profile metadata visible on the connected card)
- [ ] `/instagram-content` banner no longer names only `instagram_manage_contents`
- [ ] Logged out of Facebook before recording starts
- [ ] Test account has ONE Page, ONE linked IG Business account, 6+ mixed-type posts
- [ ] App UI language is English
- [ ] Captions or voiceover present throughout; every button clicked is explained
- [ ] Facebook login + consent screen fully visible, uncut
- [ ] `/discover` never opened while recording (routes missing → 404)
- [ ] "Total Reach" tile never pointed at (renders `—`)
- [ ] "Archive" never clicked (deletes the post)
- [ ] `python manage.py meta_test_calls` run; test call registered (≤24h)
- [ ] Submission notes do NOT claim server-to-server / system user token

---

## Submission notes text (paste into the App Review form)

### What was submitted last time (REJECTED — do not reuse)

> SellAnto reads basic Instagram Business account information including the account ID,
> username, and profile picture to display the connected Instagram account within the
> SellAnto dashboard. This information is used to identify which Instagram account is
> linked and to enable all Instagram-specific features (content publishing, comment
> management, media browsing).

Two defects (full analysis in [`08`](08-instagram_basic.md) § Rejection):
1. **Describes an unbuilt screen** — we do not display the profile picture anywhere. The
   reviewer could not find it in the video because it does not exist. Fixed by the
   pre-recording code fix above; do not re-submit this claim until that ships.
2. **Justifies `instagram_basic` using other permissions** — "content publishing,
   comment management" are `instagram_content_publish` and
   `instagram_manage_comments`. Meta reviews each permission in isolation; leaning on
   ungranted scopes invites a Policy 1.6 rejection. Only *media browsing* belongs here.

### Replacement text (use this — every claim maps to a recorded scene)

> SellAnto is a social media management tool for small businesses. Users connect their
> Facebook Page and its linked Instagram Business account through the standard Facebook
> Login flow.
>
> We use `instagram_basic` for two things:
>
> 1. **Identifying the connected account.** After the user grants access, we call
>    `GET /{ig-user-id}?fields=id,username,followers_count,media_count,
>    profile_picture_url` and display the account's username, profile picture and
>    follower/post counts on our "Connect Platforms" screen, so the user can confirm
>    which Instagram Business account is linked before they use it.
> 2. **Displaying the account's published media.** On our "Instagram Content" page we
>    call `GET /{ig-user-id}/media` to list the account's posts with their captions,
>    thumbnails, timestamps and engagement counts, so the user can review everything
>    they have published in one place.
>
> `instagram_basic` is also a technical prerequisite for the other Instagram permissions
> we request, but the two uses above are what this permission delivers on its own.
>
> This is not a server-to-server application and does not use a system user token. The
> full Facebook Login and permission-granting flow is visible in the screencast.

**Claim-to-scene map — verify before submitting.** Every sentence above must be visible
in the recording:

| Claim in notes | Scene | Blocked on |
|---|---|---|
| Standard Facebook Login flow | 2–3 | — |
| Username + picture + counts displayed | 4 | **pre-recording code fix** |
| `GET /{ig-user-id}` profile read | 5 | — |
| Media list with captions/thumbnails/timestamps/engagement | 6 | — |

If the code fix does not ship, delete the profile-picture and counts wording from claim
1 and reduce it to username only — never re-submit a claim the video cannot show.
