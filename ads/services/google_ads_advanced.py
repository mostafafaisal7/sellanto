"""Advanced Google Ads operations — everything beyond create/insights.

Built on the same client/helpers as google_ads.py (reuses _build_client, _digits,
_run, GoogleAdsError). Covers: location lookup, richer audiences, ad-group /
keyword / ad editing, shared budgets, portfolio bid strategies, segment
breakdowns, recommendations, keyword planner, change history, and labels.

API shapes verified against Google Ads API v21 (google-ads python v31).
"""
from ads.services.google_ads import (
    _build_client, _digits, _run, GoogleAdsError,
)


def _client_for(ad_account):
    """Build a client + return (client, customer_id) for an ad account."""
    from ads.services.token_encryption import decrypt_token
    refresh_token = decrypt_token(ad_account.encrypted_token)
    client = _build_client(refresh_token, login_customer_id=ad_account.login_customer_id)
    return client, _digits(ad_account.external_id)


# ═══════════════════════════ Location lookup (by name) ═══════════════════════

def suggest_locations(ad_account, query, country_code='', locale='en', limit=20):
    """Look up geo-target constants by city/region NAME.

    Returns [{id, resource_name, name, canonical_name, target_type, country_code}].
    Powers a 'type a city' location picker. `id` feeds geo_target_constant criteria.
    """
    query = (query or '').strip()
    if not query:
        return []
    client, customer_id = _client_for(ad_account)

    def _call():
        svc = client.get_service('GeoTargetConstantService')
        req = client.get_type('SuggestGeoTargetConstantsRequest')
        req.locale = locale or 'en'
        if country_code:
            req.country_code = country_code.upper()
        req.location_names.names.append(query)
        resp = svc.suggest_geo_target_constants(request=req)
        out = []
        for sug in resp.geo_target_constant_suggestions:
            g = sug.geo_target_constant
            out.append({
                'id': str(g.id),
                'resource_name': g.resource_name,
                'name': g.name,
                'canonical_name': g.canonical_name,
                'target_type': g.target_type,
                'country_code': g.country_code,
                'reach': int(getattr(sug, 'reach', 0) or 0),
            })
            if len(out) >= limit:
                break
        return out

    return _run(_call, context='suggest locations')


def add_location_targets(ad_account, campaign_id, geo_constant_ids):
    """Add specific geo-target-constant IDs (cities/regions) to a campaign.

    `geo_constant_ids` are numeric IDs from suggest_locations. This complements
    the country-code geo targeting with precise city/region targeting.
    """
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)
    campaign_resource = f'customers/{customer_id}/campaigns/{cid}'

    def _call():
        ops = []
        for gid in (geo_constant_ids or []):
            op = client.get_type('CampaignCriterionOperation')
            op.create.campaign = campaign_resource
            op.create.location.geo_target_constant = f'geoTargetConstants/{_digits(gid)}'
            ops.append(op)
        if not ops:
            return {'added': 0}
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops)
        return {'added': len(ops)}
    return _run(_call, context='add location targets')


# ═══════════════════════════ Richer audiences ═══════════════════════════════

def list_audiences(ad_account, kind='in_market', keyword='', limit=50):
    """List audiences of a given kind for targeting.

    kind ∈ {in_market, affinity, custom, user_list}. Returns [{id, name, type, kind}].
    - in_market / affinity → user_interest catalog filtered by taxonomy_type
    - custom               → custom_audience resource
    - user_list            → remarketing + customer-match lists
    """
    client, customer_id = _client_for(ad_account)
    kw = (keyword or '').replace('"', '').strip()

    if kind in ('in_market', 'affinity'):
        tax = 'IN_MARKET' if kind == 'in_market' else 'AFFINITY'
        where = f"user_interest.taxonomy_type = '{tax}'"
        if kw:
            where += f' AND user_interest.name LIKE "%{kw}%"'
        query = (f'SELECT user_interest.user_interest_id, user_interest.name, '
                 f'user_interest.taxonomy_type FROM user_interest WHERE {where} '
                 f'LIMIT {int(limit)}')

        def _call_ui():
            ga = client.get_service('GoogleAdsService')
            out = []
            for r in ga.search(customer_id=customer_id, query=query):
                ui = r.user_interest
                out.append({'id': str(ui.user_interest_id), 'name': ui.name,
                            'type': ui.taxonomy_type.name, 'kind': kind})
            return out
        return _run(_call_ui, context=f'list {kind} audiences')

    if kind == 'custom':
        query = ('SELECT custom_audience.id, custom_audience.name, '
                 'custom_audience.type, custom_audience.status FROM custom_audience '
                 f'LIMIT {int(limit)}')

        def _call_ca():
            ga = client.get_service('GoogleAdsService')
            out = []
            for r in ga.search(customer_id=customer_id, query=query):
                ca = r.custom_audience
                out.append({'id': str(ca.id), 'name': ca.name,
                            'type': ca.type_.name, 'kind': 'custom'})
            return out
        return _run(_call_ca, context='list custom audiences')

    # user_list (remarketing + customer match)
    query = ('SELECT user_list.id, user_list.name, user_list.type, '
             'user_list.size_for_display, user_list.size_for_search '
             f'FROM user_list LIMIT {int(limit)}')

    def _call_ul():
        ga = client.get_service('GoogleAdsService')
        out = []
        for r in ga.search(customer_id=customer_id, query=query):
            ul = r.user_list
            out.append({'id': str(ul.id), 'name': ul.name,
                        'type': ul.type_.name, 'kind': 'user_list',
                        'size': int(ul.size_for_display or 0) + int(ul.size_for_search or 0)})
        return out
    return _run(_call_ul, context='list user lists')


