# Facebook OAuth — "Connect with Facebook" Button
## Full Implementation Guide for SocialSync-AI
### Reference: Zoho Social Pattern

**Version:** V1.2.4 → V1.3.0 feature
**Last Updated:** 2026-03-12

---

## THE PROBLEM (Current State)

Right now users must:
1. Go to Facebook Developer Console
2. Manually create/find their Page Access Token
3. Copy-paste it into SocialSync

**This is broken for real users.** Nobody does this.

## THE SOLUTION (What We're Building)

User clicks **"Connect Facebook Page"** →
Facebook login popup opens →
User logs in & approves permissions →
**Popup closes, pages auto-connected.** Done.

Same token also enables Messenger bot — no separate setup needed.

---

## HOW IT WORKS — THE TOKEN CHAIN

```
User clicks Connect
       ↓
Facebook OAuth dialog (login + permission grant)
       ↓
Facebook gives us an Authorization Code
       ↓
Backend exchanges code → Short-Lived User Token (2 hours)
       ↓
Backend exchanges again → Long-Lived User Token (60 days)
       ↓
GET /me/accounts → Returns ALL pages + Page Access Tokens
       ↓
Page Tokens from /me/accounts = NEVER EXPIRE
       ↓
Store in SocialAccount + auto-setup Messenger webhook
```

**Key insight:** Page Access Tokens from `/me/accounts` (when derived from a long-lived user token) **never expire** unless the user revokes your app. You store them once and use them forever.

---

## HOW ZOHO SOCIAL DOES IT (Reference)

Zoho Social's connect flow:
1. "Add Channel" button → backend returns Facebook OAuth URL
2. **Popup window** opens with Facebook login + permission screen
3. After user grants → backend fetches `/me/accounts` → shows **page picker UI**
4. User selects which pages to connect (checkboxes with page name + photo)
5. Popup closes → parent page refreshes with connected pages

The **page picker step** is the key UX difference — users often manage multiple pages and should choose which ones to connect. This is intermediate screen between OAuth callback and final storage.

---

## PART 1: FACEBOOK APP SETUP (One-Time)

### Create App in Meta Developer Console

Go to: `https://developers.facebook.com/apps/`

- App type: **Business** (not Consumer)
- Add products: **Facebook Login**, **Messenger**, **Pages API**
- Valid OAuth Redirect URI: `https://yourdomain.com/api/v1/platforms/facebook/callback/`
  - Must be HTTPS in production
  - Must match **exactly** (including trailing slash)

### Required Permissions (Scopes)

| Permission | Purpose |
|-----------|---------|
| `pages_show_list` | See user's pages via /me/accounts |
| `pages_manage_metadata` | Subscribe webhooks |
| `pages_manage_posts` | Post content to pages |
| `pages_read_engagement` | Read page metrics |
| `pages_messaging` | Messenger bot send/receive |
| `instagram_basic` | Read linked Instagram account |
| `instagram_content_publish` | Post to Instagram |

### Environment Variables (Add to .env)

```
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret_never_expose_this
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/v1/platforms/facebook/callback/
```

### App Review Phases

| Phase | What works |
|-------|-----------|
| Development Mode | Only your own test pages (for building/testing) |
| Standard Access | Users with roles on your app |
| **Advanced Access** | **Any user's pages — production deployment** |

Advanced Access requires: Business Verification (legal name, address, phone) + App Review screencast. Allow **2-4 weeks**.

---

## PART 2: BACKEND IMPLEMENTATION

### New File: `platforms/oauth_views.py`

