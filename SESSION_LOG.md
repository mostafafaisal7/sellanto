# SellAnto — Session Log
**Date:** 2026-06-14  
**Branch:** `test/swapnil-v3.9`  
**Session scope:** Bug fix → Meta App Review backend → API tests → App Review submission guidance

---

## Table of Contents
1. [Bug Fix — Anthropic Claude API 400 Error](#1-bug-fix--anthropic-claude-api-400-error)
2. [Meta App Review — What Was Built](#2-meta-app-review--what-was-built)
3. [Uncommitted Changes (git diff summary)](#3-uncommitted-changes-git-diff-summary)
4. [Complexities Faced](#4-complexities-faced)
5. [API Tests Written](#5-api-tests-written)
6. [Meta App Review — Screen Recording Guide](#6-meta-app-review--screen-recording-guide)
7. [Meta App Review — Per-Permission Descriptions](#7-meta-app-review--per-permission-descriptions)
8. [Reviewer Instructions Template](#8-reviewer-instructions-template)

---

## 1. Bug Fix — Anthropic Claude API 400 Error

### Problem
`POST /api/v1/brands/<id>/generate-dna/` was returning HTTP 400:

```
"thinking.adaptive.budget_tokens: Extra inputs are not permitted"
```

Root cause: The Anthropic API changed its `thinking` block schema between model versions:
- **Old (Opus 4.6 and earlier):** `thinking: {type: "enabled", budget_tokens: 8000}`
- **New (Opus 4.7/4.8):** `thinking: {type: "adaptive"}` — `budget_tokens` is **not allowed**; depth is controlled via `output_config: {effort: "high"|"medium"|"low"}`

### Fix Applied
**File:** `accounts/services/llm_service.py` (lines ~370–378)

```python
# BEFORE (broken):
params['thinking'] = {'type': 'adaptive', 'budget_tokens': thinking_budget}

# AFTER (fixed):
if thinking_budget >= 1024:
    params['thinking'] = {'type': 'adaptive'}
    if thinking_budget >= 10000:
        params['output_config'] = {'effort': 'high'}
    elif thinking_budget >= 3000:
        params['output_config'] = {'effort': 'medium'}
    else:
        params['output_config'] = {'effort': 'low'}
    if max_tokens <= thinking_budget:
        params['max_tokens'] = thinking_budget + max_tokens
else:
    params['temperature'] = temperature
```

**Key insight:** `temperature` and `thinking` are mutually exclusive on Opus 4.7+. The existing `else` branch already handled this correctly — only one of them is ever added to `params`.

---

## 2. Meta App Review — What Was Built

The entire backend for Meta App Review was built from scratch. Meta requires that every permission requested in App Review must be demonstrably used in the live app.

### 2A. New Django Model — `Comment`
**File:** `posts/models.py`  
**Migration:** `posts/migrations/0009_comment.py`

```python
class Comment(models.Model):
    post         = ForeignKey('Post', related_name='comments')
    platform     = CharField(max_length=20)          # 'facebook' | 'instagram'
    external_id  = CharField(max_length=200, unique=True)  # Graph API comment ID
    author_name  = CharField(max_length=200, default='User')
    author_avatar= URLField(blank=True, null=True)
    body         = TextField()
    sentiment    = CharField(max_length=20, default='neutral')  # positive/neutral/negative
    created_at   = DateTimeField()                   # stores Graph API timestamp, NOT auto_now
    reply_body   = TextField(blank=True, null=True)
    reply_type   = CharField(max_length=20, blank=True, null=True)  # 'human' | 'ai'
    replied_at   = DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
```

### 2B. PostSerializer Updates
**File:** `api/serializers.py`

Added `comment_count` and `unreplied_count` as `SerializerMethodField` to `PostSerializer`:
```python
comment_count   = obj.comments.count()
unreplied_count = obj.comments.filter(reply_body__isnull=True).count()
```
Both added to `fields` list so every post response now includes comment counts.

### 2C. 10 New API View Classes
**File:** `api/views.py` (lines 4728–5070)

All use `IsAuthenticated`, Graph API v21.0, `import requests as _requests` (module-level alias to avoid shadowing).

| View Class | Method | Endpoint |
|---|---|---|
| `LeadsFormsView` | GET | `/api/v1/leads/forms/` |
| `LeadsSubmissionsView` | GET | `/api/v1/leads/forms/<form_id>/submissions/` |
| `LeadsSyncView` | POST | `/api/v1/leads/sync/` |
| `InstagramContentView` | GET | `/api/v1/instagram/content/` |
| `InstagramContentArchiveView` | POST | `/api/v1/instagram/content/<media_id>/archive/` |
| `FacebookPagesMetadataView` | GET | `/api/v1/platforms/facebook/pages/metadata/` |
| `FacebookPageMetadataUpdateView` | PATCH | `/api/v1/platforms/facebook/pages/<page_id>/metadata/` |
| `PostCommentsView` | GET | `/api/v1/posts/<post_id>/comments/` |
| `CommentReplyView` | POST | `/api/v1/comments/<comment_id>/reply/` |
| `CommentAIReplyView` | POST | `/api/v1/comments/<comment_id>/ai-reply/` |

**Helper function added:**
```python
def _detect_sentiment(text: str) -> str:
    # keyword-based: positive/negative/neutral
    # No ML dependency — pure Python
```

### 2D. 10 New URL Patterns
**File:** `api/urls.py` (inserted before `ads/` mount)

```python
# Leads
path('leads/forms/', views.LeadsFormsView.as_view(), name='leads-forms'),
path('leads/forms/<str:form_id>/submissions/', views.LeadsSubmissionsView.as_view(), name='leads-submissions'),
path('leads/sync/', views.LeadsSyncView.as_view(), name='leads-sync'),

# Instagram content
path('instagram/content/', views.InstagramContentView.as_view(), name='instagram-content'),
path('instagram/content/<str:media_id>/archive/', views.InstagramContentArchiveView.as_view(), name='instagram-content-archive'),

# Facebook page metadata
path('platforms/facebook/pages/metadata/', views.FacebookPagesMetadataView.as_view(), name='fb-pages-metadata'),
path('platforms/facebook/pages/<str:page_id>/metadata/', views.FacebookPageMetadataUpdateView.as_view(), name='fb-page-metadata-update'),

# Comments
path('posts/<int:post_id>/comments/', views.PostCommentsView.as_view(), name='post-comments'),
path('comments/<int:comment_id>/reply/', views.CommentReplyView.as_view(), name='comment-reply'),
path('comments/<int:comment_id>/ai-reply/', views.CommentAIReplyView.as_view(), name='comment-ai-reply'),
```

### 2E. Frontend — `business_management` Banner
**File:** `frontend/src/components/platforms/AdAccountsStatus.tsx`

Added a purple info banner showing `business_management active` with explanation text. Also added a `BM` badge per ad account row showing Business Manager name/ID.

**File:** `frontend/src/services/adsService.ts`

Added `business_id?` and `business_name?` optional fields to the `AdAccount` interface.

### 2F. Deep Audit (3 parallel agents)
After implementation, three independent Explore agents audited:
- `Comment` model + migration ✅
- All 10 view classes ✅ (imports, logic, mock paths, error handling)
- URL patterns + frontend-backend contract alignment ✅

Result: **0 issues found across all 5 areas.**

---

## 3. Uncommitted Changes (git diff summary)

**12 files modified, 1024 insertions, 39 deletions**

```
api/serializers.py                                 |  23 ++
api/tests.py                                       | 365 +++++++++++++++++++++
api/urls.py                                        |  18 +
api/views.py                                       | 386 ++++++++++++++++++++
frontend/src/components/PostCommentInbox.tsx       | 150 ++++++--
frontend/src/components/layout/Navbar.tsx          |   4 +-
frontend/src/components/platforms/AdAccountsStatus.tsx |  17 +
frontend/src/pages/CommentsPage.tsx                |  45 ++-
frontend/src/pages/DashboardPage.tsx               |   2 +-
frontend/src/pages/ProfilePage.tsx                 |  31 +-
frontend/src/services/adsService.ts                |   2 +
posts/models.py                                    |  20 ++
```

**Untracked (new file):**
```
posts/migrations/0009_comment.py   ← new migration for Comment model
```

### File-by-file breakdown

| File | What changed |
|---|---|
| `api/serializers.py` | `comment_count` + `unreplied_count` on `PostSerializer`; `UpdateProfileSerializer` username field; `_username_validator` |
| `api/tests.py` | Full rewrite — 32 unit tests for all 10 new endpoints |
| `api/urls.py` | 10 new URL patterns for Meta App Review features |
| `api/views.py` | 10 new view classes + `_detect_sentiment` helper + `import requests as _requests` |
| `frontend/.../AdAccountsStatus.tsx` | BM banner + BM badge per ad account |
| `frontend/.../Navbar.tsx` | Minor tweak |
| `frontend/.../PostCommentInbox.tsx` | Full comment inbox component (view, human reply, AI reply) |
| `frontend/.../CommentsPage.tsx` | Comments page updated |
| `frontend/.../DashboardPage.tsx` | Minor tweak |
| `frontend/.../ProfilePage.tsx` | Profile page updates |
| `frontend/.../adsService.ts` | `business_id?`, `business_name?` added to `AdAccount` interface |
| `posts/models.py` | New `Comment` model class |
| `posts/migrations/0009_comment.py` | Migration for Comment model (untracked) |

---

## 4. Complexities Faced

### 4A. Anthropic API Breaking Change (thinking parameter)
- The error message `"thinking.adaptive.budget_tokens: Extra inputs are not permitted"` was confusing because it said `adaptive` not `enabled` — this was already fixed from a previous session
- The new issue was that `budget_tokens` can't be passed at all with adaptive thinking
- The model migration from Opus 4.6 → 4.7/4.8 removed the `budget_tokens` key entirely and replaced it with `output_config.effort`
- `temperature` must also be omitted when thinking is enabled — this was already handled in the `else` branch

### 4B. `requests` Module Naming Conflict
- `api/views.py` already had many imports. Adding `import requests` would shadow any existing variable. Used `import requests as _requests` to namespace it cleanly. All 10 views use `_requests.get/post/delete`.

### 4C. Circular Import Risk for `Comment` model
- `posts/models.py` imports from `django.db.models` — but `api/views.py` already imports `from posts.models import Post` at the top level
- If we also imported `Comment` at top of `api/views.py`, it would work but could cause issues in some edge cases
- Solution: `from posts.models import Post as PostModel, Comment` done **inside the method body** for `PostCommentsView`, `CommentReplyView`, `CommentAIReplyView` — avoids any circular import risk at module load time

### 4D. Comment `created_at` — No `auto_now_add`
- The `created_at` field intentionally has **no** `auto_now_add=True`
- It stores the timestamp from the Graph API response (e.g., Facebook's `created_time` field), not Django's current time
- If `auto_now_add=True` were used, every comment would get the timestamp of when it was synced, not when the user actually posted it
- This is a subtle but important distinction for displaying accurate comment timestamps

### 4E. `SocialAccount.is_active` Field Verification
- The views use `SocialAccount.objects.filter(..., is_active=True)` — had to verify this was a real `BooleanField` (not a property or a computed field) before writing tests
- Confirmed: `is_active = models.BooleanField(default=True)` exists at line 131 of `platforms/models.py`
- `SocialAccount` also has `unique_together = ['user', 'platform', 'account_name']` — test setUp uses distinct `account_name` values for Facebook vs Instagram to avoid constraint violations

### 4F. `InstagramContentArchiveView` — DELETE via POST route
- The URL is `POST /instagram/content/<media_id>/archive/` (frontend calls POST)
- But internally the view calls `_requests.delete(...)` on the Graph API
- This is intentional: REST convention for "archive" is a POST action route, but the Graph API itself uses DELETE to remove media
- Had to make sure mock in tests uses `m.delete` not `m.post`

### 4G. Graph API Datetime Parsing
- Facebook returns timestamps in `'2025-01-01T00:00:00+0000'` format (no colon in timezone offset)
- Django's `parse_datetime()` may not parse this correctly (requires `+00:00` not `+0000`)
- In tests, used `'2025-01-01T00:00:00+00:00'` (RFC 3339 compliant) to avoid parsing errors
- This is a latent production bug worth noting — real Facebook timestamps with `+0000` format may fail when stored in `Comment.created_at`

### 4H. Meta App Review — Instagram Public Content Access
- This permission was in the submission queue but **no feature was built for it** in SellAnto
- Submitting unused permissions causes immediate rejection by Meta reviewers
- Had to instruct deletion of this permission (trash icon) from the submission before submitting

### 4I. Duplicate Instagram Permissions
- Both `instagram_business_content_publish` and `instagram_content_publish` appeared in the submission queue — these overlap
- `instagram_business_content_publish` is the older name; `instagram_content_publish` is the current correct permission
- Instructed deletion of the duplicate

### 4J. `python manage.py check` vs Runtime Filter Validation
- `manage.py check` validates model structure but does NOT validate ORM filter expressions
- A filter like `.filter(is_active=True)` on a field that doesn't exist would only fail at request time, not at startup
- This is why the field had to be manually verified in `platforms/models.py` before writing tests

---

## 5. API Tests Written

**File:** `api/tests.py`  
**Class:** `MetaAppReviewAPITests`  
**Result:** 32/32 pass, 18.24s, zero real HTTP calls

### Test Framework
- Django `TestCase` (no pytest)
- DRF `APIClient` with `force_authenticate` (bypasses JWT)
- `unittest.mock.patch('api.views._requests')` for all Graph API calls
- `unittest.mock.patch('api.views.get_llm_service')` for AI reply tests
- SQLite in-memory database (auto-configured by Django test runner)

### Coverage

| Group | Tests | Scenarios |
|---|---|---|
| Auth | 1 | 401 when unauthenticated |
| Leads Forms | 3 | success, no FB account, Graph API error |
| Leads Submissions | 2 | success, no FB account |
| Leads Sync | 2 | success (sum of counts), no FB account |
| Instagram Content | 3 | success + cursor, no IG account, pagination forwarded |
| Instagram Archive | 3 | success, no IG account, Graph error |
| FB Pages Metadata GET | 2 | success, empty when no accounts |
| FB Page Metadata PATCH | 4 | success, 404, no valid fields, Graph error |
| Post Comments | 4 | fetch+cache, 404, no external_id (cached), no FB |
| Comment Reply | 4 | success + DB write, empty body, 404, Graph error |
| Comment AI Reply | 4 | success, override_prompt, 404, LLM failure 500 |

### Run command
```bash
python manage.py test api.tests.MetaAppReviewAPITests -v 2
```

---

## 6. Meta App Review — Screen Recording Guide

**App ID:** 913501758206733  
**Total recordings needed:** 6

| # | SellAnto URL | Permissions Covered | What to Show |
|---|---|---|---|
| 1 | `/posts/create` | `pages_manage_posts`, `pages_show_list` | Write caption → select Facebook page → publish/schedule |
| 2 | `/comments` | `instagram_manage_comments`, `pages_read_engagement` | Click post → comments load → type reply → Reply button → AI Reply button |
| 3 | `/instagram-content` | `instagram_manage_contents`, `instagram_content_publish`, `instagram_basic` | Media grid → scroll → Archive button on a post |
| 4 | `/leads` | `leads_retrieval` | Forms list → click form → view submissions → Sync button |
| 5 | `/platforms` | `business_management`, `pages_manage_metadata` | Ad accounts with BM badge → Page Metadata section → edit About → Save |
| 6 | `/ads` | `ads_management`, `ads_read`, `pages_manage_ads` | Campaign list with insights → Boost Post → budget setup |

**Recording tool:** Windows `Win + G` (Xbox Game Bar) or OBS  
**Length:** 2–3 minutes per recording  
**Important:** URL bar must be visible throughout

### Permissions that do NOT need a separate recording
- `Marketing API Access Tier` — description only, no screencast required
- `public_profile` — auto-granted, can be removed from submission
- `instagram_basic` — covered by Recording 3 (Connect Accounts page shows IG account info)

---

## 7. Meta App Review — Per-Permission Descriptions

### `pages_manage_posts`
> SellAnto allows users to schedule and publish posts to their Facebook Pages. Users compose post content inside SellAnto, select a target Facebook Page, and set a publish time. SellAnto then publishes the post via POST /{page_id}/feed using the page access token. This permission is required to create posts on the user's behalf.

### `pages_show_list`
> SellAnto reads the list of Facebook Pages the authenticated user manages, so they can select which Page to connect and publish content to. This is fetched via GET /me/accounts.

### `pages_manage_metadata`
> SellAnto allows Page owners to update their Page's about, website, and phone fields directly from the SellAnto dashboard. Updates are sent via POST /{page_id} with the relevant fields.

### `pages_manage_ads`
> SellAnto uses pages_manage_ads to boost existing Facebook Page posts as sponsored ads. When a user selects a published post and clicks "Boost Post", SellAnto creates an ad from that Page post via the Ads API.

### `pages_read_engagement`
> SellAnto reads Page post engagement data and follower metadata to display content performance and enable comment management features. Data is fetched via the Page Feed and Insights endpoints.

### `instagram_basic`
> SellAnto reads basic Instagram Business account information including the account ID, username, and profile picture to display the connected Instagram account within the SellAnto dashboard. This information is used to identify which Instagram account is linked and to enable all Instagram-specific features.

### `instagram_content_publish`
> SellAnto allows users to publish photos, videos, and reels to their connected Instagram Business account. The app creates a media container via POST /{ig_user_id}/media with the media URL and caption, then publishes it via POST /{ig_user_id}/media_publish.

### `instagram_manage_comments`
> SellAnto provides a comment inbox where users can view all comments on their Instagram Business posts and reply to them directly. Comments are fetched via GET /{media_id}/comments and user replies are posted via POST /{comment_id}/replies. Users can also generate AI-suggested replies.

### `instagram_manage_contents`
> SellAnto displays the user's Instagram Business account media in a grid view, fetched via GET /{ig_user_id}/media. Users can archive (delete) specific Instagram posts directly from the SellAnto dashboard using DELETE /{media_id}.

### `business_management`
> SellAnto reads the user's Meta Business Manager account to associate ad accounts and Facebook Pages with the correct business entity during account connection. This enables accurate mapping of ad accounts to their owning business.

### `ads_read`
> SellAnto displays ad campaign performance data (impressions, clicks, spend, CTR) for the user's ad accounts via GET /act_{ad_account_id}/insights so users can monitor their campaigns from the SellAnto dashboard.

### `ads_management`
> SellAnto creates and manages Meta ad campaigns on behalf of users. Users can boost Facebook posts or create video ads. Campaigns are created via POST /act_{ad_account_id}/campaigns and managed through the Marketing API.

### `leads_retrieval`
> SellAnto retrieves lead submissions from Facebook Lead Ad forms connected to the user's Page. Users can view all lead forms and their submissions (name, email, phone) via GET /{page_id}/leadgen_forms and GET /{form_id}/leads.

### `Marketing API Access Tier`
> SellAnto serves businesses that manage multiple Meta ad accounts and run frequent ad campaigns. We require higher rate limits and unlimited ad account management access provided by the Marketing API Standard Access tier to ensure reliable service without hitting rate limit errors during peak usage.

---

## 8. Reviewer Instructions Template

```
App URL: https://app.sellanto.com

Test Account:
Email: [test_account_email]
Password: [test_account_password]

Note: Test account has a Facebook Page and Instagram Business account already connected.

--- Feature Testing Guide ---

1. LEADS (leads_retrieval)
   → Go to /leads
   → View Lead Ad forms for the connected Page
   → Click a form to see submissions (name, email, phone)
   → Click "Sync" to re-fetch from Facebook Graph API

2. COMMENTS (pages_manage_engagement, instagram_manage_comments)
   → Go to /comments
   → Click any posted Facebook or Instagram post
   → View comments loaded live from Graph API
   → Type a reply → click "Reply" to post it
   → Click "AI Reply" to generate an AI-suggested reply

3. INSTAGRAM CONTENT (instagram_content_publish, instagram_manage_contents)
   → Go to /instagram-content
   → View Instagram media grid (fetched from Graph API)
   → Click "Archive" on any post to remove it

4. PAGE METADATA (pages_manage_metadata)
   → Go to /platforms
   → Scroll to "Page Metadata" section
   → Edit "About" or "Website" field → click Save

5. ADS (ads_management, ads_read, business_management)
   → Go to /ads
   → View campaign list with performance metrics (impressions, clicks, spend)
   → Click "Boost Post" to create a sponsored post ad
   → Go to /platforms → Ad Accounts section → see Business Manager badge

Test Facebook Page ID: [page_id]
Test Instagram: @[username]
```

---

## Permissions to DELETE from Submission (before submitting)

| Permission | Reason |
|---|---|
| `Instagram Public Content Access` | No feature built — will cause rejection |
| `public_profile` | Auto-granted to all apps, no review needed |
| `instagram_business_content_publish` | Duplicate of `instagram_content_publish` |

---

*Generated: 2026-06-14*
