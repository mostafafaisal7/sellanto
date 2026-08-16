"""
Ads API views.

Endpoints (mounted under /api/v1/ads/ in api/urls.py):
    GET    /ads/accounts/                — list user's connected ad accounts
    POST   /ads/accounts/connect-meta/   — exchange OAuth token → save ad account(s)
    GET    /ads/campaigns/               — list user's campaigns
    POST   /ads/campaigns/               — create draft campaign (not launched)
    GET    /ads/campaigns/<id>/          — retrieve one campaign
    PATCH  /ads/campaigns/<id>/          — update draft fields
    POST   /ads/campaigns/<id>/pause/    — pause a running campaign
    POST   /ads/campaigns/<id>/resume/   — resume a paused campaign
    GET    /ads/campaigns/<id>/insights/ — pull live insights from Meta
    POST   /ads/boost-post/              — MVP killer feature: boost an organic post
"""
import logging
import math
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ads.models import AdAccount, AdCampaign, AdCampaignDraft, AdInsight
from ads.services import meta_ads
from ads.services import google_ads as gads
from ads.services.token_encryption import encrypt_token
from brands.models import Brand
from posts.models import Post

logger = logging.getLogger(__name__)


def _parse_bool(value, default=False):
    """Parse a bool from JSON/form data ('true'/'false'/1/0)."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ('true', '1', 'yes', 'on')
    return default


def _num(v, default=0.0):
    """Coerce a Meta insight scalar (often a string) to float."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _meta_first_roas(row):
    """Return purchase_roas[0].value as a float (0.0 when absent).

    Meta returns `purchase_roas` as a list of {action_type, value}; the first
    entry is the omni/purchase ROAS. Falls back to website_purchase_roas.
    """
    for key in ('purchase_roas', 'website_purchase_roas'):
        arr = row.get(key)
        if isinstance(arr, list) and arr:
            return _num(arr[0].get('value'))
    return 0.0


# Conversion action types we treat as "the" CPA/conversion for a row, in
# priority order — first one present in cost_per_action_type / actions wins.
_META_CONVERSION_ACTIONS = (
    'purchase', 'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'lead', 'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
    'complete_registration',
    'offsite_conversion.fb_pixel_complete_registration',
)


def _meta_action_amount(arr):
    """Pick the highest-priority conversion action value from a Meta
    action-style list [{action_type, value}, ...]. Returns float (0.0 if none).
    """
    if not isinstance(arr, list):
        return 0.0
    by_type = {a.get('action_type'): _num(a.get('value')) for a in arr
               if isinstance(a, dict)}
    for t in _META_CONVERSION_ACTIONS:
        if t in by_type:
            return by_type[t]
    return 0.0


def _meta_cpa(row):
    """Cost per (priority) conversion action from cost_per_action_type.

    Returns float in account currency units (0.0 when absent).
    """
    return _meta_action_amount(row.get('cost_per_action_type'))


def _meta_conversions(row):
    """Count of the priority conversion action from the row's `actions`."""
    return _meta_action_amount(row.get('actions'))


def _meta_link_clicks(row):
    """inline_link_clicks as int (0 when absent)."""
    return int(_num(row.get('inline_link_clicks')))


# Friendly targeting keys that, if present, mean the incoming dict is the
# frontend's "friendly" shape and must be run through build_targeting_spec.
_FRIENDLY_TARGETING_KEYS = (
    'geo', 'placements', 'interests', 'behaviors', 'custom_audiences',
)


def _normalize_targeting(targeting):
    """Convert an incoming friendly targeting dict to a Meta targeting spec.

    The frontend sends a friendly dict that may contain a pre-shaped
    `geo_locations` plus flat `interests`/`behaviors` ids, `placements`
    tokens and `custom_audiences` ids. Meta expects `flexible_spec`,
    `publisher_platforms`/`*_positions`, and `custom_audiences: [{id}]`
    instead — build_targeting_spec produces exactly that.

    Backward-compat: if the dict already looks like a valid Meta spec
    (no friendly-only keys such as placements/interests/behaviors/
    custom_audiences/geo, i.e. just geo_locations + age/genders), it is
    returned unchanged so existing callers keep working identically.
    """
    if not isinstance(targeting, dict) or not targeting:
        return targeting

    has_friendly = any(k in targeting for k in _FRIENDLY_TARGETING_KEYS)
    if not has_friendly:
        # Already a Meta-ready spec (or trivial age/gender-only) — pass as-is.
        return targeting

    # Build the friendly dict build_targeting_spec expects. Prefer an explicit
    # `geo` key; otherwise reshape a pre-shaped `geo_locations` under `geo`
    # (build_targeting_spec passes a non-country-keyed dict straight through).
    friendly = {
        'age_min': targeting.get('age_min'),
        'age_max': targeting.get('age_max'),
        'genders': targeting.get('genders'),
        'interests': targeting.get('interests'),
        'behaviors': targeting.get('behaviors'),
        'placements': targeting.get('placements'),
        'custom_audiences': targeting.get('custom_audiences'),
        'geo': targeting.get('geo') or targeting.get('geo_locations'),
    }
    return meta_ads.build_targeting_spec(friendly)


def _live_spend_guard(ad_account: 'AdAccount', request):
    """Block accidental real-money spend on LIVE (non-sandbox) ad accounts.

    Sandbox accounts (Meta account_status == 101) run freely — no confirmation.
    For any non-sandbox account, the caller must pass confirm_live=true, so the
    UI can surface a "this spends real money" warning first.

    Returns None when the action may proceed, or a DRF Response (HTTP 409) that
    the caller should return immediately when confirmation is required.
    """
    if getattr(ad_account, 'is_sandbox', False):
        return None  # test account — safe, no confirmation needed

    if _parse_bool(request.data.get('confirm_live')):
        return None  # user explicitly confirmed real spend

    return Response(
        {
            'error': 'live_ad_account_confirmation_required',
            'detail': (
                f'"{ad_account.name or ad_account.external_id}" is a LIVE ad '
                f'account — this action can spend real money. Re-submit with '
                f'confirm_live=true to proceed, or pick a Sandbox (test) account.'
            ),
            'requires_confirmation': True,
            'is_sandbox': False,
            'account_name': ad_account.name,
            'external_id': ad_account.external_id,
        },
        status=status.HTTP_409_CONFLICT,
    )


def _friendly_meta_error(e, ad_account=None) -> str:
    """Turn a raw MetaAdsError into a message a user can act on.

    Meta collapses several very different problems into the same opaque
    "Permission error" (code 200 / subcode 1487194,
    has_write_ad_account_permissions:false). The most common cause we've
    observed is trying to create an ad *creative* on a Sandbox (test) ad
    account — Meta lets you create the campaign + ad set there but blocks the
    creative, so the generic permission text is misleading.
    """
    raw = e.raw or {}
    subcode = e.subcode or raw.get('error_subcode')

    if subcode == 1487194:
        if ad_account is not None and getattr(ad_account, 'is_sandbox', False):
            return (
                'This is a Sandbox (test) ad account. Meta lets you create the '
                'campaign structure here but blocks the actual ad creative, so '
                'ads can\'t be fully created or delivered on it. To test the full '
                'flow, use a real ad account and keep the campaign paused '
                '(no budget is spent until you activate it).'
            )
        return (
            'You don\'t have permission to create ads on this ad account. Make '
            'sure you have Advertiser or Admin access to it in Meta Business '
            'Settings, that a Facebook Page is linked to the account, and that '
            'the account is active with a valid payment method.'
        )

    # Fall back to Meta's own user-facing text when it provides one.
    display = ' - '.join(filter(None, [raw.get('error_user_title'),
                                       raw.get('error_user_msg')]))
    return display or str(e)


def _serialize_account(a: AdAccount) -> dict:
    return {
        'id': a.id,
        'provider': a.provider,
        'external_id': a.external_id,
        'name': a.name,
        'currency_code': a.currency_code,
        'timezone_name': a.timezone_name,
        'account_status': a.account_status,
        'is_sandbox': a.is_sandbox,
        'is_active': a.is_active,
        'last_synced_at': a.last_synced_at.isoformat() if a.last_synced_at else None,
        'created_at': a.created_at.isoformat(),
    }


def _serialize_campaign(c: AdCampaign) -> dict:
    return {
        'id': c.id,
        'name': c.name,
        'objective': c.objective,
        'status': c.status,
        'provider': c.ad_account.provider,
        'ad_account_id': c.ad_account_id,
        'brand_id': c.brand_id,
        'boosted_post_id': c.boosted_post_id,
        'external_campaign_id': c.external_campaign_id,
        'external_ad_id': c.external_ad_id,
        'daily_budget_minor': c.daily_budget_minor,
        'spend_to_date_minor': c.spend_to_date_minor,
        'start_date': c.start_date.isoformat() if c.start_date else None,
        'end_date': c.end_date.isoformat() if c.end_date else None,
        'rejection_reason': c.rejection_reason,
        'created_at': c.created_at.isoformat(),
    }


# ─────────────────────────── Ad Accounts ────────────────────────────


class AdAccountListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = AdAccount.objects.filter(user=request.user, is_active=True)
        provider = request.GET.get('provider')
        if provider in ('meta', 'google'):
            accounts = accounts.filter(provider=provider)
        return Response({
            'accounts': [_serialize_account(a) for a in accounts],
        })


