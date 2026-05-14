"""
LinkedIn OAuth 2.0 — Connection System
========================================
Endpoints:
  GET  /api/v1/platforms/linkedin/initiate/   → returns auth URL for popup
  GET  /api/v1/platforms/linkedin/callback/   → LinkedIn redirects here (no JWT needed)
  GET  /api/v1/platforms/linkedin/status/     → real-time connection health

Flow mirrors Facebook OAuth exactly:
  1. User clicks "Connect LinkedIn" → popup opens
  2. User authorizes on LinkedIn → redirected to callback
  3. Callback exchanges code → access token (+ refresh if Community Mgmt API)
  4. Fetches user profile (person URN) + company pages (organization URNs)
  5. Saves SocialAccount(s) — personal profile + each admin org
  6. Popup closes via localStorage + postMessage (immune to COOP headers)

Integration:
  - SocialAccount model (platforms/models.py) → update_or_create, mark_as_active()
  - LinkedInService.validate_credentials()    → live token check
  - OAuthState model                          → one-time CSRF token
"""

import html as html_lib
import json
import logging
import requests
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from platforms.models import SocialAccount, OAuthState
from platforms.services.linkedin import LinkedInService
from accounts.models import SiteConfiguration

logger = logging.getLogger(__name__)

# ─── LinkedIn API Constants ──────────────────────────────────────────────────

LI_AUTH_URL  = 'https://www.linkedin.com/oauth/v2/authorization'
LI_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
LI_API_BASE  = 'https://api.linkedin.com'

# Scopes — basic scopes available on all LinkedIn apps
# w_organization_social / r_organization_social require Community Management API approval;
# omit them here so the auth flow works on standard apps. The org-page fetch
# in the callback already handles a 403 gracefully (personal profile still connects).
LI_SCOPES = 'openid profile email w_member_social'

# LinkedIn API versioning — required on ALL REST API calls
LI_API_VERSION = '202604'


# ─── DB Config Helpers ───────────────────────────────────────────────────────

def _get_li_config():
    """
    Returns LinkedIn OAuth config from SiteConfiguration DB table.
    Falls back to settings.py values if DB values are empty.
    """
    client_id     = SiteConfiguration.get('linkedin_client_id',     getattr(settings, 'LINKEDIN_CLIENT_ID', ''))
    client_secret = SiteConfiguration.get('linkedin_client_secret', getattr(settings, 'LINKEDIN_CLIENT_SECRET', ''))
    redirect_uri  = SiteConfiguration.get('linkedin_redirect_uri',  getattr(settings, 'LINKEDIN_REDIRECT_URI', ''))
    frontend_url  = SiteConfiguration.get('frontend_url',           getattr(settings, 'FRONTEND_URL', ''))
    return {
        'client_id':     client_id.strip() if client_id else '',
        'client_secret': client_secret.strip() if client_secret else '',
        'redirect_uri':  redirect_uri.strip() if redirect_uri else '',
        'frontend_url':  frontend_url.strip() if frontend_url else '',
    }


def _config_is_complete(cfg):
    """Returns True only if all required LinkedIn OAuth fields are set."""
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


# ─── LinkedIn API Headers ────────────────────────────────────────────────────

