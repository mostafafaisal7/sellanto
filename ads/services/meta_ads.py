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


def _resolve_object_story_id(
    page_id: str,
    fb_post_id: str,
    user_token: str,
    page_access_token: str = '',
) -> str:
    """Return the `<page_id>_<post_id>` form required by Meta's ad creatives.

    Sellanto stores whatever the publish call returned. For photos, that's
    a bare photo media ID (e.g. "122132552841070138") which Meta will reject
    when used as object_story_id. We have to look up the photo's parent
    feed post.

    Lookup strategy (in order):
      1. If already `<page>_<post>` format, return as-is.
      2. Try Page Access Token -- under Meta's new Pages experience, only
         Page tokens can read photo.post_id.
      3. Fall back to user token (works on older pages or non-photo objects).
      4. As last resort, return naive `<page_id>_<fb_post_id>` concat.
    """
    if '_' in fb_post_id:
        return fb_post_id

    # Try Page Access Token first (required for "new Pages experience").
    if page_access_token:
        try:
            photo_info = _get(fb_post_id, page_access_token, fields='id,post_id')
            if photo_info.get('post_id'):
                return photo_info['post_id']
        except MetaAdsError as e:
            logger.warning(
                f'[boost_post] page-token photo lookup failed for {fb_post_id}: {e}'
            )

    # Fall back to user token.
    try:
        photo_info = _get(fb_post_id, user_token, fields='id,post_id')
        if photo_info.get('post_id'):
            return photo_info['post_id']
    except MetaAdsError as e:
        logger.warning(
            f'[boost_post] user-token photo lookup failed for {fb_post_id}: {e}. '
            f'Falling back to naive concat.'
        )

    return f'{page_id}_{fb_post_id}'


