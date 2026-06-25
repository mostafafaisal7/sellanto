"""
Google Ads OAuth 2.0 + account connection.

Endpoints (mounted under /api/v1/ads/google/):
  GET  initiate/            → returns Google auth URL for popup (JWT-protected)
  GET  callback/            → Google redirects here (no JWT; state carries the user)
  GET  customers/           → list accessible customers for the pending refresh token
  POST connect/             → persist a chosen customer as an AdAccount(provider='google')
  GET  status/              → Google Ads connection health (config + accounts)

Uses a SEPARATE OAuth client from YouTube/GBP (google_ads_client_id/secret/
redirect_uri) and the `adwords` scope. Like GBP we need access_type=offline +
prompt=consent so Google returns a refresh_token (the SDK refreshes the short-
lived access token on demand).

The refresh token from the callback is held briefly in OAuthState-like fashion:
we stash it on a short-lived cache keyed by a one-time token returned to the
popup, so the SPA can then call /customers/ and /connect/ without the secret
ever living in the browser long-term. To avoid a new model we reuse a signed,
expiring payload via Django's signing framework.
"""
import html as html_lib
import json
import logging
import uuid
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from accounts.models import SiteConfiguration
from platforms.models import OAuthState
from ads.models import AdAccount
from ads.services import google_ads as gads
from ads.services.token_encryption import encrypt_token

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'
PLATFORM = 'google_ads'

# The signed "pending connection" payload lives this long — long enough for the
# user to pick a customer in the popup-return UI, short enough to limit exposure.
PENDING_TTL_SECONDS = 600
_SIGN_SALT = 'ads.google_ads.pending_connection'

# Server-side handoff: the callback stashes the just-issued pending token in the
# cache keyed to the user, and the SPA polls /pending/ to retrieve it. This is
# the reliable channel — postMessage/localStorage break across origins
# (localhost vs 127.0.0.1) and when COOP nulls window.opener after the Google
# round-trip. Kept short since the SPA polls immediately after the popup opens.
HANDOFF_TTL_SECONDS = 180


def _handoff_key(user_id):
    return f'gads_pending_handoff:{user_id}'