```python
# platforms/oauth_views.py
import secrets
import requests
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SocialAccount

GRAPH_API = "https://graph.facebook.com/v22.0"
SCOPES = (
    "pages_show_list,"
    "pages_manage_metadata,"
    "pages_manage_posts,"
    "pages_read_engagement,"
    "pages_messaging,"
    "instagram_basic,"
    "instagram_content_publish"
)


# ─────────────────────────────────────────────
# STEP 1: Generate OAuth URL
# ─────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facebook_oauth_initiate(request):
    """
    GET /api/v1/platforms/facebook/initiate/
    Returns the Facebook authorization URL.
    React opens this in a popup window.
    """
    state = secrets.token_urlsafe(32)
    # Store state + user in session for callback verification
    request.session['fb_oauth_state'] = state
    request.session['fb_oauth_user_id'] = request.user.id
    request.session.save()

    params = {
        'client_id': settings.FACEBOOK_APP_ID,
        'redirect_uri': settings.FACEBOOK_REDIRECT_URI,
        'state': state,
        'scope': SCOPES,
        'response_type': 'code',
    }
    auth_url = f"https://www.facebook.com/v22.0/dialog/oauth?{urlencode(params)}"
    return Response({'auth_url': auth_url})


# ─────────────────────────────────────────────
# STEP 2: Callback — Exchange code for tokens
# ─────────────────────────────────────────────
def facebook_oauth_callback(request):
    """
    GET /api/v1/platforms/facebook/callback/
    Facebook redirects here after user grants permissions.
    This view runs in a popup — closes it and notifies parent window.
    """
    # --- CSRF check ---
    state = request.GET.get('state')
    stored_state = request.session.get('fb_oauth_state')
    user_id = request.session.get('fb_oauth_user_id')

    if not state or state != stored_state:
        return _popup_error("Invalid state — CSRF check failed")

    # --- User denied ---
    if 'error' in request.GET:
        return _popup_error(request.GET.get('error_description', 'Access denied'))

    code = request.GET.get('code')
    if not code:
        return _popup_error("No authorization code received")

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return _popup_error("Session expired — please try again")

    # --- Exchange code → short-lived user token ---
    token_resp = requests.get(f"{GRAPH_API}/oauth/access_token", params={
        'client_id': settings.FACEBOOK_APP_ID,
        'client_secret': settings.FACEBOOK_APP_SECRET,
        'redirect_uri': settings.FACEBOOK_REDIRECT_URI,
        'code': code,
    })
    token_data = token_resp.json()
    if 'error' in token_data:
        return _popup_error(f"Token exchange failed: {token_data['error']['message']}")

    short_lived_token = token_data['access_token']

    # --- Exchange → long-lived user token (60 days) ---
    ll_resp = requests.get(f"{GRAPH_API}/oauth/access_token", params={
        'grant_type': 'fb_exchange_token',
        'client_id': settings.FACEBOOK_APP_ID,
        'client_secret': settings.FACEBOOK_APP_SECRET,
        'fb_exchange_token': short_lived_token,
    })
    ll_data = ll_resp.json()
    long_lived_token = ll_data.get('access_token', short_lived_token)

    # --- Fetch all pages + their page tokens ---
    pages_resp = requests.get(f"{GRAPH_API}/me/accounts", params={
        'access_token': long_lived_token,
        'fields': 'id,name,access_token,category,tasks,picture',
    })
    pages_data = pages_resp.json()

    if 'error' in pages_data:
        return _popup_error(f"Could not fetch pages: {pages_data['error']['message']}")

    pages = pages_data.get('data', [])

    # --- Store all pages in session for page picker ---
    request.session['fb_oauth_pages'] = pages
    request.session['fb_oauth_long_token'] = long_lived_token
    request.session.save()

    # --- Return page picker data to popup ---
    # Popup posts this to parent window, React shows page picker UI
    import json
    pages_json = json.dumps([{
        'id': p['id'],
        'name': p['name'],
        'category': p.get('category', ''),
    } for p in pages])

    return HttpResponse(
        f'<script>'
        f'window.opener.postMessage('
        f'{{type:"FB_PAGES_READY", pages:{pages_json}}},'
        f'"*");'
        f'</script>'
        f'<p>Connecting pages... this window will close automatically.</p>'
    )


# ─────────────────────────────────────────────
# STEP 3: User selects pages → Save
# ─────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def facebook_save_pages(request):
    """
    POST /api/v1/platforms/facebook/save-pages/
    Body: {"selected_page_ids": ["123456", "789012"]}

    Called after user picks which pages to connect.
    Saves SocialAccount + auto-sets up Messenger webhook.
    """
    selected_ids = request.data.get('selected_page_ids', [])
    all_pages = request.session.get('fb_oauth_pages', [])
    long_lived_token = request.session.get('fb_oauth_long_token')

    if not all_pages or not long_lived_token:
        return Response({'error': 'Session expired, please reconnect'}, status=400)

    connected = []
    for page in all_pages:
        if page['id'] not in selected_ids:
            continue

        page_token = page['access_token']
        page_id = page['id']

        # Save Facebook SocialAccount
        account, _ = SocialAccount.objects.update_or_create(
            user=request.user,
            platform='facebook',
            facebook_page_id=page_id,
            defaults={
                'account_name': page['name'],
                'facebook_access_token': page_token,
                'status': 'active',
                'is_active': True,
                'is_validated': True,
                'token_expires_at': None,  # Page tokens never expire
            }
        )

        # Auto-setup Messenger webhook for this page
        _subscribe_page_to_webhook(page_id, page_token, request.user, page['name'])

        connected.append({'id': page_id, 'name': page['name']})

    # Clean up session
    del request.session['fb_oauth_pages']
    del request.session['fb_oauth_long_token']

    return Response({
        'success': True,
        'connected_pages': connected,
        'count': len(connected),
    })


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _subscribe_page_to_webhook(page_id, page_token, user, page_name):
    """
    Subscribe a Facebook Page to your app's webhook.
    This enables Messenger bot auto-reply.
    Requires pages_manage_metadata + pages_messaging permissions.
    """
    resp = requests.post(
        f"{GRAPH_API}/{page_id}/subscribed_apps",
        params={
            'subscribed_fields': 'messages,message_echoes,message_reads,messaging_postbacks',
            'access_token': page_token,
        }
    )
    result = resp.json()

    if result.get('success'):
        # Auto-create MessengerConnection
        from messenger_bot.models import MessengerConnection, AIConfiguration
        connection, _ = MessengerConnection.objects.update_or_create(
            user=user,
            defaults={
                'page_id': page_id,
                'page_name': page_name,
                'page_access_token': page_token,
                'is_webhook_verified': True,
                'is_active': True,
                'auto_reply_enabled': True,
            }
        )
        # Create default AI config if doesn't exist
        AIConfiguration.objects.get_or_create(connection=connection)
        return True
    return False


def _popup_error(message):
    """Return HTML that sends error to parent popup and closes."""
    import json
    msg_json = json.dumps(message)
    return HttpResponse(
        f'<script>'
        f'window.opener.postMessage({{type:"FB_OAUTH_ERROR", message:{msg_json}}}, "*");'
        f'window.close();'
        f'</script>'
        f'<p>Error: {message}</p>'
    )
```

