"""
Meta Marketing API service — boost posts, create campaigns, pull insights.

Uses raw `requests` against graph.facebook.com (no SDK) to match Sellanto's
existing pattern in `platforms/services/facebook.py`.

Pinned to API version v21.0. Bump in METAADS_API_VERSION when migrating.
"""
import logging
import time

import requests

from ads.models import AdAccount, AdCampaign
from ads.services.token_encryption import decrypt_token


logger = logging.getLogger(__name__)

METAADS_API_VERSION = 'v21.0'
GRAPH = f'https://graph.facebook.com/{METAADS_API_VERSION}'
REQUEST_TIMEOUT = 30


class MetaAdsError(Exception):
    """Raised when Meta returns an error response."""
    def __init__(self, message, code=None, subcode=None, raw=None):
        super().__init__(message)
        self.code = code
        self.subcode = subcode
        self.raw = raw or {}


def _check_error(resp_json):
    """Raise MetaAdsError if response contains an error block."""
    err = resp_json.get('error') if isinstance(resp_json, dict) else None
    if err:
        raise MetaAdsError(
            err.get('message', 'Unknown Meta error'),
            code=err.get('code'),
            subcode=err.get('error_subcode'),
            raw=err,
        )


def _post(path, token, **data):
    """POST to graph.facebook.com — return parsed JSON or raise."""
    url = f'{GRAPH}/{path}'
    data['access_token'] = token
    resp = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
    body = resp.json()
    _check_error(body)
    return body


def _get(path, token, **params):
    """GET from graph.facebook.com — return parsed JSON or raise."""
    url = f'{GRAPH}/{path}'
    params['access_token'] = token
    resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    body = resp.json()
    _check_error(body)
    return body


# ───────────────────────────── Ad account discovery ─────────────────────────


def list_user_ad_accounts(user_access_token):
    """Enumerate ad accounts the user has access to.

    Returns list of dicts: {id, account_id, name, currency, timezone_name, business_id}
    `id` is the full 'act_<digits>' form; `account_id` is bare digits.
    """
    fields = 'id,account_id,name,currency,timezone_name,business'
    body = _get('me/adaccounts', user_access_token, fields=fields, limit=100)
    out = []
    for a in body.get('data', []):
        out.append({
            'id': a.get('id'),
            'account_id': a.get('account_id'),
            'name': a.get('name', ''),
            'currency': a.get('currency', ''),
            'timezone_name': a.get('timezone_name', ''),
            'business_id': (a.get('business') or {}).get('id', ''),
        })
    return out


# ───────────────────────────── Boost Post flow (MVP) ────────────────────────


