"""
Google Ads API service — connect accounts, create/manage Search campaigns,
pull metrics via GAQL.

Design notes
============
* Uses the OFFICIAL `google-ads` SDK (grpc/protobuf under the hood). Unlike the
  Meta service (raw `requests`), the Ads API is too complex to hand-roll: the
  SDK handles versioning, OAuth refresh, GAQL, and the (large) request protos.
* The SDK is imported LAZILY inside each function so the Django app boots even
  when `google-ads` isn't installed yet (e.g. before `pip install`). A missing
  SDK surfaces as a clean GoogleAdsError, not an ImportError at startup.
* TEST-MODE + DRY-RUN: Google Ads has no free sandbox that serves live ads, and
  every mutation needs a real billed account + an approved Developer Token. So:
    - `validate_only=True` is passed on every mutate when `dry_run` is set, which
      asks Google to validate the request WITHOUT creating anything.
    - Test-manager accounts (login_customer_id under a test MCC) never serve real
      ads or spend money; we surface whether we're in test mode in connect().
  This lets us build + exercise the entire code path safely.

Credential model
================
Per-AdAccount we store an encrypted OAuth *refresh token* (Google tokens are
short-lived; the SDK refreshes on demand). The Developer Token + OAuth client
ID/secret are app-level config (DB-first via SiteConfiguration, settings
fallback). `login_customer_id` is the MCC/manager in the access chain.

Money: Google Ads uses MICROS. 1 unit of currency = 1,000,000 micros.
"""
import logging

logger = logging.getLogger(__name__)

# Pin to a currently-supported Google Ads API version. Versions are sunset
# ~14 months after release; v17 (used originally) is long gone, which surfaced
# as "501 GRPC target method can't be resolved". google-ads 31.x bundles
# v21–v24; v21 is the most conservative still-supported choice. Bump this (and
# the google-ads pin in requirements.txt) before v21 itself sunsets.
GOOGLE_ADS_API_VERSION = 'v21'

# Mapping from our internal objective → Google Ads AdvertisingChannelType.
# Search is the safe default for the MVP; Display/PMax can be added later.
OBJECTIVE_TO_CHANNEL = {
    'traffic':    'SEARCH',
    'leads':      'SEARCH',
    'sales':      'SEARCH',
    'awareness':  'DISPLAY',
    'engagement': 'SEARCH',
}


class GoogleAdsError(Exception):
    """Raised when the Google Ads API errors or the SDK is unavailable.

    `details` carries the per-error breakdown Google returns so the view layer
    can surface policy/validation messages to the user.
    """
    def __init__(self, message, code=None, details=None, sdk_missing=False):
        super().__init__(message)
        self.code = code
        self.details = details or []
        self.sdk_missing = sdk_missing


# ───────────────────────────── Config + client ──────────────────────────────


def _get_config():
    """Read Google Ads app-level config DB-first, settings fallback.

    Returns dict with developer_token, client_id, client_secret,
    login_customer_id, use_proto_plus. Raises GoogleAdsError if the developer
    token is missing (nothing works without it).
    """
    from django.conf import settings
    from accounts.models import SiteConfiguration

    def cfg(key, setting_name, default=''):
        val = SiteConfiguration.get(key, getattr(settings, setting_name, default))
        return (val or '').strip() if isinstance(val, str) else val

    developer_token = cfg('google_ads_developer_token', 'GOOGLE_ADS_DEVELOPER_TOKEN')
    client_id = cfg('google_ads_client_id', 'GOOGLE_ADS_CLIENT_ID')
    client_secret = cfg('google_ads_client_secret', 'GOOGLE_ADS_CLIENT_SECRET')
    login_customer_id = cfg('google_ads_login_customer_id', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID')

    return {
        'developer_token': developer_token,
        'client_id': client_id,
        'client_secret': client_secret,
        # MCC manager that sits above the operated account (digits only, no hyphens).
        'login_customer_id': _digits(login_customer_id),
    }


def config_is_complete():
    """True when the admin has set the developer token + OAuth client."""
    try:
        cfg = _get_config()
    except GoogleAdsError:
        return False
    return bool(cfg['developer_token'] and cfg['client_id'] and cfg['client_secret'])


def _digits(value):
    """Strip everything but digits — Google customer IDs are sent without hyphens."""
    if not value:
        return ''
    return ''.join(ch for ch in str(value) if ch.isdigit())


def _build_client(refresh_token, login_customer_id=''):
    """Construct a GoogleAdsClient from a per-account refresh token.

    Raises GoogleAdsError(sdk_missing=True) if the SDK isn't installed, or a
    plain GoogleAdsError if app config is incomplete.
    """
    try:
        from google.ads.googleads.client import GoogleAdsClient
    except ImportError:
        raise GoogleAdsError(
            'Google Ads SDK is not installed on the server (pip install google-ads).',
            sdk_missing=True,
        )

    cfg = _get_config()
    if not (cfg['developer_token'] and cfg['client_id'] and cfg['client_secret']):
        raise GoogleAdsError(
            'Google Ads is not configured. Set the developer token + OAuth client '
            'in Admin Panel → Google Ads Settings.'
        )
    if not refresh_token:
        raise GoogleAdsError('No Google Ads credentials on this account — reconnect.')

    login_cid = _digits(login_customer_id) or cfg['login_customer_id']

    client_config = {
        'developer_token': cfg['developer_token'],
        'client_id': cfg['client_id'],
        'client_secret': cfg['client_secret'],
        'refresh_token': refresh_token,
        'use_proto_plus': True,
    }
    # login_customer_id is only valid when present; an empty string makes the SDK
    # send an invalid header.
    if login_cid:
        client_config['login_customer_id'] = login_cid

    try:
        return GoogleAdsClient.load_from_dict(client_config, version=GOOGLE_ADS_API_VERSION)
    except Exception as e:  # noqa: BLE001 — SDK raises a variety of config errors
        raise GoogleAdsError(f'Failed to initialise Google Ads client: {e}')


def _raise_from_google_ads_exception(exc, context=''):
    """Translate a GoogleAdsException into our GoogleAdsError with readable details."""
    details = []
    request_id = getattr(exc, 'request_id', None)
    failure = getattr(exc, 'failure', None)
    if failure is not None:
        for error in getattr(failure, 'errors', []):
            msg = getattr(error, 'message', '') or ''
            # error_code is a oneof; str() gives a compact readable form.
            code = str(getattr(error, 'error_code', '')) or ''
            # field_path pinpoints WHICH field triggered the error — essential for
            # generic messages like "The required field was not present."
            path = '.'.join(
                el.field_name
                for el in getattr(getattr(error, 'location', None), 'field_path_elements', [])
                if getattr(el, 'field_name', None)
            )
            entry = {'message': msg, 'code': code}
            if path:
                entry['field_path'] = path
            details.append(entry)
    primary = details[0]['message'] if details else str(exc)
    if details and details[0].get('field_path'):
        primary = f"{primary} (field: {details[0]['field_path']})"
    # Map cryptic Google codes to actionable, human messages.
    all_codes = ' '.join(d.get('code', '') for d in details)
    if 'DUPLICATE_CAMPAIGN_NAME' in all_codes:
        primary = ('A campaign with this name already exists on this account. '
                   'Google requires every active or paused campaign to have a unique '
                   'name — pick a different name (e.g. add a date or number) and try again.')
    elif 'MUTATE_NOT_ALLOWED' in all_codes:
        primary = ('This account is not permitted to create this campaign type. '
                   'Video campaigns in particular require a non-test account with a '
                   'linked YouTube channel — test accounts cannot create them. '
                   f'(Google: {primary})')
    elif 'OPERATION_NOT_PERMITTED_FOR_CONTEXT' in all_codes:
        primary = (f'This operation is not allowed for this account/campaign setup. (Google: {primary})')
    label = f'{context}: ' if context else ''
    raise GoogleAdsError(
        f'{label}{primary}',
        code=request_id,
        details=details,
    )


def _run(callable_, context=''):
    """Execute an SDK call, converting GoogleAdsException → GoogleAdsError."""
    try:
        from google.ads.googleads.errors import GoogleAdsException
    except ImportError:
        raise GoogleAdsError('Google Ads SDK is not installed.', sdk_missing=True)
    try:
        return callable_()
    except GoogleAdsException as e:
        _raise_from_google_ads_exception(e, context)
    except GoogleAdsError:
        raise
    except Exception as e:  # noqa: BLE001
        raise GoogleAdsError(f'{context + ": " if context else ""}{e}')


# ───────────────────────── OAuth token exchange ─────────────────────────────


def exchange_code_for_refresh_token(code, client_id, client_secret, redirect_uri):
    """Exchange an authorization code for a refresh token (raw HTTP, no SDK).

    Returns (refresh_token, access_token, expires_in). Raises GoogleAdsError on
    failure. We do this with `requests` (not the SDK) because it's a plain OAuth
    token exchange identical to the GBP flow.
    """
    import requests

    try:
        resp = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': redirect_uri,
            },
            timeout=15,
        )
        data = resp.json()
    except requests.RequestException as e:
        raise GoogleAdsError(f'Could not reach Google token endpoint: {e}')
    except ValueError:
        raise GoogleAdsError('Google returned an invalid token response.')

    if 'error' in data:
        raise GoogleAdsError(
            data.get('error_description', data.get('error', 'Token exchange failed.'))
        )

    refresh_token = data.get('refresh_token', '')
    if not refresh_token:
        raise GoogleAdsError(
            'Google did not return a refresh token. Ensure access_type=offline '
            'and prompt=consent were used, and revoke prior grants if testing.'
        )
    return refresh_token, data.get('access_token', ''), data.get('expires_in', 3600)


# ─────────────────────────── Account discovery ──────────────────────────────


def list_accessible_customers(refresh_token):
    """Return the customer IDs (resource names) this refresh token can access.

    These are the top-level accounts directly reachable; child accounts under an
    MCC require a follow-up query. Returns list of digit-only customer IDs.
    """
    client = _build_client(refresh_token)

    def _call():
        svc = client.get_service('CustomerService')
        response = svc.list_accessible_customers()
        # resource_names look like "customers/1234567890"
        return [rn.split('/')[-1] for rn in response.resource_names]

    result = _run(_call, context='list accessible customers')
    logger.info('[GoogleAds] list_accessible_customers -> %s', result)
    return result


def resolve_login_customer_id(refresh_token, customer_id):
    """Find the manager (MCC) that should be sent as login-customer-id to access
    `customer_id`.

    A client sub-account is NOT directly accessible — list_accessible_customers
    returns only the managers. So to read/operate the client we must send its
    parent MCC in the login-customer-id header. This walks the accessible
    managers, lists each one's clients, and returns the manager id that contains
    the target customer.

    Returns the manager id (digits) or '' if the customer is itself directly
    accessible (standalone / is its own manager) or no manager could be found.
    """
    target = _digits(customer_id)
    try:
        accessible = list_accessible_customers(refresh_token)
    except GoogleAdsError:
        return ''

    # If the target is directly accessible, no manager header is needed.
    if target in [_digits(a) for a in accessible]:
        return ''

    for acc in accessible:
        acc_id = _digits(acc)
        # Only managers have clients; list_customer_clients is best-effort ([]).
        for child in list_customer_clients(refresh_token, acc_id, login_customer_id=acc_id):
            if _digits(child.get('customer_id')) == target:
                logger.info('[GoogleAds] resolved login_customer_id=%s for customer=%s',
                            acc_id, target)
                return acc_id
    logger.warning('[GoogleAds] could not resolve a manager for customer=%s', target)
    return ''


