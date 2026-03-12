# Facebook "Connect" Button — Complete Step-by-Step Guide
## Django + React Implementation (Zoho Social Pattern)

**Goal:** User clicks one button → Facebook popup → login → pages auto-connected + Messenger bot live

---

## UNDERSTAND FIRST — HOW IT ALL WORKS

```
User clicks "Connect Facebook"
         ↓
React calls your Django API → gets OAuth URL
         ↓
Popup window opens → Facebook login + permission screen
         ↓
User selects pages, clicks "OK"
         ↓
Facebook redirects popup to your callback URL with a "code"
         ↓
Django backend:
  1. Exchanges code → short-lived token (2 hours)
  2. Exchanges again → long-lived user token (60 days)
  3. Calls /me/accounts → gets ALL pages + their tokens
  4. Page tokens = NEVER EXPIRE (stored permanently)
  5. Auto-subscribes each page to Messenger webhook
         ↓
Popup posts message to parent window → closes
         ↓
React shows: "3 pages connected!"
```

### The Token Chain (Memorize This)

```
code (10 min)
  → short-lived user token (2 hr)     [server exchange]
    → long-lived user token (60 days) [server exchange]
      → page access tokens (NEVER EXPIRE) [from /me/accounts]
```

Page tokens never expire unless:
- User removes your app from their Facebook settings
- User changes their Facebook password
- User loses admin access to the page

---

## PHASE 1 — FACEBOOK APP SETUP (Do Once)

### Step 1.1 — Create the App

Go to: **https://developers.facebook.com/apps/creation/**

- App Type: **Business** ← very important, don't pick "Consumer"
- App Name: `SaleAnto` (or your brand name)
- Contact email: your email
- Click **Create App**

### Step 1.2 — Add Products

In your app dashboard sidebar, click **"Add Product"** and add:
- **Facebook Login for Business** ← for page OAuth
- **Messenger** ← for bot webhook
- **Webhooks** ← for real-time events

### Step 1.3 — Add Redirect URI

Go to: **Products → Facebook Login for Business → Settings**

In **"Valid OAuth Redirect URIs"** add:
```
http://localhost:8000/api/v1/platforms/facebook/callback/
```
For production later:
```
https://yourdomain.com/api/v1/platforms/facebook/callback/
```

> **CRITICAL:** This URL must match **exactly** what your code sends — same slash, same case, same protocol. Even one character different = OAuth fails.

### Step 1.4 — Get Your App Credentials

Go to: **Settings → Basic**

Copy:
- **App ID** → goes in `.env` as `FACEBOOK_APP_ID`
- **App Secret** → click "Show" → goes in `.env` as `FACEBOOK_APP_SECRET`

> Never put App Secret in frontend code. Server only.

### Step 1.5 — Set App to Development Mode (for now)

During development, your app is automatically in Development Mode.
- Only people with a **role on your app** can connect
- Add team members: **App Roles → Testers → Add Testers**
- When ready for real users → **App Review** (covered at end)

---

## PHASE 2 — DJANGO BACKEND

### Step 2.1 — Add Environment Variables

In your `.env` file:
```
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_REDIRECT_URI=http://localhost:8000/api/v1/platforms/facebook/callback/
FRONTEND_URL=http://localhost:3000
```

### Step 2.2 — Add to settings.py

```python
# socialsync/settings.py
from decouple import config

FACEBOOK_APP_ID = config('FACEBOOK_APP_ID', default='')
FACEBOOK_APP_SECRET = config('FACEBOOK_APP_SECRET', default='')
FACEBOOK_REDIRECT_URI = config('FACEBOOK_REDIRECT_URI', default='http://localhost:8000/api/v1/platforms/facebook/callback/')
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')
```

### Step 2.3 — Create OAuthState Model

This stores the CSRF state token in the database (more reliable than sessions for JWT-auth APIs).

Add to `accounts/models.py` (or create `platforms/oauth_models.py`):

```python
# Add to accounts/models.py

import uuid
from datetime import timedelta
from django.utils import timezone

class OAuthState(models.Model):
    """Temporary table to store OAuth state tokens and prevent CSRF attacks."""

    state = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    platform = models.CharField(max_length=32, default='facebook')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        db_table = 'oauth_states'

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)
```

Run migration:
```bash
python manage.py makemigrations
python manage.py migrate
```

### Step 2.4 — Create the OAuth Views File

Create new file: `platforms/oauth_views.py`