---

## PART 3: URL ROUTING

Add to `api/urls.py`:

```python
from platforms.oauth_views import (
    facebook_oauth_initiate,
    facebook_oauth_callback,
    facebook_save_pages,
)

urlpatterns += [
    # OAuth initiate — returns auth URL to React
    path('platforms/facebook/initiate/', facebook_oauth_initiate, name='fb-oauth-initiate'),

    # OAuth callback — Facebook redirects here after user grants
    path('platforms/facebook/callback/', facebook_oauth_callback, name='fb-oauth-callback'),

    # Save selected pages after page picker
    path('platforms/facebook/save-pages/', facebook_save_pages, name='fb-save-pages'),
]
```

---

## PART 4: SETTINGS

Add to `socialsync/settings.py`:

```python
import os

FACEBOOK_APP_ID = os.environ.get('FACEBOOK_APP_ID', '')
FACEBOOK_APP_SECRET = os.environ.get('FACEBOOK_APP_SECRET', '')
FACEBOOK_REDIRECT_URI = os.environ.get(
    'FACEBOOK_REDIRECT_URI',
    'http://localhost:8000/api/v1/platforms/facebook/callback/'
)

# Sessions needed for OAuth state storage
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 300  # 5 minutes (OAuth state only)
```

---

## PART 5: REACT FRONTEND (How to Call It)

### The Connect Button + Flow

```javascript
// ConnectFacebookButton.jsx

const ConnectFacebook = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState([]);        // Pages returned by Facebook
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleConnect = async () => {
    setLoading(true);

    // Step 1: Get OAuth URL from backend
    const { data } = await api.get('/api/v1/platforms/facebook/initiate/');

    // Step 2: Open popup
    const popup = window.open(
      data.auth_url,
      'facebook_connect',
      'width=650,height=700,scrollbars=yes,resizable=yes'
    );

    // Step 3: Listen for popup message
    const handler = (event) => {
      if (event.data.type === 'FB_PAGES_READY') {
        setPages(event.data.pages);
        setShowPicker(true);    // Show page picker modal
        setLoading(false);
        popup.close();
        window.removeEventListener('message', handler);
      }
      if (event.data.type === 'FB_OAUTH_ERROR') {
        alert(`Connection failed: ${event.data.message}`);
        setLoading(false);
        window.removeEventListener('message', handler);
      }
    };
    window.addEventListener('message', handler);
  };

  const handleSavePages = async () => {
    // Step 4: Save selected pages
    const { data } = await api.post('/api/v1/platforms/facebook/save-pages/', {
      selected_page_ids: selectedIds
    });
    setShowPicker(false);
    onSuccess(data.connected_pages);
  };

  return (
    <>
      <button onClick={handleConnect} disabled={loading}>
        {loading ? 'Connecting...' : 'Connect Facebook Page'}
      </button>

      {/* Page Picker Modal — like Zoho Social */}
      {showPicker && (
        <div className="modal">
          <h3>Select Pages to Connect</h3>
          {pages.map(page => (
            <label key={page.id}>
              <input
                type="checkbox"
                value={page.id}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds([...selectedIds, page.id]);
                  else setSelectedIds(selectedIds.filter(id => id !== page.id));
                }}
              />
              {page.name} ({page.category})
            </label>
          ))}
          <button onClick={handleSavePages} disabled={selectedIds.length === 0}>
            Connect Selected Pages
          </button>
        </div>
      )}
    </>
  );
};
```