def boost_post(
    ad_account: AdAccount,
    page_id: str,
    fb_post_id: str,
    daily_budget_cents: int,
    duration_days: int,
    targeting: dict,
    campaign_name: str = '',
    page_access_token: str = '',
) -> dict:
    """Boost an existing organic Facebook post via 4 chained API calls.

    Returns: {
        'campaign_id': str, 'adset_id': str, 'creative_id': str, 'ad_id': str
    }

    Raises MetaAdsError if any step fails. Caller is responsible for rolling
    back partial state (we don't auto-delete on failure -- caller decides since
    the user may want to retry the last failed step).

    Required `targeting` keys:
        geo_locations: {countries: ['US']} OR {cities: [{key, name}]}
        age_min, age_max: int (13-65)
    Optional:
        interests: [{id, name}]  # from /search?type=adinterest
        custom_audiences: [{id, name}]
        publisher_platforms: ['facebook', 'instagram']
        facebook_positions: ['feed', 'story', 'reels']

    `page_access_token` (optional but recommended): the Page Access Token from
    SocialAccount. Required when fb_post_id is a photo media ID (not yet in
    <page_id>_<post_id> format) under Meta's new Pages experience -- user
    tokens cannot read the photo's `post_id` field; only Page tokens can.
    """
    token = decrypt_token(ad_account.encrypted_token)
    if not token:
        raise MetaAdsError('No token on AdAccount -- re-authenticate.')

    act_id = f'act_{ad_account.external_id}'

    # Resolve fb_post_id -> proper object_story_id (`<page_id>_<post_id>`).
    # When Sellanto publishes a photo via /<page>/photos, Meta returns the
    # photo media ID (e.g. "122132552841070138"), not the feed post ID.
    # Boosting requires the feed post ID. So if the stored value isn't already
    # in <page>_<post> format, query Graph API for the photo's post_id field.
    object_story_id = _resolve_object_story_id(
        page_id=page_id,
        fb_post_id=fb_post_id,
        user_token=token,
        page_access_token=page_access_token,
    )

    import json as _json
    name = campaign_name or f'Sellanto Boost {fb_post_id}'

    # ---- 1. Create Campaign (PAUSED until ad is wired) -----------------
    # `is_adset_budget_sharing_enabled` is required by Meta when not using
    # Campaign Budget Optimization (CBO). We set ad-set-level daily_budget
    # below, so this must be 'false' (string per Graph API conventions).
    # Without it, Meta returns code=100 subcode=4834011 "Invalid parameter".
    try:
        logger.info(f'[boost_post] step 1/4 create campaign name={name!r}')
        camp = _post(
            f'{act_id}/campaigns', token,
            name=name,
            objective='OUTCOME_ENGAGEMENT',
            status='PAUSED',
            special_ad_categories='[]',
            buying_type='AUCTION',
            is_adset_budget_sharing_enabled='false',
        )
        campaign_id = camp['id']
        logger.info(f'[boost_post] step 1 OK campaign_id={campaign_id}')
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 1 (campaign): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # ---- 2. Create Ad Set ----------------------------------------------
    # For POST_ENGAGEMENT optimization, Meta requires:
    #   - promoted_object.page_id: the Page being promoted
    #   - destination_type: 'ON_POST' for post engagement (vs ON_PAGE, etc.)
    # Without these, Meta rejects with code=100 subcode=4834011 "Invalid parameter".
    #
    # Schedule must be >= 24 hours when using daily_budget (subcode 1487793).
    # Compute end_time RELATIVE to start_time so duration is exactly N days.
    start_time_ts = int(time.time()) + 300  # 5 min from now
    end_time_ts = start_time_ts + (duration_days * 86400)
    try:
        logger.info(f'[boost_post] step 2/4 create adset campaign_id={campaign_id}')
        adset = _post(
            f'{act_id}/adsets', token,
            name=f'{name} - Ad Set',
            campaign_id=campaign_id,
            daily_budget=daily_budget_cents,
            billing_event='IMPRESSIONS',
            optimization_goal='POST_ENGAGEMENT',
            bid_strategy='LOWEST_COST_WITHOUT_CAP',
            targeting=_json.dumps(targeting),
            start_time=start_time_ts,
            end_time=end_time_ts,
            status='PAUSED',
            destination_type='ON_POST',
            promoted_object=_json.dumps({'page_id': page_id}),
        )
        adset_id = adset['id']
        logger.info(f'[boost_post] step 2 OK adset_id={adset_id}')
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 2 (adset): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # ---- 3. Create Ad Creative referencing the organic post -----------
    try:
        logger.info(f'[boost_post] step 3/4 create creative object_story_id={object_story_id}')
        creative = _post(
            f'{act_id}/adcreatives', token,
            name=f'{name} - Creative',
            object_story_id=object_story_id,
        )
        creative_id = creative['id']
        logger.info(f'[boost_post] step 3 OK creative_id={creative_id}')
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 3 (creative): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # ---- 4. Create the Ad, ACTIVE so the chain goes live ---------------
    try:
        logger.info(f'[boost_post] step 4/4 create ad adset_id={adset_id} creative_id={creative_id}')
        ad = _post(
            f'{act_id}/ads', token,
            name=f'{name} - Ad',
            adset_id=adset_id,
            creative=_json.dumps({'creative_id': creative_id}),
            status='ACTIVE',
        )
        ad_id = ad['id']
        logger.info(f'[boost_post] step 4 OK ad_id={ad_id}')
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 4 (ad): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # Flip parents to ACTIVE so the ad actually serves
    try:
        _post(f'{adset_id}', token, status='ACTIVE')
        _post(f'{campaign_id}', token, status='ACTIVE')
    except MetaAdsError as e:
        logger.warning(f'[boost_post] flip-to-ACTIVE failed (non-fatal): {e}')

    return {
        'campaign_id': campaign_id,
        'adset_id': adset_id,
        'creative_id': creative_id,
        'ad_id': ad_id,
    }


# ───────────────────────────── From-scratch campaign ────────────────────────


# Sellanto objective → Meta ODAX objective + a sensible ad-set optimization goal.
_META_OBJECTIVE_MAP = {
    'awareness':  ('OUTCOME_AWARENESS', 'REACH'),
    'traffic':    ('OUTCOME_TRAFFIC',   'LINK_CLICKS'),
    'engagement': ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT'),
    'leads':      ('OUTCOME_LEADS',     'LEAD_GENERATION'),
    'sales':      ('OUTCOME_SALES',     'OFFSITE_CONVERSIONS'),
}


