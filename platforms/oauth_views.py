"""
Facebook OAuth 2.0 — Connection System
========================================
Endpoints:
  GET  /api/v1/platforms/facebook/initiate/        → returns auth URL for popup
  GET  /api/v1/platforms/facebook/callback/        → Facebook redirects here (no JWT needed)
  POST /api/v1/platforms/facebook/setup-messenger/ → user picks which page for Messenger bot
  GET  /api/v1/platforms/facebook/status/          → real-time connection health

Integration with existing code:
  - SocialAccount model (platforms/models.py)  → update_or_create, mark_as_active(), mark_as_invalid()
  - FacebookService.validate_credentials()     → live token check after saving
  - MessengerConnection model                  → update_or_create after webhook subscription
  - request.user.profile.can_add_account()     → subscription plan limit check
"""

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
from platforms.services.facebook import FacebookService
from messenger_bot.models import MessengerConnection
from accounts.models import SiteConfiguration

logger = logging.getLogger(__name__)

# ─── Facebook API Constants ────────────────────────────────────────────────────

FB_GRAPH     = 'https://graph.facebook.com/v18.0'
FB_AUTH_URL  = 'https://www.facebook.com/v18.0/dialog/oauth'
FB_TOKEN_URL = f'{FB_GRAPH}/oauth/access_token'

# Permissions for posting + Messenger + Instagram
# instagram_content_publish requires it to be enabled under
# Meta Console → App Review → Permissions and Features before use.
FB_SCOPES = ','.join([
    'pages_show_list',
    'pages_manage_metadata',
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_messaging',
    'instagram_basic',
    'instagram_content_publish',
])


# ─── DB Config Helpers ────────────────────────────────────────────────────────
# Reads from SiteConfiguration (admin-managed via frontend).
# Falls back to settings.py / .env for local development.

def _get_fb_config():
    """
    Returns Facebook OAuth config dict read from SiteConfiguration DB table.
    Falls back to settings.py values if DB values are empty.
    This allows admin to set/change credentials without touching server files.
    """
    app_id       = SiteConfiguration.get('facebook_app_id',       getattr(settings, 'FACEBOOK_APP_ID', ''))
    app_secret   = SiteConfiguration.get('facebook_app_secret',   getattr(settings, 'FACEBOOK_APP_SECRET', ''))
    redirect_uri = SiteConfiguration.get('facebook_redirect_uri', getattr(settings, 'FACEBOOK_REDIRECT_URI', ''))
    frontend_url = SiteConfiguration.get('frontend_url',          getattr(settings, 'FRONTEND_URL', ''))
    return {
        'app_id':       app_id.strip(),
        'app_secret':   app_secret.strip(),
        'redirect_uri': redirect_uri.strip(),
        'frontend_url': frontend_url.strip(),
    }