def add_audience_criteria(ad_account, campaign_id, *, user_interest_ids=None,
                          custom_audience_ids=None, user_list_ids=None):
    """Attach audience criteria to a campaign by kind.

    Each list contains numeric IDs. user_interest covers in-market+affinity;
    custom_audience covers custom audiences; user_list covers remarketing +
    customer match. Returns {added}.
    """
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)
    if not cid:
        raise GoogleAdsError('Campaign has no Google campaign id.')
    campaign_resource = f'customers/{customer_id}/campaigns/{cid}'

    def _call():
        ops = []
        for uid in (user_interest_ids or []):
            op = client.get_type('CampaignCriterionOperation')
            op.create.campaign = campaign_resource
            op.create.user_interest.user_interest_category = (
                f'customers/{customer_id}/userInterests/{_digits(uid)}')
            ops.append(op)
        for caid in (custom_audience_ids or []):
            op = client.get_type('CampaignCriterionOperation')
            op.create.campaign = campaign_resource
            op.create.custom_audience.custom_audience = (
                f'customers/{customer_id}/customAudiences/{_digits(caid)}')
            ops.append(op)
        for ulid in (user_list_ids or []):
            op = client.get_type('CampaignCriterionOperation')
            op.create.campaign = campaign_resource
            op.create.user_list.user_list = (
                f'customers/{customer_id}/userLists/{_digits(ulid)}')
            ops.append(op)
        if not ops:
            return {'added': 0}
        client.get_service('CampaignCriterionService').mutate_campaign_criteria(
            customer_id=customer_id, operations=ops)
        return {'added': len(ops)}

    return _run(_call, context='add audience criteria')


def create_customer_match_list(ad_account, name, emails=None, phones=None,
                               membership_days=30):
    """Create a Customer Match user list from CRM emails/phones and upload them.

    Hashes identifiers (SHA-256 over normalized values) per Google's requirement.
    Returns {user_list_resource, user_list_id, uploaded}. Population is async on
    Google's side; the list becomes targetable once processed.
    """
    import hashlib

    def _hash(v):
        return hashlib.sha256(v.strip().lower().encode('utf-8')).hexdigest()

    emails = [e for e in (emails or []) if e and '@' in e]
    phones = [p for p in (phones or []) if p]
    if not (emails or phones):
        raise GoogleAdsError('Provide at least one email or phone.')

    client, customer_id = _client_for(ad_account)

    def _call():
        # 1. Create the CRM-based user list.
        uls = client.get_service('UserListService')
        op = client.get_type('UserListOperation')
        ul = op.create
        ul.name = name[:80]
        ul.description = 'Customer Match list uploaded via Sellanto.'
        ul.membership_life_span = int(membership_days)
        ul.crm_based_user_list.upload_key_type = (
            client.enums.CustomerMatchUploadKeyTypeEnum.CONTACT_INFO)
        resp = uls.mutate_user_lists(customer_id=customer_id, operations=[op])
        user_list_resource = resp.results[0].resource_name

        # 2. Create an offline job bound to the list.
        ojs = client.get_service('OfflineUserDataJobService')
        job = client.get_type('OfflineUserDataJob')
        job.type_ = client.enums.OfflineUserDataJobTypeEnum.CUSTOMER_MATCH_USER_LIST
        job.customer_match_user_list_metadata.user_list = user_list_resource
        job_resource = ojs.create_offline_user_data_job(
            customer_id=customer_id, job=job).resource_name

        # 3. Build + add user-data operations.
        ops = []
        for e in emails:
            o = client.get_type('OfflineUserDataJobOperation')
            ident = client.get_type('UserIdentifier')
            ident.hashed_email = _hash(e)
            o.create.user_identifiers.append(ident)
            ops.append(o)
        for p in phones:
            o = client.get_type('OfflineUserDataJobOperation')
            ident = client.get_type('UserIdentifier')
            ident.hashed_phone_number = _hash(p)
            o.create.user_identifiers.append(ident)
            ops.append(o)
        ojs.add_offline_user_data_job_operations(
            resource_name=job_resource, operations=ops, enable_partial_failure=True)

        # 4. Run the job (async on Google's side).
        ojs.run_offline_user_data_job(resource_name=job_resource)
        return {'user_list_resource': user_list_resource,
                'user_list_id': user_list_resource.split('/')[-1],
                'uploaded': len(ops)}

    return _run(_call, context='create customer match list')


# ═══════════════════ Ad group / keyword / ad editing ════════════════════════

def list_ad_groups(ad_account, campaign_id):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)
    query = (f"SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type "
             f"FROM ad_group WHERE ad_group.campaign = "
             f"'customers/{customer_id}/campaigns/{cid}' AND ad_group.status != 'REMOVED'")

    def _call():
        ga = client.get_service('GoogleAdsService')
        return [{'id': str(r.ad_group.id), 'name': r.ad_group.name,
                 'status': r.ad_group.status.name, 'type': r.ad_group.type_.name}
                for r in ga.search(customer_id=customer_id, query=query)]
    return _run(_call, context='list ad groups')