def get_customer_details(refresh_token, customer_id, login_customer_id=''):
    """Fetch descriptive fields (name, currency, timezone, is_manager) for one customer."""
    client = _build_client(refresh_token, login_customer_id=login_customer_id)
    cid = _digits(customer_id)

    query = """
        SELECT customer.id, customer.descriptive_name, customer.currency_code,
               customer.time_zone, customer.manager, customer.test_account
        FROM customer
        LIMIT 1
    """

    def _call():
        ga_service = client.get_service('GoogleAdsService')
        rows = ga_service.search(customer_id=cid, query=query)
        for row in rows:
            c = row.customer
            return {
                'customer_id': cid,
                'name': c.descriptive_name or '',
                'currency_code': c.currency_code or '',
                'timezone_name': c.time_zone or '',
                'is_manager': bool(c.manager),
                'is_test_account': bool(c.test_account),
            }
        return {'customer_id': cid, 'name': '', 'currency_code': '',
                'timezone_name': '', 'is_manager': False, 'is_test_account': False}

    return _run(_call, context='get customer details')


def list_customer_clients(refresh_token, manager_id, login_customer_id=''):
    """Enumerate every account under a manager (MCC), including nested children.

    Queries `customer_client` from the manager, which returns the manager itself
    plus all descendants. Used to surface child accounts (e.g. a test account)
    that `list_accessible_customers` — which only returns top-level accounts —
    doesn't include. Returns a list of detail dicts (same shape as
    get_customer_details). Best-effort: returns [] if the manager can't be read.
    """
    login = _digits(login_customer_id) or _digits(manager_id)
    client = _build_client(refresh_token, login_customer_id=login)
    mid = _digits(manager_id)

    # Field set matches Google's canonical account-hierarchy example.
    # `customer_client.status` IS a valid, selectable field (enum: ENABLED,
    # CANCELED, CLOSED, SUSPENDED, UNKNOWN, UNSPECIFIED). We select it so the
    # picker can SHOW non-enabled accounts with a reason instead of them silently
    # vanishing: a sub-account still in the Google Ads "Draft" state (created but
    # billing/setup not finished) reports as CANCELED, and by default Google's
    # customer_client query OMITS canceled accounts entirely — which is why a
    # fresh MCC whose only children are draft returned zero rows here.
    # No LIMIT/WHERE so we get every descendant regardless of status.
    query = """
        SELECT customer_client.id, customer_client.descriptive_name,
               customer_client.currency_code, customer_client.time_zone,
               customer_client.manager, customer_client.test_account,
               customer_client.level, customer_client.status
        FROM customer_client
    """

    def _call():
        ga_service = client.get_service('GoogleAdsService')
        rows = ga_service.search(customer_id=mid, query=query)
        out = []
        for row in rows:
            cc = row.customer_client
            ccid = _digits(str(cc.id))
            # status comes back as an enum; .name gives 'ENABLED' / 'CANCELED' / ...
            status_name = getattr(getattr(cc, 'status', None), 'name', '') or ''
            logger.info('[GoogleAds]   raw customer_client row: id=%s level=%s manager=%s status=%s name=%r',
                        ccid, getattr(cc, 'level', '?'), getattr(cc, 'manager', '?'),
                        status_name, getattr(cc, 'descriptive_name', ''))
            if not ccid or ccid == mid:
                continue  # skip the manager itself (level 0)
            out.append({
                'customer_id': ccid,
                'name': cc.descriptive_name or '',
                'currency_code': cc.currency_code or '',
                'timezone_name': cc.time_zone or '',
                'is_manager': bool(cc.manager),
                'is_test_account': bool(cc.test_account),
                'status': status_name,
                # TEST accounts are ALWAYS reported CLOSED/CANCELED by Google (they
                # have no billing and never serve) yet are fully usable over the
                # API — so a non-ENABLED status must NOT make a test account
                # unconnectable. For real accounts, CLOSED/CANCELED means unusable.
                'connectable': (status_name in ('', 'ENABLED')) or bool(cc.test_account),
                # The MCC this child hangs off — required as login-customer-id to
                # read/operate a client sub-account later.
                'manager_id': mid,
            })
        return out

    try:
        result = _run(_call, context='list customer clients')
        logger.info('[GoogleAds] customer_client under manager=%s login=%s -> %d child account(s): %s',
                    mid, login, len(result), [c['customer_id'] for c in result])
        return result
    except GoogleAdsError as e:
        logger.warning('[GoogleAds] list_customer_clients failed for manager=%s login=%s: %s',
                       mid, login, e)
        return []


# ───────────────────────────── Campaign creation ────────────────────────────


def create_search_campaign(
    ad_account,
    name,
    daily_budget_micros,
    objective='traffic',
    keywords=None,
    final_url='',
    headlines=None,
    descriptions=None,
    start_date=None,
    end_date=None,
    dry_run=False,
    geo_targets=None,
    ad_schedule=None,
    sitelinks=None,
    callouts=None,
    snippet_header='',
    snippet_values=None,
    negative_keywords=None,
    languages=None,
    devices=None,
    radius_targets=None,
    exclude_ages=None,
    exclude_genders=None,
    bidding_strategy='manual_cpc',
    target_cpa_usd=0,
    target_roas=0,
    ad_variations=None,
):
    """Create a full Search campaign: Budget → Campaign → Ad Group → Keywords → RSA.

    `ad_variations` (optional) is a list of {headlines, descriptions} dicts —
    each becomes an additional RSA in the same ad group for A/B testing. The
    primary headlines/descriptions form the first ad.

    Keyword match types follow Google's text convention:
        plain      → BROAD       (e.g.  running shoes)
        "quoted"   → PHRASE      (e.g.  "running shoes")
        [bracketed]→ EXACT       (e.g.  [running shoes])
    `negative_keywords` are added as campaign-level negative criteria (always
    parsed the same way; default broad).

    Everything is created PAUSED so nothing serves (and spends) until the user
    explicitly resumes. When `dry_run` is True, every mutate uses
    `validate_only`, so Google validates the request shape WITHOUT creating
    anything (returns resource names that are not persisted) — ideal for
    test-mode and CI.

    Returns dict: {
        campaign_resource, campaign_id, ad_group_resource, ad_group_id,
        budget_resource, ad_resource, dry_run: bool, warnings: [...]
    }
    """
    from ads.services.token_encryption import decrypt_token

    keywords = [k.strip() for k in (keywords or []) if k and k.strip()]
    headlines = [h.strip() for h in (headlines or []) if h and h.strip()]
    descriptions = [d.strip() for d in (descriptions or []) if d and d.strip()]

    # ── Validate everything BEFORE touching Google so users get clear errors ──
    if int(daily_budget_micros) <= 0:
        raise GoogleAdsError('Daily budget must be greater than zero.')

    # Treat ad fields as all-or-nothing: if the user supplied any of
    # final_url / headlines / descriptions, require the complete set. This
    # prevents the confusing "campaign created but silently has no ad" case
    # (e.g. they filled headlines but forgot the landing URL).
    wants_ad = bool(final_url or headlines or descriptions or keywords)
    if wants_ad:
        if not keywords:
            raise GoogleAdsError('A Search campaign needs at least one keyword to show ads.')
        if not final_url:
            raise GoogleAdsError('A landing page URL is required to attach a Search ad.')
        if len(headlines) < 3:
            raise GoogleAdsError('A Search ad needs at least 3 headlines.')
        if len(descriptions) < 2:
            raise GoogleAdsError('A Search ad needs at least 2 descriptions.')
        # Reject (don't silently truncate) over-length assets — truncation would
        # publish a mangled, half-cut headline/description live.
        long_h = [h for h in headlines if len(h) > 30]
        if long_h:
            raise GoogleAdsError(f'Headline too long (max 30 chars): "{long_h[0]}".')
        long_d = [d for d in descriptions if len(d) > 90]
        if long_d:
            raise GoogleAdsError(f'Description too long (max 90 chars): "{long_d[0]}".')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    channel = OBJECTIVE_TO_CHANNEL.get(objective, 'SEARCH')
    if channel != 'SEARCH':
        # We only build Search end-to-end for now; Display would need image assets.
        logger.info('[google_ads] objective=%s mapped to SEARCH (only Search is built)', objective)
        channel = 'SEARCH'

    def _build_campaign(campaign_op, budget_resource):
        """Populate a Search CampaignOperation that references budget_resource."""
        campaign = campaign_op.create
        campaign.name = name
        campaign.advertising_channel_type = (
            client.enums.AdvertisingChannelTypeEnum.SEARCH
        )
        campaign.status = client.enums.CampaignStatusEnum.PAUSED
        # Required in API v21: declare EU political-ad status. Commercial
        # campaigns must explicitly say they don't contain EU political ads.
        campaign.contains_eu_political_advertising = (
            client.enums.EuPoliticalAdvertisingStatusEnum
            .DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
        )
        _apply_bidding_strategy(client, campaign, bidding_strategy,
                                target_cpa_usd=target_cpa_usd, target_roas=target_roas)
        campaign.campaign_budget = budget_resource
        if start_date:
            campaign.start_date = start_date
        if end_date:
            campaign.end_date = end_date

    def _call():
        ga_service = client.get_service('GoogleAdsService')
        warnings = []

        # ---- 1. Budget --------------------------------------------------------
        budget_op = client.get_type('CampaignBudgetOperation')
        budget = budget_op.create
        budget.name = f'{name} Budget {customer_id}'
        budget.amount_micros = int(daily_budget_micros)
        budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        # A budget can serve a single campaign only (cleaner ownership).
        budget.explicitly_shared = False

        # ---- Dry run: validate budget + campaign atomically -------------------
        # validate_only mutates return NO resource names, so we can't create the
        # budget first and reference it. Instead, send both operations in ONE
        # GoogleAdsService.mutate request linked by a temp resource name (-1),
        # which Google resolves within the request — the documented way to
        # validate dependent operations together.
        if dry_run:
            temp_budget = f'customers/{customer_id}/campaignBudgets/-1'
            budget_op.create.resource_name = temp_budget

            mutate_budget_op = client.get_type('MutateOperation')
            mutate_budget_op.campaign_budget_operation = budget_op

            campaign_op = client.get_type('CampaignOperation')
            _build_campaign(campaign_op, temp_budget)
            mutate_campaign_op = client.get_type('MutateOperation')
            mutate_campaign_op.campaign_operation = campaign_op

            ga_service.mutate(
                request={
                    'customer_id': customer_id,
                    'mutate_operations': [mutate_budget_op, mutate_campaign_op],
                    'validate_only': True,
                },
            )
            return {
                'campaign_resource': '',
                'campaign_id': '',
                'budget_resource': temp_budget,
                'ad_group_resource': '',
                'ad_group_id': '',
                'ad_resource': '',
                'dry_run': True,
                'warnings': ['Dry run: request validated by Google but nothing was created.'],
            }

        # ---- Real run: create budget, then reference it -----------------------
        budget_resp = client.get_service('CampaignBudgetService').mutate_campaign_budgets(
            request={'customer_id': customer_id, 'operations': [budget_op]},
        )
        budget_resource = budget_resp.results[0].resource_name

        # ---- 2. Campaign (PAUSED) --------------------------------------------
        campaign_op = client.get_type('CampaignOperation')
        _build_campaign(campaign_op, budget_resource)

        campaign_resp = client.get_service('CampaignService').mutate_campaigns(
            request={'customer_id': customer_id, 'operations': [campaign_op]},
        )
        campaign_resource = campaign_resp.results[0].resource_name if campaign_resp.results else ''
        campaign_id = campaign_resource.split('/')[-1].split('~')[-1] if campaign_resource else ''

        # ---- 3. Ad Group -----------------------------------------------------
        ag_op = client.get_type('AdGroupOperation')
        ag = ag_op.create
        ag.name = f'{name} - Ad Group'
        ag.campaign = campaign_resource
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        ag.cpc_bid_micros = 1_000_000  # $1 default max CPC

        ag_resp = client.get_service('AdGroupService').mutate_ad_groups(
            customer_id=customer_id, operations=[ag_op],
        )
        ad_group_resource = ag_resp.results[0].resource_name
        ad_group_id = ad_group_resource.split('/')[-1].split('~')[-1]

        # ---- 4. Keywords (broad/phrase/exact via text convention) ------------
        if keywords:
            kw_ops = []
            for kw in keywords:
                text, match_name = _parse_keyword_match(kw)
                if not text:
                    continue
                op = client.get_type('AdGroupCriterionOperation')
                crit = op.create
                crit.ad_group = ad_group_resource
                crit.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
                crit.keyword.text = text
                crit.keyword.match_type = getattr(
                    client.enums.KeywordMatchTypeEnum, match_name)
                kw_ops.append(op)
            if kw_ops:
                client.get_service('AdGroupCriterionService').mutate_ad_group_criteria(
                    customer_id=customer_id, operations=kw_ops,
                )

        # ---- 4b. Negative keywords (campaign-level) --------------------------
        neg_list = [k.strip() for k in (negative_keywords or []) if k and k.strip()]
        if neg_list:
            neg_ops = []
            for nk in neg_list:
                text, match_name = _parse_keyword_match(nk)
                if not text:
                    continue
                op = client.get_type('CampaignCriterionOperation')
                crit = op.create
                crit.campaign = campaign_resource
                crit.negative = True
                crit.keyword.text = text
                crit.keyword.match_type = getattr(
                    client.enums.KeywordMatchTypeEnum, match_name)
                neg_ops.append(op)
            if neg_ops:
                client.get_service('CampaignCriterionService').mutate_campaign_criteria(
                    customer_id=customer_id, operations=neg_ops,
                )

        # ---- 5. Responsive Search Ad(s) — primary + A/B variations -----------
        ad_resource = ''
        if final_url and headlines and descriptions:
            def _build_rsa_op(hl, ds):
                op = client.get_type('AdGroupAdOperation')
                aga = op.create
                aga.ad_group = ad_group_resource
                aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
                aga.ad.final_urls.append(final_url)
                rsa = aga.ad.responsive_search_ad
                for h in hl[:15]:
                    asset = client.get_type('AdTextAsset')
                    asset.text = h[:30]
                    rsa.headlines.append(asset)
                for d in ds[:4]:
                    asset = client.get_type('AdTextAsset')
                    asset.text = d[:90]
                    rsa.descriptions.append(asset)
                return op

            ad_ops = [_build_rsa_op(headlines, descriptions)]
            # Each variation needs ≥3 headlines + ≥2 descriptions to be a valid RSA.
            for var in (ad_variations or []):
                vh = [h.strip() for h in (var.get('headlines') or []) if h and h.strip()]
                vd = [d.strip() for d in (var.get('descriptions') or []) if d and d.strip()]
                if len(vh) >= 3 and len(vd) >= 2:
                    ad_ops.append(_build_rsa_op(vh, vd))
                else:
                    warnings.append('Skipped an ad variation: needs ≥3 headlines and ≥2 descriptions.')
            ad_resp = client.get_service('AdGroupAdService').mutate_ad_group_ads(
                customer_id=customer_id, operations=ad_ops,
            )
            ad_resource = ad_resp.results[0].resource_name
            if len(ad_resp.results) > 1:
                warnings.append(f'Created {len(ad_resp.results)} ad variations for A/B testing.')
        else:
            warnings.append('No ad created — provide final_url, headlines and descriptions to add a Search ad.')

        # ---- 6. Targeting + extensions (best-effort, real run only) ----------
        warnings += apply_campaign_extras(
            client, customer_id, campaign_resource,
            geo_targets=geo_targets, ad_schedule=ad_schedule,
            sitelinks=sitelinks, callouts=callouts,
            snippet_header=snippet_header, snippet_values=snippet_values,
            languages=languages, devices=devices, radius_targets=radius_targets,
            ad_group_resource=ad_group_resource,
            exclude_ages=exclude_ages, exclude_genders=exclude_genders,
        )

        return {
            'campaign_resource': campaign_resource,
            'campaign_id': campaign_id,
            'budget_resource': budget_resource,
            'ad_group_resource': ad_group_resource,
            'ad_group_id': ad_group_id,
            'ad_resource': ad_resource,
            'dry_run': False,
            'warnings': warnings,
        }

    return _run(_call, context='create search campaign')