def _get_config():
    """Google Ads OAuth client config, DB-first with settings fallback."""
    def cfg(key, setting_name):
        val = SiteConfiguration.get(key, getattr(settings, setting_name, ''))
        return (val or '').strip() if isinstance(val, str) else val

    return {
        'client_id': cfg('google_ads_client_id', 'GOOGLE_ADS_CLIENT_ID'),
        'client_secret': cfg('google_ads_client_secret', 'GOOGLE_ADS_CLIENT_SECRET'),
        'redirect_uri': cfg('google_ads_redirect_uri', 'GOOGLE_ADS_REDIRECT_URI'),
        'frontend_url': cfg('frontend_url', 'FRONTEND_URL'),
        'login_customer_id': cfg('google_ads_login_customer_id', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID'),
    }


def _oauth_config_complete(cfg):
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


# ─────────────────────────────── Initiate ───────────────────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def google_ads_initiate(request):
    """Return the Google consent URL for the Ads OAuth popup."""
    cfg = _get_config()
    if not _oauth_config_complete(cfg):
        return Response({
            'error': 'Google Ads connection is not configured.',
            'detail': 'The admin has not set up Google Ads OAuth credentials yet. '
                      'Go to Admin Panel → Google Ads Settings.',
            'config_missing': True,
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    state_obj = OAuthState.objects.create(
        user=request.user,
        platform=PLATFORM,
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'client_id': cfg['client_id'],
        'redirect_uri': cfg['redirect_uri'],
        'response_type': 'code',
        'scope': GOOGLE_ADS_SCOPE,
        'access_type': 'offline',   # CRITICAL: get a refresh_token
        'prompt': 'consent',        # CRITICAL: force refresh_token every time
        'state': str(state_obj.state),
        'include_granted_scopes': 'true',
    }
    auth_url = f'{GOOGLE_AUTH_URL}?{urlencode(params)}'
    logger.info('[GoogleAds OAuth] initiate user=%s', request.user.username)
    return Response({'auth_url': auth_url})


# ─────────────────────────────── Callback ───────────────────────────────────


@api_view(['GET'])
@permission_classes([AllowAny])
def google_ads_callback(request):
    """Google redirects here. Exchange code → refresh_token, hand a signed
    'pending' token back to the popup so the SPA can list + connect customers."""
    code = (request.GET.get('code') or '').strip()
    state = (request.GET.get('state') or '').strip()
    error = request.GET.get('error', '')

    if error:
        if error in ('access_denied', 'consent_required'):
            return _popup_error('Connection Cancelled',
                                'You cancelled the Google login or denied permissions.')
        return _popup_error('Google Ads Login Failed', f'Google error: {error}')

    if not code or not state:
        return _popup_error('Invalid Response from Google', 'Missing required data.')

    cfg = _get_config()
    if not _oauth_config_complete(cfg):
        return _popup_error('Google Ads Not Configured', 'Please contact the administrator.')

    # Validate CSRF state (single-use, 10-min).
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

    # Exchange code → refresh token.
    try:
        refresh_token, _access, _exp = gads.exchange_code_for_refresh_token(
            code, cfg['client_id'], cfg['client_secret'], cfg['redirect_uri'],
        )
    except gads.GoogleAdsError as e:
        logger.warning('[GoogleAds OAuth] token exchange failed user=%s err=%s', user.id, e)
        return _popup_error('Login Failed', str(e))

    # Sign a short-lived pending payload binding the refresh token to this user.
    # A nonce registered in the cache lets us invalidate the token after the
    # connect step so it can't be replayed for its full TTL.
    nonce = uuid.uuid4().hex
    cache.set(_nonce_key(nonce), user.id, timeout=PENDING_TTL_SECONDS)
    pending = signing.dumps(
        {'uid': user.id, 'refresh_token': refresh_token, 'nonce': nonce},
        salt=_SIGN_SALT,
    )

    # Stash for the server-side handoff so the SPA can retrieve it by polling,
    # independent of cross-origin postMessage/localStorage quirks.
    cache.set(_handoff_key(user.id), pending, timeout=HANDOFF_TTL_SECONDS)

    logger.info('[GoogleAds OAuth] success user=%s — pending connection issued', user.username)
    return _popup_success({'pending_token': pending})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def google_ads_pending(request):
    """GET → return (and clear) the pending_token stashed by the callback for
    this user. The SPA polls this after opening the OAuth popup; it's the
    origin-independent handoff that postMessage/localStorage can't guarantee."""
    key = _handoff_key(request.user.id)
    token = cache.get(key)
    if token:
        cache.delete(key)  # single delivery — the SPA holds it from here on
        return Response({'pending_token': token})
    return Response({'pending_token': None})


def _nonce_key(nonce):
    return f'gads_pending_nonce:{nonce}'


def _load_pending(pending_token, user, consume=False):
    """Decode a signed pending payload; verify it belongs to `user` and is fresh.

    `consume=True` (the /connect/ step) additionally requires the nonce to still
    be live in the cache and deletes it, making the token single-use. The
    read-only /customers/ step leaves the nonce intact so the picker can be
    re-fetched.

    Returns refresh_token or raises ValueError.
    """
    try:
        data = signing.loads(pending_token, salt=_SIGN_SALT, max_age=PENDING_TTL_SECONDS)
    except signing.SignatureExpired:
        raise ValueError('Your Google connection session expired. Please reconnect.')
    except signing.BadSignature:
        raise ValueError('Invalid connection token. Please reconnect.')
    if data.get('uid') != user.id:
        raise ValueError('This connection token does not belong to you.')
    rt = data.get('refresh_token')
    if not rt:
        raise ValueError('No credentials in the connection token. Please reconnect.')

    nonce = data.get('nonce')
    if consume:
        # Single-use guard: the nonce must still be live AND owned by this user.
        # We only *check* here; deletion happens after the account is persisted
        # (via _consume_nonce) so a mid-flight API failure doesn't burn the token.
        key = _nonce_key(nonce) if nonce else None
        if not key or cache.get(key) != user.id:
            raise ValueError('This connection link was already used. Please reconnect.')
    return rt


def _consume_nonce(pending_token):
    """Delete the nonce so the pending_token can't be replayed. Best-effort."""
    try:
        data = signing.loads(pending_token, salt=_SIGN_SALT, max_age=PENDING_TTL_SECONDS)
        nonce = data.get('nonce')
        if nonce:
            cache.delete(_nonce_key(nonce))
    except signing.BadSignature:
        pass


# ──────────────────────────── List customers ────────────────────────────────


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def google_ads_customers(request):
    """POST { pending_token } → list accessible customers (id, name, currency...).

    Uses the just-issued refresh token (still pending) to enumerate accounts the
    user can manage so the SPA can present a picker before we persist anything.
    """
    pending_token = (request.data.get('pending_token') or '').strip()
    if not pending_token:
        return Response({'error': 'pending_token is required.'}, status=400)

    try:
        refresh_token = _load_pending(pending_token, request.user)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    try:
        customer_ids = gads.list_accessible_customers(refresh_token)
    except gads.GoogleAdsError as e:
        return _gads_error_response(e)

    # Child accounts under an MCC can only be queried with the manager's id in
    # the login-customer-id header. We try the app-configured MCC first, then
    # the customer's own id (works when it's directly accessible / is itself a
    # manager) — so the picker is populated whether the account is the MCC, a
    # child, or a standalone account.
    mcc_login = ''.join(ch for ch in str(_get_config().get('login_customer_id') or '') if ch.isdigit())

    customers = []
    seen = set()

    def _add(detail):
        cid = detail.get('customer_id')
        if cid and cid not in seen:
            seen.add(cid)
            customers.append(detail)

    for cid in customer_ids:
        details = None
        for login in (mcc_login, cid):
            try:
                details = gads.get_customer_details(refresh_token, cid, login_customer_id=login)
                break
            except gads.GoogleAdsError:
                continue
        if details is None:
            # Couldn't describe it (cancelled, no access) — still list the id so
            # the user can see/attempt it.
            details = {'customer_id': cid, 'name': '', 'currency_code': '',
                       'timezone_name': '', 'is_manager': False, 'is_test_account': False}
        _add(details)

        # If this is a manager (MCC), expand its children so child/test accounts
        # — which list_accessible_customers doesn't return — appear in the picker.
        if details.get('is_manager'):
            for child in gads.list_customer_clients(refresh_token, cid, login_customer_id=cid):
                _add(child)

    # A connectable account is an enabled, non-manager client. If every account
    # we found is a manager or a draft/canceled client, the user would otherwise
    # get a silent empty picker — tell them WHY and what to do.
    connectable = [c for c in customers
                   if not c.get('is_manager') and c.get('connectable', True)]
    notice = None
    if not connectable:
        only_managers = customers and all(c.get('is_manager') for c in customers)
        has_draft = any(c.get('status') and c['status'] != 'ENABLED'
                        for c in customers if not c.get('is_manager'))
        if not customers:
            notice = ('No Google Ads accounts are accessible with this login. '
                      'Sign in with the Google account that owns the ad account.')
        elif has_draft:
            notice = ('Your manager account’s client accounts are still in '
                      'Draft status, so Google’s API hides them. Finish each '
                      'account’s setup (add billing / complete the wizard) in '
                      'the Google Ads UI so they become Enabled, then reconnect.')
        elif only_managers:
            notice = ('You signed in with a manager (MCC) account that has no '
                      'enabled client accounts. Create or enable a client account '
                      'under it, then reconnect.')

    return Response({'customers': customers, 'count': len(customers),
                     'connectable_count': len(connectable), 'notice': notice})


# ─────────────────────────────── Connect ────────────────────────────────────


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def google_ads_connect(request):
    """POST { pending_token, customer_id, brand_id? } → persist an AdAccount.

    Stores the (encrypted) refresh token, the customer's name/currency/timezone,
    and the app-level MCC login_customer_id. Idempotent per (user, customer_id).
    """
    pending_token = (request.data.get('pending_token') or '').strip()
    customer_id = ''.join(ch for ch in str(request.data.get('customer_id', '')) if ch.isdigit())
    # The managing MCC the SPA discovered for this account (a client sub-account
    # can only be read with its parent MCC in the login-customer-id header).
    manager_id = ''.join(ch for ch in str(request.data.get('manager_id', '')) if ch.isdigit())
    brand_id = request.data.get('brand_id')

    if not pending_token or not customer_id:
        return Response({'error': 'pending_token and customer_id are required.'}, status=400)

    try:
        refresh_token = _load_pending(pending_token, request.user, consume=True)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    # Pull descriptive fields so the saved account is meaningful. A client
    # sub-account can ONLY be read with its managing MCC in the login-customer-id
    # header (otherwise Google returns "User doesn't have permission... the
    # manager's customer id must be set in the 'login-customer-id' header").
    # Try the configured MCC first, then the customer's own id (works when it's
    # directly accessible or is itself a manager) — same ladder as /customers/.
    cfg_login = _get_config().get('login_customer_id')
    mcc_login = ''.join(ch for ch in str(cfg_login or '') if ch.isdigit())

    # If the SPA didn't supply the parent MCC (e.g. an older frontend bundle),
    # discover it server-side: a client sub-account can only be read with its
    # managing MCC in the login-customer-id header. This makes connect work
    # regardless of what the frontend sends.
    if not manager_id:
        try:
            manager_id = gads.resolve_login_customer_id(refresh_token, customer_id)
        except gads.GoogleAdsError:
            manager_id = ''

    details = None
    last_err = None
    working_login = ''  # the MCC header that actually authorised the read
    # Order: the parent MCC (supplied or resolved) → the app-configured MCC →
    # the customer's own id (standalone / self-manager).
    ladder = [l for l in (manager_id, mcc_login, customer_id) if l]
    logger.info('[GoogleAds connect] customer_id=%s manager_id=%r cfg_mcc=%r ladder=%s',
                customer_id, manager_id, mcc_login, ladder)
    for login in ladder:
        try:
            details = gads.get_customer_details(
                refresh_token, customer_id, login_customer_id=login,
            )
            working_login = login
            logger.info('[GoogleAds connect] OK with login_customer_id=%s', login)
            break
        except gads.GoogleAdsError as e:
            logger.warning('[GoogleAds connect] login=%s failed: %s', login, e)
            last_err = e
            continue
    if details is None:
        return _gads_error_response(
            last_err or gads.GoogleAdsError('Could not read this customer.')
        )

    if details.get('is_manager'):
        return Response(
            {'error': 'That is a manager (MCC) account. Pick a client account that runs ads.'},
            status=400,
        )

    brand = None
    if brand_id:
        from brands.models import Brand
        brand = Brand.objects.filter(id=brand_id, user=request.user).first()

    # Persist the MCC that actually authorised the read so every later call
    # (campaigns, insights) uses the correct login-customer-id. If the account
    # was reachable via its OWN id (standalone, no manager), store no login id —
    # sending a self-referential header is invalid.
    saved_login = '' if working_login == customer_id else working_login

    obj, created = AdAccount.objects.update_or_create(
        user=request.user,
        provider='google',
        external_id=customer_id,
        defaults={
            'brand': brand,
            'name': details.get('name') or f'Google Ads {customer_id}',
            'currency_code': details.get('currency_code', ''),
            'timezone_name': details.get('timezone_name', ''),
            'encrypted_token': encrypt_token(refresh_token),
            'login_customer_id': saved_login,
            'is_active': True,
            'last_synced_at': timezone.now(),
        },
    )

    # Account persisted — now burn the nonce so this token can't be replayed.
    _consume_nonce(pending_token)

    return Response({
        'connected': True,
        'created': created,
        'account': {
            'id': obj.id,
            'provider': 'google',
            'external_id': obj.external_id,
            'name': obj.name,
            'currency_code': obj.currency_code,
            'is_test_account': details.get('is_test_account', False),
        },
    }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


# ─────────────────────────────── Status ─────────────────────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def google_ads_status(request):
    """Connection health: is the app configured + which Google ad accounts are saved."""
    cfg = _get_config()
    accounts = AdAccount.objects.filter(
        user=request.user, provider='google', is_active=True,
    )
    return Response({
        'configured': _oauth_config_complete(cfg) and gads.config_is_complete(),
        'oauth_configured': _oauth_config_complete(cfg),
        'developer_token_set': gads.config_is_complete(),
        'accounts': [{
            'id': a.id,
            'external_id': a.external_id,
            'name': a.name,
            'currency_code': a.currency_code,
            'last_synced_at': a.last_synced_at.isoformat() if a.last_synced_at else None,
        } for a in accounts],
        'total_accounts': accounts.count(),
    })


# ─────────────────────────────── Helpers ────────────────────────────────────


def _gads_error_response(e):
    """Map a GoogleAdsError to an HTTP response with useful detail."""
    if getattr(e, 'sdk_missing', False):
        return Response(
            {'error': str(e), 'code': 'SDK_MISSING'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {'error': str(e), 'details': getattr(e, 'details', [])},
        status=status.HTTP_502_BAD_GATEWAY,
    )


def _popup_success(payload):
    data = json.dumps({'type': 'GOOGLE_ADS_OAUTH_SUCCESS', **payload})
    return _render_popup_html(data, success=True)


def _popup_error(title, detail=''):
    data = json.dumps({'type': 'GOOGLE_ADS_OAUTH_ERROR', 'title': title, 'detail': detail})
    return _render_popup_html(data, success=False, title=title, detail=detail)


def _render_popup_html(json_data, success=True, title=None, detail=None):
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'
    if success:
        icon, heading = '&#10004;', 'Google Ads Connected!'
        body = '<p>Pick which ad account to manage in Sellanto.</p>'
        heading_color = '#1a73e8'
    else:
        icon = '&#10060;'
        heading = html_lib.escape(str(title or 'Connection Failed'))
        body = f'<p class="detail">{html_lib.escape(str(detail or "An error occurred."))}</p>'
        heading_color = '#c62828'

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Google Ads Connection</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;display:flex;align-items:center;justify-content:center;min-height:100vh}}
.card{{background:#fff;border-radius:16px;padding:48px 36px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.12);text-align:center}}
.icon{{font-size:56px;margin-bottom:20px}}
h2{{color:{heading_color};font-size:20px;font-weight:700;margin-bottom:12px}}
p{{color:#555;font-size:14px;line-height:1.6;margin-top:8px}}
.detail{{color:#777;font-size:13px}}
.closing{{color:#bbb;font-size:12px;margin-top:24px}}
</style></head>
<body><div class="card"><div class="icon">{icon}</div><h2>{heading}</h2>{body}
<p class="closing">This window will close automatically...</p></div>
<script>(function(){{
var payload={json_data};
try{{localStorage.setItem('google_ads_oauth_result',JSON.stringify(payload))}}catch(e){{}}
// Post to every plausible opener origin. The popup is served from the same
// host the user loaded the app on (localhost vs 127.0.0.1 vs a real domain),
// so window.location.origin always matches the opener; the configured
// frontend_url and '*' are belt-and-suspenders for proxied/CDN setups.
var origins=['{frontend_url}', window.location.origin, '*'];
try{{
  if(window.opener&&!window.opener.closed){{
    origins.forEach(function(o){{
      if(!o) return;
      try{{window.opener.postMessage(payload,o)}}catch(e){{}}
    }});
  }}
}}catch(e){{}}
setTimeout(function(){{window.close()}},2200);
}})();</script></body></html>"""
    return HttpResponse(html)
