"""
Google Business Profile OAuth 2.0 — Connection + Posting System
================================================================
Endpoints:
  GET  /api/v1/platforms/google-business/initiate/    → returns Google auth URL for popup
  GET  /api/v1/platforms/google-business/callback/    → Google redirects here (no JWT)
  GET  /api/v1/platforms/google-business/status/      → real-time connection health
  GET  /api/v1/platforms/google-business/locations/   → list business locations
  POST /api/v1/platforms/google-business/select-location/ → pick which location to manage
  POST /api/v1/platforms/google-business/post/        → publish a Google Post

Flow:
  1. User clicks "Connect Google Business" → popup opens Google consent screen
  2. User authorizes → redirected to callback
  3. Callback: code → access_token + refresh_token, then list accounts
  4. Saves SocialAccount(platform='google_business') with the first account
  5. User picks a location (select-location) → stored on the SocialAccount
  6. User publishes Google Posts (post/) using AI-generated text + image

CRITICAL: access_type=offline + prompt=consent to get a refresh_token, because
          Google access tokens expire after 1 hour.

Uses a SEPARATE OAuth client from YouTube (google_business_client_id/secret/redirect_uri)
so Business Profile scopes are isolated from YouTube scopes.
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
from platforms.services.google_business import GoogleBusinessService
from accounts.models import SiteConfiguration
from accounts.services.diamond_service import pre_check, deduct_diamonds

logger = logging.getLogger(__name__)


def _insufficient_diamonds_response(cost, balance):
    """Standard HTTP 402 body matching the rest of the app."""
    return Response({
        'error': 'Insufficient Diamond Tokens',
        'diamond_cost': cost,
        'diamond_balance': balance,
        'code': 'INSUFFICIENT_DIAMONDS',
    }, status=402)


def _get_user_gbp_account(user):
    """Return the user's active-preferred GBP account, or None."""
    qs = SocialAccount.objects.filter(user=user, platform=PLATFORM)
    return qs.filter(status='active').order_by('-connected_at').first() \
        or qs.order_by('-connected_at').first()

# ─── Google OAuth Constants ──────────────────────────────────────────────────

GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

# Single scope grants account + location + post management.
GBP_SCOPES = 'https://www.googleapis.com/auth/business.manage'

PLATFORM = 'google_business'


# ─── DB Config Helpers ───────────────────────────────────────────────────────

def _get_gbp_config():
    client_id     = SiteConfiguration.get('google_business_client_id',     getattr(settings, 'GBP_CLIENT_ID', ''))
    client_secret = SiteConfiguration.get('google_business_client_secret', getattr(settings, 'GBP_CLIENT_SECRET', ''))
    redirect_uri  = SiteConfiguration.get('google_business_redirect_uri',  getattr(settings, 'GBP_REDIRECT_URI', ''))
    frontend_url  = SiteConfiguration.get('frontend_url',                  getattr(settings, 'FRONTEND_URL', ''))
    return {
        'client_id':     client_id.strip() if client_id else '',
        'client_secret': client_secret.strip() if client_secret else '',
        'redirect_uri':  redirect_uri.strip() if redirect_uri else '',
        'frontend_url':  frontend_url.strip() if frontend_url else '',
    }


def _config_is_complete(cfg):
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