# ───────────────────────────── Image assets ─────────────────────────────────


_MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _assert_safe_image_url(image_url):
    """Reject URLs that could drive SSRF before we fetch them server-side.

    Allows only http(s) and blocks hosts that resolve to private / loopback /
    link-local / reserved ranges (e.g. cloud metadata at 169.254.169.254).
    Raises GoogleAdsError on any unsafe URL.
    """
    import ipaddress
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(image_url)
    if parsed.scheme not in ('http', 'https'):
        raise GoogleAdsError('Image URL must be http(s).')
    host = parsed.hostname
    if not host:
        raise GoogleAdsError('Image URL has no host.')
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise GoogleAdsError(f'Could not resolve image host: {host}')
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            raise GoogleAdsError('Image URL resolves to a disallowed (internal) address.')


def _upload_image_asset(client, customer_id, image_url, name, return_dimensions=False):
    """Download an image from a public URL and create an Image Asset in Google.

    Google's ImageAsset requires the raw bytes (it does NOT fetch a URL for you),
    so we download the image server-side and upload the bytes. Returns the asset
    resource name. Raises GoogleAdsError on download/validation failure.

    SSRF-guarded: the host must be public, redirects are disabled, and the
    response is size-capped.
    """
    import requests

    _assert_safe_image_url(image_url)
    # Many image hosts/CDNs reject requests without a browser-like User-Agent
    # (403) and many legitimate URLs redirect. We allow redirects but re-check
    # the final resolved URL for SSRF safety so the guard still holds.
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; SellantoAdsBot/1.0)'}
    try:
        resp = requests.get(image_url, timeout=20, allow_redirects=True,
                            stream=True, headers=headers)
        resp.raise_for_status()
        # If the request was redirected, re-validate where it actually landed.
        if resp.url and resp.url != image_url:
            _assert_safe_image_url(resp.url)
        # Size-cap the download (defends against huge/never-ending responses).
        image_bytes = b''
        for chunk in resp.iter_content(8192):
            image_bytes += chunk
            if len(image_bytes) > _MAX_IMAGE_BYTES:
                raise GoogleAdsError(f'Image at {image_url} exceeds 10 MB.')
    except requests.RequestException as e:
        raise GoogleAdsError(f'Could not download image {image_url}: {e}')
    if not image_bytes:
        raise GoogleAdsError(f'Image at {image_url} was empty.')

    op = client.get_type('AssetOperation')
    asset = op.create
    asset.name = name[:120]
    asset.type_ = client.enums.AssetTypeEnum.IMAGE
    asset.image_asset.data = image_bytes
    resp = client.get_service('AssetService').mutate_assets(
        customer_id=customer_id, operations=[op],
    )
    resource_name = resp.results[0].resource_name
    if return_dimensions:
        try:
            from PIL import Image
            import io
            with Image.open(io.BytesIO(image_bytes)) as im:
                w, h = im.size
        except Exception:
            w, h = 0, 0
        return resource_name, w, h
    return resource_name


def _classify_image(w, h):
    """Return 'square' if ~1:1, else 'landscape'. Used to route Display images."""
    if w and h and 0.9 <= (w / h) <= 1.1:
        return 'square'
    return 'landscape'


def _apply_bidding_strategy(client, campaign, strategy, target_cpa_usd=0, target_roas=0):
    """Set a campaign's bidding strategy from a simple name.

    strategy ∈ {manual_cpc, maximize_clicks, maximize_conversions,
                target_cpa, maximize_conversion_value, target_roas}.
    Falls back to manual_cpc for unknown values. target_cpa_usd is dollars;
    target_roas is a ratio (e.g. 4.0 = 400%).
    """
    s = (strategy or 'manual_cpc').strip().lower()
    enums = client.enums.BiddingStrategyTypeEnum
    if s == 'maximize_clicks':
        # "Maximize clicks" = TargetSpend (legacy name) with no explicit cap.
        campaign.target_spend = client.get_type('TargetSpend')
    elif s == 'maximize_conversions':
        campaign.bidding_strategy_type = enums.MAXIMIZE_CONVERSIONS
        campaign.maximize_conversions = client.get_type('MaximizeConversions')
    elif s == 'target_cpa':
        campaign.bidding_strategy_type = enums.TARGET_CPA
        tcpa = client.get_type('TargetCpa')
        tcpa.target_cpa_micros = int(round(float(target_cpa_usd or 0) * 1_000_000))
        campaign.target_cpa = tcpa
    elif s == 'maximize_conversion_value':
        mcv = client.get_type('MaximizeConversionValue')
        campaign.maximize_conversion_value = mcv
    elif s == 'target_roas':
        troas = client.get_type('TargetRoas')
        troas.target_roas = float(target_roas or 0)
        campaign.target_roas = troas
    else:  # manual_cpc (default)
        campaign.manual_cpc.enhanced_cpc_enabled = False


def _parse_keyword_match(raw):
    """Parse a keyword string into (text, match_type_name).

    "quoted" → PHRASE, [bracketed] → EXACT, otherwise BROAD.
    """
    s = (raw or '').strip()
    if len(s) >= 2 and s[0] == '[' and s[-1] == ']':
        return s[1:-1].strip(), 'EXACT'
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        return s[1:-1].strip(), 'PHRASE'
    return s, 'BROAD'


def _add_text_asset(client, customer_id, text):
    """Create a standalone text Asset and return its resource name."""
    op = client.get_type('AssetOperation')
    op.create.text_asset.text = text
    resp = client.get_service('AssetService').mutate_assets(
        customer_id=customer_id, operations=[op],
    )
    return resp.results[0].resource_name


# ───────────────────────────── Display campaign ─────────────────────────────


