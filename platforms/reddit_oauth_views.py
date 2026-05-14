"""
Reddit OAuth 2.0 — Connection System
================================================
Endpoints:
  GET  /api/v1/platforms/reddit/initiate/   → returns Reddit auth URL for popup
  GET  /api/v1/platforms/reddit/callback/   → Reddit redirects here (no JWT)
  GET  /api/v1/platforms/reddit/status/     → real-time connection health

Flow:
  1. User clicks "Connect Reddit" → popup opens Reddit consent screen
  2. User authorizes → redirected to callback
  3. Callback: code → access_token + refresh_token
  4. Fetches user info (username, icon_img)
  5. Saves SocialAccount with access_token + refresh_token
  6. Popup closes via localStorage + postMessage

CRITICAL: duration=permanent to get refresh_token.
          Reddit uses HTTP Basic Auth for token exchange (base64 client_id:client_secret).
          User-Agent header is MANDATORY for Reddit API.
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
from platforms.services.reddit import RedditService
from accounts.models import SiteConfiguration

logger = logging.getLogger(__name__)

# ─── Reddit OAuth Constants ─────────────────────────────────────────────────

REDDIT_AUTH_URL  = 'https://www.reddit.com/api/v1/authorize'
REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'

# Scopes: identity + read + submit + mysubreddits
REDDIT_SCOPES = 'identity read submit mysubreddits'

# MANDATORY User-Agent for Reddit API
REDDIT_USER_AGENT = 'SocialSyncAI/1.0 (by /u/sellantoai)'


# ─── DB Config Helpers ───────────────────────────────────────────────────────

def _get_reddit_config():
    client_id     = SiteConfiguration.get('reddit_client_id',     getattr(settings, 'REDDIT_CLIENT_ID', ''))
    client_secret = SiteConfiguration.get('reddit_client_secret', getattr(settings, 'REDDIT_CLIENT_SECRET', ''))
    redirect_uri  = SiteConfiguration.get('reddit_redirect_uri',  getattr(settings, 'REDDIT_REDIRECT_URI', ''))
    frontend_url  = SiteConfiguration.get('frontend_url',         getattr(settings, 'FRONTEND_URL', ''))
    return {
        'client_id':     client_id.strip() if client_id else '',
        'client_secret': client_secret.strip() if client_secret else '',
        'redirect_uri':  redirect_uri.strip() if redirect_uri else '',
        'frontend_url':  frontend_url.strip() if frontend_url else '',
    }


def _config_is_complete(cfg):
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 1 — Initiate OAuth
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reddit_oauth_initiate(request):
    """Returns Reddit OAuth URL → React opens it in a popup."""

    cfg = _get_reddit_config()

    if not _config_is_complete(cfg):
        return Response(
            {
                'error': 'Reddit connection is not configured.',
                'detail': 'The admin has not set up Reddit App credentials yet. Go to Admin Panel → Reddit Settings.',
                'config_missing': True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    try:
        if not request.user.profile.can_add_account():
            limit = request.user.profile.max_social_accounts
            return Response(
                {'error': 'Account limit reached.', 'detail': f'Your plan allows {limit} account(s).'},
                status=status.HTTP_403_FORBIDDEN
            )
    except Exception:
        pass

    state_obj = OAuthState.objects.create(
        user=request.user,
        platform='reddit',
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'client_id':     cfg['client_id'],
        'redirect_uri':  cfg['redirect_uri'],
        'response_type': 'code',
        'scope':         REDDIT_SCOPES,
        'duration':      'permanent',     # CRITICAL: get refresh_token
        'state':         str(state_obj.state),
    }

    auth_url = f'{REDDIT_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[Reddit OAuth] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 2 — OAuth Callback
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def reddit_oauth_callback(request):
    """
    Reddit redirects here after authorization.
    Pipeline: code → tokens → user info → save SocialAccount
    """

    code  = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    error = request.GET.get('error', '')

    if error:
        if error in ('access_denied', 'consent_required'):
            return _popup_error(
                'Connection Cancelled',
                'You cancelled the Reddit login or denied permissions. Click "Connect Reddit" again.'
            )
        return _popup_error('Reddit Login Failed', f'Reddit error: {error}')

    if not code or not state:
        return _popup_error('Invalid Response from Reddit', 'Missing required data. Please try again.')

    cfg = _get_reddit_config()
    if not _config_is_complete(cfg):
        return _popup_error('Reddit Not Configured', 'Please contact the administrator.')

    # Validate CSRF state
    try:
        state_obj = OAuthState.objects.get(
            state=state, platform='reddit', used=False, expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        existing = OAuthState.objects.filter(state=state, platform='reddit').first()
        if existing and existing.used:
            detail = 'This login link has already been used. Please start again.'
        elif existing and existing.expires_at < timezone.now():
            detail = 'Session expired (10-minute limit). Please try again.'
        else:
            detail = 'Invalid session token. Please try again.'
        return _popup_error('Session Validation Failed', detail)

    state_obj.used = True
    state_obj.save(update_fields=['used'])
    user = state_obj.user
    logger.info(f'[Reddit OAuth] Callback for user {user.username} — state validated')

    # ── Step 1: code → tokens ────────────────────────────────────────────────
    #    Reddit requires HTTP Basic Auth (base64 client_id:client_secret)
    try:
        credentials = f'{cfg["client_id"]}:{cfg["client_secret"]}'
        basic_auth = base64.b64encode(credentials.encode()).decode()

        resp = requests.post(REDDIT_TOKEN_URL, data={
            'grant_type':    'authorization_code',
            'code':          code,
            'redirect_uri':  cfg['redirect_uri'],
        }, headers={
            'Content-Type':  'application/x-www-form-urlencoded',
            'Authorization': f'Basic {basic_auth}',
            'User-Agent':    REDDIT_USER_AGENT,
        }, timeout=15)

        try:
            token_data = resp.json()
        except ValueError:
            return _popup_error('Login Failed', f'Reddit returned invalid response (HTTP {resp.status_code}).')

    except requests.Timeout:
        return _popup_error('Connection Timed Out', 'Reddit took too long. Please try again.')
    except requests.ConnectionError:
        return _popup_error('Could Not Reach Reddit', 'Network error. Check your internet connection.')
    except Exception as e:
        logger.error(f'[Reddit OAuth] Step 1 failed: {e}')
        return _popup_error('Could Not Reach Reddit', 'Please try again.')

    if 'error' in token_data:
        err = token_data.get('error_description', token_data.get('error', 'Unknown error'))
        logger.error(f'[Reddit OAuth] Step 1 error: {token_data}')
        return _popup_error('Login Failed', f'Reddit error: {err}')

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in    = token_data.get('expires_in', 3600)  # Default 1 hour

    if not access_token:
        return _popup_error('No Token Received', 'Reddit did not return a token.')

    if not refresh_token:
        logger.warning('[Reddit OAuth] No refresh_token received — user may need to re-authorize')

    token_expires_at = timezone.now() + timedelta(seconds=expires_in)
    logger.info(f'[Reddit OAuth] Token obtained, expires in {expires_in}s, refresh={"yes" if refresh_token else "NO"}')

    # ── Step 2: fetch user info ──────────────────────────────────────────────
    valid, result = RedditService.validate_credentials(access_token)

    if not valid:
        logger.error(f'[Reddit OAuth] User info fetch failed: {result}')
        return _popup_error('Account Not Found', result if isinstance(result, str) else 'Could not find your Reddit account.')

    username = result['username']
    icon_img = result.get('icon_img', '')

    # ── Step 3: save SocialAccount ───────────────────────────────────────────
    try:
        existing = SocialAccount.objects.filter(
            user=user, platform='reddit', reddit_username=username
        ).first()

        if existing:
            existing.account_name = username
            existing.reddit_access_token = access_token
            # Only update refresh_token if we got a new one
            if refresh_token:
                existing.reddit_refresh_token = refresh_token
            existing.token_expires_at = token_expires_at
            existing.validation_error = ''
            existing.save(update_fields=[
                'account_name', 'reddit_access_token', 'reddit_refresh_token',
                'token_expires_at', 'validation_error',
            ])
            account = existing
        else:
            account, _ = SocialAccount.objects.update_or_create(
                user=user,
                platform='reddit',
                reddit_username=username,
                defaults={
                    'account_name':          username,
                    'reddit_access_token':   access_token,
                    'reddit_refresh_token':  refresh_token,
                    'token_expires_at':      token_expires_at,
                    'validation_error':      '',
                }
            )

        account.mark_as_active()
        logger.info(f'[Reddit OAuth] Account saved: {username}')

    except Exception as e:
        logger.error(f'[Reddit OAuth] Account save failed: {e}')
        return _popup_error('Could Not Save Account', 'Database error. Please try again.')

    account_info = {
        'id': account.id,
        'name': username,
        'username': username,
        'icon_img': icon_img,
        'has_refresh_token': bool(refresh_token or (existing and existing.reddit_refresh_token)),
        'status': 'active',
    }

    # Warn if no refresh token
    warning = None
    if not refresh_token and not (existing and existing.reddit_refresh_token):
        warning = (
            'No refresh token received. Your access will expire in 1 hour and cannot be auto-renewed. '
            'Make sure duration=permanent is set in the OAuth request. Please try reconnecting.'
        )

    logger.info(f'[Reddit OAuth] Success for {user.username}: {username}')
    return _popup_success(account_info, warning=warning)


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 3 — Connection Status
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reddit_connection_status(request):
    """Returns real-time Reddit connection health."""
    user = request.user
    force_refresh = request.GET.get('refresh') == '1'

    accounts = SocialAccount.objects.filter(
        user=user, platform='reddit'
    ).order_by('-connected_at')

    if not accounts.exists():
        return Response({
            'overall_status': 'not_connected',
            'accounts': [],
            'total_accounts': 0,
            'active_accounts': 0,
        })

    if force_refresh:
        cfg = _get_reddit_config()
        for acc in accounts:
            if not acc.reddit_access_token:
                continue

            # Reddit tokens expire every hour — try refresh first
            if acc.is_token_expired() and acc.reddit_refresh_token:
                success, result = RedditService.refresh_access_token(
                    acc.reddit_refresh_token, cfg['client_id'], cfg['client_secret']
                )
                if success:
                    acc.reddit_access_token = result['access_token']
                    acc.token_expires_at = timezone.now() + timedelta(seconds=result.get('expires_in', 3600))
                    # Reddit may return a new refresh token
                    if result.get('refresh_token'):
                        acc.reddit_refresh_token = result['refresh_token']
                    acc.save(update_fields=['reddit_access_token', 'reddit_refresh_token', 'token_expires_at'])
                    acc.mark_as_active()
                    continue
                else:
                    acc.mark_as_invalid(f'Token refresh failed: {result}')
                    continue
            elif acc.is_token_expired():
                acc.mark_as_expired()
                continue

            valid, result = RedditService.validate_credentials(acc.reddit_access_token)
            if valid:
                acc.mark_as_active()
            else:
                acc.mark_as_invalid(result if isinstance(result, str) else 'Validation failed')

    account_list = []
    for acc in accounts:
        account_list.append({
            'account_id': acc.id,
            'name': acc.account_name,
            'username': acc.reddit_username,
            'has_refresh_token': bool(acc.reddit_refresh_token),
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
# HELPERS — Popup HTML
# ══════════════════════════════════════════════════════════════════════════════

def _popup_success(account_info, warning=None):
    data = json.dumps({'type': 'REDDIT_OAUTH_SUCCESS', 'account': account_info, 'warning': warning})
    return _render_popup_html(data, success=True, warning=warning)


def _popup_error(title, detail=''):
    data = json.dumps({'type': 'REDDIT_OAUTH_ERROR', 'title': title, 'detail': detail})
    return _render_popup_html(data, success=False, title=title, detail=detail)


def _render_popup_html(json_data, success=True, warning=None, title=None, detail=None):
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'

    if success:
        icon = '&#10004;'
        heading = 'Reddit Connected!'
        body = '<p>Your Reddit account is now connected.</p>'
        if warning:
            body += f'<p class="warn">&#9888; {html_lib.escape(str(warning))}</p>'
        heading_color = '#FF4500'
    else:
        icon = '&#10060;'
        heading = html_lib.escape(str(title or 'Connection Failed'))
        safe_detail = html_lib.escape(str(detail or 'An error occurred. Please try again.'))
        body = f'<p class="detail">{safe_detail}</p>'
        heading_color = '#c62828'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reddit Connection</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;display:flex;align-items:center;justify-content:center;min-height:100vh}}
    .card{{background:#fff;border-radius:16px;padding:48px 36px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.12);text-align:center}}
    .icon{{font-size:56px;margin-bottom:20px}}
    h2{{color:{heading_color};font-size:20px;font-weight:700;margin-bottom:12px}}
    p{{color:#555;font-size:14px;line-height:1.6;margin-top:8px}}
    .detail{{color:#777;font-size:13px}}
    .warn{{color:#e65100;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px 14px;margin-top:14px;font-size:13px;text-align:left}}
    .closing{{color:#bbb;font-size:12px;margin-top:24px}}
    .progress{{height:3px;background:#e0e0e0;border-radius:3px;margin-top:20px;overflow:hidden}}
    .progress-bar{{height:100%;background:{heading_color};animation:fill 2.5s linear forwards}}
    @keyframes fill{{from{{width:0%}}to{{width:100%}}}}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">{icon}</div><h2>{heading}</h2>{body}
    <p class="closing">This window will close automatically...</p>
    <div class="progress"><div class="progress-bar"></div></div>
  </div>
  <script>
    (function(){{
      var payload={json_data};
      try{{localStorage.setItem('reddit_oauth_result',JSON.stringify(payload))}}catch(e){{}}
      try{{if(window.opener&&!window.opener.closed){{window.opener.postMessage(payload,'{frontend_url}')}}}}catch(e){{}}
      setTimeout(function(){{window.close()}},2500);
    }})();
  </script>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