def create_ad_group(ad_account, campaign_id, name, cpc_bid_usd=1.0):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)

    def _call():
        svc = client.get_service('AdGroupService')
        op = client.get_type('AdGroupOperation')
        ag = op.create
        ag.name = name[:255]
        ag.campaign = f'customers/{customer_id}/campaigns/{cid}'
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.cpc_bid_micros = int(round(float(cpc_bid_usd) * 1_000_000))
        resp = svc.mutate_ad_groups(customer_id=customer_id, operations=[op])
        return {'ad_group_resource': resp.results[0].resource_name}
    return _run(_call, context='create ad group')


def update_ad_group(ad_account, ad_group_id, *, name=None, status=None):
    """Rename and/or pause/enable an ad group."""
    client, customer_id = _client_for(ad_account)
    agid = _digits(ad_group_id)

    def _call():
        from google.protobuf import field_mask_pb2
        svc = client.get_service('AdGroupService')
        op = client.get_type('AdGroupOperation')
        op.update.resource_name = f'customers/{customer_id}/adGroups/{agid}'
        paths = []
        if name is not None:
            op.update.name = name[:255]
            paths.append('name')
        if status is not None:
            op.update.status = getattr(client.enums.AdGroupStatusEnum, status.upper())
            paths.append('status')
        if not paths:
            return {'updated': False}
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=paths))
        svc.mutate_ad_groups(customer_id=customer_id, operations=[op])
        return {'updated': True}
    return _run(_call, context='update ad group')


def remove_ad_group(ad_account, ad_group_id):
    client, customer_id = _client_for(ad_account)
    agid = _digits(ad_group_id)

    def _call():
        svc = client.get_service('AdGroupService')
        op = client.get_type('AdGroupOperation')
        op.remove = f'customers/{customer_id}/adGroups/{agid}'
        svc.mutate_ad_groups(customer_id=customer_id, operations=[op])
        return {'removed': True}
    return _run(_call, context='remove ad group')


def list_keywords(ad_account, campaign_id):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)
    query = (f"SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, "
             f"ad_group_criterion.keyword.match_type, ad_group_criterion.status, "
             f"ad_group_criterion.negative, ad_group.id FROM ad_group_criterion "
             f"WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group.campaign = "
             f"'customers/{customer_id}/campaigns/{cid}' "
             f"AND ad_group_criterion.status != 'REMOVED'")

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for r in ga.search(customer_id=customer_id, query=query):
            c = r.ad_group_criterion
            out.append({'criterion_id': str(c.criterion_id), 'ad_group_id': str(r.ad_group.id),
                        'text': c.keyword.text, 'match_type': c.keyword.match_type.name,
                        'status': c.status.name, 'negative': c.negative})
        return out
    return _run(_call, context='list keywords')


def add_keyword(ad_account, ad_group_id, text, match_type='BROAD', negative=False):
    client, customer_id = _client_for(ad_account)
    agid = _digits(ad_group_id)

    def _call():
        svc = client.get_service('AdGroupCriterionService')
        op = client.get_type('AdGroupCriterionOperation')
        c = op.create
        c.ad_group = f'customers/{customer_id}/adGroups/{agid}'
        c.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        c.keyword.text = text
        c.keyword.match_type = getattr(client.enums.KeywordMatchTypeEnum, match_type.upper())
        c.negative = bool(negative)
        resp = svc.mutate_ad_group_criteria(customer_id=customer_id, operations=[op])
        return {'criterion_resource': resp.results[0].resource_name}
    return _run(_call, context='add keyword')


def remove_keyword(ad_account, ad_group_id, criterion_id):
    client, customer_id = _client_for(ad_account)
    agid, crid = _digits(ad_group_id), _digits(criterion_id)

    def _call():
        svc = client.get_service('AdGroupCriterionService')
        op = client.get_type('AdGroupCriterionOperation')
        op.remove = f'customers/{customer_id}/adGroupCriteria/{agid}~{crid}'
        svc.mutate_ad_group_criteria(customer_id=customer_id, operations=[op])
        return {'removed': True}
    return _run(_call, context='remove keyword')


def list_ads(ad_account, campaign_id):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)
    query = (f"SELECT ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status, "
             f"ad_group.id FROM ad_group_ad WHERE ad_group.campaign = "
             f"'customers/{customer_id}/campaigns/{cid}' AND ad_group_ad.status != 'REMOVED'")

    def _call():
        ga = client.get_service('GoogleAdsService')
        return [{'ad_id': str(r.ad_group_ad.ad.id), 'ad_group_id': str(r.ad_group.id),
                 'type': r.ad_group_ad.ad.type_.name, 'status': r.ad_group_ad.status.name}
                for r in ga.search(customer_id=customer_id, query=query)]
    return _run(_call, context='list ads')