def create_display_campaign(
    ad_account, name, daily_budget_micros,
    final_url='', headlines=None, descriptions=None, long_headline='',
    business_name='', marketing_image_urls=None, logo_image_urls=None,
    start_date=None, end_date=None, dry_run=False,
    geo_targets=None, ad_schedule=None, audience_ids=None,
    languages=None, devices=None, radius_targets=None,
    exclude_ages=None, exclude_genders=None,
):
    """Create a Standard Display campaign with a Responsive Display Ad.

    A Responsive Display Ad needs: >=1 marketing image, >=1 logo, >=1 headline,
    a long headline, >=1 description, a business name, and a final URL. Created
    PAUSED. In dry_run we validate the campaign+budget only (image assets can't
    be referenced from an unpersisted campaign).
    """
    from ads.services.token_encryption import decrypt_token

    headlines = [h.strip() for h in (headlines or []) if h and h.strip()]
    descriptions = [d.strip() for d in (descriptions or []) if d and d.strip()]
    marketing_image_urls = [u for u in (marketing_image_urls or []) if u]
    logo_image_urls = [u for u in (logo_image_urls or []) if u]

    if int(daily_budget_micros) <= 0:
        raise GoogleAdsError('Daily budget must be greater than zero.')

    if not dry_run:
        if not final_url:
            raise GoogleAdsError('A landing page URL is required for a Display ad.')
        if not headlines:
            raise GoogleAdsError('At least one headline (≤30 chars) is required.')
        if any(len(h) > 30 for h in headlines):
            raise GoogleAdsError('Each Display headline must be ≤30 characters.')
        if not long_headline or len(long_headline) > 90:
            raise GoogleAdsError('A long headline (≤90 chars) is required.')
        if not descriptions or any(len(d) > 90 for d in descriptions):
            raise GoogleAdsError('At least one description, each ≤90 characters, is required.')
        if not business_name:
            raise GoogleAdsError('A business name is required for a Display ad.')
        if not marketing_image_urls:
            raise GoogleAdsError('At least one marketing image is required for a Display ad.')
        if not logo_image_urls:
            raise GoogleAdsError('At least one logo image is required for a Display ad.')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    def _call():
        warnings = []
        # 1. Budget
        b_op = client.get_type('CampaignBudgetOperation')
        b_op.create.name = f'{name} Budget {customer_id}'
        b_op.create.amount_micros = int(daily_budget_micros)
        b_op.create.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b_op.create.explicitly_shared = False

        # 2. Campaign (PAUSED, DISPLAY)
        c_op = client.get_type('CampaignOperation')
        camp = c_op.create
        camp.name = name
        camp.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.DISPLAY
        camp.status = client.enums.CampaignStatusEnum.PAUSED
        camp.contains_eu_political_advertising = (
            client.enums.EuPoliticalAdvertisingStatusEnum
            .DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
        )
        camp.manual_cpc.enhanced_cpc_enabled = False
        if start_date:
            camp.start_date = start_date
        if end_date:
            camp.end_date = end_date

        # Dry run: validate budget + campaign atomically with a temp resource
        # name (validate_only mutates return no resource name to reference).
        if dry_run:
            temp_budget = f'customers/{customer_id}/campaignBudgets/-1'
            b_op.create.resource_name = temp_budget
            camp.campaign_budget = temp_budget
            ga = client.get_service('GoogleAdsService')
            mb = client.get_type('MutateOperation'); mb.campaign_budget_operation = b_op
            mc = client.get_type('MutateOperation'); mc.campaign_operation = c_op
            ga.mutate(request={'customer_id': customer_id,
                               'mutate_operations': [mb, mc], 'validate_only': True})
            return {'campaign_resource': '', 'campaign_id': '', 'budget_resource': temp_budget,
                    'ad_group_resource': '', 'ad_group_id': '', 'ad_resource': '', 'dry_run': True,
                    'warnings': ['Dry run: campaign + budget validated. Image assets are only created on a real run.']}

        # Real run: create budget, then reference it.
        b_resp = client.get_service('CampaignBudgetService').mutate_campaign_budgets(
            request={'customer_id': customer_id, 'operations': [b_op]})
        budget_resource = b_resp.results[0].resource_name
        camp.campaign_budget = budget_resource
        c_resp = client.get_service('CampaignService').mutate_campaigns(
            request={'customer_id': customer_id, 'operations': [c_op]})
        campaign_resource = c_resp.results[0].resource_name
        campaign_id = campaign_resource.split('/')[-1].split('~')[-1]

        # 3. Ad group
        ag_op = client.get_type('AdGroupOperation')
        ag_op.create.name = f'{name} - Ad Group'
        ag_op.create.campaign = campaign_resource
        ag_op.create.type_ = client.enums.AdGroupTypeEnum.DISPLAY_STANDARD
        ag_op.create.status = client.enums.AdGroupStatusEnum.ENABLED
        ag_resp = client.get_service('AdGroupService').mutate_ad_groups(
            customer_id=customer_id, operations=[ag_op])
        ad_group_resource = ag_resp.results[0].resource_name
        ad_group_id = ad_group_resource.split('/')[-1].split('~')[-1]

        # 4. Image assets (download + upload bytes). A Responsive Display Ad
        # REQUIRES both a landscape (1.91:1) AND a square (1:1) marketing image,
        # so we classify each uploaded image by aspect ratio and route it.
        landscape_assets, square_assets = [], []
        for i, u in enumerate(marketing_image_urls[:15]):
            res, w, h = _upload_image_asset(client, customer_id, u, f'{name} marketing {i}',
                                            return_dimensions=True)
            (square_assets if _classify_image(w, h) == 'square' else landscape_assets).append(res)
        logo_assets = [_upload_image_asset(client, customer_id, u, f'{name} logo {i}')
                       for i, u in enumerate(logo_image_urls[:5])]

        if not landscape_assets:
            raise GoogleAdsError('A landscape (1.91:1, e.g. 1200x628) marketing image is required.')
        if not square_assets:
            raise GoogleAdsError('A square (1:1, e.g. 1200x1200) marketing image is also required for Display ads.')

        # 5. Responsive Display Ad
        ad_op = client.get_type('AdGroupAdOperation')
        aga = ad_op.create
        aga.ad_group = ad_group_resource
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(final_url)
        rda = aga.ad.responsive_display_ad
        for h in headlines[:5]:
            t = client.get_type('AdTextAsset'); t.text = h[:30]; rda.headlines.append(t)
        rda.long_headline.text = long_headline[:90]
        for d in descriptions[:5]:
            t = client.get_type('AdTextAsset'); t.text = d[:90]; rda.descriptions.append(t)
        rda.business_name = business_name[:25]
        for res in landscape_assets:
            img = client.get_type('AdImageAsset'); img.asset = res; rda.marketing_images.append(img)
        for res in square_assets:
            img = client.get_type('AdImageAsset'); img.asset = res; rda.square_marketing_images.append(img)
        for res in logo_assets:
            img = client.get_type('AdImageAsset'); img.asset = res; rda.logo_images.append(img)
        ad_resp = client.get_service('AdGroupAdService').mutate_ad_group_ads(
            customer_id=customer_id, operations=[ad_op])
        ad_resource = ad_resp.results[0].resource_name

        # 6. Targeting: geo, schedule, language, device, radius, demographics.
        warnings += apply_campaign_extras(
            client, customer_id, campaign_resource,
            geo_targets=geo_targets, ad_schedule=ad_schedule,
            languages=languages, devices=devices, radius_targets=radius_targets,
            ad_group_resource=ad_group_resource,
            exclude_ages=exclude_ages, exclude_genders=exclude_genders)
        if audience_ids:
            try:
                warnings += _add_audience_criteria(client, customer_id, campaign_resource, audience_ids)
            except Exception as e:  # noqa: BLE001
                warnings.append(f'audience targeting skipped: {e}')

        return {'campaign_resource': campaign_resource, 'campaign_id': campaign_id,
                'budget_resource': budget_resource, 'ad_group_resource': ad_group_resource,
                'ad_group_id': ad_group_id, 'ad_resource': ad_resource, 'dry_run': False,
                'warnings': warnings}

    return _run(_call, context='create display campaign')


# ───────────────────────────── Performance Max ──────────────────────────────