def _li_headers(access_token):
    """Standard headers for LinkedIn REST API calls."""
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LI_API_VERSION,
    }


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 1 — Initiate OAuth
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def linkedin_oauth_initiate(request):
    """
    React calls this when user clicks "Connect LinkedIn".
    Returns the LinkedIn auth URL → React opens it in a popup.
    """

    cfg = _get_li_config()

    if not _config_is_complete(cfg):
        return Response(
            {
                'error': 'LinkedIn connection is not configured.',
                'detail': (
                    'The admin has not set up LinkedIn App credentials yet. '
                    'Go to Admin Panel → Integrations → LinkedIn Settings and enter '
                    'your Client ID, Client Secret, and Redirect URI.'
                ),
                'config_missing': True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    # Guard: check subscription plan account limit
    try:
        if not request.user.profile.can_add_account():
            limit = request.user.profile.max_social_accounts
            return Response(
                {
                    'error': 'Account limit reached.',
                    'detail': f'Your plan allows a maximum of {limit} social account(s). Upgrade your plan to connect more.',
                },
                status=status.HTTP_403_FORBIDDEN
            )
    except Exception:
        pass

    # Create one-time CSRF state (expires in 10 minutes)
    state_obj = OAuthState.objects.create(
        user=request.user,
        platform='linkedin',
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'response_type': 'code',
        'client_id':     cfg['client_id'],
        'redirect_uri':  cfg['redirect_uri'],
        'state':         str(state_obj.state),
        'scope':         LI_SCOPES,
    }

    auth_url = f'{LI_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[LI OAuth] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 2 — OAuth Callback (LinkedIn redirects here — no JWT)
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def linkedin_oauth_callback(request):
    """
    LinkedIn redirects here after user approves (or denies) permissions.
    Pipeline:
      code → access_token (+ optional refresh_token)
      → /v2/userinfo (person URN, name, email)
      → /rest/organizationAcls (company pages user is admin of)
      → SocialAccount.update_or_create() for personal + each org
      → HTML page that postMessages result back to React popup parent
    """

    code  = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    error = request.GET.get('error', '')
    error_desc = request.GET.get('error_description', '')

    # User cancelled / denied
    if error:
        if error in ('user_cancelled_authorize', 'user_cancelled_login', 'access_denied'):
            return _popup_error(
                'Connection Cancelled',
                'You cancelled the LinkedIn login or denied permissions. '
                'Click "Connect LinkedIn" again and approve all permissions to continue.'
            )
        return _popup_error(
            'LinkedIn Login Failed',
            error_desc or 'An unexpected error occurred during LinkedIn login. Please try again.'
        )

    # Missing parameters
    if not code or not state:
        return _popup_error(
            'Invalid Response from LinkedIn',
            'The login response was missing required data. Please try connecting again.'
        )

    # Read config
    cfg = _get_li_config()
    if not _config_is_complete(cfg):
        return _popup_error(
            'LinkedIn Not Configured',
            'The admin has not set up LinkedIn App credentials. Please contact the administrator.'
        )

    # Validate CSRF state
    try:
        state_obj = OAuthState.objects.get(
            state=state,
            platform='linkedin',
            used=False,
            expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        existing = OAuthState.objects.filter(state=state, platform='linkedin').first()
        if existing and existing.used:
            detail = 'This login link has already been used. Please start the connection process again.'
        elif existing and existing.expires_at < timezone.now():
            detail = 'Your session expired (10-minute limit). Please click "Connect LinkedIn" again.'
        else:
            detail = 'Invalid session token. Please try connecting again.'
        return _popup_error('Session Validation Failed', detail)

    # Mark used immediately
    state_obj.used = True
    state_obj.save(update_fields=['used'])
    user = state_obj.user
    logger.info(f'[LI OAuth] Callback for user {user.username} — state validated')

    # ── Step 1: code → access token ─────────────────────────────────────────
    try:
        resp = requests.post(LI_TOKEN_URL, data={
            'grant_type':    'authorization_code',
            'code':          code,
            'client_id':     cfg['client_id'],
            'client_secret': cfg['client_secret'],
            'redirect_uri':  cfg['redirect_uri'],
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=15)
        token_data = resp.json()
    except requests.Timeout:
        logger.error('[LI OAuth] Step 1 (code→token) timed out')
        return _popup_error('Connection Timed Out', 'LinkedIn took too long to respond. Please try again.')
    except Exception as e:
        logger.error(f'[LI OAuth] Step 1 request failed: {e}')
        return _popup_error('Could Not Reach LinkedIn', 'Please check your internet connection and try again.')

    if 'error' in token_data:
        err = token_data.get('error_description', token_data.get('error', 'Unknown error'))
        logger.error(f'[LI OAuth] Step 1 error: {token_data}')
        return _popup_error('Login Failed', f'LinkedIn error: {err}')

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token')  # Only with Community Mgmt API
    expires_in    = token_data.get('expires_in', 5184000)  # Default 60 days

    if not access_token:
        logger.error('[LI OAuth] Step 1 returned no access_token')
        return _popup_error('No Token Received', 'LinkedIn did not return a token. Please try again.')

    token_expires_at = timezone.now() + timedelta(seconds=expires_in)
    logger.info(f'[LI OAuth] Token obtained, expires in {expires_in}s, refresh_token={"yes" if refresh_token else "no"}')

    # ── Step 2: fetch user profile (person URN) ─────────────────────────────
    try:
        resp = requests.get(
            f'{LI_API_BASE}/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=15
        )
        profile = resp.json()
    except requests.Timeout:
        logger.error('[LI OAuth] Step 2 (userinfo) timed out')
        return _popup_error('Could Not Fetch Your Profile', 'LinkedIn took too long to load your profile.')
    except Exception as e:
        logger.error(f'[LI OAuth] Step 2 failed: {e}')
        return _popup_error('Could Not Fetch Your Profile', 'Please try again.')

    if 'error' in profile:
        logger.error(f'[LI OAuth] Step 2 error: {profile}')
        return _popup_error('Profile Fetch Failed', profile.get('error_description', 'Could not read your LinkedIn profile.'))

    person_id = profile.get('sub', '')
    person_name = profile.get('name', 'LinkedIn User')
    person_email = profile.get('email', '')
    person_urn = f'urn:li:person:{person_id}' if person_id else ''

    if not person_id:
        logger.error(f'[LI OAuth] No person ID in profile: {profile}')
        return _popup_error('Profile Data Missing', 'Could not identify your LinkedIn account. Please try again.')

    # ── Step 3: save personal profile SocialAccount ──────────────────────────
    connected_accounts = []

    try:
        existing = SocialAccount.objects.filter(
            user=user, platform='linkedin', linkedin_person_urn=person_urn
        ).first()

        if existing:
            existing.account_name = person_name
            existing.linkedin_access_token = access_token
            existing.linkedin_refresh_token = refresh_token or existing.linkedin_refresh_token
            existing.token_expires_at = token_expires_at
            existing.validation_error = ''
            existing.save(update_fields=[
                'account_name', 'linkedin_access_token', 'linkedin_refresh_token',
                'token_expires_at', 'validation_error',
            ])
            account = existing
            created = False
        else:
            account, created = SocialAccount.objects.update_or_create(
                user=user,
                platform='linkedin',
                account_name=person_name,
                defaults={
                    'linkedin_access_token':  access_token,
                    'linkedin_refresh_token': refresh_token or '',
                    'linkedin_person_urn':    person_urn,
                    'token_expires_at':       token_expires_at,
                    'validation_error':       '',
                }
            )

        # Validate token
        valid, result = LinkedInService.validate_credentials(access_token)
        if valid:
            account.mark_as_active()
            connected_accounts.append({
                'id': account.id,
                'name': person_name,
                'type': 'personal',
                'person_urn': person_urn,
                'email': person_email,
                'status': 'active',
            })
            logger.info(f'[LI OAuth] Personal profile saved: {person_name} ({person_urn})')
        else:
            account.mark_as_invalid(result)
            connected_accounts.append({
                'id': account.id,
                'name': person_name,
                'type': 'personal',
                'status': 'invalid',
                'error': result,
            })
            logger.warning(f'[LI OAuth] Personal profile validation failed: {result}')

    except Exception as e:
        logger.error(f'[LI OAuth] Personal profile save failed: {e}')

    # ── Step 4: fetch company pages (organizations) ──────────────────────────
    # Always attempt — if scopes aren't approved yet, 403 is handled gracefully
    try:
        resp = requests.get(
            f'{LI_API_BASE}/rest/organizationAcls',
            params={
                'q': 'roleAssignee',
                'role': 'ADMINISTRATOR',
                'state': 'APPROVED',
            },
            headers=_li_headers(access_token),
            timeout=15
        )

        if resp.status_code == 200:
            orgs_data = resp.json()
            org_elements = orgs_data.get('elements', [])
            logger.info(f'[LI OAuth] Found {len(org_elements)} admin organizations')

            for org_element in org_elements:
                org_urn = org_element.get('organization', '')
                if not org_urn:
                    continue

                # Extract org ID from URN
                org_id = org_urn.split(':')[-1] if ':' in org_urn else org_urn

                # Fetch org details (name, logo)
                org_name = f'Organization {org_id}'
                try:
                    org_resp = requests.get(
                        f'{LI_API_BASE}/rest/organizations/{org_id}',
                        headers=_li_headers(access_token),
                        timeout=10
                    )
                    if org_resp.status_code == 200:
                        org_data = org_resp.json()
                        org_name = org_data.get('localizedName', org_name)
                except Exception as e:
                    logger.warning(f'[LI OAuth] Could not fetch org details for {org_id}: {e}')

                # Save organization as a separate SocialAccount
                try:
                    org_existing = SocialAccount.objects.filter(
                        user=user, platform='linkedin',
                        linkedin_organization_urn=org_urn,
                    ).first()

                    if org_existing:
                        org_existing.account_name = f'{org_name} (Company Page)'
                        org_existing.linkedin_access_token = access_token
                        org_existing.linkedin_refresh_token = refresh_token or org_existing.linkedin_refresh_token
                        org_existing.linkedin_person_urn = person_urn
                        org_existing.token_expires_at = token_expires_at
                        org_existing.validation_error = ''
                        org_existing.save(update_fields=[
                            'account_name', 'linkedin_access_token', 'linkedin_refresh_token',
                            'linkedin_person_urn', 'token_expires_at', 'validation_error',
                        ])
                        org_account = org_existing
                    else:
                        org_account, _ = SocialAccount.objects.update_or_create(
                            user=user,
                            platform='linkedin',
                            account_name=f'{org_name} (Company Page)',
                            defaults={
                                'linkedin_access_token':    access_token,
                                'linkedin_refresh_token':   refresh_token or '',
                                'linkedin_person_urn':      person_urn,
                                'linkedin_organization_urn': org_urn,
                                'token_expires_at':         token_expires_at,
                                'validation_error':         '',
                            }
                        )

                    org_account.mark_as_active()
                    connected_accounts.append({
                        'id': org_account.id,
                        'name': org_name,
                        'type': 'organization',
                        'org_urn': org_urn,
                        'status': 'active',
                    })
                    logger.info(f'[LI OAuth] Organization saved: {org_name} ({org_urn})')

                except Exception as e:
                    logger.error(f'[LI OAuth] Organization save failed for {org_name}: {e}')

        elif resp.status_code == 403:
            logger.info('[LI OAuth] Organization scopes not approved yet — personal profile still connected')
        else:
            logger.warning(f'[LI OAuth] Org fetch returned {resp.status_code}: {resp.text[:200]}')

    except requests.Timeout:
        logger.warning('[LI OAuth] Organization fetch timed out — personal profile still saved')
    except Exception as e:
        logger.error(f'[LI OAuth] Organization fetch failed: {e}')

    # ── Result ───────────────────────────────────────────────────────────────
    if not connected_accounts:
        return _popup_error(
            'Could Not Save Your Account',
            'Failed to connect your LinkedIn account. Please try again or contact support.'
        )

    logger.info(f'[LI OAuth] Success for {user.username}: {len(connected_accounts)} account(s)')
    return _popup_success(connected_accounts)


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 3 — Connection Status
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def linkedin_connection_status(request):
    """
    Returns real-time LinkedIn connection health for the authenticated user.
    """
    user = request.user
    force_refresh = request.GET.get('refresh') == '1'

    accounts = SocialAccount.objects.filter(
        user=user, platform='linkedin'
    ).order_by('-connected_at')

    if not accounts.exists():
        return Response({
            'overall_status': 'not_connected',
            'accounts': [],
            'personal': None,
            'organizations': [],
            'total_accounts': 0,
            'active_accounts': 0,
        })

    # Optionally re-validate tokens
    if force_refresh:
        for acc in accounts:
            if acc.linkedin_access_token:
                # Check if token is expired before hitting the API
                if acc.is_token_expired():
                    acc.mark_as_expired()
                    continue
                valid, result = LinkedInService.validate_credentials(acc.linkedin_access_token)
                if valid:
                    acc.mark_as_active()
                else:
                    acc.mark_as_invalid(result)

    account_list = []
    personal = None
    organizations = []

    for acc in accounts:
        info = {
            'account_id': acc.id,
            'name': acc.account_name,
            'type': 'organization' if acc.linkedin_organization_urn else 'personal',
            'person_urn': acc.linkedin_person_urn,
            'org_urn': acc.linkedin_organization_urn,
            'status': acc.status,
            'status_display': acc.get_status_display(),
            'is_active': acc.is_active,
            'is_validated': acc.is_validated,
            'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
            'error_message': acc.validation_error,
            'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
            'last_validated_at': acc.last_validated_at.isoformat() if acc.last_validated_at else None,
        }
        account_list.append(info)

        if acc.linkedin_organization_urn:
            organizations.append(info)
        elif not personal:
            personal = info

    # Determine overall status
    active_count = sum(1 for a in account_list if a['status'] == 'active')
    total_count = len(account_list)

    if active_count == total_count:
        overall = 'fully_connected'
    elif active_count > 0:
        overall = 'partially_connected'
    elif total_count > 0:
        overall = 'needs_attention'
    else:
        overall = 'not_connected'

    return Response({
        'overall_status': overall,
        'accounts': account_list,
        'personal': personal,
        'organizations': organizations,
        'total_accounts': total_count,
        'active_accounts': active_count,
    })


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — Popup HTML Responses (same pattern as Facebook)
# ══════════════════════════════════════════════════════════════════════════════

def _popup_success(accounts, warning=None):
    """Sends LI_OAUTH_SUCCESS via postMessage and closes popup."""
    data = json.dumps({
        'type':     'LI_OAUTH_SUCCESS',
        'accounts': accounts,
        'warning':  warning,
    })
    return _render_popup_html(data, success=True, warning=warning)


def _popup_error(title, detail=''):
    """Sends LI_OAUTH_ERROR via postMessage and closes popup."""
    data = json.dumps({
        'type':   'LI_OAUTH_ERROR',
        'title':  title,
        'detail': detail,
    })
    return _render_popup_html(data, success=False, title=title, detail=detail)


def _render_popup_html(json_data, success=True, warning=None, title=None, detail=None):
    """
    Returns an HTML page shown briefly in the OAuth popup window.
    Uses localStorage + window.opener.postMessage dual-channel (immune to COOP).
    Auto-closes after 2.5 seconds.
    """
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'

    if success:
        icon = '&#10004;'
        heading = 'LinkedIn Connected!'
        body = '<p>Your LinkedIn account is now connected.</p>'
        if warning:
            body += f'<p class="warn">&#9888; {html_lib.escape(str(warning))}</p>'
        heading_color = '#0077B5'  # LinkedIn blue
    else:
        icon = '&#10060;'
        heading = html_lib.escape(str(title or 'Connection Failed'))
        safe_detail = html_lib.escape(str(detail or 'An error occurred. Please try again.'))
        body = f'<p class="detail">{safe_detail}</p>'
        heading_color = '#c62828'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkedIn Connection</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }}
    .card {{
      background: #ffffff;
      border-radius: 16px;
      padding: 48px 36px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      text-align: center;
    }}
    .icon {{ font-size: 56px; margin-bottom: 20px; }}
    h2 {{
      color: {heading_color};
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
    }}
    p {{
      color: #555;
      font-size: 14px;
      line-height: 1.6;
      margin-top: 8px;
    }}
    .detail {{ color: #777; font-size: 13px; }}
    .warn {{
      color: #e65100;
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: 14px;
      font-size: 13px;
      text-align: left;
    }}
    .closing {{
      color: #bbb;
      font-size: 12px;
      margin-top: 24px;
    }}
    .progress {{
      height: 3px;
      background: #e0e0e0;
      border-radius: 3px;
      margin-top: 20px;
      overflow: hidden;
    }}
    .progress-bar {{
      height: 100%;
      background: {heading_color};
      animation: fill 2.5s linear forwards;
    }}
    @keyframes fill {{ from {{ width: 0%; }} to {{ width: 100%; }} }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">{icon}</div>
    <h2>{heading}</h2>
    {body}
    <p class="closing">This window will close automatically...</p>
    <div class="progress"><div class="progress-bar"></div></div>
  </div>

  <script>
    (function () {{
      var payload = {json_data};

      // Primary channel: localStorage (immune to COOP headers)
      try {{
        localStorage.setItem('li_oauth_result', JSON.stringify(payload));
      }} catch (e) {{
        console.error('[LI OAuth] localStorage write failed:', e);
      }}

      // Secondary channel: postMessage
      try {{
        var targetOrigin = '{frontend_url}';
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, targetOrigin);
        }}
      }} catch (err) {{
        console.error('[LI OAuth] postMessage failed:', err);
      }}

      setTimeout(function () {{
        window.close();
      }}, 2500);
    }})();
  </script>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
