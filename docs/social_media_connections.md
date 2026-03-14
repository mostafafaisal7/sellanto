# SocialSync-AI — Social Media Connection System
## Deep Technical Reference: How Platform Connections Work

**Version:** V1.2.4 | **Last Updated:** 2026-03-12

---

## 1. OVERVIEW

The platform uses a **manual token-entry model** — there is NO OAuth redirect flow implemented. Users must:
1. Go to their Facebook/Twitter/LinkedIn developer portal
2. Copy their page access token
3. Paste it into SocialSync

This is important to understand — the system does NOT redirect users to Facebook's login page. It receives credentials directly.

**9 supported platforms:** facebook, instagram, twitter, linkedin, tiktok, youtube, pinterest, telegram, messenger

---

## 2. DATA MODEL (platforms/models.py)

### SocialAccount — The Core Model

One `SocialAccount` row = one connected platform account for a user.

```
User (Django auth)
└── SocialAccount (many per user)
    ├── platform = 'facebook' | 'instagram' | 'twitter' | ...
    ├── account_name (display name)
    ├── status = 'active' | 'expired' | 'invalid' | 'disconnected'
    ├── is_validated (bool)
    ├── is_active (bool)
    ├── token_expires_at (DateTimeField, nullable)
    ├── last_validated_at
    ├── validation_error (last error message)
    └── [platform-specific credential fields — see below]
```

**DB Table:** `social_accounts`
**Unique constraint:** `(user, platform, account_name)` — one row per user+platform+name combo

### Platform-Specific Credential Fields

| Platform | Fields Stored in SocialAccount |
|----------|-------------------------------|
| Facebook | `facebook_page_id`, `facebook_access_token` |
| Instagram | `instagram_access_token`, `instagram_business_account_id` |
| Twitter/X | `twitter_api_key`, `twitter_api_secret`, `twitter_access_token`, `twitter_access_token_secret` |
| LinkedIn | `linkedin_access_token`, `linkedin_person_urn` |
| TikTok | `tiktok_access_token`, `tiktok_refresh_token` |
| YouTube | `youtube_access_token`, `youtube_refresh_token`, `youtube_channel_id` |
| Pinterest | `pinterest_access_token`, `pinterest_board_id` |
| Telegram | `telegram_bot_token`, `telegram_channel_id` |
| Messenger | (shares facebook_page_id + facebook_access_token) |

**SECURITY NOTE:** All tokens stored as **plaintext** TextField/CharField in the database. No encryption.

### Key Model Methods

```python
account.get_credentials()   # → dict of platform credentials
account.is_token_expired()  # → bool (checks token_expires_at vs now())
account.mark_as_expired()   # → status = 'expired'
account.mark_as_invalid()   # → status = 'invalid', stores error
account.mark_as_active()    # → status = 'active', is_validated = True
```

---

## 3. API ENDPOINTS (Connecting Platforms)

**File:** `api/urls.py` → `api/views.py`

| ViewSet | Endpoint | Purpose |
|---------|----------|---------|
| `SocialAccountViewSet` | `/api/v1/platforms/` | Read-only view (no credentials) |
| `SocialAccountDetailViewSet` | `/api/v1/platforms-detail/` | Full CRUD + validation |

### Connect / Update Account

```
POST /api/v1/platforms-detail/
Authorization: Bearer <JWT>

Body (Facebook example):
{
  "platform": "facebook",
  "account_name": "My Business Page",
  "facebook_page_id": "123456789",
  "facebook_access_token": "EAABsbCS..."
}
```

**What happens internally (`api/views.py`):**

```
1. Validate request data
2. Check plan limit: user.profile.can_add_account()
   → raises 400 if at limit (max_social_accounts per plan)
3. SocialAccount.update_or_create(user=user, platform=platform)
   → creates new or updates existing
4. Run immediate validation:
   → FacebookService.validate_credentials(page_id, token)
   → Updates account.status + account.is_validated
5. SPECIAL: if platform == 'messenger':
   → Also creates/updates MessengerConnection model
   → Also creates AIConfiguration for the bot
6. Return 201 or 200 with account data
```

### Validate Credentials

```
POST /api/v1/platforms-detail/{id}/validate_credentials/
→ Re-runs validation for existing account
→ Updates status to 'active' or 'invalid'
```

---

## 4. FACEBOOK CONNECTION — FULL DETAIL

### 4.1 What the User Does

1. Go to Facebook Business → Get a **Page Access Token**
2. Find their **Page ID**
3. Paste both into SocialSync
4. System validates by calling Graph API

