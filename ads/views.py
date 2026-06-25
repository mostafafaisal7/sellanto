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


def _serialize_account(a: AdAccount) -> dict:
    return {
        'id': a.id,
        'provider': a.provider,
        'external_id': a.external_id,
        'name': a.name,
        'currency_code': a.currency_code,
        'timezone_name': a.timezone_name,
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
                'clicks': obj.clicks,
                'spend_minor': obj.spend_minor,
                'ctr': obj.ctr,
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
        for f in ('name', 'metric', 'operator', 'threshold', 'lookback_days',
                  'action', 'action_value', 'is_active'):
            if f in request.data:
                setattr(rule, f, request.data[f])
        rule.save()
        return Response(_serialize_rule(rule))

    def delete(self, request, pk):
        rule = self._get(request, pk)
        if not rule:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response({'deleted': True})


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
            'used as Performance Max audience signals — most relevant for pmax campaigns).'
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

        # Create the campaign on Meta
        try:
            result = meta_ads.boost_post(
                ad_account=ad_account,
                page_id=sa.facebook_page_id,
                fb_post_id=post.facebook_post_id,
                daily_budget_cents=daily_budget_cents,
                duration_days=duration_days,
                targeting=targeting,
                campaign_name=f'Boost: {post.caption[:40] if post.caption else post.id}',
                page_access_token=sa.facebook_access_token or '',
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
            display = ' - '.join(filter(None, [user_title, user_msg])) or str(e)
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
        targeting = request.data.get('targeting') or {}
        activate = bool(request.data.get('activate', False))

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
        if usd < 1.5:
            return Response({'error': 'Minimum daily budget is $1.50.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True)
        except AdAccount.DoesNotExist:
            return Response({'error': 'Meta ad account not found or not connected.'},
                            status=status.HTTP_404_NOT_FOUND)

        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True).first()
        if not sa or not sa.facebook_page_id:
            return Response({'error': 'No connected Facebook Page found.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Default targeting if none supplied (US, broad age).
        if not targeting:
            targeting = {'geo_locations': {'countries': ['US']}, 'age_min': 18, 'age_max': 65}

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
            result = meta_ads.create_link_campaign(
                ad_account=ad_account, page_id=sa.facebook_page_id,
                objective=objective, name=name or f'Sellanto {objective.title()}',
                daily_budget_cents=daily_budget_cents, duration_days=duration_days,
                targeting=targeting, link_url=link_url, message=message,
                headline=headline, description=description, image_url=image_url,
                page_access_token=sa.facebook_access_token or '', status_active=activate)
        except meta_ads.MetaAdsError as e:
            raw = e.raw or {}
            display = ' - '.join(filter(None, [raw.get('error_user_title'),
                                               raw.get('error_user_msg')])) or str(e)
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
            start_date=now, end_date=now + timedelta(days=duration_days),
            targeting_json=targeting,
            creative_json={'link_url': link_url, 'message': message, 'headline': headline,
                           'description': description, 'image_url': image_url})

        if deduct_diamonds:
            try:
                deduct_diamonds(user=request.user, feature='ads_campaign_create', provider='meta')
            except Exception:
                pass

        return Response(_serialize_campaign(campaign), status=status.HTTP_201_CREATED)


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
                targeting=targeting,
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
