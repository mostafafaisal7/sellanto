"""DRF views for advanced Google Ads operations (ads/services/google_ads_advanced.py).

Mounted under /api/v1/ads/google/ alongside the core ads views. Each view is a
thin wrapper: resolve the user's Google ad account, call the service, map errors.
"""
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ads.models import AdAccount, AdCampaign
from ads.services import google_ads as gads
from ads.services import google_ads_advanced as adv

logger = logging.getLogger(__name__)


def _gads_error(e):
    return Response({'error': str(e), 'details': getattr(e, 'details', [])},
                    status=status.HTTP_502_BAD_GATEWAY)


def _account(request):
    """Resolve the Google ad account from ad_account_id (query or body)."""
    aid = request.data.get('ad_account_id') if request.method == 'POST' else request.GET.get('ad_account_id')
    if not aid:
        return None, Response({'error': 'ad_account_id is required.'},
                              status=status.HTTP_400_BAD_REQUEST)
    try:
        return AdAccount.objects.get(id=aid, user=request.user, provider='google',
                                     is_active=True), None
    except AdAccount.DoesNotExist:
        return None, Response({'error': 'Google ad account not found.'},
                              status=status.HTTP_404_NOT_FOUND)


def _campaign(request, pk):
    try:
        return AdCampaign.objects.get(id=pk, user=request.user), None
    except AdCampaign.DoesNotExist:
        return None, Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)


# ── Location lookup ──────────────────────────────────────────────────────────
class LocationSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        q = (request.GET.get('q') or '').strip()
        try:
            results = adv.suggest_locations(acct, q, country_code=request.GET.get('country', ''))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, 'results': results})


# ── Audiences ────────────────────────────────────────────────────────────────
class AudienceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            results = adv.list_audiences(acct, kind=request.GET.get('kind', 'in_market'),
                                         keyword=request.GET.get('q', ''))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, 'results': results})


class CustomerMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            result = adv.create_customer_match_list(
                acct, request.data.get('name', 'CRM list'),
                emails=request.data.get('emails') or [],
                phones=request.data.get('phones') or [],
                membership_days=int(request.data.get('membership_days', 30) or 30))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)


# ── Ad group / keyword / ad editing (campaign-scoped) ────────────────────────
class CampaignAdGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            return Response({'success': True, 'ad_groups': adv.list_ad_groups(c.ad_account, c.external_campaign_id)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.create_ad_group(c.ad_account, c.external_campaign_id,
                                         request.data.get('name', 'Ad Group'),
                                         cpc_bid_usd=float(request.data.get('cpc_bid_usd', 1.0) or 1.0))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)


class AdGroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, ad_group_id):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.update_ad_group(c.ad_account, ad_group_id,
                                         name=request.data.get('name'),
                                         status=request.data.get('status'))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})

    def delete(self, request, pk, ad_group_id):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.remove_ad_group(c.ad_account, ad_group_id)
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})


class CampaignKeywordsEditView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            return Response({'success': True, 'keywords': adv.list_keywords(c.ad_account, c.external_campaign_id)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.add_keyword(c.ad_account, request.data.get('ad_group_id'),
                                     request.data.get('text', ''),
                                     match_type=request.data.get('match_type', 'BROAD'),
                                     negative=bool(request.data.get('negative', False)))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.remove_keyword(c.ad_account, request.data.get('ad_group_id'),
                                        request.data.get('criterion_id'))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})


class CampaignAdsEditView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            return Response({'success': True, 'ads': adv.list_ads(c.ad_account, c.external_campaign_id)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def patch(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.set_ad_status(c.ad_account, request.data.get('ad_group_id'),
                                       request.data.get('ad_id'), request.data.get('status', 'PAUSED'))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})

    def delete(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            result = adv.remove_ad(c.ad_account, request.data.get('ad_group_id'), request.data.get('ad_id'))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})


# ── Shared budgets + portfolio strategies ────────────────────────────────────
class SharedBudgetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            return Response({'success': True, 'budgets': adv.list_shared_budgets(acct)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            result = adv.create_shared_budget(acct, request.data.get('name', 'Shared budget'),
                                              float(request.data.get('daily_usd', 10) or 10))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)


class PortfolioStrategyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            return Response({'success': True, 'strategies': adv.list_portfolio_strategies(acct)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            result = adv.create_portfolio_strategy(
                acct, request.data.get('name', 'Portfolio'),
                request.data.get('strategy', 'target_cpa'),
                target_cpa_usd=float(request.data.get('target_cpa_usd', 0) or 0),
                target_roas=float(request.data.get('target_roas', 0) or 0))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)


# ── Segment breakdowns ───────────────────────────────────────────────────────
class SegmentBreakdownView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        c, err = _campaign(request, pk)
        if err:
            return err
        try:
            rows = adv.get_segment_breakdown(
                c.ad_account, c.external_campaign_id,
                segment=request.GET.get('segment', 'device'),
                date_preset=request.GET.get('date_preset', 'last_30d'))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, 'rows': rows})