### 4.2 Token Type Auto-Detection

**File:** `platforms/services/facebook.py` → `FacebookService._get_page_token()`

Facebook has two types of tokens:
- **User Access Token** — lasts 2 hours, can get page tokens from it
- **Page Access Token** — lasts 2 months, directly usable

The system handles both:

```python
def _get_page_token(page_id, access_token):
    # Step 1: Check token type via debug_token endpoint
    GET https://graph.facebook.com/v18.0/debug_token
      ?input_token={access_token}&access_token={access_token}

    # If type == 'PAGE' → use as-is
    # If type == 'USER' → exchange for Page token:
    GET https://graph.facebook.com/v18.0/{page_id}
      ?fields=access_token&access_token={user_token}
    → Returns: page-specific access token
```

### 4.3 Credential Validation

```python
FacebookService.validate_credentials(page_id, access_token):
    GET https://graph.facebook.com/v18.0/{page_id}
      ?fields=id,name&access_token={token}

    → Success: returns (True, page_name)
    → Failure: returns (False, error_message)
```

### 4.4 Publishing to Facebook

**File:** `platforms/services/facebook.py`

```
FacebookService.post_to_facebook(page_id, access_token, caption, media_path)
    ↓
    Detects media type:
    ├─ No media → _post_text()
    ├─ .mp4/.mov/.avi → _post_video()
    └─ Other → _post_photo()
```

**Text post:**
```python
POST https://graph.facebook.com/v18.0/{page_id}/feed
Body: {'message': caption, 'access_token': token}
Returns: {'id': post_id}
```

**Photo post:**
```python
POST https://graph.facebook.com/v18.0/{page_id}/photos
Body (multipart): {'source': file_bytes, 'caption': caption, 'access_token': token}
Returns: {'id': photo_id}
```

**Video post:**
```python
POST https://graph.facebook.com/v18.0/{page_id}/videos
Body (multipart): {'source': file_bytes, 'description': caption, 'access_token': token}
Returns: {'id': video_id}
```

### 4.5 Token Lifespan

| Token Type | Duration | Notes |
|-----------|---------|-------|
| User Token | 2 hours | Auto-exchanged for Page token |
| Page Token | ~2 months | Stored in DB |
| Long-lived User Token | 60 days | Not implemented |

**No refresh mechanism** — users must manually reconnect when token expires.

---

## 5. INSTAGRAM CONNECTION — FULL DETAIL

### 5.1 Critical Fact: Instagram Uses Facebook API

Instagram publishing goes through the **Facebook Graph API**, NOT Instagram's native API.

Requirements:
- Instagram Business or Creator account
- Connected to a Facebook Page
- `instagram_business_account_id` (different from regular Instagram ID)
- Facebook Page access token (from the connected Facebook SocialAccount)

### 5.2 Publishing Flow (5 Steps)

**File:** `platforms/services/instagram.py`

```
post_instagram(post, account, caption, media_files):

    Step 1 — Upload media to Facebook Page
    ├─ POST https://graph.facebook.com/v18.0/{page_id}/photos
    │  Body: {source: file, published: false, access_token: fb_token}
    └─ Returns: fb_media_id

    Step 2 — Get media URL from Facebook
    ├─ GET https://graph.facebook.com/v18.0/{fb_media_id}
    │  ?fields=images (for photo) or fields=source,status (for video)
    ├─ Video: POLL every 10s until status.video_status == 'ready'
    │  (max 2 minutes)
    └─ Returns: media_url (Facebook CDN URL)

    Step 3 — Create Instagram Media Container
    ├─ POST https://graph.facebook.com/v18.0/{instagram_business_id}/media
    │  Body: {
    │    image_url: media_url,           ← URL from Facebook CDN
    │    media_type: 'IMAGE' or 'REELS',
    │    caption: caption,
    │    access_token: instagram_token,
    │    share_to_feed: True             ← for videos
    │  }
    └─ Returns: container_id

    Step 4 — Wait for Processing
    ├─ sleep(10) for images
    ├─ sleep(60) for videos
    └─ GET container_id?fields=status_code
       → Must be 'FINISHED' (not 'IN_PROGRESS' or 'ERROR')

    Step 5 — Publish
    ├─ POST https://graph.facebook.com/v18.0/{instagram_business_id}/media_publish
    │  Body: {creation_id: container_id, access_token: instagram_token}
    └─ Returns: instagram post_id
```

### 5.3 Instagram-Facebook Dependency