def _get_valid_access_token(account):
    """
    Return a usable access token for the account, refreshing if expired.
    Returns (token_or_None, error_or_None).

    GBP access tokens last ~1 hour. A record with no expiry recorded is treated
    as needing a refresh (rather than assumed-valid), because a stored token of
    unknown age is almost certainly stale.
    """
    if not account.gbp_access_token:
        return None, 'No access token stored. Please reconnect Google Business.'

    # Needs refresh if expired OR if we have no expiry timestamp to trust.
    needs_refresh = account.is_token_expired() or account.token_expires_at is None

    if needs_refresh:
        if not account.gbp_refresh_token:
            account.mark_as_expired()
            return None, 'Your Google Business session expired and cannot be renewed. Please reconnect.'

        cfg = _get_gbp_config()
        ok, result = GoogleBusinessService.refresh_access_token(
            account.gbp_refresh_token, cfg['client_id'], cfg['client_secret']
        )
        if not ok:
            account.mark_as_invalid(f'Token refresh failed: {result}')
            return None, f'Token refresh failed: {result}'

        new_token = result.get('access_token')
        if not new_token:
            account.mark_as_invalid('Token refresh returned no access token.')
            return None, 'Google did not return a new access token. Please reconnect.'

        account.gbp_access_token = new_token
        account.token_expires_at = timezone.now() + timedelta(seconds=result.get('expires_in', 3600))
        if result.get('refresh_token'):
            account.gbp_refresh_token = result['refresh_token']
        account.save(update_fields=['gbp_access_token', 'gbp_refresh_token', 'token_expires_at'])
        account.mark_as_active()

    return account.gbp_access_token, None


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 1 — Initiate OAuth
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gbp_oauth_initiate(request):
    """Returns Google OAuth URL → React opens it in a popup."""
    cfg = _get_gbp_config()

    if not _config_is_complete(cfg):
        return Response(
            {
                'error': 'Google Business Profile connection is not configured.',
                'detail': 'The admin has not set up Google Business credentials yet. Go to Admin Panel → Google Business Settings.',
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
        platform=PLATFORM,
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'client_id':              cfg['client_id'],
        'redirect_uri':           cfg['redirect_uri'],
        'response_type':          'code',
        'scope':                  GBP_SCOPES,
        'access_type':            'offline',     # CRITICAL: get refresh_token
        'prompt':                 'consent',     # CRITICAL: force consent → always get refresh_token
        'state':                  str(state_obj.state),
        'include_granted_scopes': 'true',
    }

    auth_url = f'{GOOGLE_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[GBP OAuth] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 2 — OAuth Callback
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def gbp_oauth_callback(request):
    """Google redirects here. Pipeline: code → tokens → accounts → save SocialAccount."""
    code  = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    error = request.GET.get('error', '')

    if error:
        if error in ('access_denied', 'consent_required'):
            return _popup_error(
                'Connection Cancelled',
                'You cancelled the Google login or denied permissions. Click "Connect Google Business" again.'
            )
        return _popup_error('Google Business Login Failed', f'Google error: {error}')

    if not code or not state:
        return _popup_error('Invalid Response from Google', 'Missing required data. Please try again.')

    cfg = _get_gbp_config()
    if not _config_is_complete(cfg):
        return _popup_error('Google Business Not Configured', 'Please contact the administrator.')

    # Validate CSRF state
    try:
        state_obj = OAuthState.objects.get(
            state=state, platform=PLATFORM, used=False, expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        existing = OAuthState.objects.filter(state=state, platform=PLATFORM).first()
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
    logger.info(f'[GBP OAuth] Callback for user {user.username} — state validated')

    # ── Step 1: code → tokens ────────────────────────────────────────────────
    try:
        resp = requests.post(GOOGLE_TOKEN_URL, data={
            'grant_type':    'authorization_code',
            'code':          code,
            'client_id':     cfg['client_id'],
            'client_secret': cfg['client_secret'],
            'redirect_uri':  cfg['redirect_uri'],
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=15)

        try:
            token_data = resp.json()
        except ValueError:
            return _popup_error('Login Failed', f'Google returned invalid response (HTTP {resp.status_code}).')

    except requests.Timeout:
        return _popup_error('Connection Timed Out', 'Google took too long. Please try again.')
    except requests.ConnectionError:
        return _popup_error('Could Not Reach Google', 'Network error. Check your internet connection.')
    except Exception as e:
        logger.error(f'[GBP OAuth] Step 1 failed: {e}')
        return _popup_error('Could Not Reach Google', 'Please try again.')

    if 'error' in token_data:
        err = token_data.get('error_description', token_data.get('error', 'Unknown error'))
        logger.error(f'[GBP OAuth] Step 1 error: {token_data}')
        return _popup_error('Login Failed', f'Google error: {err}')

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in    = token_data.get('expires_in', 3600)

    if not access_token:
        return _popup_error('No Token Received', 'Google did not return a token.')

    if not refresh_token:
        logger.warning('[GBP OAuth] No refresh_token received — user may need to re-authorize')

    token_expires_at = timezone.now() + timedelta(seconds=expires_in)
    logger.info(f'[GBP OAuth] Token obtained, expires in {expires_in}s, refresh={"yes" if refresh_token else "NO"}')

    # ── Step 2: fetch accounts ───────────────────────────────────────────────
    valid, result = GoogleBusinessService.validate_credentials(access_token)
    if not valid:
        logger.error(f'[GBP OAuth] Account fetch failed: {result}')
        return _popup_error(
            'Could Not Load Business Account',
            result if isinstance(result, str) else 'Could not find a Business Profile for this account.'
        )

    account_id = result['account_id']
    account_label = result['name']

    # ── Step 3: save SocialAccount ───────────────────────────────────────────
    # Identity for a GBP connection is (user, platform, gbp_account_id) — NOT the
    # display name, which Google lets users change. Keying the upsert on the
    # account id avoids creating a duplicate row when the business is renamed.
    try:
        existing = SocialAccount.objects.filter(
            user=user, platform=PLATFORM, gbp_account_id=account_id
        ).first()

        # account_name participates in a unique_together with (user, platform),
        # so only adopt the new label if it won't collide with a different row.
        safe_label = account_label
        clash = SocialAccount.objects.filter(
            user=user, platform=PLATFORM, account_name=account_label,
        ).exclude(pk=existing.pk if existing else None).exists()
        if clash:
            safe_label = f'{account_label} ({account_id.split("/")[-1]})'

        if existing:
            existing.account_name = safe_label
            existing.gbp_access_token = access_token
            if refresh_token:
                existing.gbp_refresh_token = refresh_token
            existing.token_expires_at = token_expires_at
            existing.validation_error = ''
            existing.save(update_fields=[
                'account_name', 'gbp_access_token', 'gbp_refresh_token',
                'token_expires_at', 'validation_error',
            ])
            account = existing
        else:
            account = SocialAccount.objects.create(
                user=user,
                platform=PLATFORM,
                account_name=safe_label,
                gbp_account_id=account_id,
                gbp_access_token=access_token,
                gbp_refresh_token=refresh_token,
                token_expires_at=token_expires_at,
                validation_error='',
            )

        account.mark_as_active()
        logger.info(f'[GBP OAuth] Account saved: {safe_label} ({account_id})')

    except Exception as e:
        logger.error(f'[GBP OAuth] Account save failed: {e}')
        return _popup_error('Could Not Save Account', 'Database error. Please try again.')

    # `account.gbp_refresh_token` is the source of truth after the save — it
    # holds the new token if one arrived, or the previously stored one.
    has_refresh = bool(account.gbp_refresh_token)

    account_info = {
        'id': account.id,
        'name': safe_label,
        'account_id': account_id,
        'has_refresh_token': has_refresh,
        'status': 'active',
        'needs_location': not account.gbp_location_id,
    }

    warning = None
    if not has_refresh:
        warning = (
            'No refresh token received. Your access will expire in 1 hour and cannot be auto-renewed. '
            'This usually means your Google app is in Testing mode.'
        )

    logger.info(f'[GBP OAuth] Success for {user.username}: {safe_label}')
    return _popup_success(account_info, warning=warning)


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 3 — Connection Status
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gbp_connection_status(request):
    """Returns real-time Google Business Profile connection health."""
    user = request.user
    force_refresh = request.GET.get('refresh') == '1'

    accounts = SocialAccount.objects.filter(
        user=user, platform=PLATFORM
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
            token, err = _get_valid_access_token(acc)
            if err:
                # _get_valid_access_token already marked the account
                # expired/invalid; nothing valid to re-check, so move on.
                continue
            valid, result = GoogleBusinessService.validate_credentials(token)
            if valid:
                acc.mark_as_active()
            else:
                acc.mark_as_invalid(result if isinstance(result, str) else 'Validation failed')

    account_list = []
    for acc in accounts:
        account_list.append({
            'account_id': acc.id,
            'name': acc.account_name,
            'gbp_account_id': acc.gbp_account_id,
            'location_id': acc.gbp_location_id,
            'location_name': acc.gbp_location_name,
            'has_location': bool(acc.gbp_location_id),
            'has_refresh_token': bool(acc.gbp_refresh_token),
            'status': acc.status,
            'status_display': acc.get_status_display(),
            'is_active': acc.is_active,
            'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
            'error_message': acc.validation_error,
            'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
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
# VIEW 4 — List Locations
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gbp_list_locations(request):
    """List business locations for the connected GBP account."""
    account = _get_user_gbp_account(request.user)

    if not account:
        return Response(
            {'error': 'No Google Business account connected.'},
            status=status.HTTP_404_NOT_FOUND
        )

    token, err = _get_valid_access_token(account)
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

    ok, result = GoogleBusinessService.list_locations(token, account.gbp_account_id)
    if not ok:
        return Response({'error': result}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
        'account_id': account.gbp_account_id,
        'locations': result,
        'selected_location_id': account.gbp_location_id,
    })


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 5 — Select Location
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gbp_select_location(request):
    """Store which location the user wants to manage/post to."""
    location_id = str(request.data.get('location_id', '')).strip()
    location_name = str(request.data.get('location_name', '')).strip()

    if not location_id:
        return Response({'error': 'location_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    account = _get_user_gbp_account(request.user)

    if not account:
        return Response({'error': 'No Google Business account connected.'}, status=status.HTTP_404_NOT_FOUND)

    account.gbp_location_id = location_id
    account.gbp_location_name = location_name
    account.save(update_fields=['gbp_location_id', 'gbp_location_name'])

    return Response({
        'success': True,
        'location_id': location_id,
        'location_name': location_name,
        'message': f'Now managing "{location_name or location_id}".',
    })


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 6 — Create Google Post
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gbp_create_post(request):
    """
    Publish a Google Post to the selected location.
    Body: { summary, image_url?, cta_type?, cta_url? }
    """
    summary  = str(request.data.get('summary', '')).strip()
    image_url = str(request.data.get('image_url', '')).strip() or None
    cta_type  = str(request.data.get('cta_type', '')).strip() or None
    cta_url   = str(request.data.get('cta_url', '')).strip() or None

    if not summary:
        return Response({'error': 'Post text (summary) is required.'}, status=status.HTTP_400_BAD_REQUEST)

    account = _get_user_gbp_account(request.user)
    if not account:
        return Response({'error': 'No Google Business account connected.'}, status=status.HTTP_404_NOT_FOUND)

    if not account.gbp_location_id:
        return Response(
            {'error': 'No location selected. Pick a business location first.', 'needs_location': True},
            status=status.HTTP_400_BAD_REQUEST
        )

    token, err = _get_valid_access_token(account)
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

    # Diamond pre-check BEFORE the publish.
    can_afford, cost, balance = pre_check(request.user, 'gbp_post')
    if not can_afford:
        return _insufficient_diamonds_response(cost, balance)

    ok, result = GoogleBusinessService.create_post(
        access_token=token,
        account_id=account.gbp_account_id,
        location_id=account.gbp_location_id,
        summary=summary,
        image_url=image_url,
        cta_type=cta_type,
        cta_url=cta_url,
    )

    if not ok:
        # No diamonds deducted on failure.
        return Response({'error': result}, status=status.HTTP_502_BAD_GATEWAY)

    deduct_diamonds(user=request.user, feature='gbp_post', provider='google_business')

    return Response({
        'success': True,
        'post_name': result.get('post_name', ''),
        'search_url': result.get('search_url', ''),
        'message': 'Google Post published.',
    })


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 7 — AI: generate a Google Post caption
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gbp_generate_caption(request):
    """
    AI-write a Google Post caption.
    Body: { topic?, tone? }  → returns { caption }
    Uses the LLM router; billed in diamonds.
    """
    topic = str(request.data.get('topic', '')).strip()
    tone  = str(request.data.get('tone', 'friendly')).strip() or 'friendly'

    account = _get_user_gbp_account(request.user)
    if not account:
        return Response({'error': 'Connect a Google Business account first.'},
                        status=status.HTTP_404_NOT_FOUND)
    business_name = account.gbp_location_name or account.account_name

    can_afford, cost, balance = pre_check(request.user, 'gbp_ai_caption')
    if not can_afford:
        return _insufficient_diamonds_response(cost, balance)

    try:
        from accounts.services.llm_service import get_llm_service
        service = get_llm_service(request.user)
        system = (
            'You write short, engaging Google Business Profile posts for local businesses. '
            'Output ONE post under 1500 characters, warm and action-oriented, no hashtags, '
            'no markdown, no quotes around it. Encourage the reader to visit or contact the business.'
        )
        user_msg = f'Business: {business_name}\nTone: {tone}\n'
        user_msg += f'Topic/offer: {topic}' if topic else 'Topic: a general promotional update.'

        result = service.chat_completion(
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user_msg},
            ],
            temperature=0.8,
            max_tokens=500,
        )
    except Exception as e:
        logger.error(f'[GBP] Caption generation error: {e}')
        return Response({'error': 'AI caption generation failed. Please try again.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    if not result.success:
        return Response({'error': result.error or 'No AI API key configured.'},
                        status=status.HTTP_400_BAD_REQUEST)

    caption = (result.content or '').strip().strip('"').strip()
    if not caption:
        return Response({'error': 'AI returned an empty caption. Please try again.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    deduct_diamonds(user=request.user, feature='gbp_ai_caption', result=result)
    return Response({'success': True, 'caption': caption[:1500]})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 8 — AI: generate a Google Post image
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gbp_generate_image(request):
    """
    AI-generate an image for a Google Post and return a public URL.
    Body: { prompt, style? } → returns { image_url }

    NOTE: Google fetches the image server-side, so the returned URL must be
    publicly reachable. On localhost this works for preview but Google cannot
    fetch it — deploy behind a public domain for live posting.
    """
    prompt = str(request.data.get('prompt', '')).strip()
    style  = str(request.data.get('style', 'realistic')).strip() or 'realistic'

    if not prompt:
        return Response({'error': 'An image prompt is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not _get_user_gbp_account(request.user):
        return Response({'error': 'Connect a Google Business account first.'},
                        status=status.HTTP_404_NOT_FOUND)

    can_afford, cost, balance = pre_check(request.user, 'image_standard')
    if not can_afford:
        return _insufficient_diamonds_response(cost, balance)

    try:
        from ai_image.image_service import ImageService
        from accounts.api_keys import get_openai_key, get_gemini_key
        from django.core.files.base import ContentFile
        from ai_image.models import ImageGeneration

        service = ImageService(
            openai_key=get_openai_key(request.user),
            gemini_key=get_gemini_key(request.user),
        )
        gen = service.generate_image(
            prompt=f'Marketing photo for a Google Business post: {prompt}',
            style=style,
            size='1024x1024',
            quality='standard',
            enhance=True,
        )
    except Exception as e:
        logger.error(f'[GBP] Image generation error: {e}')
        return Response({'error': 'AI image generation failed. Please try again.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    if not gen or not gen.get('success'):
        return Response({'error': (gen or {}).get('error', 'Image generation failed.')},
                        status=status.HTTP_400_BAD_REQUEST)

    image_bytes = gen.get('image_data')
    if not image_bytes:
        return Response({'error': 'Image provider returned no data.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    try:
        asset = ImageGeneration.objects.create(
            user=request.user,
            title='Google Business post image',
            prompt=prompt,
            style=style,
            size='1024x1024',
            provider=gen.get('provider', 'openai') or 'openai',
            status='completed',
        )
        asset.generated_image.save(
            f'gbp_{asset.id}.png', ContentFile(image_bytes), save=True
        )
        image_url = request.build_absolute_uri(asset.generated_image.url)
    except Exception as e:
        logger.error(f'[GBP] Image save error: {e}')
        return Response({'error': 'Could not save the generated image.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    deduct_diamonds(user=request.user, feature='image_standard', provider=gen.get('provider', ''))
    return Response({'success': True, 'image_url': image_url})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 9 — List reviews
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gbp_list_reviews(request):
    """List reviews for the selected location."""
    account = _get_user_gbp_account(request.user)
    if not account:
        return Response({'error': 'No Google Business account connected.'}, status=status.HTTP_404_NOT_FOUND)
    if not account.gbp_location_id:
        return Response({'error': 'No location selected.', 'needs_location': True},
                        status=status.HTTP_400_BAD_REQUEST)

    token, err = _get_valid_access_token(account)
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

    ok, result = GoogleBusinessService.list_reviews(
        token, account.gbp_account_id, account.gbp_location_id
    )
    if not ok:
        return Response({'error': result}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'reviews': result})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 10 — AI: generate a reply to a review
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gbp_generate_review_reply(request):
    """
    AI-generate a reply to a review.
    Body: { review_text, star_rating? } → returns { reply }
    """
    review_text = str(request.data.get('review_text', '')).strip()
    star_rating = request.data.get('star_rating')

    if not review_text:
        return Response({'error': 'review_text is required.'}, status=status.HTTP_400_BAD_REQUEST)

    account = _get_user_gbp_account(request.user)
    if not account:
        return Response({'error': 'Connect a Google Business account first.'},
                        status=status.HTTP_404_NOT_FOUND)
    business_name = account.gbp_location_name or account.account_name

    can_afford, cost, balance = pre_check(request.user, 'gbp_review_reply')
    if not can_afford:
        return _insufficient_diamonds_response(cost, balance)

    try:
        from accounts.services.llm_service import get_llm_service
        service = get_llm_service(request.user)
        system = (
            'You are a professional, warm community manager replying to Google reviews on behalf '
            f'of "{business_name}". Write a concise, sincere reply (1-3 sentences, under 350 chars). '
            'Thank positive reviewers; for negative reviews, apologize and offer to make it right. '
            'No markdown, no quotes around the reply.'
        )
        rating_note = f' (rated {star_rating}/5)' if star_rating else ''
        result = service.chat_completion(
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': f'Review{rating_note}: {review_text}'},
            ],
            temperature=0.7,
            max_tokens=250,
        )
    except Exception as e:
        logger.error(f'[GBP] Review reply generation error: {e}')
        return Response({'error': 'AI reply generation failed. Please try again.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    if not result.success:
        return Response({'error': result.error or 'No AI API key configured.'},
                        status=status.HTTP_400_BAD_REQUEST)

    reply = (result.content or '').strip().strip('"').strip()
    if not reply:
        return Response({'error': 'AI returned an empty reply. Please try again.'},
                        status=status.HTTP_502_BAD_GATEWAY)

    deduct_diamonds(user=request.user, feature='gbp_review_reply', result=result)
    return Response({'success': True, 'reply': reply})


# ══════════════════════════════════════════════════════════════════════════════
# VIEW 11 — Publish a reply to a review
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gbp_reply_to_review(request):
    """
    Publish the owner reply to a review.
    Body: { review_name, reply_text }
    review_name is the full resource path returned by the reviews list.
    """
    review_name = str(request.data.get('review_name', '')).strip()
    reply_text  = str(request.data.get('reply_text', '')).strip()

    if not review_name:
        return Response({'error': 'review_name is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not reply_text:
        return Response({'error': 'reply_text is required.'}, status=status.HTTP_400_BAD_REQUEST)

    account = _get_user_gbp_account(request.user)
    if not account:
        return Response({'error': 'No Google Business account connected.'}, status=status.HTTP_404_NOT_FOUND)

    # Ownership guard: the review must belong to this account's resource tree.
    # Require a path-boundary match so "accounts/123" can't match "accounts/1230/...".
    acct = account.gbp_account_id
    if acct and not (review_name == acct or review_name.startswith(acct + '/')):
        return Response({'error': 'This review does not belong to your connected account.'},
                        status=status.HTTP_403_FORBIDDEN)

    token, err = _get_valid_access_token(account)
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

    ok, result = GoogleBusinessService.reply_to_review(token, review_name, reply_text)
    if not ok:
        return Response({'error': result}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'success': True, 'message': 'Reply published.', 'reply': result.get('comment', '')})


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — Popup HTML
# ══════════════════════════════════════════════════════════════════════════════

def _popup_success(account_info, warning=None):
    data = json.dumps({'type': 'GBP_OAUTH_SUCCESS', 'account': account_info, 'warning': warning})
    return _render_popup_html(data, success=True, warning=warning)


def _popup_error(title, detail=''):
    data = json.dumps({'type': 'GBP_OAUTH_ERROR', 'title': title, 'detail': detail})
    return _render_popup_html(data, success=False, title=title, detail=detail)


def _render_popup_html(json_data, success=True, warning=None, title=None, detail=None):
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'

    if success:
        icon = '&#10004;'
        heading = 'Google Business Connected!'
        body = '<p>Your Google Business Profile is now connected.</p>'
        if warning:
            body += f'<p class="warn">&#9888; {html_lib.escape(str(warning))}</p>'
        heading_color = '#4285F4'
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
  <title>Google Business Connection</title>
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
      try{{localStorage.setItem('gbp_oauth_result',JSON.stringify(payload))}}catch(e){{}}
      try{{if(window.opener&&!window.opener.closed){{window.opener.postMessage(payload,'{frontend_url}')}}}}catch(e){{}}
      setTimeout(function(){{window.close()}},2500);
    }})();
  </script>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