---

## PART 6: WHAT HAPPENS TO MESSENGER BOT

When the user connects a Facebook page:

1. The `_subscribe_page_to_webhook()` function is called automatically
2. It calls `POST /{page_id}/subscribed_apps` — subscribes to message events
3. `MessengerConnection` is auto-created with `is_webhook_verified=True`
4. `AIConfiguration` is auto-created with defaults
5. Messenger bot is **live immediately** — no separate setup step needed

The webhook URL (`/api/messenger/webhook/{page_id}/`) was already registered in the Facebook App dashboard by you (the developer) once during app setup. Individual page subscriptions are handled per-page via the API call above.

**Before (manual):**
- User had to: get verify_token → register webhook URL in Facebook → wait for verification

**After (OAuth):**
- Zero steps for user — Messenger bot activates automatically

---

## PART 7: GRAPH API ENDPOINTS SUMMARY

| Step | Method | URL | Auth |
|------|--------|-----|------|
| Start OAuth | — | `https://www.facebook.com/v22.0/dialog/oauth` | None |
| Exchange code | GET | `https://graph.facebook.com/v22.0/oauth/access_token` | app_id + app_secret |
| Long-lived token | GET | `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token` | app_id + app_secret |
| Get pages + tokens | GET | `https://graph.facebook.com/v22.0/me/accounts` | long-lived user token |
| Subscribe to webhook | POST | `https://graph.facebook.com/v22.0/{page_id}/subscribed_apps` | page token |
| Verify token | GET | `https://graph.facebook.com/v22.0/debug_token` | app_id\|app_secret |

---

## PART 8: FILES TO CREATE / MODIFY

### New Files
| File | Purpose |
|------|---------|
| `platforms/oauth_views.py` | All OAuth views (initiate, callback, save-pages) |

### Modified Files
| File | Change |
|------|--------|
| `api/urls.py` | Add 3 new OAuth URL patterns |
| `socialsync/settings.py` | Add FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI |
| `.env` | Add FACEBOOK_APP_ID, FACEBOOK_APP_SECRET values |
| `platforms/models.py` | Optional: add `facebook_user_token` field for refresh |

### Existing Files — No Change Needed
- `platforms/services/facebook.py` — posting still works the same
- `messenger_bot/views.py` — webhook handler still works the same
- `messenger_bot/models.py` — MessengerConnection still used, just auto-populated now

---

## PART 9: SECURITY NOTES

1. **NEVER expose `FACEBOOK_APP_SECRET` to frontend** — all token exchanges happen server-side only
2. **State parameter** — always verify it matches what you stored in session (CSRF protection)
3. **Page tokens are long-lived** — treat like passwords, should be encrypted at rest (current issue: stored plaintext)
4. **Webhook payload verification** — after this is implemented, also add `X-Hub-Signature` HMAC verification on incoming webhook messages (currently missing)

---

## PART 10: TESTING CHECKLIST

- [ ] App in Development Mode — connect your own test page
- [ ] Verify state mismatch is rejected (test with wrong state value)
- [ ] Verify user denial is handled (click "Cancel" in Facebook dialog)
- [ ] Verify page picker shows all pages user manages
- [ ] Verify SocialAccount is created with page token
- [ ] Verify MessengerConnection is auto-created
- [ ] Verify posting to Facebook page works with stored token
- [ ] Verify Messenger bot auto-replies work
- [ ] Test with user who manages 0 pages (show "no pages found" message)
- [ ] Test with user who manages multiple pages (page picker shows all)

---

## QUICK IMPLEMENTATION ORDER

```
1. Create Facebook App in Meta Developer Console
2. Add FACEBOOK_APP_ID + FACEBOOK_APP_SECRET to .env / settings.py
3. Create platforms/oauth_views.py (copy code from Part 2)
4. Add URLs to api/urls.py (Part 3)
5. Register callback URL in Facebook App OAuth settings
6. Test in Development Mode with your own page
7. Apply for Advanced Access (App Review) for production
```