```python
# When publishing to Instagram, system queries for Facebook account:
fb_account = SocialAccount.objects.get(
    user=post.user,
    platform='facebook',
    is_active=True
)

# If no active Facebook account:
→ Returns error: "Facebook account required for Instagram posting"
```

**Important:** Instagram posting FAILS if user doesn't also have an active Facebook connection.

---

## 6. FACEBOOK MESSENGER BOT — FULL DETAIL

### 6.1 Separate from SocialAccount

The Messenger bot uses a **completely separate model** (`MessengerConnection`) with its own setup flow.

```python
# messenger_bot/models.py
class MessengerConnection(models.Model):
    user = OneToOneField(User)      # Only ONE per user
    page_id = CharField()           # Facebook Page ID
    page_name = CharField()
    page_access_token = TextField() # Page Access Token
    verify_token = CharField()      # Auto-generated secret for webhook
    webhook_url = URLField()        # URL user registers in Facebook App
    is_webhook_verified = Boolean
    is_active = Boolean
    auto_reply_enabled = Boolean
    greeting_text = TextField()
```

### 6.2 Connection Setup

```
POST /messenger/connect/
Body: page_id, page_name, page_access_token + AI config

1. Create MessengerConnection
   → Auto-generate verify_token = secrets.token_urlsafe()
   → webhook_url = /messenger/webhook/{page_id}/

2. Create AIConfiguration (1-1)
   → openai_api_key, model (gpt-4o-mini), RAG settings

3. Create CustomPrompt
   → system_prompt, tone

4. Upload PDFs (optional)
   → Create PDFKnowledgeBase entries for RAG

5. Return verify_token + webhook_url to user
   → User must go to Facebook App Dashboard
   → Add this URL as webhook
   → Enter verify_token
```

### 6.3 Facebook Webhook Verification

When user registers the webhook in Facebook Developer Console:

```
Facebook → GET /messenger/webhook/{page_id}/
           ?hub.mode=subscribe
           &hub.verify_token=<the_token_user_entered>
           &hub.challenge=<random_number>

Server logic (messenger_bot/views.py):
1. Lookup MessengerConnection by page_id
2. Compare hub.verify_token with connection.verify_token
3. If match:
   → Set is_webhook_verified = True
   → Return HttpResponse(hub.challenge)  ← required by Facebook
4. If no match:
   → Return 403 Forbidden
```

### 6.4 Incoming Message Flow

```
Customer sends message on Facebook Page
    ↓
Facebook → POST /messenger/webhook/{page_id}/
           Body: {
             "entry": [{
               "messaging": [{
                 "sender": {"id": "customer_fb_id"},
                 "message": {"text": "Hello, do you have product X?"}
               }]
             }]
           }
    ↓
server (messenger_bot/views.py):
1. Parse JSON
2. Lookup MessengerConnection by page_id
3. Skip delivery/read receipts
4. Call MessageHandler.process_message(sender_id, text, image_url)
    ↓
MessageHandler.process_message():
1. Get or create Conversation (by sender_id)
2. If human_takeover=True → save Message only, no AI
3. If diamond balance insufficient → save Message, no AI
4. Call RAGEngine.generate_response(text, connection, history)
    ↓
RAGEngine:
1. Create embedding for customer message (OpenAI text-embedding-3-small)
2. Cosine similarity search:
   → PDFChunk table (uploaded PDFs)
   → BrandDNAChunk table (from brand DNA)
   → Product table (WooCommerce products)
3. Top-k results above similarity_threshold
4. Load active CustomPrompt as system message
5. Build message history (last N conversations)
6. UnifiedLLMService.chat_completion()
   → Model: ai_config.openai_model (default: 'gpt-4o-mini')
   → Routes through LLM service → Claude Haiku
7. Strip markdown from response
    ↓
MessageHandler:
5. POST https://graph.facebook.com/v18.0/me/messages
   Body: {
     recipient: {id: sender_id},
     message: {text: ai_response},
     access_token: connection.page_access_token
   }
6. Save Message record (with tokens used, rag_context_used)
7. Server returns 200 OK to Facebook (always — required)
```

### 6.5 Human Takeover

```python
# Toggle human takeover for a conversation:
POST /api/v1/messenger/connections/{id}/conversations/{conv_id}/toggle-takeover/

# When human_takeover=True:
→ AI stops replying
→ Human agent uses /send-message/ endpoint to reply manually:
  POST /api/v1/messenger/connections/{id}/conversations/{conv_id}/send-message/
  Body: {message: "..."}
  → Directly calls Facebook Send API
```

### 6.6 Messenger + SocialAccount Sync

When connecting `platform='messenger'` via the platforms API:

```python
# api/views.py — after validation
if platform == 'messenger' and is_valid:
    conn, _ = MessengerConnection.objects.update_or_create(
        user=request.user,
        defaults={
            'page_id': account.facebook_page_id,
            'page_name': account_name,
            'page_access_token': account.facebook_access_token,
        }
    )
    AIConfiguration.objects.get_or_create(connection=conn)
```

---

## 7. TWITTER/X CONNECTION

**File:** `platforms/services/twitter.py`
**Library:** `tweepy v4`

### Credentials Required

| Field | Description |
|-------|-------------|
| `twitter_api_key` | App Consumer Key |
| `twitter_api_secret` | App Consumer Secret |
| `twitter_access_token` | User Access Token |
| `twitter_access_token_secret` | User Access Token Secret |

### Validation

```python
client = tweepy.Client(
    consumer_key=api_key,
    consumer_secret=api_secret,
    access_token=access_token,
    access_token_secret=access_token_secret
)
me = client.get_me()
# Success → return (True, f"@{me.data.username}")
```

### Publishing

```python
# Step 1: Upload media (uses v1.1 API for media upload)
auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_token_secret)
api = tweepy.API(auth)
media = api.media_upload(file_path)   # Handles video encoding

# Step 2: Post tweet (uses v2 API)
client.create_tweet(text=text, media_ids=[media.media_id])
```

---

## 8. LINKEDIN CONNECTION

**File:** `platforms/services/linkedin.py`

### Credentials Required

| Field | Description |
|-------|-------------|
| `linkedin_access_token` | OAuth Bearer Token |
| `linkedin_person_urn` | LinkedIn person URN (e.g. `urn:li:person:ABC123`) |

### Publishing Flow

**Text only:**
```python
POST https://api.linkedin.com/v2/ugcPosts
Headers: {'Authorization': f'Bearer {access_token}'}
Body: {
  'author': f'urn:li:person:{person_urn}',
  'lifecycleState': 'PUBLISHED',
  'specificContent': {
    'com.linkedin.ugc.ShareContent': {
      'shareCommentary': {'text': text},
      'shareMediaCategory': 'NONE'
    }
  },
  'visibility': {'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'}
}
```

**With image (3 steps):**
```
Step 1: Register upload
  POST /v2/assets?action=registerUpload
  → Returns: uploadUrl, asset_urn

Step 2: Upload image binary
  PUT {uploadUrl}
  Body: raw file bytes

Step 3: Create post with asset reference
  POST /v2/ugcPosts with media array referencing asset_urn
```

---

## 9. SCHEDULING & PUBLISHING ENGINE

**File:** `posts/scheduler.py`

### How Posts Get Published

```python
# Scheduler checks for due posts:
def check_and_post():
    due = ScheduledPostPlatform.objects.filter(
        status='scheduled',
        scheduled_at__lte=timezone.now()
    )
    for spp in due:
        publish_post(spp)

# For each platform in the post:
def publish_post(spp):
    platform = spp.platform
    account = SocialAccount.objects.get(
        user=post.user,
        platform=platform,
        is_active=True
    )
    # Route to platform service:
    if platform == 'facebook':   post_facebook(post, account, caption, media)
    if platform == 'instagram':  post_instagram(post, account, caption, media)
    if platform == 'twitter':    post_twitter(post, account, caption, media)
    if platform == 'linkedin':   post_linkedin(post, account, caption, media)
    ...
```

### Post-Publish State

```python
# On success:
post.facebook_post_id = result_id
post.facebook_published_at = timezone.now()

# On failure:
post.facebook_error = error_message

# Final status update:
post.status = 'posted'  # if ALL platforms succeeded
post.status = 'failed'  # if ANY platform failed
```

---

## 10. TOKEN MANAGEMENT

### Current State (V1.2.4)

| Feature | Status |
|---------|--------|
| Token storage | Plaintext in DB |
| Token expiry tracking | `token_expires_at` field (nullable, often null) |
| Auto token refresh | NOT IMPLEMENTED |
| OAuth flow | NOT IMPLEMENTED |
| Background re-validation | NOT IMPLEMENTED |

### Token Lifespans by Platform

| Platform | Token | Lifespan | Stored? |
|----------|-------|---------|---------|
| Facebook | Page Access Token | ~2 months | Yes |
| Instagram | Graph API Token | ~2 months | Yes |
| Twitter | User Token | Indefinite (until revoked) | Yes |
| LinkedIn | OAuth Bearer | 2 months | Yes |
| TikTok | Access Token | 24 hours | Yes |
| TikTok | Refresh Token | 1 year | Yes (but unused) |
| YouTube | Access Token | 1 hour | Yes |
| YouTube | Refresh Token | Indefinite | Yes (but unused) |