def set_ad_status(ad_account, ad_group_id, ad_id, status):
    """Pause/enable an ad (via AdGroupAd.status)."""
    client, customer_id = _client_for(ad_account)
    agid, adid = _digits(ad_group_id), _digits(ad_id)

    def _call():
        from google.protobuf import field_mask_pb2
        svc = client.get_service('AdGroupAdService')
        op = client.get_type('AdGroupAdOperation')
        op.update.resource_name = f'customers/{customer_id}/adGroupAds/{agid}~{adid}'
        op.update.status = getattr(client.enums.AdGroupAdStatusEnum, status.upper())
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=['status']))
        svc.mutate_ad_group_ads(customer_id=customer_id, operations=[op])
        return {'updated': True}
    return _run(_call, context='set ad status')


def remove_ad(ad_account, ad_group_id, ad_id):
    client, customer_id = _client_for(ad_account)
    agid, adid = _digits(ad_group_id), _digits(ad_id)

    def _call():
        svc = client.get_service('AdGroupAdService')
        op = client.get_type('AdGroupAdOperation')
        op.remove = f'customers/{customer_id}/adGroupAds/{agid}~{adid}'
        svc.mutate_ad_group_ads(customer_id=customer_id, operations=[op])
        return {'removed': True}
    return _run(_call, context='remove ad')


# ═══════════════════ Shared budgets + portfolio strategies ══════════════════

def create_shared_budget(ad_account, name, daily_usd):
    client, customer_id = _client_for(ad_account)

    def _call():
        svc = client.get_service('CampaignBudgetService')
        op = client.get_type('CampaignBudgetOperation')
        b = op.create
        b.name = name[:255]
        b.amount_micros = int(round(float(daily_usd) * 1_000_000))
        b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b.explicitly_shared = True
        resp = svc.mutate_campaign_budgets(customer_id=customer_id, operations=[op])
        return {'budget_resource': resp.results[0].resource_name}
    return _run(_call, context='create shared budget')


def list_shared_budgets(ad_account):
    client, customer_id = _client_for(ad_account)
    query = ('SELECT campaign_budget.id, campaign_budget.name, '
             'campaign_budget.amount_micros, campaign_budget.explicitly_shared '
             'FROM campaign_budget WHERE campaign_budget.explicitly_shared = true')

    def _call():
        ga = client.get_service('GoogleAdsService')
        return [{'id': str(r.campaign_budget.id), 'name': r.campaign_budget.name,
                 'daily_usd': (r.campaign_budget.amount_micros or 0) / 1_000_000}
                for r in ga.search(customer_id=customer_id, query=query)]
    return _run(_call, context='list shared budgets')


def attach_budget_to_campaign(ad_account, campaign_id, budget_resource):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)

    def _call():
        from google.protobuf import field_mask_pb2
        svc = client.get_service('CampaignService')
        op = client.get_type('CampaignOperation')
        op.update.resource_name = f'customers/{customer_id}/campaigns/{cid}'
        op.update.campaign_budget = budget_resource
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=['campaign_budget']))
        svc.mutate_campaigns(customer_id=customer_id, operations=[op])
        return {'attached': True}
    return _run(_call, context='attach budget')


def create_portfolio_strategy(ad_account, name, strategy, target_cpa_usd=0, target_roas=0):
    """Create a shared (portfolio) bidding strategy.

    strategy ∈ {target_cpa, target_roas, maximize_conversions, maximize_conversion_value}.
    """
    client, customer_id = _client_for(ad_account)
    s = (strategy or '').lower()

    def _call():
        svc = client.get_service('BiddingStrategyService')
        op = client.get_type('BiddingStrategyOperation')
        bs = op.create
        bs.name = name[:255]
        if s == 'target_cpa':
            bs.target_cpa.target_cpa_micros = int(round(float(target_cpa_usd) * 1_000_000))
        elif s == 'target_roas':
            bs.target_roas.target_roas = float(target_roas)
        elif s == 'maximize_conversions':
            if target_cpa_usd:
                bs.maximize_conversions.target_cpa_micros = int(round(float(target_cpa_usd) * 1_000_000))
            else:
                bs.maximize_conversions = client.get_type('MaximizeConversions')
        elif s == 'maximize_conversion_value':
            if target_roas:
                bs.maximize_conversion_value.target_roas = float(target_roas)
            else:
                bs.maximize_conversion_value = client.get_type('MaximizeConversionValue')
        else:
            raise GoogleAdsError(f'Unsupported portfolio strategy {strategy!r}.')
        resp = svc.mutate_bidding_strategies(customer_id=customer_id, operations=[op])
        return {'strategy_resource': resp.results[0].resource_name}
    return _run(_call, context='create portfolio strategy')


def list_portfolio_strategies(ad_account):
    client, customer_id = _client_for(ad_account)
    query = ('SELECT bidding_strategy.id, bidding_strategy.name, bidding_strategy.type '
             'FROM bidding_strategy')

    def _call():
        ga = client.get_service('GoogleAdsService')
        return [{'id': str(r.bidding_strategy.id), 'name': r.bidding_strategy.name,
                 'type': r.bidding_strategy.type_.name}
                for r in ga.search(customer_id=customer_id, query=query)]
    return _run(_call, context='list portfolio strategies')


