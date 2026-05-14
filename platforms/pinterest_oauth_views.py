"""
Pinterest OAuth 2.0 — Connection System
=========================================
Endpoints:
  GET  /api/v1/platforms/pinterest/initiate/   → returns auth URL for popup
  GET  /api/v1/platforms/pinterest/callback/   → Pinterest redirects here (no JWT)
  GET  /api/v1/platforms/pinterest/status/     → real-time connection health
  GET  /api/v1/platforms/pinterest/boards/     → list user's boards for pin placement

Flow mirrors Facebook/LinkedIn OAuth exactly:
  1. User clicks "Connect Pinterest" → popup opens
  2. User authorizes → redirected to callback
  3. Callback exchanges code → access_token + refresh_token
  4. Fetches user profile (username)
  5. Saves SocialAccount
  6. Popup closes via localStorage + postMessage
"""

import base64
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
from platforms.services.pinterest import PinterestService
from accounts.models import SiteConfiguration

logger = logging.getLogger(__name__)

# ─── Pinterest API Constants ─────────────────────────────────────────────────

PIN_AUTH_URL  = 'https://www.pinterest.com/oauth/'
PIN_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token'
PIN_API_BASE  = 'https://api.pinterest.com/v5'

# Scopes for posting pins (image + video) and reading boards
PIN_SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read'


# ─── DB Config Helpers ───────────────────────────────────────────────────────

def _get_pin_config():
    client_id     = SiteConfiguration.get('pinterest_client_id',     getattr(settings, 'PINTEREST_CLIENT_ID', ''))
    client_secret = SiteConfiguration.get('pinterest_client_secret', getattr(settings, 'PINTEREST_CLIENT_SECRET', ''))
    redirect_uri  = SiteConfiguration.get('pinterest_redirect_uri',  getattr(settings, 'PINTEREST_REDIRECT_URI', ''))
    frontend_url  = SiteConfiguration.get('frontend_url',            getattr(settings, 'FRONTEND_URL', ''))
    return {
        'client_id':     client_id.strip() if client_id else '',
        'client_secret': client_secret.strip() if client_secret else '',
        'redirect_uri':  redirect_uri.strip() if redirect_uri else '',
        'frontend_url':  frontend_url.strip() if frontend_url else '',
    }


def _config_is_complete(cfg):
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