def create_link_campaign(
    ad_account: AdAccount,
    page_id: str,
    objective: str,
    name: str,
    daily_budget_cents: int,
    duration_days: int,
    targeting: dict,
    link_url: str,
    message: str = '',
    headline: str = '',
    description: str = '',
    image_url: str = '',
    page_access_token: str = '',
    status_active: bool = False,
) -> dict:
    """Create a from-scratch Meta campaign (link/website ad) end-to-end.

    Unlike boost_post (which promotes an existing organic post), this builds a
    brand-new link ad: Campaign → Ad Set → Ad Creative (link_data) → Ad.

    objective: one of awareness|traffic|engagement|leads|sales.
    `link_url` is required (the destination). `image_url` is optional; without it
    Meta uses a link preview image. Created PAUSED unless status_active=True.

    Returns {campaign_id, adset_id, creative_id, ad_id}.
    """
    import json as _json

    token = decrypt_token(ad_account.encrypted_token)
    if not token:
        raise MetaAdsError('No token on AdAccount -- re-authenticate.')
    if objective not in _META_OBJECTIVE_MAP:
        raise MetaAdsError(f'Unsupported objective {objective!r}.')
    if not link_url:
        raise MetaAdsError('A destination link_url is required.')

    act_id = f'act_{ad_account.external_id}'
    meta_objective, opt_goal = _META_OBJECTIVE_MAP[objective]
    name = name or f'Sellanto {objective.title()} Campaign'
    eff_status = 'ACTIVE' if status_active else 'PAUSED'

    # 1. Campaign
    try:
        camp = _post(
            f'{act_id}/campaigns', token,
            name=name, objective=meta_objective, status='PAUSED',
            special_ad_categories='[]', buying_type='AUCTION',
            is_adset_budget_sharing_enabled='false',
        )
        campaign_id = camp['id']
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 1 (campaign): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # 2. Ad Set
    start_time_ts = int(time.time()) + 300
    end_time_ts = start_time_ts + (max(1, duration_days) * 86400)
    try:
        adset = _post(
            f'{act_id}/adsets', token,
            name=f'{name} - Ad Set', campaign_id=campaign_id,
            daily_budget=daily_budget_cents, billing_event='IMPRESSIONS',
            optimization_goal=opt_goal, bid_strategy='LOWEST_COST_WITHOUT_CAP',
            targeting=_json.dumps(targeting),
            start_time=start_time_ts, end_time=end_time_ts,
            status='PAUSED', promoted_object=_json.dumps({'page_id': page_id}),
        )
        adset_id = adset['id']
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 2 (adset): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # 3. Ad Creative — link_data referencing the Page.
    link_data = {'link': link_url, 'message': message or ''}
    if headline:
        link_data['name'] = headline[:255]
    if description:
        link_data['description'] = description[:255]
    if image_url:
        link_data['picture'] = image_url
    object_story_spec = {'page_id': page_id, 'link_data': link_data}
    try:
        creative = _post(
            f'{act_id}/adcreatives', token,
            name=f'{name} - Creative',
            object_story_spec=_json.dumps(object_story_spec),
        )
        creative_id = creative['id']
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 3 (creative): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # 4. Ad
    try:
        ad = _post(
            f'{act_id}/ads', token,
            name=f'{name} - Ad', adset_id=adset_id,
            creative=_json.dumps({'creative_id': creative_id}),
            status=eff_status,
        )
        ad_id = ad['id']
    except MetaAdsError as e:
        raise MetaAdsError(f'Step 4 (ad): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    if status_active:
        try:
            _post(f'{adset_id}', token, status='ACTIVE')
            _post(f'{campaign_id}', token, status='ACTIVE')
        except MetaAdsError as e:
            logger.warning(f'[create_link_campaign] flip-to-ACTIVE failed (non-fatal): {e}')

    return {'campaign_id': campaign_id, 'adset_id': adset_id,
            'creative_id': creative_id, 'ad_id': ad_id}


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


def update_campaign_name(campaign: AdCampaign, new_name: str) -> bool:
    """Rename a live Meta campaign."""
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token or not campaign.external_campaign_id:
        return False
    _post(campaign.external_campaign_id, token, name=new_name)
    return True


def update_campaign_budget(campaign: AdCampaign, new_daily_minor: int) -> bool:
    """Update a Meta campaign's daily budget.

    Meta carries the daily budget on the ad set (or the campaign, for CBO). We
    set it on the ad set (the level the Boost flow uses). `new_daily_minor` is
    cents in the account currency.
    """
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token:
        return False
    target = campaign.external_adset_id or campaign.external_campaign_id
    if not target:
        return False
    _post(target, token, daily_budget=int(new_daily_minor))
    return True


def remove_campaign(campaign: AdCampaign) -> bool:
    """Delete a Meta campaign (DELETE on the campaign node)."""
    token = decrypt_token(campaign.ad_account.encrypted_token)
    if not token or not campaign.external_campaign_id:
        return False
    url = f'{GRAPH}/{campaign.external_campaign_id}'
    resp = requests.delete(url, params={'access_token': token}, timeout=REQUEST_TIMEOUT)
    body = resp.json()
    _check_error(body)
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