def attach_strategy_to_campaign(ad_account, campaign_id, strategy_resource):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)

    def _call():
        from google.protobuf import field_mask_pb2
        svc = client.get_service('CampaignService')
        op = client.get_type('CampaignOperation')
        op.update.resource_name = f'customers/{customer_id}/campaigns/{cid}'
        op.update.bidding_strategy = strategy_resource
        client.copy_from(op.update_mask, field_mask_pb2.FieldMask(paths=['bidding_strategy']))
        svc.mutate_campaigns(customer_id=customer_id, operations=[op])
        return {'attached': True}
    return _run(_call, context='attach strategy')


# ═══════════════════════════ Segment breakdowns ═════════════════════════════

_PRESETS = {
    'today': 'TODAY', 'yesterday': 'YESTERDAY', 'last_7d': 'LAST_7_DAYS',
    'last_14d': 'LAST_14_DAYS', 'last_30d': 'LAST_30_DAYS',
    'this_month': 'THIS_MONTH', 'last_month': 'LAST_MONTH',
}


def get_segment_breakdown(ad_account, campaign_id, segment='device', date_preset='last_30d'):
    """Metrics broken down by a segment.

    segment ∈ {device, hour, day_of_week, geo}. geo uses geographic_view.
    Returns [{segment, impressions, clicks, cost_micros, conversions}].
    """
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)
    during = _PRESETS.get(date_preset, 'LAST_30_DAYS')
    metrics = ('metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions')

    if segment == 'geo':
        # geographic_view requires campaign.id in the SELECT clause.
        query = (f"SELECT campaign.id, segments.geo_target_region, {metrics} "
                 f"FROM geographic_view "
                 f"WHERE campaign.id = {cid} AND segments.date DURING {during}")
        seg_field = 'geo_target_region'
    elif segment == 'hour':
        query = (f"SELECT segments.hour, {metrics} FROM campaign "
                 f"WHERE campaign.id = {cid} AND segments.date DURING {during}")
        seg_field = 'hour'
    elif segment == 'day_of_week':
        query = (f"SELECT segments.day_of_week, {metrics} FROM campaign "
                 f"WHERE campaign.id = {cid} AND segments.date DURING {during}")
        seg_field = 'day_of_week'
    else:  # device
        query = (f"SELECT segments.device, {metrics} FROM campaign "
                 f"WHERE campaign.id = {cid} AND segments.date DURING {during}")
        seg_field = 'device'

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for r in ga.search(customer_id=customer_id, query=query):
            seg = r.segments
            if seg_field == 'device':
                label = seg.device.name
            elif seg_field == 'hour':
                label = str(seg.hour)
            elif seg_field == 'day_of_week':
                label = seg.day_of_week.name
            else:
                label = seg.geo_target_region
            m = r.metrics
            out.append({'segment': label, 'impressions': int(m.impressions or 0),
                        'clicks': int(m.clicks or 0), 'cost_micros': int(m.cost_micros or 0),
                        'conversions': float(m.conversions or 0)})
        return out
    return _run(_call, context='segment breakdown')


# ═══════════════════════════ Recommendations ════════════════════════════════

def list_recommendations(ad_account, limit=50):
    client, customer_id = _client_for(ad_account)
    query = ('SELECT recommendation.type, recommendation.campaign, '
             'recommendation.resource_name FROM recommendation '
             f'LIMIT {int(limit)}')

    def _call():
        ga = client.get_service('GoogleAdsService')
        return [{'type': r.recommendation.type_.name,
                 'campaign': r.recommendation.campaign,
                 'resource_name': r.recommendation.resource_name}
                for r in ga.search(customer_id=customer_id, query=query)]
    return _run(_call, context='list recommendations')


def apply_recommendation(ad_account, recommendation_resource):
    client, customer_id = _client_for(ad_account)

    def _call():
        svc = client.get_service('RecommendationService')
        op = client.get_type('ApplyRecommendationOperation')
        op.resource_name = recommendation_resource
        resp = svc.apply_recommendation(customer_id=customer_id, operations=[op])
        return {'applied': resp.results[0].resource_name if resp.results else ''}
    return _run(_call, context='apply recommendation')


def dismiss_recommendation(ad_account, recommendation_resource):
    client, customer_id = _client_for(ad_account)

    def _call():
        svc = client.get_service('RecommendationService')
        op = client.get_type('DismissRecommendationRequest.DismissRecommendationOperation')
        op.resource_name = recommendation_resource
        svc.dismiss_recommendation(customer_id=customer_id, operations=[op])
        return {'dismissed': True}
    return _run(_call, context='dismiss recommendation')


# ═══════════════════════════ Keyword Planner ════════════════════════════════