def _basic_auth_header(client_id, client_secret):
    credentials = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    return f'Basic {credentials}'


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 1 — Initiate OAuth
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pinterest_oauth_initiate(request):
    """Returns Pinterest auth URL → React opens it in a popup."""

    cfg = _get_pin_config()

    if not _config_is_complete(cfg):
        return Response(
            {
                'error': 'Pinterest connection is not configured.',
                'detail': (
                    'The admin has not set up Pinterest App credentials yet. '
                    'Go to Admin Panel → Integrations → Pinterest Settings.'
                ),
                'config_missing': True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    try:
        if not request.user.profile.can_add_account():
            limit = request.user.profile.max_social_accounts
            return Response(
                {
                    'error': 'Account limit reached.',
                    'detail': f'Your plan allows a maximum of {limit} social account(s).',
                },
                status=status.HTTP_403_FORBIDDEN
            )
    except Exception:
        pass

    state_obj = OAuthState.objects.create(
        user=request.user,
        platform='pinterest',
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'client_id':     cfg['client_id'],
        'redirect_uri':  cfg['redirect_uri'],
        'response_type': 'code',
        'scope':         PIN_SCOPES,
        'state':         str(state_obj.state),
    }

    auth_url = f'{PIN_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[PIN OAuth] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 2 — OAuth Callback
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def pinterest_oauth_callback(request):
    """
    Pinterest redirects here after user approves/denies.
    Pipeline: code → access_token + refresh_token → /v5/user_account → save SocialAccount
    """

    code  = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    error = request.GET.get('error', '')
    error_desc = request.GET.get('error_description', '')

    if error:
        if error in ('access_denied', 'user_denied'):
            return _popup_error(
                'Connection Cancelled',
                'You cancelled the Pinterest login. Click "Connect Pinterest" again to continue.'
            )
        return _popup_error(
            'Pinterest Login Failed',
            error_desc or 'An unexpected error occurred. Please try again.'
        )

    if not code or not state:
        return _popup_error(
            'Invalid Response from Pinterest',
            'The login response was missing required data. Please try connecting again.'
        )

    cfg = _get_pin_config()
    if not _config_is_complete(cfg):
        return _popup_error('Pinterest Not Configured', 'Please contact the administrator.')

    # Validate CSRF state
    try:
        state_obj = OAuthState.objects.get(
            state=state,
            platform='pinterest',
            used=False,
            expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        existing = OAuthState.objects.filter(state=state, platform='pinterest').first()
        if existing and existing.used:
            detail = 'This login link has already been used. Please start again.'
        elif existing and existing.expires_at < timezone.now():
            detail = 'Your session expired (10-minute limit). Please try again.'
        else:
            detail = 'Invalid session token. Please try connecting again.'
        return _popup_error('Session Validation Failed', detail)

    state_obj.used = True
    state_obj.save(update_fields=['used'])
    user = state_obj.user
    logger.info(f'[PIN OAuth] Callback for user {user.username} — state validated')

    # ── Step 1: code → tokens ────────────────────────────────────────────────
    try:
        resp = requests.post(PIN_TOKEN_URL, data={
            'grant_type':   'authorization_code',
            'code':         code,
            'redirect_uri': cfg['redirect_uri'],
        }, headers={
            'Authorization': _basic_auth_header(cfg['client_id'], cfg['client_secret']),
            'Content-Type': 'application/x-www-form-urlencoded',
        }, timeout=15)

        try:
            token_data = resp.json()
        except ValueError:
            logger.error(f'[PIN OAuth] Step 1 non-JSON response: {resp.status_code}')
            return _popup_error('Login Failed', f'Pinterest returned an invalid response (HTTP {resp.status_code}).')

    except requests.Timeout:
        logger.error('[PIN OAuth] Step 1 timed out')
        return _popup_error('Connection Timed Out', 'Pinterest took too long. Please try again.')
    except requests.ConnectionError:
        logger.error('[PIN OAuth] Step 1 network error')
        return _popup_error('Could Not Reach Pinterest', 'Network error. Please check your internet connection.')
    except Exception as e:
        logger.error(f'[PIN OAuth] Step 1 failed: {e}')
        return _popup_error('Could Not Reach Pinterest', 'Please check your internet connection and try again.')

    if 'error' in token_data or resp.status_code != 200:
        err = token_data.get('error_description', token_data.get('message', 'Unknown error'))
        logger.error(f'[PIN OAuth] Step 1 error: {token_data}')
        return _popup_error('Login Failed', f'Pinterest error: {err}')

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in    = token_data.get('expires_in', 2592000)  # Default 30 days

    if not access_token:
        return _popup_error('No Token Received', 'Pinterest did not return a token.')

    token_expires_at = timezone.now() + timedelta(seconds=expires_in)
    logger.info(f'[PIN OAuth] Token obtained, expires in {expires_in}s')

    # ── Step 2: fetch user profile ───────────────────────────────────────────
    try:
        resp = requests.get(
            f'{PIN_API_BASE}/user_account',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=15
        )

        try:
            profile = resp.json()
        except ValueError:
            logger.error(f'[PIN OAuth] Step 2 non-JSON response: {resp.status_code}')
            return _popup_error('Profile Fetch Failed', 'Pinterest returned an invalid response.')

    except requests.Timeout:
        return _popup_error('Could Not Fetch Profile', 'Pinterest took too long.')
    except requests.ConnectionError:
        return _popup_error('Could Not Fetch Profile', 'Network error. Please check your connection.')
    except Exception as e:
        logger.error(f'[PIN OAuth] Step 2 failed: {e}')
        return _popup_error('Could Not Fetch Profile', 'Please try again.')

    if resp.status_code == 401:
        return _popup_error('Token Rejected', 'Pinterest rejected the token. Please try connecting again.')

    if resp.status_code != 200:
        error_msg = profile.get('message', 'Could not read your Pinterest profile.') if isinstance(profile, dict) else 'Unknown error'
        return _popup_error('Profile Fetch Failed', error_msg)

    username = profile.get('username', 'Pinterest User')
    profile_image = profile.get('profile_image', '')
    account_type = profile.get('account_type', 'PERSONAL')

    # ── Step 3: save SocialAccount ───────────────────────────────────────────
    try:
        existing = SocialAccount.objects.filter(
            user=user, platform='pinterest', account_name=username
        ).first()

        if existing:
            existing.pinterest_access_token = access_token
            existing.pinterest_refresh_token = refresh_token or existing.pinterest_refresh_token
            existing.token_expires_at = token_expires_at
            existing.validation_error = ''
            existing.save(update_fields=[
                'pinterest_access_token', 'pinterest_refresh_token',
                'token_expires_at', 'validation_error',
            ])
            account = existing
        else:
            account, _ = SocialAccount.objects.update_or_create(
                user=user,
                platform='pinterest',
                account_name=username,
                defaults={
                    'pinterest_access_token':  access_token,
                    'pinterest_refresh_token': refresh_token,
                    'token_expires_at':        token_expires_at,
                    'validation_error':        '',
                }
            )

        # Validate
        valid, result = PinterestService.validate_credentials(access_token)
        if valid:
            account.mark_as_active()
            logger.info(f'[PIN OAuth] Account saved and validated: {username}')
        else:
            account.mark_as_invalid(result)
            logger.warning(f'[PIN OAuth] Validation failed: {result}')
            return _popup_error('Validation Failed', f'Token saved but validation failed: {result}')

    except Exception as e:
        logger.error(f'[PIN OAuth] Account save failed: {e}')
        return _popup_error('Could Not Save Account', 'Database error. Please try again.')

    # ── Fetch boards for convenience ─────────────────────────────────────────
    boards = []
    try:
        success, board_data = PinterestService.list_boards(access_token)
        if success:
            boards = board_data
            # Save first board as default if none set
            if boards and not account.pinterest_board_id:
                account.pinterest_board_id = boards[0]['id']
                account.save(update_fields=['pinterest_board_id'])
    except Exception as e:
        logger.warning(f'[PIN OAuth] Board fetch failed: {e}')

    account_info = {
        'id': account.id,
        'name': username,
        'account_type': account_type,
        'profile_image': profile_image,
        'status': 'active',
        'boards': boards,
    }

    logger.info(f'[PIN OAuth] Success for {user.username}: {username} ({len(boards)} boards)')
    return _popup_success(account_info)


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 3 — Connection Status
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pinterest_connection_status(request):
    """Returns real-time Pinterest connection health."""
    user = request.user
    force_refresh = request.GET.get('refresh') == '1'

    accounts = SocialAccount.objects.filter(
        user=user, platform='pinterest'
    ).order_by('-connected_at')

    if not accounts.exists():
        return Response({
            'overall_status': 'not_connected',
            'accounts': [],
            'total_accounts': 0,
            'active_accounts': 0,
        })

    if force_refresh:
        for acc in accounts:
            if acc.pinterest_access_token:
                if acc.is_token_expired():
                    acc.mark_as_expired()
                    continue
                valid, result = PinterestService.validate_credentials(acc.pinterest_access_token)
                if valid:
                    acc.mark_as_active()
                else:
                    acc.mark_as_invalid(result)

    account_list = []
    for acc in accounts:
        account_list.append({
            'account_id': acc.id,
            'name': acc.account_name,
            'board_id': acc.pinterest_board_id,
            'status': acc.status,
            'status_display': acc.get_status_display(),
            'is_active': acc.is_active,
            'is_validated': acc.is_validated,
            'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
            'error_message': acc.validation_error,
            'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
            'last_validated_at': acc.last_validated_at.isoformat() if acc.last_validated_at else None,
        })

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
        'total_accounts': total_count,
        'active_accounts': active_count,
    })


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 4 — List Boards (for pin placement dropdown)
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pinterest_list_boards(request):
    """Fetch user's Pinterest boards for selecting where to post pins."""
    account = SocialAccount.objects.filter(
        user=request.user, platform='pinterest', status='active'
    ).first()

    if not account or not account.pinterest_access_token:
        return Response(
            {'error': 'No active Pinterest account connected.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if account.is_token_expired():
        return Response(
            {'error': 'Pinterest token has expired. Please reconnect your Pinterest account.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    success, result = PinterestService.list_boards(account.pinterest_access_token)
    if success:
        return Response({'boards': result, 'current_board_id': account.pinterest_board_id})
    else:
        return Response({'error': f'Failed to fetch boards: {result}'}, status=status.HTTP_502_BAD_GATEWAY)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — Popup HTML
# ══════════════════════════════════════════════════════════════════════════════

def _popup_success(account_info, warning=None):
    data = json.dumps({
        'type':    'PIN_OAUTH_SUCCESS',
        'account': account_info,
        'warning': warning,
    })
    return _render_popup_html(data, success=True, warning=warning)


def _popup_error(title, detail=''):
    data = json.dumps({
        'type':   'PIN_OAUTH_ERROR',
        'title':  title,
        'detail': detail,
    })
    return _render_popup_html(data, success=False, title=title, detail=detail)


def _render_popup_html(json_data, success=True, warning=None, title=None, detail=None):
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'

    if success:
        icon = '&#10004;'
        heading = 'Pinterest Connected!'
        body = '<p>Your Pinterest account is now connected.</p>'
        if warning:
            body += f'<p class="warn">&#9888; {html_lib.escape(str(warning))}</p>'
        heading_color = '#E60023'  # Pinterest red
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
  <title>Pinterest Connection</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }}
    .card {{
      background: #fff; border-radius: 16px; padding: 48px 36px; max-width: 400px; width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12); text-align: center;
    }}
    .icon {{ font-size: 56px; margin-bottom: 20px; }}
    h2 {{ color: {heading_color}; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
    p {{ color: #555; font-size: 14px; line-height: 1.6; margin-top: 8px; }}
    .detail {{ color: #777; font-size: 13px; }}
    .warn {{ color: #e65100; background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 10px 14px; margin-top: 14px; font-size: 13px; text-align: left; }}
    .closing {{ color: #bbb; font-size: 12px; margin-top: 24px; }}
    .progress {{ height: 3px; background: #e0e0e0; border-radius: 3px; margin-top: 20px; overflow: hidden; }}
    .progress-bar {{ height: 100%; background: {heading_color}; animation: fill 2.5s linear forwards; }}
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
      try {{ localStorage.setItem('pin_oauth_result', JSON.stringify(payload)); }} catch (e) {{ }}
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, '{frontend_url}');
        }}
      }} catch (e) {{ }}
      setTimeout(function () {{ window.close(); }}, 2500);
    }})();
  </script>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
