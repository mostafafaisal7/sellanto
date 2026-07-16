# WhatsApp & Facebook Messenger — permission analysis

**Question:** what Meta permissions do our WhatsApp and Facebook Messenger features need?

**Verified against code 2026-07-12.**

---

## 1. WhatsApp — ❌ NOT a feature (no code)

There is **no WhatsApp integration** in the codebase:
- No WhatsApp Business (WABA) code, no `phone_number_id`, no
  `POST /{phone-number-id}/messages`, no WhatsApp webhook, no WhatsApp models.
- The only hits for "whatsapp" are unrelated strings (docs/reports), not an integration.

**Therefore no WhatsApp permissions are needed** (and none should be requested):
`whatsapp_business_messaging` and `whatsapp_business_management` are **NOT required**
and should NOT be added to the App Review. WhatsApp is also a separate product setup
(WhatsApp Business Platform / Cloud API + a registered phone number), not just a scope.

➡️ **If WhatsApp is wanted as a future feature, it must be BUILT first** (Cloud API
integration + phone number + templates + webhook) before requesting its permissions.
Don't add the scopes speculatively.

---

## 2. Facebook Messenger — ✅ IS a full feature (`messenger_bot` app)

The `messenger_bot` Django app is a complete Messenger automation/chatbot:
- **Receive:** webhook at `/messenger/webhook/` — GET verify (`hub.mode`/
  `hub.verify_token`/`hub.challenge`) + POST message events
  (`messenger_bot/views.py:397+`). Subscribes to
  `messages,messaging_postbacks,messaging_optins` (`message_handler.py:585,1075`).
- **Send:** `POST /me/messages` with the **page access token** — text, attachments,
  and voice/audio (`message_handler.py:850,1071`), `messaging_type=RESPONSE`.
- RAG-based AI replies, e-commerce settings, notifications, conversation storage.

### ⭐ Admin kill-switch (verified fully wired)
- `SiteConfiguration['messenger_feature_enabled']` (default `'true'`).
- Central helper `accounts/utils.py:4 is_messenger_enabled()`.
- **Enforced (not just cosmetic):**
  - Webhook POST short-circuits with `200 OK` and does nothing when disabled
    (`messenger_bot/views.py:440-442`) — correct pattern (keeps Meta happy).
  - Webhook GET verify gated (`views.py:53`).
  - Signals gated (`messenger_bot/signals.py:135`).
  - Connect page blocked when disabled (`_messenger_disabled_response`, `views.py:62`).
- Admin UI toggle: `FacebookSettingsPanel.tsx:204-247` → `PATCH` admin settings →
  `api/admin_views.py:844-852` writes the flag. ✅ full loop, works.

### ⚠️ IMPORTANT NUANCE — connect is MANUAL token paste, NOT Facebook OAuth
- The Messenger connect flow (`connect_messenger`, `views.py:60`) uses
  `MessengerConnectionForm` whose fields are **`page_name, page_id,
  page_access_token, greeting_text`** (`messenger_bot/forms.py:13-42`, hint:
  "Get from Graph API Explorer", "Long-lived Page Access Token").
- So today the user **pastes a Page access token by hand** — Messenger does NOT go
  through the app's Facebook OAuth (`FB_SCOPES`) at all. That's why it "works" without
  `pages_messaging` in the OAuth scopes: the pasted token already carries whatever the
  user granted in Graph API Explorer.
- **Implication for App Review:** to make Messenger a real, self-serve product for
  non-admin users (connect via "Login with Facebook" instead of pasting tokens), we
  must both (a) add `pages_messaging` to the OAuth flow AND (b) build an OAuth-based
  page-connect for Messenger (auto-fetch page_id + page token + subscribe the page).
  Until then, `pages_messaging` App Review only matters if we move off manual tokens.

### FULL capability inventory — what our Messenger code actually does
Enumerated from `message_handler.py` + `views.py` (2026-07-12):

| # | Capability | Graph API call | Permission required |
|---|---|---|---|
| A | Receive inbound messages (webhook) | webhook field `messages` | **`pages_messaging`** |
| B | Receive postbacks / referrals | fields `messaging_postbacks`, `messaging_optins` (`views.py:489`, subscribed `message_handler.py:585`) | **`pages_messaging`** |
| C | Receive image/file/sticker attachments | webhook `message.attachments` (`views.py:501`) | **`pages_messaging`** |
| D | Send text reply (auto-chunked ≤2000) | `POST /me/messages` `messaging_type=RESPONSE` (`message_handler.py:1071`) | **`pages_messaging`** |
| E | Send voice/audio attachment | `POST /me/messages` attachment=audio (`message_handler.py:850`) | **`pages_messaging`** |
| F | Read the messaging user's name + profile pic | `GET /{PSID}?fields=name,first_name,last_name,profile_pic` (`message_handler.py:538`) | **`pages_messaging`** (User Profile API — name/pic come with pages_messaging; NOT `public_profile`) |
| G | Read page conversations + participants | `GET /{page-id}/conversations?fields=participants` (`message_handler.py:583`) | **`pages_messaging`** + **`pages_read_engagement`** |
| H | Subscribe page to app webhook | `POST /{page-id}/subscribed_apps?subscribed_fields=messages,...` | **`pages_manage_metadata`** |
| I | Debug/validate token permissions | `GET /debug_token` (`views.py:863`) | app token only (no user perm) |