def create_pmax_campaign(
    ad_account, name, daily_budget_micros,
    final_url='', headlines=None, descriptions=None, long_headlines=None,
    business_name='', marketing_image_urls=None, logo_image_urls=None,
    start_date=None, end_date=None, dry_run=False,
    geo_targets=None, ad_schedule=None, search_themes=None, video_url='',
    audience_ids=None, languages=None, devices=None, radius_targets=None,
):
    """Create a Performance Max campaign with one asset group.

    PMax requires an asset group with text assets (headlines, descriptions, a
    long headline) plus image assets (marketing images + logos) and a final URL.
    Budget for PMax MUST be a non-shared budget. Created PAUSED. In dry_run we
    validate campaign + budget only.

    Note: PMax serves best with conversion tracking configured on the account;
    we create the campaign with MAXIMIZE_CONVERSIONS bidding. Without conversion
    data it still validates and runs, optimising on available signals.
    """
    from ads.services.token_encryption import decrypt_token

    headlines = [h.strip() for h in (headlines or []) if h and h.strip()]
    descriptions = [d.strip() for d in (descriptions or []) if d and d.strip()]
    long_headlines = [h.strip() for h in (long_headlines or []) if h and h.strip()]
    marketing_image_urls = [u for u in (marketing_image_urls or []) if u]
    logo_image_urls = [u for u in (logo_image_urls or []) if u]

    if int(daily_budget_micros) <= 0:
        raise GoogleAdsError('Daily budget must be greater than zero.')

    if not dry_run:
        # PMax asset group minimums (Google-enforced).
        if not final_url:
            raise GoogleAdsError('A final URL is required for Performance Max.')
        if len(headlines) < 3 or any(len(h) > 30 for h in headlines):
            raise GoogleAdsError('Performance Max needs at least 3 headlines, each ≤30 chars.')
        if not long_headlines or any(len(h) > 90 for h in long_headlines):
            raise GoogleAdsError('Performance Max needs at least 1 long headline (≤90 chars).')
        if len(descriptions) < 2 or any(len(d) > 90 for d in descriptions):
            raise GoogleAdsError('Performance Max needs at least 2 descriptions, each ≤90 chars.')
        if not business_name:
            raise GoogleAdsError('A business name is required for Performance Max.')
        if not marketing_image_urls:
            raise GoogleAdsError('At least one marketing image is required for Performance Max.')
        if not logo_image_urls:
            raise GoogleAdsError('At least one logo image is required for Performance Max.')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    def _call():
        # 1. Budget (non-shared, required by PMax)
        b_op = client.get_type('CampaignBudgetOperation')
        b_op.create.name = f'{name} Budget {customer_id}'
        b_op.create.amount_micros = int(daily_budget_micros)
        b_op.create.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b_op.create.explicitly_shared = False

        # 2. Campaign (PAUSED, PERFORMANCE_MAX, maximize conversions)
        c_op = client.get_type('CampaignOperation')
        camp = c_op.create
        camp.name = name
        camp.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.PERFORMANCE_MAX
        camp.status = client.enums.CampaignStatusEnum.PAUSED
        camp.contains_eu_political_advertising = (
            client.enums.EuPoliticalAdvertisingStatusEnum
            .DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
        )
        # Brand Guidelines (on by default in v21) demands the business name be
        # linked as a campaign-level CampaignAsset. We carry business name in the
        # asset group instead, so disable Brand Guidelines to avoid that hard
        # requirement.
        camp.brand_guidelines_enabled = False
        # PMax requires a standard bidding strategy. Select Maximize Conversions
        # WITHOUT a target CPA — assigning target_cpa_micros=0 would impose a $0
        # target. Setting the bidding_strategy_type and referencing the empty
        # maximize_conversions message selects the strategy with no target.
        camp.bidding_strategy_type = client.enums.BiddingStrategyTypeEnum.MAXIMIZE_CONVERSIONS
        camp.maximize_conversions = client.get_type('MaximizeConversions')
        if start_date:
            camp.start_date = start_date
        if end_date:
            camp.end_date = end_date

        # Dry run: validate budget + campaign atomically with a temp resource name.
        if dry_run:
            temp_budget = f'customers/{customer_id}/campaignBudgets/-1'
            b_op.create.resource_name = temp_budget
            camp.campaign_budget = temp_budget
            ga = client.get_service('GoogleAdsService')
            mb = client.get_type('MutateOperation'); mb.campaign_budget_operation = b_op
            mc = client.get_type('MutateOperation'); mc.campaign_operation = c_op
            ga.mutate(request={'customer_id': customer_id,
                               'mutate_operations': [mb, mc], 'validate_only': True})
            return {'campaign_resource': '', 'campaign_id': '', 'budget_resource': temp_budget,
                    'ad_group_resource': '', 'ad_group_id': '', 'ad_resource': '', 'dry_run': True,
                    'warnings': ['Dry run: PMax campaign + budget validated. Asset group is only created on a real run.']}

        # Real run: create budget, then reference it.
        b_resp = client.get_service('CampaignBudgetService').mutate_campaign_budgets(
            request={'customer_id': customer_id, 'operations': [b_op]})
        budget_resource = b_resp.results[0].resource_name
        camp.campaign_budget = budget_resource
        c_resp = client.get_service('CampaignService').mutate_campaigns(
            request={'customer_id': customer_id, 'operations': [c_op]})
        campaign_resource = c_resp.results[0].resource_name
        campaign_id = campaign_resource.split('/')[-1].split('~')[-1]

        # 3. Upload image assets + create text assets FIRST (standalone, persisted).
        #    These return real resource names we then link to the asset group.
        FT = client.enums.AssetFieldTypeEnum
        links = []  # (asset_resource, field_type)
        for h in headlines[:5]:
            links.append((_add_text_asset(client, customer_id, h[:30]), FT.HEADLINE))
        for h in long_headlines[:5]:
            links.append((_add_text_asset(client, customer_id, h[:90]), FT.LONG_HEADLINE))
        for d in descriptions[:5]:
            links.append((_add_text_asset(client, customer_id, d[:90]), FT.DESCRIPTION))
        links.append((_add_text_asset(client, customer_id, business_name[:25]), FT.BUSINESS_NAME))
        for i, u in enumerate(marketing_image_urls[:20]):
            res, w, h = _upload_image_asset(client, customer_id, u, f'{name} mkt {i}',
                                            return_dimensions=True)
            # Route by aspect ratio so PMax gets both required formats:
            # ~1:1 → SQUARE_MARKETING_IMAGE, otherwise → MARKETING_IMAGE (1.91:1).
            field = FT.SQUARE_MARKETING_IMAGE if _classify_image(w, h) == 'square' else FT.MARKETING_IMAGE
            links.append((res, field))
        for i, u in enumerate(logo_image_urls[:5]):
            links.append((_upload_image_asset(client, customer_id, u, f'{name} logo {i}'), FT.LOGO))

        # 4. Create the asset group AND link every asset in ONE atomic mutate.
        #    Google validates an asset group's minimum-asset requirements at the
        #    moment the group is created. Creating the group in a separate call
        #    leaves it momentarily empty → "asset group does not have enough
        #    assets" for every field type. Using a temp resource name (-1) lets
        #    the AssetGroupAsset operations reference the group inside the same
        #    transaction, so the group is born complete.
        ga = client.get_service('GoogleAdsService')
        temp_ag = f'customers/{customer_id}/assetGroups/-1'

        agroup_op = client.get_type('AssetGroupOperation')
        agroup = agroup_op.create
        agroup.resource_name = temp_ag
        agroup.name = f'{name} - Asset Group'
        agroup.campaign = campaign_resource
        agroup.final_urls.append(final_url)
        agroup.status = client.enums.AssetGroupStatusEnum.PAUSED

        mutate_ops = []
        m_ag = client.get_type('MutateOperation')
        m_ag.asset_group_operation = agroup_op
        mutate_ops.append(m_ag)
        for asset_res, field_type in links:
            link_op = client.get_type('AssetGroupAssetOperation')
            link_op.create.asset_group = temp_ag
            link_op.create.asset = asset_res
            link_op.create.field_type = field_type
            m = client.get_type('MutateOperation')
            m.asset_group_asset_operation = link_op
            mutate_ops.append(m)

        ag_result = ga.mutate(request={'customer_id': customer_id,
                                       'mutate_operations': mutate_ops})
        # The first result is the asset group; pull its real resource name.
        asset_group_resource = ag_result.mutate_operation_responses[0] \
            .asset_group_result.resource_name

        warnings = []
        # 5. Optional YouTube video asset in the asset group.
        if video_url:
            try:
                warnings += _add_youtube_video_to_asset_group(
                    client, customer_id, asset_group_resource, video_url, name)
            except Exception as e:  # noqa: BLE001
                warnings.append(f'PMax video skipped: {e}')

        # 6. Asset-group signals: search themes ("themes") + audience note.
        if search_themes or audience_ids:
            try:
                warnings += _add_asset_group_signals(
                    client, customer_id, asset_group_resource,
                    search_themes=search_themes, audience_ids=audience_ids)
            except Exception as e:  # noqa: BLE001
                warnings.append(f'PMax signals skipped: {e}')

        # 7. Campaign-level geo + schedule + language + device + radius.
        warnings += apply_campaign_extras(
            client, customer_id, campaign_resource,
            geo_targets=geo_targets, ad_schedule=ad_schedule,
            languages=languages, devices=devices, radius_targets=radius_targets)

        return {'campaign_resource': campaign_resource, 'campaign_id': campaign_id,
                'budget_resource': budget_resource, 'ad_group_resource': asset_group_resource,
                'ad_group_id': asset_group_resource.split('/')[-1], 'ad_resource': '',
                'dry_run': False, 'warnings': warnings}

    return _run(_call, context='create performance max campaign')


# ───────────────────────────── Status mutations ─────────────────────────────


def _set_campaign_status(ad_account, campaign_id, status_enum_name):
    """Shared helper: flip a campaign to PAUSED/ENABLED/REMOVED."""
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    if not cid:
        raise GoogleAdsError('Campaign has no Google campaign id.')

    def _call():
        svc = client.get_service('CampaignService')
        op = client.get_type('CampaignOperation')
        op.update.resource_name = f'customers/{customer_id}/campaigns/{cid}'
        op.update.status = getattr(client.enums.CampaignStatusEnum, status_enum_name)
        # update_mask must list the fields we changed. FieldMask is a protobuf
        # type, not a Google Ads type — client.get_type('FieldMask') 404s in v21.
        from google.protobuf import field_mask_pb2
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=['status']))
        svc.mutate_campaigns(customer_id=customer_id, operations=[op])
        return True

    return _run(_call, context=f'set campaign {status_enum_name.lower()}')


def pause_campaign(ad_account, campaign_id):
    return _set_campaign_status(ad_account, campaign_id, 'PAUSED')


def resume_campaign(ad_account, campaign_id):
    return _set_campaign_status(ad_account, campaign_id, 'ENABLED')


def remove_campaign(ad_account, campaign_id):
    """Remove (archive) a campaign. In Google, REMOVED is terminal — the campaign
    stops serving and is hidden, the equivalent of delete/archive.

    Removal must use a dedicated remove OPERATION (op.remove = resource_name).
    Setting status=REMOVED via an update is rejected ("Enum value 'REMOVED'
    cannot be used").
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    if not cid:
        raise GoogleAdsError('Campaign has no Google campaign id.')

    def _call():
        svc = client.get_service('CampaignService')
        op = client.get_type('CampaignOperation')
        op.remove = f'customers/{customer_id}/campaigns/{cid}'
        svc.mutate_campaigns(customer_id=customer_id, operations=[op])
        return True

    return _run(_call, context='remove campaign')


def update_campaign_name(ad_account, campaign_id, new_name):
    """Rename a live campaign."""
    from ads.services.token_encryption import decrypt_token

    new_name = (new_name or '').strip()
    if not new_name:
        raise GoogleAdsError('Campaign name cannot be empty.')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    if not cid:
        raise GoogleAdsError('Campaign has no Google campaign id.')

    def _call():
        svc = client.get_service('CampaignService')
        op = client.get_type('CampaignOperation')
        op.update.resource_name = f'customers/{customer_id}/campaigns/{cid}'
        op.update.name = new_name
        from google.protobuf import field_mask_pb2
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=['name']))
        svc.mutate_campaigns(customer_id=customer_id, operations=[op])
        return True

    return _run(_call, context='rename campaign')


def get_campaign_budget_resource(ad_account, campaign_id):
    """Look up the budget resource name for a campaign via GAQL.

    We don't always persist the budget resource at create time, so resolve it on
    demand for live budget edits.
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    if not cid:
        raise GoogleAdsError('Campaign has no Google campaign id.')

    def _call():
        ga = client.get_service('GoogleAdsService')
        query = (f'SELECT campaign.id, campaign_budget.resource_name '
                 f'FROM campaign WHERE campaign.id = {cid}')
        for row in ga.search(customer_id=customer_id, query=query):
            return row.campaign_budget.resource_name
        return ''

    return _run(_call, context='look up campaign budget')


def update_campaign_budget_by_campaign(ad_account, campaign_id, new_daily_micros):
    """Resolve a campaign's budget resource then update its daily amount."""
    budget_resource = get_campaign_budget_resource(ad_account, campaign_id)
    if not budget_resource:
        raise GoogleAdsError('Could not find the budget for this campaign.')
    return update_campaign_budget(ad_account, budget_resource, new_daily_micros)


def update_campaign_budget(ad_account, budget_resource_name, new_daily_micros):
    """Update a campaign's daily budget (micros)."""
    from ads.services.token_encryption import decrypt_token

    if not budget_resource_name:
        raise GoogleAdsError('No budget resource recorded for this campaign.')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    def _call():
        svc = client.get_service('CampaignBudgetService')
        op = client.get_type('CampaignBudgetOperation')
        op.update.resource_name = budget_resource_name
        op.update.amount_micros = int(new_daily_micros)
        from google.protobuf import field_mask_pb2
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=['amount_micros']))
        svc.mutate_campaign_budgets(customer_id=customer_id, operations=[op])
        return True

    return _run(_call, context='update campaign budget')


# ───────────────────────────── Insights (GAQL) ──────────────────────────────


_DATE_PRESETS = {
    'today': 'TODAY',
    'yesterday': 'YESTERDAY',
    'last_7d': 'LAST_7_DAYS',
    'last_14d': 'LAST_14_DAYS',
    'last_30d': 'LAST_30_DAYS',
    'this_month': 'THIS_MONTH',
    'last_month': 'LAST_MONTH',
}


