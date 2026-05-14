"""
LinkedIn OAuth 2.0 — Dual-App Connection System
================================================
Supports two independent LinkedIn apps running side-by-side:

  PERSONAL APP (Sign In with LinkedIn + Share on LinkedIn)
    GET  /api/v1/platforms/linkedin/initiate/            → auth URL for personal popup
    GET  /api/v1/platforms/linkedin/callback/            → personal callback (no JWT)
    GET  /api/v1/platforms/linkedin/status/              → connection health

  COMMUNITY APP (Community Management API only)
    GET  /api/v1/platforms/linkedin/community/initiate/  → auth URL for company popup
    GET  /api/v1/platforms/linkedin/community/callback/  → community callback (no JWT)

Admin config keys in SiteConfiguration:
  Personal:  linkedin_client_id, linkedin_client_secret, linkedin_redirect_uri
  Community: linkedin_community_client_id, linkedin_community_client_secret,
             linkedin_community_redirect_uri

Message types (localStorage + postMessage):
  Personal:  LI_OAUTH_SUCCESS / LI_OAUTH_ERROR   (key: li_oauth_result)
  Community: LI_COMMUNITY_SUCCESS / LI_COMMUNITY_ERROR (key: li_community_oauth_result)
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
LI_API_VERSION = '202604'

# Personal App scopes — Sign In with LinkedIn + Share on LinkedIn products
LI_PERSONAL_SCOPES = 'openid profile email w_member_social'

# Community App scopes — Community Management API product ONLY
LI_COMMUNITY_SCOPES = 'r_organization_social w_organization_social'


# ─── Config Helpers ──────────────────────────────────────────────────────────

def _get_li_config():
    """Personal App credentials from SiteConfiguration DB."""
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


def _get_li_community_config():
    """Community App credentials from SiteConfiguration DB."""
    client_id     = SiteConfiguration.get('linkedin_community_client_id',     getattr(settings, 'LINKEDIN_COMMUNITY_CLIENT_ID', ''))
    client_secret = SiteConfiguration.get('linkedin_community_client_secret', getattr(settings, 'LINKEDIN_COMMUNITY_CLIENT_SECRET', ''))
    redirect_uri  = SiteConfiguration.get('linkedin_community_redirect_uri',  getattr(settings, 'LINKEDIN_COMMUNITY_REDIRECT_URI', ''))
    frontend_url  = SiteConfiguration.get('frontend_url',                     getattr(settings, 'FRONTEND_URL', ''))
    return {
        'client_id':     client_id.strip() if client_id else '',
        'client_secret': client_secret.strip() if client_secret else '',
        'redirect_uri':  redirect_uri.strip() if redirect_uri else '',
        'frontend_url':  frontend_url.strip() if frontend_url else '',
    }


def _config_is_complete(cfg):
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


def _li_headers(access_token):
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LI_API_VERSION,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PERSONAL — Initiate
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def linkedin_oauth_initiate(request):
    """Start personal LinkedIn OAuth — returns auth URL for popup."""
    cfg = _get_li_config()

    if not _config_is_complete(cfg):
        return Response({
            'error': 'LinkedIn Personal App is not configured.',
            'detail': (
                'Go to Admin Panel → Integrations → LinkedIn Settings → '
                'Personal App and enter Client ID, Client Secret, and Redirect URI.'
            ),
            'config_missing': True,
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        if not request.user.profile.can_add_account():
            limit = request.user.profile.max_social_accounts
            return Response({
                'error': 'Account limit reached.',
                'detail': f'Your plan allows a maximum of {limit} social account(s).',
            }, status=status.HTTP_403_FORBIDDEN)
    except Exception:
        pass

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
        'scope':         LI_PERSONAL_SCOPES,
    }

    auth_url = f'{LI_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[LI Personal] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# PERSONAL — Callback
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def linkedin_oauth_callback(request):
    """Personal LinkedIn callback — saves personal profile + any org pages found."""
    code  = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    error = request.GET.get('error', '')
    error_desc = request.GET.get('error_description', '')

    if error:
        if error in ('user_cancelled_authorize', 'user_cancelled_login', 'access_denied'):
            return _popup_error('Connection Cancelled',
                'You cancelled the LinkedIn login. Click "Connect LinkedIn" again and approve all permissions.',
                msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')
        return _popup_error('LinkedIn Login Failed', error_desc or 'An unexpected error occurred.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    if not code or not state:
        return _popup_error('Invalid Response from LinkedIn',
            'Missing required data. Please try connecting again.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    cfg = _get_li_config()
    if not _config_is_complete(cfg):
        return _popup_error('LinkedIn Not Configured',
            'The admin has not set up LinkedIn Personal App credentials.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    # Validate CSRF state
    try:
        state_obj = OAuthState.objects.get(
            state=state, platform='linkedin', used=False, expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        existing = OAuthState.objects.filter(state=state, platform='linkedin').first()
        if existing and existing.used:
            detail = 'This login link has already been used. Please start again.'
        elif existing and existing.expires_at < timezone.now():
            detail = 'Session expired (10-minute limit). Click "Connect LinkedIn" again.'
        else:
            detail = 'Invalid session token. Please try connecting again.'
        return _popup_error('Session Validation Failed', detail,
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    state_obj.used = True
    state_obj.save(update_fields=['used'])
    user = state_obj.user
    logger.info(f'[LI Personal] Callback for user {user.username}')

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
        return _popup_error('Connection Timed Out', 'LinkedIn took too long to respond.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')
    except Exception as e:
        logger.error(f'[LI Personal] Token request failed: {e}')
        return _popup_error('Could Not Reach LinkedIn', 'Check your internet connection and try again.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    if 'error' in token_data:
        err = token_data.get('error_description', token_data.get('error', 'Unknown error'))
        logger.error(f'[LI Personal] Token error: {token_data}')
        return _popup_error('Login Failed', f'LinkedIn error: {err}',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in    = token_data.get('expires_in', 5184000)

    if not access_token:
        return _popup_error('No Token Received', 'LinkedIn did not return a token. Please try again.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    token_expires_at = timezone.now() + timedelta(seconds=expires_in)

    # ── Step 2: fetch personal profile ──────────────────────────────────────
    try:
        resp = requests.get(
            f'{LI_API_BASE}/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=15
        )
        profile = resp.json()
    except requests.Timeout:
        return _popup_error('Could Not Fetch Your Profile', 'LinkedIn took too long.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')
    except Exception as e:
        logger.error(f'[LI Personal] Userinfo failed: {e}')
        return _popup_error('Could Not Fetch Your Profile', 'Please try again.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    if 'error' in profile:
        return _popup_error('Profile Fetch Failed',
            profile.get('error_description', 'Could not read your LinkedIn profile.'),
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    person_id    = profile.get('sub', '')
    person_name  = profile.get('name', 'LinkedIn User')
    person_email = profile.get('email', '')
    person_urn   = f'urn:li:person:{person_id}' if person_id else ''

    if not person_id:
        return _popup_error('Profile Data Missing',
            'Could not identify your LinkedIn account. Please try again.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    # ── Step 3: save personal profile ───────────────────────────────────────
    connected_accounts = []

    try:
        existing = SocialAccount.objects.filter(
            user=user, platform='linkedin', linkedin_person_urn=person_urn
        ).first()

        if existing:
            existing.account_name = person_name
            existing.linkedin_access_token  = access_token
            existing.linkedin_refresh_token = refresh_token or existing.linkedin_refresh_token
            existing.token_expires_at = token_expires_at
            existing.validation_error = ''
            existing.save(update_fields=[
                'account_name', 'linkedin_access_token', 'linkedin_refresh_token',
                'token_expires_at', 'validation_error',
            ])
            account = existing
        else:
            account, _ = SocialAccount.objects.update_or_create(
                user=user,
                platform='linkedin',
                account_name=person_name,
                defaults={
                    'linkedin_access_token':  access_token,
                    'linkedin_refresh_token': refresh_token,
                    'linkedin_person_urn':    person_urn,
                    'token_expires_at':       token_expires_at,
                    'validation_error':       '',
                }
            )

        valid, result = LinkedInService.validate_credentials(access_token)
        if valid:
            account.mark_as_active()
            connected_accounts.append({
                'id': account.id, 'name': person_name, 'type': 'personal',
                'person_urn': person_urn, 'email': person_email, 'status': 'active',
            })
            logger.info(f'[LI Personal] Profile saved: {person_name}')
        else:
            account.mark_as_invalid(result)
            connected_accounts.append({
                'id': account.id, 'name': person_name, 'type': 'personal',
                'status': 'invalid', 'error': result,
            })
            logger.warning(f'[LI Personal] Validation failed: {result}')

    except Exception as e:
        logger.error(f'[LI Personal] Profile save failed: {e}')

    # ── Step 4: org pages (graceful — 403 just means no Community API) ───────
    try:
        resp = requests.get(
            f'{LI_API_BASE}/rest/organizationAcls',
            params={'q': 'roleAssignee', 'role': 'ADMINISTRATOR', 'state': 'APPROVED'},
            headers=_li_headers(access_token),
            timeout=15
        )
        if resp.status_code == 200:
            for org_element in resp.json().get('elements', []):
                org_urn = org_element.get('organization', '')
                if not org_urn:
                    continue
                org_id   = org_urn.split(':')[-1] if ':' in org_urn else org_urn
                org_name = f'Organization {org_id}'
                try:
                    org_resp = requests.get(
                        f'{LI_API_BASE}/rest/organizations/{org_id}',
                        headers=_li_headers(access_token), timeout=10
                    )
                    if org_resp.status_code == 200:
                        org_name = org_resp.json().get('localizedName', org_name)
                except Exception:
                    pass

                try:
                    org_existing = SocialAccount.objects.filter(
                        user=user, platform='linkedin', linkedin_organization_urn=org_urn,
                    ).first()
                    if org_existing:
                        org_existing.account_name = f'{org_name} (Company Page)'
                        org_existing.linkedin_access_token  = access_token
                        org_existing.linkedin_refresh_token = refresh_token or org_existing.linkedin_refresh_token
                        org_existing.linkedin_person_urn    = person_urn
                        org_existing.token_expires_at       = token_expires_at
                        org_existing.validation_error       = ''
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
                                'linkedin_access_token':     access_token,
                                'linkedin_refresh_token':    refresh_token,
                                'linkedin_person_urn':       person_urn,
                                'linkedin_organization_urn': org_urn,
                                'token_expires_at':          token_expires_at,
                                'validation_error':          '',
                            }
                        )
                    org_account.mark_as_active()
                    connected_accounts.append({
                        'id': org_account.id, 'name': org_name,
                        'type': 'organization', 'org_urn': org_urn, 'status': 'active',
                    })
                    logger.info(f'[LI Personal] Org saved: {org_name}')
                except Exception as e:
                    logger.error(f'[LI Personal] Org save failed: {e}')

        elif resp.status_code == 403:
            logger.info('[LI Personal] No Community API on this app — orgs skipped')
        else:
            logger.warning(f'[LI Personal] Org fetch {resp.status_code}')
    except Exception as e:
        logger.warning(f'[LI Personal] Org fetch skipped: {e}')

    if not connected_accounts:
        return _popup_error('Could Not Save Your Account',
            'Failed to connect your LinkedIn account. Please try again.',
            msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result')

    logger.info(f'[LI Personal] Success for {user.username}: {len(connected_accounts)} account(s)')
    return _popup_success(connected_accounts, msg_type='LI_OAUTH_SUCCESS', ls_key='li_oauth_result')


# ══════════════════════════════════════════════════════════════════════════════
# COMMUNITY — Initiate
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def linkedin_community_oauth_initiate(request):
    """Start Community Management API OAuth — returns auth URL for Company Page popup."""
    cfg = _get_li_community_config()

    if not _config_is_complete(cfg):
        return Response({
            'error': 'LinkedIn Community App is not configured.',
            'detail': (
                'Go to Admin Panel → Integrations → LinkedIn Settings → '
                'Community App and enter Client ID, Client Secret, and Redirect URI.'
            ),
            'config_missing': True,
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        if not request.user.profile.can_add_account():
            limit = request.user.profile.max_social_accounts
            return Response({
                'error': 'Account limit reached.',
                'detail': f'Your plan allows a maximum of {limit} social account(s).',
            }, status=status.HTTP_403_FORBIDDEN)
    except Exception:
        pass

    state_obj = OAuthState.objects.create(
        user=request.user,
        platform='linkedin_community',
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    params = {
        'response_type': 'code',
        'client_id':     cfg['client_id'],
        'redirect_uri':  cfg['redirect_uri'],
        'state':         str(state_obj.state),
        'scope':         LI_COMMUNITY_SCOPES,
    }

    auth_url = f'{LI_AUTH_URL}?{urlencode(params)}'
    logger.info(f'[LI Community] Initiate for user {request.user.username}')
    return Response({'auth_url': auth_url})


# ══════════════════════════════════════════════════════════════════════════════
# COMMUNITY — Callback
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def linkedin_community_oauth_callback(request):
    """Community App callback — saves Company Pages only (no personal profile step)."""
    code  = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    error = request.GET.get('error', '')
    error_desc = request.GET.get('error_description', '')

    if error:
        if error in ('user_cancelled_authorize', 'user_cancelled_login', 'access_denied'):
            return _popup_error('Connection Cancelled',
                'You cancelled the Company Page connection. Click "Connect Company Page" again.',
                msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')
        return _popup_error('LinkedIn Login Failed', error_desc or 'An unexpected error occurred.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    if not code or not state:
        return _popup_error('Invalid Response from LinkedIn',
            'Missing required data. Please try connecting again.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    cfg = _get_li_community_config()
    if not _config_is_complete(cfg):
        return _popup_error('LinkedIn Community App Not Configured',
            'The admin has not set up LinkedIn Community App credentials.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    # Validate CSRF state
    try:
        state_obj = OAuthState.objects.get(
            state=state, platform='linkedin_community', used=False, expires_at__gt=timezone.now(),
        )
    except OAuthState.DoesNotExist:
        existing = OAuthState.objects.filter(state=state, platform='linkedin_community').first()
        if existing and existing.used:
            detail = 'This login link has already been used. Please start again.'
        elif existing and existing.expires_at < timezone.now():
            detail = 'Session expired (10-minute limit). Click "Connect Company Page" again.'
        else:
            detail = 'Invalid session token. Please try connecting again.'
        return _popup_error('Session Validation Failed', detail,
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    state_obj.used = True
    state_obj.save(update_fields=['used'])
    user = state_obj.user
    logger.info(f'[LI Community] Callback for user {user.username}')

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
        return _popup_error('Connection Timed Out', 'LinkedIn took too long to respond.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')
    except Exception as e:
        logger.error(f'[LI Community] Token request failed: {e}')
        return _popup_error('Could Not Reach LinkedIn', 'Check your internet connection.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    if 'error' in token_data:
        err = token_data.get('error_description', token_data.get('error', 'Unknown error'))
        logger.error(f'[LI Community] Token error: {token_data}')
        return _popup_error('Login Failed', f'LinkedIn error: {err}',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    access_token  = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token', '')
    expires_in    = token_data.get('expires_in', 5184000)

    if not access_token:
        return _popup_error('No Token Received', 'LinkedIn did not return a token.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    token_expires_at = timezone.now() + timedelta(seconds=expires_in)
    logger.info(f'[LI Community] Token obtained, expires in {expires_in}s')

    # ── Step 2: fetch Company Pages the user administers ─────────────────────
    # No userinfo step — user already logged in via JWT. We only need org tokens.
    connected_accounts = []

    try:
        resp = requests.get(
            f'{LI_API_BASE}/rest/organizationAcls',
            params={'q': 'roleAssignee', 'role': 'ADMINISTRATOR', 'state': 'APPROVED'},
            headers=_li_headers(access_token),
            timeout=15
        )

        if resp.status_code == 200:
            org_elements = resp.json().get('elements', [])
            logger.info(f'[LI Community] Found {len(org_elements)} admin orgs')

            for org_element in org_elements:
                org_urn = org_element.get('organization', '')
                if not org_urn:
                    continue
                org_id   = org_urn.split(':')[-1] if ':' in org_urn else org_urn
                org_name = f'Organization {org_id}'

                try:
                    org_resp = requests.get(
                        f'{LI_API_BASE}/rest/organizations/{org_id}',
                        headers=_li_headers(access_token), timeout=10
                    )
                    if org_resp.status_code == 200:
                        org_name = org_resp.json().get('localizedName', org_name)
                except Exception as e:
                    logger.warning(f'[LI Community] Could not fetch org details: {e}')

                try:
                    org_existing = SocialAccount.objects.filter(
                        user=user, platform='linkedin', linkedin_organization_urn=org_urn,
                    ).first()

                    if org_existing:
                        org_existing.account_name           = f'{org_name} (Company Page)'
                        org_existing.linkedin_access_token  = access_token
                        org_existing.linkedin_refresh_token = refresh_token or org_existing.linkedin_refresh_token
                        org_existing.token_expires_at       = token_expires_at
                        org_existing.validation_error       = ''
                        org_existing.save(update_fields=[
                            'account_name', 'linkedin_access_token', 'linkedin_refresh_token',
                            'token_expires_at', 'validation_error',
                        ])
                        org_account = org_existing
                    else:
                        org_account, _ = SocialAccount.objects.update_or_create(
                            user=user,
                            platform='linkedin',
                            account_name=f'{org_name} (Company Page)',
                            defaults={
                                'linkedin_access_token':     access_token,
                                'linkedin_refresh_token':    refresh_token,
                                'linkedin_organization_urn': org_urn,
                                'token_expires_at':          token_expires_at,
                                'validation_error':          '',
                            }
                        )

                    org_account.mark_as_active()
                    connected_accounts.append({
                        'id': org_account.id, 'name': org_name,
                        'type': 'organization', 'org_urn': org_urn, 'status': 'active',
                    })
                    logger.info(f'[LI Community] Org saved: {org_name} ({org_urn})')

                except Exception as e:
                    logger.error(f'[LI Community] Org save failed: {e}')

        elif resp.status_code == 403:
            logger.error('[LI Community] 403 on organizationAcls — wrong app or not approved')
            return _popup_error(
                'Company Pages Not Accessible',
                'LinkedIn returned 403. Make sure your Community App has ONLY the '
                'Community Management API product and the credentials in Admin Panel are correct.',
                msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result'
            )
        else:
            logger.warning(f'[LI Community] Org fetch {resp.status_code}: {resp.text[:200]}')
            return _popup_error('Could Not Fetch Company Pages',
                f'LinkedIn returned an unexpected error ({resp.status_code}). Please try again.',
                msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')

    except requests.Timeout:
        return _popup_error('Connection Timed Out', 'LinkedIn took too long to respond.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result')
    except Exception as e:
        logger.error(f'[LI Community] Org fetch failed: {e}')

    if not connected_accounts:
        return _popup_error(
            'No Company Pages Found',
            'No LinkedIn Company Pages were found where you are an Administrator. '
            'Make sure you have admin access to at least one Company Page on LinkedIn.',
            msg_type='LI_COMMUNITY_ERROR', ls_key='li_community_oauth_result'
        )

    logger.info(f'[LI Community] Success for {user.username}: {len(connected_accounts)} page(s)')
    return _popup_success(connected_accounts, msg_type='LI_COMMUNITY_SUCCESS', ls_key='li_community_oauth_result')


# ══════════════════════════════════════════════════════════════════════════════
# STATUS — shared for both personal + community accounts
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def linkedin_connection_status(request):
    """Real-time LinkedIn connection health for the authenticated user."""
    user = request.user
    force_refresh = request.GET.get('refresh') == '1'

    accounts = SocialAccount.objects.filter(
        user=user, platform='linkedin'
    ).order_by('-connected_at')

    if not accounts.exists():
        return Response({
            'overall_status': 'not_connected',
            'accounts': [], 'personal': None, 'organizations': [],
            'total_accounts': 0, 'active_accounts': 0,
        })

    if force_refresh:
        for acc in accounts:
            if acc.linkedin_access_token:
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
            'account_id':        acc.id,
            'name':              acc.account_name,
            'type':              'organization' if acc.linkedin_organization_urn else 'personal',
            'person_urn':        acc.linkedin_person_urn,
            'org_urn':           acc.linkedin_organization_urn,
            'status':            acc.status,
            'status_display':    acc.get_status_display(),
            'is_active':         acc.is_active,
            'is_validated':      acc.is_validated,
            'token_expires_at':  acc.token_expires_at.isoformat() if acc.token_expires_at else None,
            'error_message':     acc.validation_error,
            'connected_at':      acc.connected_at.isoformat() if acc.connected_at else None,
            'last_validated_at': acc.last_validated_at.isoformat() if acc.last_validated_at else None,
        }
        account_list.append(info)
        if acc.linkedin_organization_urn:
            organizations.append(info)
        elif not personal:
            personal = info

    active_count = sum(1 for a in account_list if a['status'] == 'active')
    total_count  = len(account_list)

    if active_count == total_count:
        overall = 'fully_connected'
    elif active_count > 0:
        overall = 'partially_connected'
    elif total_count > 0:
        overall = 'needs_attention'
    else:
        overall = 'not_connected'

    return Response({
        'overall_status':  overall,
        'accounts':        account_list,
        'personal':        personal,
        'organizations':   organizations,
        'total_accounts':  total_count,
        'active_accounts': active_count,
    })


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — Popup HTML (shared, parameterised by message type + localStorage key)
# ══════════════════════════════════════════════════════════════════════════════

def _popup_success(accounts, msg_type='LI_OAUTH_SUCCESS', ls_key='li_oauth_result', warning=None):
    data = json.dumps({'type': msg_type, 'accounts': accounts, 'warning': warning})
    return _render_popup_html(data, success=True, ls_key=ls_key, warning=warning)


def _popup_error(title, detail='', msg_type='LI_OAUTH_ERROR', ls_key='li_oauth_result'):
    data = json.dumps({'type': msg_type, 'title': title, 'detail': detail})
    return _render_popup_html(data, success=False, ls_key=ls_key, title=title, detail=detail)


def _render_popup_html(json_data, success=True, ls_key='li_oauth_result',
                       warning=None, title=None, detail=None):
    frontend_url = SiteConfiguration.get('frontend_url', getattr(settings, 'FRONTEND_URL', '*')) or '*'

    if success:
        icon = '&#10004;'
        heading = 'LinkedIn Connected!'
        body = '<p>Your LinkedIn account is now connected.</p>'
        if warning:
            body += f'<p class="warn">&#9888; {html_lib.escape(str(warning))}</p>'
        heading_color = '#0077B5'
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
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }}
    .card {{
      background: #ffffff; border-radius: 16px; padding: 48px 36px;
      max-width: 400px; width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12); text-align: center;
    }}
    .icon {{ font-size: 56px; margin-bottom: 20px; }}
    h2 {{ color: {heading_color}; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
    p {{ color: #555; font-size: 14px; line-height: 1.6; margin-top: 8px; }}
    .detail {{ color: #777; font-size: 13px; }}
    .warn {{
      color: #e65100; background: #fff8e1; border: 1px solid #ffe082;
      border-radius: 8px; padding: 10px 14px; margin-top: 14px;
      font-size: 13px; text-align: left;
    }}
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
      var lsKey   = '{ls_key}';

      try {{ localStorage.setItem(lsKey, JSON.stringify(payload)); }} catch (e) {{}}

      try {{
        var targetOrigin = '{frontend_url}';
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, targetOrigin);
        }}
      }} catch (err) {{}}

      setTimeout(function () {{ window.close(); }}, 2500);
    }})();
  </script>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