# ── Recommendations ──────────────────────────────────────────────────────────
class RecommendationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            return Response({'success': True, 'recommendations': adv.list_recommendations(acct)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request):
        acct, err = _account(request)
        if err:
            return err
        rn = request.data.get('resource_name')
        do = request.data.get('do', 'apply')
        try:
            result = (adv.apply_recommendation(acct, rn) if do == 'apply'
                      else adv.dismiss_recommendation(acct, rn))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})


# ── Keyword Planner ──────────────────────────────────────────────────────────
class KeywordIdeasView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            ideas = adv.keyword_ideas(
                acct, seeds=request.data.get('seeds') or [],
                url=request.data.get('url', ''),
                language=request.data.get('language', 'en'),
                geo_codes=request.data.get('geo_codes') or ['US'])
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, 'ideas': ideas})


# ── Change history ───────────────────────────────────────────────────────────
class ChangeHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            events = adv.change_history(acct, days=int(request.GET.get('days', 14) or 14))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, 'events': events})


# ── Labels ───────────────────────────────────────────────────────────────────
class LabelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            return Response({'success': True, 'labels': adv.list_labels(acct)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            result = adv.create_label(acct, request.data.get('name', 'Label'),
                                      color=request.data.get('color', '#1a73e8'),
                                      description=request.data.get('description', ''))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)


# ── Experiments (A/B at campaign level) ──────────────────────────────────────
class ExperimentView(APIView):
    """List experiments, or create one (+ control/treatment arms) from a base campaign."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        acct, err = _account(request)
        if err:
            return err
        try:
            return Response({'success': True, 'experiments': adv.list_experiments(acct)})
        except gads.GoogleAdsError as e:
            return _gads_error(e)

    def post(self, request):
        # base campaign is identified by our internal campaign pk so we can reuse its ad_account.
        c, err = _campaign(request, request.data.get('campaign_pk'))
        if err:
            return err
        try:
            result = adv.create_experiment(
                c.ad_account, c.external_campaign_id,
                request.data.get('name', 'Experiment'),
                traffic_split=int(request.data.get('traffic_split', 50) or 50),
                description=request.data.get('description', ''),
                goals=request.data.get('goals') or [])
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result}, status=status.HTTP_201_CREATED)


class ExperimentDetailView(APIView):
    """Lifecycle actions on one experiment: schedule / end / promote / graduate,
    plus side-by-side results."""
    permission_classes = [IsAuthenticated]

    def get(self, request, experiment_id):
        acct, err = _account(request)
        if err:
            return err
        try:
            rows = adv.experiment_results(acct, experiment_id,
                                          date_preset=request.GET.get('date_preset', 'last_30d'))
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, 'results': rows})

    def post(self, request, experiment_id):
        acct, err = _account(request)
        if err:
            return err
        action = (request.data.get('action') or '').lower()
        try:
            if action == 'schedule':
                result = adv.schedule_experiment(acct, experiment_id,
                                                 validate_only=bool(request.data.get('validate_only')))
            elif action == 'end':
                result = adv.end_experiment(acct, experiment_id)
            elif action == 'promote':
                result = adv.promote_experiment(acct, experiment_id)
            elif action == 'graduate':
                budget = request.data.get('budget_resource')
                budget_id = request.data.get('budget_id')
                if not budget and budget_id:
                    cid = gads._digits(acct.external_id)
                    budget = f'customers/{cid}/campaignBudgets/{gads._digits(str(budget_id))}'
                if not budget:
                    return Response({'error': 'budget_resource or budget_id is required to graduate.'},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = adv.graduate_experiment(acct, experiment_id, budget)
            else:
                return Response({'error': f'Unknown action {action!r}.'},
                                status=status.HTTP_400_BAD_REQUEST)
        except gads.GoogleAdsError as e:
            return _gads_error(e)
        return Response({'success': True, **result})