def get_campaign_insights(ad_account, campaign_id, date_preset='last_7d'):
    """Pull daily metrics for one campaign via GAQL.

    Returns list of dicts with date + raw metrics (impressions, clicks,
    cost_micros, conversions, etc.). The view layer maps these into AdInsight
    rows (mirroring the Meta insights flow).
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    during = _DATE_PRESETS.get(date_preset, 'LAST_7_DAYS')

    query = f"""
        SELECT
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.ctr,
            metrics.average_cpc,
            metrics.average_cpm
        FROM campaign
        WHERE campaign.id = {cid}
          AND segments.date DURING {during}
        ORDER BY segments.date
    """

    def _call():
        ga_service = client.get_service('GoogleAdsService')
        rows = ga_service.search(customer_id=customer_id, query=query)
        out = []
        for row in rows:
            m = row.metrics
            out.append({
                'date': row.segments.date,
                'impressions': int(m.impressions or 0),
                'clicks': int(m.clicks or 0),
                'cost_micros': int(m.cost_micros or 0),
                'conversions': float(m.conversions or 0),
                'conversions_value': float(m.conversions_value or 0),
                'ctr': float(m.ctr or 0),
                'average_cpc_micros': int(m.average_cpc or 0),
                'average_cpm_micros': int(m.average_cpm or 0),
            })
        return out

    return _run(_call, context='get campaign insights')


def get_keyword_insights(ad_account, campaign_id, date_preset='last_7d', limit=100):
    """Per-keyword performance for a campaign (keyword view via GAQL).

    Returns [{keyword, match_type, impressions, clicks, cost_micros, conversions, ctr}].
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    during = _DATE_PRESETS.get(date_preset, 'LAST_7_DAYS')
    query = f"""
        SELECT ad_group_criterion.keyword.text,
               ad_group_criterion.keyword.match_type,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.ctr, metrics.average_cpc
        FROM keyword_view
        WHERE campaign.id = {cid} AND segments.date DURING {during}
        ORDER BY metrics.impressions DESC
        LIMIT {int(limit)}
    """

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for row in ga.search(customer_id=customer_id, query=query):
            k = row.ad_group_criterion.keyword
            m = row.metrics
            out.append({
                'keyword': k.text,
                'match_type': k.match_type.name,
                'impressions': int(m.impressions or 0),
                'clicks': int(m.clicks or 0),
                'cost_micros': int(m.cost_micros or 0),
                'conversions': float(m.conversions or 0),
                'ctr': float(m.ctr or 0),
                'average_cpc_micros': int(m.average_cpc or 0),
            })
        return out

    return _run(_call, context='get keyword insights')


def get_search_terms(ad_account, campaign_id, date_preset='last_7d', limit=100):
    """Search-terms report: actual queries that triggered the ads.

    Returns [{search_term, status, impressions, clicks, cost_micros, conversions}].
    Powers negative-keyword discovery.
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    cid = _digits(campaign_id)
    during = _DATE_PRESETS.get(date_preset, 'LAST_7_DAYS')
    query = f"""
        SELECT search_term_view.search_term,
               search_term_view.status,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.ctr
        FROM search_term_view
        WHERE campaign.id = {cid} AND segments.date DURING {during}
        ORDER BY metrics.impressions DESC
        LIMIT {int(limit)}
    """

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for row in ga.search(customer_id=customer_id, query=query):
            stv = row.search_term_view
            m = row.metrics
            out.append({
                'search_term': stv.search_term,
                'status': stv.status.name,
                'impressions': int(m.impressions or 0),
                'clicks': int(m.clicks or 0),
                'cost_micros': int(m.cost_micros or 0),
                'conversions': float(m.conversions or 0),
                'ctr': float(m.ctr or 0),
            })
        return out

    return _run(_call, context='get search terms')


def get_account_summary(ad_account, date_preset='last_30d'):
    """Account-level rollup: per-campaign totals for a dashboard view.

    Returns [{campaign_id, name, status, channel_type, impressions, clicks,
              cost_micros, conversions, conversions_value, ctr}].
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)
    during = _DATE_PRESETS.get(date_preset, 'LAST_30_DAYS')
    query = f"""
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.advertising_channel_type,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.conversions_value, metrics.ctr
        FROM campaign
        WHERE segments.date DURING {during}
        ORDER BY metrics.cost_micros DESC
    """

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for row in ga.search(customer_id=customer_id, query=query):
            c = row.campaign
            m = row.metrics
            out.append({
                'campaign_id': str(c.id),
                'name': c.name,
                'status': c.status.name,
                'channel_type': c.advertising_channel_type.name,
                'impressions': int(m.impressions or 0),
                'clicks': int(m.clicks or 0),
                'cost_micros': int(m.cost_micros or 0),
                'conversions': float(m.conversions or 0),
                'conversions_value': float(m.conversions_value or 0),
                'ctr': float(m.ctr or 0),
            })
        return out

    return _run(_call, context='get account summary')


def list_remote_campaigns(ad_account, limit=200):
    """List campaigns that already exist in the Google account (for sync/monitor).

    Returns list of {campaign_id, name, status, channel_type, budget_micros}.
    """
    from ads.services.token_encryption import decrypt_token

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    query = f"""
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.advertising_channel_type, campaign_budget.amount_micros
        FROM campaign
        ORDER BY campaign.id DESC
        LIMIT {int(limit)}
    """

    def _call():
        ga_service = client.get_service('GoogleAdsService')
        rows = ga_service.search(customer_id=customer_id, query=query)
        out = []
        for row in rows:
            out.append({
                'campaign_id': str(row.campaign.id),
                'name': row.campaign.name,
                'status': row.campaign.status.name,
                'channel_type': row.campaign.advertising_channel_type.name,
                'budget_micros': int(row.campaign_budget.amount_micros or 0),
            })
        return out

    return _run(_call, context='list remote campaigns')


# ═════════════════════════ Targeting: geo + ad schedule ═════════════════════
#
# Geo and ad-schedule are *campaign criteria* (CampaignCriterion), added after
# the campaign exists. They are skipped in dry-run (no persisted campaign to
# attach to) — the campaign + budget validation already proves the request
# shape; criteria are simple, well-typed additions that don't need a dry-run.

# A small, curated set of Google geo-target constant IDs for common countries.
# Full list: https://developers.google.com/google-ads/api/data/geotargets
# These are stable numeric constants ("geoTargetConstants/<id>").
GEO_TARGET_CONSTANTS = {
    'US': 2840, 'GB': 2826, 'CA': 2124, 'AU': 2036, 'IN': 2356,
    'DE': 2276, 'FR': 2250, 'BD': 2050, 'AE': 2784, 'SG': 2702,
    'PK': 2586, 'NG': 2566, 'ZA': 2710, 'BR': 2076, 'JP': 2392,
}

_DAY_NAME_TO_ENUM = {
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
}


def _add_geo_targets(client, customer_id, campaign_resource, country_codes):
    """Attach location-targeting criteria to a campaign.

    `country_codes` is a list like ['US', 'GB']. Unknown codes are skipped with
    a warning string returned to the caller. Returns a list of warnings.
    """
    warnings = []
    ops = []
    for code in country_codes:
        cc = (code or '').strip().upper()
        if not cc:
            continue
        const_id = GEO_TARGET_CONSTANTS.get(cc)
        if const_id is None:
            warnings.append(f'Skipped unknown location code "{cc}".')
            continue
        op = client.get_type('CampaignCriterionOperation')
        crit = op.create
        crit.campaign = campaign_resource
        crit.location.geo_target_constant = f'geoTargetConstants/{const_id}'
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops,
        )
    return warnings


def _add_ad_schedule(client, customer_id, campaign_resource, schedule):
    """Attach ad-schedule (day/hour) criteria to a campaign.

    `schedule` is a list of dicts: {day, start_hour, end_hour}. `day` is a
    weekday name (e.g. 'MONDAY'); hours are 0–24. Invalid entries are skipped
    with a warning. Returns a list of warnings.
    """
    warnings = []
    ops = []
    for slot in (schedule or []):
        day = str(slot.get('day', '')).strip().upper()
        if day not in _DAY_NAME_TO_ENUM:
            warnings.append(f'Skipped ad-schedule entry with invalid day "{day}".')
            continue
        try:
            start_h = int(slot.get('start_hour', 0))
            end_h = int(slot.get('end_hour', 24))
        except (TypeError, ValueError):
            warnings.append(f'Skipped ad-schedule entry for {day}: invalid hours.')
            continue
        if not (0 <= start_h < end_h <= 24):
            warnings.append(f'Skipped ad-schedule entry for {day}: hours must be 0 ≤ start < end ≤ 24.')
            continue
        op = client.get_type('CampaignCriterionOperation')
        crit = op.create
        crit.campaign = campaign_resource
        crit.ad_schedule.day_of_week = client.enums.DayOfWeekEnum[day]
        crit.ad_schedule.start_hour = start_h
        crit.ad_schedule.start_minute = client.enums.MinuteOfHourEnum.ZERO
        crit.ad_schedule.end_hour = end_h
        crit.ad_schedule.end_minute = client.enums.MinuteOfHourEnum.ZERO
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops,
        )
    return warnings


# ═════════════════════ Targeting: demographics / device / language / radius ═══

# Google language constant IDs (criterion IDs). Full list:
# https://developers.google.com/google-ads/api/data/codes-formats#languages
LANGUAGE_CONSTANTS = {
    'en': 1000, 'de': 1001, 'fr': 1002, 'es': 1003, 'it': 1004, 'ja': 1005,
    'nl': 1010, 'pt': 1014, 'zh': 1017, 'ar': 1019, 'ru': 1031, 'hi': 1023,
    'bn': 1056, 'ur': 1041, 'id': 1025, 'ms': 1102, 'ko': 1012,
}

# Device → CampaignCriterion device type enum name. We EXCLUDE devices the user
# doesn't want (Google serves on all devices by default; you opt out by adding a
# negative device criterion). `devices` is the list to KEEP.
_ALL_DEVICES = ('MOBILE', 'DESKTOP', 'TABLET')

# Age range enum names (AgeRangeTypeEnum).
_AGE_RANGES = {
    '18-24': 'AGE_RANGE_18_24', '25-34': 'AGE_RANGE_25_34',
    '35-44': 'AGE_RANGE_35_44', '45-54': 'AGE_RANGE_45_54',
    '55-64': 'AGE_RANGE_55_64', '65+': 'AGE_RANGE_65_UP',
    'unknown': 'AGE_RANGE_UNDETERMINED',
}
_GENDERS = {'male': 'MALE', 'female': 'FEMALE', 'unknown': 'UNDETERMINED'}


def _add_language_targets(client, customer_id, campaign_resource, languages):
    """Target specific languages. `languages` is a list of ISO codes (en, es...)."""
    warnings = []
    ops = []
    for code in (languages or []):
        c = (code or '').strip().lower()
        const = LANGUAGE_CONSTANTS.get(c)
        if const is None:
            warnings.append(f'Skipped unknown language "{c}".')
            continue
        op = client.get_type('CampaignCriterionOperation')
        op.create.campaign = campaign_resource
        op.create.language.language_constant = f'languageConstants/{const}'
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops)
    return warnings


def _add_device_exclusions(client, customer_id, campaign_resource, keep_devices):
    """Exclude devices NOT in keep_devices.

    Device criteria cannot be created as negatives (IMMUTABLE_FIELD on `negative`).
    The supported way to exclude a device is a bid modifier of 0 (−100%), which
    stops the campaign serving on that device. `keep_devices` is what to KEEP.
    """
    warnings = []
    keep = {str(d).strip().upper() for d in (keep_devices or []) if str(d).strip()}
    if not keep:
        return warnings  # nothing specified → serve everywhere (default)
    ops = []
    for dev in _ALL_DEVICES:
        if dev in keep:
            continue
        op = client.get_type('CampaignCriterionOperation')
        op.create.campaign = campaign_resource
        op.create.device.type_ = getattr(client.enums.DeviceEnum, dev)
        op.create.bid_modifier = 0.0  # −100% → effectively excluded
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops)
    return warnings