### Permissions Messenger needs — the FULL set (not just one)
| Permission | Needed for | In our current OAuth scopes? |
|---|---|---|
| **`pages_messaging`** | A–G: the entire send/receive + user-name/pic + conversations surface | 🔴 **NOT in `FB_SCOPES`** |
| **`pages_manage_metadata`** | H: subscribe the page to the messaging webhook | ✅ in `FB_SCOPES` (`oauth_views.py:57`) |
| **`pages_read_engagement`** | G: read conversations/participants context | ✅ in `FB_SCOPES` |
| **`pages_show_list`** | list the user's pages to connect (OAuth connect only) | ✅ in `FB_SCOPES` |
| (`pages_messaging_subscriptions`) | ONLY if we send **outside the 24h window** via message tags / subscription messaging. Today we only send `messaging_type=RESPONSE` (inside 24h) → **NOT needed now** | not requested |
| (`public_profile`) | basic profile — comes implicitly; name/pic for a PSID come via `pages_messaging`, so no separate request | n/a |

### 🔴 GAP FOUND — `pages_messaging` is missing from `FB_SCOPES`
- Current scopes (`platforms/oauth_views.py:55-75`): pages_show_list,
  pages_manage_metadata, pages_manage_posts, pages_read_engagement, instagram_basic,
  instagram_content_publish, instagram_manage_comments, instagram_manage_contents,
  leads_retrieval, ads_management, ads_read, pages_manage_ads.
- **`pages_messaging` is NOT there.** Yet the Messenger bot code sends via
  `/me/messages` and subscribes to messaging webhooks.
- **Consequence:** Messenger send/receive works today only because the **app admin's**
  token has messaging in dev tier. For **real (non-admin) users**, without
  `pages_messaging` granted at OAuth + approved via App Review (Advanced Access),
  Messenger automation will **fail** for them.

## What we need to BUILD / DO for Messenger

### Backend (small)
1. **Add `pages_messaging` to `FB_SCOPES`** (`platforms/oauth_views.py:55`) so users
   grant it during Facebook OAuth. (Verify it doesn't break the consent screen — it's
   a valid, common scope, so it should be fine, unlike `instagram_manage_insights`.)
2. **Add `pages_messaging` test call(s) to `meta_test_calls.py`** — e.g. subscribe the
   page (`POST /{page-id}/subscribed_apps`) and/or a `GET /{page-id}/conversations`
   read, so a qualifying call registers for App Review.

### App Review
3. **Submit `pages_messaging` for Advanced Access** with a screencast showing the
   Messenger chatbot receiving a user message and auto-replying. Justification: "SellAnto
   provides an AI Messenger chatbot that auto-responds to customer messages on the
   user's Facebook Page via the Messenger Platform."
4. (Only if we send outside the 24h window) also request
   **`pages_messaging_subscriptions`** / configure message tags.

### Frontend
- Already present: Messenger bot connect + config UI (`MessengerBotPage.tsx`,
  admin Facebook settings for verify token/webhook). No new UI strictly required for
  the permission, but the connect flow must request `pages_messaging`.

## Summary
| Feature | Exists? | Permissions needed | Action |
|---|---|---|---|
| **WhatsApp** | ❌ no | (none yet) `whatsapp_business_messaging` + `whatsapp_business_management` only if built | Don't request. Build first if wanted. |
| **FB Messenger** | ✅ yes (`messenger_bot`) | **`pages_messaging`** + pages_manage_metadata/show_list/read_engagement (have) | See below |

### Messenger — what actually needs doing (corrected after full check)
1. **Admin toggle** — ✅ done & fully enforced (kill switch gates webhook + connect).
   Nothing to do.
2. **`pages_messaging`** — required for a real self-serve product. BUT the connect flow
   is currently **manual token paste** (Graph API Explorer), which sidesteps OAuth, so
   the scope isn't strictly needed *for the admin's own manual setup*. To productize:
   - [ ] Build **OAuth-based Messenger page connect** (Login with FB → list pages →
         pick page → auto-store page_id + long-lived page token → `POST
         /{page-id}/subscribed_apps` to subscribe the webhook).
   - [ ] Add **`pages_messaging`** to `FB_SCOPES` (`platforms/oauth_views.py:55`).
   - [ ] Add a `pages_messaging` **test call** to `meta_test_calls.py`.
   - [ ] Submit `pages_messaging` for **Advanced Access** with a chatbot screencast.
3. **WhatsApp** — not built; no permissions. Build Cloud API first if wanted.