def keyword_ideas(ad_account, seeds=None, url='', language='en',
                  geo_codes=None, limit=50):
    """Generate keyword ideas with search volume + competition.

    seeds: list of seed keywords. url: optional landing page. Returns
    [{text, avg_monthly_searches, competition, low_bid_micros, high_bid_micros}].
    """
    from ads.services.google_ads import LANGUAGE_CONSTANTS, GEO_TARGET_CONSTANTS
    client, customer_id = _client_for(ad_account)
    seeds = [s.strip() for s in (seeds or []) if s and s.strip()]
    lang_id = LANGUAGE_CONSTANTS.get((language or 'en').lower(), 1000)
    geo_ids = [GEO_TARGET_CONSTANTS.get((g or '').upper()) for g in (geo_codes or ['US'])]
    geo_ids = [g for g in geo_ids if g]

    def _call():
        svc = client.get_service('KeywordPlanIdeaService')
        req = client.get_type('GenerateKeywordIdeasRequest')
        req.customer_id = customer_id
        req.language = f'languageConstants/{lang_id}'
        for gid in geo_ids:
            req.geo_target_constants.append(f'geoTargetConstants/{gid}')
        req.keyword_plan_network = (
            client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH_AND_PARTNERS)
        if url and seeds:
            req.keyword_and_url_seed.url = url
            req.keyword_and_url_seed.keywords.extend(seeds)
        elif url:
            req.url_seed.url = url
        else:
            req.keyword_seed.keywords.extend(seeds or [])
        out = []
        for idea in svc.generate_keyword_ideas(request=req):
            m = idea.keyword_idea_metrics
            out.append({'text': idea.text,
                        'avg_monthly_searches': int(m.avg_monthly_searches or 0),
                        'competition': m.competition.name,
                        'low_bid_micros': int(m.low_top_of_page_bid_micros or 0),
                        'high_bid_micros': int(m.high_top_of_page_bid_micros or 0)})
            if len(out) >= limit:
                break
        return out
    return _run(_call, context='keyword ideas')


# ═══════════════════════════ Change history ═════════════════════════════════

def change_history(ad_account, days=14, limit=200):
    client, customer_id = _client_for(ad_account)
    during = 'LAST_14_DAYS' if days <= 14 else 'LAST_30_DAYS'
    query = ('SELECT change_event.change_date_time, change_event.change_resource_type, '
             'change_event.resource_name, change_event.client_type, '
             'change_event.user_email, change_event.resource_change_operation '
             f'FROM change_event WHERE change_event.change_date_time DURING {during} '
             f'ORDER BY change_event.change_date_time DESC LIMIT {int(min(limit, 10000))}')

    def _call():
        ga = client.get_service('GoogleAdsService')
        out = []
        for r in ga.search(customer_id=customer_id, query=query):
            ce = r.change_event
            out.append({'date_time': ce.change_date_time,
                        'resource_type': ce.change_resource_type.name,
                        'operation': ce.resource_change_operation.name,
                        'user_email': ce.user_email,
                        'client_type': ce.client_type.name})
        return out
    return _run(_call, context='change history')


# ═══════════════════════════ Labels ═════════════════════════════════════════

def create_label(ad_account, name, color='#1a73e8', description=''):
    client, customer_id = _client_for(ad_account)

    def _call():
        svc = client.get_service('LabelService')
        op = client.get_type('LabelOperation')
        op.create.name = name[:80]
        op.create.text_label.background_color = color
        op.create.text_label.description = description[:200]
        resp = svc.mutate_labels(customer_id=customer_id, operations=[op])
        return {'label_resource': resp.results[0].resource_name}
    return _run(_call, context='create label')


def list_labels(ad_account):
    client, customer_id = _client_for(ad_account)
    query = 'SELECT label.id, label.name, label.text_label.background_color FROM label'

    def _call():
        ga = client.get_service('GoogleAdsService')
        return [{'id': str(r.label.id), 'name': r.label.name,
                 'color': r.label.text_label.background_color}
                for r in ga.search(customer_id=customer_id, query=query)]
    return _run(_call, context='list labels')


def label_campaign(ad_account, campaign_id, label_resource):
    client, customer_id = _client_for(ad_account)
    cid = _digits(campaign_id)

    def _call():
        svc = client.get_service('CampaignLabelService')
        op = client.get_type('CampaignLabelOperation')
        op.create.campaign = f'customers/{customer_id}/campaigns/{cid}'
        op.create.label = label_resource
        svc.mutate_campaign_labels(customer_id=customer_id, operations=[op])
        return {'labeled': True}
    return _run(_call, context='label campaign')


# ═══════════════════════════ Experiments (A/B at campaign level) ═════════════
#
# Google Ads experiment flow (API v21):
#   1. ExperimentService.mutate_experiments  → create the Experiment shell.
#   2. ExperimentArmService.mutate_experiment_arms  → create exactly two arms in
#      one call: a CONTROL arm (control=True, references the base campaign) and a
#      TREATMENT arm (control=False, traffic_split). Creating the treatment arm
#      auto-generates a *draft trial campaign* (a copy of the base) whose resource
#      name comes back in arm_result.experiment_arm + the in_design_campaigns.
#   3. Edit the trial campaign with the normal ad-group/keyword/budget editors
#      (its campaign id is returned as `trial_campaign_id`).
#   4. ExperimentService.schedule_experiment  → go live.
#   5. end / promote / graduate / list as needed.