def boost_post(
    ad_account: AdAccount,
    page_id: str,
    fb_post_id: str,
    daily_budget_cents: int,
    duration_days: int,
    targeting: dict,
    campaign_name: str = '',
) -> dict:
    """Boost an existing organic Facebook post via 4 chained API calls.

    Returns: {
        'campaign_id': str, 'adset_id': str, 'creative_id': str, 'ad_id': str
    }

    Raises MetaAdsError if any step fails. Caller is responsible for rolling
    back partial state (we don't auto-delete on failure — caller decides since
    the user may want to retry the last failed step).

    Required `targeting` keys:
        geo_locations: {countries: ['US']} OR {cities: [{key, name}]}
        age_min, age_max: int (13-65)
    Optional:
        interests: [{id, name}]  # from /search?type=adinterest
        custom_audiences: [{id, name}]
        publisher_platforms: ['facebook', 'instagram']
        facebook_positions: ['feed', 'story', 'reels']
    """
    token = decrypt_token(ad_account.encrypted_token)
    if not token:
        raise MetaAdsError('No token on AdAccount — re-authenticate.')

    act_id = f'act_{ad_account.external_id}'
    object_story_id = f'{page_id}_{fb_post_id}'

    # ---- 1. Create Campaign (PAUSED until ad is wired) -----------------
    name = campaign_name or f'Sellanto Boost {fb_post_id}'
    camp = _post(
        f'{act_id}/campaigns', token,
        name=name,
        objective='OUTCOME_ENGAGEMENT',
        status='PAUSED',
        special_ad_categories='[]',
        buying_type='AUCTION',
    )
    campaign_id = camp['id']

    # ---- 2. Create Ad Set ----------------------------------------------
    end_time = int(time.time()) + (duration_days * 86400)
    import json as _json
    adset = _post(
        f'{act_id}/adsets', token,
        name=f'{name} — Ad Set',
        campaign_id=campaign_id,
        daily_budget=daily_budget_cents,
        billing_event='IMPRESSIONS',
        optimization_goal='POST_ENGAGEMENT',
        bid_strategy='LOWEST_COST_WITHOUT_CAP',
        targeting=_json.dumps(targeting),
        start_time=int(time.time()) + 300,  # 5 min from now
        end_time=end_time,
        status='PAUSED',
    )
    adset_id = adset['id']

    # ---- 3. Create Ad Creative referencing the organic post -----------
    creative = _post(
        f'{act_id}/adcreatives', token,
        name=f'{name} — Creative',
        object_story_id=object_story_id,
    )
    creative_id = creative['id']

    # ---- 4. Create the Ad, ACTIVE so the chain goes live ---------------
    ad = _post(
        f'{act_id}/ads', token,
        name=f'{name} — Ad',
        adset_id=adset_id,
        creative=_json.dumps({'creative_id': creative_id}),
        status='ACTIVE',
    )
    ad_id = ad['id']

    # Flip parents to ACTIVE so the ad actually serves
    _post(f'{adset_id}', token, status='ACTIVE')
    _post(f'{campaign_id}', token, status='ACTIVE')

    return {
        'campaign_id': campaign_id,
        'adset_id': adset_id,
        'creative_id': creative_id,
        'ad_id': ad_id,
    }


# ───────────────────────────── Status + Insights ────────────────────────────


def get_campaign_status(campaign: AdCampaign) -> dict:
    """Fetch live status + effective_status + review feedback from Meta.

    Returns: {status, effective_status, issues_info, ad_review_feedback}
    """
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token or not campaign.external_ad_id:
        return {}

    fields = 'status,effective_status,issues_info,ad_review_feedback'
    return _get(campaign.external_ad_id, token, fields=fields)


def get_campaign_insights(campaign: AdCampaign, date_preset='last_7d') -> list:
    """Pull insights for a campaign — daily breakdown.

    `date_preset`: today | yesterday | last_3d | last_7d | last_14d | last_28d
                   last_30d | last_90d | this_month | last_month | maximum
    Returns list of daily-segmented insight dicts.
    """
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token or not campaign.external_campaign_id:
        return []

    fields = (
        'impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,'
        'actions,action_values,date_start,date_stop'
    )
    body = _get(
        f'{campaign.external_campaign_id}/insights', token,
        fields=fields,
        time_increment=1,            # daily breakdown
        date_preset=date_preset,
        level='campaign',
    )
    return body.get('data', [])


def pause_campaign(campaign: AdCampaign) -> bool:
    """Pause a running campaign."""
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token or not campaign.external_campaign_id:
        return False
    _post(campaign.external_campaign_id, token, status='PAUSED')
    return True


def resume_campaign(campaign: AdCampaign) -> bool:
    """Resume a paused campaign."""
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token or not campaign.external_campaign_id:
        return False
    _post(campaign.external_campaign_id, token, status='ACTIVE')
    return True


# ───────────────────────────── Token exchange ───────────────────────────────


def exchange_for_long_lived_token(short_token: str, app_id: str, app_secret: str) -> str:
    """Exchange a short-lived user token for a 60-day long-lived one."""
    body = _get(
        'oauth/access_token', short_token,
        grant_type='fb_exchange_token',
        client_id=app_id,
        client_secret=app_secret,
        fb_exchange_token=short_token,
    )
    return body.get('access_token', '')