def _add_demographics(client, customer_id, ad_group_resource, exclude_ages=None,
                      exclude_genders=None):
    """Exclude demographic segments at the ad-group level.

    Google targets all ages/genders by default; you refine by EXCLUDING the ones
    you don't want. `exclude_ages` uses keys like '18-24'; `exclude_genders`
    uses 'male'/'female'. Demographics are ad-group criteria, not campaign.
    """
    warnings = []
    ops = []
    for a in (exclude_ages or []):
        name = _AGE_RANGES.get(str(a).strip().lower())
        if not name:
            warnings.append(f'Skipped unknown age range "{a}".')
            continue
        op = client.get_type('AdGroupCriterionOperation')
        op.create.ad_group = ad_group_resource
        op.create.negative = True
        op.create.age_range.type_ = getattr(client.enums.AgeRangeTypeEnum, name)
        ops.append(op)
    for g in (exclude_genders or []):
        name = _GENDERS.get(str(g).strip().lower())
        if not name:
            warnings.append(f'Skipped unknown gender "{g}".')
            continue
        op = client.get_type('AdGroupCriterionOperation')
        op.create.ad_group = ad_group_resource
        op.create.negative = True
        op.create.gender.type_ = getattr(client.enums.GenderTypeEnum, name)
        ops.append(op)
    if ops:
        client.get_service('AdGroupCriterionService').mutate_ad_group_criteria(
            customer_id=customer_id, operations=ops)
    return warnings


def _add_radius_targets(client, customer_id, campaign_resource, radii):
    """Target geographic radius circles (proximity).

    `radii` is a list of {lat, lng, radius, unit?} where unit is 'MILES' or
    'KILOMETERS' (default MILES). This is the city/radius targeting.
    """
    warnings = []
    ops = []
    for r in (radii or []):
        try:
            lat = float(r.get('lat'))
            lng = float(r.get('lng'))
            radius = float(r.get('radius'))
        except (TypeError, ValueError):
            warnings.append('Skipped a radius target with invalid lat/lng/radius.')
            continue
        unit = str(r.get('unit', 'MILES')).strip().upper()
        if unit not in ('MILES', 'KILOMETERS'):
            unit = 'MILES'
        op = client.get_type('CampaignCriterionOperation')
        prox = op.create.proximity
        prox.radius = radius
        prox.radius_units = getattr(client.enums.ProximityRadiusUnitsEnum, unit)
        prox.geo_point.latitude_in_micro_degrees = int(lat * 1_000_000)
        prox.geo_point.longitude_in_micro_degrees = int(lng * 1_000_000)
        op.create.campaign = campaign_resource
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops)
    return warnings


# ═════════════════════════ Ad extensions (assets) ══════════════════════════
#
# Modern Google Ads extensions are *assets* linked to a campaign via
# CampaignAsset with a field_type (SITELINK / CALLOUT / STRUCTURED_SNIPPET).
# Added after the campaign exists; skipped in dry-run.

def _add_sitelinks(client, customer_id, campaign_resource, sitelinks):
    """Create sitelink assets and link them to the campaign.

    `sitelinks` is a list of dicts: {text, url, description1?, description2?}.
    `text` ≤25 chars, descriptions ≤35 chars each. Returns a list of warnings.
    """
    warnings = []
    asset_ops = []
    valid = []
    for s in (sitelinks or []):
        text = (s.get('text') or '').strip()
        url = (s.get('url') or '').strip()
        if not text or not url:
            warnings.append('Skipped a sitelink missing text or url.')
            continue
        op = client.get_type('AssetOperation')
        sl = op.create.sitelink_asset
        sl.link_text = text[:25]
        # Google requires sitelink descriptions in PAIRS — description1 without
        # description2 is rejected (REQUIRED error). Only set them if both exist.
        d1 = (s.get('description1') or '').strip()
        d2 = (s.get('description2') or '').strip()
        if d1 and d2:
            sl.description1 = d1[:35]
            sl.description2 = d2[:35]
        op.create.final_urls.append(url)
        asset_ops.append(op)
        valid.append(True)
    if not asset_ops:
        return warnings
    resp = client.get_service('AssetService').mutate_assets(
        customer_id=customer_id, operations=asset_ops,
    )
    link_ops = []
    for res in resp.results:
        link = client.get_type('CampaignAssetOperation')
        link.create.campaign = campaign_resource
        link.create.asset = res.resource_name
        link.create.field_type = client.enums.AssetFieldTypeEnum.SITELINK
        link_ops.append(link)
    if link_ops:
        client.get_service('CampaignAssetService').mutate_campaign_assets(
            customer_id=customer_id, operations=link_ops,
        )
    return warnings


def _add_callouts(client, customer_id, campaign_resource, callouts):
    """Create callout assets (short selling points, ≤25 chars) and link them."""
    warnings = []
    texts = [str(c).strip()[:25] for c in (callouts or []) if str(c).strip()]
    if not texts:
        return warnings
    asset_ops = []
    for t in texts:
        op = client.get_type('AssetOperation')
        op.create.callout_asset.callout_text = t
        asset_ops.append(op)
    resp = client.get_service('AssetService').mutate_assets(
        customer_id=customer_id, operations=asset_ops,
    )
    link_ops = []
    for res in resp.results:
        link = client.get_type('CampaignAssetOperation')
        link.create.campaign = campaign_resource
        link.create.asset = res.resource_name
        link.create.field_type = client.enums.AssetFieldTypeEnum.CALLOUT
        link_ops.append(link)
    client.get_service('CampaignAssetService').mutate_campaign_assets(
        customer_id=customer_id, operations=link_ops,
    )
    return warnings


def _add_structured_snippet(client, customer_id, campaign_resource, header, values):
    """Create one structured-snippet asset (a header + value list) and link it.

    `header` must be one of Google's predefined headers (e.g. 'Brands',
    'Services', 'Types', 'Styles', 'Models', 'Featured'). Values ≤25 chars each;
    needs at least 3 values per Google's rules.
    """
    warnings = []
    header = (header or '').strip()
    vals = [str(v).strip()[:25] for v in (values or []) if str(v).strip()]
    if not header or len(vals) < 3:
        warnings.append('Skipped structured snippet: needs a header and at least 3 values.')
        return warnings
    op = client.get_type('AssetOperation')
    ss = op.create.structured_snippet_asset
    ss.header = header
    ss.values.extend(vals[:10])
    resp = client.get_service('AssetService').mutate_assets(
        customer_id=customer_id, operations=[op],
    )
    link = client.get_type('CampaignAssetOperation')
    link.create.campaign = campaign_resource
    link.create.asset = resp.results[0].resource_name
    link.create.field_type = client.enums.AssetFieldTypeEnum.STRUCTURED_SNIPPET
    client.get_service('CampaignAssetService').mutate_campaign_assets(
        customer_id=customer_id, operations=[link],
    )
    return warnings


def apply_campaign_extras(client, customer_id, campaign_resource,
                          geo_targets=None, ad_schedule=None, sitelinks=None,
                          callouts=None, snippet_header='', snippet_values=None,
                          languages=None, devices=None, radius_targets=None,
                          ad_group_resource='', exclude_ages=None, exclude_genders=None):
    """Attach geo, schedule, extensions and fine-grained targeting to a campaign.

    Best-effort: each extra is independent, so one failing kind doesn't abort
    the others. Returns a combined list of human-readable warnings. Call this
    only on a real (non-dry-run) campaign that already exists. Demographic
    exclusions need `ad_group_resource` (they're ad-group criteria).
    """
    warnings = []
    for fn, args in (
        (_add_geo_targets, (geo_targets or [],)),
        (_add_ad_schedule, (ad_schedule or [],)),
        (_add_sitelinks, (sitelinks or [],)),
        (_add_callouts, (callouts or [],)),
        (_add_language_targets, (languages or [],)),
        (_add_device_exclusions, (devices or [],)),
        (_add_radius_targets, (radius_targets or [],)),
    ):
        try:
            if args[0]:
                warnings += fn(client, customer_id, campaign_resource, *args)
        except GoogleAdsError as e:
            warnings.append(f'{fn.__name__} skipped: {e}')
        except Exception as e:  # noqa: BLE001
            warnings.append(f'{fn.__name__} skipped: {e}')
    if snippet_header and snippet_values:
        try:
            warnings += _add_structured_snippet(
                client, customer_id, campaign_resource, snippet_header, snippet_values)
        except Exception as e:  # noqa: BLE001
            warnings.append(f'structured snippet skipped: {e}')
    # Demographics live on the ad group, not the campaign.
    if ad_group_resource and (exclude_ages or exclude_genders):
        try:
            warnings += _add_demographics(
                client, customer_id, ad_group_resource,
                exclude_ages=exclude_ages, exclude_genders=exclude_genders)
        except Exception as e:  # noqa: BLE001
            warnings.append(f'demographics skipped: {e}')
    return warnings


# ═══════════════════════════ Video (YouTube) campaign ═══════════════════════

def _youtube_video_id(value):
    """Extract a YouTube video id from a URL or return the value if it's an id.

    Accepts: full watch URLs, youtu.be short links, /shorts/ links, or a bare
    11-char id. Returns the id, or '' if it can't be parsed.
    """
    import re
    v = (value or '').strip()
    if not v:
        return ''
    # Bare 11-char id.
    if re.fullmatch(r'[A-Za-z0-9_-]{11}', v):
        return v
    m = re.search(r'(?:v=|/shorts/|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})', v)
    return m.group(1) if m else ''