**When tokens expire:** Users must manually re-enter credentials. No notification, no auto-refresh.

---

## 11. PLAN LIMITS

Enforced when connecting accounts:

```python
# accounts/models.py — UserProfile.can_add_account()
def can_add_account(self):
    from platforms.models import SocialAccount
    count = SocialAccount.objects.filter(user=self.user, is_active=True).count()
    return count < self.max_social_accounts
```

| Plan | Max Social Accounts |
|------|-------------------|
| Free | 1 |
| Starter | 3 |
| Pro | 5 |
| Business | 10 |
| Enterprise | 50 |

---

## 12. WHAT'S MISSING / NOT IMPLEMENTED

| Feature | Impact | Fix Needed |
|---------|--------|-----------|
| OAuth redirect flow | Users must manually get tokens | Implement per-platform OAuth |
| Token encryption | Security risk — plaintext in DB | Use `cryptography.fernet` |
| Auto token refresh | Expired tokens = publishing fails silently | Background Celery task |
| Token expiry notifications | Users don't know when to reconnect | Use `notify_token_expiring()` (already exists) |
| Facebook webhook signature verification | Security — any POST accepted | Verify `X-Hub-Signature` HMAC |
| Multi-account routing | If user has 2 Facebook pages, always picks first | Add account selection to ScheduledPostPlatform |
| Automated background validation | Token could expire any time | APScheduler job to periodically check |

---

## 13. FULL CONNECTION FLOW DIAGRAM

```
USER CONNECTS FACEBOOK
─────────────────────
User gets Page Token from Facebook Business Manager
    ↓
POST /api/v1/platforms-detail/
{platform:'facebook', facebook_page_id:'...', facebook_access_token:'...'}
    ↓
SocialAccountDetailViewSet.create()
    ├─ Check plan limit → 400 if at limit
    ├─ SocialAccount.update_or_create()
    ├─ FacebookService._get_page_token()
    │    ├─ debug_token → check if User or Page token
    │    └─ If User token → exchange for Page token
    ├─ FacebookService.validate_credentials(page_id, page_token)
    │    └─ GET graph.facebook.com/v18.0/{page_id}?fields=id,name
    ├─ status = 'active', is_validated = True
    └─ Return 201 with account data

USER POSTS TO FACEBOOK
──────────────────────
Post scheduled_at reaches current time
    ↓
scheduler.check_and_post()
    ↓
SocialAccount.objects.get(user=user, platform='facebook', is_active=True)
    ↓
FacebookService.post_to_facebook(page_id, token, caption, media_path)
    ├─ No media → POST /feed
    ├─ Image → POST /photos (multipart)
    └─ Video → POST /videos (multipart)
    ↓
post.facebook_post_id = returned_id
post.status = 'posted'

MESSENGER BOT FLOW
──────────────────
User sets up bot → gets verify_token + webhook_url
    ↓
User registers webhook in Facebook App Dashboard
    ↓
Facebook → GET /messenger/webhook/{page_id}/ (verification challenge)
    ↓
Server confirms verify_token match → returns challenge
    ↓
is_webhook_verified = True
    ↓
Customer messages on Facebook Page
    ↓
Facebook → POST /messenger/webhook/{page_id}/ (message event)
    ↓
MessageHandler → RAGEngine → Claude Haiku (via UnifiedLLMService)
    ↓
POST graph.facebook.com/v18.0/me/messages (send reply)
```

---

## 14. KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `platforms/models.py` | SocialAccount model + all credential fields |
| `platforms/services/facebook.py` | Facebook validation + posting |
| `platforms/services/instagram.py` | Instagram 5-step publishing pipeline |
| `platforms/services/twitter.py` | Twitter via tweepy |
| `platforms/services/linkedin.py` | LinkedIn API v2 posting |
| `platforms/views.py` | Traditional Django views (form-based) |
| `api/views.py` | SocialAccountViewSet + SocialAccountDetailViewSet |
| `api/serializers.py` | SocialAccountSerializer (write-only credential fields) |
| `posts/scheduler.py` | Scheduled post publishing engine |
| `messenger_bot/models.py` | MessengerConnection + AIConfiguration |
| `messenger_bot/views.py` | Webhook handler + bot API |
| `messenger_bot/services/message_handler.py` | Message processing + Facebook Send API |
| `messenger_bot/services/rag_engine.py` | RAG context retrieval |
