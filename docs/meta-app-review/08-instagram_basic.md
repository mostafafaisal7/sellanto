# Permission: `instagram_basic`

**Source:** Meta App Dashboard → App Review → "Tell us why you're requesting instagram_basic"

**Status:** 🔴 **REJECTED 2026-08-04 04:16** — Developer Policy 1.6, screencast not aligned
with use case. Re-submission pending. See [Rejection](#rejection-2026-08-04) below.

## What the permission does (per Meta's description)
> The `instagram_basic` allows your app to read an Instagram account profile's info
> and media. The allowed usage for this permission is to get basic metadata of an
> Instagram Business account profile, for example username and ID. You may also use
> this permission to request analytics insights to improve your app and for marketing
> or advertising purposes, through the use of aggregated and de-identified or
> anonymized information (provided such data cannot be re-identified).

## Actions this permission grants
| Action | Graph API call | In our system? |
|---|---|---|
| Read IG profile metadata (id, username, followers, media_count, picture) | `GET /{ig-user-id}?fields=...` | ⚠️ partial — fetched, not fully displayed |
| Read the account's media list | `GET /{ig-user-id}/media` | ✅ yes |

---

## Rejection (2026-08-04)

> **Screencast Not Aligned with Use Case Details** — Developer Policy 1.6 - Build a
> Trustworthy Product
>
> We have determined that your apps' use case is allowed, however, the submitted
> screencast fails to demonstrate the end-to-end experience of the use case described
> in the submission notes, hence the requested permission/feature is rejected.

Meta requires the new screencast to contain:
1. The complete Meta login flow
2. A user granting app access to the permission/feature
3. The end-to-end experience of the use case for the requested permission
4. English UI language, captions/tool-tips, explanation of buttons and UI elements
5. A statement if the app is server-to-server / uses a system user token (ours is
   **not** — we use the standard frontend Facebook Login flow, so this does not apply)

**Key reading:** the written justification was ACCEPTED ("your apps' use case is
allowed"). Do not change the *use case*. But the notes as worded **over-claimed** — see
below — so they must be tightened before re-submission.

### Text submitted in the rejected attempt (verbatim)

> SellAnto reads basic Instagram Business account information including the account ID,
> username, and profile picture to display the connected Instagram account within the
> SellAnto dashboard. This information is used to identify which Instagram account is
> linked and to enable all Instagram-specific features (content publishing, comment
> management, media browsing).

### 🔴 Two defects in that text

**1. It describes a screen that does not exist.** The notes promise we display the
**profile picture** of the connected account in the dashboard. We do not:
- `FacebookConnect.tsx:392-403` renders only `account_name` + a status badge.
- `platforms/services/instagram.py:466` requests `profile_picture_url`, then
  `:476-477` **discards it** — only `@username` is propagated.
- No connected-account screen renders an IG profile picture anywhere in the app.

A reviewer reading "display... profile picture", then watching the video and finding no
such screen, lands exactly on *"screencast fails to demonstrate the end-to-end
experience of the use case **described in the submission notes**."* The mismatch is not
only that the video was thin — the notes described functionality that isn't built.

➡️ Because we have already claimed this to Meta, the profile-metadata fix in
[`08a`](08a-instagram_basic-screencast-script.md) § "Pre-recording code fix" is now
**required**, not optional. The alternative is retracting the claim, which weakens an
otherwise-accepted use case.

**2. It justifies `instagram_basic` by pointing at other permissions.** *"...to enable
all Instagram-specific features (content publishing, comment management, media
browsing)"* — content publishing is `instagram_content_publish`, comment management is
`instagram_manage_comments`. Meta reviews each permission in isolation, and a Policy 1.6
reviewer reacts badly to a justification leaning on scopes not yet granted. Only **media
browsing** is genuinely `instagram_basic`. Keep the prerequisite relationship as a
closing sentence, not as the core rationale.

Corrected notes text: [`08a`](08a-instagram_basic-screencast-script.md) § "Submission
notes text".

---

## Codebase cross-check (re-verified 2026-08-17) — ⚠️ PARTIALLY COVERED

### What genuinely works
- **Media list (strongest evidence):** `GET /v21.0/{ig-user-id}/media` with
  `fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,
  like_count,comments_count&limit=20` plus cursor paging —
  `api/views.py:4901-4937` (`InstagramContentView`), routed at `api/urls.py:564`,
  rendered by `frontend/src/pages/InstagramContentPage.tsx:226`.
- **Credential validation / username read:** `InstagramService.validate_credentials()`
  → `GET /v21.0/{business_account_id}?fields=username,profile_picture_url` —
  `platforms/services/instagram.py:461-477`. Triggered from the UI by the
  **"Validate Node"** button (`ConnectAccountsPage.tsx:250`).
- **Connect flow:** `instagram_basic` is in `FB_SCOPES` at
  `platforms/oauth_views.py:60`. OAuth callback fetches
  `GET /me/accounts?fields=...,instagram_business_account{id,name,username}` at
  `oauth_views.py:317` and persists a `platform='instagram'` `SocialAccount` at
  `oauth_views.py:430-464`.
- **Test call:** `api/management/commands/meta_test_calls.py:87-100`, labeled
  `instagram_basic`, calls
  `GET /{ig-user-id}?fields=id,username,followers_count,media_count,profile_picture_url`.

### 🔴 Gap that caused (or contributed to) the rejection
Meta's allowed usage is *"basic metadata of an Instagram Business account profile, for
example username and ID."* **No screen in the app currently displays that metadata for
the connected account.**

- The connected-account card shows only `account_name` + a status badge —
  `FacebookConnect.tsx:392-403`.
- `platforms/services/instagram.py:466` requests `username,profile_picture_url` but the
  return at `:476-477` propagates only `@username`; the picture URL is **discarded**.
- `followers_count` / `media_count` are fetched **only** by the CLI test-call command
  (`meta_test_calls.py:91-100`) — never surfaced in the product.

Consequence: the most on-point moment in a screencast (a live profile read) is visible
to a reviewer only as a success toast, with no metadata on screen. This is very likely
what "fails to demonstrate the end-to-end experience" refers to.

**Recommended fix before re-submission** — see
[`08a-instagram_basic-screencast-script.md`](08a-instagram_basic-screencast-script.md)
§ "Pre-recording code fix".

### ⚠️ Screens that must NOT appear in the screen recording
| Screen | Why | Ref |
|---|---|---|
| `/discover` | Calls `GET /api/v1/instagram/discover/profile/` and `/instagram/discover/hashtag/` — **neither route exists** in `api/urls.py`. Page 404s live. It is the only screen rendering IG profile pic + followers + media count, so it is tempting — do not use it. | `DiscoverPage.tsx:80,84,361-385` |
| "Total Reach" KPI tile | Backend never returns `reach`/`impressions`; tile renders the literal `—`. | `InstagramContentPage.tsx:333`, `api/views.py:4924-4935` |
| "Archive" button on a media card | Despite the label, it issues a real `DELETE /v21.0/{media_id}` — it permanently deletes the post. | `api/views.py:4940-4955` |
| Permission banner on `/instagram-content` | Reads **"instagram_manage_contents active"** — the wrong permission name on screen for an `instagram_basic` review. Either crop it, or update the label. | `InstagramContentPage.tsx:312` |

## Test call — how to satisfy the requirement
`GET /{ig-user-id}?fields=id,username,...` is already in the test-calls command. Run
`python manage.py meta_test_calls`; wait ≤24h for Meta to register it.

## Notes
- `instagram_basic` is a prerequisite for the other IG permissions
  (`instagram_content_publish`, `instagram_manage_comments`,
  `instagram_manage_contents`) — all of which we already use. Low-risk, standard scope.
- Our app is **not** server-to-server and does **not** use a system user token. The
  frontend Facebook Login flow is fully visible, so Meta's point (5) does not apply and
  should not be claimed.