```python
# platforms/oauth_views.py

import json
import requests
from urllib.parse import urlencode
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from platforms.models import SocialAccount
from accounts.models import OAuthState

# ── CONSTANTS ──────────────────────────────────────────────────────────────
GRAPH = 'https://graph.facebook.com/v20.0'
AUTH_URL = 'https://www.facebook.com/v20.0/dialog/oauth'

SCOPES = ','.join([
    'pages_show_list',
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_messaging',
    'instagram_basic',
    'instagram_content_publish',
])


# ── STEP 1: React calls this to get the OAuth URL ──────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facebook_initiate(request):
    """
    GET /api/v1/platforms/facebook/initiate/

    React calls this with JWT auth.
    Returns the Facebook OAuth URL.
    React opens this URL in a popup window.
    """
    # Create a random state token stored in DB (prevents CSRF)
    state_obj = OAuthState.objects.create(
        user=request.user,
        platform='facebook',
    )

    params = {
        'client_id': settings.FACEBOOK_APP_ID,
        'redirect_uri': settings.FACEBOOK_REDIRECT_URI,
        'state': str(state_obj.state),
        'scope': SCOPES,
        'response_type': 'code',
    }

    auth_url = f'{AUTH_URL}?{urlencode(params)}'
    return Response({'auth_url': auth_url})


# ── STEP 2: Facebook redirects the popup browser here ─────────────────────

@api_view(['GET'])
@permission_classes([])  # No JWT auth — Facebook sends the browser here
def facebook_callback(request):
    """
    GET /api/v1/platforms/facebook/callback/

    Facebook redirects here after user approves permissions.
    This runs inside the popup window.
    We process everything, save tokens, then close the popup
    using window.postMessage to notify the parent React window.
    """
    # ── Handle user clicking "Cancel" ──
    if 'error' in request.GET:
        return _popup_close('error', 'You cancelled the Facebook connection.')

    code = request.GET.get('code')
    state = request.GET.get('state')

    if not code or not state:
        return _popup_close('error', 'Missing required parameters from Facebook.')

    # ── Validate state (CSRF check) ──
    try:
        state_obj = OAuthState.objects.get(
            state=state,
            platform='facebook',
            used=False,
            expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        return _popup_close('error', 'Invalid or expired state. Please try again.')

    # Mark state as used so it can't be replayed
    state_obj.used = True
    state_obj.save()

    user = state_obj.user

    # ── Exchange code for short-lived user token ──
    token_resp = requests.get(f'{GRAPH}/oauth/access_token', params={
        'client_id': settings.FACEBOOK_APP_ID,
        'client_secret': settings.FACEBOOK_APP_SECRET,
        'redirect_uri': settings.FACEBOOK_REDIRECT_URI,
        'code': code,
    })
    token_data = token_resp.json()

    if 'error' in token_data:
        return _popup_close('error', f"Token exchange failed: {token_data['error'].get('message', 'unknown error')}")

    short_token = token_data['access_token']

    # ── Exchange for long-lived user token (60 days) ──
    ll_resp = requests.get(f'{GRAPH}/oauth/access_token', params={
        'grant_type': 'fb_exchange_token',
        'client_id': settings.FACEBOOK_APP_ID,
        'client_secret': settings.FACEBOOK_APP_SECRET,
        'fb_exchange_token': short_token,
    })
    ll_data = ll_resp.json()
    long_token = ll_data.get('access_token', short_token)

    # ── Get all pages the user manages ──
    # Page tokens from /me/accounts are LONG-LIVED (never expire)
    pages_resp = requests.get(f'{GRAPH}/me/accounts', params={
        'access_token': long_token,
        'fields': 'id,name,access_token,category,tasks,instagram_business_account',
    })
    pages_data = pages_resp.json()

    if 'error' in pages_data:
        return _popup_close('error', f"Could not fetch your pages: {pages_data['error'].get('message')}")

    pages = pages_data.get('data', [])

    if not pages:
        return _popup_close('error', 'No Facebook Pages found. You need to be an admin of at least one page.')

    # ── Save each page as SocialAccount ──
    connected = []
    for page in pages:
        page_id = page['id']
        page_token = page['access_token']
        page_name = page.get('name', '')

        # Get Instagram account ID if linked
        ig_id = ''
        if 'instagram_business_account' in page:
            ig_id = page['instagram_business_account'].get('id', '')

        # Save Facebook connection
        account, _ = SocialAccount.objects.update_or_create(
            user=user,
            platform='facebook',
            facebook_page_id=page_id,
            defaults={
                'account_name': page_name,
                'facebook_access_token': page_token,  # Never expires
                'status': 'active',
                'is_active': True,
                'is_validated': True,
                'token_expires_at': None,  # Page tokens don't expire
            }
        )

        # Save Instagram connection if available
        if ig_id:
            SocialAccount.objects.update_or_create(
                user=user,
                platform='instagram',
                facebook_page_id=page_id,
                defaults={
                    'account_name': f"{page_name} (Instagram)",
                    'instagram_access_token': page_token,  # Same page token works
                    'instagram_business_account_id': ig_id,
                    'status': 'active',
                    'is_active': True,
                    'is_validated': True,
                }
            )

        # Auto-setup Messenger webhook for this page
        _setup_messenger(page_id, page_token, user, page_name)

        connected.append({'id': page_id, 'name': page_name})

    # ── Tell the React parent window it worked, close popup ──
    return _popup_close('success', '', extra={'pages': connected})


# ── HELPER: Setup Messenger bot automatically ───────────────────────────────

def _setup_messenger(page_id, page_token, user, page_name):
    """
    Subscribe the Facebook Page to your app's webhook.
    This activates the Messenger bot for this page.
    No action needed from the user.
    """
    try:
        resp = requests.post(
            f'{GRAPH}/{page_id}/subscribed_apps',
            params={
                'subscribed_fields': 'messages,messaging_postbacks,message_deliveries,message_reads',
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
            AIConfiguration.objects.get_or_create(connection=connection)

    except Exception as e:
        # Don't fail the whole flow if Messenger setup fails
        import logging
        logging.getLogger(__name__).warning(f"Messenger setup failed for page {page_id}: {e}")


# ── HELPER: Return HTML that closes popup + sends message to React ──────────

def _popup_close(status, message, extra=None):
    """
    Returns an HTML page served inside the popup window.
    It uses window.postMessage to send the result to the parent React window,
    then closes itself.
    """
    data = {'type': f'FB_OAUTH_{status.upper()}', 'message': message}
    if extra:
        data.update(extra)

    frontend_url = settings.FRONTEND_URL
    data_json = json.dumps(data)

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><title>Connecting...</title></head>
    <body>
        <p style="font-family:sans-serif;text-align:center;margin-top:100px;">
            {'Connected! Closing...' if status == 'success' else f'Error: {message}'}
        </p>
        <script>
            try {{
                if (window.opener) {{
                    window.opener.postMessage({data_json}, '{frontend_url}');
                }}
            }} catch(e) {{
                console.error('postMessage failed:', e);
            }}
            setTimeout(function() {{ window.close(); }}, 1000);
        </script>
    </body>
    </html>
    """
    return HttpResponse(html, content_type='text/html')
```