class ConnectMetaAdAccountView(APIView):
    """POST { user_access_token } → enumerates ad accounts the user has access
    to and stores them. Idempotent: re-running updates name/currency.

    The token passed in is the long-lived user token already exchanged during
    Sellanto's standard FB OAuth flow. We store it (encrypted) per ad account.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_token = (request.data.get('user_access_token') or '').strip()
        brand_id = request.data.get('brand_id')

        if not user_token:
            return Response(
                {'error': 'user_access_token required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            accounts_data = meta_ads.list_user_ad_accounts(user_token)
        except meta_ads.MetaAdsError as e:
            return Response(
                {'error': f'Meta API error: {e}', 'code': e.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception('ad account enumeration failed')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not accounts_data:
            return Response({
                'connected': [],
                'message': 'No ad accounts found for this user. Verify ads_management permission was granted.',
            })

        brand = None
        if brand_id:
            try:
                brand = Brand.objects.get(id=brand_id, user=request.user)
            except Brand.DoesNotExist:
                pass

        connected = []
        for a in accounts_data:
            obj, _ = AdAccount.objects.update_or_create(
                user=request.user,
                provider='meta',
                external_id=a['account_id'],
                defaults={
                    'brand': brand,
                    'name': a['name'],
                    'currency_code': a['currency'],
                    'timezone_name': a['timezone_name'],
                    'account_status': a.get('account_status'),
                    'is_sandbox': a.get('is_sandbox', False),
                    'business_id': a['business_id'],
                    'encrypted_token': encrypt_token(user_token),
                    'is_active': True,
                    'last_synced_at': timezone.now(),
                },
            )
            connected.append(_serialize_account(obj))

        return Response({'connected': connected, 'count': len(connected)})


# ─────────────────────────── Campaigns ──────────────────────────────


class CampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        campaigns = AdCampaign.objects.filter(user=request.user).select_related('ad_account', 'brand')
        # Optional provider filter so the Meta page shows only Meta campaigns
        # and the Google page only Google — otherwise all providers mix.
        provider = (request.GET.get('provider') or '').strip().lower()
        if provider in ('meta', 'google'):
            campaigns = campaigns.filter(ad_account__provider=provider)
        return Response({
            'campaigns': [_serialize_campaign(c) for c in campaigns],
        })


class CampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        try:
            return AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return None

    def get(self, request, pk):
        c = self._get(request, pk)
        if not c:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_campaign(c))

    def patch(self, request, pk):
        c = self._get(request, pk)
        if not c:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Draft campaigns aren't on the provider yet — edit DB fields directly.
        if c.status == 'draft':
            for field in ('name', 'daily_budget_minor', 'targeting_json', 'creative_json'):
                if field in request.data:
                    setattr(c, field, request.data[field])
            c.save()
            return Response(_serialize_campaign(c))

        # Live campaign — push name/budget changes to the provider, then sync DB.
        provider = c.ad_account.provider
        new_name = request.data.get('name')
        new_budget_usd = request.data.get('daily_budget_usd')
        new_budget_minor = request.data.get('daily_budget_minor')

        # Resolve a requested budget into provider-native minor units.
        budget_minor = None
        if new_budget_usd is not None:
            try:
                # Google = micros (×1e6); Meta = cents (×100).
                if provider == 'google':
                    budget_minor = int(round(float(new_budget_usd) * 1_000_000))
                else:
                    budget_minor = int(round(float(new_budget_usd) * 100))
            except (TypeError, ValueError):
                return Response({'error': 'Invalid daily_budget_usd.'},
                                status=status.HTTP_400_BAD_REQUEST)
        elif new_budget_minor is not None:
            try:
                budget_minor = int(new_budget_minor)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid daily_budget_minor.'},
                                status=status.HTTP_400_BAD_REQUEST)

        try:
            if new_name is not None and str(new_name).strip():
                if provider == 'google':
                    gads.update_campaign_name(c.ad_account, c.external_campaign_id, new_name)
                else:
                    meta_ads.update_campaign_name(c, new_name)
                c.name = str(new_name).strip()

            if budget_minor is not None and budget_minor > 0:
                if provider == 'google':
                    gads.update_campaign_budget_by_campaign(
                        c.ad_account, c.external_campaign_id, budget_minor)
                    c.daily_budget_minor = budget_minor // 10_000  # micros → cents for storage
                else:
                    meta_ads.update_campaign_budget(c, budget_minor)
                    c.daily_budget_minor = budget_minor
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        c.save()
        return Response(_serialize_campaign(c))

    def delete(self, request, pk):
        """Remove/archive a campaign on the provider, then mark it archived."""
        c = self._get(request, pk)
        if not c:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        provider = c.ad_account.provider
        # Draft campaigns were never sent to the provider — just delete the row.
        if c.status == 'draft' and not c.external_campaign_id:
            c.delete()
            return Response({'deleted': True})

        try:
            if provider == 'google':
                gads.remove_campaign(c.ad_account, c.external_campaign_id)
            else:
                meta_ads.remove_campaign(c)
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        c.status = 'archived'
        c.save(update_fields=['status', 'updated_at'])
        return Response({'archived': True, **_serialize_campaign(c)})


class CampaignPauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        provider = c.ad_account.provider
        try:
            if provider == 'google':
                gads.pause_campaign(c.ad_account, c.external_campaign_id)
            else:
                meta_ads.pause_campaign(c)
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        c.status = 'paused'
        c.save(update_fields=['status', 'updated_at'])
        return Response(_serialize_campaign(c))


class CampaignResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        provider = c.ad_account.provider
        try:
            if provider == 'google':
                gads.resume_campaign(c.ad_account, c.external_campaign_id)
            else:
                meta_ads.resume_campaign(c)
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        c.status = 'active'
        c.save(update_fields=['status', 'updated_at'])
        return Response(_serialize_campaign(c))


class CampaignInsightsView(APIView):
    """Pull live insights from Meta and upsert into AdInsight rows."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        date_preset = request.GET.get('date_preset', 'last_7d')

        if c.ad_account.provider == 'google':
            return self._google_insights(c, date_preset)

        try:
            rows = meta_ads.get_campaign_insights(c, date_preset=date_preset)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        saved = []
        for r in rows:
            d = r.get('date_start')
            if not d:
                continue
            try:
                day = datetime.strptime(d, '%Y-%m-%d').date()
            except ValueError:
                continue

            impressions = int(r.get('impressions', 0) or 0)
            clicks = int(r.get('clicks', 0) or 0)
            spend = int(float(r.get('spend', 0) or 0) * 100)  # USD → cents

            obj, _ = AdInsight.objects.update_or_create(
                campaign=c, date=day,
                defaults={
                    'impressions': impressions,
                    'reach': int(r.get('reach', 0) or 0),
                    'clicks': clicks,
                    'spend_minor': spend,
                    'ctr': float(r.get('ctr', 0) or 0) / 100.0,  # Meta returns %
                    'cpc_minor': int(float(r.get('cpc', 0) or 0) * 100),
                    'cpm_minor': int(float(r.get('cpm', 0) or 0) * 100),
                    'frequency': float(r.get('frequency', 0) or 0),
                    'raw_data': r,
                },
            )
            saved.append({
                'date': str(obj.date),
                'impressions': obj.impressions,
                'reach': obj.reach,
                'clicks': obj.clicks,
                'link_clicks': _meta_link_clicks(r),
                'spend_minor': obj.spend_minor,
                'ctr': obj.ctr,
                'cpc': _num(r.get('cpc')),
                'cpm': _num(r.get('cpm')),
                'frequency': obj.frequency,
                'conversions': _meta_conversions(r),
                'roas': _meta_first_roas(r),
                'cpa': _meta_cpa(r),
            })

        return Response({'insights': saved, 'count': len(saved)})

    def _google_insights(self, c, date_preset):
        """Pull Google Ads insights via GAQL and upsert into AdInsight rows.

        Google reports money in MICROS (1 unit = 1,000,000 micros) and CTR as a
        fraction (0.05 = 5%). We store spend in `spend_minor` as integer minor
        units (cents) — so micros / 10,000 = cents.
        """
        try:
            rows = gads.get_campaign_insights(
                c.ad_account, c.external_campaign_id, date_preset=date_preset,
            )
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)

        saved = []
        for r in rows:
            d = r.get('date')
            if not d:
                continue
            try:
                day = datetime.strptime(d, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                continue

            cost_micros = int(r.get('cost_micros', 0) or 0)
            spend_minor = cost_micros // 10_000  # micros → cents
            obj, _ = AdInsight.objects.update_or_create(
                campaign=c, date=day,
                defaults={
                    'impressions': int(r.get('impressions', 0) or 0),
                    'reach': 0,  # Google doesn't report reach on Search campaigns
                    'clicks': int(r.get('clicks', 0) or 0),
                    'spend_minor': spend_minor,
                    # Google conversions can be fractional (modeled). AdInsight.conversions
                    # is an IntegerField, so round rather than truncate to avoid losing data.
                    'conversions': int(round(float(r.get('conversions', 0) or 0))),
                    'conversion_value_minor': int(float(r.get('conversions_value', 0) or 0) * 100),
                    'ctr': float(r.get('ctr', 0) or 0),  # Google returns a fraction
                    'cpc_minor': int(r.get('average_cpc_micros', 0) or 0) // 10_000,
                    'cpm_minor': int(r.get('average_cpm_micros', 0) or 0) // 10_000,
                    'frequency': 0.0,
                    'raw_data': r,
                },
            )
            saved.append({
                'date': str(obj.date),
                'impressions': obj.impressions,
                'clicks': obj.clicks,
                'spend_minor': obj.spend_minor,
                'ctr': obj.ctr,
            })

        return Response({'insights': saved, 'count': len(saved)})


class MetaInsightBreakdownView(APIView):
    """Pull Meta campaign insights segmented by a breakdown dimension.

    GET /ads/campaigns/<pk>/breakdown/?date_preset=&breakdown=

    `breakdown` (allow-listed): age | gender | age,gender | publisher_platform |
    region | country | impression_device | device_platform.

    Returns {breakdown, rows: [...]}. Meta-only; not wired for Google campaigns.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if c.ad_account.provider != 'meta':
            return Response(
                {'error': 'Breakdowns are only available for Meta campaigns.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_preset = request.GET.get('date_preset', 'last_7d')
        breakdown = request.GET.get('breakdown', 'age')
        if breakdown not in meta_ads.META_INSIGHT_BREAKDOWNS:
            return Response({
                'error': f'Unsupported breakdown {breakdown!r}.',
                'allowed': sorted(meta_ads.META_INSIGHT_BREAKDOWNS.keys()),
            }, status=status.HTTP_400_BAD_REQUEST)

        # Diamond pre-check (cheap insights pull)
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_insights_pull')
            if not can_afford:
                return Response({
                    'error': 'Insufficient Diamond Tokens',
                    'diamond_cost': cost,
                    'diamond_balance': balance,
                    'code': 'INSUFFICIENT_DIAMONDS',
                }, status=402)
        except Exception:
            # Feature not yet wired in DIAMOND_COSTS — skip gracefully.
            deduct_diamonds = None

        try:
            rows = meta_ads.get_campaign_insights_breakdown(
                c, date_preset=date_preset, breakdown=breakdown,
            )
        except meta_ads.MetaAdsError as e:
            return Response(
                {'error': _friendly_meta_error(e, c.ad_account)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='ads_insights_pull', provider='meta')
            except Exception:
                logger.exception('deduct_diamonds failed for ads_insights_pull user=%s', request.user.id)

        return Response({'breakdown': breakdown, 'rows': rows})


def _serialize_rule(r):
    return {
        'id': r.id, 'campaign_id': r.campaign_id, 'name': r.name,
        'metric': r.metric, 'operator': r.operator, 'threshold': r.threshold,
        'lookback_days': r.lookback_days, 'action': r.action,
        'action_value': r.action_value, 'is_active': r.is_active,
        'last_evaluated_at': r.last_evaluated_at.isoformat() if r.last_evaluated_at else None,
        'last_triggered_at': r.last_triggered_at.isoformat() if r.last_triggered_at else None,
        'trigger_count': r.trigger_count,
    }


class AdRuleListCreateView(APIView):
    """GET → list the user's automation rules. POST → create one."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ads.models import AdRule
        qs = AdRule.objects.filter(user=request.user).select_related('campaign')
        campaign_id = request.GET.get('campaign_id')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return Response({'rules': [_serialize_rule(r) for r in qs]})

    def post(self, request):
        from ads.models import AdRule, AdCampaign
        campaign_id = request.data.get('campaign_id')
        try:
            campaign = AdCampaign.objects.get(id=campaign_id, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

        valid_metrics = {'spend', 'cpc', 'ctr', 'conversions', 'cpa'}
        valid_ops = {'gt', 'lt', 'gte', 'lte'}
        valid_actions = {'pause', 'notify', 'increase_budget', 'decrease_budget'}
        metric = (request.data.get('metric') or '').strip().lower()
        operator = (request.data.get('operator') or '').strip().lower()
        action = (request.data.get('action') or '').strip().lower()
        if metric not in valid_metrics or operator not in valid_ops or action not in valid_actions:
            return Response({'error': 'Invalid metric, operator or action.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            threshold = float(request.data.get('threshold'))
        except (TypeError, ValueError):
            return Response({'error': 'threshold must be a number.'},
                            status=status.HTTP_400_BAD_REQUEST)

        rule = AdRule.objects.create(
            user=request.user, campaign=campaign,
            name=(request.data.get('name') or f'{metric} {operator} {threshold}')[:200],
            metric=metric, operator=operator, threshold=threshold,
            lookback_days=int(request.data.get('lookback_days', 7) or 7),
            action=action, action_value=float(request.data.get('action_value', 0) or 0),
            is_active=bool(request.data.get('is_active', True)),
        )
        return Response(_serialize_rule(rule), status=status.HTTP_201_CREATED)


class AdRuleDetailView(APIView):
    """PATCH → toggle/update a rule. DELETE → remove it."""
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        from ads.models import AdRule
        return AdRule.objects.filter(id=pk, user=request.user).first()

    def patch(self, request, pk):
        rule = self._get(request, pk)
        if not rule:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        valid_metrics = {'spend', 'cpc', 'ctr', 'conversions', 'cpa'}
        valid_ops = {'gt', 'lt', 'gte', 'lte'}
        valid_actions = {'pause', 'notify', 'increase_budget', 'decrease_budget'}
        data = request.data

        # Validate/coerce each provided field before assigning — mirrors the
        # same checks as create() so PATCH can't store garbage that would later
        # crash the rule evaluator.
        try:
            if 'name' in data:
                rule.name = str(data['name'])[:200]
            if 'metric' in data:
                v = str(data['metric']).strip().lower()
                if v not in valid_metrics:
                    return Response({'error': 'Invalid metric.'}, status=status.HTTP_400_BAD_REQUEST)
                rule.metric = v
            if 'operator' in data:
                v = str(data['operator']).strip().lower()
                if v not in valid_ops:
                    return Response({'error': 'Invalid operator.'}, status=status.HTTP_400_BAD_REQUEST)
                rule.operator = v
            if 'action' in data:
                v = str(data['action']).strip().lower()
                if v not in valid_actions:
                    return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
                rule.action = v
            if 'threshold' in data:
                rule.threshold = float(data['threshold'])
            if 'action_value' in data:
                rule.action_value = float(data['action_value'])
            if 'lookback_days' in data:
                rule.lookback_days = max(1, int(data['lookback_days']))
            if 'is_active' in data:
                rule.is_active = _parse_bool(data['is_active'], default=rule.is_active)
        except (TypeError, ValueError):
            return Response({'error': 'threshold, action_value and lookback_days must be numbers.'},
                            status=status.HTTP_400_BAD_REQUEST)

        rule.save()
        return Response(_serialize_rule(rule))

    def delete(self, request, pk):
        rule = self._get(request, pk)
        if not rule:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response({'deleted': True})


# ─────────────────────────────── Audiences ──────────────────────────────────
# Saved, reusable targeting presets (AdAudience). This is a preset store the
# boost/campaign forms can reuse — it does NOT yet sync live Custom/Lookalike
# audiences to Meta (that requires the Meta Custom Audience API + user-data
# hashing, a follow-up). audience_type='saved' presets are fully functional now.

def _serialize_audience(a):
    return {
        'id': a.id,
        'name': a.name,
        'audience_type': a.audience_type,
        'ad_account_id': a.ad_account_id,
        'brand_id': a.brand_id,
        'external_id': a.external_id,
        'size_estimate': a.size_estimate,
        'config': a.config_json or {},
        'is_ready': a.is_ready,
        'created_at': a.created_at.isoformat(),
    }


class AdAudienceListCreateView(APIView):
    """GET → list the user's saved audiences. POST → create a saved preset."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ads.models import AdAudience
        qs = AdAudience.objects.filter(user=request.user).select_related('ad_account')
        ad_account_id = request.GET.get('ad_account_id')
        if ad_account_id:
            qs = qs.filter(ad_account_id=ad_account_id)
        return Response({'audiences': [_serialize_audience(a) for a in qs]})

    def post(self, request):
        from ads.models import AdAudience
        name = (request.data.get('name') or '').strip()
        audience_type = (request.data.get('audience_type') or 'saved').strip().lower()
        ad_account_id = request.data.get('ad_account_id')
        config = request.data.get('config') or {}

        if not name:
            return Response({'error': 'name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if audience_type not in ('custom', 'lookalike', 'saved'):
            return Response({'error': 'Invalid audience_type.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Ad account not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Brand is optional (account-scoped audiences); fall back to the
        # account's brand, else the user's first brand, else None. AdAudience
        # is now brand-nullable, so None is safe.
        brand = ad_account.brand
        if brand is None:
            from brands.models import Brand
            brand = Brand.objects.filter(user=request.user).first()

        external_id = ''
        size_estimate = 0

        # Custom/lookalike audiences are created LIVE on Meta; saved (rule-based)
        # presets stay local-only. Only bill + hit Meta for the live subtypes.
        if audience_type in ('custom', 'lookalike'):
            if ad_account.provider != 'meta':
                return Response(
                    {'error': 'Live audiences are supported on Meta accounts only.'},
                    status=status.HTTP_400_BAD_REQUEST)

            try:
                from accounts.services.diamond_service import pre_check, deduct_diamonds
                can_afford, cost, balance = pre_check(request.user, 'ads_audience_create')
                if not can_afford:
                    return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                     'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'},
                                    status=402)
            except Exception:
                pass

            try:
                if audience_type == 'custom':
                    external_id = meta_ads.create_custom_audience(
                        ad_account,
                        name[:200],
                        description=(config.get('description') or '') if isinstance(config, dict) else '',
                        subtype=(config.get('subtype') or 'CUSTOM') if isinstance(config, dict) else 'CUSTOM',
                    )
                else:  # lookalike
                    origin_audience_id = (config.get('origin_audience_id') or '') if isinstance(config, dict) else ''
                    if not origin_audience_id:
                        return Response(
                            {'error': 'config.origin_audience_id is required for lookalike audiences.'},
                            status=status.HTTP_400_BAD_REQUEST)
                    external_id = meta_ads.create_lookalike_audience(
                        ad_account,
                        name[:200],
                        origin_audience_id=origin_audience_id,
                        country=(config.get('country') or 'US') if isinstance(config, dict) else 'US',
                        ratio=(config.get('ratio') or 0.01) if isinstance(config, dict) else 0.01,
                    )
            except meta_ads.MetaAdsError as e:
                logger.warning(
                    'create audience failed user=%s type=%s err=%s raw=%s',
                    request.user.id, audience_type, e, e.raw,
                )
                display = _friendly_meta_error(e, ad_account)
                return Response(
                    {'error': display, 'code': e.code, 'subcode': e.subcode},
                    status=status.HTTP_400_BAD_REQUEST)

            try:
                deduct_diamonds(user=request.user, feature='ads_audience_create', provider='meta')
            except Exception:
                pass

        # Saved (rule-based) presets are immediately usable; custom/lookalike
        # need a Meta build step before they are ready.
        audience = AdAudience.objects.create(
            user=request.user,
            brand=brand,
            ad_account=ad_account,
            name=name[:200],
            audience_type=audience_type,
            external_id=external_id,
            size_estimate=size_estimate,
            config_json=config if isinstance(config, dict) else {},
            is_ready=(audience_type == 'saved'),
        )
        return Response(_serialize_audience(audience), status=status.HTTP_201_CREATED)


class AdAudienceDetailView(APIView):
    """DELETE → remove a saved audience."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        from ads.models import AdAudience
        audience = AdAudience.objects.filter(id=pk, user=request.user).first()
        if not audience:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        audience.delete()
        return Response({'deleted': True})


class MetaAudienceSyncView(APIView):
    """GET /ads/meta/audiences/live/?ad_account_id= → list LIVE Meta audiences.

    Returns the real Custom/Lookalike audiences on the Meta ad account (not the
    local AdAudience presets). Read-only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ad_account_id = request.GET.get('ad_account_id')
        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user,
                provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Ad account not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        try:
            audiences = meta_ads.list_ad_account_audiences(ad_account)
        except meta_ads.MetaAdsError as e:
            logger.warning(
                'list live audiences failed user=%s acct=%s err=%s',
                request.user.id, ad_account.id, e,
            )
            display = _friendly_meta_error(e, ad_account)
            return Response(
                {'error': display, 'code': e.code, 'subcode': e.subcode},
                status=status.HTTP_400_BAD_REQUEST)

        return Response({'audiences': audiences, 'count': len(audiences)})


class CampaignKeywordInsightsView(APIView):
    """GET /ads/campaigns/<id>/keywords/ → per-keyword performance (Google only)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if c.ad_account.provider != 'google':
            return Response({'error': 'Keyword insights are Google-only.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = gads.get_keyword_insights(
                c.ad_account, c.external_campaign_id,
                date_preset=request.GET.get('date_preset', 'last_7d'))
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        return Response({'keywords': rows, 'count': len(rows)})


class CampaignSearchTermsView(APIView):
    """GET /ads/campaigns/<id>/search-terms/ → actual queries (Google only)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if c.ad_account.provider != 'google':
            return Response({'error': 'Search terms are Google-only.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = gads.get_search_terms(
                c.ad_account, c.external_campaign_id,
                date_preset=request.GET.get('date_preset', 'last_7d'))
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        return Response({'search_terms': rows, 'count': len(rows)})


class GoogleAccountSummaryView(APIView):
    """GET /ads/google/account-summary/?ad_account_id=&date_preset= → dashboard rollup."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ad_account_id = request.GET.get('ad_account_id')
        if not ad_account_id:
            return Response({'error': 'ad_account_id is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='google', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Google ad account not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            rows = gads.get_account_summary(
                ad_account, date_preset=request.GET.get('date_preset', 'last_30d'))
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        # Compute account totals for the dashboard header.
        totals = {
            'impressions': sum(r['impressions'] for r in rows),
            'clicks': sum(r['clicks'] for r in rows),
            'cost_micros': sum(r['cost_micros'] for r in rows),
            'conversions': sum(r['conversions'] for r in rows),
            'conversions_value': sum(r['conversions_value'] for r in rows),
        }
        return Response({'campaigns': rows, 'totals': totals, 'count': len(rows)})


# ─────────────────────────── Google Ads error helper ────────────────


def _gads_error_response(e):
    """Map a GoogleAdsError to an HTTP response (shared across views)."""
    if getattr(e, 'sdk_missing', False):
        return Response({'error': str(e), 'code': 'SDK_MISSING'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({'error': str(e), 'details': getattr(e, 'details', [])},
                    status=status.HTTP_502_BAD_GATEWAY)


# ─────────────────────────── Google Ads — Create Campaign ───────────


class GoogleCreateCampaignView(APIView):
    """POST — create a Google Search campaign end-to-end.

    Body:
        ad_account_id:    int (must be a connected provider='google' account)
        name:             str
        objective:        traffic|leads|sales|awareness|engagement
        daily_budget_usd: float (converted to micros in the account currency*)
        keywords:         [str]      (broad match)
        final_url:        str        (landing page; required to create an ad)
        headlines:        [str]      (>=3 for an ad)
        descriptions:     [str]      (>=2 for an ad)
        start_date:       'YYYYMMDD' (optional)
        end_date:         'YYYYMMDD' (optional)
        dry_run:          bool       (validate only — nothing is created)

    *Google budgets are in the account's own currency micros. We treat the USD
    amount as account-currency units for the MVP (most test accounts are USD);
    a future FX pass can mirror the Meta conversion table.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ad_account_id = request.data.get('ad_account_id')
        name = (request.data.get('name') or '').strip()
        objective = (request.data.get('objective') or 'traffic').strip()
        campaign_type = (request.data.get('campaign_type') or 'search').strip().lower()
        daily_budget_usd = request.data.get('daily_budget_usd')
        keywords = request.data.get('keywords') or []
        final_url = (request.data.get('final_url') or '').strip()
        headlines = request.data.get('headlines') or []
        descriptions = request.data.get('descriptions') or []
        long_headlines = request.data.get('long_headlines') or []
        long_headline = (request.data.get('long_headline') or '').strip()
        business_name = (request.data.get('business_name') or '').strip()
        marketing_image_urls = request.data.get('marketing_image_urls') or []
        logo_image_urls = request.data.get('logo_image_urls') or []
        start_date = (request.data.get('start_date') or '').strip() or None
        end_date = (request.data.get('end_date') or '').strip() or None
        dry_run = bool(request.data.get('dry_run', False))

        # Targeting + extensions (Search) and video (Video campaigns).
        geo_targets = request.data.get('geo_targets') or []
        ad_schedule = request.data.get('ad_schedule') or []
        sitelinks = request.data.get('sitelinks') or []
        callouts = request.data.get('callouts') or []
        snippet_header = (request.data.get('snippet_header') or '').strip()
        snippet_values = request.data.get('snippet_values') or []
        video_url = (request.data.get('video_url') or '').strip()
        # Audience targeting (interest IDs) + PMax search themes.
        audience_ids = request.data.get('audience_ids') or []
        search_themes = request.data.get('search_themes') or []
        negative_keywords = request.data.get('negative_keywords') or []
        # Fine-grained targeting
        languages = request.data.get('languages') or []
        devices = request.data.get('devices') or []
        radius_targets = request.data.get('radius_targets') or []
        exclude_ages = request.data.get('exclude_ages') or []
        exclude_genders = request.data.get('exclude_genders') or []
        # Bidding strategy
        bidding_strategy = (request.data.get('bidding_strategy') or 'manual_cpc').strip().lower()
        target_cpa_usd = request.data.get('target_cpa_usd') or 0
        target_roas = request.data.get('target_roas') or 0
        ad_variations = request.data.get('ad_variations') or []

        if campaign_type not in ('search', 'display', 'pmax', 'video'):
            return Response({'error': "campaign_type must be 'search', 'display', 'pmax' or 'video'."},
                            status=status.HTTP_400_BAD_REQUEST)

        if not (ad_account_id and name and daily_budget_usd):
            return Response(
                {'error': 'ad_account_id, name and daily_budget_usd are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'}, status=status.HTTP_400_BAD_REQUEST)
        if usd < 1.0:
            return Response({'error': 'Minimum daily budget is $1.00.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='google', is_active=True,
            )
        except AdAccount.DoesNotExist:
            return Response({'error': 'Google ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        daily_budget_micros = int(round(usd * 1_000_000))

        # AdCampaign.brand is non-null; ensure the user has at least one brand.
        campaign_brand = ad_account.brand or _first_brand(request.user)
        if campaign_brand is None:
            return Response(
                {'error': 'Create a brand before launching a campaign.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Diamond pre-check. A real campaign creates billable Google objects, so
        # this fails CLOSED: a pre-check error blocks creation rather than
        # silently granting the feature for free. Dry-run skips billing entirely.
        if not dry_run:
            try:
                from accounts.services.diamond_service import pre_check
                can_afford, cost, balance = pre_check(request.user, 'ads_google_campaign')
            except Exception:
                logger.exception('diamond pre_check failed for ads_google_campaign user=%s', request.user.id)
                return Response({'error': 'Could not verify your Diamond balance. Please try again.'},
                                status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if not can_afford:
                return Response({
                    'error': 'Insufficient Diamond Tokens',
                    'diamond_cost': cost,
                    'diamond_balance': balance,
                    'code': 'INSUFFICIENT_DIAMONDS',
                }, status=402)

        try:
            if campaign_type == 'display':
                result = gads.create_display_campaign(
                    ad_account=ad_account, name=name, daily_budget_micros=daily_budget_micros,
                    final_url=final_url, headlines=headlines, descriptions=descriptions,
                    long_headline=long_headline or (long_headlines[0] if long_headlines else ''),
                    business_name=business_name,
                    marketing_image_urls=marketing_image_urls, logo_image_urls=logo_image_urls,
                    start_date=start_date, end_date=end_date, dry_run=dry_run,
                    geo_targets=geo_targets, ad_schedule=ad_schedule, audience_ids=audience_ids,
                    languages=languages, devices=devices, radius_targets=radius_targets,
                    exclude_ages=exclude_ages, exclude_genders=exclude_genders,
                )
            elif campaign_type == 'pmax':
                result = gads.create_pmax_campaign(
                    ad_account=ad_account, name=name, daily_budget_micros=daily_budget_micros,
                    final_url=final_url, headlines=headlines, descriptions=descriptions,
                    long_headlines=long_headlines or ([long_headline] if long_headline else []),
                    business_name=business_name,
                    marketing_image_urls=marketing_image_urls, logo_image_urls=logo_image_urls,
                    start_date=start_date, end_date=end_date, dry_run=dry_run,
                    geo_targets=geo_targets, ad_schedule=ad_schedule,
                    search_themes=search_themes, video_url=video_url, audience_ids=audience_ids,
                    languages=languages, devices=devices, radius_targets=radius_targets,
                )
            elif campaign_type == 'video':
                result = gads.create_video_campaign(
                    ad_account=ad_account, name=name, daily_budget_micros=daily_budget_micros,
                    video_url=video_url, final_url=final_url,
                    headline=(headlines[0] if headlines else ''),
                    description=(descriptions[0] if descriptions else ''),
                    start_date=start_date, end_date=end_date, dry_run=dry_run,
                    geo_targets=geo_targets, ad_schedule=ad_schedule, audience_ids=audience_ids,
                    languages=languages, devices=devices, radius_targets=radius_targets,
                    exclude_ages=exclude_ages, exclude_genders=exclude_genders,
                )
            else:
                result = gads.create_search_campaign(
                    ad_account=ad_account, name=name, daily_budget_micros=daily_budget_micros,
                    objective=objective, keywords=keywords, final_url=final_url,
                    headlines=headlines, descriptions=descriptions,
                    start_date=start_date, end_date=end_date, dry_run=dry_run,
                    geo_targets=geo_targets, ad_schedule=ad_schedule,
                    sitelinks=sitelinks, callouts=callouts,
                    snippet_header=snippet_header, snippet_values=snippet_values,
                    negative_keywords=negative_keywords,
                    languages=languages, devices=devices, radius_targets=radius_targets,
                    exclude_ages=exclude_ages, exclude_genders=exclude_genders,
                    bidding_strategy=bidding_strategy,
                    target_cpa_usd=target_cpa_usd, target_roas=target_roas,
                    ad_variations=ad_variations,
                )
        except gads.GoogleAdsError as e:
            logger.warning('google create campaign failed user=%s type=%s err=%s',
                           request.user.id, campaign_type, e)
            return _gads_error_response(e)
        except Exception as e:
            # decrypt_token() and other non-SDK paths can raise plain exceptions;
            # never let one escape as a bare 500 traceback.
            logger.exception('google create campaign unexpected error user=%s', request.user.id)
            return Response({'error': f'Unexpected error creating campaign: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if dry_run:
            return Response({'dry_run': True, 'validated': True, **result})

        now = timezone.now()
        try:
            campaign = AdCampaign.objects.create(
                user=request.user,
                brand=campaign_brand,
                ad_account=ad_account,
                name=name,
                objective=objective if objective in dict(_OBJECTIVE_KEYS) else 'traffic',
                status='paused',  # created PAUSED so it doesn't spend until resumed
                external_campaign_id=result.get('campaign_id', ''),
                external_adset_id=result.get('ad_group_id', ''),
                external_ad_id=(result.get('ad_resource', '') or '').split('/')[-1].split('~')[-1],
                daily_budget_minor=daily_budget_micros // 10_000,  # micros → cents for display
                start_date=now,
                end_date=None,
                creative_json={
                    'campaign_type': campaign_type,
                    'budget_resource': result.get('budget_resource', ''),
                    'ad_group_resource': result.get('ad_group_resource', ''),
                    'final_url': final_url,
                    'headlines': headlines,
                    'descriptions': descriptions,
                    'keywords': keywords,
                    'geo_targets': geo_targets,
                    'ad_schedule': ad_schedule,
                    'sitelinks': sitelinks,
                    'callouts': callouts,
                    'snippet_header': snippet_header,
                    'snippet_values': snippet_values,
                    'video_url': video_url,
                    'audience_ids': audience_ids,
                    'search_themes': search_themes,
                },
            )
        except Exception as e:
            # The campaign was created on Google but we failed to persist it
            # locally. Surface a clear message; the campaign is paused so no spend.
            logger.exception('google campaign created on Google but local save failed user=%s', request.user.id)
            return Response({
                'error': 'The campaign was created on Google (paused) but could not be saved locally. '
                         f'Reload to sync. Details: {e}',
                'external_campaign_id': result.get('campaign_id', ''),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            from accounts.services.diamond_service import deduct_diamonds
            deduct_diamonds(user=request.user, feature='ads_google_campaign', provider='google')
        except Exception:
            pass

        data = _serialize_campaign(campaign)
        data['warnings'] = result.get('warnings', [])
        return Response(data, status=status.HTTP_201_CREATED)


_OBJECTIVE_KEYS = [
    ('traffic', 1), ('engagement', 1), ('leads', 1), ('sales', 1),
    ('awareness', 1), ('boost_post', 1),
]


def _first_brand(user):
    """A brand is required on AdCampaign. Use the account brand or the user's first."""
    return Brand.objects.filter(user=user).order_by('id').first()


# ─────────────────────────── Google Ads — Image Upload ──────────────


class GoogleAdsImageUploadView(APIView):
    """POST multipart { image } → save the file and return a public URL.

    Display/PMax image assets are uploaded to Google as raw bytes, but our
    service downloads them from a URL first. So the UI uploads a file here, we
    persist it under MEDIA, and return an absolute URL the service can fetch.
    Scoped per-user directory.
    """
    permission_classes = [IsAuthenticated]
    MAX_BYTES = 10 * 1024 * 1024
    ALLOWED = ('.png', '.jpg', '.jpeg', '.gif')

    def post(self, request):
        f = request.FILES.get('image')
        if not f:
            return Response({'error': 'image file is required'}, status=status.HTTP_400_BAD_REQUEST)
        if f.size > self.MAX_BYTES:
            return Response({'error': 'Image must be under 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)
        ext = ('.' + f.name.rsplit('.', 1)[-1].lower()) if '.' in f.name else ''
        if ext not in self.ALLOWED:
            return Response({'error': f'Unsupported format {ext!r}. Use PNG, JPG or GIF.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Validate the actual bytes are a real image (don't trust the extension).
        from PIL import Image
        try:
            f.seek(0)
            Image.open(f).verify()
            f.seek(0)
        except Exception:
            return Response({'error': 'File is not a valid image.'}, status=status.HTTP_400_BAD_REQUEST)

        import os
        import secrets
        from django.conf import settings as dj_settings
        # Random server-generated name — never trust the user's filename (avoids
        # collisions, overwrites, traversal, and guessable URLs).
        filename = f'{secrets.token_hex(16)}{ext}'
        rel_dir = f'ads_images/{request.user.id}'
        abs_dir = os.path.join(dj_settings.MEDIA_ROOT, rel_dir)
        os.makedirs(abs_dir, exist_ok=True)
        with open(os.path.join(abs_dir, filename), 'wb') as out:
            for chunk in f.chunks():
                out.write(chunk)

        rel_url = f'{dj_settings.MEDIA_URL.rstrip("/")}/{rel_dir}/{filename}'
        return Response({'image_url': request.build_absolute_uri(rel_url)},
                        status=status.HTTP_201_CREATED)


# ─────────────────────────── Google Ads — AI Campaign Suggestion ────


class GoogleAdsSuggestCampaignView(APIView):
    """POST { topic?, campaign_type?, brand_id? } → an AI-suggested campaign.

    Uses the LLM router + the user's Brand DNA to propose name, objective,
    daily_budget_usd, headlines, descriptions, long_headlines, keywords and a
    business_name. Diamond-billed. The user reviews/edits before creating —
    budget is a suggestion only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import json as _json
        topic = (request.data.get('topic') or '').strip()
        campaign_type = (request.data.get('campaign_type') or 'search').strip().lower()
        brand_id = request.data.get('brand_id')

        brand = None
        if brand_id:
            brand = Brand.objects.filter(id=brand_id, user=request.user).first()
        if brand is None:
            brand = _first_brand(request.user)
        if brand is None:
            return Response({'error': 'Create a brand first so the AI has context.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_ai_campaign_suggest')
            if not can_afford:
                return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                 'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'}, status=402)
        except Exception:
            pass

        # Compact brand context for the prompt.
        dna = brand.brand_dna if isinstance(brand.brand_dna, dict) else {}
        brand_ctx = {
            'brand_name': brand.brand_name,
            'industry': brand.industry,
            'region': brand.target_region,
            'website': brand.website_url or '',
            'voice_tone': brand.voice_tone,
            'goals': brand.goals,
            'dna_summary': dna.get('summary') or dna.get('positioning') or '',
        }

        system = (
            'You are a Google Ads strategist. Given a brand and a topic, propose ONE '
            f'{campaign_type.upper()} campaign. Respect Google limits: headlines ≤30 chars, '
            'long headlines ≤90 chars, descriptions ≤90 chars. Return STRICT JSON only, no markdown, '
            'with keys: name (string), objective (one of traffic|leads|sales|awareness|engagement), '
            'daily_budget_usd (number, realistic small test budget 5-30), '
            'headlines (array of 5-12 strings ≤30 chars), descriptions (array of 2-4 strings ≤90 chars), '
            'long_headlines (array of 1-3 strings ≤90 chars), keywords (array of 5-15 strings), '
            'business_name (string ≤25 chars), final_url_hint (string — suggested landing page path), '
            'callouts (array of 4-6 short selling points ≤25 chars each), '
            'sitelinks (array of 2-4 objects {text ≤25 chars, description1 ≤35, description2 ≤35} — '
            'omit the url, the user adds it), '
            'snippet_header (one of: Brands, Services, Types, Styles, Models, Featured, Courses, '
            'Destinations, Insurance coverage, Amenities, Shows, Neighborhoods), '
            'snippet_values (array of 3-6 strings ≤25 chars matching the header), '
            'search_themes (array of 3-6 short phrases your customers would search for, '
            'used as Performance Max audience signals — most relevant for pmax campaigns). '
            'Also propose targeting: geo_targets (array of 1-5 ISO-3166 country codes, e.g. '
            '["US","GB"]), languages (array of 1-3 ISO language codes, e.g. ["en"]), '
            'devices (array, subset of ["MOBILE","DESKTOP","TABLET"] — omit or empty to target '
            'all devices), audience_themes (array of 2-5 short interest/affinity phrases that '
            'describe the ideal customer, e.g. ["fitness enthusiasts","marathon runners"]).'
        )
        user_msg = (
            f'Brand: {_json.dumps(brand_ctx)}\n'
            f'Campaign type: {campaign_type}\n'
            f'Topic / offer: {topic or "a general promotional campaign"}'
        )

        try:
            from accounts.services.llm_service import get_llm_service
            service = get_llm_service(request.user)
            result = service.chat_completion(
                messages=[{'role': 'system', 'content': system},
                          {'role': 'user', 'content': user_msg}],
                temperature=0.7, max_tokens=1200,
            )
        except Exception as e:
            logger.error('[GoogleAds] AI suggest error: %s', e)
            return Response({'error': 'AI suggestion failed. Please try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        if not result.success:
            return Response({'error': result.error or 'No AI API key configured.'},
                            status=status.HTTP_400_BAD_REQUEST)

        suggestion = _extract_json(result.content)
        if suggestion is None:
            return Response({'error': 'AI returned an unparseable response. Please try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        # Clamp to Google limits defensively (the LLM sometimes overshoots).
        suggestion['headlines'] = [str(h)[:30] for h in (suggestion.get('headlines') or [])][:12]
        suggestion['descriptions'] = [str(d)[:90] for d in (suggestion.get('descriptions') or [])][:4]
        suggestion['long_headlines'] = [str(h)[:90] for h in (suggestion.get('long_headlines') or [])][:3]
        suggestion['keywords'] = [str(k) for k in (suggestion.get('keywords') or [])][:15]
        suggestion['business_name'] = str(suggestion.get('business_name', ''))[:25]
        # Extensions (clamp defensively to Google limits).
        suggestion['callouts'] = [str(c)[:25] for c in (suggestion.get('callouts') or [])][:6]
        clean_sitelinks = []
        for sl in (suggestion.get('sitelinks') or [])[:4]:
            if not isinstance(sl, dict):
                continue
            clean_sitelinks.append({
                'text': str(sl.get('text', ''))[:25],
                'url': str(sl.get('url', '')),
                'description1': str(sl.get('description1', ''))[:35],
                'description2': str(sl.get('description2', ''))[:35],
            })
        suggestion['sitelinks'] = clean_sitelinks
        suggestion['snippet_header'] = str(suggestion.get('snippet_header', ''))[:25]
        suggestion['snippet_values'] = [str(v)[:25] for v in (suggestion.get('snippet_values') or [])][:6]
        suggestion['search_themes'] = [str(t)[:80] for t in (suggestion.get('search_themes') or [])][:6]
        # Targeting suggestions (clamped). Geo to 2-letter upper, langs to lower,
        # devices to the known enum set.
        suggestion['geo_targets'] = [
            str(g).strip().upper()[:2] for g in (suggestion.get('geo_targets') or [])
            if str(g).strip()
        ][:5]
        suggestion['languages'] = [
            str(l).strip().lower() for l in (suggestion.get('languages') or [])
            if str(l).strip()
        ][:3]
        _DEVICES = {'MOBILE', 'DESKTOP', 'TABLET'}
        suggestion['devices'] = [
            d for d in (str(x).strip().upper() for x in (suggestion.get('devices') or []))
            if d in _DEVICES
        ][:3]
        suggestion['audience_themes'] = [
            str(t)[:60] for t in (suggestion.get('audience_themes') or []) if str(t).strip()
        ][:5]
        suggestion['campaign_type'] = campaign_type

        try:
            deduct_diamonds(user=request.user, feature='ads_ai_campaign_suggest', result=result)
        except Exception:
            pass

        # Persist the draft so it survives a page reload and can be regenerated.
        try:
            AdCampaignDraft.objects.update_or_create(
                user=request.user, brand=brand, campaign_type=campaign_type,
                defaults={'topic': topic[:300], 'suggestion': suggestion},
            )
        except Exception as e:
            logger.warning('[GoogleAds] draft persist failed: %s', e)

        return Response({'success': True, 'suggestion': suggestion})

    def get(self, request):
        """GET ?brand_id=&campaign_type= → the latest saved draft (or null).

        Lets the frontend restore generated content after a page reload.
        """
        campaign_type = (request.query_params.get('campaign_type') or 'search').strip().lower()
        brand_id = request.query_params.get('brand_id')
        brand = None
        if brand_id:
            brand = Brand.objects.filter(id=brand_id, user=request.user).first()
        if brand is None:
            brand = _first_brand(request.user)
        if brand is None:
            return Response({'success': True, 'draft': None})

        draft = (AdCampaignDraft.objects
                 .filter(user=request.user, brand=brand, campaign_type=campaign_type)
                 .first())
        if draft is None:
            return Response({'success': True, 'draft': None})
        return Response({'success': True, 'draft': {
            'brand_id': brand.id,
            'campaign_type': draft.campaign_type,
            'topic': draft.topic,
            'suggestion': draft.suggestion,
            'updated_at': draft.updated_at,
        }})


# ─────────────────────────── Meta Ads — AI Campaign Suggestion ──────


class MetaAdsSuggestCampaignView(APIView):
    """POST { topic?, objective?, brand_id? } → an AI-suggested Meta campaign.

    Mirrors GoogleAdsSuggestCampaignView but for Meta: uses the LLM router +
    the user's Brand DNA to propose name, objective, daily_budget_usd, ad copy
    (primary_text/headline/description), a call_to_action, and targeting.
    Diamond-billed. The user reviews/edits before creating — budget is a
    suggestion only.
    """
    permission_classes = [IsAuthenticated]

    _CTA_CHOICES = {
        'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_TRAVEL', 'CONTACT_US',
        'DOWNLOAD', 'GET_OFFER', 'SUBSCRIBE',
    }
    _OBJECTIVES = {'awareness', 'traffic', 'engagement', 'leads', 'sales'}
    _GENDERS = {'all', 'male', 'female'}

    def post(self, request):
        import json as _json
        topic = (request.data.get('topic') or '').strip()
        objective = (request.data.get('objective') or '').strip().lower()
        if objective not in self._OBJECTIVES:
            objective = ''
        brand_id = request.data.get('brand_id')

        brand = None
        if brand_id:
            brand = Brand.objects.filter(id=brand_id, user=request.user).first()
        if brand is None:
            brand = _first_brand(request.user)
        if brand is None:
            return Response({'error': 'Create a brand first so the AI has context.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_meta_ai_suggest')
            if not can_afford:
                return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                 'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'}, status=402)
        except Exception:
            pass

        # Compact brand context for the prompt.
        dna = brand.brand_dna if isinstance(brand.brand_dna, dict) else {}
        brand_ctx = {
            'brand_name': brand.brand_name,
            'industry': brand.industry,
            'region': brand.target_region,
            'website': brand.website_url or '',
            'voice_tone': brand.voice_tone,
            'goals': brand.goals,
            'dna_summary': dna.get('summary') or dna.get('positioning') or '',
        }

        obj_hint = (f'The campaign objective should be "{objective}".'
                    if objective else
                    'Pick the single best objective for this brand and topic.')
        system = (
            'You are a Meta (Facebook/Instagram) Ads strategist. Given a brand and a '
            'topic, propose ONE campaign with a single ad. ' + obj_hint + ' '
            'Respect Meta limits: primary_text ≤125 chars, headline ≤40 chars, '
            'description ≤30 chars. Return STRICT JSON only, no markdown, with keys: '
            'name (string), objective (one of awareness|traffic|engagement|leads|sales), '
            'daily_budget_usd (number, realistic small test budget 5-30), '
            'primary_text (string ≤125 chars — the main ad message), '
            'headline (string ≤40 chars), description (string ≤30 chars), '
            'link_description (string — a short landing-page/offer descriptor), '
            'call_to_action (one of LEARN_MORE|SHOP_NOW|SIGN_UP|BOOK_TRAVEL|CONTACT_US|'
            'DOWNLOAD|GET_OFFER|SUBSCRIBE), '
            'targeting (object with: countries (array of 1-5 ISO-3166 alpha-2 country '
            'codes, e.g. ["US","GB"]), age_min (integer 13-65), age_max (integer 13-65), '
            'genders (one of "all"|"male"|"female"), interests (array of 3-8 short '
            'interest phrases, e.g. ["fitness","running"])).'
        )
        user_msg = (
            f'Brand: {_json.dumps(brand_ctx)}\n'
            f'Objective: {objective or "(you choose)"}\n'
            f'Topic / offer: {topic or "a general promotional campaign"}'
        )

        try:
            from accounts.services.llm_service import get_llm_service
            service = get_llm_service(request.user)
            result = service.chat_completion(
                messages=[{'role': 'system', 'content': system},
                          {'role': 'user', 'content': user_msg}],
                temperature=0.7, max_tokens=900,
            )
        except Exception as e:
            logger.error('[MetaAds] AI suggest error: %s', e)
            return Response({'error': 'AI suggestion failed. Please try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        if not result.success:
            return Response({'error': result.error or 'No AI API key configured.'},
                            status=status.HTTP_400_BAD_REQUEST)

        suggestion = _extract_json(result.content)
        if suggestion is None:
            return Response({'error': 'AI returned an unparseable response. Please try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        # Clamp to Meta limits defensively (the LLM sometimes overshoots).
        suggestion['name'] = str(suggestion.get('name', ''))[:100]
        sug_obj = str(suggestion.get('objective', '')).strip().lower()
        chosen_obj = objective or sug_obj
        suggestion['objective'] = chosen_obj if chosen_obj in self._OBJECTIVES else 'traffic'
        try:
            budget = float(suggestion.get('daily_budget_usd') or 0)
        except (TypeError, ValueError):
            budget = 0.0
        suggestion['daily_budget_usd'] = round(min(max(budget or 10.0, 5.0), 30.0), 2)
        suggestion['primary_text'] = str(suggestion.get('primary_text', ''))[:125]
        suggestion['headline'] = str(suggestion.get('headline', ''))[:40]
        suggestion['description'] = str(suggestion.get('description', ''))[:30]
        suggestion['link_description'] = str(suggestion.get('link_description', ''))[:200]
        cta = str(suggestion.get('call_to_action', '')).strip().upper()
        suggestion['call_to_action'] = cta if cta in self._CTA_CHOICES else 'LEARN_MORE'

        raw_t = suggestion.get('targeting')
        raw_t = raw_t if isinstance(raw_t, dict) else {}
        countries = [
            str(c).strip().upper()[:2] for c in (raw_t.get('countries') or [])
            if str(c).strip()
        ][:5]

        def _clamp_age(v, default):
            try:
                return min(max(int(v), 13), 65)
            except (TypeError, ValueError):
                return default
        age_min = _clamp_age(raw_t.get('age_min'), 18)
        age_max = _clamp_age(raw_t.get('age_max'), 65)
        if age_max < age_min:
            age_min, age_max = age_max, age_min
        genders = str(raw_t.get('genders', 'all')).strip().lower()
        if genders not in self._GENDERS:
            genders = 'all'
        interests = [
            str(i)[:60] for i in (raw_t.get('interests') or []) if str(i).strip()
        ][:8]
        suggestion['targeting'] = {
            'countries': countries,
            'age_min': age_min,
            'age_max': age_max,
            'genders': genders,
            'interests': interests,
        }
        suggestion['campaign_type'] = 'meta'

        try:
            deduct_diamonds(user=request.user, feature='ads_meta_ai_suggest', result=result)
        except Exception:
            pass

        # Persist the draft so it survives a page reload and can be regenerated.
        # AdCampaignDraft is keyed by (user, brand, campaign_type); use 'meta'.
        try:
            AdCampaignDraft.objects.update_or_create(
                user=request.user, brand=brand, campaign_type='meta',
                defaults={'topic': topic[:300], 'suggestion': suggestion},
            )
        except Exception as e:
            logger.warning('[MetaAds] draft persist failed: %s', e)

        return Response({'success': True, 'suggestion': suggestion})


class GoogleAdsConversionActionView(APIView):
    """POST { ad_account_id, name, category?, value_usd?, dry_run? } → create a
    website conversion action on the account.

    Account-level setup for measuring leads/sales. On a test account it
    validates but never records data (test accounts don't serve).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ad_account_id = request.data.get('ad_account_id')
        name = (request.data.get('name') or '').strip()
        category = (request.data.get('category') or 'DEFAULT').strip().upper()
        value_usd = request.data.get('value_usd') or 0
        dry_run = bool(request.data.get('dry_run', False))

        if not (ad_account_id and name):
            return Response({'error': 'ad_account_id and name are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            value_micros = int(round(float(value_usd) * 1_000_000))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid value_usd.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='google', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Google ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        try:
            result = gads.create_conversion_action(
                ad_account=ad_account, name=name, category=category,
                value_micros=value_micros, dry_run=dry_run)
        except gads.GoogleAdsError as e:
            logger.warning('google conversion action failed user=%s err=%s', request.user.id, e)
            return _gads_error_response(e)
        except Exception as e:
            logger.exception('google conversion action unexpected error user=%s', request.user.id)
            return Response({'error': f'Unexpected error: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'success': True, **result})


class GoogleAdsOfflineConversionsView(APIView):
    """POST { ad_account_id, conversion_action_resource, conversions:[...] }
    → upload offline/click conversions (CRM import).

    Each conversion: { gclid, conversion_date_time, value?, currency? }.
    conversion_date_time format: 'yyyy-MM-dd HH:mm:ss+HH:MM'.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ad_account_id = request.data.get('ad_account_id')
        car = (request.data.get('conversion_action_resource') or '').strip()
        conversions = request.data.get('conversions') or []
        if not (ad_account_id and car and conversions):
            return Response({'error': 'ad_account_id, conversion_action_resource and conversions are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='google', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Google ad account not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            result = gads.upload_offline_conversions(ad_account, car, conversions)
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        except Exception as e:
            logger.exception('offline conversion upload error user=%s', request.user.id)
            return Response({'error': f'Unexpected error: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'success': True, **result})


class GoogleAdsAudienceSearchView(APIView):
    """GET ?ad_account_id=&q= → matching Google audience interest categories.

    Powers the audience picker in the campaign builder (Display/PMax/Video).
    Returns [{id, name, taxonomy}]. IDs feed audience_ids on create.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ad_account_id = request.query_params.get('ad_account_id')
        q = (request.query_params.get('q') or '').strip()
        if not (ad_account_id and q):
            return Response({'error': 'ad_account_id and q are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='google', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Google ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            results = gads.search_audiences(ad_account, q)
        except gads.GoogleAdsError as e:
            return _gads_error_response(e)
        except Exception as e:
            logger.exception('audience search error user=%s', request.user.id)
            return Response({'error': f'Unexpected error: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'success': True, 'results': results})


# ─────────────────────────── Google Ads — AI creative generation ────

# Google Ads image-asset aspect ratios. We map a creative "kind" to a size the
# generator should produce so the result fits a Display/PMax asset slot.
_AD_IMAGE_SIZES = {
    'marketing': '1536x1024',   # ~1.91:1 landscape (Google wants 1.91:1)
    'square': '1024x1024',      # 1:1 square marketing image
    'logo': '1024x1024',        # 1:1 logo
}


def _brand_image_prompt(brand, topic, kind):
    """Build a brand-aware image prompt from Brand DNA + the campaign topic.

    Mirrors the campaign-suggest brand context so generated ad creatives match
    the brand's industry, voice and positioning.
    """
    dna = brand.brand_dna if (brand and isinstance(brand.brand_dna, dict)) else {}
    bits = []
    if brand:
        if brand.brand_name:
            bits.append(f'Brand: {brand.brand_name}')
        if brand.industry:
            bits.append(f'Industry: {brand.industry}')
        if brand.voice_tone:
            bits.append(f'Tone: {brand.voice_tone}')
        summary = dna.get('summary') or dna.get('positioning') or ''
        if summary:
            bits.append(f'Positioning: {summary}')
    context = '. '.join(bits)
    base = topic.strip() if topic else 'a professional marketing creative'
    style_hint = {
        'marketing': 'a clean, high-converting advertising banner image, no text overlay, '
                     'professional product/lifestyle photography style, ample empty space',
        'square': 'a clean square advertising image, no text overlay, professional, '
                  'centered composition',
        'logo': 'a simple, modern brand logo mark on a plain background, vector-like, minimal',
    }.get(kind, 'a professional advertising image, no text overlay')
    parts = [f'Create {style_hint} for: {base}.']
    if context:
        parts.append(context + '.')
    parts.append('Photorealistic, high quality, advertising-grade. Avoid any words, '
                 'letters, watermarks or logos unless it is the logo itself.')
    return ' '.join(parts)


def _save_ad_image_bytes(request, image_bytes, ext='png'):
    """Persist generated image bytes under MEDIA and return an absolute URL.

    Reuses the same per-user ads_images dir as the manual upload so generated
    and uploaded creatives live together and feed the campaign builder the same
    way (a public URL the Google Ads service can fetch).
    """
    import os
    import secrets
    from django.conf import settings as dj_settings
    filename = f'{secrets.token_hex(16)}.{ext}'
    rel_dir = f'ads_images/{request.user.id}'
    abs_dir = os.path.join(dj_settings.MEDIA_ROOT, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)
    with open(os.path.join(abs_dir, filename), 'wb') as out:
        out.write(image_bytes)
    rel_url = f'{dj_settings.MEDIA_URL.rstrip("/")}/{rel_dir}/{filename}'
    return request.build_absolute_uri(rel_url)


class GoogleAdsGenerateImageView(APIView):
    """POST { prompt?, kind?, brand_id?, ad_account_id? } → AI-generate an ad image.

    kind ∈ {marketing, square, logo} picks the aspect ratio. Uses the same
    ImageService the rest of the app uses (OpenAI/Gemini), enriches the prompt
    with Brand DNA, saves the bytes under MEDIA, and returns a public image_url
    that drops straight into the Display/PMax image list. Diamond-billed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        prompt = (request.data.get('prompt') or '').strip()
        kind = (request.data.get('kind') or 'marketing').strip().lower()
        if kind not in _AD_IMAGE_SIZES:
            kind = 'marketing'
        brand_id = request.data.get('brand_id')

        brand = None
        if brand_id:
            brand = Brand.objects.filter(id=brand_id, user=request.user).first()
        if brand is None:
            brand = _first_brand(request.user)

        # Need either an explicit prompt or a brand to derive one from.
        if not prompt and brand is None:
            return Response({'error': 'Provide a prompt or create a brand first.'},
                            status=status.HTTP_400_BAD_REQUEST)

        from accounts.api_keys import get_openai_key, get_gemini_key
        openai_key = get_openai_key(request.user)
        gemini_key = get_gemini_key(request.user)
        if not (openai_key or gemini_key):
            return Response({'error': 'No image API key configured. An admin can add an '
                                      'OpenAI or Gemini key in Admin → API Keys.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Provider preference depends on the shape we need. OpenAI honours exact
        # sizes (so it reliably produces a true 1.91:1 LANDSCAPE marketing image);
        # Gemini ignores size and tends to return ~1:1, which is fine for square
        # marketing images and logos. So prefer OpenAI for landscape, Gemini for
        # square/logo — falling back to whichever key is available/working.
        landscape = (kind == 'marketing')
        if landscape:
            preferred = ['openai', 'gemini']
        else:
            preferred = ['gemini', 'openai']

        # Diamond pre-check (image generation).
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'image', quality='hd')
            if not can_afford:
                return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                 'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'},
                                status=402)
        except Exception:
            deduct_diamonds = None  # billing unavailable — don't block generation

        full_prompt = _brand_image_prompt(brand, prompt, kind)
        size = _AD_IMAGE_SIZES[kind]

        # Try the preferred provider, then fall back to the other if it fails
        # (e.g. an invalid/over-quota key) so generation is resilient.
        from ai_image.image_service import ImageService
        have = {'openai': bool(openai_key), 'gemini': bool(gemini_key)}
        order = [p for p in preferred if have[p]]
        # OpenAI landscape size differs from Gemini's (Gemini ignores it anyway).
        _OPENAI_SIZE = {'marketing': '1536x1024', 'square': '1024x1024', 'logo': '1024x1024'}
        result = {'success': False, 'error': 'No image provider available.'}
        for provider in order:
            prov_size = _OPENAI_SIZE.get(kind, size) if provider == 'openai' else size
            try:
                service = ImageService(provider=provider, openai_key=openai_key, gemini_key=gemini_key)
                result = service.generate_image(prompt=full_prompt, style='realistic',
                                                size=prov_size, quality='hd', enhance=True)
            except Exception as e:  # noqa: BLE001
                logger.warning('ad image gen provider=%s error user=%s: %s',
                               provider, request.user.id, e)
                result = {'success': False, 'error': str(e)}
            if result.get('success') and result.get('image_data'):
                break

        if not result.get('success') or not result.get('image_data'):
            return Response({'error': result.get('error') or 'Image generation failed.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        try:
            image_url = _save_ad_image_bytes(request, result['image_data'], ext='png')
        except Exception as e:
            logger.exception('ad image save error user=%s', request.user.id)
            return Response({'error': f'Could not save the generated image: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='image',
                                provider=result.get('provider', ''),
                                model_used=result.get('model_used', ''), media_count=1)
            except Exception:
                pass

        return Response({'success': True, 'image_url': image_url, 'kind': kind,
                         'provider': result.get('provider', ''),
                         'model': result.get('model_used', ''),
                         'enhanced_prompt': result.get('enhanced_prompt', full_prompt)},
                        status=status.HTTP_201_CREATED)


class GoogleAdsGenerateVideoView(APIView):
    """POST { prompt?, brand_id?, duration?, aspect_ratio? } → AI-generate a video.

    Uses the same Gemini Veo service as AI Video. Returns a video_url (hosted on
    THIS server under MEDIA) plus a note: Google Ads video campaigns require the
    video to live on YouTube, so the generated MP4 must be uploaded to the
    advertiser's YouTube channel before it can run as a video ad. We surface that
    clearly rather than pretending the MP4 can be used directly. Diamond-billed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import uuid
        from django.core.files.base import ContentFile

        prompt = (request.data.get('prompt') or '').strip()
        brand_id = request.data.get('brand_id')
        try:
            duration = int(request.data.get('duration') or 8)
        except (TypeError, ValueError):
            duration = 8
        aspect_ratio = (request.data.get('aspect_ratio') or '16:9').strip()

        brand = None
        if brand_id:
            brand = Brand.objects.filter(id=brand_id, user=request.user).first()
        if brand is None:
            brand = _first_brand(request.user)
        if not prompt and brand is None:
            return Response({'error': 'Provide a prompt or create a brand first.'},
                            status=status.HTTP_400_BAD_REQUEST)

        from accounts.api_keys import get_gemini_key
        gemini_key = get_gemini_key(request.user)
        if not gemini_key:
            return Response({'error': 'No Gemini API key configured (required for video). '
                                      'An admin can add one in Admin → API Keys.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Diamond pre-check (video, priced per duration).
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'video', duration=duration)
            if not can_afford:
                return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                 'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'},
                                status=402)
        except Exception:
            deduct_diamonds = None

        base = prompt or 'a short brand promotional video'
        try:
            from ai_video.gemini_service import GeminiVideoService
            service = GeminiVideoService(api_key=gemini_key)
            result = service.generate_video(
                prompt=base, style='realistic', duration=duration,
                aspect_ratio=aspect_ratio, enhance=True, brand=brand)
        except Exception as e:
            logger.exception('ad video gen error user=%s', request.user.id)
            return Response({'error': f'Video generation failed: {e}'},
                            status=status.HTTP_502_BAD_GATEWAY)

        if not result.get('success') or not result.get('video_data'):
            return Response({'error': result.get('error') or 'Video generation failed.'},
                            status=status.HTTP_502_BAD_GATEWAY)

        # Persist the MP4 under MEDIA and keep the absolute path for upload.
        try:
            import os
            import secrets
            from django.conf import settings as dj_settings
            filename = f'{secrets.token_hex(16)}.mp4'
            rel_dir = f'ads_videos/{request.user.id}'
            abs_dir = os.path.join(dj_settings.MEDIA_ROOT, rel_dir)
            os.makedirs(abs_dir, exist_ok=True)
            video_path = os.path.join(abs_dir, filename)
            with open(video_path, 'wb') as out:
                out.write(result['video_data'])
            rel_url = f'{dj_settings.MEDIA_URL.rstrip("/")}/{rel_dir}/{filename}'
            video_url = request.build_absolute_uri(rel_url)
        except Exception as e:
            logger.exception('ad video save error user=%s', request.user.id)
            return Response({'error': f'Could not save the generated video: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='video', duration_seconds=duration,
                                provider='gemini', model_used=result.get('model_used', ''),
                                media_count=1)
            except Exception:
                pass

        # Google Ads runs video ads ONLY from YouTube. If the user has a connected
        # YouTube account, upload the clip automatically (unlisted) and hand back a
        # ready-to-use YouTube URL. Otherwise fall back to the download-and-upload
        # instruction.
        from platforms.services.youtube import YouTubeService
        yt_account = YouTubeService.get_active_account(request.user)
        youtube_url = ''
        youtube_video_id = ''
        note = ''
        if yt_account:
            access_token, err = YouTubeService.get_fresh_access_token(yt_account)
            if err:
                note = (f'Video generated, but auto-upload to YouTube failed: {err} '
                        'Download the preview and upload it to YouTube manually, then paste the URL.')
            else:
                title = (prompt[:90] or 'Ad video') + ' — Sellanto'
                ok, up = YouTubeService.upload_video(
                    access_token, video_path, title=title,
                    description='Generated for a Google Ads campaign via Sellanto.',
                    privacy='unlisted')
                if ok:
                    youtube_video_id = up
                    youtube_url = f'https://www.youtube.com/watch?v={up}'
                    note = ('Video generated and uploaded to your YouTube channel (unlisted). '
                            'The YouTube URL is filled in — ready to use as a video ad.')
                else:
                    note = (f'Video generated, but YouTube upload failed: {up} '
                            'Download the preview and upload it to YouTube manually, then paste the URL.')
        else:
            note = ('Video generated. Google Ads runs video ads only from YouTube — connect a '
                    'YouTube account (Connect Accounts) to auto-upload, or download this clip, '
                    'upload it to YouTube yourself, and paste the URL into the video field.')

        return Response({'success': True, 'video_url': video_url,
                         'youtube_url': youtube_url, 'youtube_video_id': youtube_video_id,
                         'model': result.get('model_used', ''), 'note': note},
                        status=status.HTTP_201_CREATED)


def _extract_json(text):
    """Pull the first JSON object out of an LLM response (handles ```json fences)."""
    import json as _json
    if not text:
        return None
    s = text.strip()
    if s.startswith('```'):
        s = s.split('```', 2)[1] if s.count('```') >= 2 else s.strip('`')
        if s.lstrip().lower().startswith('json'):
            s = s.lstrip()[4:]
    try:
        return _json.loads(s)
    except (ValueError, TypeError):
        # Fall back to the outermost {...} slice.
        start, end = s.find('{'), s.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return _json.loads(s[start:end + 1])
            except (ValueError, TypeError):
                return None
    return None


# ─────────────────────────── Boost Post (MVP) ───────────────────────


class BoostPostView(APIView):
    """POST {
        post_id: int,            # Sellanto Post.id
        ad_account_id: int,
        daily_budget_usd: float, # e.g. 10.00 → 1000 cents
        duration_days: int,      # e.g. 7
        targeting: {...}         # geo_locations, age_min, age_max, interests
    }
    Creates Campaign+AdSet+Creative+Ad on Meta, persists AdCampaign locally.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        post_id = request.data.get('post_id')
        ad_account_id = request.data.get('ad_account_id')
        daily_budget_usd = request.data.get('daily_budget_usd')
        duration_days = int(request.data.get('duration_days', 7))
        targeting = request.data.get('targeting') or {}

        if not (post_id and ad_account_id and daily_budget_usd):
            return Response(
                {'error': 'post_id, ad_account_id, daily_budget_usd are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if not post.facebook_post_id:
            return Response(
                {'error': 'Post has not been published to Facebook yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True,
            )
        except AdAccount.DoesNotExist:
            return Response(
                {'error': 'Ad account not found or not connected.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Guard: LIVE accounts require explicit confirmation (real spend).
        guard = _live_spend_guard(ad_account, request)
        if guard is not None:
            return guard

        # Resolve Page ID from the post's brand → SocialAccount
        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True,
        ).first()
        if not sa or not sa.facebook_page_id:
            return Response(
                {'error': 'No connected Facebook Page found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Convert USD → ad-account-currency minor units.
        # Meta's daily_budget is in the ad account's currency minor units
        # (e.g. cents for USD, paisa for BDT). If we send USD cents to a BDT
        # account, Meta interprets 100 as 1 BDT (way below the ~124 BDT min).
        # Approximate rates — refresh quarterly. For production, fetch live
        # rates from an FX service. Default 1.0 means "treat as USD".
        FX_PER_USD = {
            'USD': 1.0,
            'BDT': 120.0,
            'INR': 84.0,
            'PKR': 280.0,
            'IDR': 16000.0,
            'EUR': 0.92,
            'GBP': 0.78,
            'CAD': 1.38,
            'AUD': 1.55,
            'SGD': 1.35,
            'MYR': 4.5,
            'AED': 3.67,
            'SAR': 3.75,
        }
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not math.isfinite(usd):
            return Response({'error': 'daily_budget_usd must be a finite number.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # $1.00 works for USD accounts but BDT/PKR/IDR have higher absolute
        # minimums (e.g. Meta requires BDT ~124/day). Requiring $1.50 USD
        # comfortably exceeds the threshold for all supported currencies.
        if usd < 1.5:
            return Response(
                {'error': 'Minimum daily budget is $1.50.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = (ad_account.currency_code or 'USD').upper()
        fx_rate = FX_PER_USD.get(currency, 1.0)
        daily_budget_cents = int(round(usd * fx_rate * 100))
        logger.info(
            f'[boost_post] budget conversion: ${usd} USD x {fx_rate} '
            f'= {daily_budget_cents} {currency} minor units'
        )

        # Diamond pre-check
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_boost_post')
            if not can_afford:
                return Response({
                    'error': 'Insufficient Diamond Tokens',
                    'diamond_cost': cost,
                    'diamond_balance': balance,
                    'code': 'INSUFFICIENT_DIAMONDS',
                }, status=402)
        except Exception:
            # Feature not yet wired in DIAMOND_COSTS — skip gracefully during MVP
            pass

        # Convert the frontend's friendly targeting dict (flat interests/
        # behaviors ids, placement tokens, custom_audiences, geo) into the
        # Meta targeting spec the API expects. Already-shaped specs pass
        # through unchanged (backward-compatible).
        targeting_spec = _normalize_targeting(targeting)

        # Create the campaign on Meta
        try:
            result = meta_ads.boost_post(
                ad_account=ad_account,
                page_id=sa.facebook_page_id,
                fb_post_id=post.facebook_post_id,
                daily_budget_cents=daily_budget_cents,
                duration_days=duration_days,
                targeting=targeting_spec,
                campaign_name=f'Boost: {post.caption[:40] if post.caption else post.id}',
                page_access_token=sa.facebook_access_token or '',
                advantage_audience=_parse_bool(
                    request.data.get('advantage_audience'), default=False),
            )
        except meta_ads.MetaAdsError as e:
            logger.warning(
                'boost_post failed user=%s post=%s err=%s raw=%s',
                request.user.id, post.id, e, e.raw,
            )
            # Surface Meta's human-readable error message when available.
            # e.raw is the full {'message','code','error_subcode',
            # 'error_user_title','error_user_msg',...} block from Graph API.
            raw = e.raw or {}
            user_title = raw.get('error_user_title')
            user_msg = raw.get('error_user_msg')
            display = _friendly_meta_error(e, ad_account)
            return Response(
                {
                    'error': display,
                    'code': e.code,
                    'subcode': e.subcode,
                    'error_user_title': user_title,
                    'error_user_msg': user_msg,
                    'step': str(e).split(':')[0] if ':' in str(e) else None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist locally
        now = timezone.now()
        campaign = AdCampaign.objects.create(
            user=request.user,
            brand=post.brand,
            ad_account=ad_account,
            boosted_post=post,
            name=f'Boost: {post.caption[:40] if post.caption else post.id}',
            objective='boost_post',
            status='pending_review',
            external_campaign_id=result['campaign_id'],
            external_adset_id=result['adset_id'],
            external_creative_id=result['creative_id'],
            external_ad_id=result['ad_id'],
            daily_budget_minor=daily_budget_cents,
            start_date=now,
            end_date=now + timedelta(days=duration_days),
            targeting_json=targeting,
            creative_json={
                'object_story_id': f'{sa.facebook_page_id}_{post.facebook_post_id}',
            },
        )

        # Deduct diamonds (after success)
        try:
            from accounts.services.diamond_service import deduct_diamonds
            deduct_diamonds(user=request.user, feature='ads_boost_post', provider='meta')
        except Exception:
            pass

        return Response(_serialize_campaign(campaign), status=status.HTTP_201_CREATED)


# ─────────────────────── Boost from content ─────────────────────────
#
# Turn an organic (scheduled / published / AI-generated) Post into a Meta ad.
# Three endpoints power the "Boost from content" UX:
#   POST /ads/boost-from-post/     — boost now, or queue boost-on-publish
#   GET  /ads/boostable-posts/     — list Posts eligible for boosting
#   GET  /ads/prefill-from-post/   — prefill Create-Campaign modal from a Post


def _post_first_media_url(post: 'Post', request) -> str:
    """Return an absolute URL for the post's first media file, or '' if none.

    media_files_list holds MEDIA_ROOT-relative paths (see posts/views.py). We
    join them onto MEDIA_URL and absolutize against the incoming request so the
    frontend (and Meta, for creatives) can fetch them.
    """
    from django.conf import settings
    media = post.media_files_list or []
    if not media:
        return ''
    first = media[0]
    if isinstance(first, dict):  # tolerate {'path': ...} shaped entries
        first = first.get('path') or first.get('url') or ''
    if not first:
        return ''
    if str(first).startswith(('http://', 'https://')):
        return first
    rel = str(first).replace('\\', '/').lstrip('/')
    url = f"{settings.MEDIA_URL.rstrip('/')}/{rel}"
    try:
        return request.build_absolute_uri(url)
    except Exception:
        return url


def _serialize_boostable_post(post: 'Post', request) -> dict:
    return {
        'id': post.id,
        'caption': post.caption or '',
        'status': post.status,
        'ai_generated': post.ai_generated,
        'facebook_post_id': post.facebook_post_id,
        'instagram_post_id': post.instagram_post_id,
        'scheduled_time': post.scheduled_time.isoformat() if post.scheduled_time else None,
        'thumbnail': _post_first_media_url(post, request),
        'is_published': bool(post.facebook_post_id),
    }


class BoostablePostsView(APIView):
    """GET /ads/boostable-posts/ — list the user's recent Posts eligible for
    boosting: already published to Facebook, or scheduled to publish.

    Optional ?limit= (default 30, max 100).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        try:
            limit = int(request.GET.get('limit', 30))
        except (TypeError, ValueError):
            limit = 30
        limit = max(1, min(limit, 100))

        posts = Post.objects.filter(user=request.user).filter(
            Q(facebook_post_id__isnull=False) & ~Q(facebook_post_id='')
            | Q(status='scheduled')
        ).order_by('-scheduled_time', '-created_at')[:limit]

        return Response({
            'posts': [_serialize_boostable_post(p, request) for p in posts],
        })


class PrefillFromContentView(APIView):
    """GET /ads/prefill-from-post/?post_id= — derive Create-Campaign modal
    prefill values from a Post's caption + first media file.

    Returns { message, headline, image_url } so the Create Campaign modal can
    consume AI-generated / organic content as an ad starting point. No LLM call
    and no Diamond cost — pure derivation from existing fields.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        post_id = request.GET.get('post_id')
        if not post_id:
            return Response({'error': 'post_id is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except (Post.DoesNotExist, ValueError):
            return Response({'error': 'Post not found'},
                            status=status.HTTP_404_NOT_FOUND)

        caption = (post.caption or '').strip()
        # Headline = first non-empty line (or hook), trimmed to Meta's ~40-char
        # headline guidance; message = full caption.
        headline_src = (post.hook or '').strip() or caption
        first_line = next(
            (ln.strip() for ln in headline_src.splitlines() if ln.strip()), ''
        )
        headline = first_line[:40]

        return Response({
            'message': caption,
            'headline': headline,
            'image_url': _post_first_media_url(post, request),
        })


class AdMediaLibraryView(APIView):
    """GET /ads/media-library/?kind=image|video|all — list the user's reusable
    media for ad creatives: AI-generated images (ai_image.ImageGeneration),
    AI-generated videos (video_studio.VideoClip / MergedVideo), and media
    already attached to their posts. Read-only, no billing.

    Returns { items: [{ id, kind, url, thumbnail, source, label, created_at }] }
    where source ∈ {generated_image, generated_video, post}. Each url is an
    absolute URL Meta/the frontend can fetch.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        kind = (request.GET.get('kind') or 'all').strip().lower()
        want_img = kind in ('image', 'all')
        want_vid = kind in ('video', 'all')
        items = []

        def absurl(u):
            if not u:
                return ''
            if str(u).startswith(('http://', 'https://')):
                return u
            try:
                return request.build_absolute_uri(u)
            except Exception:
                return u

        # 1) AI-generated images
        if want_img:
            try:
                from ai_image.models import ImageGeneration
                qs = (ImageGeneration.objects
                      .filter(user=request.user, status='completed')
                      .order_by('-created_at')[:60])
                for g in qs:
                    field = (g.copy_overlay_image or g.generated_image_with_logo
                             or g.generated_image or g.composited_image)
                    if not field:
                        continue
                    items.append({
                        'id': f'img-{g.id}', 'kind': 'image',
                        'url': absurl(field.url),
                        'thumbnail': absurl(field.url),
                        'source': 'generated_image',
                        'label': (getattr(g, 'prompt', '') or 'Generated image')[:60],
                        'created_at': g.created_at.isoformat() if g.created_at else None,
                    })
            except Exception as e:  # app optional / schema drift — never 500 the picker
                logger.warning('[media-library] image list failed: %s', e)

        # 2) AI-generated videos (merged first, then standalone clips)
        if want_vid:
            try:
                from video_studio.models import MergedVideo, VideoClip
                for m in (MergedVideo.objects
                          .filter(project__user=request.user, status='completed')
                          .order_by('-created_at')[:40]):
                    if not m.merged_video:
                        continue
                    items.append({
                        'id': f'mvid-{m.id}', 'kind': 'video',
                        'url': absurl(m.merged_video.url),
                        'thumbnail': absurl(m.thumbnail.url) if m.thumbnail else '',
                        'source': 'generated_video',
                        'label': (getattr(m, 'title', '') or 'Merged video')[:60],
                        'created_at': m.created_at.isoformat() if getattr(m, 'created_at', None) else None,
                    })
                for cl in (VideoClip.objects
                           .filter(project__user=request.user, status='completed')
                           .order_by('-id')[:40]):
                    vu = cl.get_video_url()
                    if not vu:
                        continue
                    items.append({
                        'id': f'clip-{cl.id}', 'kind': 'video',
                        'url': absurl(vu),
                        'thumbnail': absurl(cl.get_thumbnail_url() or ''),
                        'source': 'generated_video',
                        'label': (getattr(cl, 'prompt', '') or 'Video clip')[:60],
                        'created_at': None,
                    })
            except Exception as e:
                logger.warning('[media-library] video list failed: %s', e)

        # 3) Media already on the user's posts
        try:
            posts = (Post.objects.filter(user=request.user)
                     .exclude(media_files='[]').order_by('-id')[:40])
            for p in posts:
                url = _post_first_media_url(p, request)
                if not url:
                    continue
                is_video = url.lower().rsplit('.', 1)[-1] in ('mp4', 'mov', 'avi', 'webm', 'm4v', 'mkv')
                if (is_video and not want_vid) or (not is_video and not want_img):
                    continue
                items.append({
                    'id': f'post-{p.id}', 'kind': 'video' if is_video else 'image',
                    'url': url, 'thumbnail': url, 'source': 'post',
                    'label': (p.caption or 'Post media')[:60],
                    'created_at': p.created_at.isoformat() if getattr(p, 'created_at', None) else None,
                })
        except Exception as e:
            logger.warning('[media-library] post media list failed: %s', e)

        return Response({'items': items, 'count': len(items)})


class BoostFromPostView(APIView):
    """POST /ads/boost-from-post/ {
        post_id: int,
        ad_account_id: int,
        daily_budget_usd: float,
        duration_days: int,
        targeting: {...},
        confirm_live?: bool,
        schedule_after_publish?: bool,
    }

    Two paths:
      • Post already published (has facebook_post_id) → boost immediately via
        the same meta_ads.boost_post flow BoostPostView uses.
      • Post scheduled (status='scheduled', no facebook_post_id yet) AND
        schedule_after_publish=true → persist a 'draft' AdCampaign linked to the
        post with creative_json['boost_on_publish']=True so a scheduler can pick
        it up and boost once the post publishes. No Meta call, no spend yet.

    PAUSED-default safety: the immediate path defers to meta_ads.boost_post
    (Meta's default review state — no active spend until the ad goes live) and
    gates LIVE accounts behind _live_spend_guard.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        post_id = request.data.get('post_id')
        ad_account_id = request.data.get('ad_account_id')
        daily_budget_usd = request.data.get('daily_budget_usd')
        try:
            duration_days = int(request.data.get('duration_days', 7))
        except (TypeError, ValueError):
            duration_days = 7
        targeting = request.data.get('targeting') or {}
        schedule_after_publish = _parse_bool(
            request.data.get('schedule_after_publish'), default=False)

        if not (post_id and ad_account_id and daily_budget_usd):
            return Response(
                {'error': 'post_id, ad_account_id, daily_budget_usd are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except (Post.DoesNotExist, ValueError):
            return Response({'error': 'Post not found'},
                            status=status.HTTP_404_NOT_FOUND)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True,
            )
        except (AdAccount.DoesNotExist, ValueError):
            return Response(
                {'error': 'Ad account not found or not connected.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate budget up-front (shared with both paths).
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not math.isfinite(usd):
            return Response({'error': 'daily_budget_usd must be a finite number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if usd < 1.5:
            return Response({'error': 'Minimum daily budget is $1.50.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ── Path B: scheduled post, no FB id yet → queue boost-on-publish ──
        if not post.facebook_post_id:
            if not (post.status == 'scheduled' and schedule_after_publish):
                return Response(
                    {'error': (
                        'Post has not been published to Facebook yet. Pass '
                        'schedule_after_publish=true on a scheduled post to '
                        'queue the boost for after it publishes.'
                    )},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Still guard LIVE accounts — a queued boost will eventually spend.
            guard = _live_spend_guard(ad_account, request)
            if guard is not None:
                return guard

            daily_budget_cents = _usd_to_account_cents(usd, ad_account.currency_code)
            now = timezone.now()
            # AdCampaign has no 'pending_publish' status choice; use 'draft'
            # (not yet sent to provider) and record intent in creative_json.
            campaign = AdCampaign.objects.create(
                user=request.user,
                brand=post.brand or _first_brand(request.user),
                ad_account=ad_account,
                boosted_post=post,
                name=f'Boost: {post.caption[:40] if post.caption else post.id}',
                objective='boost_post',
                status='draft',
                daily_budget_minor=daily_budget_cents,
                start_date=post.scheduled_time or now,
                end_date=(post.scheduled_time or now) + timedelta(days=duration_days),
                targeting_json=targeting,
                creative_json={
                    'boost_on_publish': True,
                    'source_post_id': post.id,
                    'duration_days': duration_days,
                    'daily_budget_usd': usd,
                    'confirm_live': _parse_bool(request.data.get('confirm_live')),
                },
            )
            data = _serialize_campaign(campaign)
            data['boost_on_publish'] = True
            data['detail'] = (
                'Boost queued — it will launch automatically after the post '
                'publishes to Facebook.'
            )
            return Response(data, status=status.HTTP_202_ACCEPTED)

        # ── Path A: already published → boost now (mirrors BoostPostView) ──
        guard = _live_spend_guard(ad_account, request)
        if guard is not None:
            return guard

        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True,
        ).first()
        if not sa or not sa.facebook_page_id:
            return Response(
                {'error': 'No connected Facebook Page found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        daily_budget_cents = _usd_to_account_cents(usd, ad_account.currency_code)
        currency = (ad_account.currency_code or 'USD').upper()
        logger.info(
            f'[boost_from_post] budget conversion: ${usd} USD '
            f'= {daily_budget_cents} {currency} minor units'
        )

        # Diamond pre-check (reuse 'ads_boost_post').
        try:
            from accounts.services.diamond_service import pre_check
            can_afford, cost, balance = pre_check(request.user, 'ads_boost_post')
            if not can_afford:
                return Response({
                    'error': 'Insufficient Diamond Tokens',
                    'diamond_cost': cost,
                    'diamond_balance': balance,
                    'code': 'INSUFFICIENT_DIAMONDS',
                }, status=402)
        except Exception:
            pass

        # Convert the frontend's friendly targeting dict (flat interests/
        # behaviors ids, placement tokens, custom_audiences, geo) into the
        # Meta targeting spec the API expects. Already-shaped specs pass
        # through unchanged (backward-compatible). Persist the friendly
        # original in targeting_json; only the service call gets the spec.
        targeting_spec = _normalize_targeting(targeting)

        try:
            result = meta_ads.boost_post(
                ad_account=ad_account,
                page_id=sa.facebook_page_id,
                fb_post_id=post.facebook_post_id,
                daily_budget_cents=daily_budget_cents,
                duration_days=duration_days,
                targeting=targeting_spec,
                campaign_name=f'Boost: {post.caption[:40] if post.caption else post.id}',
                page_access_token=sa.facebook_access_token or '',
                advantage_audience=_parse_bool(
                    request.data.get('advantage_audience'), default=False),
            )
        except meta_ads.MetaAdsError as e:
            logger.warning(
                'boost_from_post failed user=%s post=%s err=%s raw=%s',
                request.user.id, post.id, e, e.raw,
            )
            raw = e.raw or {}
            return Response(
                {
                    'error': _friendly_meta_error(e, ad_account),
                    'code': e.code,
                    'subcode': e.subcode,
                    'error_user_title': raw.get('error_user_title'),
                    'error_user_msg': raw.get('error_user_msg'),
                    'step': str(e).split(':')[0] if ':' in str(e) else None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        campaign = AdCampaign.objects.create(
            user=request.user,
            brand=post.brand or _first_brand(request.user),
            ad_account=ad_account,
            boosted_post=post,
            name=f'Boost: {post.caption[:40] if post.caption else post.id}',
            objective='boost_post',
            status='pending_review',
            external_campaign_id=result['campaign_id'],
            external_adset_id=result['adset_id'],
            external_creative_id=result['creative_id'],
            external_ad_id=result['ad_id'],
            daily_budget_minor=daily_budget_cents,
            start_date=now,
            end_date=now + timedelta(days=duration_days),
            targeting_json=targeting,
            creative_json={
                'object_story_id': f'{sa.facebook_page_id}_{post.facebook_post_id}',
                'source_post_id': post.id,
            },
        )

        try:
            from accounts.services.diamond_service import deduct_diamonds
            deduct_diamonds(user=request.user, feature='ads_boost_post', provider='meta')
        except Exception:
            pass

        return Response(_serialize_campaign(campaign), status=status.HTTP_201_CREATED)


# Shared FX table (USD → account-currency). Mirrors BoostPostView's inline map.
_FX_PER_USD = {
    'USD': 1.0, 'BDT': 120.0, 'INR': 84.0, 'PKR': 280.0, 'IDR': 16000.0,
    'EUR': 0.92, 'GBP': 0.78, 'CAD': 1.38, 'AUD': 1.55, 'SGD': 1.35,
    'MYR': 4.5, 'AED': 3.67, 'SAR': 3.75,
}


def _usd_to_account_cents(usd, currency_code):
    """Convert a USD amount to the account-currency minor units (cents)."""
    fx = _FX_PER_USD.get((currency_code or 'USD').upper(), 1.0)
    return int(round(float(usd) * fx * 100))


class MetaCreateCampaignView(APIView):
    """POST — create a from-scratch Meta link/website campaign.

    Body:
        ad_account_id:    int (provider='meta')
        objective:        awareness|traffic|engagement|leads|sales
        name:             str
        daily_budget_usd: float (>= 1.50)
        duration_days:    int
        link_url:         str (destination — required)
        message/headline/description/image_url: creative text + optional image
        targeting:        {geo_locations, age_min, age_max, interests, ...}
        activate:         bool (go live immediately; default false = paused)
        budget_type:      'daily' (default) | 'lifetime'
        lifetime_budget_usd: float (required when budget_type='lifetime', >= 1.50)
        start_time/end_time: ISO-8601 schedule (optional; auto when absent)
        bid_strategy:     LOWEST_COST_WITHOUT_CAP (default) | LOWEST_COST_WITH_BID_CAP
                          | COST_CAP | LOWEST_COST_WITH_MIN_ROAS
        bid_amount_usd:   float (cap/target for the cap bid strategies)
        spend_cap_usd:    float (campaign-level lifetime spend ceiling)
        optimization_goal/billing_event: override the objective-mapped defaults
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ad_account_id = request.data.get('ad_account_id')
        objective = (request.data.get('objective') or 'traffic').strip().lower()
        name = (request.data.get('name') or '').strip()
        daily_budget_usd = request.data.get('daily_budget_usd')
        duration_days = int(request.data.get('duration_days', 7) or 7)
        link_url = (request.data.get('link_url') or '').strip()
        message = (request.data.get('message') or '').strip()
        headline = (request.data.get('headline') or '').strip()
        description = (request.data.get('description') or '').strip()
        image_url = (request.data.get('image_url') or '').strip()
        cta = (request.data.get('cta') or 'LEARN_MORE').strip().upper()
        display_link = (request.data.get('display_link') or '').strip()
        # Advantage+ multi-version copy (all optional; blanks dropped). When any
        # list has >1 entry the service builds an asset_feed_spec creative.
        def _str_list(v):
            if not isinstance(v, (list, tuple)):
                return []
            return [str(s).strip() for s in v if str(s).strip()]
        headlines = _str_list(request.data.get('headlines'))
        messages = _str_list(request.data.get('messages'))
        descriptions = _str_list(request.data.get('descriptions'))
        cta_types = [s.upper() for s in _str_list(request.data.get('cta_types'))]
        # UTM url_tags (creative-level) + regulated special ad categories. Both
        # optional; the service validates categories and defaults to today's
        # behavior (no url_tags, empty categories) when omitted.
        url_tags = (request.data.get('url_tags') or '').strip()
        special_ad_categories = _str_list(request.data.get('special_ad_categories'))
        # Bid / budget / schedule (all optional; defaults reproduce current
        # daily-budget, auto-schedule, lowest-cost behavior). The service layer
        # validates enums and ignores anything it doesn't recognize.
        budget_type = (request.data.get('budget_type') or 'daily').strip().lower()
        lifetime_budget_usd = request.data.get('lifetime_budget_usd')
        start_time = (request.data.get('start_time') or '').strip()
        end_time = (request.data.get('end_time') or '').strip()
        bid_strategy = (request.data.get('bid_strategy') or '').strip().upper()
        bid_amount_usd = request.data.get('bid_amount_usd')
        spend_cap_usd = request.data.get('spend_cap_usd')
        optimization_goal = (request.data.get('optimization_goal') or '').strip().upper()
        billing_event = (request.data.get('billing_event') or '').strip().upper()
        # Conversion tracking (sales/leads): a Meta Pixel + the conversion event
        # to optimize for. Both optional; without pixel_id the service keeps the
        # page_id-only promoted_object (today's behavior).
        pixel_id = (request.data.get('pixel_id') or '').strip()
        custom_event_type = (request.data.get('custom_event_type') or '').strip().upper()
        targeting = request.data.get('targeting') or {}
        # SAFETY: default to PAUSED. Use _parse_bool so the string "false"
        # (which bool("false") wrongly treats as True) cannot accidentally
        # activate a campaign and start real spend.
        activate = _parse_bool(request.data.get('activate'), default=False)

        if not (ad_account_id and daily_budget_usd and link_url):
            return Response({'error': 'ad_account_id, daily_budget_usd and link_url are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if objective not in ('awareness', 'traffic', 'engagement', 'leads', 'sales'):
            return Response({'error': f'Unsupported objective {objective!r}.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd.'}, status=status.HTTP_400_BAD_REQUEST)
        if not math.isfinite(usd):
            return Response({'error': 'daily_budget_usd must be a finite number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if usd < 1.5:
            return Response({'error': 'Minimum daily budget is $1.50.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Meta ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Guard: LIVE accounts require explicit confirmation (real spend).
        guard = _live_spend_guard(ad_account, request)
        if guard is not None:
            return guard

        # SAFETY: only *activation* starts spend. On a LIVE account, refuse to
        # go live unless the user explicitly asked to activate AND confirmed the
        # real-money warning. A missing/false activate flag always => paused.
        if activate and not getattr(ad_account, 'is_sandbox', False):
            if not _parse_bool(request.data.get('confirm_live')):
                return Response(
                    {
                        'error': 'live_activation_requires_confirmation',
                        'detail': (
                            'Activating a campaign on the LIVE account '
                            f'"{ad_account.name or ad_account.external_id}" will '
                            'start spending real money immediately. Re-submit with '
                            'activate=true and confirm_live=true, or leave it '
                            'paused (activate=false) to create without spending.'
                        ),
                        'requires_confirmation': True,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True).first()
        if not sa or not sa.facebook_page_id:
            return Response({'error': 'No connected Facebook Page found.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Default targeting if none supplied (US, broad age).
        if not targeting:
            targeting = {'geo_locations': {'countries': ['US']}, 'age_min': 18, 'age_max': 65}

        # Convert the frontend's friendly targeting dict (flat interests/
        # behaviors ids, placement tokens, custom_audiences, geo) into the
        # Meta targeting spec the API expects. Already-shaped specs pass
        # through unchanged (backward-compatible).
        targeting_spec = _normalize_targeting(targeting)

        daily_budget_cents = _usd_to_account_cents(usd, ad_account.currency_code)

        # Lifetime budget (optional). When budget_type='lifetime', the lifetime
        # amount replaces the daily budget on the ad set. Apply the same finite +
        # $1.50 minimum guard as the daily budget so the same floor holds.
        lifetime_budget_cents = 0
        if budget_type == 'lifetime':
            try:
                lt_usd = float(lifetime_budget_usd)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid lifetime_budget_usd.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if not math.isfinite(lt_usd):
                return Response({'error': 'lifetime_budget_usd must be a finite number.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if lt_usd < 1.5:
                return Response({'error': 'Minimum lifetime budget is $1.50.'},
                                status=status.HTTP_400_BAD_REQUEST)
            lifetime_budget_cents = _usd_to_account_cents(lt_usd, ad_account.currency_code)

        # Optional bid cap / target (account minor units) — only meaningful for
        # the cap/target bid strategies; the service ignores it otherwise.
        bid_amount_cents = 0
        if bid_amount_usd not in (None, ''):
            try:
                ba_usd = float(bid_amount_usd)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid bid_amount_usd.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if not math.isfinite(ba_usd) or ba_usd < 0:
                return Response({'error': 'bid_amount_usd must be a finite, non-negative number.'},
                                status=status.HTTP_400_BAD_REQUEST)
            bid_amount_cents = _usd_to_account_cents(ba_usd, ad_account.currency_code)

        # Optional campaign-level lifetime spend cap (account minor units).
        spend_cap_cents = 0
        if spend_cap_usd not in (None, ''):
            try:
                sc_usd = float(spend_cap_usd)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid spend_cap_usd.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if not math.isfinite(sc_usd) or sc_usd < 0:
                return Response({'error': 'spend_cap_usd must be a finite, non-negative number.'},
                                status=status.HTTP_400_BAD_REQUEST)
            spend_cap_cents = _usd_to_account_cents(sc_usd, ad_account.currency_code)

        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_campaign_create')
            if not can_afford:
                return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                 'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'},
                                status=402)
        except Exception:
            deduct_diamonds = None

        try:
            result = meta_ads.create_link_campaign(
                ad_account=ad_account, page_id=sa.facebook_page_id,
                objective=objective, name=name or f'Sellanto {objective.title()}',
                daily_budget_cents=daily_budget_cents, duration_days=duration_days,
                targeting=targeting_spec, link_url=link_url, message=message,
                headline=headline, description=description, image_url=image_url,
                page_access_token=sa.facebook_access_token or '', status_active=activate,
                cta=cta, display_link=display_link,
                headlines=headlines, messages=messages,
                descriptions=descriptions, cta_types=cta_types,
                url_tags=url_tags, special_ad_categories=special_ad_categories,
                bid_strategy=bid_strategy, bid_amount_cents=bid_amount_cents,
                lifetime_budget_cents=lifetime_budget_cents,
                start_time_iso=start_time, end_time_iso=end_time,
                spend_cap_cents=spend_cap_cents,
                optimization_goal=optimization_goal, billing_event=billing_event,
                pixel_id=pixel_id, custom_event_type=custom_event_type,
                advantage_audience=_parse_bool(
                    request.data.get('advantage_audience'), default=False))
        except meta_ads.MetaAdsError as e:
            display = _friendly_meta_error(e, ad_account)
            return Response({'error': display, 'code': e.code, 'subcode': e.subcode},
                            status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        campaign = AdCampaign.objects.create(
            user=request.user, brand=_first_brand(request.user), ad_account=ad_account,
            name=name or f'Sellanto {objective.title()}',
            objective=objective if objective in dict(_OBJECTIVE_KEYS) else 'traffic',
            status='active' if activate else 'paused',
            external_campaign_id=result['campaign_id'], external_adset_id=result['adset_id'],
            external_creative_id=result['creative_id'], external_ad_id=result['ad_id'],
            daily_budget_minor=daily_budget_cents,
            lifetime_budget_minor=lifetime_budget_cents or None,
            start_date=now, end_date=now + timedelta(days=duration_days),
            targeting_json=targeting,
            creative_json={'link_url': link_url, 'message': message, 'headline': headline,
                           'description': description, 'image_url': image_url,
                           'headlines': headlines, 'messages': messages,
                           'descriptions': descriptions, 'cta_types': cta_types})

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='ads_campaign_create', provider='meta')
            except Exception:
                pass

        return Response(_serialize_campaign(campaign), status=status.HTTP_201_CREATED)


class MetaCreateCarouselView(APIView):
    """POST -- create a from-scratch Meta carousel campaign (2-10 cards).

    Body:
        ad_account_id:    int (provider='meta')
        objective:        awareness|traffic|engagement|leads|sales
        name:             str
        daily_budget_usd: float (>= 1.50)
        duration_days:    int
        targeting:        {geo_locations, age_min, age_max, interests, ...}
        cards:            [{link, name, description, image_url, cta}] (2-10)
        activate:         bool (go live immediately; default false = paused)
        confirm_live:     bool (required to activate/spend on a LIVE account)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ad_account_id = request.data.get('ad_account_id')
        objective = (request.data.get('objective') or 'traffic').strip().lower()
        name = (request.data.get('name') or '').strip()
        daily_budget_usd = request.data.get('daily_budget_usd')
        duration_days = int(request.data.get('duration_days', 7) or 7)
        cards = request.data.get('cards') or []
        # Conversion tracking (sales/leads), same contract as the link-campaign
        # endpoint. Without a pixel the service downgrades the optimization goal
        # instead of letting Meta reject the ad set.
        pixel_id = (request.data.get('pixel_id') or '').strip()
        custom_event_type = (request.data.get('custom_event_type') or '').strip().upper()
        targeting = request.data.get('targeting') or {}
        # SAFETY: default to PAUSED. Use _parse_bool so the string "false"
        # cannot accidentally activate a campaign and start real spend.
        activate = _parse_bool(request.data.get('activate'), default=False)

        if not (ad_account_id and daily_budget_usd):
            return Response({'error': 'ad_account_id and daily_budget_usd are required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(cards, list) or not (2 <= len(cards) <= 10):
            return Response({'error': 'cards must be a list of 2 to 10 cards.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if objective not in ('awareness', 'traffic', 'engagement', 'leads', 'sales'):
            return Response({'error': f'Unsupported objective {objective!r}.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd.'}, status=status.HTTP_400_BAD_REQUEST)
        if not math.isfinite(usd):
            return Response({'error': 'daily_budget_usd must be a finite number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if usd < 1.5:
            return Response({'error': 'Minimum daily budget is $1.50.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Meta ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Guard: LIVE accounts require explicit confirmation (real spend).
        guard = _live_spend_guard(ad_account, request)
        if guard is not None:
            return guard

        # SAFETY: only *activation* starts spend. On a LIVE account, refuse to
        # go live unless the user explicitly asked to activate AND confirmed.
        if activate and not getattr(ad_account, 'is_sandbox', False):
            if not _parse_bool(request.data.get('confirm_live')):
                return Response(
                    {
                        'error': 'live_activation_requires_confirmation',
                        'detail': (
                            'Activating a campaign on the LIVE account '
                            f'"{ad_account.name or ad_account.external_id}" will '
                            'start spending real money immediately. Re-submit with '
                            'activate=true and confirm_live=true, or leave it '
                            'paused (activate=false) to create without spending.'
                        ),
                        'requires_confirmation': True,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True).first()
        if not sa or not sa.facebook_page_id:
            return Response({'error': 'No connected Facebook Page found.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Default targeting if none supplied (US, broad age).
        if not targeting:
            targeting = {'geo_locations': {'countries': ['US']}, 'age_min': 18, 'age_max': 65}

        # Convert the frontend's friendly targeting dict (flat interests/
        # behaviors ids, placement tokens, custom_audiences, geo) into the
        # Meta targeting spec the API expects. Already-shaped specs pass
        # through unchanged (backward-compatible).
        targeting_spec = _normalize_targeting(targeting)

        daily_budget_cents = _usd_to_account_cents(usd, ad_account.currency_code)

        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_campaign_create')
            if not can_afford:
                return Response({'error': 'Insufficient Diamond Tokens', 'diamond_cost': cost,
                                 'diamond_balance': balance, 'code': 'INSUFFICIENT_DIAMONDS'},
                                status=402)
        except Exception:
            deduct_diamonds = None

        try:
            result = meta_ads.create_carousel_campaign(
                ad_account=ad_account, page_id=sa.facebook_page_id,
                objective=objective, name=name or f'Sellanto {objective.title()} Carousel',
                daily_budget_cents=daily_budget_cents, duration_days=duration_days,
                targeting=targeting_spec, cards=cards,
                page_access_token=sa.facebook_access_token or '', status_active=activate,
                advantage_audience=_parse_bool(
                    request.data.get('advantage_audience'), default=False),
                pixel_id=pixel_id, custom_event_type=custom_event_type)
        except meta_ads.MetaAdsError as e:
            display = _friendly_meta_error(e, ad_account)
            return Response({'error': display, 'code': e.code, 'subcode': e.subcode},
                            status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        campaign = AdCampaign.objects.create(
            user=request.user, brand=_first_brand(request.user), ad_account=ad_account,
            name=name or f'Sellanto {objective.title()} Carousel',
            objective=objective if objective in dict(_OBJECTIVE_KEYS) else 'traffic',
            status='active' if activate else 'paused',
            external_campaign_id=result['campaign_id'], external_adset_id=result['adset_id'],
            external_creative_id=result['creative_id'], external_ad_id=result['ad_id'],
            daily_budget_minor=daily_budget_cents,
            start_date=now, end_date=now + timedelta(days=duration_days),
            targeting_json=targeting,
            creative_json={'format': 'carousel', 'cards': cards})

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='ads_campaign_create', provider='meta')
            except Exception:
                pass

        return Response(_serialize_campaign(campaign), status=status.HTTP_201_CREATED)


# ─────────────────────────── Meta advanced targeting lookup ─────────────────


def _resolve_meta_ad_account_for_token(request):
    """Resolve the AdAccount whose token powers a targeting/geo lookup.

    Reads ?ad_account_id= (falls back to the user's first active Meta account).
    Returns (ad_account, None) on success or (None, Response) on failure so the
    caller can `if err: return err`.
    """
    ad_account_id = request.query_params.get('ad_account_id')
    qs = AdAccount.objects.filter(
        user=request.user, provider='meta', is_active=True)
    if ad_account_id:
        qs = qs.filter(id=ad_account_id)
    ad_account = qs.first()
    if ad_account is None:
        return None, Response(
            {'error': 'Meta ad account not found or not connected.'},
            status=status.HTTP_404_NOT_FOUND)
    return ad_account, None


class MetaTargetingSearchView(APIView):
    """GET ?ad_account_id=&q=&type= → Meta targeting categories.

    `type`: interest (default) | behavior | demographic. Powers the advanced
    targeting picker (interests / behaviors / demographics) in the campaign
    builder. Read-only. Returns [{id, name, audience_size, path, type}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        search_type = (request.query_params.get('type') or 'interest').strip().lower()
        if not q:
            return Response({'error': 'q is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        ad_account, err = _resolve_meta_ad_account_for_token(request)
        if err:
            return err

        token = meta_ads.decrypt_token(ad_account.encrypted_token)
        if not token:
            return Response({'error': 'No token on ad account — re-authenticate.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            results = meta_ads.search_targeting(token, q, type=search_type)
        except meta_ads.MetaAdsError as e:
            display = _friendly_meta_error(e, ad_account)
            return Response({'error': display, 'code': e.code, 'subcode': e.subcode},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception('meta targeting search error user=%s', request.user.id)
            return Response({'error': f'Unexpected error: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'success': True, 'type': search_type, 'results': results})


class MetaGeoSearchView(APIView):
    """GET ?ad_account_id=&q= → Meta ad geo-locations (country/region/city).

    Powers the location picker in the advanced targeting builder. Read-only.
    Returns [{key, name, type, country_code}]. `key` feeds geo_locations.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response({'error': 'q is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        ad_account, err = _resolve_meta_ad_account_for_token(request)
        if err:
            return err

        token = meta_ads.decrypt_token(ad_account.encrypted_token)
        if not token:
            return Response({'error': 'No token on ad account — re-authenticate.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            results = meta_ads.search_geo(token, q)
        except meta_ads.MetaAdsError as e:
            display = _friendly_meta_error(e, ad_account)
            return Response({'error': display, 'code': e.code, 'subcode': e.subcode},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception('meta geo search error user=%s', request.user.id)
            return Response({'error': f'Unexpected error: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'success': True, 'results': results})


class MetaPixelsView(APIView):
    """GET ?ad_account_id= → the Meta Pixels on the ad account.

    Powers the conversion-tracking picker in the Create Campaign form: the user
    selects a pixel (+ conversion event) for sales/leads objectives. Read-only.
    Returns {pixels: [{id, name, last_fired_time}]}.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ad_account, err = _resolve_meta_ad_account_for_token(request)
        if err:
            return err

        try:
            pixels = meta_ads.list_ad_pixels(ad_account)
        except meta_ads.MetaAdsError as e:
            display = _friendly_meta_error(e, ad_account)
            return Response({'error': display, 'code': e.code, 'subcode': e.subcode},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception('meta pixels list error user=%s', request.user.id)
            return Response({'error': f'Unexpected error: {e}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'pixels': pixels})


# ─────────────────────────── Run Video Ad (Path A) ───────────────────────────


class RunVideoAdView(APIView):
    """One-click "Publish + Boost" video ad.

    POST multipart/form-data:
        video:             video file (mp4/mov/avi)
        caption:           str (becomes both the FB post description and ad text)
        ad_account_id:     int (Sellanto AdAccount.id)
        daily_budget_usd:  float (USD; converted to account currency server-side)
        duration_days:     int (>=1)
        targeting:         JSON string {"geo_locations": ..., "age_min": ..., "age_max": ...}

    Returns 201 with {post, campaign} on success.
    """
    permission_classes = [IsAuthenticated]

    # Approx 200 MB cap to keep upload UX reasonable (Meta allows up to 4 GB
    # but typical ad-friendly clips are < 1 min and 50 MB).
    MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024
    ALLOWED_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm')

    def post(self, request):
        video_file = request.FILES.get('video')
        caption = (request.data.get('caption') or '').strip()
        ad_account_id = request.data.get('ad_account_id')
        daily_budget_usd = request.data.get('daily_budget_usd')
        duration_days = int(request.data.get('duration_days') or 1)
        targeting_raw = request.data.get('targeting') or '{}'

        # ── validate inputs ───────────────────────────────────────────────────
        if not video_file:
            return Response({'error': 'video file is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if video_file.size > self.MAX_VIDEO_SIZE_BYTES:
            return Response(
                {'error': f'Video must be under {self.MAX_VIDEO_SIZE_BYTES // (1024 * 1024)} MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ext = ('.' + video_file.name.rsplit('.', 1)[-1].lower()) if '.' in video_file.name else ''
        if ext not in self.ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'Unsupported file format {ext!r}. Use {", ".join(self.ALLOWED_EXTENSIONS)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ad_account_id:
            return Response({'error': 'ad_account_id is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not daily_budget_usd:
            return Response({'error': 'daily_budget_usd is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            targeting = (
                targeting_raw if isinstance(targeting_raw, dict)
                else __import__('json').loads(targeting_raw)
            )
        except Exception:
            return Response({'error': 'targeting must be valid JSON'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True,
            )
        except AdAccount.DoesNotExist:
            return Response(
                {'error': 'Ad account not found or not connected.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Guard: LIVE accounts require explicit confirmation (real spend).
        guard = _live_spend_guard(ad_account, request)
        if guard is not None:
            return guard

        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True,
        ).first()
        if not sa or not sa.facebook_page_id:
            return Response(
                {'error': 'No connected Facebook Page found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── FX-convert USD to account currency minor units ────────────────────
        # Same table/logic as BoostPostView. Refresh quarterly for production.
        FX_PER_USD = {
            'USD': 1.0, 'BDT': 120.0, 'INR': 84.0, 'PKR': 280.0, 'IDR': 16000.0,
            'EUR': 0.92, 'GBP': 0.78, 'CAD': 1.38, 'AUD': 1.55, 'SGD': 1.35,
            'MYR': 4.5, 'AED': 3.67, 'SAR': 3.75,
        }
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not math.isfinite(usd):
            return Response({'error': 'daily_budget_usd must be a finite number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if usd < 1.5:
            return Response(
                {'error': 'Minimum daily budget is $1.50.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        currency = (ad_account.currency_code or 'USD').upper()
        fx_rate = FX_PER_USD.get(currency, 1.0)
        daily_budget_minor = int(round(usd * fx_rate * 100))

        # ── save uploaded file to disk ────────────────────────────────────────
        import os
        from django.conf import settings as dj_settings
        from django.utils import timezone as dj_tz
        safe_name = video_file.name.replace('/', '_').replace('\\', '_')
        rel_dir = f'ads_videos/{request.user.id}'
        abs_dir = os.path.join(dj_settings.MEDIA_ROOT, rel_dir)
        os.makedirs(abs_dir, exist_ok=True)
        filename = f'{int(dj_tz.now().timestamp())}_{safe_name}'
        abs_path = os.path.join(abs_dir, filename)
        with open(abs_path, 'wb') as f:
            for chunk in video_file.chunks():
                f.write(chunk)
        logger.info(f'[run_video_ad] saved upload to {abs_path}')

        # ── run the publish+boost flow ────────────────────────────────────────
        from ads.services.video_ad import (
            publish_and_boost_video, VideoAdError,
        )
        try:
            result = publish_and_boost_video(
                user=request.user,
                ad_account=ad_account,
                social_account=sa,
                video_path=abs_path,
                caption=caption,
                daily_budget_minor=daily_budget_minor,
                duration_days=duration_days,
                targeting=_normalize_targeting(targeting),
                advantage_audience=_parse_bool(
                    request.data.get('advantage_audience'), default=False),
            )
        except VideoAdError as e:
            logger.warning(
                'run_video_ad failed user=%s step=%s err=%s raw=%s',
                request.user.id, e.step, e, e.raw,
            )
            raw = e.raw or {}
            return Response(
                {
                    'error': raw.get('error_user_msg') or str(e),
                    'error_user_title': raw.get('error_user_title'),
                    'error_user_msg': raw.get('error_user_msg'),
                    'step': e.step,
                    'code': e.code,
                    'subcode': e.subcode,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception('run_video_ad unexpected error')
            return Response(
                {'error': f'Unexpected error: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result, status=status.HTTP_201_CREATED)


# ────────────────────────── Meta — Account Summary ──────────────────


class MetaEntityInsightsView(APIView):
    """GET /ads/meta/insights/?entity_id=&level=adset|ad&date_preset=

    Deeper drill-down insights for a single Meta ad set or ad (or campaign),
    so the UI can go campaign → ad set → ad. Ownership is enforced by resolving
    the ad account the entity lives under: pass `ad_account_id` OR `campaign_id`
    (the entity must belong to an account the user owns). Read-only; billed with
    'ads_insights_pull'.

    Query params:
        entity_id   (required) — Graph adset/ad/campaign id.
        level       — adset | ad | campaign | account (default 'ad').
        date_preset — last_7d (default) | any Meta date_preset.
        ad_account_id | campaign_id — how to resolve + authorize the account.

    Returns {level, entity_id, insights: [rows], count} where each row carries
    the same deep metric shape as the campaign insights endpoint (date,
    impressions, reach, clicks, link_clicks, spend_minor, ctr, cpc, cpm,
    frequency, conversions, roas, cpa).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entity_id = (request.GET.get('entity_id') or '').strip()
        if not entity_id:
            return Response({'error': 'entity_id is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        level = (request.GET.get('level') or 'ad').strip().lower()
        date_preset = request.GET.get('date_preset', 'last_7d')

        # Resolve + authorize the ad account this entity lives under.
        ad_account = None
        ad_account_id = request.GET.get('ad_account_id')
        campaign_id = request.GET.get('campaign_id')
        if ad_account_id:
            ad_account = AdAccount.objects.filter(
                id=ad_account_id, user=request.user,
                provider='meta', is_active=True).first()
        elif campaign_id:
            camp = AdCampaign.objects.filter(
                id=campaign_id, user=request.user).select_related('ad_account').first()
            if camp and camp.ad_account.provider == 'meta':
                ad_account = camp.ad_account
        else:
            ad_account = AdAccount.objects.filter(
                user=request.user, provider='meta', is_active=True).first()

        if not ad_account:
            return Response(
                {'error': 'Meta ad account not found or not connected. '
                          'Pass ad_account_id or campaign_id.'},
                status=status.HTTP_404_NOT_FOUND)

        # Diamond pre-check (insights pull).
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_insights_pull')
            if not can_afford:
                return Response({
                    'error': 'Insufficient Diamond Tokens',
                    'diamond_cost': cost,
                    'diamond_balance': balance,
                    'code': 'INSUFFICIENT_DIAMONDS',
                }, status=status.HTTP_402_PAYMENT_REQUIRED)
        except Exception:
            deduct_diamonds = None

        # For account-level, the Graph node is act_<external_id>, not the
        # caller-supplied entity_id (which may be a local DB id). Adset/ad/
        # campaign levels use the real Graph object id passed in entity_id.
        graph_entity = (f'act_{ad_account.external_id}'
                        if level == 'account' else entity_id)
        try:
            rows = meta_ads.get_insights(
                ad_account, graph_entity, level=level, date_preset=date_preset)
        except meta_ads.MetaAdsError as e:
            return Response({'error': _friendly_meta_error(e, ad_account)},
                            status=status.HTTP_400_BAD_REQUEST)

        out = []
        for r in rows:
            spend_minor = int(_num(r.get('spend')) * 100)
            out.append({
                'date': r.get('date_start'),
                'impressions': int(_num(r.get('impressions'))),
                'reach': int(_num(r.get('reach'))),
                'clicks': int(_num(r.get('clicks'))),
                'link_clicks': _meta_link_clicks(r),
                'spend_minor': spend_minor,
                'ctr': _num(r.get('ctr')) / 100.0,   # Meta returns %
                'cpc': _num(r.get('cpc')),
                'cpm': _num(r.get('cpm')),
                'frequency': _num(r.get('frequency')),
                'conversions': _meta_conversions(r),
                'roas': _meta_first_roas(r),
                'cpa': _meta_cpa(r),
            })

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='ads_insights_pull', provider='meta')
            except Exception:
                pass

        return Response({
            'level': level, 'entity_id': entity_id,
            'insights': out, 'count': len(out),
        })


class MetaAccountSummaryView(APIView):
    """GET /ads/meta/account-summary/?ad_account_id=&date_preset= → dashboard rollup.

    Returns account-level insight totals + campaign counts by status:
        {spend, impressions, clicks, ctr, cpc, reach, conversions,
         active_campaigns, paused_campaigns, total_campaigns}
    Diamond-billed with 'ads_insights_pull'.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ad_account_id = request.GET.get('ad_account_id')
        if not ad_account_id:
            return Response({'error': 'ad_account_id is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Meta ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Diamond pre-check (pulling insights costs Diamonds).
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_insights_pull')
        except Exception:
            logger.exception('diamond pre_check failed for ads_insights_pull user=%s', request.user.id)
            return Response({'error': 'Could not verify your Diamond balance. Please try again.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        date_preset = request.GET.get('date_preset', 'last_30d')
        try:
            summary = meta_ads.get_account_summary(ad_account, date_preset=date_preset)
        except meta_ads.MetaAdsError as e:
            return Response({'error': _friendly_meta_error(e, ad_account)},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            deduct_diamonds(user=request.user, feature='ads_insights_pull', provider='meta')
        except Exception:
            pass

        return Response(summary)


# ────────────────────────── Meta — Recommendations ──────────────────


class MetaRecommendationsView(APIView):
    """GET /ads/meta/recommendations/?ad_account_id= → actionable tips.

    Combines Meta-native recommendations (when available) with simple heuristic
    tips derived from recent insights. Returns:
        {recommendations: [{title, message, severity}]}
    Diamond-billed with 'ads_meta_recommendations'.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ad_account_id = request.GET.get('ad_account_id')
        if not ad_account_id:
            return Response({'error': 'ad_account_id is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Meta ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Diamond pre-check.
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_meta_recommendations')
        except Exception:
            logger.exception('diamond pre_check failed for ads_meta_recommendations user=%s', request.user.id)
            return Response({'error': 'Could not verify your Diamond balance. Please try again.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        try:
            recommendations = meta_ads.get_account_recommendations(ad_account)
        except meta_ads.MetaAdsError as e:
            return Response({'error': _friendly_meta_error(e, ad_account)},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            deduct_diamonds(user=request.user, feature='ads_meta_recommendations', provider='meta')
        except Exception:
            pass

        return Response({'recommendations': recommendations})


class MetaAdPreviewView(APIView):
    """POST — render a live Meta ad preview (no spend, nothing created).

    Builds an object_story_spec link_data creative from the same fields as
    MetaCreateCampaignView and calls Meta's generatepreviews to get back a
    ready-to-embed <iframe> HTML string. Purely read-only: it does NOT create a
    campaign/adset/ad and never spends, so no live-spend guard is needed.

    Body:
        ad_account_id: int (provider='meta') — required
        ad_format:     DESKTOP_FEED_STANDARD | MOBILE_FEED_STANDARD |
                       INSTAGRAM_STANDARD | INSTAGRAM_STORY |
                       FACEBOOK_STORY_MOBILE | INSTAGRAM_REELS
        link_url:      str (destination) — required
        message/headline/description/image_url/cta/display_link: creative fields
        page_id:       str (optional; resolved from the user's active FB page)

    Returns: {preview_html, ad_format}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ad_account_id = request.data.get('ad_account_id')
        ad_format = (request.data.get('ad_format') or 'MOBILE_FEED_STANDARD').strip().upper()
        link_url = (request.data.get('link_url') or '').strip()
        message = (request.data.get('message') or '').strip()
        headline = (request.data.get('headline') or '').strip()
        description = (request.data.get('description') or '').strip()
        image_url = (request.data.get('image_url') or '').strip()
        cta = (request.data.get('cta') or 'LEARN_MORE').strip().upper()
        display_link = (request.data.get('display_link') or '').strip()
        page_id = (request.data.get('page_id') or '').strip()

        if not (ad_account_id and link_url):
            return Response({'error': 'ad_account_id and link_url are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Meta ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        # Resolve the Page ID (needed for object_story_spec) from the user's
        # active Facebook SocialAccount when the client didn't pass one.
        if not page_id:
            from platforms.models import SocialAccount
            sa = SocialAccount.objects.filter(
                user=request.user, platform='facebook', is_active=True).first()
            if not sa or not sa.facebook_page_id:
                return Response({'error': 'No connected Facebook Page found.'},
                                status=status.HTTP_400_BAD_REQUEST)
            page_id = sa.facebook_page_id

        # Build link_data mirroring create_link_campaign's field mapping.
        link_data = {'link': link_url, 'message': message or ''}
        if headline:
            link_data['name'] = headline[:255]
        if description:
            link_data['description'] = description[:255]

        # Prefer an uploaded image_hash over a raw picture URL (same as create).
        image_hash = meta_ads.upload_image_from_url(ad_account, image_url) if image_url else ''
        if image_hash:
            link_data['image_hash'] = image_hash
        elif image_url:
            link_data['picture'] = image_url

        caption_url = meta_ads._normalize_display_link(display_link)
        if caption_url:
            link_data['caption'] = caption_url[:255]

        cta_type = (cta or 'LEARN_MORE').strip().upper()
        if cta_type not in meta_ads._META_CTA_TYPES:
            cta_type = 'LEARN_MORE'
        if cta_type != 'NO_BUTTON':
            link_data['call_to_action'] = {'type': cta_type, 'value': {'link': link_url}}

        creative_spec = {'object_story_spec': {'page_id': page_id, 'link_data': link_data}}

        try:
            preview_html = meta_ads.get_creative_preview(
                ad_account, creative_spec, ad_format=ad_format)
        except meta_ads.MetaAdsError as e:
            return Response({'error': _friendly_meta_error(e, ad_account),
                             'code': e.code, 'subcode': e.subcode},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response({'preview_html': preview_html, 'ad_format': ad_format})


# ────────────────────────── Meta — Instant Lead Forms ───────────────


def _resolve_facebook_page(request):
    """Resolve the user's active Facebook Page id + Page access token.

    Returns (page_id, page_access_token, error_response). On success the third
    element is None; on failure page_id/token are '' and the third element is a
    ready-to-return DRF Response.
    """
    from platforms.models import SocialAccount
    sa = SocialAccount.objects.filter(
        user=request.user, platform='facebook', is_active=True,
    ).first()
    if not sa or not sa.facebook_page_id:
        return '', '', Response(
            {'error': 'No connected Facebook Page found.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    page_token = sa.facebook_access_token or ''
    if not page_token:
        return '', '', Response(
            {'error': 'The connected Facebook Page has no access token — reconnect it.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return sa.facebook_page_id, page_token, None


class MetaLeadFormListCreateView(APIView):
    """GET + POST /ads/meta/lead-forms/ — native Instant Lead Forms.

    Page id + Page access token are resolved from the user's active Facebook
    SocialAccount (lead forms live on the Page, not the ad account).

    GET  → list the Page's lead forms (id, name, status, leads_count).
    POST → create a lead form. Body:
        name:                str
        questions:           [str | {type} | {type:'CUSTOM', key, label, options?}]
        privacy_policy_url:  str  (required by Meta)
        thank_you:           {title, body, button_text, button_type, website_url}
        intro:               {title, style, content, button_text}   (optional)
    Returns {form_id}.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        page_id, page_token, err = _resolve_facebook_page(request)
        if err is not None:
            return err
        try:
            forms = meta_ads.list_lead_forms(page_id, page_token)
        except meta_ads.MetaAdsError as e:
            logger.warning('list lead forms failed user=%s err=%s', request.user.id, e)
            return Response(
                {'error': _friendly_meta_error(e), 'code': e.code, 'subcode': e.subcode},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'forms': forms, 'count': len(forms)})

    def post(self, request):
        page_id, page_token, err = _resolve_facebook_page(request)
        if err is not None:
            return err

        name = (request.data.get('name') or '').strip()
        questions = request.data.get('questions') or []
        privacy_policy_url = (request.data.get('privacy_policy_url') or '').strip()
        thank_you = request.data.get('thank_you') or {}
        intro = request.data.get('intro') or None

        if not questions:
            return Response({'error': 'At least one question is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not privacy_policy_url:
            return Response({'error': 'privacy_policy_url is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            form_id = meta_ads.create_lead_form(
                page_id=page_id,
                page_access_token=page_token,
                name=name,
                questions=questions,
                privacy_policy_url=privacy_policy_url,
                thank_you=thank_you if isinstance(thank_you, dict) else {},
                intro=intro if isinstance(intro, dict) else None,
            )
        except meta_ads.MetaAdsError as e:
            logger.warning('create lead form failed user=%s err=%s raw=%s',
                           request.user.id, e, e.raw)
            return Response(
                {'error': _friendly_meta_error(e), 'code': e.code, 'subcode': e.subcode},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'form_id': form_id}, status=status.HTTP_201_CREATED)


class MetaLeadFormLeadsView(APIView):
    """GET /ads/meta/lead-forms/<form_id>/leads/ — leads submitted to a form.

    Uses the user's active Facebook Page access token. Returns the raw lead
    rows: [{id, created_time, field_data:[{name, values}]}].
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, form_id):
        page_id, page_token, err = _resolve_facebook_page(request)
        if err is not None:
            return err
        try:
            leads = meta_ads.get_form_leads(form_id, page_token)
        except meta_ads.MetaAdsError as e:
            logger.warning('get form leads failed user=%s form=%s err=%s',
                           request.user.id, form_id, e)
            return Response(
                {'error': _friendly_meta_error(e), 'code': e.code, 'subcode': e.subcode},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'leads': leads, 'count': len(leads)})