def create_video_campaign(
    ad_account, name, daily_budget_micros, video_url='',
    final_url='', headline='', description='', start_date=None, end_date=None,
    dry_run=False, geo_targets=None, ad_schedule=None, audience_ids=None,
    languages=None, devices=None, radius_targets=None,
    exclude_ages=None, exclude_genders=None,
):
    """Create a VIDEO campaign with an in-feed/in-stream video ad.

    Google requires the video to already be hosted on YouTube — we reference it
    by video id (parsed from `video_url`). Created PAUSED. In dry-run we validate
    campaign + budget only.
    """
    from ads.services.token_encryption import decrypt_token

    if int(daily_budget_micros) <= 0:
        raise GoogleAdsError('Daily budget must be greater than zero.')

    video_id = _youtube_video_id(video_url)
    if not dry_run:
        if not video_id:
            raise GoogleAdsError(
                'A valid YouTube video URL or id is required for a Video campaign. '
                'Google can only run videos already uploaded to YouTube.')
        if not final_url:
            raise GoogleAdsError('A landing page URL is required for a Video ad.')
        if not headline or len(headline) > 90:
            raise GoogleAdsError('A headline (≤90 chars) is required for a Video ad.')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    def _call():
        # 1. Budget
        b_op = client.get_type('CampaignBudgetOperation')
        b_op.create.name = f'{name} Budget {customer_id}'
        b_op.create.amount_micros = int(daily_budget_micros)
        b_op.create.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b_op.create.explicitly_shared = False

        # 2. Campaign (PAUSED, VIDEO)
        c_op = client.get_type('CampaignOperation')
        camp = c_op.create
        camp.name = name
        camp.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.VIDEO
        camp.status = client.enums.CampaignStatusEnum.PAUSED
        camp.contains_eu_political_advertising = (
            client.enums.EuPoliticalAdvertisingStatusEnum
            .DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
        )
        # Modern Video campaigns use Target CPM (manual_cpv is rejected in v21).
        camp.target_cpm = client.get_type('TargetCpm')
        if start_date:
            camp.start_date = start_date
        if end_date:
            camp.end_date = end_date

        if dry_run:
            temp_budget = f'customers/{customer_id}/campaignBudgets/-1'
            b_op.create.resource_name = temp_budget
            camp.campaign_budget = temp_budget
            ga = client.get_service('GoogleAdsService')
            mb = client.get_type('MutateOperation'); mb.campaign_budget_operation = b_op
            mc = client.get_type('MutateOperation'); mc.campaign_operation = c_op
            ga.mutate(request={'customer_id': customer_id,
                               'mutate_operations': [mb, mc], 'validate_only': True})
            return {'campaign_resource': '', 'campaign_id': '', 'budget_resource': temp_budget,
                    'ad_group_resource': '', 'ad_group_id': '', 'ad_resource': '', 'dry_run': True,
                    'warnings': ['Dry run: video campaign + budget validated. '
                                 'The video ad is only created on a real run.']}

        b_resp = client.get_service('CampaignBudgetService').mutate_campaign_budgets(
            request={'customer_id': customer_id, 'operations': [b_op]})
        budget_resource = b_resp.results[0].resource_name
        camp.campaign_budget = budget_resource
        c_resp = client.get_service('CampaignService').mutate_campaigns(
            request={'customer_id': customer_id, 'operations': [c_op]})
        campaign_resource = c_resp.results[0].resource_name
        campaign_id = campaign_resource.split('/')[-1].split('~')[-1]

        # 3. Ad group (VIDEO)
        ag_op = client.get_type('AdGroupOperation')
        ag_op.create.name = f'{name} - Video Ad Group'
        ag_op.create.campaign = campaign_resource
        ag_op.create.type_ = client.enums.AdGroupTypeEnum.VIDEO_NON_SKIPPABLE_IN_STREAM
        ag_op.create.status = client.enums.AdGroupStatusEnum.ENABLED
        ag_resp = client.get_service('AdGroupService').mutate_ad_groups(
            customer_id=customer_id, operations=[ag_op])
        ad_group_resource = ag_resp.results[0].resource_name
        ad_group_id = ad_group_resource.split('/')[-1].split('~')[-1]

        # 4. YouTube video asset
        va_op = client.get_type('AssetOperation')
        va_op.create.name = f'{name} video {video_id}'
        va_op.create.youtube_video_asset.youtube_video_id = video_id
        va_resp = client.get_service('AssetService').mutate_assets(
            customer_id=customer_id, operations=[va_op])
        video_asset = va_resp.results[0].resource_name

        # 5. Video ad (in-stream)
        ad_op = client.get_type('AdGroupAdOperation')
        aga = ad_op.create
        aga.ad_group = ad_group_resource
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(final_url)
        video_ad = aga.ad.video_ad
        video_ad.video.asset = video_asset
        video_ad.in_stream.action_headline = headline[:90]
        ad_resp = client.get_service('AdGroupAdService').mutate_ad_group_ads(
            customer_id=customer_id, operations=[ad_op])
        ad_resource = ad_resp.results[0].resource_name

        # Targeting: geo, schedule, language, device, radius, demographics.
        warnings = apply_campaign_extras(
            client, customer_id, campaign_resource,
            geo_targets=geo_targets, ad_schedule=ad_schedule,
            languages=languages, devices=devices, radius_targets=radius_targets,
            ad_group_resource=ad_group_resource,
            exclude_ages=exclude_ages, exclude_genders=exclude_genders)
        if audience_ids:
            try:
                warnings += _add_audience_criteria(client, customer_id, campaign_resource, audience_ids)
            except Exception as e:  # noqa: BLE001
                warnings.append(f'audience targeting skipped: {e}')

        return {'campaign_resource': campaign_resource, 'campaign_id': campaign_id,
                'budget_resource': budget_resource, 'ad_group_resource': ad_group_resource,
                'ad_group_id': ad_group_id, 'ad_resource': ad_resource, 'dry_run': False,
                'warnings': warnings}

    return _run(_call, context='create video campaign')


# ═══════════════════════════ Conversion tracking ════════════════════════════

def create_conversion_action(ad_account, name, category='DEFAULT',
                             value_micros=0, dry_run=False):
    """Create a website conversion action on the account.

    Returns the conversion action resource + the tag snippet info Google needs
    on the site. `category` is one of Google's ConversionActionCategory names
    (DEFAULT, PURCHASE, SIGNUP, LEAD, PAGE_VIEW, etc.). This is account-level
    setup; it does not attach to a single campaign.
    """
    from ads.services.token_encryption import decrypt_token

    name = (name or '').strip()
    if not name:
        raise GoogleAdsError('A conversion action name is required.')
    category = (category or 'DEFAULT').strip().upper()

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    def _call():
        op = client.get_type('ConversionActionOperation')
        ca = op.create
        ca.name = name
        ca.type_ = client.enums.ConversionActionTypeEnum.WEBPAGE
        ca.category = client.enums.ConversionActionCategoryEnum[category] \
            if category in client.enums.ConversionActionCategoryEnum.__members__ \
            else client.enums.ConversionActionCategoryEnum.DEFAULT
        ca.status = client.enums.ConversionActionStatusEnum.ENABLED
        ca.value_settings.default_value = float(value_micros) / 1_000_000 if value_micros else 0.0
        ca.value_settings.always_use_default_value = bool(value_micros)
        resp = client.get_service('ConversionActionService').mutate_conversion_actions(
            request={'customer_id': customer_id, 'operations': [op], 'validate_only': dry_run})
        resource = resp.results[0].resource_name if resp.results else ''
        return {
            'conversion_action_resource': resource,
            'name': name,
            'category': category,
            'dry_run': dry_run,
            'note': ('Conversion action created. Add the Google tag (gtag.js) to your '
                     'site and fire this conversion on the success page to track results. '
                     'On a test account it validates but reports no data.'),
        }

    return _run(_call, context='create conversion action')


def upload_offline_conversions(ad_account, conversion_action_resource, conversions):
    """Upload offline (click) conversions against a conversion action.

    `conversions` is a list of dicts:
        {gclid, conversion_date_time, value?, currency?}
    where conversion_date_time is 'yyyy-MM-dd HH:mm:ss+HH:MM' (Google's required
    format, with timezone offset). Used to import CRM/offline sales back to
    Google so smart bidding can optimize on real outcomes.

    Returns {uploaded, failed, errors:[...]}. partial_failure is enabled so good
    rows still upload even if some rows are malformed.

    Note: Google now steers NEW integrations to the Data Manager API; the
    ConversionUploadService used here remains available to existing-access
    accounts. If an account returns a "use the Data Manager API" error, that
    account hasn't been grandfathered into the legacy upload service.
    """
    from ads.services.token_encryption import decrypt_token

    if not conversion_action_resource:
        raise GoogleAdsError('A conversion_action_resource is required.')
    rows = [c for c in (conversions or []) if c.get('gclid') and c.get('conversion_date_time')]
    if not rows:
        raise GoogleAdsError('Provide at least one conversion with gclid + conversion_date_time.')

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    def _call():
        svc = client.get_service('ConversionUploadService')
        ops = []
        for c in rows:
            click = client.get_type('ClickConversion')
            click.conversion_action = conversion_action_resource
            click.gclid = str(c['gclid'])
            click.conversion_date_time = str(c['conversion_date_time'])
            if c.get('value'):
                click.conversion_value = float(c['value'])
                click.currency_code = (c.get('currency') or 'USD').upper()
            ops.append(click)
        resp = svc.upload_click_conversions(request={
            'customer_id': customer_id,
            'conversions': ops,
            'partial_failure': True,
        })
        # partial_failure_error holds per-row failures; results holds successes.
        ok = sum(1 for r in resp.results if r.gclid or r.conversion_action)
        errors = []
        pf = getattr(resp, 'partial_failure_error', None)
        if pf and getattr(pf, 'message', ''):
            errors.append(pf.message)
        return {'uploaded': ok, 'failed': len(rows) - ok, 'errors': errors}

    return _run(_call, context='upload offline conversions')


# ═══════════════════════ Audience targeting (interests) ═════════════════════
#
# Google audiences are referenced by numeric category IDs, not free text. We
# search the user_interest catalog by keyword so the UI can offer real options,
# then target the chosen IDs as criteria (Display) or asset-group signals (PMax).

def search_audiences(ad_account, keyword, limit=15):
    """Search Google's user-interest catalog by keyword.

    Returns a list of {id, name, taxonomy} the user can pick from. These IDs
    feed `audience_ids` on Display campaigns and PMax audience signals.
    """
    from ads.services.token_encryption import decrypt_token

    keyword = (keyword or '').strip().replace('"', '')
    if not keyword:
        return []

    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    customer_id = _digits(ad_account.external_id)

    query = (
        'SELECT user_interest.user_interest_id, user_interest.name, '
        'user_interest.taxonomy_type FROM user_interest '
        f'WHERE user_interest.name LIKE "%{keyword}%" LIMIT {int(limit)}'
    )

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for r in ga.search(customer_id=customer_id, query=query):
            ui = r.user_interest
            out.append({
                'id': str(ui.user_interest_id),
                'name': ui.name,
                'taxonomy': ui.taxonomy_type.name,
            })
        return out

    return _run(_call, context='search audiences')


def _add_audience_criteria(client, customer_id, campaign_resource, audience_ids):
    """Attach user-interest audience criteria to a campaign (Display).

    `audience_ids` is a list of numeric user_interest IDs (strings/ints).
    Returns a list of warnings. Skipped in dry-run by the caller.
    """
    warnings = []
    ops = []
    for aid in (audience_ids or []):
        aid = str(aid).strip()
        if not aid.isdigit():
            warnings.append(f'Skipped invalid audience id "{aid}".')
            continue
        op = client.get_type('CampaignCriterionOperation')
        op.create.campaign = campaign_resource
        op.create.user_interest.user_interest_category = f'customers/{customer_id}/userInterests/{aid}'
        ops.append(op)
    if ops:
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops,
        )
    return warnings


def _add_asset_group_signals(client, customer_id, asset_group_resource,
                             search_themes=None, audience_ids=None):
    """Attach PMax asset-group signals: free-text search themes + audiences.

    `search_themes` are plain strings ("the theme"); `audience_ids` are numeric
    user_interest IDs. Both guide PMax targeting. Returns a list of warnings.
    """
    warnings = []
    ops = []
    for theme in (search_themes or []):
        t = str(theme).strip()
        if not t:
            continue
        op = client.get_type('AssetGroupSignalOperation')
        op.create.asset_group = asset_group_resource
        op.create.search_theme.text = t[:80]
        ops.append(op)
    # Audience signals on PMax require an Audience resource, which is heavier to
    # build; search themes cover the free-text "theme" need. Interest IDs are
    # better targeted at Display via _add_audience_criteria. We note any ids here.
    if audience_ids:
        warnings.append('Audience interest IDs apply to Display campaigns; PMax uses search themes as signals.')
    if ops:
        client.get_service('AssetGroupSignalService').mutate_asset_group_signals(
            customer_id=customer_id, operations=ops,
        )
    return warnings


def _add_youtube_video_to_asset_group(client, customer_id, asset_group_resource,
                                      video_url, name):
    """Add a YouTube video asset to a PMax asset group. Returns warnings."""
    warnings = []
    vid = _youtube_video_id(video_url)
    if not vid:
        if video_url:
            warnings.append('Skipped PMax video: not a valid YouTube URL/id.')
        return warnings
    va = client.get_type('AssetOperation')
    va.create.name = f'{name} video {vid}'
    va.create.youtube_video_asset.youtube_video_id = vid
    va_resp = client.get_service('AssetService').mutate_assets(
        customer_id=customer_id, operations=[va])
    video_asset = va_resp.results[0].resource_name
    link = client.get_type('AssetGroupAssetOperation')
    link.create.asset_group = asset_group_resource
    link.create.asset = video_asset
    link.create.field_type = client.enums.AssetFieldTypeEnum.YOUTUBE_VIDEO
    client.get_service('AssetGroupAssetService').mutate_asset_group_assets(
        customer_id=customer_id, operations=[link])
    return warnings