### Step 2.5 — Add URL Routes

In `api/urls.py`, add these 2 lines:

```python
# At the top, add import:
from platforms.oauth_views import facebook_initiate, facebook_callback

# In urlpatterns list, add:
path('platforms/facebook/initiate/', facebook_initiate, name='fb-initiate'),
path('platforms/facebook/callback/', facebook_callback, name='fb-callback'),
```

That's it for the backend. Two endpoints:
- `GET /api/v1/platforms/facebook/initiate/` → requires JWT, returns auth URL
- `GET /api/v1/platforms/facebook/callback/` → no auth, Facebook redirects here

---

## PHASE 3 — REACT FRONTEND

### Step 3.1 — The Connect Button Component

Create `ConnectFacebook.jsx`:

```jsx
import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api'; // your axios instance with JWT

const ConnectFacebook = ({ onConnected }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleMessage = (event) => {
    // Security: only accept messages from your own API domain
    if (event.origin !== process.env.REACT_APP_API_BASE_URL) return;

    const { type, message, pages } = event.data;

    if (type === 'FB_OAUTH_SUCCESS') {
      clearInterval(pollRef.current);
      window.removeEventListener('message', handleMessage);
      setLoading(false);
      onConnected?.(pages);  // Tell parent component which pages connected
    }

    if (type === 'FB_OAUTH_ERROR') {
      clearInterval(pollRef.current);
      window.removeEventListener('message', handleMessage);
      setLoading(false);
      setError(message);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Get OAuth URL from your backend
      const { data } = await api.get('/api/v1/platforms/facebook/initiate/');

      // Step 2: Open popup centered on screen
      const w = 650, h = 700;
      const left = window.screen.width / 2 - w / 2;
      const top = window.screen.height / 2 - h / 2;

      popupRef.current = window.open(
        data.auth_url,
        'fb_connect',
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      // Popup was blocked by browser
      if (!popupRef.current) {
        setError('Popup blocked! Please allow popups for this site and try again.');
        setLoading(false);
        return;
      }

      // Step 3: Listen for result from popup
      window.addEventListener('message', handleMessage);

      // Step 4: Detect if user closed popup manually (without completing)
      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(pollRef.current);
          // Wait a bit in case postMessage is still arriving
          setTimeout(() => {
            window.removeEventListener('message', handleMessage);
            if (loading) {  // If still loading, user cancelled
              setLoading(false);
            }
          }, 500);
        }
      }, 500);

    } catch (err) {
      setError('Failed to start Facebook connection. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={loading}
        style={{
          backgroundColor: '#1877F2',  // Facebook blue
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Facebook icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        {loading ? 'Connecting...' : 'Connect Facebook Pages'}
      </button>

      {error && (
        <p style={{ color: 'red', marginTop: '8px', fontSize: '14px' }}>
          ⚠️ {error}
        </p>
      )}
    </div>
  );
};

export default ConnectFacebook;
```