def create_experiment(ad_account, base_campaign_id, name, *,
                      traffic_split=50, description='', goals=None):
    """Create an experiment + its control/treatment arms in one shot.

    `traffic_split` is the % of traffic sent to the treatment (1-99); the control
    gets the remainder. Returns the experiment + the auto-created trial campaign
    id so the caller can edit the variant. `goals` is an optional list of
    {metric, direction} (metric ∈ CLICKS/IMPRESSIONS/COST/CONVERSIONS/...).
    """
    client, customer_id = _client_for(ad_account)
    base_cid = _digits(base_campaign_id)
    split = max(1, min(99, int(traffic_split)))

    def _call():
        exp_svc = client.get_service('ExperimentService')
        exp_op = client.get_type('ExperimentOperation')
        exp = exp_op.create
        exp.name = name[:255]
        if description:
            exp.description = description[:1000]
        exp.suffix = '[experiment]'
        exp.type_ = client.enums.ExperimentTypeEnum.SEARCH_CUSTOM
        exp.status = client.enums.ExperimentStatusEnum.SETUP
        for g in (goals or []):
            metric = (g.get('metric') or '').upper()
            direction = (g.get('direction') or 'INCREASE').upper()
            if not metric:
                continue
            goal = client.get_type('ExperimentMetricGoal')
            goal.metric = getattr(client.enums.ExperimentMetricEnum, metric,
                                  client.enums.ExperimentMetricEnum.CLICKS)
            goal.direction = getattr(client.enums.ExperimentMetricDirectionEnum, direction,
                                     client.enums.ExperimentMetricDirectionEnum.INCREASE)
            exp.goals.append(goal)
        exp_resp = exp_svc.mutate_experiments(customer_id=customer_id, operations=[exp_op])
        experiment_resource = exp_resp.results[0].resource_name

        # Two arms in a single mutate: control (references base) + treatment.
        arm_svc = client.get_service('ExperimentArmService')
        control_op = client.get_type('ExperimentArmOperation')
        ctrl = control_op.create
        ctrl.experiment = experiment_resource
        ctrl.name = 'Control'
        ctrl.control = True
        ctrl.traffic_split = 100 - split
        ctrl.campaigns.append(f'customers/{customer_id}/campaigns/{base_cid}')

        treat_op = client.get_type('ExperimentArmOperation')
        treat = treat_op.create
        treat.experiment = experiment_resource
        treat.name = 'Treatment'
        treat.control = False
        treat.traffic_split = split

        arm_resp = arm_svc.mutate_experiment_arms(
            customer_id=customer_id, operations=[control_op, treat_op])

        # The treatment arm carries the auto-created trial campaign. There's no
        # get_experiment_arm on the client, so read it back via GAQL.
        ga = client.get_service('GoogleAdsService')
        arm_q = ('SELECT experiment_arm.in_design_campaigns '
                 'FROM experiment_arm '
                 f"WHERE experiment_arm.experiment = '{experiment_resource}' "
                 'AND experiment_arm.control = false')
        trial_campaign = ''
        for r in ga.search(customer_id=customer_id, query=arm_q):
            if r.experiment_arm.in_design_campaigns:
                trial_campaign = r.experiment_arm.in_design_campaigns[0]
                break
        trial_campaign_id = trial_campaign.split('/')[-1] if trial_campaign else ''

        exp_id = experiment_resource.split('/')[-1]
        return {
            'experiment_id': exp_id,
            'experiment_resource': experiment_resource,
            'trial_campaign_resource': trial_campaign,
            'trial_campaign_id': trial_campaign_id,
            'traffic_split': split,
        }
    return _run(_call, context='create experiment')


def schedule_experiment(ad_account, experiment_id, validate_only=False):
    """Launch the experiment (validate first if asked)."""
    client, customer_id = _client_for(ad_account)
    eid = _digits(experiment_id)

    def _call():
        svc = client.get_service('ExperimentService')
        req = client.get_type('ScheduleExperimentRequest')
        req.resource_name = f'customers/{customer_id}/experiments/{eid}'
        req.validate_only = bool(validate_only)
        svc.schedule_experiment(request=req)
        return {'scheduled': True, 'experiment_id': eid}
    return _run(_call, context='schedule experiment')


def end_experiment(ad_account, experiment_id):
    """Stop a running experiment immediately."""
    client, customer_id = _client_for(ad_account)
    eid = _digits(experiment_id)

    def _call():
        svc = client.get_service('ExperimentService')
        req = client.get_type('EndExperimentRequest')
        req.experiment = f'customers/{customer_id}/experiments/{eid}'
        svc.end_experiment(request=req)
        return {'ended': True, 'experiment_id': eid}
    return _run(_call, context='end experiment')


def promote_experiment(ad_account, experiment_id):
    """Promote the treatment: apply the trial campaign's changes onto the base
    campaign and end the experiment. Async — Google returns an operation handle."""
    client, customer_id = _client_for(ad_account)
    eid = _digits(experiment_id)

    def _call():
        svc = client.get_service('ExperimentService')
        req = client.get_type('PromoteExperimentRequest')
        req.resource_name = f'customers/{customer_id}/experiments/{eid}'
        op = svc.promote_experiment(request=req)
        return {'promoting': True, 'experiment_id': eid,
                'operation': getattr(op, 'name', '') or str(getattr(op, 'metadata', ''))}
    return _run(_call, context='promote experiment')