def _config_is_complete(cfg):
    """Returns True only if all required Facebook OAuth fields are set."""
    return bool(cfg['app_id'] and cfg['app_secret'] and cfg['redirect_uri'])


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 1 — Initiate OAuth
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facebook_oauth_initiate(request):
    """
    React calls this when user clicks "Connect Facebook".
    Returns the Facebook login URL → React opens it in a popup.

    Errors returned as JSON (400 / 403 / 503).
    """

    # ── Read config from DB (admin-managed) ──────────────────────────────────
    cfg = _get_fb_config()

    if not _config_is_complete(cfg):
        return Response(
            {
                'error': 'Facebook connection is not configured.',
                'detail': (
                    'The admin has not set up Facebook App credentials yet. '
                    'Go to Admin Panel → Integrations → Facebook Settings and enter '
                    'your App ID, App Secret, and Redirect URI.'
                ),
                'config_missing': True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    # ── Guard: check subscription plan account limit ──────────────────────────
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
        pass  # If profile check fails, proceed — don't block OAuth

    # ── Create one-time CSRF state (expires in 10 minutes) ───────────────────
    state_obj = OAuthState.objects.create(
        user=request.user,
        platform='facebook',
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'client_id':     cfg['app_id'],
        'redirect_uri':  cfg['redirect_uri'],
        'state':         str(state_obj.state),
        'scope':         FB_SCOPES,
        'response_type': 'code',
    }

    auth_url = f'{FB_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[FB OAuth] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 2 — OAuth Callback (Facebook redirects here — no JWT)
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_oauth_callback(request):
    """
    Facebook redirects here after user approves (or denies) permissions.
    Full pipeline:
      code → short-lived token (2h)
      → long-lived token (60d)
      → /me/accounts (page tokens — never expire)
      → SocialAccount.update_or_create() for each page
      → FacebookService.validate_credentials() live check
      → SocialAccount.update_or_create() for Instagram if linked
      → HTML page that postMessages result back to React popup parent

    No JWT needed — Facebook sends the user here directly.
    Security is provided by the one-time OAuthState UUID.
    """

    code         = request.GET.get('code', '').strip()
    state        = request.GET.get('state', '').strip()
    error        = request.GET.get('error', '')
    error_reason = request.GET.get('error_reason', '')
    error_desc   = request.GET.get('error_description', '')

    # ── User cancelled / denied permissions ──────────────────────────────────
    if error:
        if error_reason == 'user_denied':
            return _popup_error(
                'Connection Cancelled',
                'You cancelled the Facebook login. Click "Connect Facebook" again '
                'and approve all permissions to continue.'
            )
        return _popup_error(
            'Facebook Login Failed',
            error_desc or 'An unexpected error occurred during Facebook login. Please try again.'
        )

    # ── Missing parameters ────────────────────────────────────────────────────
    if not code or not state:
        return _popup_error(
            'Invalid Response from Facebook',
            'The login response was missing required data. Please try connecting again.'
        )

    # ── Read config from DB ───────────────────────────────────────────────────
    cfg = _get_fb_config()
    if not _config_is_complete(cfg):
        return _popup_error(
            'Facebook Not Configured',
            'The admin has not set up Facebook App credentials. Please contact the administrator.'
        )

    # ── Validate CSRF state ───────────────────────────────────────────────────
    try:
        state_obj = OAuthState.objects.get(
            state=state,
            platform='facebook',
            used=False,
            expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        # Distinguish expired vs already-used vs completely invalid
        existing = OAuthState.objects.filter(state=state, platform='facebook').first()
        if existing and existing.used:
            detail = 'This login link has already been used. Please start the connection process again.'
        elif existing and existing.expires_at < timezone.now():
            detail = 'Your session expired (10-minute limit). Please click "Connect Facebook" again.'
        else:
            detail = 'Invalid session token. Please try connecting again.'
        return _popup_error('Session Validation Failed', detail)

    # Mark used immediately — prevents replay attack
    state_obj.used = True
    state_obj.save(update_fields=['used'])
    user = state_obj.user
    logger.info(f'[FB OAuth] Callback for user {user.username} — state validated')

    # ── Step 1: code → short-lived user token ─────────────────────────────────
    try:
        resp = requests.get(FB_TOKEN_URL, params={
            'client_id':     cfg['app_id'],
            'client_secret': cfg['app_secret'],
            'redirect_uri':  cfg['redirect_uri'],
            'code':          code,
        }, timeout=15)
        token_data = resp.json()
    except requests.Timeout:
        logger.error('[FB OAuth] Step 1 (code→token) timed out')
        return _popup_error(
            'Connection Timed Out',
            'Facebook took too long to respond. Please check your internet connection and try again.'
        )
    except Exception as e:
        logger.error(f'[FB OAuth] Step 1 request failed: {e}')
        return _popup_error('Could Not Reach Facebook', 'Please check your internet connection and try again.')

    if 'error' in token_data:
        err = token_data['error']
        logger.error(f'[FB OAuth] Step 1 error: {err}')
        if err.get('code') == 100:
            detail = 'Your login code expired before it could be used. Please connect again immediately after clicking the button.'
        else:
            detail = f"Facebook error: {err.get('message', 'Unknown error during login.')}"
        return _popup_error('Login Failed', detail)

    short_lived_token = token_data.get('access_token')
    if not short_lived_token:
        logger.error('[FB OAuth] Step 1 returned no access_token')
        return _popup_error('No Token Received', 'Facebook did not return a token. Please try again.')

    # ── Step 2: short-lived → long-lived user token (60 days) ────────────────
    try:
        resp = requests.get(FB_TOKEN_URL, params={
            'grant_type':        'fb_exchange_token',
            'client_id':         cfg['app_id'],
            'client_secret':     cfg['app_secret'],
            'fb_exchange_token': short_lived_token,
        }, timeout=15)
        ll_data = resp.json()
    except requests.Timeout:
        logger.error('[FB OAuth] Step 2 (long-lived token) timed out')
        return _popup_error('Connection Timed Out', 'Please try again.')
    except Exception as e:
        logger.error(f'[FB OAuth] Step 2 failed: {e}')
        return _popup_error('Could Not Reach Facebook', 'Please try again.')

    if 'error' in ll_data:
        logger.error(f'[FB OAuth] Step 2 error: {ll_data["error"]}')
        return _popup_error(
            'Session Extension Failed',
            'Could not create a long-term Facebook session. Please try connecting again.'
        )

    long_lived_token = ll_data.get('access_token')
    if not long_lived_token:
        logger.error('[FB OAuth] Step 2 returned no access_token')
        return _popup_error('Session Token Missing', 'Please try again.')

    # ── Step 3: fetch all Facebook Pages this user manages ───────────────────
    try:
        resp = requests.get(
            f'{FB_GRAPH}/me/accounts',
            params={
                'fields':       'id,name,access_token,category,instagram_business_account{id,name,username}',
                'access_token': long_lived_token,
            },
            timeout=15
        )
        pages_data = resp.json()
    except requests.Timeout:
        logger.error('[FB OAuth] Step 3 (/me/accounts) timed out')
        return _popup_error(
            'Could Not Fetch Your Pages',
            'Facebook took too long to load your pages. Please try again.'
        )
    except Exception as e:
        logger.error(f'[FB OAuth] Step 3 failed: {e}')
        return _popup_error('Could Not Fetch Your Pages', 'Please try again.')

    if 'error' in pages_data:
        err = pages_data['error']
        logger.error(f'[FB OAuth] Step 3 API error: {err}')
        if err.get('code') == 190:
            detail = 'Your Facebook session expired immediately. Please try connecting again.'
        elif err.get('code') == 200:
            detail = 'Missing page permissions. Make sure you approved all permissions during login.'
        else:
            detail = f"Facebook error: {err.get('message', 'Could not load your pages.')}"
        return _popup_error('Could Not Load Your Pages', detail)

    pages = pages_data.get('data', [])

    if not pages:
        return _popup_error(
            'No Facebook Pages Found',
            'Your account has no Facebook Pages, or you are not an Admin of any Page. '
            'You must be an Admin of at least one Facebook Page to connect. '
            'Create or join a Facebook Page, then try again.'
        )

    # ── Step 4: save SocialAccounts + live-validate each page ────────────────
    connected_pages = []
    failed_pages    = []

    for page in pages:
        page_id    = page.get('id', '').strip()
        page_name  = page.get('name', '').strip()
        page_token = page.get('access_token', '').strip()

        if not page_id or not page_token:
            logger.warning(f'[FB OAuth] Skipping page missing id/token: {page}')
            continue

        try:
            # Prefer to find by page_id (stable), but unique_together is on
            # (user, platform, account_name), so we can't use update_or_create
            # with facebook_page_id directly. Filter first, then fall back.
            existing = SocialAccount.objects.filter(
                user=user, platform='facebook', facebook_page_id=page_id
            ).first()
            if existing:
                existing.account_name          = page_name
                existing.facebook_access_token = page_token
                existing.token_expires_at      = None
                existing.validation_error      = ''
                existing.save(update_fields=[
                    'account_name', 'facebook_access_token',
                    'token_expires_at', 'validation_error',
                ])
                account = existing
                created = False
            else:
                account, created = SocialAccount.objects.update_or_create(
                    user=user,
                    platform='facebook',
                    account_name=page_name,
                    defaults={
                        'facebook_page_id':      page_id,
                        'facebook_access_token': page_token,
                        'token_expires_at':      None,
                        'validation_error':      '',
                    }
                )

            action = 'created' if created else 'updated'
            logger.info(f'[FB OAuth] SocialAccount {action}: {page_name} ({page_id})')

            # Live validation using existing FacebookService
            valid, result = FacebookService.validate_credentials(page_id, page_token)

            if valid:
                account.mark_as_active()  # existing method: sets status=active, is_validated=True
                page_info = {
                    'id':              account.id,   # DB pk — used by setup-messenger
                    'page_id':         page_id,
                    'name':            page_name,
                    'status':          'active',
                    'has_instagram':   False,
                    'instagram_name':  None,
                }
                logger.info(f'[FB OAuth] Page {page_name} validated OK')
            else:
                account.mark_as_invalid(result)  # existing method: sets status=invalid
                logger.warning(f'[FB OAuth] Page {page_name} validation failed: {result}')
                page_info = {
                    'id':      account.id,
                    'page_id': page_id,
                    'name':    page_name,
                    'status':  'invalid',
                    'error':   result,
                    'has_instagram': False,
                }
                failed_pages.append({'name': page_name, 'reason': result})
                connected_pages.append(page_info)
                continue  # Skip Instagram check for invalid pages

            # ── Instagram: save if linked to this page ────────────────────────
            ig_data = page.get('instagram_business_account')
            if ig_data and ig_data.get('id'):
                try:
                    ig_id   = ig_data['id']
                    ig_name = ig_data.get('username') or ig_data.get('name') or f'{page_name} (Instagram)'

                    ig_existing = SocialAccount.objects.filter(
                        user=user, platform='instagram',
                        instagram_business_account_id=ig_id,
                    ).first()
                    if ig_existing:
                        ig_existing.account_name            = ig_name
                        ig_existing.instagram_access_token  = page_token
                        ig_existing.validation_error        = ''
                        ig_existing.save(update_fields=[
                            'account_name', 'instagram_access_token', 'validation_error',
                        ])
                        ig_account = ig_existing
                    else:
                        ig_account, ig_created = SocialAccount.objects.update_or_create(
                            user=user,
                            platform='instagram',
                            account_name=ig_name,
                            defaults={
                                'instagram_business_account_id': ig_id,
                                'instagram_access_token':        page_token,
                                'validation_error':              '',
                            }
                        )
                    ig_account.mark_as_active()

                    page_info['has_instagram']  = True
                    page_info['instagram_name'] = ig_name
                    logger.info(f'[FB OAuth] Instagram saved: {ig_name} for page {page_name}')

                except Exception as e:
                    logger.error(f'[FB OAuth] Instagram save failed for page {page_id}: {e}')
                    page_info['instagram_warning'] = (
                        'Instagram account found but could not be saved automatically. '
                        'You can link it manually in Instagram settings.'
                    )

            connected_pages.append(page_info)

        except Exception as e:
            logger.error(f'[FB OAuth] SocialAccount save failed for {page_name} ({page_id}): {e}')
            failed_pages.append({'name': page_name, 'reason': 'Database error. Please try again.'})
            continue

    # ── All pages failed ──────────────────────────────────────────────────────
    if not connected_pages:
        names = ', '.join(p['name'] for p in failed_pages) if failed_pages else 'all pages'
        return _popup_error(
            'Could Not Save Your Pages',
            f'Failed to connect: {names}. Please try again or contact support.'
        )

    # ── Partial failure warning ───────────────────────────────────────────────
    warning = None
    if failed_pages:
        names = ', '.join(p['name'] for p in failed_pages)
        warning = f'Some pages could not be connected: {names}. You can retry them individually from your connections page.'

    logger.info(f'[FB OAuth] Success for {user.username}: {len(connected_pages)} pages, {len(failed_pages)} failed')

    # ── Auto-setup Messenger (server-side, no frontend roundtrip needed) ──────
    # This runs in the callback itself so Messenger is ready immediately after
    # OAuth — no COOP/postMessage issues, no admin action required.
    _auto_setup_messenger(user, connected_pages, request)

    return _popup_success(connected_pages, warning=warning)


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 3 — Setup Messenger for Selected Page
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def facebook_setup_messenger(request):
    """
    Called after OAuth when user selects which Facebook Page to use for the Messenger bot.
    Subscribes the page to the app-level webhook on Facebook.
    Creates or updates MessengerConnection.

    Body: { "account_id": <SocialAccount.id> }
    Uses account_id (DB pk) — guarantees ownership without exposing page_id to user input.
    """

    account_id = request.data.get('account_id')

    if not account_id:
        return Response(
            {
                'error': 'Missing required field.',
                'detail': 'account_id is required.',
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # ── Ownership check — page must belong to this user and be active ─────────
    try:
        account = SocialAccount.objects.get(
            id=account_id,
            user=request.user,
            platform='facebook',
            status='active',
        )
    except SocialAccount.DoesNotExist:
        return Response(
            {
                'error': 'Facebook Page not found.',
                'detail': 'This page does not exist, does not belong to your account, or is not active. Please reconnect your Facebook account first.',
                'action': 'reconnect',
            },
            status=status.HTTP_404_NOT_FOUND
        )

    page_id    = account.facebook_page_id
    page_token = account.facebook_access_token
    page_name  = account.account_name

    if not page_token:
        return Response(
            {
                'error': 'Page token is missing.',
                'detail': 'The stored token for this page is empty. Please reconnect your Facebook account.',
                'action': 'reconnect',
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # ── Subscribe page to Messenger webhook (best-effort) ────────────────────
    # We save the MessengerConnection regardless of whether the Facebook
    # subscription call succeeds, so the admin panel always shows the
    # Webhook URL + Verify Token to copy into Meta Console manually.
    webhook_subscribed = False
    webhook_warning    = None

    try:
        resp = requests.post(
            f'{FB_GRAPH}/{page_id}/subscribed_apps',
            params={
                'subscribed_fields': 'messages,messaging_postbacks,messaging_optins',
                'access_token':      page_token,
            },
            timeout=15
        )
        result_data = resp.json()

        if result_data.get('success'):
            webhook_subscribed = True
            logger.info(f'[FB Messenger] Webhook subscribed for page {page_id}')
        else:
            fb_err  = result_data.get('error', {})
            fb_code = fb_err.get('code')
            fb_msg  = fb_err.get('message', 'Unknown error')
            logger.warning(f'[FB Messenger] Webhook subscription failed page {page_id}: {result_data}')

            if fb_code == 190:
                account.mark_as_invalid('Token invalid during Messenger webhook setup')

            if fb_code == 200:
                webhook_warning = (
                    'Messenger product is not added to your Facebook App. '
                    'Add it in Meta Developer Console → Your App → Add Products → Messenger. '
                    'The admin panel shows your Webhook URL and Verify Token to set up manually.'
                )
            elif fb_code == 190:
                webhook_warning = 'Facebook token expired. Please reconnect your Facebook account.'
            else:
                webhook_warning = f'Webhook auto-subscription failed ({fb_code}): {fb_msg}. Set it up manually via Admin Panel → Facebook Settings.'

    except requests.Timeout:
        logger.warning(f'[FB Messenger] Webhook subscription timed out for page {page_id}')
        webhook_warning = 'Webhook subscription timed out. Set it up manually via Admin Panel → Facebook Settings.'
    except Exception as e:
        logger.warning(f'[FB Messenger] Webhook request failed for page {page_id}: {e}')
        webhook_warning = 'Could not reach Facebook for webhook setup. Set it up manually via Admin Panel → Facebook Settings.'

    # ── Build single app-level webhook URL ───────────────────────────────────
    base_url    = request.build_absolute_uri('/').rstrip('/')
    webhook_url = f"{base_url}/messenger/webhook/"

    # ── Save MessengerConnection (always — even if webhook subscription failed) ─
    # is_webhook_verified is ONLY set True by Meta's GET verification request
    # (messenger_bot/views.py webhook view). We never force it True here.
    try:
        # Lookup by page_id first (the unique constraint field) to avoid
        # IntegrityError when the same page was previously connected by this
        # or any other user.  Fall back to user lookup, then create.
        try:
            connection = MessengerConnection.objects.get(page_id=page_id)
            connection.user              = request.user
            connection.page_name         = page_name
            connection.page_access_token = page_token
            connection.webhook_url       = webhook_url
            connection.is_active         = True
            connection.save(update_fields=[
                'user_id', 'page_name', 'page_access_token', 'webhook_url', 'is_active'
            ])
            created = False
        except MessengerConnection.DoesNotExist:
            try:
                connection = MessengerConnection.objects.get(user=request.user)
                # Update existing user connection — preserve is_webhook_verified
                connection.page_id           = page_id
                connection.page_name         = page_name
                connection.page_access_token = page_token
                connection.webhook_url       = webhook_url
                connection.is_active         = True
                connection.save(update_fields=[
                    'page_id', 'page_name', 'page_access_token', 'webhook_url', 'is_active'
                ])
                created = False
            except MessengerConnection.DoesNotExist:
                # New connection — webhook not yet verified by Meta
                connection = MessengerConnection.objects.create(
                    user=request.user,
                    page_id=page_id,
                    page_name=page_name,
                    page_access_token=page_token,
                    webhook_url=webhook_url,
                    is_webhook_verified=False,
                    is_active=True,
                )
                created = True

        logger.info(
            f'[FB Messenger] Connection {"created" if created else "updated"} '
            f'for {request.user.username} → page {page_name} '
            f'(webhook_verified={connection.is_webhook_verified})'
        )
    except Exception as e:
        logger.error(f'[FB Messenger] MessengerConnection save failed: {e}')
        return Response(
            {
                'error': 'Messenger connection could not be saved.',
                'detail': 'Please try again. If the problem persists, contact support.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Read the app-level verify token so the response can show it to the user
    from accounts.models import SiteConfiguration
    app_verify_token = SiteConfiguration.get('messenger_verify_token', '')

    response = {
        'success':             True,
        'page_id':             page_id,
        'page_name':           page_name,
        'messenger_connected': True,
        'webhook_verified':    webhook_subscribed,
        'is_new_connection':   created,
        # These are shown to the user in the UI so they can confirm Meta Console setup
        'webhook_url':         webhook_url,
        'webhook_token_set':   bool(app_verify_token),
    }
    if webhook_warning:
        response['warning'] = webhook_warning
    return Response(response)


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 4 — Connection Status
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facebook_connection_status(request):
    """
    Returns complete real-time connection health for Facebook, Instagram, and Messenger.

    Called:
      - On load of the connections/settings page
      - After OAuth callback completes (to refresh the status card)
      - After setup-messenger completes
      - ?refresh=1  → force live re-validation of all tokens regardless of staleness

    overall_status values:
      fully_connected     → FB active + Instagram linked + Messenger webhook verified
      partially_connected → FB connected but Instagram or Messenger missing
      needs_attention     → At least one page is expired/invalid, or webhook broken
      not_connected       → No Facebook pages at all

    missing[] → things not yet set up (with action keys for the UI)
    warnings[] → things set up but needing attention
    """
    user          = request.user
    force_refresh = request.GET.get('refresh') == '1'

    # Stale threshold: re-validate tokens not checked in the last 6 hours
    stale_cutoff = timezone.now() - timedelta(hours=6)

    # ── Facebook Pages — live re-validate if stale ─────────────────────────────
    fb_accounts = SocialAccount.objects.filter(
        user=user,
        platform='facebook',
    ).order_by('-connected_at')

    for acc in fb_accounts:
        needs_check = (
            force_refresh
            or acc.last_validated_at is None
            or acc.last_validated_at < stale_cutoff
        )
        if needs_check and acc.facebook_page_id and acc.facebook_access_token:
            try:
                valid, result = FacebookService.validate_credentials(
                    acc.facebook_page_id, acc.facebook_access_token
                )
                if valid:
                    acc.mark_as_active()
                else:
                    acc.mark_as_invalid(result)
                logger.info(
                    f'[FB Status] Re-validated {acc.account_name}: {"ok" if valid else result}'
                )
            except Exception as e:
                logger.warning(f'[FB Status] Re-validation failed for {acc.account_name}: {e}')

    # Refresh from DB after potential updates
    fb_accounts = SocialAccount.objects.filter(
        user=user,
        platform='facebook',
    ).order_by('-connected_at')

    fb_pages = []
    for acc in fb_accounts:
        fb_pages.append({
            'account_id':        acc.id,
            'page_id':           acc.facebook_page_id,
            'page_name':         acc.account_name,
            'status':            acc.status,
            'status_display':    acc.get_status_display(),
            'is_active':         acc.is_active,
            'is_validated':      acc.is_validated,
            'error_message':     acc.validation_error or None,
            'connected_at':      acc.connected_at,
            'last_validated_at': acc.last_validated_at,
        })

    # ── Instagram Accounts ─────────────────────────────────────────────────────
    ig_accounts = SocialAccount.objects.filter(
        user=user,
        platform='instagram',
    ).order_by('-connected_at')

    ig_list = []
    for acc in ig_accounts:
        ig_list.append({
            'account_id':    acc.id,
            'account_name':  acc.account_name,
            'ig_account_id': acc.instagram_business_account_id,
            'status':        acc.status,
            'status_display': acc.get_status_display(),
            'is_active':     acc.is_active,
            'error_message': acc.validation_error or None,
            'connected_at':  acc.connected_at,
        })

    # ── Messenger Bot ──────────────────────────────────────────────────────────
    messenger = None
    try:
        mc = MessengerConnection.objects.get(user=user)
        messenger = {
            'page_id':             mc.page_id,
            'page_name':           mc.page_name,
            'is_active':           mc.is_active,
            'is_webhook_verified': mc.is_webhook_verified,
            'auto_reply_enabled':  mc.auto_reply_enabled,
            'connected_at':        mc.connected_at,
        }
    except MessengerConnection.DoesNotExist:
        messenger = None

    # ── Build missing & warnings lists ────────────────────────────────────────
    missing  = []
    warnings = []

    active_fb  = [p for p in fb_pages if p['status'] == 'active']
    problem_fb = [p for p in fb_pages if p['status'] in ('expired', 'invalid', 'disconnected')]

    # Facebook Pages
    if not fb_pages:
        missing.append({
            'key':      'facebook',
            'title':    'Facebook Pages',
            'message':  'No Facebook Pages connected.',
            'detail':   'Click "Connect Facebook" to link your pages and enable posting to Facebook and Instagram.',
            'action':   'connect_facebook',
            'severity': 'critical',
        })
    else:
        for p in problem_fb:
            label = {
                'expired':      'Token expired.',
                'invalid':      'Invalid credentials.',
                'disconnected': 'Account disconnected.',
            }.get(p['status'], 'Connection issue.')
            warnings.append({
                'key':      f'facebook_page_{p["page_id"]}',
                'title':    f'Page: {p["page_name"]}',
                'message':  label,
                'detail':   p['error_message'] or 'Please reconnect this page by clicking "Reconnect Facebook".',
                'action':   'reconnect_facebook',
                'severity': 'warning',
            })

    # Instagram
    if not ig_list and active_fb:
        missing.append({
            'key':      'instagram',
            'title':    'Instagram Account',
            'message':  'No Instagram account linked.',
            'detail':   (
                'Link your Instagram Business account to your Facebook Page: '
                'Facebook Page Settings → Linked Accounts → Instagram. '
                'Then reconnect Facebook here.'
            ),
            'action':   'link_instagram_to_page',
            'severity': 'info',
        })

    # Messenger Bot
    if not messenger and active_fb:
        missing.append({
            'key':      'messenger',
            'title':    'Messenger Bot',
            'message':  'Messenger bot not set up.',
            'detail':   'Select a Facebook Page to receive and reply to Messenger conversations.',
            'action':   'setup_messenger',
            'severity': 'info',
        })
    elif messenger:
        if not messenger['is_webhook_verified']:
            warnings.append({
                'key':      'messenger_webhook',
                'title':    'Messenger Bot',
                'message':  'Webhook not verified.',
                'detail':   'Messenger auto-replies will not work. Re-run Messenger setup to fix this.',
                'action':   'setup_messenger',
                'severity': 'warning',
            })
        elif not messenger['is_active']:
            warnings.append({
                'key':      'messenger_inactive',
                'title':    'Messenger Bot',
                'message':  'Messenger bot is disabled.',
                'detail':   'Enable it in Messenger Settings to start receiving replies.',
                'action':   'enable_messenger',
                'severity': 'info',
            })

    # ── Overall status ─────────────────────────────────────────────────────────
    if not fb_pages:
        overall = 'not_connected'
    elif problem_fb or (messenger and not messenger['is_webhook_verified']):
        overall = 'needs_attention'
    elif active_fb and ig_list and messenger and messenger['is_webhook_verified']:
        overall = 'fully_connected'
    else:
        overall = 'partially_connected'

    return Response({
        'overall_status': overall,
        'facebook': {
            'connected':    len(active_fb) > 0,
            'total_pages':  len(fb_pages),
            'active_pages': len(active_fb),
            'pages':        fb_pages,
        },
        'instagram': {
            'connected': len(ig_list) > 0,
            'total':     len(ig_list),
            'accounts':  ig_list,
        },
        'messenger': {
            'connected': messenger is not None,
            'data':      messenger,
        },
        'missing':  missing,
        'warnings': warnings,
    })


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — Messenger Auto-Setup
# ══════════════════════════════════════════════════════════════════════════════

def _auto_setup_messenger(user, connected_pages, request):
    """
    Auto-creates or updates MessengerConnection right inside the OAuth callback.
    Runs server-side so it works regardless of COOP headers, popup behaviour,
    or number of pages the user has.

    Page-selection logic:
    1. If the user already has a MessengerConnection for a page that is still
       in the newly-connected list → update that connection (keep same page).
    2. Otherwise → use the first active page from the OAuth response.

    Webhook subscription is best-effort — a failure here does NOT block the
    OAuth flow. The admin can re-run subscription from the admin panel.
    """
    from messenger_bot.models import MessengerConnection
    from platforms.models import SocialAccount

    active_pages = [p for p in connected_pages if p.get('status') == 'active']
    if not active_pages:
        logger.info(f'[FB OAuth] Auto-messenger skipped for {user.username}: no active pages')
        return

    # ── Pick which page to use ────────────────────────────────────────────────
    target_page_info = None
    try:
        existing_conn = MessengerConnection.objects.get(user=user)
        for p in active_pages:
            if p['page_id'] == existing_conn.page_id:
                target_page_info = p
                break
    except MessengerConnection.DoesNotExist:
        pass

    if not target_page_info:
        target_page_info = active_pages[0]

    # ── Load full credentials from DB ─────────────────────────────────────────
    try:
        account = SocialAccount.objects.get(
            id=target_page_info['id'],
            user=user,
            platform='facebook',
            status='active',
        )
    except SocialAccount.DoesNotExist:
        logger.warning(f'[FB OAuth] Auto-messenger: SocialAccount not found for id={target_page_info["id"]}')
        return

    page_id    = account.facebook_page_id
    page_token = account.facebook_access_token
    page_name  = account.account_name
    base_url   = request.build_absolute_uri('/').rstrip('/')
    webhook_url = f"{base_url}/messenger/webhook/"

    # ── Best-effort webhook subscription ──────────────────────────────────────
    try:
        resp = requests.post(
            f'{FB_GRAPH}/{page_id}/subscribed_apps',
            params={
                'subscribed_fields': 'messages,messaging_postbacks,messaging_optins',
                'access_token':      page_token,
            },
            timeout=10,
        )
        sub_result = resp.json()
        if sub_result.get('success'):
            logger.info(f'[FB OAuth] Auto-messenger: subscribed_apps OK for page {page_id}')
        else:
            logger.warning(f'[FB OAuth] Auto-messenger: subscribed_apps failed: {sub_result}')
    except Exception as e:
        logger.warning(f'[FB OAuth] Auto-messenger: subscribed_apps request failed: {e}')

    # ── Save MessengerConnection (duplicate-safe) ──────────────────────────────
    try:
        try:
            connection = MessengerConnection.objects.get(page_id=page_id)
            connection.user              = user
            connection.page_name         = page_name
            connection.page_access_token = page_token
            connection.webhook_url       = webhook_url
            connection.is_active         = True
            connection.save(update_fields=[
                'user_id', 'page_name', 'page_access_token', 'webhook_url', 'is_active',
            ])
            logger.info(f'[FB OAuth] Auto-messenger: updated existing connection for page {page_name}')
        except MessengerConnection.DoesNotExist:
            try:
                connection = MessengerConnection.objects.get(user=user)
                connection.page_id           = page_id
                connection.page_name         = page_name
                connection.page_access_token = page_token
                connection.webhook_url       = webhook_url
                connection.is_active         = True
                connection.save(update_fields=[
                    'page_id', 'page_name', 'page_access_token', 'webhook_url', 'is_active',
                ])
                logger.info(f'[FB OAuth] Auto-messenger: updated user connection to page {page_name}')
            except MessengerConnection.DoesNotExist:
                MessengerConnection.objects.create(
                    user=user,
                    page_id=page_id,
                    page_name=page_name,
                    page_access_token=page_token,
                    webhook_url=webhook_url,
                    is_webhook_verified=False,
                    is_active=True,
                )
                logger.info(f'[FB OAuth] Auto-messenger: created new connection for page {page_name}')
    except Exception as e:
        logger.error(f'[FB OAuth] Auto-messenger: MessengerConnection save failed: {e}')


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — Popup HTML Responses
# ══════════════════════════════════════════════════════════════════════════════

def _popup_success(pages, warning=None):
    """Sends FB_OAUTH_SUCCESS via postMessage and closes popup."""
    data = json.dumps({
        'type':    'FB_OAUTH_SUCCESS',
        'pages':   pages,
        'warning': warning,
    })
    return _render_popup_html(data, success=True, warning=warning)


def _popup_error(title, detail=''):
    """Sends FB_OAUTH_ERROR via postMessage and closes popup."""
    data = json.dumps({
        'type':   'FB_OAUTH_ERROR',
        'title':  title,
        'detail': detail,
    })
    return _render_popup_html(data, success=False, title=title, detail=detail)


def _render_popup_html(json_data, success=True, warning=None, title=None, detail=None):
    """
    Returns an HTML page shown briefly in the OAuth popup window.
    Uses window.opener.postMessage() to send result to React parent.
    Auto-closes after 2.5 seconds.
    """
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'

    if success:
        icon    = '✅'
        heading = 'Connected Successfully!'
        body    = '<p>Your Facebook Pages are now connected.</p>'
        if warning:
            body += f'<p class="warn">⚠ {warning}</p>'
        heading_color = '#2e7d32'
    else:
        icon    = '❌'
        heading = title or 'Connection Failed'
        body    = f'<p class="detail">{detail or "An error occurred. Please try again."}</p>'
        heading_color = '#c62828'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facebook Connection</title>
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

      // Primary channel: localStorage (immune to Facebook's COOP headers that
      // null out window.opener). The parent window listens for the 'storage' event.
      try {{
        localStorage.setItem('fb_oauth_result', JSON.stringify(payload));
      }} catch (e) {{
        console.error('[FB OAuth] localStorage write failed:', e);
      }}

      // Secondary channel: postMessage (works when opener is still available,
      // i.e. when popup is not disrupted by COOP headers).
      try {{
        var targetOrigin = '{frontend_url}';
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, targetOrigin);
        }}
      }} catch (err) {{
        console.error('[FB OAuth] postMessage failed:', err);
      }}

      setTimeout(function () {{
        window.close();
      }}, 2500);
    }})();
  </script>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