### Step 3.2 — Using the Component

```jsx
// In your platforms/settings page:
import ConnectFacebook from './ConnectFacebook';

const PlatformsPage = () => {
  const [connectedPages, setConnectedPages] = useState([]);

  const handleConnected = (pages) => {
    setConnectedPages(prev => [...prev, ...pages]);
    // Show success notification
    toast.success(`${pages.length} Facebook page(s) connected!`);
    // Refresh the connected accounts list
    fetchConnectedAccounts();
  };

  return (
    <div>
      <h2>Connected Platforms</h2>

      {/* The connect button */}
      <ConnectFacebook onConnected={handleConnected} />

      {/* List connected pages */}
      {connectedPages.map(page => (
        <div key={page.id}>
          ✅ {page.name}
        </div>
      ))}
    </div>
  );
};
```

### Step 3.3 — Add to .env (React)

```
REACT_APP_API_BASE_URL=http://localhost:8000
```

This is used in the `handleMessage` origin check for security.

---

## PHASE 4 — MESSENGER WEBHOOK (One-Time Setup by You)

The Messenger bot activates automatically for each page (code in Step 2.4 handles that). But you need to register your webhook URL in the Facebook App Dashboard **once**.

### Step 4.1 — Register Webhook in Dashboard

Go to: **App Dashboard → Products → Messenger → Settings → Webhooks**

- **Callback URL:** `https://your-ngrok-url.ngrok-free.app/api/messenger/webhook/`
  (or your production URL)
- **Verify Token:** any secret string you pick → add to `.env` as `MESSENGER_VERIFY_TOKEN`
- **Webhook fields to subscribe:** check `messages`, `messaging_postbacks`, `message_deliveries`

Click **"Verify and Save"** — Facebook sends a GET request to your callback URL.

Your existing webhook handler in `messenger_bot/views.py` already handles this verification (it checks `hub.verify_token`). Make sure `MESSENGER_VERIFY_TOKEN` in settings matches what you entered in the dashboard.

### Step 4.2 — For Local Testing with ngrok

```bash
# Install ngrok from https://ngrok.com/download
ngrok http 8000

# Output:
# Forwarding https://abc123.ngrok-free.app -> http://localhost:8000
```

Use `https://abc123.ngrok-free.app` as your webhook URL in the dashboard.
Add it to `.env`:
```
FACEBOOK_REDIRECT_URI=https://abc123.ngrok-free.app/api/v1/platforms/facebook/callback/
```

> ngrok URL changes each restart (free plan). Use `ngrok http 8000 --subdomain=mysaleanto` with paid plan for a stable URL.

---

## PHASE 5 — TESTING

### Step 5.1 — Test with Your Own Facebook Page

1. Make sure you're an Admin on the Facebook App (you are, you created it)
2. Start your Django server and React app
3. Click "Connect Facebook Pages" button
4. Facebook login popup opens
5. Log in with your Facebook account
6. Approve permissions
7. Check your DB: `SocialAccount.objects.filter(platform='facebook').all()`

### Step 5.2 — Add Team Members for Testing

In App Dashboard → **Roles → Testers → Add Testers**:
- Enter their Facebook email
- They must accept at: `https://developers.facebook.com/apps/YOUR_APP_ID/roles/`
- After accepting, they can test the OAuth flow with their real accounts