def graduate_experiment(ad_account, experiment_id, budget_resource):
    """Graduate: keep the trial campaign as a permanent standalone campaign,
    attached to `budget_resource` (a campaign-budget resource name)."""
    client, customer_id = _client_for(ad_account)
    eid = _digits(experiment_id)

    def _call():
        svc = client.get_service('ExperimentService')
        req = client.get_type('GraduateExperimentRequest')
        req.experiment = f'customers/{customer_id}/experiments/{eid}'
        mapping = client.get_type('CampaignBudgetMapping')
        # graduate needs each experiment campaign mapped to a budget.
        arm_query = (
            'SELECT experiment_arm.in_design_campaigns '
            'FROM experiment_arm '
            f"WHERE experiment_arm.experiment = 'customers/{customer_id}/experiments/{eid}' "
            'AND experiment_arm.control = false')
        ga = client.get_service('GoogleAdsService')
        trial = ''
        for r in ga.search(customer_id=customer_id, query=arm_query):
            if r.experiment_arm.in_design_campaigns:
                trial = r.experiment_arm.in_design_campaigns[0]
                break
        if not trial:
            raise GoogleAdsError('No trial campaign found to graduate.')
        mapping.experiment_campaign = trial
        mapping.campaign_budget = budget_resource
        req.campaign_budget_mappings.append(mapping)
        svc.graduate_experiment(request=req)
        return {'graduated': True, 'experiment_id': eid}
    return _run(_call, context='graduate experiment')


def list_experiments(ad_account, limit=100):
    """List experiments with status + arms (control/treatment campaign ids)."""
    client, customer_id = _client_for(ad_account)

    def _call():
        ga = client.get_service('GoogleAdsService')
        exp_q = ('SELECT experiment.experiment_id, experiment.name, experiment.status, '
                 'experiment.type, experiment.description, experiment.start_date, '
                 'experiment.end_date FROM experiment ORDER BY experiment.experiment_id DESC')
        experiments = {}
        for r in ga.search(customer_id=customer_id, query=exp_q):
            e = r.experiment
            experiments[str(e.experiment_id)] = {
                'id': str(e.experiment_id),
                'resource_name': f'customers/{customer_id}/experiments/{e.experiment_id}',
                'name': e.name,
                'status': e.status.name,
                'type': e.type_.name,
                'description': e.description,
                'start_date': e.start_date,
                'end_date': e.end_date,
                'arms': [],
            }
            if len(experiments) >= limit:
                break
        # Attach arms.
        arm_q = ('SELECT experiment_arm.experiment, experiment_arm.name, '
                 'experiment_arm.control, experiment_arm.traffic_split, '
                 'experiment_arm.campaigns, experiment_arm.in_design_campaigns '
                 'FROM experiment_arm')
        for r in ga.search(customer_id=customer_id, query=arm_q):
            a = r.experiment_arm
            exp_id = a.experiment.split('/')[-1]
            if exp_id in experiments:
                camps = list(a.campaigns) + list(a.in_design_campaigns)
                experiments[exp_id]['arms'].append({
                    'name': a.name,
                    'control': bool(a.control),
                    'traffic_split': int(a.traffic_split or 0),
                    'campaign_id': camps[0].split('/')[-1] if camps else '',
                })
        return list(experiments.values())
    return _run(_call, context='list experiments')


def experiment_results(ad_account, experiment_id, date_preset='last_30d'):
    """Side-by-side control vs treatment metrics for an experiment.

    Pulls each arm's campaign metrics so the UI can show the A/B comparison.
    """
    client, customer_id = _client_for(ad_account)
    eid = _digits(experiment_id)
    during = _PRESETS.get(date_preset, 'LAST_30_DAYS')

    def _call():
        ga = client.get_service('GoogleAdsService')
        arm_q = ('SELECT experiment_arm.name, experiment_arm.control, '
                 'experiment_arm.campaigns, experiment_arm.in_design_campaigns '
                 'FROM experiment_arm '
                 f"WHERE experiment_arm.experiment = 'customers/{customer_id}/experiments/{eid}'")
        arms = []
        for r in ga.search(customer_id=customer_id, query=arm_q):
            a = r.experiment_arm
            camps = list(a.campaigns) + list(a.in_design_campaigns)
            arms.append({'name': a.name, 'control': bool(a.control),
                         'campaign_id': camps[0].split('/')[-1] if camps else ''})

        metrics = ('metrics.impressions, metrics.clicks, metrics.cost_micros, '
                   'metrics.conversions, metrics.conversions_value, metrics.ctr, '
                   'metrics.average_cpc')
        out = []
        for arm in arms:
            row = {'name': arm['name'], 'control': arm['control'],
                   'impressions': 0, 'clicks': 0, 'cost_micros': 0,
                   'conversions': 0.0, 'conversions_value': 0.0, 'ctr': 0.0,
                   'average_cpc_micros': 0}
            if arm['campaign_id']:
                mq = (f'SELECT {metrics} FROM campaign '
                      f"WHERE campaign.id = {arm['campaign_id']} "
                      f'AND segments.date DURING {during}')
                for r in ga.search(customer_id=customer_id, query=mq):
                    m = r.metrics
                    row.update({
                        'impressions': int(m.impressions or 0),
                        'clicks': int(m.clicks or 0),
                        'cost_micros': int(m.cost_micros or 0),
                        'conversions': float(m.conversions or 0),
                        'conversions_value': float(m.conversions_value or 0),
                        'ctr': float(m.ctr or 0),
                        'average_cpc_micros': int(m.average_cpc or 0),
                    })
            out.append(row)
        return out
    return _run(_call, context='experiment results')
