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


def _delete_quietly(node_id, token):
    """Best-effort DELETE of a Meta object. Never raises.

    Used to roll back half-built campaigns when a later step fails, so we don't
    leave orphan campaign/adset shells cluttering the user's Ads Manager.
    """
    if not node_id:
        return
    try:
        requests.delete(f'{GRAPH}/{node_id}', params={'access_token': token},
                        timeout=REQUEST_TIMEOUT)
    except Exception as e:  # noqa: BLE001 — rollback must never mask the real error
        logger.warning(f'[rollback] could not delete {node_id}: {e}')


# ───────────────────────────── Ad account discovery ─────────────────────────


def list_user_ad_accounts(user_access_token):
    """Enumerate ad accounts the user has access to.

    Returns list of dicts: {id, account_id, name, currency, timezone_name, business_id}
    `id` is the full 'act_<digits>' form; `account_id` is bare digits.
    """
    fields = 'id,account_id,name,currency,timezone_name,account_status,business'
    body = _get('me/adaccounts', user_access_token, fields=fields, limit=100)
    out = []
    for a in body.get('data', []):
        status = a.get('account_status')
        out.append({
            'id': a.get('id'),
            'account_id': a.get('account_id'),
            'name': a.get('name', ''),
            'currency': a.get('currency', ''),
            'timezone_name': a.get('timezone_name', ''),
            'account_status': status,
            # Meta marks sandbox/test accounts with account_status == 101.
            'is_sandbox': status == 101,
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


# Valid Meta call-to-action button types we expose. NO_BUTTON means omit the CTA.
_META_CTA_TYPES = {
    'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_TRAVEL', 'CONTACT_US',
    'DOWNLOAD', 'GET_OFFER', 'SUBSCRIBE', 'WATCH_MORE', 'NO_BUTTON',
}


def upload_image_from_url(ad_account: AdAccount, image_url: str) -> str:
    """Upload an image to the ad account's library by URL, return its image_hash.

    POSTs to act_<id>/adimages with the `url` param so Meta fetches the image
    itself (no local bytes). Returns the image_hash string, or '' on any failure
    (caller falls back to using the raw picture URL in link_data).
    """
    if not image_url:
        return ''
    token = decrypt_token(ad_account.encrypted_token)
    if not token:
        return ''
    act_id = f'act_{ad_account.external_id}'
    try:
        body = _post(f'{act_id}/adimages', token, url=image_url)
    except MetaAdsError as e:
        logger.warning(f'[upload_image_from_url] adimages failed (non-fatal): {e}')
        return ''
    # Response shape: {"images": {"<original_url_or_name>": {"hash": "...", ...}}}
    images = body.get('images') if isinstance(body, dict) else None
    if isinstance(images, dict):
        for entry in images.values():
            if isinstance(entry, dict) and entry.get('hash'):
                return entry['hash']
    return ''


# ───────────────────────────── Custom / Lookalike audiences ─────────────────


def create_custom_audience(
    ad_account: AdAccount,
    name: str,
    description: str = '',
    subtype: str = 'CUSTOM',
) -> str:
    """Create a Custom Audience on Meta. Returns the new audience id.

    POSTs to act_<id>/customaudiences. `customer_file_source` is required by
    Meta for USER-provided list audiences.
    """
    token = decrypt_token(ad_account.encrypted_token)
    act_id = f'act_{ad_account.external_id}'
    body = _post(
        f'{act_id}/customaudiences', token,
        name=name,
        subtype=subtype,
        description=description,
        customer_file_source='USER_PROVIDED_ONLY',
    )
    return body.get('id', '')


def create_lookalike_audience(
    ad_account: AdAccount,
    name: str,
    origin_audience_id: str,
    country: str = 'US',
    ratio: float = 0.01,
) -> str:
    """Create a Lookalike Audience on Meta from a source audience.

    Returns the new audience id. `lookalike_spec` is a JSON-encoded object
    describing the similarity target market and expansion ratio.
    """
    import json as _json
    token = decrypt_token(ad_account.encrypted_token)
    act_id = f'act_{ad_account.external_id}'
    body = _post(
        f'{act_id}/customaudiences', token,
        name=name,
        subtype='LOOKALIKE',
        origin_audience_id=origin_audience_id,
        lookalike_spec=_json.dumps({
            'type': 'similarity',
            'country': country,
            'ratio': ratio,
        }),
    )
    return body.get('id', '')


def list_ad_account_audiences(ad_account: AdAccount) -> list:
    """List the Custom/Lookalike audiences on the ad account.

    Returns the raw list of dicts from Graph API with fields id, name, subtype,
    approximate_count, delivery_status, operation_status.
    """
    token = decrypt_token(ad_account.encrypted_token)
    act_id = f'act_{ad_account.external_id}'
    fields = 'id,name,subtype,approximate_count,delivery_status,operation_status'
    body = _get(f'{act_id}/customaudiences', token, fields=fields, limit=200)
    return body.get('data', []) if isinstance(body, dict) else []


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
    cta: str = 'LEARN_MORE',
    display_link: str = '',
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
        _delete_quietly(campaign_id, token)  # roll back the orphan campaign
        raise MetaAdsError(f'Step 2 (adset): {e}', code=e.code, subcode=e.subcode, raw=e.raw)

    # 3. Ad Creative — link_data referencing the Page.
    link_data = {'link': link_url, 'message': message or ''}
    if headline:
        # `name` is the primary headline; Meta also supports multiple headlines
        # for dynamic optimization via asset_feed_spec — noted for future work.
        link_data['name'] = headline[:255]
    if description:
        link_data['description'] = description[:255]

    # Prefer an uploaded image_hash over a raw picture URL when available: Meta
    # serves hashed images more reliably and they persist in the ad library.
    image_hash = upload_image_from_url(ad_account, image_url) if image_url else ''
    if image_hash:
        link_data['image_hash'] = image_hash
    elif image_url:
        link_data['picture'] = image_url

    # Shown/display domain (e.g. "example.com") under the headline.
    if display_link:
        link_data['caption'] = display_link[:255]

    # Call-to-action button. Omit entirely for NO_BUTTON.
    cta_type = (cta or 'LEARN_MORE').strip().upper()
    if cta_type not in _META_CTA_TYPES:
        cta_type = 'LEARN_MORE'
    if cta_type != 'NO_BUTTON':
        link_data['call_to_action'] = {
            'type': cta_type,
            'value': {'link': link_url},
        }

    object_story_spec = {'page_id': page_id, 'link_data': link_data}
    try:
        creative = _post(
            f'{act_id}/adcreatives', token,
            name=f'{name} - Creative',
            object_story_spec=_json.dumps(object_story_spec),
        )
        creative_id = creative['id']
    except MetaAdsError as e:
        # roll back the orphan adset + campaign (this is the sandbox failure point)
        _delete_quietly(adset_id, token)
        _delete_quietly(campaign_id, token)
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
        _delete_quietly(creative_id, token)
        _delete_quietly(adset_id, token)
        _delete_quietly(campaign_id, token)
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


# Meta breakdown dimensions Sellanto exposes → the raw `breakdowns=` value.
# Keys are the friendly names accepted by our API; values are what Graph expects.
META_INSIGHT_BREAKDOWNS = {
    'age':                'age',
    'gender':             'gender',
    'age,gender':         'age,gender',
    'publisher_platform': 'publisher_platform',   # placement
    'region':             'region',
    'country':            'country',
    'impression_device':  'impression_device',
    'device_platform':    'device_platform',
}


def get_campaign_insights_breakdown(
    campaign: AdCampaign,
    date_preset='last_7d',
    breakdown='age',
) -> list:
    """Pull campaign insights segmented by a Meta breakdown dimension.

    Same metric `fields` as get_campaign_insights (minus the daily time_increment
    — we segment by the breakdown dimension, not by day), plus the breakdown
    columns Meta appends to each row.

    `breakdown`: one of the keys in META_INSIGHT_BREAKDOWNS —
        age | gender | age,gender | publisher_platform | region | country |
        impression_device | device_platform.
    `date_preset`: today | yesterday | last_3d | last_7d | last_14d | last_28d |
                   last_30d | last_90d | this_month | last_month | maximum.

    Returns list of insight dicts, each carrying the metric fields plus the
    breakdown dimension value(s). Raises MetaAdsError on an unsupported breakdown.
    """
    graph_breakdown = META_INSIGHT_BREAKDOWNS.get(breakdown)
    if not graph_breakdown:
        raise MetaAdsError(f'Unsupported breakdown {breakdown!r}.')

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
        breakdowns=graph_breakdown,
        date_preset=date_preset,
        level='campaign',
    )
    return body.get('data', [])


def _to_float(v, default=0.0):
    """Coerce a Meta insight string to float (Meta returns numerics as strings)."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _sum_conversions(actions) -> float:
    """Sum purchase/lead/registration-type conversion actions from an insights row.

    Meta returns `actions` as a list of {action_type, value}. We count the
    common conversion action types so a summary "conversions" number is useful
    regardless of the campaign objective.
    """
    if not isinstance(actions, list):
        return 0.0
    conversion_types = {
        'purchase', 'omni_purchase',
        'offsite_conversion.fb_pixel_purchase',
        'lead', 'onsite_conversion.lead_grouped',
        'offsite_conversion.fb_pixel_lead',
        'complete_registration',
        'offsite_conversion.fb_pixel_complete_registration',
    }
    total = 0.0
    for a in actions:
        if a.get('action_type') in conversion_types:
            total += _to_float(a.get('value'))
    return total


def get_account_summary(ad_account: AdAccount, date_preset='last_30d') -> dict:
    """Account-level dashboard rollup for a Meta ad account.

    Pulls act_<id>/insights at level=account for the date_preset AND counts
    campaigns by effective_status via act_<id>/campaigns. Returns:
        {spend, impressions, clicks, ctr, cpc, reach, conversions,
         active_campaigns, paused_campaigns, total_campaigns}

    `date_preset`: today | yesterday | last_3d | last_7d | last_14d | last_28d
                   last_30d | last_90d | this_month | last_month | maximum
    """
    token = decrypt_token(ad_account.encrypted_token)
    if not token:
        raise MetaAdsError('No token on AdAccount -- re-authenticate.')

    act_id = f'act_{ad_account.external_id}'

    # ── Account-level insight totals ────────────────────────────────────
    fields = (
        'impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,'
        'actions,action_values'
    )
    body = _get(
        f'{act_id}/insights', token,
        fields=fields,
        date_preset=date_preset,
        level='account',
    )
    rows = body.get('data', [])
    row = rows[0] if rows else {}

    # ── Campaign counts by effective_status ─────────────────────────────
    active = paused = total = 0
    camp_body = _get(
        f'{act_id}/campaigns', token,
        fields='effective_status',
        limit=200,
    )
    for c in camp_body.get('data', []):
        total += 1
        eff = c.get('effective_status')
        if eff == 'ACTIVE':
            active += 1
        elif eff == 'PAUSED':
            paused += 1

    return {
        'spend': _to_float(row.get('spend')),
        'impressions': int(_to_float(row.get('impressions'))),
        'clicks': int(_to_float(row.get('clicks'))),
        'ctr': _to_float(row.get('ctr')),
        'cpc': _to_float(row.get('cpc')),
        'reach': int(_to_float(row.get('reach'))),
        'conversions': _sum_conversions(row.get('actions')),
        'active_campaigns': active,
        'paused_campaigns': paused,
        'total_campaigns': total,
    }


def get_account_recommendations(ad_account: AdAccount) -> list:
    """Recommendations for a Meta ad account: Meta-native + heuristic tips.

    Fetches act_<id>/recommendations (when the account exposes any) and ALSO
    derives simple heuristic tips from recent (last_7d) account insights so the
    endpoint stays useful even when Meta returns none. Returns a list of
    {title, message, severity} dicts (severity: info | warning | critical).
    """
    token = decrypt_token(ad_account.encrypted_token)
    if not token:
        raise MetaAdsError('No token on AdAccount -- re-authenticate.')

    act_id = f'act_{ad_account.external_id}'
    out = []

    # ── Meta-native recommendations (best-effort; not all accounts expose) ──
    try:
        rec_body = _get(
            act_id, token,
            fields='recommendations{title,message,confidence,importance}',
        )
        recs = (rec_body.get('recommendations') or {})
        rec_list = recs.get('data', []) if isinstance(recs, dict) else (recs or [])
        for r in rec_list:
            importance = (r.get('importance') or '').upper()
            severity = 'critical' if importance == 'HIGH' else (
                'warning' if importance == 'MEDIUM' else 'info')
            out.append({
                'title': r.get('title') or 'Meta recommendation',
                'message': r.get('message') or '',
                'severity': severity,
            })
    except MetaAdsError as e:
        # The recommendations edge is not available on every account/token;
        # log and fall through to the heuristic tips rather than failing.
        logger.info(f'[recommendations] Meta-native fetch unavailable: {e}')

    # ── Heuristic tips derived from recent account insights ─────────────
    try:
        body = _get(
            f'{act_id}/insights', token,
            fields='impressions,clicks,spend,ctr,frequency,actions',
            date_preset='last_7d',
            level='account',
        )
        rows = body.get('data', [])
        row = rows[0] if rows else {}
    except MetaAdsError as e:
        logger.info(f'[recommendations] insights fetch failed: {e}')
        row = {}

    if row:
        ctr = _to_float(row.get('ctr'))
        frequency = _to_float(row.get('frequency'))
        spend = _to_float(row.get('spend'))
        impressions = _to_float(row.get('impressions'))
        conversions = _sum_conversions(row.get('actions'))

        if impressions > 0 and ctr < 1.0:
            out.append({
                'title': 'Low click-through rate',
                'message': (f'CTR is {ctr:.2f}% (below 1%) over the last 7 days. '
                            'Refresh your creative or tighten the offer.'),
                'severity': 'warning',
            })
        if spend > 0 and conversions == 0:
            out.append({
                'title': 'No conversions in 7 days',
                'message': ('You spent on ads but recorded no conversions in the '
                            'last 7 days. Check your targeting and pixel setup.'),
                'severity': 'critical',
            })
        if frequency > 3.0:
            out.append({
                'title': 'High ad frequency',
                'message': (f'Average frequency is {frequency:.1f} (above 3). '
                            'Widen your audience to reduce ad fatigue.'),
                'severity': 'warning',
            })

    return out


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


# ───────────────────────────── Advanced targeting ───────────────────────────


# Friendly targeting-category type → Meta /search type + optional `class` filter.
#   interest    → adinterest
#   behavior    → adTargetingCategory, class=behaviors
#   demographic → adTargetingCategory, class=demographics
_TARGETING_SEARCH_TYPES = {
    'interest':    ('adinterest', None),
    'behavior':    ('adTargetingCategory', 'behaviors'),
    'demographic': ('adTargetingCategory', 'demographics'),
}


def search_targeting(token, q, type='interest'):
    """Search Meta's targeting categories (interests / behaviors / demographics).

    `type`: one of interest | behavior | demographic (see _TARGETING_SEARCH_TYPES).
    Interests use /search?type=adinterest; behaviors and demographics use
    /search?type=adTargetingCategory with a `class` filter.

    Returns list of dicts: [{id, name, audience_size, path, type}]. `path` is
    Meta's category breadcrumb (list of strings) when present.
    """
    if not q:
        return []
    meta_type, klass = _TARGETING_SEARCH_TYPES.get(
        type, _TARGETING_SEARCH_TYPES['interest'])

    params = {'type': meta_type, 'q': q, 'limit': 50}
    if klass:
        params['class'] = klass
    body = _get('search', token, **params)

    out = []
    for c in body.get('data', []):
        # Meta returns audience_size_lower_bound/upper_bound on newer versions;
        # older responses carry a flat audience_size. Prefer the lower bound.
        audience_size = (
            c.get('audience_size')
            or c.get('audience_size_lower_bound')
        )
        out.append({
            'id': c.get('id'),
            'name': c.get('name', ''),
            'audience_size': audience_size,
            'path': c.get('path') or [],
            'type': c.get('type') or meta_type,
        })
    return out


def search_geo(token, q):
    """Search Meta's ad geo-locations (countries / regions / cities).

    GET /search?type=adgeolocation&location_types=['country','region','city'].
    Returns normalized list: [{key, name, type, country_code}]. `key` is the
    value to feed back into targeting geo_locations (country codes for countries,
    numeric keys for regions/cities).
    """
    if not q:
        return []
    import json as _json
    body = _get(
        'search', token,
        type='adgeolocation',
        location_types=_json.dumps(['country', 'region', 'city']),
        q=q,
        limit=50,
    )
    out = []
    for loc in body.get('data', []):
        loc_type = loc.get('type', '')
        # Countries key off country_code; regions/cities key off numeric `key`.
        key = loc.get('key') or loc.get('country_code')
        out.append({
            'key': key,
            'name': loc.get('name', ''),
            'type': loc_type,
            'country_code': loc.get('country_code', ''),
        })
    return out


def build_targeting_spec(friendly: dict) -> dict:
    """Convert a friendly targeting dict into a Meta targeting spec.

    Friendly input keys (all optional):
        geo: {countries: ['US'], regions: [{key}], cities: [{key}]}  OR
             already-shaped geo_locations dict
        age_min, age_max: int
        genders: [1] (male) | [2] (female) | [1, 2] (all)
        interests: [id, ...]            # ids from search_targeting(type=interest)
        behaviors: [id, ...]            # ids from search_targeting(type=behavior)
        placements: ['facebook', 'instagram'] and/or position tokens like
                    'facebook:feed', 'instagram:story' — see below
        custom_audiences: [id, ...]     # saved/custom/lookalike audience ids

    Interests + behaviors are wrapped in flexible_spec (AND across groups,
    OR within a group). Placements expand into publisher_platforms +
    facebook_positions / instagram_positions. custom_audiences attaches
    saved/custom/lookalike audiences.

    Returns a Meta-ready targeting spec dict.
    """
    spec = {}

    # ── Geo ──────────────────────────────────────────────────────────────
    geo = friendly.get('geo') or {}
    if geo:
        # Accept either a pre-shaped geo_locations dict or the friendly form.
        if any(k in geo for k in ('countries', 'regions', 'cities')):
            geo_locations = {}
            if geo.get('countries'):
                geo_locations['countries'] = list(geo['countries'])
            for level in ('regions', 'cities'):
                vals = geo.get(level)
                if vals:
                    # Accept [{key}] or [key] and normalize to [{key}].
                    geo_locations[level] = [
                        v if isinstance(v, dict) else {'key': str(v)}
                        for v in vals
                    ]
            spec['geo_locations'] = geo_locations
        else:
            spec['geo_locations'] = geo

    # ── Age / gender ─────────────────────────────────────────────────────
    if friendly.get('age_min') is not None:
        spec['age_min'] = int(friendly['age_min'])
    if friendly.get('age_max') is not None:
        spec['age_max'] = int(friendly['age_max'])
    if friendly.get('genders'):
        spec['genders'] = [int(g) for g in friendly['genders']]

    # ── Interests + behaviors → flexible_spec ────────────────────────────
    flex_group = {}
    if friendly.get('interests'):
        flex_group['interests'] = [{'id': str(i)} for i in friendly['interests']]
    if friendly.get('behaviors'):
        flex_group['behaviors'] = [{'id': str(b)} for b in friendly['behaviors']]
    if flex_group:
        spec['flexible_spec'] = [flex_group]

    # ── Placements → publisher_platforms + positions ─────────────────────
    placements = friendly.get('placements') or []
    if placements:
        platforms = set()
        fb_positions, ig_positions = [], []
        for p in placements:
            p = str(p).strip().lower()
            if ':' in p:
                plat, pos = p.split(':', 1)
                platforms.add(plat)
                if plat == 'facebook':
                    fb_positions.append(pos)
                elif plat == 'instagram':
                    ig_positions.append(pos)
            else:
                platforms.add(p)
        if platforms:
            spec['publisher_platforms'] = sorted(platforms)
        if fb_positions:
            spec['facebook_positions'] = fb_positions
        if ig_positions:
            spec['instagram_positions'] = ig_positions

    # ── Custom / lookalike audiences ─────────────────────────────────────
    if friendly.get('custom_audiences'):
        spec['custom_audiences'] = [
            {'id': str(a)} for a in friendly['custom_audiences']
        ]

    return spec


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