### Step 5.3 — Debug Tools

**Facebook Token Debugger** — inspect any token:
```
https://developers.facebook.com/tools/debug/accesstoken/
```
Enter any access token → see if valid, expiry, scopes.

**Facebook Graph API Explorer** — test API calls manually:
```
https://developers.facebook.com/tools/explorer/
```
Test `/me/accounts` to see what your pages response looks like before writing code.

**ngrok Dashboard** — see all incoming webhook requests:
```
http://localhost:4040
```
Shows every request Facebook sends, lets you replay them.

---

## PHASE 6 — GOING LIVE (For Real Users)

### Step 6.1 — Business Verification

In App Dashboard → **Settings → Basic → Verification**:
- Submit your business documents (registration certificate, bank statement, or utility bill with business address)
- Takes 3-5 business days

### Step 6.2 — App Review (Required for Real Users' Pages)

You need App Review for these permissions before real users (outside your team) can connect:

| Permission | Needs Review |
|-----------|-------------|
| `pages_show_list` | Yes |
| `pages_manage_posts` | Yes |
| `pages_read_engagement` | Yes |
| `pages_manage_metadata` | Yes |
| `pages_messaging` | Yes |
| `instagram_content_publish` | Yes |

For each permission, submit:
1. A **screencast video** showing the full OAuth connect flow in your app
2. A **screencast** showing the feature being used (e.g., posting to Facebook page)
3. Description of why you need the permission
4. Link to your privacy policy (must be public, not localhost)

Review takes **2-7 business days**. Most common rejection: reviewers can't test your app. Create a test account they can use.

### Step 6.3 — Switch to Live Mode

App Dashboard → **App Settings → Basic → App Status → Live**

After switching:
- Any Facebook user can now connect their pages
- Only App Review-approved permissions work for public users

---

## WHAT CHANGES IN YOUR EXISTING CODE

### Minimal changes needed:

| What | Change |
|------|--------|
| `accounts/models.py` | Add `OAuthState` model |
| `platforms/oauth_views.py` | Create new file (full code in Phase 2) |
| `api/urls.py` | Add 2 new URL patterns |
| `socialsync/settings.py` | Add 4 new settings |
| `.env` | Add `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |

### What stays the same:
- `platforms/services/facebook.py` — posting still works exactly the same
- `messenger_bot/views.py` — webhook handler unchanged
- `messenger_bot/models.py` — MessengerConnection model unchanged, just auto-filled now
- `platforms/models.py` — SocialAccount model unchanged
- All existing API endpoints — unchanged

---

## COMMON ERRORS & FIXES

| Error | Cause | Fix |
|-------|-------|-----|
| "App Not Set Up" | App in Dev mode, user not a tester | Add user as Tester in App Roles |
| "Invalid redirect_uri" | URI doesn't match exactly | Copy-paste the exact URI from settings into Facebook dashboard |
| "Code invalid or expired" | Code used twice or after 10 min | Don't retry — user must re-authorize |
| "Popup blocked" | Browser blocked the popup | Ask user to allow popups, or use redirect instead of popup |
| "No pages found" | User has no pages OR not page admin | Tell user they need to be admin of a Facebook Page |
| Webhook not working | App-level webhook not registered | Go to App Dashboard → Messenger → Webhooks → add callback URL |
| Messenger bot silent | Page not subscribed to webhook | Check `_setup_messenger()` ran, call `/page_id/subscribed_apps` manually |

---

## FULL FLOW SUMMARY (1 minute read)

```
SETUP (You do once):
 1. Create Facebook Business App in Meta Developer Console
 2. Add "Facebook Login for Business" and "Messenger" products
 3. Add your redirect URI to Valid OAuth Redirect URIs
 4. Register your webhook URL in Messenger settings
 5. Add FACEBOOK_APP_ID + FACEBOOK_APP_SECRET to .env

CODE (Write once):
 1. Create OAuthState model → migrate
 2. Create platforms/oauth_views.py with 2 views:
    - facebook_initiate → returns auth URL
    - facebook_callback → exchanges tokens, saves pages, closes popup
 3. Add 2 URLs to api/urls.py
 4. Add ConnectFacebook.jsx to React

USER FLOW (Zero effort for users):
 Click button → popup → login → approve → done
 Pages connected + Messenger bot live automatically

GOING LIVE:
 Business Verification → App Review → Switch to Live Mode
```
